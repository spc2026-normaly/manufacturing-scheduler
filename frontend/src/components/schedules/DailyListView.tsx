import React from "react";
import { ProductionTask } from "../../types/schedule";
import styles from "./DailyListView.module.css";

interface DailyListViewProps {
  selectedDate: Date;
  selectedDayTasks: ProductionTask[];
  getFormattedDate: (date: Date) => string;
  getDayName: (date: Date) => string;
}

export function DailyListView({
  selectedDate,
  selectedDayTasks,
  getFormattedDate,
  getDayName,
}: DailyListViewProps) {
  const uniqueWorkersCount = new Set(selectedDayTasks.flatMap((t) => t.workers).filter(Boolean)).size;
  const uniqueFacilitiesCount = new Set(selectedDayTasks.map(t => t.facility)).size;

  return (
    <div className={styles.dayViewContainer}>
      {/* ── Summary Bar ── */}
      <div className={`${styles.daySummaryBar} animate-in`}>
        <div className={styles.daySummaryLeft}>
          <span className={styles.daySummaryDate}>
            {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)})
          </span>
          <span className={styles.daySummarySub}>{getFormattedDate(selectedDate)} 일간 생산 배정 현황</span>
        </div>
        <div className={styles.daySummaryStats}>
          <div className={styles.dayStatBox}>
            <span className={styles.dayStatValue}>{selectedDayTasks.length}</span>
            <span className={styles.dayStatLabel}>작업 공정 수</span>
          </div>
          <div className={styles.dayStatBox}>
            <span className={styles.dayStatValue}>{uniqueWorkersCount}</span>
            <span className={styles.dayStatLabel}>배정 작업자 수</span>
          </div>
          <div className={styles.dayStatBox}>
            <span className={styles.dayStatValue}>{uniqueFacilitiesCount}</span>
            <span className={styles.dayStatLabel}>가동 공장동 수</span>
          </div>
        </div>
      </div>

      {/* ── Navigation Row ── */}
      <div className={styles.dayNavRow}>
        <span className={styles.dayNavTitle}>
          {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)}) 작업 목록
        </span>
      </div>

      {/* ── Task Grid ── */}
      {selectedDayTasks.length > 0 ? (
        <div className={styles.dayTasksGrid}>
          {selectedDayTasks.map((task, idx) => (
            <div
              key={idx}
              className={`${styles.dayTaskCard} animate-in`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className={styles.dayTaskCardHeader}>
                <span className={styles.dayTaskFacilityBadge}>{task.facility}</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>
                  {task.taskName}
                </span>
              </div>
              <div className={styles.dayTaskProduct}>{task.product}</div>
              <div className={styles.dayTaskDivider} />
              <div className={styles.dayTaskMetaRow}>
                <span className={styles.dayTaskMetaIcon}>⚙️</span>
                <span>{task.equipment}</span>
              </div>
              <div className={styles.dayTaskMetaRow}>
                <span className={styles.dayTaskMetaIcon}>🏭</span>
                <span>{task.facility} · {task.taskName} 공정</span>
              </div>
              <div className={styles.dayTaskWorkersTitle}>👷 배정 작업자</div>
              <div className={styles.dayTaskWorkersList}>
                {task.workers.map((w, wIdx) => (
                  <span key={wIdx} className={styles.dayWorkerDot}>{w}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.panelNoTasks} style={{ padding: "80px 0", textAlign: "center" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>🔋</p>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-muted)" }}>해당 날짜에는 배정된 작업 일정이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
