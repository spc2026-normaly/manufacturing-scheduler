"use client";

import React, { useEffect, useState, useRef } from "react";
import { Equipment } from "../../types/equipment";
import { uploadEquipmentCsv } from "../../services/equipmentService";
import styles from "./EquipmentTable.module.css";

interface EquipmentTableProps {
  equipments: Equipment[];
  onRefetch?: () => Promise<void>;
}

const EQUIPMENT_FILE_NAME_KEY = "equipments.currentFileName";

export function EquipmentTable({ equipments, onRefetch }: EquipmentTableProps) {
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedFileName = localStorage.getItem(EQUIPMENT_FILE_NAME_KEY);
    if (savedFileName) {
      setCurrentFileName(savedFileName);
    }
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previousFileName = currentFileName;

    // 파일명 즉시 표시
    setCurrentFileName(file.name);
    localStorage.setItem(EQUIPMENT_FILE_NAME_KEY, file.name);

    setUploading(true);
    try {
      const response = await uploadEquipmentCsv(file);
      const result = await response.json();

      if (response.ok) {
        alert(`✅ ${result.message}`);
        
        // 데이터 새로고침
        if (onRefetch) {
          await onRefetch();
        }
      } else {
        alert(`❌ 오류: ${result.detail}`);
        // 오류 시 파일명 초기화
        setCurrentFileName(previousFileName);
        if (previousFileName) {
          localStorage.setItem(EQUIPMENT_FILE_NAME_KEY, previousFileName);
        } else {
          localStorage.removeItem(EQUIPMENT_FILE_NAME_KEY);
        }
      }
    } catch (error) {
      alert(`❌ 업로드 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      // 오류 시 파일명 초기화
      setCurrentFileName(previousFileName);
      if (previousFileName) {
        localStorage.setItem(EQUIPMENT_FILE_NAME_KEY, previousFileName);
      } else {
        localStorage.removeItem(EQUIPMENT_FILE_NAME_KEY);
      }
    } finally {
      setUploading(false);
      // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.eqTableCard}>
      {/* 제목 + 버튼 + 파일명 섹션 */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
        {/* 제목 */}
        <div className={styles.eqTableTitle}>장비 현황 목록</div>
        
        {/* 버튼 + 파일명 */}
        <div style={{ 
          display: "flex", 
          gap: "8px", 
          alignItems: "center"
        }}>
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            style={{
              padding: "6px 12px",
              backgroundColor: uploading ? "#ccc" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => !uploading && (e.currentTarget.style.backgroundColor = "#2563eb")}
            onMouseLeave={(e) => !uploading && (e.currentTarget.style.backgroundColor = "#3b82f6")}
          >
            {uploading ? "업로드 중..." : "CSV 업로드"}
          </button>
          
          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            disabled={uploading}
          />
          
          {/* 파일명 표시 (파일 선택 후에만) */}
          {currentFileName && (
            <span style={{
              fontSize: "13px",
              color: "#64748b",
              marginLeft: "8px",
              whiteSpace: "nowrap"
            }}>
              현재 표시 파일: {currentFileName}
            </span>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.eqTableWrapper}>
        <table className={styles.eqTable}>
          <thead>
            <tr>
              <th>No.</th>
              <th>장비명</th>
              <th>전체(개)</th>
              <th>사용가능(개)</th>
              <th>장비점검 주기</th>
              <th>장비 점검일</th>
              <th>다음 점검일</th>
            </tr>
          </thead>
          <tbody>
            {equipments.length > 0 ? (
              equipments.map((eq, idx) => (
                <tr key={eq.eq_id} className={`${styles.eqRow} animate-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <td style={{ color: "var(--text-muted, #64748b)", fontWeight: 500 }}>No.{idx + 1}</td>
                  <td className={styles.eqCellName}>{eq.eq_name}</td>
                  <td>{eq.eq_count}</td>
                  <td>{eq.available_eq_count}</td>
                  <td>{eq.check_cycle}일</td>
                  <td>
                    <span className={`${styles.eqBadge} ${styles.badgeGray}`}>{eq.recent_check_date.replace(/-/g, ".")}</span>
                  </td>
                  <td>
                    <span className={`${styles.eqBadge} ${styles.badgeYellow}`}>{eq.check_date.replace(/-/g, ".")}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted, #64748b)" }}>
                  등록된 장비가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
