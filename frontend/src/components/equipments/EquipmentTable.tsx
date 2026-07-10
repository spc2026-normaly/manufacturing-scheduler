"use client";

import React from "react";
import { Equipment } from "../../types/equipment";
import styles from "./EquipmentTable.module.css";

interface EquipmentTableProps {
  equipments: Equipment[];
  onRefetch?: () => Promise<void>;
  currentFileName?: string | null;
}

export function EquipmentTable({ equipments, onRefetch, currentFileName }: EquipmentTableProps) {
  const getCheckDateBadge = (checkDateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const baseDate = new Date(todayStr);
    const targetDate = new Date(checkDateStr);
    const diffTime = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let badgeClass = styles.badgeGreen;
    let ddayText = "";

    if (diffDays < 0) {
      badgeClass = styles.badgeGray;
      ddayText = "만료";
    } else if (diffDays === 0) {
      badgeClass = styles.badgeRed;
      ddayText = "D-0";
    } else if (diffDays <= 7) {
      badgeClass = styles.badgeRed;
      ddayText = `D-${diffDays}`;
    } else if (diffDays <= 30) {
      badgeClass = styles.badgeYellow;
      ddayText = `D-${diffDays}`;
    } else {
      badgeClass = styles.badgeGreen;
      ddayText = `D-${diffDays}`;
    }

    const formattedDate = checkDateStr.replace(/-/g, ".");
    return (
      <span className={`${styles.eqBadge} ${badgeClass}`}>
        {formattedDate} ({ddayText})
      </span>
    );
  };

  return (
    <div className={styles.eqTableCard}>
      {/* 제목 + 파일명 섹션 */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
        {/* 제목 */}
        <div className={styles.eqTableTitle}>장비 현황 목록</div>
        
        {/* 파일명 표시 */}
        {currentFileName && (
          <span style={{
            fontSize: "13px",
            color: "#64748b",
            marginLeft: "8px",
            whiteSpace: "nowrap"
          }}>
            현재 표시 파일: {currentFileName}
          </span>
        )}
      </div>

      {/* 테이블 */}
      <div className={styles.eqTableWrapper}>
        <table className={styles.eqTable}>
          <thead>
            <tr>
              <th>No.</th>
              <th>장비명</th>
              <th>전체(개)</th>
              <th>사용가능(개)</th>
              <th>내구도</th>
              <th>장비 휴식 시간</th>
              <th>장비점검 주기</th>
              <th>장비 점검일</th>
              <th>다음 점검일</th>
            </tr>
          </thead>
          <tbody>
            {equipments.length > 0 ? (
              equipments.map((eq, idx) => (
                <tr key={eq.eq_id} className={`${styles.eqRow} animate-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td style={{ color: "var(--text-muted, #64748b)", fontWeight: 500 }}>No.{idx + 1}</td>
                  <td className={styles.eqCellName}>{eq.eq_name}</td>
                  <td>{eq.eq_count}</td>
                  <td>{eq.available_eq_count}</td>
                  <td>{eq.durability}회</td>
                  <td>{eq.rest_duration}분</td>
                  <td>{eq.check_cycle}일</td>
                  <td>
                    <span className={`${styles.eqBadge} ${styles.badgeGray}`}>{eq.recent_check_date.replace(/-/g, ".")}</span>
                  </td>
                  <td>
                    {getCheckDateBadge(eq.check_date)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted, #64748b)" }}>
                  등록된 장비가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
