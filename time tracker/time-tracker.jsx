import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const CATEGORIES = [
  { key: "sbs", label: "SBS & Spectroscopy", color: "#1a5276" },
  { key: "laser", label: "Laser & Photonics", color: "#27ae60" },
  { key: "ai", label: "AI", color: "#7f8c8d" },
  { key: "math", label: "Mathematics", color: "#6c3483" },
  { key: "ielts", label: "IELTS", color: "#e91e8b" },
  { key: "crypto", label: "Crypto / Economy", color: "#5b2c8e" },
  { key: "bio", label: "Bio & Chemistry", color: "#a2b814" },
  { key: "electronics", label: "Electronics", color: "#e67e22" },
  { key: "mechanics", label: "Mechanics & Design", color: "#138d75" },
  { key: "general", label: "General", color: "#d4ac0d" },
];

const dateKey = (d) => d.toISOString().split("T")[0];
const today = () => dateKey(new Date());

const STORAGE_KEY = "timetracker-data";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function initHours() {
  return Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
}

// ── tiny slider ──
function Slider({ cat, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{
        width: 12, height: 12, borderRadius: "50%",
        background: cat.color, flexShrink: 0
      }} />
      <span style={{ width: 150, fontSize: 13, color: "var(--text)" }}>{cat.label}</span>
      <input
        type="range" min="0" max="16" step="0.25" value={value}
        onChange={e => onChange(cat.key, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: cat.color }}
      />
      <span style={{
        width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums",
        fontSize: 14, fontWeight: 600, color: "var(--text)"
      }}>{value}h</span>
    </div>
  );
}

// ── custom pie tooltip ──
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      padding: "6px 10px", borderRadius: 6, fontSize: 13, color: "var(--text)"
    }}>
      <b>{d.name}</b>: {d.value}h ({(d.payload.percent * 100).toFixed(1)}%)
    </div>
  );
}

