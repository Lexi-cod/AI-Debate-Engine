import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

const API_BASE = (() => {
  const viteBase =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE)
      : "";
  const craBase =
    typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE
      ? String(process.env.REACT_APP_API_BASE)
      : "";
  const base = (viteBase || craBase || "").trim();
  return base.endsWith("/") ? base.slice(0, -1) : base;
})();

// Read the API key from the build-time env var (VITE_API_KEY or REACT_APP_API_KEY).
// In production inject this via your CI/CD pipeline — never commit the real value.
const API_KEY = (() => {
  const viteKey =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY
      ? String(import.meta.env.VITE_API_KEY)
      : '';
  const craKey =
    typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_KEY
      ? String(process.env.REACT_APP_API_KEY)
      : '';
  return (viteKey || craKey || '').trim();
})();

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data ? data.detail : null;
    throw new Error(
      detail || (typeof data === "string" ? data : `Request failed (${res.status})`)
    );
  }
  return data;
}

function toPercent(value) {
  if (typeof value !== "number") return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function formatShortDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #080c10;
    --bg2: #0d1117;
    --bg3: #111820;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --text: #e8edf2;
    --text2: #8b9ab0;
    --text3: #4d5f74;
    --accent: #3b82f6;
    --accent2: #1d4ed8;
    --green: #22c55e;
    --green-dim: rgba(34,197,94,0.12);
    --green-border: rgba(34,197,94,0.25);
    --red: #ef4444;
    --red-dim: rgba(239,68,68,0.12);
    --red-border: rgba(239,68,68,0.25);
    --gold: #f59e0b;
    --purple: #8b5cf6;
    --radius: 10px;
    --radius2: 14px;
  }

  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; min-height: 100vh; }

  .app { display: flex; min-height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: 220px; min-height: 100vh; background: var(--bg2); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 20px 0; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
  }
  .logo { padding: 0 20px 24px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; font-family: 'Syne', sans-serif;
    flex-shrink: 0;
  }
  .logo-text { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: -0.3px; color: var(--text); }
  .logo-sub { font-size: 10px; color: var(--text3); font-weight: 400; letter-spacing: 0.5px; text-transform: uppercase; }

  .nav { padding: 16px 12px; flex: 1; }
  .nav-section { margin-bottom: 24px; }
  .nav-label { font-size: 10px; font-weight: 600; color: var(--text3); letter-spacing: 0.8px; text-transform: uppercase; padding: 0 8px; margin-bottom: 6px; }
  .nav-item {
    display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px; cursor: pointer;
    color: var(--text2); font-size: 13.5px; font-weight: 400; transition: all 0.15s; margin-bottom: 2px; border: 1px solid transparent;
  }
  .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
  .nav-item.active { background: rgba(59,130,246,0.12); color: #60a5fa; border-color: rgba(59,130,246,0.2); }
  .nav-item svg { opacity: 0.8; flex-shrink: 0; }
  .nav-item.active svg { opacity: 1; }

  .new-decision-btn {
    margin: 0 12px 20px; padding: 9px 14px; background: linear-gradient(135deg, #3b82f6, #6366f1);
    border: none; border-radius: 8px; color: white; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; display: flex; align-items: center; gap: 8px; transition: opacity 0.15s;
  }
  .new-decision-btn:hover { opacity: 0.88; }

  .sidebar-footer { padding: 16px 12px; border-top: 1px solid var(--border); }
  .user-pill { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px; cursor: pointer; }
  .avatar { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; }
  .user-name { font-size: 13px; color: var(--text2); }

  /* MAIN */
  .main { margin-left: 220px; flex: 1; min-height: 100vh; }
  .topbar { height: 56px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 28px; gap: 12px; background: var(--bg); position: sticky; top: 0; z-index: 50; }
  .topbar-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; letter-spacing: -0.3px; }
  .topbar-breadcrumb { color: var(--text3); font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .topbar-breadcrumb span { color: var(--text2); }
  .ml-auto { margin-left: auto; }

  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }

  .badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px;
    font-size: 11.5px; font-weight: 500; letter-spacing: 0.2px;
  }
  .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
  .badge-green { background: var(--green-dim); color: #4ade80; border: 1px solid var(--green-border); }
  .badge-red { background: var(--red-dim); color: #f87171; border: 1px solid var(--red-border); }
  .badge-gold { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); }
  .badge-purple { background: rgba(139,92,246,0.12); color: #a78bfa; border: 1px solid rgba(139,92,246,0.25); }
  .badge-gray { background: rgba(255,255,255,0.06); color: var(--text2); border: 1px solid var(--border2); }

  .content { padding: 28px; }

  /* CARDS */
  .card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius2);
    padding: 22px; margin-bottom: 16px;
  }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .card-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: -0.2px; }
  .card-subtitle { font-size: 12px; color: var(--text3); margin-top: 2px; }

  /* DECISION INPUT */
  .decision-textarea {
    width: 100%; background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius);
    padding: 14px 16px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14.5px;
    resize: none; outline: none; transition: border-color 0.2s; min-height: 90px;
  }
  .decision-textarea:focus { border-color: rgba(59,130,246,0.5); box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }
  .decision-textarea::placeholder { color: var(--text3); }

  .context-expand {
    width: 100%; background: transparent; border: 1px dashed var(--border2); border-radius: var(--radius);
    padding: 10px 14px; color: var(--text3); font-family: 'DM Sans', sans-serif; font-size: 13px;
    cursor: pointer; text-align: left; transition: all 0.2s; margin-top: 10px; display: flex; align-items: center; gap: 8px;
  }
  .context-expand:hover { border-color: var(--accent); color: var(--text2); background: rgba(59,130,246,0.04); }

  .form-row { display: flex; gap: 12px; margin-top: 14px; align-items: flex-end; }

  .select-wrap { flex: 1; }
  .select-label { font-size: 12px; color: var(--text3); margin-bottom: 6px; display: block; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase; }
  .select {
    width: 100%; background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius);
    padding: 10px 14px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13.5px; outline: none; cursor: pointer;
    appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%234d5f74' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
  }
  .select:focus { border-color: rgba(59,130,246,0.5); }

  .start-btn {
    padding: 10px 22px; background: linear-gradient(135deg, #3b82f6, #6366f1); border: none; border-radius: var(--radius);
    color: white; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer;
    display: flex; align-items: center; gap: 8px; transition: all 0.2s; white-space: nowrap; height: 42px;
  }
  .start-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,130,246,0.3); }
  .start-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  /* DEBATE PANEL */
  .debate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }

  .agent-panel {
    background: var(--bg2); border-radius: var(--radius2); padding: 20px; border: 1px solid var(--border);
    position: relative; overflow: hidden;
  }
  .agent-panel.for { border-top: 2px solid var(--green); }
  .agent-panel.against { border-top: 2px solid var(--red); }

  .agent-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 60px;
    pointer-events: none;
  }
  .agent-panel.for::before { background: linear-gradient(to bottom, var(--green-dim), transparent); }
  .agent-panel.against::before { background: linear-gradient(to bottom, var(--red-dim), transparent); }

  .agent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .agent-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .agent-dot { width: 8px; height: 8px; border-radius: 50%; }
  .for .agent-dot { background: var(--green); box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
  .against .agent-dot { background: var(--red); box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
  .for .agent-name { color: #4ade80; }
  .against .agent-name { color: #f87171; }

  .round-badge { font-size: 11px; color: var(--text3); background: rgba(255,255,255,0.05); padding: 3px 9px; border-radius: 20px; border: 1px solid var(--border); }

  .agent-body { font-size: 13.5px; line-height: 1.75; color: var(--text2); }

  .evidence-block {
    margin-top: 14px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px 14px; border-left: 2px solid;
  }
  .for .evidence-block { border-left-color: var(--green); }
  .against .evidence-block { border-left-color: var(--red); }
  .evidence-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text3); margin-bottom: 5px; }
  .evidence-text { font-size: 13px; color: var(--text2); }

  .weakness-block { margin-top: 12px; }
  .weakness-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--text3); margin-bottom: 6px; }
  .weakness-item { display: flex; align-items: flex-start; gap: 7px; font-size: 12.5px; color: var(--text3); margin-bottom: 4px; }

  /* LOADING */
  .thinking-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; gap: 14px; }
  .pulse-ring {
    width: 36px; height: 36px; border-radius: 50%; border: 2px solid;
    animation: pulse-ring 1.4s ease-in-out infinite;
  }
  .for .pulse-ring { border-color: var(--green); }
  .against .pulse-ring { border-color: var(--red); }
  @keyframes pulse-ring { 0%,100%{transform:scale(0.9);opacity:0.4} 50%{transform:scale(1.05);opacity:1} }
  .thinking-text { font-size: 12px; color: var(--text3); letter-spacing: 0.3px; }

  /* JUDGE */
  .judge-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius2); padding: 24px; margin-bottom: 16px; }
  .judge-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  .judge-icon { width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg, #f59e0b, #ef4444); display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .judge-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; }
  .judge-sub { font-size: 12px; color: var(--text3); }

  .judge-verdict { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -0.8px; color: var(--text); margin-bottom: 6px; }
  .judge-verdict-sub { font-size: 13px; color: var(--text2); }

  .confidence-row { margin-top: 16px; }
  .conf-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text3); margin-bottom: 7px; }
  .conf-value { font-weight: 600; color: var(--gold); }
  .progress-track { height: 6px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }
  .progress-fill {
    height: 100%; border-radius: 3px; background: linear-gradient(90deg, #f59e0b, #ef4444);
    transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .judge-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }

  .fallacy-item { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .fallacy-item:last-child { border-bottom: none; }
  .fallacy-icon { color: #f87171; margin-top: 2px; flex-shrink: 0; }
  .fallacy-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .fallacy-desc { font-size: 12px; color: var(--text3); }

  .bias-meter { margin-top: 14px; }
  .bias-track { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--green), rgba(255,255,255,0.1) 50%, var(--red)); margin: 8px 0; }
  .bias-pointer { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 2px solid var(--bg); transition: left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .bias-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text3); }

  /* SUMMARY */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .summary-box { background: var(--bg3); border-radius: 9px; padding: 14px 16px; border: 1px solid var(--border); }
  .summary-box-title { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text3); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .summary-list { list-style: none; }
  .summary-list li { font-size: 13px; color: var(--text2); padding: 4px 0; border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: flex-start; }
  .summary-list li:last-child { border-bottom: none; }
  .summary-bullet { margin-top: 6px; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .risks .summary-bullet { background: var(--red); }
  .opps .summary-bullet { background: var(--green); }

  .exec-summary { font-size: 13.5px; color: var(--text2); line-height: 1.8; }
  .action-rec { margin-top: 14px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 9px; padding: 14px 16px; }
  .action-label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #60a5fa; margin-bottom: 5px; }
  .action-text { font-size: 13.5px; color: var(--text); }

  .save-btn {
    width: 100%; padding: 12px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius);
    color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; margin-top: 4px;
  }
  .save-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }

  /* HISTORY */
  .page-header { margin-bottom: 24px; }
  .page-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.6px; }
  .page-desc { font-size: 13px; color: var(--text3); margin-top: 4px; }

  .table-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius2); overflow: hidden; }
  .table-header { display: grid; grid-template-columns: 2.5fr 1.2fr 1.5fr 1fr 1.2fr; padding: 12px 20px; border-bottom: 1px solid var(--border); gap: 12px; }
  .th { font-size: 11px; font-weight: 600; color: var(--text3); letter-spacing: 0.5px; text-transform: uppercase; }
  .table-row { display: grid; grid-template-columns: 2.5fr 1.2fr 1.5fr 1fr 1.2fr; padding: 14px 20px; border-bottom: 1px solid var(--border); gap: 12px; cursor: pointer; transition: background 0.15s; align-items: center; }
  .table-row:last-child { border-bottom: none; }
  .table-row:hover { background: rgba(255,255,255,0.03); }
  .td { font-size: 13px; color: var(--text2); }
  .td-main { font-size: 13.5px; color: var(--text); font-weight: 400; }

  .conf-mini { display: flex; align-items: center; gap: 8px; }
  .conf-mini-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden; max-width: 60px; }
  .conf-mini-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #f59e0b, #ef4444); }

  /* ANALYTICS */
  .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .stat-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 16px; }
  .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius2); padding: 18px 20px; }
  .stat-value { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; letter-spacing: -1px; }
  .stat-label { font-size: 12px; color: var(--text3); margin-top: 3px; }
  .stat-delta { font-size: 11.5px; color: var(--green); margin-top: 4px; }

  .chart-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius2); padding: 22px; }
  .chart-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 14px; margin-bottom: 18px; }

  /* SCROLLBAR */
  ::-webkit-scrollbar { width: 6px; } 
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  /* EMPTY STATE */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 220px; gap: 12px; color: var(--text3); }
  .empty-icon { font-size: 32px; opacity: 0.4; }
  .empty-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 600; color: var(--text2); }
  .empty-desc { font-size: 13px; }

  /* TOOLTIP */
  .custom-tooltip { background: var(--bg3); border: 1px solid var(--border2); border-radius: 8px; padding: 10px 14px; font-size: 12.5px; }
  .tooltip-label { color: var(--text3); margin-bottom: 4px; }
  .tooltip-value { color: var(--text); font-weight: 600; }

  /* ANIMATIONS */
  @keyframes fadeInUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
  .fade-in { animation: fadeInUp 0.4s ease forwards; }
  .shimmer { animation: shimmer 2s ease-in-out infinite; }

  @keyframes typing { 0%,100%{opacity:0} 50%{opacity:1} }
  .typing-dot { display: inline-block; animation: typing 1.2s ease infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }

  .divider { height: 1px; background: var(--border); margin: 16px 0; }
  .flex { display: flex; } .items-center { align-items: center; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; }
  .text-sm { font-size: 12.5px; } .text-xs { font-size: 11.5px; }
  .text-dim { color: var(--text3); } .text-muted { color: var(--text2); }
  .font-syne { font-family: 'Syne', sans-serif; }
  .fw-600 { font-weight: 600; } .fw-700 { font-weight: 700; }
