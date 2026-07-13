import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Bell, ArrowUpDown, Plus, Users, Banknote, Star, Landmark, Wallet,
  List, CalendarClock, ReceiptText, PiggyBank, Search, BarChart3,
  DatabaseBackup, FileText, Settings, ArrowLeft, ChevronRight,
  TrendingUp, Tag, X, Pencil, Trash2, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";

// ================= constants =================
const YELLOW = "#F5C51D";
const BROWN = "#8F7A57";
const BROWN_DARK = "#5E4F38";
const BG = "#E9E7E3";
const FOOT = "#3B3935";

const CURRENCIES = {
  NZD: { label: "NZ Dollar", symbol: "NZ$", decimals: 2 },
  USD: { label: "US Dollar", symbol: "US$", decimals: 2 },
  IRT: { label: "Toman", symbol: "Toman", decimals: 0 },
};

const DEFAULT_DATA = {
  accounts: [
    { id: "a1", name: "My Wallet", currency: "NZD", opening: 0, color: "#1E9FD8", icon: "wallet", fav: true, note: "Account notes" },
    { id: "a2", name: "BNZ", currency: "NZD", opening: 0, color: "#D8331E", icon: "bank", fav: true, note: "" },
    { id: "a3", name: "My Bank (Iran)", currency: "IRT", opening: 0, color: "#2E7D5B", icon: "bank", fav: false, note: "" },
  ],
  transactions: [],
  categories: {
    expense: [
      { name: "Fees", color: "#E23B2E" }, { name: "Car", color: "#8B2EE2" },
      { name: "Food", color: "#D40F5B" }, { name: "Transport", color: "#DD7CE0" },
      { name: "Bills", color: "#F04B23" }, { name: "Insurance", color: "#D9DBF5" },
      { name: "House rent", color: "#B4C7DE" }, { name: "Periodic services", color: "#C6C728" },
      { name: "Family health", color: "#6FA28C" }, { name: "Other", color: "#D14A6A" },
    ],
    income: [
      { name: "Salary", color: "#2E7D5B" }, { name: "Scholarship", color: "#1E9FD8" },
      { name: "Gift", color: "#E2A32E" }, { name: "Transfer in", color: "#8B2EE2" },
      { name: "Other", color: "#D14A6A" },
    ],
  },
};

