import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Trash2, RotateCcw, PiggyBank } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Defaults — example NZD figures for a single researcher in Dunedin. */
/*  Everything is editable; these are just a starting structure.       */
/* ------------------------------------------------------------------ */
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULTS = {
  currency: "NZD",
  income: [
    { id: uid(), label: "Research salary / stipend", amount: "4200" },
    { id: uid(), label: "Other (tutoring, freelance…)", amount: "0" },
  ],
  groups: {
    essentials: {
      title: "Essentials",
      blurb: "needs",
      items: [
        { id: uid(), label: "Rent / accommodation", amount: "1300" },
        { id: uid(), label: "Groceries", amount: "550" },
        { id: uid(), label: "Utilities & internet", amount: "180" },
        { id: uid(), label: "Transport", amount: "140" },
        { id: uid(), label: "Phone", amount: "40" },
        { id: uid(), label: "Health / insurance", amount: "90" },
      ],
    },
    lifestyle: {
      title: "Lifestyle",
      blurb: "wants",
      items: [
        { id: uid(), label: "Dining out & coffee", amount: "150" },
        { id: uid(), label: "Recreation & hobbies", amount: "150" },
        { id: uid(), label: "Subscriptions", amount: "40" },
        { id: uid(), label: "Other / misc", amount: "100" },
      ],
    },
    savings: {
      title: "Savings & goals",
      blurb: "savings",
      items: [
        { id: uid(), label: "Emergency fund", amount: "350" },
        { id: uid(), label: "Partner visa & relocation", amount: "400" },
        { id: uid(), label: "Investments / savings", amount: "250" },
        { id: uid(), label: "Family support", amount: "100" },
      ],
    },
  },
};

const GROUP_ORDER = ["essentials", "lifestyle", "savings"];
const COLORS = {
  essentials: "#0E9C6E",
  lifestyle: "#E2A53A",
  savings: "#E25B54",
  unallocated: "#C3CCD6",
};
const SYMBOLS = { NZD: "$", AUD: "$", USD: "$", CAD: "$", EUR: "€", GBP: "£", IRR: "﷼" };
const CURRENCIES = ["NZD", "USD", "AUD", "EUR", "GBP", "IRR"];
const STORE_KEY = "budget:v2";

