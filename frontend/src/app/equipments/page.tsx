"use client";

import React from "react";
import { useEquipments } from "../../hooks/useEquipments";
import { MetricCards } from "../../components/equipments/MetricCards";
import { UpcomingEquipmentPanel } from "../../components/equipments/UpcomingEquipmentPanel";
import { EquipmentTable } from "../../components/equipments/EquipmentTable";
import styles from "./page.module.css";

export default function EquipmentsPage() {
  const { equipments, upcomingEquipments, loading, metrics, refetch } = useEquipments();

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

  return (
    <div className={`${styles.eqContainer} animate-in`}>
      {/* ── Top Dashboard Section ── */}
      <div className={styles.eqTopGrid}>
        {/* Metric Cards (Left) */}
        <MetricCards metrics={metrics} />

        {/* Alarm Board (Right) */}
        <UpcomingEquipmentPanel upcomingEquipments={upcomingEquipments} />
      </div>

      {/* ── Bottom Table Section ── */}
      <EquipmentTable equipments={equipments} onRefetch={refetch} />
    </div>
  );
}