const STORAGE_KEY = "pocket-ledger-mahak-v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(amount, currency) {
  const c = CURRENCIES[currency] || CURRENCIES.NZD;
  const n = Number(amount) || 0;
  const s = n.toLocaleString("en-US", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  return currency === "IRT" ? `${s} Toman` : `${c.symbol}${s}`;
}
const monthKey = (d) => (d || "").slice(0, 7);
const monthLabel = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-NZ", { month: "long", year: "numeric" }); };
const todayLabel = () => "Today, " + new Date().toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// ================= root =================
export default function PocketLedgerMahak() {
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState("home"); // home | reports | categories | backup | search
  const [homeTab, setHomeTab] = useState("bank"); // fav | bank | tx
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r && r.value) { setData(JSON.parse(r.value)); return; }
      } catch (e) { /* first run */ }
      setData(DEFAULT_DATA);
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); setSaveState("saved"); }
      catch (e) { setSaveState("error"); }
    }, 350);
    return () => clearTimeout(t);
  }, [data]);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ app: "Pocket Ledger", version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pocket-ledger-backup-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    notify("Backup file downloaded");
  };
  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        const d = p.data && p.data.accounts ? p.data : p;
        if (!d.accounts || !d.transactions || !d.categories) throw new Error();
        setData(d); notify("Backup restored");
      } catch (e) { notify("Not a valid backup file"); }
    };
    reader.readAsText(file);
  };

  if (!data) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#777" }}>
      <style>{css}</style>Opening your wallet…
    </div>
  );

  // balances
  const balances = {};
  for (const a of data.accounts) balances[a.id] = Number(a.opening) || 0;
  for (const t of data.transactions) if (balances[t.accountId] !== undefined)
    balances[t.accountId] += t.type === "income" ? Number(t.amount) : -Number(t.amount);
  const ccyTotals = {};
  for (const a of data.accounts) ccyTotals[a.currency] = (ccyTotals[a.currency] || 0) + balances[a.id];

  const openMenuItem = (s) => { setMenuOpen(false); if (s === "addtx") setModal({ type: "tx" }); else setScreen(s); };

  return (
    <div style={sx.app}>
      <style>{css}</style>

      {screen === "home" && (
        <HomeScreen data={data} balances={balances} ccyTotals={ccyTotals} tab={homeTab} setTab={setHomeTab}
          saveState={saveState}
          onAddTx={() => setModal({ type: "tx" })}
          onAddAccount={() => setModal({ type: "account" })}
          onEditAccount={(a) => setModal({ type: "account", edit: a })}
          onToggleFav={(a) => setData({ ...data, accounts: data.accounts.map((x) => x.id === a.id ? { ...x, fav: !x.fav } : x) })}
          onDeleteAccount={(a) => {
            if (data.transactions.some((t) => t.accountId === a.id)) { notify("Delete this account's transactions first"); return; }
            setData({ ...data, accounts: data.accounts.filter((x) => x.id !== a.id) });
          }}
          onEditTx={(t) => setModal({ type: "tx", edit: t })}
          onDeleteTx={(t) => setData({ ...data, transactions: data.transactions.filter((x) => x.id !== t.id) })}
        />
      )}
      {screen === "reports" && <SubScreen title="Reports" onBack={() => setScreen("home")}><ReportsBody data={data} /></SubScreen>}
      {screen === "categories" && (
        <SubScreen title="Categories" onBack={() => setScreen("home")}
          right={<CircleBtn onClick={() => setModal({ type: "category" })}><Plus size={22} /></CircleBtn>}>
          <CategoriesBody data={data} />
        </SubScreen>
      )}
      {screen === "search" && <SubScreen title="Search" onBack={() => setScreen("home")}><SearchBody data={data} /></SubScreen>}
      {screen === "backup" && (
        <SubScreen title="Backup" onBack={() => setScreen("home")}>
          <BackupBody onExport={exportBackup} onImport={() => fileRef.current && fileRef.current.click()}
            counts={{ a: data.accounts.length, t: data.transactions.length }} saveState={saveState} />
        </SubScreen>
      )}

      {/* floating menu button */}
      <button style={sx.menuFab} onClick={() => setMenuOpen(true)} aria-label="Menu">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,8px)", gap: 4, marginBottom: 3 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />)}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700 }}>Menu</span>
      </button>

      {/* menu grid popup */}
      {menuOpen && (
        <div style={sx.overlay} onClick={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <div style={sx.menuBox}>
            <MenuTile color="#F5A81C" label="Categories" onClick={() => openMenuItem("categories")}><List size={30} color="#fff" /></MenuTile>
            <MenuTile color="#EE7F1B" label="Add entry" onClick={() => openMenuItem("addtx")}><CalendarClock size={30} color="#fff" /></MenuTile>
            <MenuTile color="#F06423" label="Transactions" onClick={() => { setMenuOpen(false); setScreen("home"); setHomeTab("tx"); }}><ReceiptText size={30} color="#fff" /></MenuTile>
            <MenuTile color="#4D8FDB" label="Accounts" onClick={() => { setMenuOpen(false); setScreen("home"); setHomeTab("bank"); }}><PiggyBank size={30} color="#fff" /></MenuTile>
            <MenuTile color="#27AE44" label="Search" onClick={() => openMenuItem("search")}><Search size={30} color="#fff" /></MenuTile>
            <MenuTile color="#1BBFC9" label="Reports" onClick={() => openMenuItem("reports")}><BarChart3 size={30} color="#fff" /></MenuTile>
            <MenuTile color="#EE3B33" label="Backup" onClick={() => openMenuItem("backup")}><DatabaseBackup size={30} color="#fff" /></MenuTile>
            <MenuTile color="#2BB673" label="Favorites" onClick={() => { setMenuOpen(false); setScreen("home"); setHomeTab("fav"); }}><Star size={30} color="#fff" /></MenuTile>
            <MenuTile color="#6733D9" label="New account" onClick={() => { setMenuOpen(false); setModal({ type: "account" }); }}><Landmark size={30} color="#fff" /></MenuTile>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ""; }} />

      {modal && modal.type === "tx" && (
        <TxModal data={data} edit={modal.edit} onClose={() => setModal(null)}
          onSave={(tx) => {
            setData({ ...data, transactions: modal.edit ? data.transactions.map((t) => t.id === tx.id ? tx : t) : [...data.transactions, tx] });
            setModal(null); notify(modal.edit ? "Transaction updated" : "Transaction saved");
          }} />
      )}
      {modal && modal.type === "account" && (
        <AccountModal edit={modal.edit} onClose={() => setModal(null)}
          onSave={(acc) => {
            setData({ ...data, accounts: modal.edit ? data.accounts.map((a) => a.id === acc.id ? acc : a) : [...data.accounts, acc] });
            setModal(null); notify(modal.edit ? "Account updated" : "Account added");
          }} />
      )}
      {modal && modal.type === "category" && (
        <CategoryModal onClose={() => setModal(null)}
          onSave={(kind, cat) => {
            setData({ ...data, categories: { ...data.categories, [kind]: [...data.categories[kind], cat] } });
            setModal(null); notify("Category added");
          }} />
      )}

      {toast && <div style={sx.toast}>{toast}</div>}
    </div>
  );
}

