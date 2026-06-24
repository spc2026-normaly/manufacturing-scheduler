import React from "react";
import { TabType } from "../../types/schedule";
import styles from "./ScheduleHeader.module.css";

interface ScheduleHeaderProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  handlePrevDay: () => void;
  handleNextDay: () => void;
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleGoToday: () => void;
}

const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function ScheduleHeader({
  currentTab,
  setCurrentTab,
  selectedDate,
  setSelectedDate,
  handlePrevDay,
  handleNextDay,
  handlePrevWeek,
  handleNextWeek,
  handlePrevMonth,
  handleNextMonth,
  handleGoToday,
}: ScheduleHeaderProps) {
  return (
    <div className={styles.schedHeader}>
      <div className={styles.schedTabs}>
        <button
          className={`${styles.schedTab} ${currentTab === "month" ? styles.active : ""}`}
          onClick={() => {
            setCurrentTab("month");
            handleGoToday();
          }}
        >
          월간
        </button>
        <button
          className={`${styles.schedTab} ${currentTab === "week" ? styles.active : ""}`}
          onClick={() => setCurrentTab("week")}
        >
          주간
        </button>
        <button
          className={`${styles.schedTab} ${currentTab === "day" ? styles.active : ""}`}
          onClick={() => setCurrentTab("day")}
        >
          일간
        </button>
      </div>

      <div className={styles.schedControls}>
        <input
          type="date"
          className={styles.schedDatePicker}
          value={toYmd(selectedDate)}
          onChange={(e) => {
            if (e.target.value) {
              const [y, m, d] = e.target.value.split("-").map(Number);
              setSelectedDate(new Date(y, m - 1, d));
            }
          }}
        />
        {currentTab === "month" && (
          <>
            <button className={styles.schedBtn} onClick={handlePrevMonth}>&lt; 이전달</button>
            <button className={styles.schedBtn} onClick={handleGoToday}>오늘</button>
            <button className={styles.schedBtn} onClick={handleNextMonth}>다음달 &gt;</button>
          </>
        )}
        {currentTab === "week" && (
          <>
            <button className={styles.schedBtn} onClick={handlePrevWeek}>&lt; 이전주</button>
            <button className={styles.schedBtn} onClick={handleGoToday}>오늘</button>
            <button className={styles.schedBtn} onClick={handleNextWeek}>다음주 &gt;</button>
          </>
        )}
        {currentTab === "day" && (
          <>
            <button className={styles.schedBtn} onClick={handlePrevDay}>&lt; 이전날</button>
            <button className={styles.schedBtn} onClick={handleGoToday}>오늘</button>
            <button className={styles.schedBtn} onClick={handleNextDay}>다음날 &gt;</button>
          </>
        )}
      </div>
    </div>
  );
}
