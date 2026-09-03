import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Eye, EyeOff, LogOut, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import * as storage from "./lib/storage.js";

const ASSET_TYPES = ["Stock", "Crypto", "Cash", "Fund", "Other"];
const TYPE_COLORS = {
  Stock: "#3F6E52",
  Crypto: "#B08B4F",
  Cash: "#5C7A99",
  Fund: "#8A5A6B",
  Other: "#8A8368",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatCurrency(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeTotal(holdings) {
  return holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0);
}

function computeCostBasis(holdings) {
  return holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
}

function computeAllocation(holdings) {
  const map = {};
  holdings.forEach((h) => {
    const val = h.quantity * h.currentPrice;
    map[h.type] = (map[h.type] || 0) + val;
  });
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({ type, value }));
}

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.pf-root {
  --paper: #EEF0E8;
  --card: #FBFBF8;
  --ink: #1B2438;
  --ink-soft: #545B6B;
  --rule: #D6D8CB;
  --gain: #3F6E52;
  --loss: #A6432D;
  --brass: #B08B4F;
  font-family: 'IBM Plex Sans', sans-serif;
  color: var(--ink);
  background: var(--paper);
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
}
.pf-root *, .pf-root *:before, .pf-root *:after { box-sizing: border-box; }
.pf-serif { font-family: 'Fraunces', serif; }
.pf-mono { font-family: 'IBM Plex Mono', monospace; }