// ================= home =================
function HomeScreen({ data, balances, ccyTotals, tab, setTab, saveState, onAddTx, onAddAccount, onEditAccount, onToggleFav, onDeleteAccount, onEditTx, onDeleteTx }) {
  const accounts = tab === "fav" ? data.accounts.filter((a) => a.fav) : data.accounts;
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* yellow header */}
      <header style={sx.header}>
        <div style={sx.logo}>
          <Wallet size={22} strokeWidth={2.6} style={{ marginRight: 7 }} />
          Pocket<span style={{ fontWeight: 400 }}>Ledger</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <CircleBtn title={saveState === "saving" ? "Saving…" : "All data saved"}><Bell size={20} /></CircleBtn>
          <CircleBtn onClick={onAddAccount} title="New account"><ArrowUpDown size={20} /></CircleBtn>
          <CircleBtn onClick={onAddTx} title="New transaction"><Plus size={24} /></CircleBtn>
        </div>
      </header>

      {/* brown tab bar */}
      <nav style={sx.tabBar}>
        <TabBtn active={tab === "tx"} onClick={() => setTab("tx")} icon={<Users size={26} />} label="Transactions" />
        <TabBtn active={tab === "bank"} onClick={() => setTab("bank")} icon={<Banknote size={26} />} label="Cash & Bank" />
        <TabBtn active={tab === "fav"} onClick={() => setTab("fav")} icon={<Star size={26} />} label="Favorites" />
      </nav>

      {/* body */}
      <div style={{ flex: 1 }}>
        {(tab === "bank" || tab === "fav") && (
          <>
            {accounts.map((a) => (
              <div key={a.id} style={sx.listRow}>
                <div style={{ ...sx.circleIcon, background: a.color }}>
                  {a.icon === "wallet" ? <Wallet size={24} color="#fff" /> : <Landmark size={24} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={sx.rowTitle}>{a.name}</div>
                  <div style={sx.rowSub}>{a.note || CURRENCIES[a.currency].label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...sx.rowAmount, color: balances[a.id] < 0 ? "#D8331E" : "#333" }}>{fmt(balances[a.id], a.currency)}</div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 5 }}>
                    <IconBtn onClick={() => onToggleFav(a)}><Star size={16} fill={a.fav ? YELLOW : "none"} color={a.fav ? "#C79A00" : "#999"} /></IconBtn>
                    <IconBtn onClick={() => onEditAccount(a)}><Pencil size={16} color="#888" /></IconBtn>
                    <IconBtn onClick={() => onDeleteAccount(a)}><Trash2 size={16} color="#C24438" /></IconBtn>
                  </div>
                </div>
              </div>
            ))}
            {accounts.length === 0 && <Empty text={tab === "fav" ? "No favorite accounts yet. Tap the star on an account to pin it here." : "No accounts yet. Tap ＋ in the header to add one."} />}
          </>
        )}
        {tab === "tx" && <TxList data={data} onEdit={onEditTx} onDelete={onDeleteTx} />}
      </div>

      {/* dark footer */}
      <footer style={sx.footer}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          Total: {Object.keys(ccyTotals).length ? Object.entries(ccyTotals).map(([c, v]) => fmt(v, c)).join("  ·  ") : fmt(0, "NZD")}
        </div>
        <div style={{ fontSize: 12, color: "#BDBAB4", marginTop: 3 }}>{todayLabel()}</div>
      </footer>
    </div>
  );
}

