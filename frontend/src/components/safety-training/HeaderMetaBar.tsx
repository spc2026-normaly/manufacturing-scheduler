import React from "react";
import styles from "./HeaderMetaBar.module.css";

interface HeaderMetaBarProps {
  completedRate: number;
  warningRate: number;
  expiredRate: number;
  completedCount: number;
  expiredCount: number;
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
  return (
    <div className={styles.stHeaderMeta}>
      <span className={styles.stToday}>오늘 날짜 : 2026.06.15</span>

      {/* Multi-segment progress bar for complete/expired ratio */}
      <div className={styles.stStatsSummary}>
        <span className={styles.stStatsLabel}>만료/완료 통계</span>
        <div className={styles.stProgressMulti} title={`완료: ${completedRate}%, 임박: ${warningRate}%, 만료: ${expiredRate}%`}>
          <div className={`${styles.stProgressSec} ${styles.completed}`} style={{ width: `${completedRate}%` }}></div>
          <div className={`${styles.stProgressSec} ${styles.warning}`} style={{ width: `${warningRate}%` }}></div>
          <div className={`${styles.stProgressSec} ${styles.expired}`} style={{ width: `${expiredRate}%` }}></div>
        </div>
        <span className={styles.stStatsText}>
          완료 {completedCount}건 / 만료 {expiredCount}건
        </span>
      </div>

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