.pf-auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
}
.pf-auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--card);
  border: 1px solid var(--rule);
  padding: 36px 28px;
}
.pf-brand {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 4px 0;
}
.pf-tagline {
  color: var(--ink-soft);
  font-size: 14px;
  margin: 0 0 28px 0;
  line-height: 1.5;
}
.pf-field { margin-bottom: 16px; }
.pf-label {
  display: block;
  font-size: 12.5px;
  color: var(--ink-soft);
  margin-bottom: 6px;
}
.pf-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  background: #fff;
  font-size: 14.5px;
  font-family: inherit;
  color: var(--ink);
}
.pf-input:focus {
  outline: 2px solid var(--ink);
  outline-offset: -1px;
}
.pf-pwd-wrap { position: relative; }
.pf-pwd-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-soft);
  padding: 4px;
  display: flex;
}
.pf-btn {
  width: 100%;
  padding: 11px 16px;
  background: var(--ink);
  color: var(--paper);
  border: none;
  font-size: 14.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.pf-btn:hover { opacity: 0.92; }
.pf-btn:disabled { opacity: 0.5; cursor: default; }
.pf-switch {
  margin-top: 18px;
  font-size: 13.5px;
  color: var(--ink-soft);
  text-align: center;
}
.pf-link {
  color: var(--ink);
  text-decoration: underline;
  cursor: pointer;
  background: none;
  border: none;
  font: inherit;
  padding: 0;
}
.pf-error {
  background: #F4E4DE;
  border: 1px solid var(--loss);
  color: var(--loss);
  font-size: 13px;
  padding: 8px 10px;
  margin-bottom: 16px;
}
.pf-note {
  font-size: 11.5px;
  color: var(--ink-soft);
  margin-top: 20px;
  line-height: 1.5;
  border-top: 1px solid var(--rule);
  padding-top: 14px;
}

/* Dashboard */
.pf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px;
  border-bottom: 1px solid var(--rule);
  background: var(--card);
}
.pf-user {
  font-size: 13.5px;
  color: var(--ink-soft);
}
.pf-logout {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--rule);
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--ink);
  font-family: inherit;
}
.pf-body {
  padding: 28px;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
}
@media (max-width: 800px) {
  .pf-body { grid-template-columns: 1fr; padding: 18px; }
  .pf-header { padding: 14px 18px; }
}
.pf-panel {
  background: var(--card);
  border: 1px solid var(--rule);
  padding: 20px;
}
.pf-panel + .pf-panel { margin-top: 20px; }
.pf-panel-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px 0;
}
.pf-summary-value {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.1;
  margin: 0;
}
.pf-summary-label {
  font-size: 12px;
  color: var(--ink-soft);
  margin: 0 0 2px 0;
}
.pf-pl {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  margin-top: 8px;
}
.pf-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  background: #fff;
  font-size: 14.5px;
  font-family: inherit;
  color: var(--ink);
}
.pf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.pf-table th {
  text-align: left;
  font-weight: 500;
  color: var(--ink-soft);
  font-size: 11.5px;
  padding: 0 10px 8px 0;
  border-bottom: 1px solid var(--rule);
}
.pf-table td {
  padding: 10px 10px 10px 0;
  border-bottom: 1px solid var(--rule);
  vertical-align: middle;
}
.pf-table tr:last-child td { border-bottom: none; }
.pf-type-chip {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--rule);
  color: var(--ink-soft);
}
.pf-del-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-soft);
  padding: 4px;
  display: flex;
}
.pf-del-btn:hover { color: var(--loss); }
.pf-empty {
  color: var(--ink-soft);
  font-size: 13.5px;
  padding: 20px 0;
  text-align: center;
}
.pf-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.pf-legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.pf-legend-left { display: flex; align-items: center; gap: 8px; }
.pf-swatch { width: 10px; height: 10px; flex-shrink: 0; }
.pf-form-row { display: flex; gap: 10px; }
.pf-form-row .pf-field { flex: 1; }
`;

export default function App() {
  const [screen, setScreen] = useState("auth"); // auth | dashboard
  const [authMode, setAuthMode] = useState("login");
  const [showPwd, setShowPwd] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [history, setHistory] = useState([]);
  const [dataError, setDataError] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "Stock",
    quantity: "",
    avgCost: "",
    currentPrice: "",
  });
  const [formError, setFormError] = useState("");

  const usersKey = "users-directory";

  const loadUsers = useCallback(async () => {
    try {
      const res = await storage.get(usersKey);
      return res && res.value ? JSON.parse(res.value) : {};
    } catch (e) {
      return {};
    }
  }, []);

  const saveHoldingsData = useCallback(async (uname, nextHoldings, nextHistory) => {
    try {
      await storage.set(
        `holdings:${uname}`,
        JSON.stringify({ holdings: nextHoldings, history: nextHistory })
      );
    } catch (e) {
      setDataError("Could not save. Please try again.");
    }
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    const uname = username.trim().toLowerCase();
    if (!uname || !password) {
      setAuthError("Enter a username and password.");
      return;
    }
    if (password.length < 4) {
      setAuthError("Password must be at least 4 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      const users = await loadUsers();
      const hash = await sha256(password + "::" + uname);

      if (authMode === "signup") {
        if (users[uname]) {
          setAuthError("That username is already taken.");
          setAuthBusy(false);
          return;
        }
        users[uname] = { hash, createdAt: todayISO() };
        await storage.set(usersKey, JSON.stringify(users));
        await saveHoldingsData(uname, [], []);
        setCurrentUser(uname);
        setHoldings([]);
        setHistory([]);
        setScreen("dashboard");
      } else {
        const record = users[uname];
        if (!record || record.hash !== hash) {
          setAuthError("Incorrect username or password.");
          setAuthBusy(false);
          return;
        }
        let data = { holdings: [], history: [] };
        try {
          const res = await storage.get(`holdings:${uname}`);
          if (res && res.value) data = JSON.parse(res.value);
        } catch (e) {
          // no holdings yet
        }
        setCurrentUser(uname);
        setHoldings(data.holdings || []);
        setHistory(data.history || []);
        setScreen("dashboard");
      }
      setPassword("");
    } catch (err) {
      setAuthError("Something went wrong. Please try again.");
    }
    setAuthBusy(false);
  }

  function handleLogout() {
    setCurrentUser(null);
    setHoldings([]);
    setHistory([]);
    setUsername("");
    setPassword("");
    setAuthMode("login");
    setScreen("auth");
  }

  const total = useMemo(() => computeTotal(holdings), [holdings]);
  const costBasis = useMemo(() => computeCostBasis(holdings), [holdings]);
  const pl = total - costBasis;
  const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0;
  const allocation = useMemo(() => computeAllocation(holdings), [holdings]);

  async function persist(nextHoldings) {
    const newTotal = computeTotal(nextHoldings);
    const nextHistory = [...history];
    const today = todayISO();
    const idx = nextHistory.findIndex((h) => h.date === today);
    if (idx >= 0) {
      nextHistory[idx] = { date: today, total: newTotal };
    } else {
      nextHistory.push({ date: today, total: newTotal });
    }
    setHoldings(nextHoldings);
    setHistory(nextHistory);
    await saveHoldingsData(currentUser, nextHoldings, nextHistory);
  }

  async function handleAddHolding(e) {
    e.preventDefault();
    setFormError("");
    const qty = parseFloat(form.quantity);
    const avgCost = parseFloat(form.avgCost);
    const currentPrice = parseFloat(form.currentPrice);
    if (!form.name.trim()) {
      setFormError("Enter a name or ticker.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Quantity must be a positive number.");
      return;
    }
    if (!Number.isFinite(avgCost) || avgCost < 0) {
      setFormError("Average cost must be a number.");
      return;
    }
    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      setFormError("Current price must be a number.");
      return;
    }
    const newHolding = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      type: form.type,
      quantity: qty,
      avgCost,
      currentPrice,
    };
    await persist([...holdings, newHolding]);
    setForm({ name: "", type: form.type, quantity: "", avgCost: "", currentPrice: "" });
  }

  async function handleDelete(id) {
    await persist(holdings.filter((h) => h.id !== id));
  }

  const chartHistory = useMemo(
    () =>
      [...history]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((h) => ({ ...h, label: h.date.slice(5) })),
    [history]
  );

  if (screen === "auth") {
    return (
      <div className="pf-root">
        <style>{STYLE}</style>
        <div className="pf-auth-wrap">
          <div className="pf-auth-card">
            <p className="pf-brand pf-serif">Ledgerline</p>
            <p className="pf-tagline">
              A quiet place to track what you actually own — logged by hand, no live feeds, no promises.
            </p>
            {authError && <div className="pf-error">{authError}</div>}
            <form onSubmit={handleAuth}>
              <div className="pf-field">
                <label className="pf-label">Username</label>
                <input
                  className="pf-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="e.g. j.rivera"
                />
              </div>
              <div className="pf-field">
                <label className="pf-label">Password</label>
                <div className="pf-pwd-wrap">
                  <input
                    className="pf-input"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    placeholder="At least 4 characters"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="pf-pwd-toggle"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button className="pf-btn" type="submit" disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
            <div className="pf-switch">
              {authMode === "login" ? (
                <>
                  New here?{" "}
                  <button className="pf-link" onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button className="pf-link" onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                    Log in
                  </button>
                </>
              )}
            </div>
            <p className="pf-note">
              Your account and holdings are saved in this browser only (localStorage), not on a server.
              Clearing your browser data or switching devices means starting over. This is fine for trying
              things out, but don't rely on it for anything you can't afford to lose, and don't reuse a
              real password here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-root">
      <style>{STYLE}</style>
      <div className="pf-header">
        <p className="pf-brand pf-serif" style={{ fontSize: 19, margin: 0 }}>Ledgerline</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="pf-user">{currentUser}</span>
          <button className="pf-logout" onClick={handleLogout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>

      <div className="pf-body">
        <div>
          <div className="pf-panel">
            <p className="pf-panel-title">Add a holding</p>
            {formError && <div className="pf-error">{formError}</div>}
            <form onSubmit={handleAddHolding}>
              <div className="pf-field">
                <label className="pf-label">Name or ticker</label>
                <input
                  className="pf-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. VTI, ETH, Savings"
                />
              </div>
              <div className="pf-field">
                <label className="pf-label">Type</label>
                <select
                  className="pf-select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="pf-field">
                <label className="pf-label">Quantity</label>
                <input
                  className="pf-input pf-mono"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
              <div className="pf-form-row">
                <div className="pf-field">
                  <label className="pf-label">Avg. cost / unit</label>
                  <input
                    className="pf-input pf-mono"
                    value={form.avgCost}
                    onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Current price / unit</label>
                  <input
                    className="pf-input pf-mono"
                    value={form.currentPrice}
                    onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <button className="pf-btn" type="submit" style={{ marginTop: 4 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", width: "100%" }}>
                  <Plus size={15} /> Add holding
                </span>
              </button>
            </form>
          </div>

          <div className="pf-panel">
            <p className="pf-panel-title">Allocation</p>
            {allocation.length === 0 ? (
              <p className="pf-empty">Add a holding to see your mix.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="value"
                      nameKey="type"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {allocation.map((entry) => (
                        <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || "#8A8368"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pf-legend">
                  {allocation.map((a) => (
                    <div className="pf-legend-row" key={a.type}>
                      <div className="pf-legend-left">
                        <span className="pf-swatch" style={{ background: TYPE_COLORS[a.type] || "#8A8368" }} />
                        {a.type}
                      </div>
                      <span className="pf-mono">{formatCurrency(a.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="pf-panel">
            <p className="pf-summary-label">Total portfolio value</p>
            <p className="pf-summary-value pf-mono">{formatCurrency(total)}</p>
            {costBasis > 0 && (
              <div className="pf-pl" style={{ color: pl >= 0 ? "var(--gain)" : "var(--loss)" }}>
                {pl >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                <span className="pf-mono">
                  {pl >= 0 ? "+" : ""}{formatCurrency(pl)} ({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                </span>
                <span style={{ color: "var(--ink-soft)" }}>vs. cost basis</span>
              </div>
            )}
            {dataError && <div className="pf-error" style={{ marginTop: 12 }}>{dataError}</div>}
          </div>

          <div className="pf-panel">
            <p className="pf-panel-title">Value over time</p>
            {chartHistory.length < 2 ? (
              <p className="pf-empty">
                Keep logging updates and a trend line will build up here, one entry per day.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartHistory} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#D6D8CB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#545B6B" }} axisLine={{ stroke: "#D6D8CB" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#545B6B" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
                  />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="total" stroke="#1B2438" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pf-panel">
            <p className="pf-panel-title">Holdings</p>
            {holdings.length === 0 ? (
              <p className="pf-empty">No holdings yet. Add your first one on the left.</p>
            ) : (
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Avg cost</th>
                    <th>Price</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id}>
                      <td>{h.name}</td>
                      <td><span className="pf-type-chip">{h.type}</span></td>
                      <td className="pf-mono">{h.quantity}</td>
                      <td className="pf-mono">{formatCurrency(h.avgCost)}</td>
                      <td className="pf-mono">{formatCurrency(h.currentPrice)}</td>
                      <td className="pf-mono">{formatCurrency(h.quantity * h.currentPrice)}</td>
                      <td>
                        <button className="pf-del-btn" onClick={() => handleDelete(h.id)} aria-label={`Delete ${h.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
