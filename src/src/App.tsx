import React, { useEffect, useMemo, useState, FormEvent } from "react";

// Logo simple embebido
const LOGO_DATA_URL =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23FFD400'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='34' fill='%23000'%3ET360%3C/text%3E%3C/svg%3E";

// Storage utils
const USERS_KEY = "taxi_users_v1";
const readUsers = () => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}") as Record<string,{password:string; mustChange:boolean}>; }
  catch { return {}; }
};
const writeUsers = (m: Record<string,{password:string; mustChange:boolean}>) =>
  localStorage.setItem(USERS_KEY, JSON.stringify(m));

const fmt = (n: number) => isNaN(n) ? "€0,00" :
  new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(n ?? 0);
const yyyymm = (d: string) => d.slice(0,7);
const yyyy = (d: string) => d.slice(0,4);
const dim = (y: number,m: number) => new Date(y, m+1, 0).getDate();
const todayStr = () => new Date().toISOString().slice(0,10);

type Entry = {
  id: number; date: string;
  total: number; card: number; cash: number;
  expCash: number; expCard: number; efectivoTotal: number;
  driverPct: number; driverShare: number; diff: number;
  km?: number; note?: string;
};

export default function App() {
  // Auth
  const [stage, setStage] = useState<"login"|"change"|"app">("login");
  const [license, setLicense] = useState(""); const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(""); const [user, setUser] = useState<{license:string}|null>(null);
  const [newPass1, setNewPass1] = useState(""); const [newPass2, setNewPass2] = useState("");

  const keys = (lic: string) => ({ entries:`taxi_entries_${lic}`, settings:`taxi_settings_${lic}` });

  // Tabs
  const TABS = ["HOY","HISTORIAL","RESUMEN","CONFIG"] as const;
  const [tab, setTab] = useState<(typeof TABS)[number]>("HOY");

  // Data
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<{ monthlyGoals: Record<string,number>; driverPct: number }>({ monthlyGoals:{}, driverPct:40 });

  // Form
  const [date, setDate] = useState(todayStr());
  const [total, setTotal] = useState<number|string>(0);
  const [card, setCard] = useState<number|string>(0);
  const [expCash, setExpCash] = useState<number|string>(0);
  const [expCard, setExpCard] = useState<number|string>(0);
  const [driverPct, setDriverPct] = useState<number|string>(40);
  const [km, setKm] = useState<number|string>(0);
  const [note, setNote] = useState("");

  // Filters
  const currentMonthKey = new Date().toISOString().slice(0,7);
  const currentYearKey = new Date().getFullYear().toString();
  const [filterMonth, setFilterMonth] = useState(currentMonthKey);
  const [filterYear, setFilterYear] = useState("");
  const [q, setQ] = useState("");

  // Auto values
  const eff = Math.max(0, (+total||0) - (+card||0));
  const effTotal = Math.max(0, (+total||0) - (+card||0) - (+expCash||0));

  // Seed DEMO
  useEffect(() => {
    const users = readUsers();
    if (!users["TAXI123"]) {
      users["TAXI123"] = { password:"demo", mustChange:false };
      writeUsers(users);
      const dk = keys("TAXI123");
      const base = new Date();
      const demo: Entry[] = Array.from({length:6}).map((_,i)=>{
        const d = new Date(base); d.setDate(d.getDate()-i);
        const ds = d.toISOString().slice(0,10);
        const t = 180 + Math.round(Math.random()*140);
        const c = Math.round(t*(0.55+Math.random()*0.25));
        const ge= Math.round(Math.random()*15);
        const gt= Math.round(Math.random()*20);
        const pct=0.4;
        const cash = Math.max(0, t-c);
        const effTot = Math.max(0, t-c-ge);
        const driverShare = t*pct;
        const diff= driverShare - effTot;
        return { id: Date.now()+i, date: ds, total:t, card:c, cash, expCash:ge, expCard:gt, efectivoTotal: effTot, driverPct:pct, driverShare, diff, km:50+Math.round(Math.random()*80), note: i%2? "Turno noche":"Turno día" };
      });
      localStorage.setItem(dk.entries, JSON.stringify(demo));
      localStorage.setItem(dk.settings, JSON.stringify({ monthlyGoals: { [currentMonthKey]:6000 }, driverPct:40 }));
    }
  }, []);

  // Auth handlers
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const lic = (license||"").trim();
    if (!lic) return setAuthError("Introduce la licencia");
    const users = readUsers();
    if (!users[lic]) { users[lic] = { password: lic, mustChange: true }; writeUsers(users); }
    if (password !== users[lic].password) return setAuthError("Contraseña incorrecta");
    if (users[lic].mustChange) return setStage("change");
    setUser({ license: lic }); setStage("app"); setAuthError("");
  };
  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (newPass1.length < 4) return setAuthError("La contraseña debe tener al menos 4 caracteres");
    if (newPass1 !== newPass2) return setAuthError("Las contraseñas no coinciden");
    const lic = (license||"").trim();
    const users = readUsers();
    users[lic].password = newPass1; users[lic].mustChange = false; writeUsers(users);
    setUser({ license: lic }); setStage("app"); setAuthError("");
  };
  const logout = () => { setUser(null); setPassword(""); setStage("login"); };

  // Load/save per user
  useEffect(()=>{ if(!user) return;
    const k = keys(user.license);
    try { const raw = localStorage.getItem(k.entries); const arr:Entry[] = raw? JSON.parse(raw): []; setEntries(arr.sort((a,b)=> +new Date(b.date) - +new Date(a.date))); }
    catch { setEntries([]); }
    try { const rawS = localStorage.getItem(k.settings); const s = rawS? JSON.parse(rawS): { monthlyGoals:{}, driverPct:40 }; setSettings(s); setDriverPct(s.driverPct ?? 40); }
    catch { setSettings({ monthlyGoals:{}, driverPct:40 }); setDriverPct(40); }
  },[user]);

  useEffect(()=>{ if(user) localStorage.setItem(keys(user.license).entries, JSON.stringify(entries)); },[entries,user]);
  useEffect(()=>{ if(user) localStorage.setItem(keys(user.license).settings, JSON.stringify(settings)); },[settings,user]);

  // CRUD
  const addEntry = (e: FormEvent) => {
    e.preventDefault();
    const t=+total||0, c=+card||0, ge=+expCash||0, gt=+expCard||0, pct=(+driverPct||0)/100;
    const cash = Math.max(0, t-c);
    const efectivoTotal = Math.max(0, t-c-ge);
    const driverShare = t*pct;
    const diff = driverShare - efectivoTotal;
    const entry: Entry = { id:Date.now(), date, total:t, card:c, cash, expCash:ge, expCard:gt, efectivoTotal, driverPct:pct, driverShare, diff, km:+km||0, note };
    setEntries(p=>[entry,...p].sort((a,b)=> +new Date(b.date) - +new Date(a.date)));
    setDate(todayStr()); setTotal(0); setCard(0); setExpCash(0); setExpCard(0); setKm(0); setNote("");
  };
  const removeEntry = (id:number) => { if(!confirm("¿Eliminar este registro?")) return; setEntries(p=>p.filter(x=>x.id!==id)); };

  // Aggregations
  const summarize = (list: Entry[]) => list.reduce((s,r)=>({
    total: s.total+r.total, card: s.card+r.card, cash: s.cash+r.cash,
    expCash: s.expCash+r.expCash, expCard: s.expCard+r.expCard,
    efectivoTotal: s.efectivoTotal+r.efectivoTotal,
    driverShare: s.driverShare+r.driverShare, diff: s.diff+r.diff,
    km: s.km + (r.km||0), days: s.days+1
  }),{ total:0, card:0, cash:0, expCash:0, expCard:0, efectivoTotal:0, driverShare:0, diff:0, km:0, days:0 });

  const byMonth = useMemo(()=>{ const m:Record<string,Entry[]>={}; for(const e of entries) (m[yyyymm(e.date)] ||= []).push(e); return m; },[entries]);
  const byYear  = useMemo(()=>{ const m:Record<string,Entry[]>={}; for(const e of entries) (m[yyyy(e.date)]  ||= []).push(e); return m; },[entries]);

  const monthKeys = useMemo(()=>[...new Set(entries.map(e=>yyyymm(e.date)))].sort((a,b)=>b.localeCompare(a)),[entries]);
  const yearKeys  = useMemo(()=>[...new Set(entries.map(e=>yyyy(e.date)))].sort((a,b)=>b.localeCompare(a)),[entries]);

  const currentMonthList = byMonth[currentMonthKey] || [];
  const sumMonth = summarize(currentMonthList);

  const currentYearList = byYear[currentYearKey] || [];
  const sumYear = summarize(currentYearList);

  const last7 = entries.slice(0,7).reverse();
  const avg7 = last7.length ? summarize(last7).total / last7.length : 0;
  const avgMTD = currentMonthList.length ? sumMonth.total / currentMonthList.length : 0;

  const goal = settings.monthlyGoals[currentMonthKey] || 0;
  const now = new Date();
  const daysInMonth = dim(now.getFullYear(), now.getMonth());
  const remainingDays = Math.max(0, daysInMonth - now.getDate() + 1);
  const remainingToGoal = Math.max(0, goal - sumMonth.total);
  const requiredPerDay = remainingDays ? remainingToGoal / remainingDays : 0;
  const progressPct = goal>0 ? Math.min(100, Math.round((sumMonth.total/goal)*100)) : 0;

  const visibleEntries = useMemo(()=>entries.filter(e=>{
    const inDate = filterMonth ? e.date.startsWith(filterMonth) : (filterYear ? e.date.startsWith(filterYear) : true);
    const text = `${e.date} ${(e.note||"").toLowerCase()}`;
    const inSearch = q.trim() ? text.includes(q.trim().toLowerCase()) : true;
    return inDate && inSearch;
  }), [entries, filterMonth, filterYear, q]);
  const sumVisible = summarize(visibleEntries);

  // Auth screens
  if (stage !== "app" || !user) {
    return (
      <div className="min-h-screen bg-black text-yellow-400 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-black/40 border border-yellow-600 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <img src={LOGO_DATA_URL} alt="logo" className="w-10 h-10 rounded-full object-cover" />
            <h1 className="text-lg font-semibold">Taxi360BCN — Acceso</h1>
          </div>

          {stage === "login" && (
            <form onSubmit={handleLogin} className="space-y-3">
              <label className="block text-sm">
                Licencia
                <input className="mt-1 w-full p-2 rounded bg-white text-black"
                  value={license} onChange={(e)=>setLicense(e.target.value)} placeholder="Ej. TAXI123" required />
              </label>
              <label className="block text-sm">
                Contraseña
                <input className="mt-1 w-full p-2 rounded bg-white text-black" type="password"
                  value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Por defecto es la licencia" required />
              </label>
              {authError && <div className="text-red-400 text-sm">{authError}</div>}
              <button type="submit" className="w-full py-2 bg-yellow-400 text-black rounded font-medium">Entrar</button>
              <p className="text-xs text-yellow-200/70">Usuario demo: <b>TAXI123</b> · Contraseña: <b>demo</b></p>
            </form>
          )}

          {stage === "change" && (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="text-sm mb-2">Primer inicio para licencia <strong>{license}</strong>. Cambia tu contraseña:</div>
              <label className="block text-sm">
                Nueva contraseña
                <input className="mt-1 w-full p-2 rounded bg-white text-black" type="password"
                  value={newPass1} onChange={(e)=>setNewPass1(e.target.value)} required />
              </label>
              <label className="block text-sm">
                Repetir contraseña
                <input className="mt-1 w-full p-2 rounded bg-white text-black" type="password"
                  value={newPass2} onChange={(e)=>setNewPass2(e.target.value)} required />
              </label>
              {authError && <div className="text-red-400 text-sm">{authError}</div>}
              <button type="submit" className="w-full py-2 bg-yellow-400 text-black rounded font-medium">Guardar y entrar</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // App
  return (
    <div className="min-h-screen bg-black text-yellow-400">
      <header className="max-w-6xl mx-auto p-4 flex items-center justify-between border-b border-yellow-500/40">
        <div className="flex items-center gap-3">
          <img src={LOGO_DATA_URL} alt="logo" className="w-12 h-12 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-semibold text-yellow-300">Taxi360BCN — Contabilidad</h1>
            <div className="text-xs text-yellow-200/70">Usuario: {user.license}</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {TABS.map((t)=>(
            <button key={t} onClick={()=>setTab(t)}
              className={"px-3 py-1 rounded border " + (tab===t? "bg-yellow-400 text-black border-yellow-600" : "border-yellow-600")}>
              {t}
            </button>
          ))}
          <button onClick={logout} className="px-3 py-1 border border-yellow-600 rounded">Salir</button>
        </div>
      </header>

      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-black/80 border-t border-yellow-600 px-2 py-2 grid grid-cols-4 gap-2">
        {TABS.map((t)=>(
          <button key={t} onClick={()=>setTab(t)}
            className={"text-sm py-2 rounded " + (tab===t? "bg-yellow-400 text-black" : "border border-yellow-600")}>
            {t}
          </button>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto p-4 pb-24 md:pb-8">
        {tab === "HOY" && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Card title="Facturación del mes" value={fmt(sumMonth.total)}>
                <div className="text-xs text-slate-700">Visa {fmt(sumMonth.card)} · Efectivo {fmt(sumMonth.cash)}</div>
              </Card>
              <Card title="Gastos del mes" value={fmt(sumMonth.expCash + sumMonth.expCard)}>
                <div className="text-xs text-slate-700">Efectivo {fmt(sumMonth.expCash)} · Tarjeta {fmt(sumMonth.expCard)}</div>
              </Card>
              <Card title="Pendiente chofer (mes)" value={fmt(sumMonth.diff)}>
                <div className="text-xs text-slate-700">+ dueño paga · − chofer devuelve</div>
              </Card>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Card title="Promedio diario (últimos 7 días)" value={fmt(avg7)}>
                <div className="text-xs text-slate-700">Con {last7.length} días registrados</div>
              </Card>
              <Card title="Promedio diario (mes en curso)" value={fmt(avgMTD)}>
                <div className="text-xs text-slate-700">{currentMonthList.length} días con datos</div>
              </Card>
              <Card title="Meta mensual" value={fmt(goal)}>
                <div className="text-xs text-slate-700">Faltan {fmt(remainingToGoal)} · Requerido/día {fmt(requiredPerDay)} ({remainingDays} días)</div>
                <div className="mt-2 w-full h-2 rounded bg-yellow-200/40 overflow-hidden">
                  <div className={"h-2 " + (progressPct < 50 ? "bg-red-400" : progressPct < 80 ? "bg-yellow-400" : "bg-emerald-400")} style={{ width: `${progressPct}%` }} />
                </div>
              </Card>
            </section>

            <section className="bg-black/30 border border-yellow-500/30 rounded-xl p-4 mt-6">
              <h2 className="text-lg font-semibold mb-3 text-yellow-300">Registrar día</h2>
              <form onSubmit={addEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <L label="Fecha"><input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} required/></L>
                <L label="Facturación total (€)"><input className="input" type="number" step="0.01" value={total} onChange={(e)=>setTotal(e.target.value)} required/></L>
                <L label="Visa / Tarjeta (€)"><input className="input" type="number" step="0.01" value={card} onChange={(e)=>setCard(e.target.value)}/></L>
                <L label="Gasto en efectivo (€)"><input className="input" type="number" step="0.01" value={expCash} onChange={(e)=>setExpCash(e.target.value)}/></L>
                <L label="Gasto con tarjeta (€)"><input className="input" type="number" step="0.01" value={expCard} onChange={(e)=>setExpCard(e.target.value)}/></L>
                <L label="% pago chofer"><input className="input" type="number" step={1} value={driverPct} onChange={(e)=>setDriverPct(e.target.value)} onBlur={()=>setSettings(s=>({...s, driverPct:+driverPct||0 }))}/></L>
                <L label="Km recorridos"><input className="input" type="number" step={1} value={km} onChange={(e)=>setKm(e.target.value)}/></L>
                <L label="Notas"><input className="input" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Opcional"/></L>
                <L label="Efectivo recibido (auto)"><input className="input bg-yellow-50" type="number" value={eff} readOnly/></L>
                <L label="Efectivo total (auto)"><input className="input bg-yellow-50" type="number" value={effTotal} readOnly/></L>
                <div className="md:col-span-3 flex gap-3 mt-2">
                  <button className="btn-primary" type="submit">Guardar día</button>
                  <button className="btn-outline" type="button" onClick={()=>{ setTotal(0); setCard(0); setExpCash(0); setExpCard(0); setKm(0); setNote(""); }}>Limpiar</button>
                </div>
              </form>
              <p className="text-xs text-yellow-200/70 mt-2">Efectivo recibido = Facturación − Visa · Efectivo total = Facturación − Visa − Gasto en efectivo · Pago chofer = Facturación × %</p>
            </section>

            <section className="bg-black/30 border border-yellow-500/30 rounded-xl p-4 mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-yellow-300">Últimos 7 días</h3>
                <div className="text-sm">Promedio 7d: <span className="font-semibold">{fmt(avg7)}</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-yellow-300">
                      <th className="th-left">Fecha</th><th className="th-right">Facturación</th><th className="th-right">Tarjeta</th><th className="th-right">Efectivo total</th><th className="th-right">Pago chofer</th><th className="th-right">Diferencia</th><th className="th-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {last7.length===0 && <tr><td className="p-3" colSpan={7}>Sin registros</td></tr>}
                    {last7.map(r=>(
                      <tr key={r.id} className="border-t border-yellow-500/20">
                        <td className="td-left">{r.date}</td>
                        <td className="td-right">{fmt(r.total)}</td>
                        <td className="td-right">{fmt(r.card)}</td>
                        <td className="td-right">{fmt(r.efectivoTotal)}</td>
                        <td className="td-right">{fmt(r.driverShare)}</td>
                        <td className={"td-right " + (r.diff<0 ? "text-red-400":"text-emerald-400")}>{fmt(r.diff)}</td>
                        <td className="td-right"><button className="px-2 py-1 text-xs border border-yellow-600 rounded" onClick={()=>removeEntry(r.id)}>Eliminar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === "HISTORIAL" && (
          <section className="bg-black/30 border border-yellow-500/30 rounded-xl p-4 mt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <h3 className="font-semibold text-yellow-300">Historial</h3>
              <div className="flex flex-wrap gap-2">
                <select className="select" value={filterMonth} onChange={(e)=>{ setFilterMonth(e.target.value); setFilterYear(""); }}>
                  {!filterMonth && <option value="">Filtrar por mes</option>}
                  {monthKeys.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="select" value={filterYear} onChange={(e)=>{ setFilterYear(e.target.value); setFilterMonth(""); }}>
                  <option value="">Filtrar por año</option>
                  {yearKeys.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <input className="select" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar fecha o nota…" />
                <button className="btn-outline" onClick={()=>{
                  setFilterMonth(currentMonthKey); setFilterYear(""); setQ("");
                }}>Limpiar</button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-yellow-300">
                    <th className="th-left">Fecha</th><th className="th-right">Total</th><th className="th-right">Tarjeta</th><th className="th-right">Efectivo</th><th className="th-right">Gasto efectivo</th><th className="th-right">Gasto tarjeta</th><th className="th-right">Efectivo total</th><th className="th-right">% chofer</th><th className="th-right">Pago chofer</th><th className="th-right">Dif.</th><th className="th-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.length===0 && <tr><td className="p-3" colSpan={11}>Sin registros</td></tr>}
                  {visibleEntries.map(r=>(
                    <tr key={r.id} className="border-t border-yellow-500/20">
                      <td className="td-left">{r.date}</td>
                      <td className="td-right">{fmt(r.total)}</td>
                      <td className="td-right">{fmt(r.card)}</td>
                      <td className="td-right">{fmt(r.cash)}</td>
                      <td className="td-right">{fmt(r.expCash)}</td>
                      <td className="td-right">{fmt(r.expCard)}</td>
                      <td className="td-right">{fmt(r.efectivoTotal)}</td>
                      <td className="td-right">{Math.round(r.driverPct*100)}%</td>
                      <td className="td-right">{fmt(r.driverShare)}</td>
                      <td className={"td-right " + (r.diff<0 ? "text-red-400":"text-emerald-400")}>{fmt(r.diff)}</td>
                      <td className="td-left">{r.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <Card title="Total facturado (filtro)" value={fmt(sumVisible.total)} />
              <Card title="Total gastos (filtro)" value={fmt(sumVisible.expCash + sumVisible.expCard)} />
              <Card title="Ganancia propiet. (estimada)" value={fmt(sumVisible.total - sumVisible.driverShare - sumVisible.expCash - sumVisible.expCard)} />
            </div>
          </section>
        )}

        {tab === "RESUMEN" && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card title="Mes actual — Total" value={fmt(sumMonth.total)}>
                <div className="text-xs text-slate-700">Visa {fmt(sumMonth.card)} · Efectivo {fmt(sumMonth.cash)}</div>
              </Card>
              <Card title="Mes actual — Gastos" value={fmt(sumMonth.expCash + sumMonth.expCard)}>
                <div className="text-xs text-slate-700">Efectivo {fmt(sumMonth.expCash)} · Tarjeta {fmt(sumMonth.expCard)}</div>
              </Card>
              <Card title="Mes actual — Ganancia propiet." value={fmt(sumMonth.total - sumMonth.driverShare - sumMonth.expCash - sumMonth.expCard)}>
                <div className="text-xs text-slate-700">Tras % chofer y gastos</div>
              </Card>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card title={`Año ${currentYearKey} — Total`} value={fmt(sumYear.total)} />
              <Card title={`Año ${currentYearKey} — Gastos`} value={fmt(sumYear.expCash + sumYear.expCard)} />
              <Card title={`Año ${currentYearKey} — Ganancia propiet.`} value={fmt(sumYear.total - sumYear.driverShare - sumYear.expCash - sumYear.expCard)} />
            </section>
          </>
        )}

        {tab === "CONFIG" && (
          <section className="bg-black/30 border border-yellow-500/30 rounded-xl p-4 mt-6 space-y-3">
            <h3 className="font-semibold text-yellow-300">Configuración</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <L label="% pago chofer (por defecto)">
                <input className="input" type="number" step={1}
                  value={settings.driverPct ?? 40}
                  onChange={(e)=>setSettings(s=>({ ...s, driverPct: +e.target.value || 0 }))} />
              </L>
              <L label={`Meta mensual para ${currentMonthKey}`}>
                <input className="input" type="number" step={0.01}
                  value={settings.monthlyGoals[currentMonthKey] ?? 0}
                  onChange={(e)=>setSettings(s=>({ ...s, monthlyGoals: { ...s.monthlyGoals, [currentMonthKey]: +e.target.value || 0 } }))} />
              </L>
              <div className="flex items-end">
                <button className="btn-primary"
                  onClick={()=>user && localStorage.setItem(keys(user.license).settings, JSON.stringify(settings))}>
                  Guardar cambios
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Card({ title, value, children }: { title: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-yellow-50 text-black p-4 rounded-xl">
      <div className="text-sm">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {children}
    </div>
  );
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm">{label}<div className="mt-1">{children}</div></label>;
}
