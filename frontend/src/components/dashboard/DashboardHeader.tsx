import React from "react";
import { HealthData } from "../../types/dashboard";
import styles from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
  health: HealthData | null;
}

export function DashboardHeader({ health }: DashboardHeaderProps) {
  return (
    <div className={styles.dashboardHeader}>
      <div>
        <h1 className={styles.dashboardTitle}>라인 운영 현황</h1>
        <p className={styles.dashboardSubtitle}>실시간 작업자 배치도 및 스마트 설비 모니터링</p>
      </div>
      {health && (
        <div className={styles.healthStatusBadge}>
          <span className={`${styles.statusDot} ${health.database === "connected" ? styles.online : styles.offline}`}></span>
          <span className={styles.healthText}>DB {health.database === "connected" ? "연결 상태 정상" : "연결 유실"}</span>
        </div>
      )}
    </div>
  );
}
