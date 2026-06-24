import React from "react";
import styles from "./StatsGrid.module.css";

interface StatsGridProps {
  employeesCount: number;
  completionRate: number;
  upcomingCount: number;
}

export function StatsGrid({
  employeesCount,
  completionRate,
  upcomingCount,
}: StatsGridProps) {
  return (
    <div className={styles.statsRow}>
      {/* Card 1: 전체 직원 수 */}
      <div className={styles.statCard}>
        <div className={styles.statCardHeader}>
          <span className={styles.statCardTitle}>전체 직원 수</span>
        </div>
        <div className={styles.statCardBody}>
          <span className={styles.statNumber}>{employeesCount}</span>
          <span className={styles.statUnit}>명</span>
        </div>
        <div className={styles.statCardFooter}>
          <span className={`${styles.trendText} ${styles.positive}`}>실시간 연동 완료</span>
        </div>
      </div>

      {/* Card 2: 교육 완료율 */}
      <div className={styles.statCard}>
        <div className={styles.statCardHeader}>
          <span className={styles.statCardTitle}>교육 완료율</span>
        </div>
        <div className={styles.statCardBody}>
          <span className={styles.statNumber}>{completionRate}</span>
          <span className={styles.statUnit}>%</span>
        </div>
        <div className={styles.statCardFooter}>
          <span className={`${styles.trendText} ${styles.positive}`}>실시간 교육 이수율</span>
        </div>
      </div>

      {/* Card 3: 점검 예정 설비 */}
      <div className={styles.statCard}>
        <div className={styles.statCardHeader}>
          <span className={styles.statCardTitle}>점검 예정 설비</span>
        </div>
        <div className={styles.statCardBody}>
          <span className={styles.statNumber}>{upcomingCount}</span>
          <span className={styles.statUnit}>건</span>
        </div>
        <div className={styles.statCardFooter}>
          <span className={`${styles.trendText} ${styles.negative}`}>7일 이내 예정</span>
        </div>
      </div>

      {/* Card 4: 업로드 문서 */}
      <div className={styles.statCard}>
        <div className={styles.statCardHeader}>
          <span className={styles.statCardTitle}>업로드 문서</span>
        </div>
        <div className={styles.statCardBody}>
          <span className={styles.statNumber}>36</span>
          <span className={styles.statUnit}>개</span>
        </div>
        <div className={styles.statCardFooter}>
          <span className={styles.trendText} style={{ color: "var(--text-muted)" }}>전체 문서 수</span>
        </div>
      </div>
    </div>
  );
}
