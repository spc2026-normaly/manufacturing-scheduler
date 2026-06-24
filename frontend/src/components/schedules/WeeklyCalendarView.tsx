import React from "react";
import { CalendarCell, ProductionTask } from "../../types/schedule";
import styles from "./WeeklyCalendarView.module.css";

interface WeeklyCalendarViewProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  currentWeekIndexInMonth: number;
  workerSearchFilter: string;
  setWorkerSearchFilter: (filter: string) => void;
  weeklyCalendarDays: CalendarCell[];
  weekTasks: ProductionTask[];
  selectedWorker: string | null;
  setSelectedWorker: (worker: string | null) => void;
  getDayName: (date: Date) => string;
}

export function WeeklyCalendarView({
  selectedDate,
  setSelectedDate,
  currentWeekIndexInMonth,
  workerSearchFilter,
  setWorkerSearchFilter,
  weeklyCalendarDays,
  weekTasks,
  selectedWorker,
  setSelectedWorker,
  getDayName,
}: WeeklyCalendarViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Roster Header and Search */}
      <div className={`${styles.rosterHeaderRow} animate-in`} style={{ animationDelay: "0.02s" }}>
        <span className={styles.ganttTitle}>
          주간 요일별 출근자 ({selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {currentWeekIndexInMonth + 1}주차)
        </span>
        <div className={styles.ganttFilters}>
          <input
            type="text"
            className={styles.ganttSelect}
            style={{ minWidth: "220px" }}
            placeholder="작업자 이름 검색..."
            value={workerSearchFilter}
            onChange={(e) => setWorkerSearchFilter(e.target.value)}
          />
          {workerSearchFilter && (
            <button
              className={styles.schedBtn}
              onClick={() => setWorkerSearchFilter("")}
              style={{ padding: "6px 10px" }}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Top Section: Week Calendar Grid with Worker buttons */}
      <div className={`${styles.monthDaysGrid} animate-in`} style={{ animationDelay: "0.04s" }}>
        {weeklyCalendarDays.map((day, idx) => {
          const isSelected = day.date.toDateString() === selectedDate.toDateString();
          const isCurrentMonth = day.isCurrentMonth;
          const dayOfWeek = getDayName(day.date);
          
          const cellStart = new Date(day.date);
          cellStart.setHours(0, 0, 0, 0);
          const cellEnd = new Date(day.date);
          cellEnd.setHours(23, 59, 59, 999);

          const tasksOfDay = weekTasks.filter((task) => task.startDate <= cellEnd && task.endDate >= cellStart);
          const workersOfDay = Array.from(new Set(tasksOfDay.flatMap((t) => t.workers).filter(Boolean))).sort();
          
          const filteredWorkersOfDay = workerSearchFilter.trim()
            ? workersOfDay.filter(w => w.toLowerCase().includes(workerSearchFilter.trim().toLowerCase()))
            : workersOfDay;

          return (
            <div
              key={idx}
              className={`${styles.monthDayCell} ${isSelected ? styles.selected : ""} ${isCurrentMonth ? "" : styles.otherMonth}`}
              onClick={() => setSelectedDate(day.date)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={styles.monthDayNum}>{day.date.getDate()}</span>
                <span style={{ fontSize: "12px", color: isSelected ? "#2563eb" : "#64748b", fontWeight: "600" }}>{dayOfWeek}요일</span>
              </div>
              
              <div className={styles.rosterWorkersListWrapper}>
                {filteredWorkersOfDay.length > 0 ? (
                  filteredWorkersOfDay.map((workerName, wIdx) => {
                    const isActive = workerName === selectedWorker;
                    return (
                      <button
                        key={wIdx}
                        className={`${styles.rosterWorkerBadgeBtn} ${isActive ? styles.active : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWorker(workerName);
                        }}
                        title={workerName}
                      >
                        {workerName}
                      </button>
                    );
                  })
                ) : (
                  <span style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "16px", alignSelf: "center", width: "100%", textAlign: "center" }}>
                    {workersOfDay.length > 0 ? "검색 결과 없음" : "출근자 없음"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
