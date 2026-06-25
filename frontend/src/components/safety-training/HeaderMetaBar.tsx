import React, { useState, useEffect } from "react";
import styles from "./HeaderMetaBar.module.css";

interface HeaderMetaBarProps {
  completedRate?: number;
  warningRate?: number;
  expiredRate?: number;
  completedCount?: number;
  expiredCount?: number;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export function HeaderMetaBar({
  completedRate,
  warningRate,
  expiredRate,
  completedCount,
  expiredCount,
  searchQuery,
  onSearchChange,
}: HeaderMetaBarProps) {
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setTodayStr(`${yyyy}.${mm}.${dd}`);
  }, []);

  return (
    <div className={styles.stHeaderMeta}>
      <span className={styles.stToday}>오늘 날짜 : {todayStr}</span>

      {/* Name Search Box */}
      <div className={styles.stSearchBox}>
        <input
          type="text"
          className={styles.stSearchInput}
          placeholder="이름 검색"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className={styles.stSearchIcon}>🔍</span>
      </div>
    </div>
  );
}