const num = (s) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export default function BudgetTool() {
  const [state, setState] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  /* ---- persistence (auto-save across sessions, graceful fallback) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = typeof window !== "undefined" ? window.storage : null;
      if (store) {
        try {
          const r = await store.get(STORE_KEY);
          if (!cancelled && r && r.value) setState(JSON.parse(r.value));
        } catch (e) {
          /* no saved budget yet — keep defaults */
        }
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const store = typeof window !== "undefined" ? window.storage : null;
    if (!store) return;
    (async () => {
      try {
        await store.set(STORE_KEY, JSON.stringify(state));
      } catch (e) {
        /* saving failed — tool still works in-session */
      }
    })();
  }, [state, loaded]);

  const sym = SYMBOLS[state.currency] || "$";
  const fmt = (n) =>
    `${sym}${Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  /* ---------------------------- maths ---------------------------- */
  const totals = useMemo(() => {
    const income = state.income.reduce((a, b) => a + num(b.amount), 0);
    const g = {};
    GROUP_ORDER.forEach((k) => {
      g[k] = state.groups[k].items.reduce((a, b) => a + num(b.amount), 0);
    });
    const allocated = GROUP_ORDER.reduce((a, k) => a + g[k], 0);
    const unallocated = income - allocated;
    const savingsRate = income > 0 ? (g.savings / income) * 100 : 0;
    return { income, g, allocated, unallocated, savingsRate };
  }, [state]);

  const pieData = useMemo(() => {
    const d = GROUP_ORDER.map((k) => ({
      key: k,
      name: state.groups[k].title,
      value: totals.g[k],
      color: COLORS[k],
    })).filter((x) => x.value > 0);
    if (totals.unallocated > 0)
      d.push({ key: "unallocated", name: "Left to assign", value: totals.unallocated, color: COLORS.unallocated });
    return d;
  }, [state, totals]);

  /* 50 / 30 / 20 split as % of income */
  const split = useMemo(() => {
    const inc = totals.income || 1;
    return {
      needs: (totals.g.essentials / inc) * 100,
      wants: (totals.g.lifestyle / inc) * 100,
      savings: (totals.g.savings / inc) * 100,
      free: Math.max(0, (totals.unallocated / inc) * 100),
    };
  }, [totals]);

  /* ---------------------------- editing ---------------------------- */
  const setIncome = (id, key, val) =>
    setState((s) => ({
      ...s,
      income: s.income.map((it) => (it.id === id ? { ...it, [key]: val } : it)),
    }));
  const addIncome = () =>
    setState((s) => ({ ...s, income: [...s.income, { id: uid(), label: "New income", amount: "0" }] }));
  const removeIncome = (id) =>
    setState((s) => ({ ...s, income: s.income.filter((it) => it.id !== id) }));

  const setItem = (gk, id, key, val) =>
    setState((s) => ({
      ...s,
      groups: {
        ...s.groups,
        [gk]: { ...s.groups[gk], items: s.groups[gk].items.map((it) => (it.id === id ? { ...it, [key]: val } : it)) },
      },
    }));
  const addItem = (gk) =>
    setState((s) => ({
      ...s,
      groups: { ...s.groups, [gk]: { ...s.groups[gk], items: [...s.groups[gk].items, { id: uid(), label: "New item", amount: "0" }] } },
    }));
  const removeItem = (gk, id) =>
    setState((s) => ({
      ...s,
      groups: { ...s.groups, [gk]: { ...s.groups[gk], items: s.groups[gk].items.filter((it) => it.id !== id) } },
    }));

  const reset = () => {
    if (typeof window !== "undefined" && !window.confirm("Reset every figure back to the example budget?")) return;
    setState({
      ...DEFAULTS,
      income: DEFAULTS.income.map((i) => ({ ...i, id: uid() })),
      groups: Object.fromEntries(
        GROUP_ORDER.map((k) => [k, { ...DEFAULTS.groups[k], items: DEFAULTS.groups[k].items.map((i) => ({ ...i, id: uid() })) }])
      ),
    });
  };

  /* ---- status line on the readout ---- */
  const status =
    totals.unallocated > 0.5
      ? { text: `${fmt(totals.unallocated)} still to assign`, tone: "warn" }
      : totals.unallocated < -0.5
      ? { text: `Over by ${fmt(-totals.unallocated)} — trim somewhere`, tone: "bad" }
      : { text: "Every dollar has a job. Balanced.", tone: "good" };

  return (
    <div className="bgt-root">
      <style>{CSS}</style>

      {/* header */}
      <header className="bgt-head">
        <div>
          <h1>Monthly budget</h1>
          <p className="sub">Edit any figure — it saves automatically on this device.</p>
        </div>
        <div className="head-controls">
          <label className="ctrl">
            <span>Currency</span>
            <select
              value={state.currency}
              onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <button className="reset" onClick={reset} title="Reset to example figures">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </header>

      {/* instrument readout */}
      <section className="readout" aria-label="Budget summary">
        <div className="scale" aria-hidden="true" />
        <div className="readout-grid">
          <Stat label="Income in" value={fmt(totals.income)} accent="#5BE3B3" />
          <Stat label="Allocated" value={fmt(totals.allocated)} />
          <Stat
            label="Left to assign"
            value={`${totals.unallocated < 0 ? "−" : ""}${fmt(Math.abs(totals.unallocated))}`}
            accent={status.tone === "bad" ? "#FF8A82" : status.tone === "good" ? "#5BE3B3" : "#FFD27A"}
          />
        </div>
        <div className={`status status-${status.tone}`}>
          <span className="dot" /> {status.text}
        </div>
      </section>

      {/* body */}
      <div className="body">
        {/* editor */}
        <div className="editor">
          <Section title="Income" accent="#1F8F66" muted>
            {state.income.map((it) => (
              <Row
                key={it.id}
                item={it}
                sym={sym}
                onLabel={(v) => setIncome(it.id, "label", v)}
                onAmount={(v) => setIncome(it.id, "amount", v)}
                onRemove={() => removeIncome(it.id)}
              />
            ))}
            <AddBtn onClick={addIncome} text="Add income source" />
          </Section>

          {GROUP_ORDER.map((gk) => (
            <Section
              key={gk}
              title={state.groups[gk].title}
              accent={COLORS[gk]}
              total={fmt(totals.g[gk])}
            >
              {state.groups[gk].items.map((it) => (
                <Row
                  key={it.id}
                  item={it}
                  sym={sym}
                  onLabel={(v) => setItem(gk, it.id, "label", v)}
                  onAmount={(v) => setItem(gk, it.id, "amount", v)}
                  onRemove={() => removeItem(gk, it.id)}
                />
              ))}
              <AddBtn onClick={() => addItem(gk)} text={`Add to ${state.groups[gk].title.toLowerCase()}`} />
            </Section>
          ))}
        </div>

        {/* insights */}
        <aside className="insights">
          <div className="card">
            <h3>Where it goes</h3>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={62}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTip fmt={fmt} income={totals.income} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="c-label">spending</span>
                <span className="c-value">{fmt(totals.allocated - totals.g.savings)}</span>
              </div>
            </div>
            <ul className="legend">
              {pieData.map((d) => (
                <li key={d.key}>
                  <span className="sw" style={{ background: d.color }} />
                  <span className="lg-name">{d.name}</span>
                  <span className="lg-val">{fmt(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="rate-head">
              <PiggyBank size={16} />
              <h3>Savings rate</h3>
              <span className="rate-num">{totals.savingsRate.toFixed(0)}%</span>
            </div>
            <p className="rate-note">
              of income going to savings & goals. A common target is around 20%.
            </p>
          </div>

          <div className="card">
            <h3>50 / 30 / 20 check</h3>
            <SplitBar split={split} />
            <div className="split-key">
              <Key c={COLORS.essentials} t="Needs" a={split.needs} target={50} />
              <Key c={COLORS.lifestyle} t="Wants" a={split.wants} target={30} />
              <Key c={COLORS.savings} t="Savings" a={split.savings} target={20} />
            </div>
          </div>
        </aside>
      </div>

      <footer className="foot">
        A rule-of-thumb scaffold, not financial advice — bend the categories to fit your life.
      </footer>
    </div>
  );
}

/* ----------------------------- pieces ----------------------------- */
function Stat({ label, value, accent }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function Section({ title, accent, total, muted, children }) {
  return (
    <section className="grp">
      <div className="grp-head">
        <span className="grp-bar" style={{ background: accent }} />
        <h2>{title}</h2>
        {total !== undefined && <span className="grp-total">{total}</span>}
        {muted && <span className="grp-tag">monthly</span>}
      </div>
      <div className="grp-rows">{children}</div>
    </section>
  );
}

function Row({ item, sym, onLabel, onAmount, onRemove }) {
  return (
    <div className="row">
      <input
        className="label-in"
        value={item.label}
        onChange={(e) => onLabel(e.target.value)}
        aria-label="Item name"
      />
      <div className="amt">
        <span className="amt-sym">{sym}</span>
        <input
          className="amt-in"
          type="number"
          min="0"
          step="any"
          value={item.amount}
          onChange={(e) => onAmount(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label={`${item.label} amount`}
        />
      </div>
      <button className="del" onClick={onRemove} aria-label={`Remove ${item.label}`}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function AddBtn({ onClick, text }) {
  return (
    <button className="add" onClick={onClick}>
      <Plus size={14} /> {text}
    </button>
  );
}

function PieTip({ active, payload, fmt, income }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const pct = income > 0 ? ((d.value / income) * 100).toFixed(0) : 0;
  return (
    <div className="tip">
      <strong>{d.name}</strong>
      <span>{fmt(d.value)} · {pct}% of income</span>
    </div>
  );
}

function SplitBar({ split }) {
  const segs = [
    { w: split.needs, c: COLORS.essentials },
    { w: split.wants, c: COLORS.lifestyle },
    { w: split.savings, c: COLORS.savings },
    { w: split.free, c: COLORS.unallocated },
  ];
  return (
    <div className="splitbar">
      <div className="bar yours">
        {segs.map((s, i) => (
          <div key={i} style={{ width: `${Math.min(100, s.w)}%`, background: s.c }} />
        ))}
      </div>
      <div className="bar target" title="Target: 50% needs · 30% wants · 20% savings">
        <div style={{ width: "50%", background: COLORS.essentials }} />
        <div style={{ width: "30%", background: COLORS.lifestyle }} />
        <div style={{ width: "20%", background: COLORS.savings }} />
      </div>
      <div className="bar-labels">
        <span>Yours</span>
        <span>Target</span>
      </div>
    </div>
  );
}

function Key({ c, t, a, target }) {
  const over = a > target + 2;
  return (
    <div className="key">
      <span className="sw" style={{ background: c }} />
      <span className="k-t">{t}</span>
      <span className={`k-a ${over ? "over" : ""}`}>{a.toFixed(0)}%</span>
      <span className="k-target">/ {target}%</span>
    </div>
  );
}

/* ------------------------------- CSS ------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.bgt-root{
  --bg:#EDF0F3; --surface:#FFFFFF; --surface2:#F7F9FB; --border:#DEE4EB;
  --ink:#101826; --ink2:#3A4757; --muted:#6B7787;
  --emerald:#0E9C6E; --amber:#E2A53A; --coral:#E25B54;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  color:var(--ink); background:var(--bg);
  max-width:1080px; margin:0 auto; padding:26px 22px 40px;
  -webkit-font-smoothing:antialiased;
}
.bgt-root *{box-sizing:border-box;}
.mono,.stat-value,.amt-in,.grp-total,.lg-val,.c-value,.rate-num,.k-a,.k-target{
  font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  font-variant-numeric:tabular-nums; font-feature-settings:"tnum";
}

/* header */
.bgt-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.bgt-head h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.7rem;letter-spacing:-.02em;margin:0;}
.bgt-head .sub{margin:4px 0 0;color:var(--muted);font-size:.9rem;}
.head-controls{display:flex;align-items:center;gap:10px;}
.ctrl{display:flex;flex-direction:column;gap:3px;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
.ctrl select{font-family:inherit;font-size:.9rem;color:var(--ink);background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:7px 10px;cursor:pointer;}
.reset{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);color:var(--ink2);font-size:.82rem;padding:8px 12px;border-radius:9px;cursor:pointer;transition:background .15s,border-color .15s;}
.reset:hover{background:#fff;border-color:#c9d2dc;}

/* instrument readout */
.readout{position:relative;background:var(--ink);border-radius:16px;padding:24px 26px 18px;overflow:hidden;box-shadow:0 14px 30px -16px rgba(16,24,38,.55);}
.scale{position:absolute;top:0;left:0;right:0;height:11px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 1px,transparent 1px 15px);opacity:.5;}
.readout-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:6px;}
.stat{display:flex;flex-direction:column;gap:7px;}
.stat-label{font-size:.7rem;letter-spacing:.13em;text-transform:uppercase;color:#8794a6;}
.stat-value{font-size:1.85rem;font-weight:600;color:#F4F7FB;line-height:1;letter-spacing:-.01em;}
.status{display:inline-flex;align-items:center;gap:9px;margin-top:18px;font-size:.86rem;color:#cdd6e2;}
.status .dot{width:8px;height:8px;border-radius:50%;}
.status-good .dot{background:#5BE3B3;} .status-warn .dot{background:#FFD27A;} .status-bad .dot{background:#FF8A82;}
.status-good{color:#9beccf;} .status-bad{color:#ffb3ad;}

/* body layout */
.body{display:flex;gap:20px;flex-wrap:wrap;margin-top:22px;align-items:flex-start;}
.editor{flex:1 1 430px;min-width:300px;display:flex;flex-direction:column;gap:14px;}
.insights{flex:1 1 300px;min-width:270px;display:flex;flex-direction:column;gap:14px;position:sticky;top:14px;}

/* groups */
.grp{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 16px 14px;}
.grp-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.grp-bar{width:4px;height:18px;border-radius:3px;}
.grp-head h2{font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:600;margin:0;flex:0 0 auto;}
.grp-total{margin-left:auto;font-size:.95rem;font-weight:600;color:var(--ink);}
.grp-tag{margin-left:auto;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);}
.grp-rows{display:flex;flex-direction:column;gap:7px;}

/* rows */
.row{display:flex;align-items:center;gap:8px;}
.label-in{flex:1;min-width:0;border:1px solid transparent;background:var(--surface2);border-radius:8px;padding:9px 11px;font-size:.9rem;font-family:inherit;color:var(--ink);transition:border-color .15s,background .15s;}
.label-in:hover{border-color:var(--border);}
.label-in:focus{outline:none;border-color:var(--emerald);background:#fff;}
.amt{display:flex;align-items:center;background:var(--surface2);border:1px solid transparent;border-radius:8px;padding-left:10px;transition:border-color .15s,background .15s;width:118px;flex:0 0 auto;}
.amt:focus-within{border-color:var(--emerald);background:#fff;}
.amt-sym{color:var(--muted);font-size:.85rem;}
.amt-in{width:100%;border:none;background:transparent;padding:9px 10px 9px 4px;font-size:.92rem;text-align:right;color:var(--ink);}
.amt-in:focus{outline:none;}
.amt-in::-webkit-outer-spin-button,.amt-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.amt-in[type=number]{-moz-appearance:textfield;}
.del{flex:0 0 auto;display:grid;place-items:center;width:32px;height:34px;border:none;background:transparent;color:#aeb8c4;border-radius:8px;cursor:pointer;transition:color .15s,background .15s;}
.del:hover{color:var(--coral);background:#fbecec;}
.add{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin-top:4px;border:1px dashed var(--border);background:transparent;color:var(--ink2);font-size:.8rem;font-family:inherit;padding:7px 11px;border-radius:8px;cursor:pointer;transition:border-color .15s,color .15s;}
.add:hover{border-color:var(--emerald);color:var(--emerald);}

/* insight cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;}
.card h3{font-family:'Space Grotesk',sans-serif;font-size:.95rem;font-weight:600;margin:0 0 10px;}
.donut-wrap{position:relative;}
.donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;}
.c-label{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);}
.c-value{font-size:1.3rem;font-weight:600;margin-top:2px;}
.legend{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;}
.legend li{display:flex;align-items:center;gap:9px;font-size:.85rem;}
.sw{width:11px;height:11px;border-radius:3px;flex:0 0 auto;}
.lg-name{color:var(--ink2);} .lg-val{margin-left:auto;font-weight:500;}

.rate-head{display:flex;align-items:center;gap:8px;color:var(--ink);}
.rate-head h3{margin:0;}
.rate-num{margin-left:auto;font-size:1.35rem;font-weight:600;color:var(--emerald);}
.rate-note{margin:8px 0 0;font-size:.82rem;color:var(--muted);line-height:1.45;}

/* split bar */
.splitbar{display:flex;flex-direction:column;gap:6px;}
.bar{display:flex;height:16px;border-radius:6px;overflow:hidden;background:var(--surface2);}
.bar.target{opacity:.45;height:12px;}
.bar-labels{display:flex;justify-content:space-between;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:2px;}
.split-key{display:flex;flex-direction:column;gap:6px;margin-top:12px;}
.key{display:flex;align-items:center;gap:9px;font-size:.84rem;}
.k-t{color:var(--ink2);} .k-a{margin-left:auto;font-weight:600;} .k-a.over{color:var(--coral);}
.k-target{color:var(--muted);font-size:.78rem;}

/* tooltip + footer */
.tip{background:var(--ink);color:#fff;border-radius:9px;padding:8px 11px;font-size:.8rem;display:flex;flex-direction:column;gap:3px;box-shadow:0 8px 20px -8px rgba(0,0,0,.5);}
.tip strong{font-family:'Space Grotesk',sans-serif;font-weight:600;}
.tip span{color:#aeb8c4;}
.foot{margin-top:24px;text-align:center;font-size:.78rem;color:var(--muted);}

@media (max-width:760px){
  .bgt-root{padding:20px 14px 32px;}
  .readout-grid{gap:12px;}
  .stat-value{font-size:1.4rem;}
  .insights{position:static;}
  .bgt-head h1{font-size:1.45rem;}
}
@media (prefers-reduced-motion:reduce){
  .bgt-root *{transition:none !important;}
}
`;
