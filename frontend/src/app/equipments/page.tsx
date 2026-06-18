"use client";

import React, { useState, useEffect } from "react";

// ─── Interfaces & Types ─────────────────────────────────────
interface Equipment {
  eq_id: string;
  eq_name: string;
  eq_count: number;
  available_eq_count: number;
  check_cycle: number;
  eq_status: string;
  check_date: string;
  recent_check_date: string;
}

interface UpcomingEquipment {
  eq_name: string;
  check_date: string;
  dday: string;
}

export default function EquipmentsPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [upcomingEquipments, setUpcomingEquipments] = useState<UpcomingEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper for Authorization Headers
  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();

      // 1. Fetch entire equipments
      const eqRes = await fetch("/api/equipments", { headers });
      let eqData: Equipment[] = [];
      if (eqRes.ok) {
        eqData = await eqRes.json();
        setEquipments(eqData);
      }

      // 2. Fetch upcoming check equipments (7 days limit)
      const upRes = await fetch("/api/equipments?upcoming_days=7", { headers });
      if (upRes.ok) {
        const upData: Equipment[] = await upRes.json();
        const mappedUpcoming = upData.map((item) => {
          const today = new Date();
          const target = new Date(item.check_date);
          const diffTime = target.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            eq_name: item.eq_name,
            check_date: item.check_date,
            dday: diffDays >= 0 ? `D-${diffDays}` : "만료"
          };
        });
        setUpcomingEquipments(mappedUpcoming);
      }

    } catch (err) {
      console.error("Failed to fetch equipment dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalEquipmentsCount = equipments.filter(e => e.eq_status === "정상").length;

  const metrics = [
    { title: "전체 장비", value: String(equipments.length), unit: "대" },
    { title: "사용 가능 장비 수", value: String(normalEquipmentsCount), unit: "대" },
    { title: "점검 예정 장비", value: String(upcomingEquipments.length), unit: "건" }
  ];

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

  return (
    <div className="eq-container animate-in">
      <style>{`
        .eq-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Top Dashboard Section ── */
        .eq-top-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .eq-top-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Left Metric Cards */
        .eq-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .eq-metric-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100px;
        }
        .eq-metric-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-main, #334155);
        }
        .eq-metric-value-wrapper {
          align-self: center;
          margin-top: 12px;
        }
        .eq-metric-prefix {
          font-size: 14px;
          color: var(--text-muted, #64748b);
          margin-right: 6px;
        }
        .eq-metric-value {
          font-size: 36px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
        }
        .eq-metric-unit {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-main, #334155);
          margin-left: 4px;
        }

        /* Right Upcoming Alarm Panel */
        .eq-alarm-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 20px 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .eq-alarm-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          margin-bottom: 4px;
          border-bottom: 1px solid var(--border, #f1f5f9);
          padding-bottom: 8px;
        }
        .eq-alarm-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 13px;
        }
        .eq-alarm-meta {
          color: var(--text-muted, #64748b);
        }
        .eq-alarm-value {
          font-weight: 600;
          color: var(--text-main, #1e293b);
        }
        .eq-divider {
          height: 1px;
          background-color: var(--border, #f1f5f9);
          margin: 4px 0;
          border: none;
        }

        /* ── Bottom Table Section ── */
        .eq-table-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .eq-table-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          padding: 20px 24px 12px;
        }
        .eq-table-wrapper {
          overflow-x: auto;
          width: 100%;
        }
        .eq-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .eq-table th {
          background-color: #f8fafc;
          padding: 14px 24px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, #475569);
          border-bottom: 1px solid var(--border, #e2e8f0);
          white-space: nowrap;
        }
        .eq-table td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--text-main, #334155);
          border-bottom: 1px solid var(--border, #f1f5f9);
          vertical-align: middle;
        }
        .eq-row:hover {
          background-color: #f8fafc;
        }
        .eq-cell-name {
          font-weight: 600;
          color: var(--text-main, #0f172a);
        }
        
        /* ── Badge Pill Styles ── */
        .eq-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          border: 1px solid transparent;
        }
        .badge-gray {
          background-color: #f1f3f4;
          color: #5f6368;
          border-color: #dadce0;
        }
        .badge-yellow {
          background-color: #fef7e0;
          color: #b06000;
          border-color: #feebc8;
        }
      `}</style>

      {/* ── Top Dashboard Section ── */}
      <div className="eq-top-grid">
        {/* Metric Cards (Left) */}
        <div className="eq-metrics-grid">
          {metrics.map((metric) => (
            <div key={metric.title} className="eq-metric-card">
              <div className="eq-metric-title">{metric.title}</div>
              <div className="eq-metric-value-wrapper">
                {metric.title === "전체 장비" && <span className="eq-metric-prefix">총</span>}
                <span className="eq-metric-value">{metric.value}</span>
                <span className="eq-metric-unit">{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alarm Board (Right) */}
        <div className="eq-alarm-card">
          <div className="eq-alarm-title">점검일이 다가오는 장비</div>
          {upcomingEquipments.length > 0 ? (
            upcomingEquipments.map((eq, idx) => (
              <div key={idx}>
                <div className="eq-alarm-item">
                  <div>
                    <span className="eq-alarm-meta">장비명: </span>
                    <span className="eq-alarm-value">{eq.eq_name}</span>
                  </div>
                  <div>
                    <span className="eq-alarm-meta">점검날짜: </span>
                    <span className="eq-alarm-value" style={{ color: "#c5221f" }}>
                      {eq.check_date.replace(/-/g, ".")} ({eq.dday})
                    </span>
                  </div>
                </div>
                {idx < upcomingEquipments.length - 1 && <hr className="eq-divider" />}
              </div>
            ))
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", textAlign: "center", padding: "10px 0" }}>
              7일 이내 점검 예정 장비가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Table Section ── */}
      <div className="eq-table-card">
        <div className="eq-table-title">장비 현황 목록</div>
        <div className="eq-table-wrapper">
          <table className="eq-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>장비명</th>
                <th>전체(개)</th>
                <th>사용가능(개)</th>
                <th>장비점검 주기</th>
                <th>장비 점검일</th>
                <th>다음 점검일</th>
              </tr>
            </thead>
            <tbody>
              {equipments.length > 0 ? (
                equipments.map((eq, idx) => (
                  <tr key={eq.eq_id} className="eq-row animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <td style={{ color: "var(--text-muted, #64748b)", fontWeight: 500 }}>No.{idx + 1}</td>
                    <td className="eq-cell-name">{eq.eq_name}</td>
                    <td>{eq.eq_count}</td>
                    <td>{eq.available_eq_count}</td>
                    <td>{eq.check_cycle}일</td>
                    <td>
                      <span className="eq-badge badge-gray">{eq.recent_check_date.replace(/-/g, ".")}</span>
                    </td>
                    <td>
                      <span className="eq-badge badge-yellow">{eq.check_date.replace(/-/g, ".")}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted, #64748b)" }}>
                    등록된 장비가 없습니다.
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