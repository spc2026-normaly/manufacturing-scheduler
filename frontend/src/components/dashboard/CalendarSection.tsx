import React from "react";
import { CalendarTask, CalendarView } from "../../types/dashboard";
import styles from "./CalendarSection.module.css";
import { toYmd } from "../../hooks/useDashboard";

interface CalendarSectionProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;
  factoryFilter: string;
  setFactoryFilter: (filter: string) => void;
  calendarDays: { date: Date; isCurrentMonth: boolean }[];
  calendarTasks: CalendarTask[];
  equipments: any[];
  getDateRangeTitle: () => string;
}

export function CalendarSection({
  selectedDate,
  setSelectedDate,
  calendarView,
  setCalendarView,
  factoryFilter,
  setFactoryFilter,
  calendarDays,
  calendarTasks,
  equipments,
  getDateRangeTitle,
}: CalendarSectionProps) {
  const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className={`${styles.calendarCard}`}>
      <div className={styles.calendarCardHeader}>
        <div className={styles.calendarNav}>
          <span className={styles.calendarCurrentMonth}>{getDateRangeTitle()}</span>
          
          <select 
            className={styles.navTodayBtn} 
            style={{ marginLeft: "14px", paddingRight: "10px" }}
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
          >
            <option value="전체 공장">공장 선택 - 전체 공장</option>
            <option value="A공장동">A공장</option>
            <option value="B공장동">B공장</option>
            <option value="C공장동">C공장</option>
            <option value="D공장동">D공장</option>
            <option value="E공장동">E공장</option>
            <option value="F공장동">F공장</option>
            <option value="G공장동">G공장</option>
          </select>
        </div>
        
        <div className={styles.calendarViewModes}>
          <button className={`${styles.modeBtn} ${calendarView === "week" ? styles.active : ""}`} onClick={() => setCalendarView("week")}>주간</button>
          <button className={`${styles.modeBtn} ${calendarView === "month" ? styles.active : ""}`} onClick={() => setCalendarView("month")}>월간</button>
        </div>
      </div>

      <div className={styles.calendarWeekdayHeader}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={`${styles.weekdayLabel} ${w === "토" ? styles.sat : w === "일" ? styles.sun : ""}`}>
            {w}
          </span>
        ))}
      </div>

      <div className={styles.calendarDaysGrid}>
        {calendarDays.map((cell) => {
          const cellStart = new Date(cell.date);
          cellStart.setHours(0, 0, 0, 0);
          const cellEnd = new Date(cell.date);
          cellEnd.setHours(23, 59, 59, 999);

          const tasksOfDay = calendarTasks.filter((task) => task.startDate <= cellEnd && task.endDate >= cellStart);
          const isSelected = cell.date.toDateString() === selectedDate.toDateString();
          const now = new Date();
          const isToday =
            cell.date.getFullYear() === now.getFullYear() &&
            cell.date.getMonth() === now.getMonth() &&
            cell.date.getDate() === now.getDate();

          const checksOfDay = equipments.filter((eq) => {
            if (!eq.check_date) return false;
            const checkDate = new Date(eq.check_date);
            checkDate.setHours(0, 0, 0, 0);
            return checkDate.getTime() === cellStart.getTime();
          });

          const hasSchedule = tasksOfDay.length > 0 || checksOfDay.length > 0;

          return (
            <div
              key={toYmd(cell.date)}
              className={`${styles.calendarDayCell} ${isSelected ? styles.selected : ""} ${isToday ? styles.today : ""} ${hasSchedule ? styles.hasData : ""} ${cell.isCurrentMonth ? "" : styles.otherMonth}`}
              onClick={() => setSelectedDate(new Date(cell.date))}
            >
              <div className={styles.dayNumberWrapper}>
                <span className={styles.dayNumber}>{cell.date.getDate()}</span>
                {isToday && <span className={styles.todayDot}>오늘</span>}
              </div>
              
              {(tasksOfDay.length > 0 || checksOfDay.length > 0) && (
                <div className={styles.dayPillsList}>
                  {tasksOfDay.length > 0 && (
                    <div className={`${styles.calendarStaffPill} ${styles.pillBlue}`}>
                      <span>공정 {tasksOfDay.length}개</span>
                    </div>
                  )}
                  {checksOfDay.length > 0 && (
                    <div className={`${styles.calendarStaffPill} ${styles.pillRed}`}>
                      <span>🛠️ 점검 {checksOfDay.length}건</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
