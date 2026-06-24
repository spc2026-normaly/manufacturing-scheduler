"use client";

import React from "react";
import { useSafetyTraining } from "../../hooks/useSafetyTraining";
import { HeaderMetaBar } from "../../components/safety-training/HeaderMetaBar";
import { LegendBar } from "../../components/safety-training/LegendBar";
import { SafetyTrainingTable } from "../../components/safety-training/SafetyTrainingTable";
import styles from "./page.module.css";

export default function SafetyTrainingPage() {
  const {
    searchQuery,
    setSearchQuery,
    loading,
    currentUser,
    isForbidden,
    filteredWorkers,
    stats,
    completedRate,
    expiredRate,
    warningRate,
  } = useSafetyTraining();

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "60vh",
        color: "var(--text-muted, #64748b)"
      }}>
        데이터 로딩 중...
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ padding: "40px", textAlign: "center", borderColor: "#fca5a5", border: "1px solid #fecaca", borderRadius: "12px", backgroundColor: "#fff", maxWidth: "500px", width: "100%" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚫</div>
          <h2 style={{ color: "#dc2626", fontSize: "20px", fontWeight: "bold" }}>접근 권한이 없습니다</h2>
          <p style={{ color: "#4b5563", marginTop: "8px", fontSize: "14px" }}>
            이 데이터를 조회할 수 있는 권한이 없습니다. (API 403 Forbidden)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.stContainer} animate-in`}>
      {/* ── Header Meta Bar ── */}
      {currentUser?.emp_role !== "member" && (
        <HeaderMetaBar
          completedRate={completedRate}
          warningRate={warningRate}
          expiredRate={expiredRate}
          completedCount={stats.completed}
          expiredCount={stats.expired}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* ── Legend Bar ── */}
      {currentUser?.emp_role !== "member" && <LegendBar />}

      {/* ── Content Card & Table ── */}
      <SafetyTrainingTable
        currentUser={currentUser}
        filteredWorkers={filteredWorkers}
      />
    </div>
  );
}
