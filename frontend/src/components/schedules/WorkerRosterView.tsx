import React from "react";
import { ProductionTask } from "../../types/schedule";
import styles from "./WorkerRosterView.module.css";

interface WorkerRosterViewProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedWorker: string | null;
  selectedWorkerRoster: { date: Date; tasks: ProductionTask[] }[] | null;
  getDayName: (date: Date) => string;
}

export function WorkerRosterView({
  selectedDate,
  setSelectedDate,
  selectedWorker,
  selectedWorkerRoster,
  getDayName,
}: WorkerRosterViewProps) {
  if (!selectedWorker) {
    return (
      <div className={`${styles.individualRosterSection} animate-in`} style={{ animationDelay: "0.06s", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
        <p>💡 이번 주에는 일정이 잡힌 작업자가 없습니다.</p>
      </div>
    );
  }

  const getRosterThemeClass = (facility: string) => {
    const fac = facility.replace("공장동", "");
    switch (fac) {
      case "A": return styles.rosterA;
      case "B": return styles.rosterB;
      case "C": return styles.rosterC;
      case "D": return styles.rosterD;
      case "E": return styles.rosterE;
      case "F": return styles.rosterF;
      case "G": return styles.rosterG;
      default: return styles.rosterD;
    }
  };

  const totalTasks = selectedWorkerRoster?.reduce((acc, d) => acc + d.tasks.length, 0) ?? 0;

  return (
    <div className={`${styles.individualRosterSection} animate-in`} style={{ animationDelay: "0.06s" }}>
      <div className={styles.individualRosterTitle}>
        <span className={styles.rosterWorkerAvatar}>
          {selectedWorker.substring(0, 1)}
        </span>
        <strong>{selectedWorker}</strong>님의 주간 상세 일정 (이번 주 총 {totalTasks}건 배정)
      </div>
      
      <div className={styles.individualRosterGrid}>
        {selectedWorkerRoster?.map((dayInfo, idx) => {
          const isSelected = dayInfo.date.toDateString() === selectedDate.toDateString();
          const dateStr = `${dayInfo.date.getMonth() + 1}/${dayInfo.date.getDate()}`;
          const dayOfWeek = getDayName(dayInfo.date);
          const isSat = dayOfWeek === "토";
          const isSun = dayOfWeek === "일";

          return (
            <div 
              key={idx} 
              className={`${styles.individualRosterDay} ${isSelected ? styles.activeDay : ""}`}
              onClick={() => setSelectedDate(dayInfo.date)}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.individualDayHeader}>
                <span className={`${isSat ? styles.sat : isSun ? styles.sun : ""}`} style={{ fontWeight: "700" }}>{dayOfWeek}요일</span>
                <span className={styles.dateLbl}>{dateStr}</span>
              </div>
              
              {dayInfo.tasks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {dayInfo.tasks.map((task, tIdx) => {
                    const themeClass = getRosterThemeClass(task.facility);
                    return (
                      <div key={tIdx} className={`${styles.individualTaskCard} ${themeClass}`}>
                        <span className={styles.individualTaskFactory}>{task.facility}</span>
                        <span className={styles.individualTaskName}>{task.taskName}</span>
                        <span className={styles.individualTaskProduct}>{task.product}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: "14px" }}>
                  -
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