function TxList({ data, onEdit, onDelete }) {
  const accById = Object.fromEntries(data.accounts.map((a) => [a.id, a]));
  const list = [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = [];
  let cur = null;
  for (const t of list) { if (!cur || cur.date !== t.date) { cur = { date: t.date, items: [] }; groups.push(cur); } cur.items.push(t); }
  if (!groups.length) return <Empty text="No transactions yet. Tap ＋ in the header to record income or an expense." />;
  return (
    <div>
      {groups.map((g) => (
        <div key={g.date}>
          <div style={sx.dateHead}>{new Date(g.date + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</div>
          {g.items.map((t) => {
            const acc = accById[t.accountId];
            return (
              <div key={t.id} style={sx.listRow}>
                <div style={{ ...sx.circleIcon, background: t.type === "income" ? "#2E7D5B" : "#D8331E" }}>
                  {t.type === "income" ? <ArrowDownLeft size={22} color="#fff" /> : <ArrowUpRight size={22} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={sx.rowTitle}>{t.category}</div>
                  <div style={sx.rowSub}>{acc ? acc.name : "—"}{t.note ? ` · ${t.note}` : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...sx.rowAmount, color: t.type === "income" ? "#2E7D5B" : "#D8331E" }}>
                    {t.type === "income" ? "+" : "−"}{fmt(t.amount, acc ? acc.currency : "NZD")}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 5 }}>
                    <IconBtn onClick={() => onEdit(t)}><Pencil size={16} color="#888" /></IconBtn>
                    <IconBtn onClick={() => onDelete(t)}><Trash2 size={16} color="#C24438" /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ================= sub-screens =================
function SubScreen({ title, onBack, right, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ ...sx.header, justifyContent: "space-between" }}>
        <button onClick={onBack} style={sx.backBtn} aria-label="Back"><ArrowLeft size={26} color="#fff" /></button>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 21, color: "#fff" }}>{title}</div>
        <div style={{ width: 44, display: "flex", justifyContent: "flex-end" }}>{right || null}</div>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      <footer style={sx.footer}><div style={{ fontSize: 12, color: "#BDBAB4" }}>{todayLabel()}</div></footer>
    </div>
  );
}

function ReportsBody({ data }) {
  const [view, setView] = useState(null); // null = list, 'incexp' | 'bycat'
  if (!view) return (
    <div>
      <ReportRow color="#2296D3" icon={<TrendingUp size={24} color="#fff" />} label="Income & expense report" onClick={() => setView("incexp")} />
      <ReportRow color="#EE7F1B" icon={<BarChart3 size={24} color="#fff" />} label="Summary by category" onClick={() => setView("bycat")} />
    </div>
  );
  return <ReportDetail data={data} kind={view} onBack={() => setView(null)} />;
}

function ReportRow({ color, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ ...sx.listRow, width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}>
      <div style={{ ...sx.circleIcon, background: color }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: "#333", fontFamily: "Inter, sans-serif" }}>{label}</div>
      <ChevronRight size={20} color="#AAA" />
    </button>
  );
}

function ReportDetail({ data, kind, onBack }) {
  const months = useMemo(() => {
    const s = new Set(data.transactions.map((t) => monthKey(t.date))); s.add(monthKey(todayStr()));
    return [...s].sort().reverse();
  }, [data.transactions]);
  const [month, setMonth] = useState(months[0]);
  const [ccy, setCcy] = useState("NZD");
  const accById = Object.fromEntries(data.accounts.map((a) => [a.id, a]));
  const txs = data.transactions.filter((t) => { const a = accById[t.accountId]; return a && a.currency === ccy && monthKey(t.date) === month; });
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + +t.amount, 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + +t.amount, 0);
  const byCat = {};
  for (const t of txs.filter((t) => t.type === "expense")) byCat[t.category] = (byCat[t.category] || 0) + +t.amount;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;
  const catColor = (name) => { const c = data.categories.expense.find((x) => x.name === name); return c ? c.color : "#999"; };

  return (
    <div style={{ padding: 14 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#2296D3", fontWeight: 700, fontSize: 13.5, cursor: "pointer", marginBottom: 10, padding: 0 }}>‹ All reports</button>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {Object.keys(CURRENCIES).map((c) => (
          <button key={c} onClick={() => setCcy(c)} style={{ ...sx.chip, ...(ccy === c ? sx.chipActive : {}) }}>{CURRENCIES[c].label}</button>
        ))}
      </div>
      <select style={sx.input} value={month} onChange={(e) => setMonth(e.target.value)}>
        {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      <div style={{ display: "flex", gap: 8, margin: "14px 0 18px" }}>
        <StatBox label="Income" value={fmt(income, ccy)} color="#2E7D5B" />
        <StatBox label="Expenses" value={fmt(expense, ccy)} color="#D8331E" />
        <StatBox label="Net" value={fmt(income - expense, ccy)} color={income - expense < 0 ? "#D8331E" : "#333"} />
      </div>
      {kind === "bycat" && (
        <>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 10, fontFamily: "Inter, sans-serif" }}>Spending by category</div>
          {cats.length === 0 && <Empty text={`No ${CURRENCIES[ccy].label} expenses in ${monthLabel(month)} yet.`} />}
          {cats.map(([cat, amt]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: catColor(cat), display: "inline-block" }} />{cat}
                </span>
                <b>{fmt(amt, ccy)}</b>
              </div>
              <div style={{ height: 9, background: "#DDDAD3", borderRadius: 5 }}>
                <div style={{ height: 9, width: `${(amt / maxCat) * 100}%`, background: catColor(cat), borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "10px 10px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 3, color, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>{value}</div>
    </div>
  );
}

function CategoriesBody({ data }) {
  const [kind, setKind] = useState("expense");
  const [q, setQ] = useState("");
  const list = data.categories[kind].filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex" }}>
        <SubTab active={kind === "income"} onClick={() => setKind("income")} label="Income categories" />
        <SubTab active={kind === "expense"} onClick={() => setKind("expense")} label="Expense categories" />
      </div>
      <div style={{ padding: "10px 12px", background: "#F2F0EC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #DDD" }}>
          <Search size={18} color="#999" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" style={{ border: "none", outline: "none", flex: 1, fontSize: 14.5, fontFamily: "Inter, sans-serif", background: "transparent" }} />
        </div>
      </div>
      {list.map((c) => (
        <div key={c.name} style={{ ...sx.listRow, padding: "16px 16px" }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: "#333", fontFamily: "Inter, sans-serif" }}>{c.name}</div>
          <ChevronRight size={18} color="#BBB" />
        </div>
      ))}
      <div style={{ padding: "12px 16px", fontSize: 12.5, color: "#888", fontFamily: "Inter, sans-serif" }}>Count: {list.length}</div>
    </div>
  );
}

function SearchBody({ data }) {
  const [q, setQ] = useState("");
  const accById = Object.fromEntries(data.accounts.map((a) => [a.id, a]));
  const results = q.trim() ? data.transactions.filter((t) => {
    const acc = accById[t.accountId];
    const hay = `${t.category} ${t.note || ""} ${acc ? acc.name : ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
  return (
    <div>
      <div style={{ padding: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 8, padding: "11px 12px", border: "1px solid #DDD" }}>
          <Search size={18} color="#999" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by category, note, or account…" style={{ border: "none", outline: "none", flex: 1, fontSize: 14.5, fontFamily: "Inter, sans-serif", background: "transparent" }} />
        </div>
      </div>
      {q.trim() && results.length === 0 && <Empty text="No transactions match your search." />}
      {results.map((t) => {
        const acc = accById[t.accountId];
        return (
          <div key={t.id} style={sx.listRow}>
            <div style={{ ...sx.circleIcon, background: t.type === "income" ? "#2E7D5B" : "#D8331E" }}>
              {t.type === "income" ? <ArrowDownLeft size={22} color="#fff" /> : <ArrowUpRight size={22} color="#fff" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={sx.rowTitle}>{t.category}</div>
              <div style={sx.rowSub}>{acc ? acc.name : "—"} · {t.date}{t.note ? ` · ${t.note}` : ""}</div>
            </div>
            <div style={{ ...sx.rowAmount, color: t.type === "income" ? "#2E7D5B" : "#D8331E" }}>
              {t.type === "income" ? "+" : "−"}{fmt(t.amount, acc ? acc.currency : "NZD")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BackupBody({ onExport, onImport, counts, saveState }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={sx.card}>
        <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 6, fontFamily: "Inter, sans-serif" }}>Automatic saving</div>
        <p style={sx.p}>Everything is saved automatically as you work — {saveState === "error" ? "saving failed just now, so please download a backup file below." : "your data will be here the next time you open the app."}</p>
        <p style={{ ...sx.p, margin: 0 }}>Currently stored: <b>{counts.a}</b> accounts, <b>{counts.t}</b> transactions.</p>
      </div>
      <div style={sx.card}>
        <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 6, fontFamily: "Inter, sans-serif" }}>Backup file</div>
        <p style={sx.p}>Download all data as one file to keep on your phone or cloud storage, and restore it whenever needed.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={sx.primaryBtn} onClick={onExport}>Download backup</button>
          <button style={{ ...sx.primaryBtn, background: "#fff", color: "#333", border: "1.5px solid #999" }} onClick={onImport}>Restore from file</button>
        </div>
        <p style={{ ...sx.p, marginTop: 12, marginBottom: 0, color: "#999" }}>Restoring replaces everything currently in the app.</p>
      </div>
    </div>
  );
}

// ================= modals =================
function Modal({ title, children, onClose }) {
  return (
    <div style={sx.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={sx.modal}>
        <div style={{ background: YELLOW, margin: "-18px -18px 16px", padding: "14px 18px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Close"><X size={22} color="#fff" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#777", marginBottom: 5, fontFamily: "Inter, sans-serif" }}>{label}</div>
      {children}
    </div>
  );
}

function TxModal({ data, edit, onClose, onSave }) {
  const [type, setType] = useState(edit ? edit.type : "expense");
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [accountId, setAccountId] = useState(edit ? edit.accountId : (data.accounts[0] ? data.accounts[0].id : ""));
  const catNames = data.categories[type].map((c) => c.name);
  const [category, setCategory] = useState(edit ? edit.category : catNames[0] || "Other");
  const [date, setDate] = useState(edit ? edit.date : todayStr());
  const [note, setNote] = useState(edit ? edit.note || "" : "");
  const acc = data.accounts.find((a) => a.id === accountId);
  useEffect(() => {
    const names = data.categories[type].map((c) => c.name);
    if (!names.includes(category)) setCategory(names[0] || "Other");
  }, [type]); // eslint-disable-line
  return (
    <Modal title={edit ? "Edit transaction" : "New transaction"} onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 13 }}>
        <button onClick={() => setType("expense")} style={{ ...sx.typeBtn, ...(type === "expense" ? { background: "#D8331E", color: "#fff", borderColor: "#D8331E" } : {}) }}>Expense</button>
        <button onClick={() => setType("income")} style={{ ...sx.typeBtn, ...(type === "income" ? { background: "#2E7D5B", color: "#fff", borderColor: "#2E7D5B" } : {}) }}>Income</button>
      </div>
      <Field label={`Amount${acc ? ` (${CURRENCIES[acc.currency].label})` : ""}`}>
        <input style={{ ...sx.input, fontSize: 22, fontWeight: 800 }} type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
      </Field>
      <Field label="Account">
        <select style={sx.input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {CURRENCIES[a.currency].label}</option>)}
        </select>
      </Field>
      <Field label="Category">
        <select style={sx.input} value={category} onChange={(e) => setCategory(e.target.value)}>
          {catNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Date"><input style={sx.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Note (optional)"><input style={sx.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. weekly groceries" /></Field>
      <button style={sx.primaryBtn} disabled={!amount || +amount <= 0 || !accountId}
        onClick={() => onSave({ id: edit ? edit.id : uid(), type, amount: +amount, accountId, category, date, note: note.trim() })}>
        {edit ? "Save changes" : "Save"}
      </button>
    </Modal>
  );
}

function AccountModal({ edit, onClose, onSave }) {
  const [name, setName] = useState(edit ? edit.name : "");
  const [currency, setCurrency] = useState(edit ? edit.currency : "NZD");
  const [opening, setOpening] = useState(edit ? String(edit.opening) : "0");
  const [note, setNote] = useState(edit ? edit.note || "" : "");
  const [icon, setIcon] = useState(edit ? edit.icon : "bank");
  const colors = ["#1E9FD8", "#D8331E", "#2E7D5B", "#8B2EE2", "#EE7F1B", "#4A6572"];
  const [color, setColor] = useState(edit ? edit.color : colors[0]);
  return (
    <Modal title={edit ? "Edit account" : "New account"} onClose={onClose}>
      <Field label="Account name"><input style={sx.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ASB savings" /></Field>
      <Field label="Currency">
        <div style={{ display: "flex", gap: 8 }}>
          {Object.keys(CURRENCIES).map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{ ...sx.chip, ...(currency === c ? sx.chipActive : {}) }}>{CURRENCIES[c].label}</button>
          ))}
        </div>
      </Field>
      <Field label="Opening balance"><input style={sx.input} type="number" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
      <Field label="Notes (optional)"><input style={sx.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Account notes" /></Field>
      <Field label="Icon">
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setIcon("bank")} style={{ ...sx.chip, ...(icon === "bank" ? sx.chipActive : {}) }}>Bank</button>
          <button onClick={() => setIcon("wallet")} style={{ ...sx.chip, ...(icon === "wallet" ? sx.chipActive : {}) }}>Wallet</button>
        </div>
      </Field>
      <Field label="Colour">
        <div style={{ display: "flex", gap: 10 }}>
          {colors.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`colour ${c}`}
              style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: color === c ? "3px solid #333" : "3px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </Field>
      <button style={sx.primaryBtn} disabled={!name.trim()}
        onClick={() => onSave({ id: edit ? edit.id : uid(), name: name.trim(), currency, opening: +opening || 0, color, icon, note: note.trim(), fav: edit ? edit.fav : false })}>
        {edit ? "Save changes" : "Add account"}
      </button>
    </Modal>
  );
}

function CategoryModal({ onClose, onSave }) {
  const [kind, setKind] = useState("expense");
  const [name, setName] = useState("");
  const colors = ["#E23B2E", "#8B2EE2", "#D40F5B", "#EE7F1B", "#2E7D5B", "#1E9FD8", "#C6C728", "#6FA28C"];
  const [color, setColor] = useState(colors[0]);
  return (
    <Modal title="New category" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 13 }}>
        <button onClick={() => setKind("expense")} style={{ ...sx.typeBtn, ...(kind === "expense" ? { background: "#D8331E", color: "#fff", borderColor: "#D8331E" } : {}) }}>Expense</button>
        <button onClick={() => setKind("income")} style={{ ...sx.typeBtn, ...(kind === "income" ? { background: "#2E7D5B", color: "#fff", borderColor: "#2E7D5B" } : {}) }}>Income</button>
      </div>
      <Field label="Category name"><input style={sx.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Badminton" autoFocus /></Field>
      <Field label="Colour">
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {colors.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`colour ${c}`}
              style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: color === c ? "3px solid #333" : "3px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </Field>
      <button style={sx.primaryBtn} disabled={!name.trim()} onClick={() => onSave(kind, { name: name.trim(), color })}>Add category</button>
    </Modal>
  );
}

// ================= small parts =================
function CircleBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={sx.circleBtn}>{children}</button>
  );
}
function IconBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}>{children}</button>;
}
function TabBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{ ...sx.tabBtn, background: active ? BROWN_DARK : BROWN, borderBottom: active ? `4px solid ${YELLOW}` : "4px solid transparent" }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{label}</span>
    </button>
  );
}
function SubTab({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "14px 6px", background: active ? BROWN_DARK : BROWN, color: "#fff", border: "none", borderBottom: active ? `4px solid ${YELLOW}` : "4px solid transparent", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>{label}</button>
  );
}
function MenuTile({ color, label, children, onClick }) {
  return (
    <button onClick={onClick} style={sx.menuTile}>
      <div style={{ width: 62, height: 62, borderRadius: 14, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 600, marginTop: 8, fontFamily: "Inter, sans-serif" }}>{label}</span>
    </button>
  );
}
function Empty({ text }) {
  return <div style={{ margin: 16, background: "#fff", border: "1px dashed #CCC", borderRadius: 10, padding: "22px 16px", color: "#888", fontSize: 14, lineHeight: 1.55, textAlign: "center", fontFamily: "Inter, sans-serif" }}>{text}</div>;
}

// ================= styles =================
const css = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #333; outline-offset: 2px; }
`;

const sx = {
  app: { minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif", color: "#333", maxWidth: 560, margin: "0 auto", position: "relative" },
  header: { background: YELLOW, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" },
  logo: { display: "flex", alignItems: "center", color: "#fff", fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: -0.2 },
  circleBtn: { width: 42, height: 42, borderRadius: "50%", border: "none", background: "#fff", color: YELLOW, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  backBtn: { background: "none", border: "none", cursor: "pointer", padding: 6, width: 44 },
  tabBar: { display: "flex" },
  tabBtn: { flex: 1, padding: "12px 4px 8px", color: "#fff", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" },
  listRow: { display: "flex", alignItems: "center", gap: 13, background: "#fff", padding: "14px 16px", borderBottom: `6px solid ${BG}` },
  circleIcon: { width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowTitle: { fontWeight: 700, fontSize: 15.5, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSub: { fontSize: 12.5, color: "#999", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowAmount: { fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" },
  dateHead: { fontSize: 12, fontWeight: 700, color: "#8A8578", textTransform: "uppercase", letterSpacing: 0.6, padding: "14px 16px 6px" },
  footer: { background: FOOT, color: "#fff", padding: "12px 16px 14px", textAlign: "right", position: "sticky", bottom: 0 },
  menuFab: { position: "fixed", bottom: 16, left: "max(16px, calc(50% - 264px))", width: 74, height: 74, borderRadius: "50%", background: FOOT, border: "3px solid #fff", color: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", zIndex: 40 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  menuBox: { background: "#111", borderRadius: 26, padding: "26px 22px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "22px 26px", maxWidth: 380, width: "100%" },
  menuTile: { background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: 0 },
  modal: { background: "#F4F2EE", width: "100%", maxWidth: 460, borderRadius: 16, padding: 18, maxHeight: "88vh", overflowY: "auto" },
  input: { width: "100%", padding: "12px 13px", borderRadius: 10, border: "1.5px solid #CCC", background: "#fff", fontSize: 15, fontFamily: "'Inter', sans-serif", color: "#333" },
  primaryBtn: { width: "100%", padding: "14px", borderRadius: 10, border: "none", background: YELLOW, color: "#fff", fontWeight: 800, fontSize: 15.5, cursor: "pointer", marginTop: 6, fontFamily: "'Inter', sans-serif" },
  typeBtn: { flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #CCC", background: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer", color: "#777", fontFamily: "'Inter', sans-serif" },
  chip: { padding: "9px 14px", borderRadius: 20, border: "1.5px solid #CCC", background: "#fff", fontSize: 13, fontWeight: 700, color: "#777", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  chipActive: { background: YELLOW, color: "#fff", borderColor: YELLOW },
  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  p: { fontSize: 14, lineHeight: 1.55, color: "#555", margin: "0 0 12px", fontFamily: "'Inter', sans-serif" },
  toast: { position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "10px 18px", borderRadius: 24, fontSize: 13.5, fontWeight: 600, zIndex: 100, boxShadow: "0 4px 14px rgba(0,0,0,0.4)", whiteSpace: "nowrap" },
};
