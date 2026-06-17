"use client";

import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────
interface HealthData {
  status: string;
  timestamp: string;
  database: string;
  version: string;
}

interface Order {
  id: string;
  product: string;
  line: string;
  qty: number;
  progress: number;
  status: "running" | "pending" | "done" | "error";
  eta: string;
}

// ─── Mock Data ────────────────────────────────────────────────
const MOCK_ORDERS: Order[] = [
  { id: "WO-2024-001", product: "엔진 블록 A형",   line: "라인 1", qty: 120, progress: 78, status: "running", eta: "18:30" },
  { id: "WO-2024-002", product: "기어박스 조립체",  line: "라인 2", qty: 80,  progress: 45, status: "running", eta: "21:00" },
  { id: "WO-2024-003", product: "브레이크 디스크",  line: "라인 3", qty: 200, progress: 100,status: "done",    eta: "완료" },
  { id: "WO-2024-004", product: "실린더 헤드",     line: "라인 4", qty: 60,  progress: 0,  status: "pending", eta: "내일 09:00" },
  { id: "WO-2024-005", product: "터빈 샤프트",     line: "라인 2", qty: 30,  progress: 12, status: "error",   eta: "점검 중" },
];

const NAV_ITEMS = [
  { icon: "⚡", label: "대시보드",   active: true  },
  { icon: "📋", label: "작업 지시",  active: false },
  { icon: "🏭", label: "생산 라인", active: false },
  { icon: "📦", label: "재고 관리", active: false },
  { icon: "📈", label: "분석·리포트",active: false },
  { icon: "⚙️", label: "설정",       active: false },
];

// ─── Helper ───────────────────────────────────────────────────
function statusBadge(status: Order["status"]) {
  const map = {
    running: { cls: "info",    dot: true,  label: "진행 중" },
    pending: { cls: "warning", dot: false, label: "대기"    },
    done:    { cls: "success", dot: false, label: "완료"    },
    error:   { cls: "error",   dot: true,  label: "오류"    },
  };
  const { cls, dot, label } = map[status];
  return (
    <span className={`badge ${cls}`}>
      {dot && <span className="badge-dot" />}
      {label}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="topbar-time">{time}</span>;
}

function HealthPanel({ health }: { health: HealthData | null }) {
  const rows = [
    { icon: "🖥️",  label: "API 서버",     value: health ? "정상" : "연결 중...", ok: !!health },
    { icon: "🗄️",  label: "PostgreSQL",   value: health?.database === "connected" ? "연결됨" : health ? "오류" : "—", ok: health?.database === "connected" },
    { icon: "🔖",  label: "API 버전",     value: health?.version ?? "—",          ok: true },
  ];
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} className="health-row">
          <span className="health-label">
            <span className="health-icon">{r.icon}</span>
            {r.label}
          </span>
          <span className={`badge ${r.ok ? "success" : "error"}`}>
            {r.value}
          </span>
        </div>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error("not ok");
        setHealth(await res.json());
        setFetchError(false);
      } catch {
        setFetchError(true);
      }
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "오늘 생산량",   value: "1,284",  unit: "EA",  change: "+8.3%",  up: true,  color: "blue"   },
    { label: "가동 라인",    value: "3",      unit: "/ 4",  change: "75% 가동",up: true,  color: "green"  },
    { label: "지연 작업",    value: "2",      unit: "건",   change: "-1 (어제)",up: true,  color: "orange" },
    { label: "불량률",       value: "0.42",   unit: "%",   change: "-0.1%",   up: true,  color: "purple" },
  ];

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🏭</div>
          <div>
            <div className="sidebar-logo-text">ManuSched</div>
            <div className="sidebar-logo-sub">생산 일정 관리</div>
          </div>
        </div>

        <span className="sidebar-section-label">메인 메뉴</span>
        {NAV_ITEMS.map((item) => (
          <a key={item.label} href="#" className={`nav-item ${item.active ? "active" : ""}`}>
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">대시보드 — 실시간 생산 현황</span>
          <LiveClock />
          <div className="topbar-avatar">A</div>
        </header>

        {/* Page content */}
        <main className="page-content">
          {/* Header */}
          <div className="page-header animate-in animate-delay-1">
            <h1 className="page-title">생산 현황 대시보드</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={s.label} className={`card stat-card ${s.color} animate-in animate-delay-${i + 1}`}>
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value ${s.color}`}>
                  {s.value}
                  <span style={{ fontSize: "14px", fontWeight: 500, marginLeft: "4px", color: "var(--text-secondary)" }}>
                    {s.unit}
                  </span>
                </div>
                <div className={`stat-change ${s.up ? "up" : "down"}`}>
                  {s.up ? "▲" : "▼"} {s.change}
                </div>
              </div>
            ))}
          </div>

          {/* Middle row */}
          <div className="content-grid">
            {/* Work orders table */}
            <div className="card animate-in animate-delay-3" style={{ gridColumn: "span 1" }}>
              <div className="card-header">
                <div>
                  <div className="card-title">📋 진행 중인 작업 지시</div>
                  <div className="card-subtitle">오늘 기준 전체 {MOCK_ORDERS.length}건</div>
                </div>
                <span className="badge info">실시간</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업 번호</th>
                    <th>제품</th>
                    <th>진행률</th>
                    <th>상태</th>
                    <th>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ORDERS.map((o) => (
                    <tr key={o.id}>
                      <td style={{ color: "var(--accent-blue)", fontWeight: 500 }}>{o.id}</td>
                      <td>{o.product}</td>
                      <td style={{ minWidth: "100px" }}>
                        <div style={{ marginBottom: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
                          {o.progress}%
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${o.progress}%` }} />
                        </div>
                      </td>
                      <td>{statusBadge(o.status)}</td>
                      <td style={{ fontSize: "12px" }}>{o.eta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Line utilization */}
              <div className="card animate-in animate-delay-4">
                <div className="card-header">
                  <div>
                    <div className="card-title">🏭 라인별 가동률</div>
                    <div className="card-subtitle">현재 교대 기준</div>
                  </div>
                </div>
                {[
                  { line: "라인 1", pct: 92, color: "#4f9cf9" },
                  { line: "라인 2", pct: 67, color: "#a78bfa" },
                  { line: "라인 3", pct: 100,color: "#34d399" },
                  { line: "라인 4", pct: 0,  color: "#f87171" },
                ].map((l) => (
                  <div key={l.line} style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{l.line}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: l.pct === 0 ? "var(--accent-red)" : "var(--text-primary)" }}>
                        {l.pct === 0 ? "점검 중" : `${l.pct}%`}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${l.pct}%`, background: l.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* System health */}
              <div className="card animate-in animate-delay-5">
                <div className="card-header">
                  <div>
                    <div className="card-title">💚 시스템 상태</div>
                    <div className="card-subtitle">10초마다 자동 갱신</div>
                  </div>
                  {fetchError && <span className="badge error">연결 실패</span>}
                </div>
                <HealthPanel health={health} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