`;

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

const MOCK_DEBATE = {
  question: "Should we expand our product into the European market in Q2 2025?",
  type: "Strategic",
  rounds: [
    {
      for: {
        text: "The European market represents a $2.4T opportunity with 450M+ addressable consumers. Our core product addresses regulatory demands already aligned with GDPR standards, giving us a compliance-first advantage over emerging competitors. Current market saturation in North America at 34% suggests growth ceiling risk within 18 months.",
        evidence: "EU digital services market CAGR: 14.2% (2024–2028). Competitor European presence: 2 of 5 direct competitors absent.",
        weaknesses: []
      },
      against: {
        text: "European expansion requires significant capital allocation—estimated €4.2M for initial market entry, €1.1M annually for regulatory compliance, and minimum 14-month runway before first profitable quarter. Current burn rate leaves insufficient buffer for parallel market operations.",
        evidence: "Average EU market entry cost for SaaS: €3.8–5.5M. Q2 2025 projected runway: 9 months.",
        weaknesses: ["Assumes worst-case entry cost without phased rollout consideration"]
      }
    },
    {
      for: {
        text: "A phased rollout starting with Germany and Netherlands—both top-5 SaaS adoption markets in Europe—reduces initial capital requirements by 62%. Strategic partnerships with Tier-1 EU distributors could accelerate go-to-market within 6 months, well within our runway. Comparable SaaS expansions via this model averaged 9.4 months to break-even.",
        evidence: "DACH region SaaS adoption rate: 41% YoY growth. Distribution partner pipeline: 3 qualified leads identified.",
        weaknesses: []
      },
      against: {
        text: "Partnership dependency introduces execution risk: partner misalignment caused 67% of failed EU expansions in the SaaS sector (2020–2024). Furthermore, localization requirements—not just language but cultural product-market fit—add 4–6 engineering months not currently scoped in Q2 roadmap.",
        evidence: "Forrester EU SaaS Expansion Report 2024. Engineering capacity utilization: currently at 87%.",
        weaknesses: ["Localization scope may be overstated for B2B enterprise product"]
      }
    }
  ]
};

const MOCK_JUDGE = {
  verdict: "Proceed with Conditional Expansion",
  confidence: 74,
  scores: [
    { subject: "Logical Coherence", A: 82, B: 78, fullMark: 100 },
    { subject: "Evidence Strength", A: 75, B: 85, fullMark: 100 },
    { subject: "Relevance", A: 90, B: 72, fullMark: 100 },
    { subject: "Persuasiveness", A: 80, B: 76, fullMark: 100 },
    { subject: "Risk Assessment", A: 65, B: 88, fullMark: 100 },
  ],
  fallacies: [
    { name: "False Dichotomy", agent: "Against", desc: "Presents full expansion vs. no expansion without phased options" },
    { name: "Hasty Generalization", agent: "Against", desc: "Applies sector-wide failure rates without controlling for company profile" }
  ],
  biasScore: 0.62, // 0 = pro, 1 = against, 0.5 = neutral
  summary: "The evidence supports a phased European expansion beginning in Q3 2025 rather than Q2, allowing for engineering capacity reallocation and more thorough partner qualification. The Agent For presented a compelling market opportunity with actionable mitigation for capital concerns. However, the Against agent's technical execution risks—particularly engineering bandwidth and localization scope—are substantiated and should gate the go/no-go decision.",
  risks: ["Engineering capacity constraint limits parallel execution", "Partner dependency in DACH entry plan", "Currency risk (EUR/USD) not addressed"],
  opportunities: ["First-mover advantage in DACH B2B SaaS segment", "GDPR compliance as differentiator vs. US competitors", "EU investor visibility for Series B positioning"],
  action: "Approve phased expansion into DACH region beginning Q3 2025. Condition on: (1) engineering capacity target ≥70% achieved by May 15, (2) at least one qualified distribution partner LOI signed, (3) €3M funding earmarked in Q2 close."
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = {
  Arena: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  Chart: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Settings: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12,1v3m0,16v3M4.22,4.22l2.12,2.12m11.32,11.32l2.12,2.12M1,12h3m16,0h3M4.22,19.78l2.12-2.12M17.66,6.34l2.12-2.12"/></svg>,
  Alert: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>,
  Save: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19,21H5a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h11l5,5V19A2,2,0,0,1,19,21Z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>,
  X: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Chevron: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>,
  Expand: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>,
};

// ─── MARKDOWN RENDERER ───────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  // Split into lines and process
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line = spacer
    if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }

    // Process inline bold (**text**) and numbered points
    const processInline = (str) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} style={{ color: 'var(--text)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    // Numbered list item (e.g. "1. " or "[Round 1]")
    if (/^\[Round \d+\]/.test(line)) {
      const roundMatch = line.match(/^\[Round (\d+)\]/);
      const rest = line.replace(/^\[Round \d+\]\s*/, '');
      elements.push(
        <div key={key++} style={{ marginTop: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text3)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 4 }}>
            Round {roundMatch?.[1]}
          </span>
          {rest && <span style={{ marginLeft: 8 }}>{processInline(rest)}</span>}
        </div>
      );
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
          <span style={{ color: 'var(--text3)', minWidth: 16, flexShrink: 0 }}>{line.match(/^(\d+)\./)[1]}.</span>
          <span>{processInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Default paragraph line
    elements.push(<div key={key++} style={{ paddingBottom: 2 }}>{processInline(line)}</div>);
  }

  return elements;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div className="tooltip-label">{label}</div>
        <div className="tooltip-value">{payload[0].value}{payload[0].name === "avg" ? "%" : ""}</div>
      </div>
    );
  }
  return null;
};

// ─── PAGES ────────────────────────────────────────────────────────────────────

function NewDecisionPage() {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [decisionType, setDecisionType] = useState("Strategic");
  const [debateDepth, setDebateDepth] = useState("2");   // rounds: 1, 2, or 4
  const [files, setFiles] = useState([]);
  const [state, setState] = useState("idle"); // idle | loading | done
  const [agentStates, setAgentStates] = useState({ for: "idle", against: "idle" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleStart = async () => {
    if (!question.trim()) return;
    setError("");
    setResult(null);
    setState("loading");
    setAgentStates({ for: "thinking", against: "thinking" });

    try {
      const fd = new FormData();
      fd.append("question", question.trim());
      fd.append("decision_type", decisionType);
      fd.append("rounds", debateDepth);
      if (context.trim()) fd.append("additional_details", context.trim());
      for (const file of files) fd.append("files", file);

      const data = await apiFetch("/api/decision", { method: "POST", body: fd });
      setResult(data);
      setAgentStates({ for: "done", against: "done" });
      setState("done");
    } catch (e) {
      setError(e?.message || "Failed to run decision pipeline");
      setAgentStates({ for: "idle", against: "idle" });
      setState("idle");
    }
  };

  const radarData = (() => {
    if (!result?.judge?.scores) return null;
    const a = result.judge.scores.agent_a || {};
    const b = result.judge.scores.agent_b || {};
    const subjects = [
      ["Logical Coherence", "logical_coherence"],
      ["Evidence Strength", "evidence_strength"],
      ["Risk Assessment", "risk_assessment"],
      ["Relevance", "relevance"],
    ];
    return subjects.map(([label, key]) => ({
      subject: label,
      A: (a[key] ?? 0) * 10,
      B: (b[key] ?? 0) * 10,
      fullMark: 100,
    }));
  })();

  return (
    <div className="content">
      {/* Decision Input */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">New Decision</div>
            <div className="card-subtitle">Frame your decision clearly for the most accurate debate analysis</div>
          </div>
          <span className="badge badge-blue">AI-Powered</span>
        </div>
        <textarea
          className="decision-textarea"
          placeholder="What decision are you trying to make? Be specific — e.g. 'Should we expand into Europe in Q2 2025?'"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={3}
        />
        {!showContext ? (
          <button className="context-expand" onClick={() => setShowContext(true)}>
            <Icon.Expand /> Add context, data, or constraints (optional)
          </button>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <textarea
              className="decision-textarea"
              style={{ minHeight: 70 }}
              placeholder="Add supporting data, constraints, deadlines, stakeholders, budget ranges..."
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={3}
            />
            <div>
              <div className="select-label">Upload supporting docs (PDF, DOCX, Excel)</div>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                style={{ marginTop: 6, color: "var(--text2)" }}
              />
              {files.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--text3)" }}>
                  {files.map(f => f.name).join(", ")}
                </div>
              )}
            </div>
          </div>
        )}
        {error && (
          <div style={{ marginTop: 10 }}>
            <span className="badge badge-red"><Icon.Alert /> {error}</span>
          </div>
        )}
        <div className="form-row">
          <div className="select-wrap">
            <label className="select-label">Decision Type</label>
            <select className="select" value={decisionType} onChange={e => setDecisionType(e.target.value)}>
              <option>Strategic</option>
              <option>Financial</option>
              <option>Product</option>
              <option>Personal</option>
              <option>Operational</option>
            </select>
          </div>
          <div className="select-wrap">
            <label className="select-label">Debate Depth</label>
            <select className="select" value={debateDepth} onChange={e => setDebateDepth(e.target.value)}>
              <option value="2">Standard (2 rounds)</option>
              <option value="4">Deep (4 rounds)</option>
              <option value="1">Quick (1 round)</option>
            </select>
          </div>
          {state === "done" ? (
            <button className="start-btn" onClick={() => { setState("idle"); setResult(null); setQuestion(""); setError(""); setShowContext(false); setFiles([]); }} style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
              <Icon.Plus /> New Debate
            </button>
          ) : (
            <button className="start-btn" onClick={handleStart} disabled={state !== "idle" || !question.trim()}>
              <Icon.Arena />
              {state === "idle" ? "Start Debate" : "Running…"}
            </button>
          )}
        </div>
      </div>

      {/* Debate Panels */}
      {state !== "idle" && (
        <div className="fade-in">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 14 }}>Live Debate</div>
            <span className={`badge ${state === "done" ? "badge-green" : "badge-gold shimmer"}`}>{state === "done" ? "Complete" : "Running…"}</span>
          </div>

          <div className="debate-grid">
            {/* Agent For */}
            <div className="agent-panel for">
              <div className="agent-header">
                <div className="agent-name"><div className="agent-dot" /><span>Agent Α</span></div>
                <span className="round-badge">Argument For</span>
              </div>
              {(state === "loading" || agentStates.for === "thinking") ? (
                <div className="thinking-state">
                  <div className="pulse-ring" />
                  <div className="thinking-text">Constructing argument<span className="typing-dot">.</span><span className="typing-dot">.</span><span className="typing-dot">.</span></div>
                </div>
              ) : result?.debate?.agent_a ? (
                <div className="fade-in">
                  <div className="agent-body">{renderMarkdown(result.debate.agent_a)}</div>
                </div>
              ) : null}
            </div>

            {/* Agent Against */}
            <div className="agent-panel against">
              <div className="agent-header">
                <div className="agent-name"><div className="agent-dot" /><span>Agent Β</span></div>
                <span className="round-badge">Argument Against</span>
              </div>
              {(state === "loading" || agentStates.against === "thinking") ? (
                <div className="thinking-state">
                  <div className="pulse-ring" />
                  <div className="thinking-text">Analyzing counterpoints<span className="typing-dot">.</span><span className="typing-dot">.</span><span className="typing-dot">.</span></div>
                </div>
              ) : result?.debate?.agent_b ? (
                <div className="fade-in">
                  <div className="agent-body">{renderMarkdown(result.debate.agent_b)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Judge Panel */}
      {(state === "loading" || state === "done") && (
        <div className="judge-card fade-in">
          <div className="judge-header">
            <div className="judge-icon">⚖️</div>
            <div>
              <div className="judge-title">Judge AI — Analysis Complete</div>
              <div className="judge-sub">Final ruling based on logical coherence, evidence, and risk assessment</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              {state === "loading" ? <span className="badge badge-gold shimmer">Deliberating…</span> : <span className="badge badge-green"><Icon.Check /> Verdict Reached</span>}
            </div>
          </div>

          {state === "done" && result?.judge ? (
            <div className="fade-in">
              <div className="judge-grid">
                <div>
                  <div className="judge-verdict">{result.judge.verdict || (result.judge.winner === "A" ? "Proceed" : "Do Not Proceed")}</div>
                  <div className="judge-verdict-sub">{result.judge.reasoning}</div>
                  <div className="confidence-row">
                    <div className="conf-label">
                      <span>Confidence Score</span>
                      <span className="conf-value">{toPercent(result.judge.confidence)}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${toPercent(result.judge.confidence)}%` }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div className="weakness-label" style={{ color: "var(--text3)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>Detected Fallacies</div>
                    {(result?.judge?.fallacies || []).map((f, i) => (
                      <div key={i} className="fallacy-item">
                        <div className="fallacy-icon"><Icon.Alert /></div>
                        <div>
                          <div className="fallacy-name">{f.name} <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>— {f.agent}</span></div>
                          <div className="fallacy-desc">{f.desc}</div>
                        </div>
                      </div>
                    ))}
                    <div className="bias-meter" style={{ marginTop: 16 }}>
                      <div className="weakness-label" style={{ color: "var(--text3)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Argument Bias Indicator</div>
                      <div className="bias-track">
                        <div className="bias-pointer" style={{ left: `${Math.round((result?.judge?.bias_score ?? 0.5) * 100)}%` }} />
                      </div>
                      <div className="bias-labels"><span>Pro</span><span>Neutral</span><span>Against</span></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="weakness-label" style={{ color: "var(--text3)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>Evaluation Radar</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData || []}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text3)", fontSize: 10.5, fontFamily: "DM Sans" }} />
                      <Radar name="Agent A" dataKey="A" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={1.5} />
                      <Radar name="Agent B" dataKey="B" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={1.5} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--text3)" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="thinking-state">
              <div className="pulse-ring" style={{ borderColor: "var(--gold)", width: 40, height: 40 }} />
              <div className="thinking-text" style={{ color: "var(--gold)" }}>Judge deliberating<span className="typing-dot">.</span><span className="typing-dot">.</span><span className="typing-dot">.</span></div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {state === "done" && result?.summary && (
        <div className="card fade-in">
          <div className="card-header">
            <div className="card-title">Decision Summary</div>
            <span className="badge badge-gray">{result?.judge?.verdict || decisionType}</span>
          </div>
          <div className="exec-summary">{result.summary.executive_summary}</div>
          <div className="summary-grid">
            <div className="summary-box risks">
              <div className="summary-box-title" style={{ color: "#f87171" }}>⚠ Key Risks</div>
              <ul className="summary-list">
                {(result.summary.key_risks || []).map((r, i) => (
                  <li key={i}><span className="summary-bullet" />{r}</li>
                ))}
              </ul>
            </div>
            <div className="summary-box opps">
              <div className="summary-box-title" style={{ color: "#4ade80" }}>✦ Opportunities</div>
              <ul className="summary-list">
                {(result.summary.key_opportunities || []).map((o, i) => (
                  <li key={i}><span className="summary-bullet" />{o}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="action-rec">
            <div className="action-label">Suggested Action</div>
            <div className="action-text">{result.summary.final_recommendation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPage({ decisions }) {
  const [selected, setSelected] = useState(null);

  const getDecisionBadge = (d) => {
    if (d === "A") return "badge-green";
    if (d === "B") return "badge-red";
    return "badge-gray";
  };

  return (
    <div className="content">
      <div className="page-header">
        <div className="page-title">Decision History</div>
        <div className="page-desc">All past debates and verdicts. Click any row to review the full debate.</div>
      </div>
      <div className="table-card">
        <div className="table-header">
          <div className="th">Decision Topic</div>
          <div className="th">Date</div>
          <div className="th">Verdict</div>
          <div className="th">Confidence</div>
          <div className="th">Stored</div>
        </div>
        {(decisions || []).map(row => (
          <div key={row.id} className="table-row" onClick={() => setSelected(selected === row.id ? null : row.id)}>
            <div className="td-main">{row.topic}</div>
            <div className="td">{formatShortDate(row.timestamp)}</div>
            <div className="td"><span className={`badge ${getDecisionBadge(row.decision)}`}>Winner {row.decision}</span></div>
            <div className="td">
              <div className="conf-mini">
                <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{toPercent(row.confidence)}%</span>
                <div className="conf-mini-bar"><div className="conf-mini-fill" style={{ width: `${toPercent(row.confidence)}%` }} /></div>
              </div>
            </div>
            <div className="td"><span className="badge badge-gray">Cosmos</span></div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="card fade-in" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{(decisions || []).find(r => r.id === selected)?.topic}</div>
              <div className="card-subtitle">Stored record — {formatShortDate((decisions || []).find(r => r.id === selected)?.timestamp)}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><Icon.X /></button>
          </div>
          <div style={{ color: "var(--text2)", fontSize: 13, padding: "16px 0", borderTop: "1px solid var(--border)" }}>
            {(decisions || []).find(r => r.id === selected)?.summary || "No summary stored."}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS HELPERS ───────────────────────────────────────────────────────

function computeAnalytics(decisions) {
  if (!decisions || decisions.length === 0) {
    return {
      total: 0,
      avgConfidence: 0,
      thisMonth: 0,
      lastMonthAvg: 0,
      outcomeCounts: [],
      confidenceTrend: [],
    };
  }

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Count decisions made this calendar month
  const thisMonth = decisions.filter(d => {
    const ts = new Date(d.timestamp);
    const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
    return key === thisMonthKey;
  }).length;

  // Average confidence across all decisions
  const avgConfidence = decisions.reduce((s, d) => s + toPercent(d.confidence), 0) / decisions.length;

  // Last month average for delta
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDecisions = decisions.filter(d => {
    const ts = new Date(d.timestamp);
    return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}` === lastMonthKey;
  });
  const lastMonthAvg = lastMonthDecisions.length
    ? lastMonthDecisions.reduce((s, d) => s + toPercent(d.confidence), 0) / lastMonthDecisions.length
    : null;

  // Outcome distribution
  const winnerCounts = { A: 0, B: 0, other: 0 };
  decisions.forEach(d => {
    if (d.decision === "A") winnerCounts.A++;
    else if (d.decision === "B") winnerCounts.B++;
    else winnerCounts.other++;
  });
  const outcomeCounts = [
    { name: "Agent A Wins", value: winnerCounts.A, color: "#22c55e" },
    { name: "Agent B Wins", value: winnerCounts.B, color: "#ef4444" },
    ...(winnerCounts.other > 0 ? [{ name: "Other", value: winnerCounts.other, color: "#f59e0b" }] : []),
  ].filter(o => o.value > 0);

  // Confidence trend — last 7 months with at least 1 decision
  const byMonth = {};
  decisions.forEach(d => {
    const ts = new Date(d.timestamp);
    const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
    const label = ts.toLocaleDateString(undefined, { month: "short" });
    if (!byMonth[key]) byMonth[key] = { label, values: [] };
    byMonth[key].values.push(toPercent(d.confidence));
  });
  const confidenceTrend = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([, { label, values }]) => ({
      month: label,
      avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }));

  return { total: decisions.length, avgConfidence, thisMonth, lastMonthAvg, outcomeCounts, confidenceTrend };
}

function AnalyticsPage({ decisions }) {
  const stats = computeAnalytics(decisions);

  const confDelta = stats.lastMonthAvg !== null
    ? (stats.avgConfidence - stats.lastMonthAvg).toFixed(1)
    : null;

  // Y-axis domain — pad 10 pts below min and above max, fallback to 0-100
  const trendValues = stats.confidenceTrend.map(d => d.avg);
  const yMin = trendValues.length ? Math.max(0,   Math.floor(Math.min(...trendValues) / 10) * 10 - 10) : 0;
  const yMax = trendValues.length ? Math.min(100, Math.ceil( Math.max(...trendValues) / 10) * 10 + 10) : 100;

  return (
    <div className="content">
      <div className="page-header">
        <div className="page-title">Analytics</div>
        <div className="page-desc">Live insights derived from your saved decisions.</div>
      </div>

      {stats.total === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No decisions yet</div>
          <div className="empty-desc">Run your first debate to see analytics here.</div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#60a5fa" }}>{stats.total}</div>
              <div className="stat-label">Total Decisions</div>
              <div className="stat-delta">↑ +{stats.thisMonth} this month</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#fbbf24" }}>
                {stats.avgConfidence.toFixed(1)}<span style={{ fontSize: 16, fontWeight: 400 }}>%</span>
              </div>
              <div className="stat-label">Avg. Confidence Score</div>
              {confDelta !== null && (
                <div className="stat-delta" style={{ color: parseFloat(confDelta) >= 0 ? "var(--green)" : "var(--red)" }}>
                  {parseFloat(confDelta) >= 0 ? "↑" : "↓"} {Math.abs(confDelta)} vs last month
                </div>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#a78bfa" }}>
                {stats.outcomeCounts.length > 0
                  ? `${Math.round((stats.outcomeCounts[0].value / stats.total) * 100)}`
                  : "—"}
                <span style={{ fontSize: 16, fontWeight: 400 }}>%</span>
              </div>
              <div className="stat-label">{stats.outcomeCounts[0]?.name ?? "Outcomes"} Rate</div>
              <div className="stat-delta">↔ Based on {stats.total} decisions</div>
            </div>
          </div>

          <div className="analytics-grid">
            {/* Confidence over time */}
            <div className="chart-card">
              <div className="chart-title">Average Confidence Over Time</div>
              {stats.confidenceTrend.length < 2 ? (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <div className="empty-desc">Need decisions across 2+ months for a trend.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats.confidenceTrend} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "var(--text3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[yMin, yMax]} tick={{ fill: "var(--text3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5, fill: "#60a5fa" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Outcome distribution */}
            <div className="chart-card">
              <div className="chart-title">Decision Outcomes Distribution</div>
              {stats.outcomeCounts.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 120 }}>
                  <div className="empty-desc">No outcome data yet.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.outcomeCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {stats.outcomeCounts.map((e, i) => <Cell key={i} fill={e.color} opacity={0.85} />)}
                    </Pie>
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--text2)" }} />
                    <Tooltip formatter={(v) => `${v} decisions`} contentStyle={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent decisions list */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <div className="chart-title">Recent Decisions</div>
            <div style={{ marginTop: 8 }}>
              {decisions.slice(0, 5).map((d, i) => (
                <div key={d.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.topic}</div>
                  <span className={`badge ${d.decision === "A" ? "badge-green" : "badge-red"}`}>
                    Winner {d.decision}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, minWidth: 40, textAlign: "right" }}>
                    {toPercent(d.confidence)}%
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 72, textAlign: "right" }}>
                    {formatShortDate(d.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function SettingsPage() {
  return (
    <div className="content">
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-desc">Configure your Decision Arena workspace.</div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">AI Model Configuration</div></div>
        <div style={{ display: "grid", gap: 14 }}>
          {["Agent Model", "Judge Model"].map(label => (
            <div key={label}>
              <label className="select-label">{label}</label>
              <select className="select"><option>gpt-4o (Recommended)</option><option>gpt-4o-mini</option><option>gpt-4-turbo</option></select>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Debate Preferences</div></div>
        <div style={{ display: "grid", gap: 14 }}>
          {[["Default Depth", ["Standard (2 rounds)", "Deep (4 rounds)", "Quick (1 round)"]], ["Fallacy Detection", ["Enabled", "Disabled"]], ["Bias Analysis", ["Enabled", "Disabled"]]].map(([label, opts]) => (
            <div key={label}>
              <label className="select-label">{label}</label>
              <select className="select">{opts.map(o => <option key={o}>{o}</option>)}</select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("new");
  const [decisions, setDecisions] = useState([]);

  const refreshDecisions = async () => {
    try {
      const list = await apiFetch("/api/decisions");
      setDecisions(Array.isArray(list) ? list : []);
    } catch {
      setDecisions([]);
    }
  };

  useEffect(() => {
    refreshDecisions();
  }, []);

  useEffect(() => {
    if (page === "history") refreshDecisions();
  }, [page]);

  const pages = {
    new: { label: "New Decision", component: <NewDecisionPage /> },
    history: { label: "Decision History", component: <HistoryPage decisions={decisions} /> },
    analytics: { label: "Analytics", component: <AnalyticsPage decisions={decisions} /> },
    settings: { label: "Settings", component: <SettingsPage /> },
  };

  const navItems = [
    { id: "new", label: "New Decision", icon: <Icon.Plus /> },
    { id: "history", label: "Decision History", icon: <Icon.Clock /> },
    { id: "analytics", label: "Analytics", icon: <Icon.Chart /> },
    { id: "settings", label: "Settings", icon: <Icon.Settings /> },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <div>
              <div className="logo-text">Decision Arena</div>
              <div className="logo-sub">Decision Intelligence</div>
            </div>
          </div>

          <div className="nav">
            <div className="nav-section">
              <div className="nav-label">Workspace</div>
              {navItems.map(item => (
                <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                  {item.icon}
                  {item.label}
                </div>
              ))}
              {decisions.length === 0 && (
                <div className="nav-item" style={{ color: "var(--text3)", cursor: "default" }}>
                  No saved decisions yet
                </div>
              )}
            </div>

            <div className="nav-section">
              <div className="nav-label">Recent</div>
              {decisions.slice(0, 3).map(h => (
                <div key={h.id} className="nav-item" onClick={() => setPage("history")} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "7px 10px" }}>
                  <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{h.topic.substring(0, 28)}…</span>
                  <span style={{ fontSize: 10.5, color: "var(--text3)" }}>{formatShortDate(h.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="user-pill">
              <div className="avatar">JS</div>
              <div>
                <div className="user-name">Jordan S.</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>Pro Plan</div>
              </div>
              <div style={{ marginLeft: "auto" }}><div className="status-dot" /></div>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="main">
          <div className="topbar">
            <div className="topbar-breadcrumb">
              <span>Decision Arena</span>
              <Icon.Chevron />
              <span style={{ color: "var(--text)" }}>{pages[page].label}</span>
            </div>
            <div className="ml-auto" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="badge badge-green"><div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", marginRight: 3 }} />All Systems Operational</span>
            </div>
          </div>
          {pages[page].component}
        </div>
      </div>
    </>
  );
}