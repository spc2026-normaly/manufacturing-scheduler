import React from "react";
import { CalendarTask } from "../../types/dashboard";
import styles from "./ScheduleDetails.module.css";

interface ScheduleDetailsProps {
  selectedDayTasks: CalendarTask[];
  selectedDayChecks: any[];
  onRefresh: () => void;
}

export function ScheduleDetails({
  selectedDayTasks,
  selectedDayChecks,
  onRefresh,
}: ScheduleDetailsProps) {
  return (
    <div className={styles.detailsCard}>
      <div className={styles.detailsCardHeader}>
        <h2 className={styles.detailsTitle}>세부내용</h2>
        <button className={styles.btnDetailRefresh} onClick={onRefresh}>🔄</button>
      </div>
      <div className={styles.divider}></div>

      <div className={styles.detailsAssignmentsList}>
        {/* 1. 생산 배정 일정 */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🏭</span> 생산 배정 일정 ({selectedDayTasks.length}건)
          </h3>
          {selectedDayTasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selectedDayTasks.map((task, idx) => (
                <div key={`${task.id}-${idx}`} className={`${styles.assignmentItem} animate-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className={styles.assignmentMeta}>
                    <span className={styles.assignmentRoleTag}>{task.facility}</span>
                    <span className={styles.assignmentTaskName}>{task.product} ({task.taskName})</span>
                  </div>
                  <div className={styles.assignmentWorkers}>
                    <span className={styles.workersLabel}>작업자 이름:</span>
                    <div className={styles.workersNamesList}>
                      {task.workers.map((w, wIdx) => (
                        <span key={wIdx} className={styles.workerNamePill}>{w}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noAssignmentsPlaceholder}>
              <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", margin: 0 }}>배정된 생산 공정이 없습니다.</p>
            </div>
          )}
        </div>

        {/* 2. 장비 점검 일정 */}
        <div>
          <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🛠️</span> 장비 점검 일정 ({selectedDayChecks.length}건)
          </h3>
          {selectedDayChecks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selectedDayChecks.map((eq, idx) => (
                <div key={`${eq.eq_id}-${idx}`} className={`${styles.assignmentItem} animate-in`} style={{ animationDelay: `${idx * 0.05}s`, borderLeft: "3px solid #ef4444" }}>
                  <div className={styles.assignmentMeta} style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={styles.assignmentRoleTag} style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}>점검</span>
                      <span className={styles.assignmentTaskName} style={{ fontWeight: 700 }}>{eq.eq_name}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: eq.eq_status === "점검 필요" ? "#ef4444" : "#10b981", fontWeight: "700" }}>
                      {eq.eq_status}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>점검 주기: {eq.check_cycle}일</span>
                    <span>최근 점검일: {eq.recent_check_date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noAssignmentsPlaceholder}>
              <p style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center", margin: 0 }}>예정된 장비 점검 일정이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
