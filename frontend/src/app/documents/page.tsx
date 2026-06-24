"use client";

import React from "react";
import { useDocuments } from "../../hooks/useDocuments";
import { StatusBanner } from "../../components/documents/StatusBanner";
import { UploadSection } from "../../components/documents/UploadSection";
import { RecentDocuments } from "../../components/documents/RecentDocuments";
import { DocumentsTable } from "../../components/documents/DocumentsTable";
import styles from "./page.module.css";

export default function DocumentsPage() {
  const {
    documents,
    dragActive,
    scheduleStatus,
    progress,
    r2SyncMessage,
    r2Syncing,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleStartSchedule,
    handleSyncR2,
    handleDelete,
    handleDownload,
  } = useDocuments();

  return (
    <div className={`${styles.docContainer} animate-in`}>
      {/* ── Status Banner ── */}
      <StatusBanner
        scheduleStatus={scheduleStatus}
        progress={progress}
        r2SyncMessage={r2SyncMessage}
      />

      <div className={styles.docTopGrid}>
        {/* ── Upload Section ── */}
        <UploadSection
          dragActive={dragActive}
          r2Syncing={r2Syncing}
          scheduleStatus={scheduleStatus}
          handleDrag={handleDrag}
          handleDrop={handleDrop}
          handleFileChange={handleFileChange}
          handleStartSchedule={handleStartSchedule}
          handleSyncR2={handleSyncR2}
        />

        {/* ── Recent Documents Panel ── */}
        <RecentDocuments
          documents={documents}
          handleDownload={handleDownload}
        />
      </div>

      {/* ── Documents List Table ── */}
      <DocumentsTable
        documents={documents}
        handleDownload={handleDownload}
        handleDelete={handleDelete}
      />
    </div>
  );
}