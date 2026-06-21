"use client";

import React, { useState, useMemo, useEffect } from "react";

// ─── Interfaces & Types ─────────────────────────────────────
interface TrainingStatus {
  state: "completed" | "warning_mid" | "warning_high" | "expired" | "none";
  date?: string;
  dday?: string;
}

interface WorkerSafetyData {
  emp_name: string;
  login_id: string;
  trainings: [TrainingStatus, TrainingStatus, TrainingStatus, TrainingStatus, TrainingStatus];
}

// ─── API Response Interfaces ───────────────────────────────
interface ApiEmployee {
  emp_id: string;
  login_id: string;
  emp_name: string;
  emp_role: string;
  emp_date: string;
}

interface ApiSafetyTraining {
  training_id: string;
  emp_id: string;
  training_name: string;
  training_date: string;
  expired_date: string;
  training_status: string;
}

export default function SafetyTrainingPage() {
  const [workersData, setWorkersData] = useState<WorkerSafetyData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ emp_id: string; emp_name: string; emp_role: string; login_id: string } | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Helper for Authorization Headers
  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  // Helper to calculate D-Day relative to base date 2026.06.15
  const calculateTrainingStatus = (expiredDateStr: string): { state: TrainingStatus["state"]; dday: string } => {
    const baseDate = new Date("2026-06-15");
    const targetDate = new Date(expiredDateStr);
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { state: "expired", dday: "만료" };
    } else if (diffDays <= 7) {
      return { state: "warning_high", dday: `D-${diffDays}` };
    } else if (diffDays <= 30) {
      return { state: "warning_mid", dday: `D-${diffDays}` };
    } else {
      return { state: "completed", dday: `D-${diffDays}` };
    }
  };

  // Fetch data on mount
  const fetchSafetyTrainings = async () => {
    try {
      const headers = getAuthHeaders();

      // Fetch current user details
      const meRes = await fetch("/api/auth/me", { headers });
      if (meRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }
      if (!meRes.ok) throw new Error("Failed to fetch current user");
      const meData = await meRes.json();
      setCurrentUser(meData);

      // Fetch employees based on role
      let employees: ApiEmployee[] = [];
      let trainingUrl = "/api/safety-trainings";

      if (meData.emp_role === "leader") {
        const empRes = await fetch("/api/employees?limit=500", { headers });
        if (empRes.status === 403) {
          setIsForbidden(true);
          setLoading(false);
          return;
        }
        if (!empRes.ok) throw new Error("Failed to fetch employees");
        const empResult = await empRes.json();
        employees = empResult.items;
      } else {
        employees = [{
          emp_id: meData.emp_id,
          login_id: meData.login_id,
          emp_name: meData.emp_name,
          emp_role: meData.emp_role,
          emp_date: ""
        }];
        trainingUrl += `?emp_id=${meData.emp_id}`;
      }

      // Fetch safety training records
      const trainingRes = await fetch(trainingUrl, { headers });
      if (trainingRes.status === 403) {
        setIsForbidden(true);
        setLoading(false);
        return;
      }
      if (!trainingRes.ok) throw new Error("Failed to fetch safety trainings");
      const trainings: ApiSafetyTraining[] = await trainingRes.json();

      // Process and map trainings for each employee
      const mappedWorkers: WorkerSafetyData[] = employees.map((emp) => {
        const empTrainings = trainings.filter((t) => t.emp_id === emp.emp_id);
        const trainingsList: TrainingStatus[] = Array(5).fill(null).map(() => ({ state: "none" }));
        let normalIndex = 1;

        empTrainings.forEach((record) => {
          const name = record.training_name;
          const statusCalc = calculateTrainingStatus(record.expired_date);
          const trainingObj: TrainingStatus = {
            state: statusCalc.state,
            date: record.expired_date.replace(/-/g, "."),
            dday: statusCalc.dday
          };

          if (name === "정기 안전 교육" || name === "안전교육1") {
            trainingsList[0] = trainingObj;
          } else {
            if (normalIndex < 5) {
              trainingsList[normalIndex] = trainingObj;
              normalIndex++;
            }
          }
        });

        return {
          emp_name: emp.emp_name,
          login_id: emp.login_id,
          trainings: trainingsList as WorkerSafetyData["trainings"]
        };
      });

      setWorkersData(mappedWorkers);
    } catch (err) {
      console.error("Failed to map safety trainings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSafetyTrainings();
  }, []);

  // 1. Filter workers based on name search query
  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workersData;
    return workersData.filter((w) =>
      w.emp_name.toLowerCase().includes(q)
    );
  }, [workersData, searchQuery]);

  // 2. Count statistics for complete vs expired
  const stats = useMemo(() => {
    let totalCount = 0;
    let completed = 0;
    let warningMid = 0;
    let warningHigh = 0;
    let expired = 0;

    workersData.forEach((w) => {
      w.trainings.forEach((t) => {
        if (t.state !== "none") {
          totalCount++;
          if (t.state === "completed") completed++;
          else if (t.state === "warning_mid") warningMid++;
          else if (t.state === "warning_high") warningHigh++;
          else if (t.state === "expired") expired++;
        }
      });
    });

    return { totalCount, completed, warningMid, warningHigh, expired };
  }, [workersData]);

  const completedRate = stats.totalCount > 0 ? Math.round((stats.completed / stats.totalCount) * 100) : 0;
  const expiredRate = stats.totalCount > 0 ? Math.round((stats.expired / stats.totalCount) * 100) : 0;
  const warningRate = stats.totalCount > 0 ? (100 - completedRate - expiredRate) : 0;

  // Helper to render state badge
  const renderBadge = (training: TrainingStatus) => {
    switch (training.state) {
      case "completed":
        return (
          <div className="st-badge badge-green">
            <span className="badge-title">완료</span>
            <span className="badge-date">{training.date}</span>
            <span className="badge-dday">({training.dday})</span>
          </div>
        );
      case "warning_mid":
        return (
          <div className="st-badge badge-yellow">
            <span className="badge-title">7~30일</span>
            <span className="badge-date">{training.date}</span>
            <span className="badge-dday">({training.dday})</span>
          </div>
        );
      case "warning_high":
        return (
          <div className="st-badge badge-red">
            <span className="badge-title">7일 이하</span>
            <span className="badge-date">{training.date}</span>
            <span className="badge-dday">({training.dday})</span>
          </div>
        );
      case "expired":
        return (
          <div className="st-badge badge-gray">
            <span className="badge-title">만료</span>
            <span className="badge-date">{training.date}</span>
            <span className="badge-dday text-alert">({training.dday})</span>
          </div>
        );
      case "none":
      default:
        return (
          <div className="st-badge badge-none">
            <span className="badge-title">미완료</span>
            <span className="badge-date">-</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "60vh",
        color: "var(--text-muted, #64748b)"
      }}>
        데이터 로딩 중...
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ padding: "40px", textAlign: "center", borderColor: "#fca5a5", border: "1px solid #fecaca", borderRadius: "12px", backgroundColor: "#fff", maxWidth: "500px", width: "100%" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
          <h2 style={{ color: "#dc2626", fontSize: "20px", fontWeight: "bold" }}>접근 권한이 없습니다</h2>
          <p style={{ color: "#4b5563", marginTop: "8px", fontSize: "14px" }}>
            이 데이터를 조회할 수 있는 권한이 없습니다. (API 403 Forbidden)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="st-container animate-in">
      <style>{`
        .st-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        /* ── Header Meta Bar ── */
        .st-header-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--card-bg, #ffffff);
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border: 1px solid var(--border, #e2e8f0);
        }
        .st-today {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
        }
        
        /* Stats summary bar */
        .st-stats-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-grow: 1;
          justify-content: center;
          max-width: 450px;
          margin: 0 24px;
        }
        .st-stats-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, #64748b);
          white-space: nowrap;
        }
        .st-progress-multi {
          display: flex;
          height: 10px;
          width: 100%;
          background-color: #f1f5f9;
          border-radius: 5px;
          overflow: hidden;
        }
        .st-progress-sec {
          height: 100%;
          transition: width 0.3s ease;
        }
        .st-progress-sec.completed { background-color: #22c55e; }
        .st-progress-sec.warning { background-color: #eab308; }
        .st-progress-sec.expired { background-color: #ef4444; }
        
        .st-stats-text {
          font-size: 12px;
          color: var(--text-muted, #64748b);
          white-space: nowrap;
        }
        
        /* Search Bar */
        .st-search-box {
          position: relative;
          width: 240px;
        }
        .st-search-input {
          width: 100%;
          padding: 8px 36px 8px 16px;
          border: 1px solid var(--border, #cbd5e1);
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          background-color: var(--bg-main, #ffffff);
          color: var(--text-main, #1e293b);
          transition: all 0.2s ease;
        }
        .st-search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
        }
        .st-search-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          pointer-events: none;
          color: var(--text-muted, #94a3b8);
        }

        /* ── Legend Bar ── */
        .st-legend {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          font-size: 12px;
          color: var(--text-muted, #64748b);
          padding-right: 8px;
        }
        .st-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .st-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .st-dot.green { background-color: #22c55e; }
        .st-dot.yellow { background-color: #eab308; }
        .st-dot.red { background-color: #ef4444; }
        .st-dot.gray { background-color: #94a3b8; }
        .st-dot.none { background-color: #cbd5e1; }

        /* ── Table & Content Card ── */
        .st-card {
          background-color: var(--card-bg, #ffffff);
          border-radius: 12px;
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .st-table-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main, #1e293b);
          padding: 20px 24px 12px;
        }
        .st-table-wrapper {
          overflow-x: auto;
          width: 100%;
        }
        .st-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .st-table th {
          background-color: #f8fafc;
          padding: 12px 24px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, #475569);
          border-bottom: 1px solid var(--border, #e2e8f0);
          white-space: nowrap;
        }
        .st-table td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--text-main, #334155);
          border-bottom: 1px solid var(--border, #f1f5f9);
          vertical-align: middle;
        }
        .st-row:hover {
          background-color: #f8fafc;
        }
        .st-cell-name {
          font-weight: 600;
          color: var(--text-main, #0f172a);
        }
        .st-cell-id {
          color: var(--text-muted, #64748b);
          font-family: monospace;
        }

        /* ── Badge Pill Styles ── */
        .st-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          min-width: 110px;
          text-align: center;
          line-height: 1.3;
          border: 1px solid transparent;
        }
        .st-badge .badge-title {
          font-size: 11px;
          font-weight: 700;
        }
        .st-badge .badge-date {
          font-size: 10px;
          font-weight: 400;
          margin-top: 1px;
          opacity: 0.85;
          white-space: nowrap;
        }
        .st-badge .badge-dday {
          font-size: 10px;
          font-weight: 700;
          margin-top: 1px;
        }
        .st-badge .badge-dday.text-alert {
          color: #ef4444;
        }

        /* Badge themes */
        .badge-green {
          background-color: #e6f4ea;
          color: #137333;
          border-color: #ceead6;
        }
        .badge-yellow {
          background-color: #fef7e0;
          color: #b06000;
          border-color: #feebc8;
        }
        .badge-red {
          background-color: #fce8e6;
          color: #c5221f;
          border-color: #fad2cf;
        }
        .badge-gray {
          background-color: #f1f3f4;
          color: #5f6368;
          border-color: #dadce0;
        }
        .badge-none {
          background-color: #fafafa;
          color: #94a3b8;
          border-color: #f1f5f9;
        }
        .badge-none .badge-date {
          opacity: 0.5;
        }

        .st-empty-cell {
          text-align: center;
          padding: 40px !important;
          color: var(--text-muted, #64748b);
          font-size: 14px;
        }
      `}</style>

      {/* ── Header Meta Bar ── */}
      {currentUser?.emp_role !== "member" && (
        <div className="st-header-meta">
          <span className="st-today">오늘 날짜 : 2026.06.15</span>

          {/* Multi-segment progress bar for complete/expired ratio */}
          <div className="st-stats-summary">
            <span className="st-stats-label">만료/완료 통계</span>
            <div className="st-progress-multi" title={`완료: ${completedRate}%, 임박: ${warningRate}%, 만료: ${expiredRate}%`}>
              <div className="st-progress-sec completed" style={{ width: `${completedRate}%` }}></div>
              <div className="st-progress-sec warning" style={{ width: `${warningRate}%` }}></div>
              <div className="st-progress-sec expired" style={{ width: `${expiredRate}%` }}></div>
            </div>
            <span className="st-stats-text">
              완료 {stats.completed}건 / 만료 {stats.expired}건
            </span>
          </div>

          {/* Name Search Box */}
          <div className="st-search-box">
            <input
              type="text"
              className="st-search-input"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="st-search-icon">🔍</span>
          </div>
        </div>
      )}

      {/* ── Legend Bar ── */}
      {currentUser?.emp_role !== "member" && (
        <div className="st-legend">
          <div className="st-legend-item">
            <span className="st-dot green"></span>
            <span>30일 이상</span>
          </div>
          <div className="st-legend-item">
            <span className="st-dot yellow"></span>
            <span>7~30일</span>
          </div>
          <div className="st-legend-item">
            <span className="st-dot red"></span>
            <span>7일 이하</span>
          </div>
          <div className="st-legend-item">
            <span className="st-dot gray"></span>
            <span>만료</span>
          </div>
          <div className="st-legend-item">
            <span className="st-dot none"></span>
            <span>미완료</span>
          </div>
        </div>
      )}

      {/* ── Content Card & Table ── */}
      <div className="st-card">
        <div className="st-table-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            {currentUser?.emp_role === "member"
              ? `${currentUser.emp_name}님의 안전 교육 현황`
              : "직원별 교육 현황 (만료일 표시)"}
          </span>
          {currentUser?.emp_role === "member" && (
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "var(--text-muted, #64748b)" }}>
              오늘 날짜 : 2026.06.15
            </span>
          )}
        </div>
        <div className="st-table-wrapper">
          <table className="st-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>안전교육1</th>
                <th>안전교육2</th>
                <th>안전교육3</th>
                <th>안전교육4</th>
                <th>안전교육5</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length > 0 ? (
                filteredWorkers.map((w, idx) => (
                  <tr key={w.login_id} className="st-row animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <td className="st-cell-name">{w.emp_name}</td>
                    <td className="st-cell-id">{w.login_id}</td>
                    <td>{renderBadge(w.trainings[0])}</td>
                    <td>{renderBadge(w.trainings[1])}</td>
                    <td>{renderBadge(w.trainings[2])}</td>
                    <td>{renderBadge(w.trainings[3])}</td>
                    <td>{renderBadge(w.trainings[4])}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="st-empty-cell">
                    검색 결과와 일치하는 직원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
