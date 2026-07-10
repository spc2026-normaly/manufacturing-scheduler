"use client";

import React, { useState, useEffect } from "react";
import { useEquipments } from "../../hooks/useEquipments";
import { MetricCards } from "../../components/equipments/MetricCards";
import { UpcomingEquipmentPanel } from "../../components/equipments/UpcomingEquipmentPanel";
import { EquipmentTable } from "../../components/equipments/EquipmentTable";
import { uploadEquipmentCsv } from "../../services/equipmentService";
import { useToast } from "../AppLayout";
import styles from "./page.module.css";

const EQUIPMENT_FILE_NAME_KEY = "equipments.currentFileName";

export default function EquipmentsPage() {
  const { equipments, upcomingEquipments, loading, metrics, refetch } = useEquipments();
  const showToast = useToast();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ emp_id: string; emp_name: string; emp_role: string; login_id: string } | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  useEffect(() => {
    // 1. Get today's date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setTodayStr(`${yyyy}.${mm}.${dd}`);

    // 2. Fetch current user info
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: token ? `Bearer ${token}` : ""
          }
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data);
        }
      } catch (err) {
        console.error("Failed to fetch user in equipments page", err);
      }
    };
    fetchUser();

    // 3. Load saved current file name
    const savedFileName = localStorage.getItem(EQUIPMENT_FILE_NAME_KEY);
    if (savedFileName) {
      setCurrentFileName(savedFileName);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast("업로드할 CSV 파일을 먼저 선택해 주세요. 📎");
      return;
    }
    setUploadLoading(true);
    try {
      const res = await uploadEquipmentCsv(selectedFile);
      const result = await res.json();

      if (res.ok) {
        showToast("장비 데이터 업로드가 완료되었습니다. 🚀");
        localStorage.setItem(EQUIPMENT_FILE_NAME_KEY, selectedFile.name);
        setCurrentFileName(selectedFile.name);
        setSelectedFile(null); // Reset selection
        await refetch();
      } else {
        showToast(`업로드 실패: ${result.detail || "오류"}`);
      }
    } catch (err: any) {
      showToast(`업로드 실패: ${err?.message || err}`);
    } finally {
      setUploadLoading(false);
    }
  };

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
    <div className={`${styles.eqContainer} animate-in`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Top CSV Upload Header ── */}
      {currentUser?.emp_role !== "member" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "16px 24px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>오늘 날짜 : {todayStr}</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", cursor: "pointer", fontSize: 13, color: "#334155", background: "#fff", whiteSpace: "nowrap" }}>
              📎 {selectedFile ? selectedFile.name.slice(0, 12) + "..." : "CSV 파일 선택"}
              <input type="file" accept=".csv" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </label>
            <button
              onClick={handleUpload}
              disabled={uploadLoading || !selectedFile}
              style={{ padding: "8px 16px", borderRadius: 8, background: selectedFile ? "#2563eb" : "#94a3b8", color: "#fff", border: "none", cursor: selectedFile ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {uploadLoading ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </div>
      )}

      {/* ── Top Dashboard Section ── */}
      <div className={styles.eqTopGrid}>
        {/* Metric Cards (Left) */}
        <MetricCards metrics={metrics} />

        {/* Alarm Board (Right) */}
        <UpcomingEquipmentPanel upcomingEquipments={upcomingEquipments} />
      </div>

      {/* ── Bottom Table Section ── */}
      <EquipmentTable equipments={equipments} onRefetch={refetch} currentFileName={currentFileName} />
    </div>
  );
}