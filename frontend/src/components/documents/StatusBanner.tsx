import React from "react";
import styles from "./StatusBanner.module.css";

interface StatusBannerProps {
  scheduleStatus: "idle" | "running" | "completed" | "failed";
  progress: number;
  r2SyncMessage: { type: 'success' | 'error' | 'warning'; message: string } | null;
}

export function StatusBanner({ scheduleStatus, progress, r2SyncMessage }: StatusBannerProps) {
  return (
    <div className={styles.docStatusBanner}>
      <span className={styles.docStatusText}>
        {scheduleStatus === "idle" && "대기 중: 일정 수립 문서를 업로드하고 시작해 주세요."}
        {scheduleStatus === "running" && `일정 생성 중...(${String(progress).padStart(2, "0")}%)`}
        {scheduleStatus === "completed" && "스마트 일정 생성이 완료되었습니다!"}
        {scheduleStatus === "failed" && "일정 생성에 실패했습니다. 다시 시도해주세요."}
      </span>
      <div className={styles.docStatusProgressContainer}>
        {scheduleStatus === "running" && (
          <div className={styles.docStatusProgressBar}>
            <div className={styles.docStatusProgressFill} style={{ width: `${progress}%` }} />
          </div>
        )}
        <span className={`${styles.docStatusBadge} ${
          scheduleStatus === "completed" 
            ? styles.badgeSuccess 
            : scheduleStatus === "failed" 
              ? styles.badgeError 
              : styles.badgeInfo
        }`}>
          {scheduleStatus === "idle" && "READY"}
          {scheduleStatus === "running" && "PROCESSING"}
          {scheduleStatus === "completed" && "SUCCESS"}
          {scheduleStatus === "failed" && "FAILED"}
        </span>
        {r2SyncMessage && (
          <span className={`${styles.docR2SyncMessage} ${styles[r2SyncMessage.type]}`}>
            {r2SyncMessage.message}
          </span>
        )}
      </div>
    </div>
  );
}