// ── main ──
export default function TimeTracker() {
  const [allData, setAllData] = useState(loadAll);
  const [selectedDate, setSelectedDate] = useState(today());
  const [view, setView] = useState("log"); // log | history | monthly
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));

  const hours = useMemo(() => allData[selectedDate] || initHours(), [allData, selectedDate]);
  const totalHours = useMemo(() => Object.values(hours).reduce((a, b) => a + b, 0), [hours]);

  const setHour = useCallback((key, val) => {
    setAllData(prev => {
      const next = { ...prev, [selectedDate]: { ...(prev[selectedDate] || initHours()), [key]: val } };
      saveAll(next);
      return next;
    });
  }, [selectedDate]);

  // pie data
  const pieData = useMemo(() => {
    const used = CATEGORIES.map(c => ({ name: c.label, value: hours[c.key] || 0, color: c.color }))
      .filter(d => d.value > 0);
    const free = 24 - totalHours;
    if (free > 0) used.push({ name: "Untracked", value: Math.round(free * 100) / 100, color: "#ddd" });
    const t = used.reduce((a, b) => a + b.value, 0);
    return used.map(d => ({ ...d, percent: t ? d.value / t : 0 }));
  }, [hours, totalHours]);

  // history dates
  const savedDates = useMemo(() => Object.keys(allData).sort().reverse(), [allData]);

  // monthly aggregation
  const monthlyData = useMemo(() => {
    const dates = Object.keys(allData).filter(d => d.startsWith(selectedMonth));
    if (!dates.length) return [];
    const totals = initHours();
    dates.forEach(d => {
      CATEGORIES.forEach(c => { totals[c.key] += (allData[d]?.[c.key] || 0); });
    });
    return CATEGORIES.map(c => ({
      name: c.label, hours: Math.round(totals[c.key] * 10) / 10, color: c.color
    })).filter(d => d.hours > 0).sort((a, b) => b.hours - a.hours);
  }, [allData, selectedMonth]);

  const availableMonths = useMemo(() => {
    const set = new Set(Object.keys(allData).map(d => d.slice(0, 7)));
    return [...set].sort().reverse();
  }, [allData]);

  // ── styles ──
  const card = {
    background: "var(--surface)", borderRadius: 12,
    border: "1px solid var(--border)", padding: 20, marginBottom: 16
  };
  const tabBtn = (active) => ({
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--text-secondary)",
    transition: "all .15s"
  });

  return (
    <div style={{
      "--surface": "#ffffff", "--bg": "#f0f2f5", "--text": "#1a1a2e",
      "--text-secondary": "#555", "--border": "#e0e0e0", "--accent": "#1a5276",
      fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh",
      background: "var(--bg)", padding: "24px 16px",
      colorScheme: "light"
    }}>
      <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
        Money &amp; Knowledge Tracker
      </h1>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px" }}>
        Track daily hours across your focus areas
      </p>

      {/* tabs */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {[["log", "Daily Log"], ["history", "History"], ["monthly", "Monthly"]].map(([k, l]) => (
          <button key={k} style={tabBtn(view === k)} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {/* ── DAILY LOG ── */}
      {view === "log" && (
        <>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Date:&nbsp;
                <input type="date" value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{
                    fontSize: 14, padding: "4px 8px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text)"
                  }} />
              </label>
              <span style={{
                fontSize: 14, fontWeight: 600,
                color: totalHours > 24 ? "#c0392b" : "var(--accent)"
              }}>
                {totalHours}h / 24h
              </span>
            </div>
            {CATEGORIES.map(c => (
              <Slider key={c.key} cat={c} value={hours[c.key] || 0} onChange={setHour} />
            ))}
            {totalHours > 24 && (
              <p style={{ color: "#c0392b", fontSize: 12, marginTop: 8 }}>
                Total exceeds 24 hours — adjust your entries.
              </p>
            )}
          </div>

          {totalHours > 0 && (
            <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                {selectedDate}
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={120} innerRadius={55}
                    paddingAngle={2} strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ── HISTORY ── */}
      {view === "history" && (
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 12px" }}>Saved Days</h3>
          {savedDates.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No entries yet. Start logging in the Daily Log tab.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {savedDates.map(d => {
                const dayData = allData[d];
                const dayTotal = Object.values(dayData).reduce((a, b) => a + b, 0);
                const top = CATEGORIES
                  .map(c => ({ label: c.label, val: dayData[c.key] || 0, color: c.color }))
                  .filter(x => x.val > 0).sort((a, b) => b.val - a.val).slice(0, 3);
                return (
                  <div key={d} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 8, background: "var(--bg)",
                    cursor: "pointer", border: "1px solid transparent",
                    transition: "border-color .15s"
                  }}
                    onClick={() => { setSelectedDate(d); setView("log"); }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", width: 100 }}>{d}</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 50 }}>{dayTotal}h</span>
                    <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
                      {top.map(t => (
                        <span key={t.label} style={{
                          fontSize: 11, background: t.color + "22", color: t.color,
                          padding: "2px 8px", borderRadius: 10, fontWeight: 600
                        }}>
                          {t.label} {t.val}h
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY ── */}
      {view === "monthly" && (
        <>
          <div style={{ ...card, paddingBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Month:&nbsp;
                <select value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{
                    fontSize: 14, padding: "4px 8px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text)"
                  }}>
                  {availableMonths.length > 0
                    ? availableMonths.map(m => <option key={m} value={m}>{m}</option>)
                    : <option value={selectedMonth}>{selectedMonth}</option>}
                </select>
              </label>
            </div>
            {monthlyData.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No data for this month.</p>
            ) : (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 12px" }}>
                  Total Hours by Topic — {selectedMonth}
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(260, monthlyData.length * 38)}>
                  <BarChart data={monthlyData} layout="vertical" margin={{ left: 110, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--text)" }} width={105} />
                    <Tooltip
                      formatter={(v) => [`${v}h`, "Total"]}
                      contentStyle={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 6, fontSize: 13
                      }} />
                    <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                      {monthlyData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* monthly pie */}
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "20px 0 8px" }}>
                  Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={monthlyData.map(d => ({...d, value: d.hours}))}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={110} innerRadius={50}
                      paddingAngle={2} strokeWidth={0}>
                      {monthlyData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}h`}
                      contentStyle={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 6, fontSize: 13
                      }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 8 }}>
        Data saved in browser storage. Clear browser data = lose history.
      </p>
    </div>
  );
}
