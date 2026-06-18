"use client";

import React, { useState } from "react";

// ─── Interfaces & Types ─────────────────────────────────────
interface Equipment {
  id: string;
  name: string;
  total: number;
  available: number;
  period: string;
  inspect_date: string;
  next_date: string;
}

interface Metric {
  title: string;
  value: string;
  unit: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const MOCK_METRICS: Metric[] = [
  { title: "전체 직원", value: "38", unit: "명" },
  { title: "점검 예정 장비", value: "12", unit: "건" },
  { title: "업로드 문서", value: "21", unit: "개" }
];

const MOCK_UPCOMING_EQUIPMENTS = [
  { name: "압축기 #2 (B공장)", date: "2026.06.20 (D-2)" },
  { name: "보일러 #1 (A공장)", date: "2026.06.21 (D-3)" }
];

const MOCK_EQUIPMENTS: Equipment[] = [
  { id: "eq_001", name: "압축기 #2", total: 5, available: 2, period: "30일", inspect_date: "2026.06.12", next_date: "2026.06.12" },
  { id: "eq_002", name: "보일러 #1", total: 3, available: 3, period: "90일", inspect_date: "2026.04.15", next_date: "2026.07.15" },
  { id: "eq_003", name: "믹싱기 #3", total: 4, available: 2, period: "30일", inspect_date: "2026.06.01", next_date: "2026.07.01" },
  { id: "eq_004", name: "성형기 #1", total: 6, available: 5, period: "60일", inspect_date: "2026.05.10", next_date: "2026.07.10" },
  { id: "eq_005", name: "포장기 #2", total: 8, available: 8, period: "30일", inspect_date: "2026.06.14", next_date: "2026.07.14" },
  { id: "eq_006", name: "냉각탑 #3", total: 2, available: 1, period: "180일", inspect_date: "2026.02.20", next_date: "2026.08.20" },
  { id: "eq_007", name: "펌프 #1", total: 10, available: 9, period: "90일", inspect_date: "2026.05.25", next_date: "2026.08.25" },
  { id: "eq_008", name: "컨베이어 #1", total: 12, available: 12, period: "365일", inspect_date: "2026.01.10", next_date: "2027.01.10" }
];

export default function EquipmentsPage() {
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
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 140px;
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
      '}</style>

      {/* ── Top Dashboard Section ── */}
      <div className="eq-top-grid">
        {/* Metric Cards (Left) */}
        <div className="eq-metrics-grid">
          {MOCK_METRICS.map((metric) => (
            <div key={metric.title} className="eq-metric-card">
              <div className="eq-metric-title">{metric.title}</div>
              <div className="eq-metric-value-wrapper">
                {metric.title === "전체 직원" && <span className="eq-metric-prefix">총</span>}
                <span className="eq-metric-value">{metric.value}</span>
                <span className="eq-metric-unit">{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alarm Board (Right) */}
        <div className="eq-alarm-card">
          <div className="eq-alarm-title">점검일이 다가오는 장비</div>
          {MOCK_UPCOMING_EQUIPMENTS.map((eq, idx) => (
            <div key={idx}>
              <div className="eq-alarm-item">
                <div>
                  <span className="eq-alarm-meta">장비명: </span>
                  <span className="eq-alarm-value">{eq.name}</span>
                </div>
                <div>
                  <span className="eq-alarm-meta">점검날짜: </span>
                  <span className="eq-alarm-value" style={{ color: "#c5221f" }}>{eq.date}</span>
                </div>
              </div>
              {idx < MOCK_UPCOMING_EQUIPMENTS.length - 1 && <hr className="eq-divider" />}
            </div>
          ))}
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
              {MOCK_EQUIPMENTS.map((eq, idx) => (
                <tr key={eq.id} className="eq-row animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td style={{ color: "var(--text-muted, #64748b)", fontWeight: 500 }}>No.{idx + 1}</td>
                  <td className="eq-cell-name">{eq.name}</td>
                  <td>{eq.total}</td>
                  <td>{eq.available}</td>
                  <td>{eq.period}</td>
                  <td>
                    <span className="eq-badge badge-gray">{eq.inspect_date}</span>
                  </td>
                  <td>
                    <span className="eq-badge badge-yellow">{eq.next_date}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}