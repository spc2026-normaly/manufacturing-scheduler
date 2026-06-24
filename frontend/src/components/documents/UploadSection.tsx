import React, { useRef } from "react";
import styles from "./UploadSection.module.css";

interface UploadSectionProps {
  dragActive: boolean;
  r2Syncing: boolean;
  scheduleStatus: "idle" | "running" | "completed" | "failed";
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStartSchedule: () => void;
  handleSyncR2: () => void;
}

export function UploadSection({
  dragActive,
  r2Syncing,
  scheduleStatus,
  handleDrag,
  handleDrop,
  handleFileChange,
  handleStartSchedule,
  handleSyncR2,
}: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.docUploadCard}>
      <div className={styles.docCardHeader}>
        <span className={styles.docCardTitle}>템플릿 다운</span>
      </div>
      <div
        className={`${styles.docDropzone} ${dragActive ? styles.active : ""}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept=".csv,.xlsx,.pdf,.txt,.docx"
          multiple
        />
        <span className={styles.docUploadIcon}>📂</span>
        <span className={styles.docUploadText}>파일을 드래그하여 놓거나 클릭하여 선택 (여러 파일 가능)</span>
        <button
          type="button"
          className={styles.docUploadBtn}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          업로드
        </button>
        <span className={styles.docUploadHint}>지원 파일 형식 (csv, xlsx, pdf, txt)</span>
      </div>
      <div className={styles.docScheduleBtnWrapper}>
        <button
          className={styles.docScheduleBtn}
          onClick={handleStartSchedule}
          disabled={scheduleStatus === "running"}
        >
          {scheduleStatus === "running" ? "일정 생성 중..." : "일정 수립하기"}
        </button>
        <button
          className={styles.docScheduleBtn}
          onClick={handleSyncR2}
          disabled={r2Syncing}
          style={{ marginLeft: "12px", backgroundColor: "#10b981" }}
        >
          {r2Syncing ? "동기화 중..." : "☁️ 클라우드페어 DB동기화"}
        </button>
      </div>
    </div>
  );
}
