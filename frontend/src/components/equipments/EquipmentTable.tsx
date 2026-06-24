import React from "react";
import { Equipment } from "../../types/equipment";
import styles from "./EquipmentTable.module.css";

interface EquipmentTableProps {
  equipments: Equipment[];
}

export function EquipmentTable({ equipments }: EquipmentTableProps) {
  return (
    <div className={styles.eqTableCard}>
      <div className={styles.eqTableTitle}>장비 현황 목록</div>
      <div className={styles.eqTableWrapper}>
        <table className={styles.eqTable}>
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
                <tr key={eq.eq_id} className={`${styles.eqRow} animate-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td style={{ color: "var(--text-muted, #64748b)", fontWeight: 500 }}>No.{idx + 1}</td>
                  <td className={styles.eqCellName}>{eq.eq_name}</td>
                  <td>{eq.eq_count}</td>
                  <td>{eq.available_eq_count}</td>
                  <td>{eq.check_cycle}일</td>
                  <td>
                    <span className={`${styles.eqBadge} ${styles.badgeGray}`}>{eq.recent_check_date.replace(/-/g, ".")}</span>
                  </td>
                  <td>
                    <span className={`${styles.eqBadge} ${styles.badgeYellow}`}>{eq.check_date.replace(/-/g, ".")}</span>
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
  );
}
