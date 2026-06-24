import React from "react";
import { TrainingStatus, WorkerSafetyData } from "../../types/safetyTraining";
import styles from "./SafetyTrainingTable.module.css";

interface SafetyTrainingTableProps {
  currentUser: { emp_id: string; emp_name: string; emp_role: string; login_id: string } | null;
  filteredWorkers: WorkerSafetyData[];
}

export function SafetyTrainingTable({ currentUser, filteredWorkers }: SafetyTrainingTableProps) {
  // Helper to render state badge
  const renderBadge = (training: TrainingStatus) => {
    switch (training.state) {
      case "completed":
        return (
          <div className={`${styles.stBadge} ${styles.badgeGreen}`}>
            <span className={styles.badgeTitle}>완료</span>
            <span className={styles.badgeDate}>{training.date}</span>
            <span className={styles.badgeDday}>({training.dday})</span>
          </div>
        );
      case "warning_mid":
        return (
          <div className={`${styles.stBadge} ${styles.badgeYellow}`}>
            <span className={styles.badgeTitle}>7~30일</span>
            <span className={styles.badgeDate}>{training.date}</span>
            <span className={styles.badgeDday}>({training.dday})</span>
          </div>
        );
      case "warning_high":
        return (
          <div className={`${styles.stBadge} ${styles.badgeRed}`}>
            <span className={styles.badgeTitle}>7일 이하</span>
            <span className={styles.badgeDate}>{training.date}</span>
            <span className={styles.badgeDday}>({training.dday})</span>
          </div>
        );
      case "expired":
        return (
          <div className={`${styles.stBadge} ${styles.badgeGray}`}>
            <span className={styles.badgeTitle}>만료</span>
            <span className={styles.badgeDate}>{training.date}</span>
            <span className={`${styles.badgeDday} ${styles.textAlert}`}>({training.dday})</span>
          </div>
        );
      case "none":
      default:
        return (
          <div className={`${styles.stBadge} ${styles.badgeNone}`}>
            <span className={styles.badgeTitle}>미완료</span>
            <span className={styles.badgeDate}>-</span>
          </div>
        );
    }
  };

  return (
    <div className={styles.stCard}>
      <div className={styles.stTableTitle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
      <div className={styles.stTableWrapper}>
        <table className={styles.stTable}>
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
                <tr key={w.login_id} className={`${styles.stRow} animate-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td className={styles.stCellName}>{w.emp_name}</td>
                  <td className={styles.stCellId}>{w.login_id}</td>
                  <td>{renderBadge(w.trainings[0])}</td>
                  <td>{renderBadge(w.trainings[1])}</td>
                  <td>{renderBadge(w.trainings[2])}</td>
                  <td>{renderBadge(w.trainings[3])}</td>
                  <td>{renderBadge(w.trainings[4])}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={styles.stEmptyCell}>
                  검색 결과와 일치하는 직원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
