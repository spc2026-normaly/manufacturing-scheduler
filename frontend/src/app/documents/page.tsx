"use client";

import React, { useState, useRef, useEffect } from "react";
import { useToast } from "../AppLayout";

// ─── Interfaces & Types ─────────────────────────────────────
interface DocFile {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  author: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const INITIAL_DOCUMENTS: DocFile[] = [
  { id: "doc_001", name: "안전교육_2024_05.csv", type: "csv", size: "2.1 MB", uploadDate: "2026.05.18 00:00", author: "김ㅇㅇ" },
  { id: "doc_002", name: "설비점검_리스트.xlsx", type: "xlsx", size: "1.4 MB", uploadDate: "2026.05.18 00:00", author: "김ㅇㅇ" }
];

const RECENT_DOCUMENTS = [
  { id: "rec_001", name: "안전교육_2024_05.csv", type: "CSV" },
  { id: "rec_002", name: "설비점검_리스트.xlsx", type: "XLSX" },
  { id: "rec_003", name: "작업수칙_가이드.pdf", type: "PDF" },
  { id: "rec_004", name: "위험성평가_표준.txt", type: "TXT" }
];

export default function DocumentsPage() {
  const showToast = useToast();
  const [documents, setDocuments] = useState<DocFile[]>(INITIAL_DOCUMENTS);
  const [dragActive, setDragActive] = useState(false);
  
  // ─── Schedule Generation Simulation State ──────────────────
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  
  // ─── R2 Sync Message State ──────────────────────────────────
  const [r2SyncMessage, setR2SyncMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // File select handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addUploadedFile(e.target.files[0]);
    }
  };

  // Add file helper
  const addUploadedFile = (file: File) => {
    const fileExtension = file.name.split(".").pop() || "unknown";
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    
    // Check supported file types
    const supportedTypes = ["csv", "xlsx", "pdf", "txt", "docx"];
    if (!supportedTypes.includes(fileExtension.toLowerCase())) {
      showToast(`지원하지 않는 파일 형식입니다. (지원 형식: ${supportedTypes.join(", ")})`);
      return;
    }

    const newDoc: DocFile = {
      id: `doc_${Date.now()}`,
      name: file.name,
      type: fileExtension.toLowerCase(),
      size: `${fileSizeMB} MB`,
      uploadDate: new Date().toISOString().replace("T", " ").substring(0, 16).replace(/-/g, "."),
      author: "김리더"
    };

    setDocuments((prev) => [newDoc, ...prev]);
    showToast(`'${file.name}' 파일이 정상 업로드되었습니다.`);
  };

  // Delete handler
  const handleDelete = (doc: DocFile) => {
    if (confirm(`'${doc.name}' 파일을 삭제하시겠습니까?`)) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showToast(`'${doc.name}' 파일이 삭제되었습니다.`);
    }
  };

  // Download trigger simulation
  const handleDownload = (fileName: string) => {
    showToast(`'${fileName}' 파일 다운로드를 시작합니다.`);
  };

  // Schedule trigger simulation
  const handleStartSchedule = () => {
    if (documents.length === 0) {
      showToast("일정을 수립할 업로드된 문서가 없습니다. 먼저 파일을 업로드해주세요.");
      return;
    }

    setScheduleStatus("running");
    setProgress(0);
  };

  // R2 Sync handler
  const [r2Syncing, setR2Syncing] = useState(false);

  const handleSyncR2 = async () => {
    const token = localStorage.getItem("token");
    console.log("🔍 R2 Sync 시작 - Token:", token ? "존재" : "없음");
    
    if (!token) {
      console.warn("⚠️ 토큰 없음");
      showToast("로그인이 필요합니다.");
      return;
    }

    setR2Syncing(true);
    console.log("🚀 API 호출 시작...");

    try {
      console.log("📡 요청 헤더:", {
        "Authorization": `Bearer ${token.substring(0, 20)}...`,
        "Content-Type": "application/json"
      });

      const response = await fetch("/api/documents/sync-r2", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("📨 응답 상태:", response.status, response.statusText);

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ API 에러:", errText);
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      console.log("✅ API 성공 응답:", data);
      
      // 수정사항이 없는 경우
      const { created = 0, updated = 0, skipped = 0 } = data;
      if (created === 0 && updated === 0) {
        console.log("ℹ️ 변경사항 없음");
        setR2SyncMessage({ type: 'warning', message: '변경내역이 없습니다' });
        showToast("변경된 내용이 없습니다.");
      } else {
        console.log("💬 메시지 표시 시작...");
        setR2SyncMessage({ type: 'success', message: 'Cloud fare R2 저장소의 csv 파일이 DB에 반영되었습니다!' });
        console.log("✨ 메시지 설정 완료");
        showToast("✅ 동기화 완료!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("🔴 동기화 에러:", message);
      setR2SyncMessage({ type: 'error', message: '동기화에 실패했습니다' });
      showToast(`❌ 동기화 실패: ${message}`);
    } finally {
      setR2Syncing(false);
      console.log("🏁 동기화 완료");
    }
  };

  // Progress Bar simulation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scheduleStatus === "running") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            // Simulate completion
            setScheduleStatus("completed");
            showToast("스마트 AI 일정 수립이 성공적으로 완료되었습니다!");
            return 100;
          }
          return prev + 5; // progress by 5%
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [scheduleStatus]);

  // R2 Sync Message auto-hide effect (7 seconds)
  useEffect(() => {
    if (r2SyncMessage) {
      const timer = setTimeout(() => {
        setR2SyncMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [r2SyncMessage]);

  return (
    <div className="doc-container animate-in">
      <style>{`
        .doc-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Header Notification Banner ── */
        .doc-status-banner {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-left: 4px solid #3b82f6;
          border-radius: 8px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .doc-status-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
        }
        .doc-status-progress-container {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-grow: 1;
          justify-content: flex-end;
          max-width: 400px;
        }
        .doc-status-progress-bar {
          width: 150px;
          height: 8px;
          background-color: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }
        .doc-status-progress-fill {
          height: 100%;
          background-color: #3b82f6;
          transition: width 0.1s linear;
        }
        .doc-status-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .badge-info { background-color: #dbeafe; color: #1e40af; }
        .badge-success { background-color: #dcfce7; color: #15803d; }

        /* R2 Sync Message */
        .doc-r2-sync-message {
          position: absolute;
          right: 0;
          top: 0;
          font-weight: 600;
          font-size: 14px;
          animation: slideIn 0.3s ease-out, slideOut 0.3s ease-out 6.7s forwards;
          white-space: nowrap;
        }
        .doc-r2-sync-message.success {
          color: #10b981;
        }
        .doc-r2-sync-message.error {
          color: #ef4444;
        }
        .doc-r2-sync-message.warning {
          color: #3b82f6;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(20px);
          }
        }
        .doc-status-banner {
          position: relative;
        }

        /* ── Top Grid Section ── */
        .doc-top-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .doc-top-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Drag & Drop Upload Zone */
        .doc-upload-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
        }
        .doc-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .doc-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
        }
        .doc-template-btn {
          font-size: 12px;
          color: #3b82f6;
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
        }
        .doc-template-btn:hover {
          text-decoration: underline;
        }
        
        .doc-dropzone {
          border: 2px dashed var(--border, #cbd5e1);
          border-radius: 8px;
          padding: 32px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background-color: #fafafa;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .doc-dropzone.active {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }
        .doc-upload-icon {
          font-size: 40px;
          color: #94a3b8;
        }
        .doc-upload-text {
          font-size: 14px;
          color: var(--text-main, #334155);
          font-weight: 500;
        }
        .doc-upload-btn {
          background-color: #64748b;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .doc-upload-btn:hover {
          background-color: #475569;
        }
        .doc-upload-hint {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
        }

        .doc-schedule-btn-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }
        .doc-schedule-btn {
          background-color: #4f46e5;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .doc-schedule-btn:hover {
          background-color: #4338ca;
        }
        .doc-schedule-btn:disabled {
          background-color: #cbd5e1;
          color: #94a3b8;
          cursor: not-allowed;
        }

        /* Right Recent Files List */
        .doc-recent-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .doc-recent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .doc-recent-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border, #f1f5f9);
          transition: background-color 0.2s;
          cursor: pointer;
        }
        .doc-recent-item:hover {
          background-color: #f8fafc;
        }
        .doc-recent-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .doc-file-icon {
          font-size: 20px;
        }
        .doc-recent-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main, #334155);
        }
        .doc-recent-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .doc-ext-badge {
          background-color: #f1f5f9;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .doc-icon-btn {
          background: none;
          border: none;
          color: #3b82f6;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s;
        }
        .doc-icon-btn:hover {
          transform: scale(1.15);
        }

        /* ── Bottom Table Section ── */
        .doc-table-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .doc-table-wrapper {
          overflow-x: auto;
          width: 100%;
        }
        .doc-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .doc-table th {
          background-color: #f8fafc;
          padding: 14px 24px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, #475569);
          border-bottom: 1px solid var(--border, #e2e8f0);
          white-space: nowrap;
        }
        .doc-table td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--text-main, #334155);
          border-bottom: 1px solid var(--border, #f1f5f9);
          vertical-align: middle;
        }
        .doc-row:hover {
          background-color: #f8fafc;
        }
        .doc-cell-name {
          font-weight: 600;
          color: var(--text-main, #0f172a);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .doc-cell-type {
          text-transform: uppercase;
          font-size: 12px;
          color: var(--text-muted, #64748b);
        }
        .doc-cell-date {
          color: var(--text-muted, #64748b);
        }
        .doc-cell-author {
          font-weight: 500;
        }
        .doc-table-actions {
          display: flex;
          gap: 12px;
        }
        .doc-icon-btn.delete {
          color: #ef4444;
        }
        .doc-empty-cell {
          text-align: center;
          padding: 40px !important;
          color: var(--text-muted, #64748b);
          font-size: 14px;
        }
      `}</style>

      {/* ── Header Notification Banner (Schedule Simulator) ── */}
      <div className="doc-status-banner">
        <span className="doc-status-text">
          {scheduleStatus === "idle" && "대기 중: 일정 수립 문서를 업로드하고 시작해 주세요."}
          {scheduleStatus === "running" && `일정 생성 중...(${progress.toString().padStart(2, "0")}%)`}
          {scheduleStatus === "completed" && "스마트 일정 생성이 완료되었습니다!"}
        </span>
        <div className="doc-status-progress-container">
          {scheduleStatus === "running" && (
            <div className="doc-status-progress-bar">
              <div className="doc-status-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          )}
          <span className={`doc-status-badge ${scheduleStatus === "completed" ? "badge-success" : "badge-info"}`}>
            {scheduleStatus === "idle" && "READY"}
            {scheduleStatus === "running" && "PROCESSING"}
            {scheduleStatus === "completed" && "SUCCESS"}
          </span>
          {r2SyncMessage && (
            <span className={`doc-r2-sync-message ${r2SyncMessage.type}`}>{r2SyncMessage.message}</span>
          )}
        </div>
      </div>

      {/* ── Top Grid Section ── */}
      <div className="doc-top-grid">
        {/* Upload Card (Left) */}
        <div className="doc-upload-card">
          <div className="doc-card-header">
            <span className="doc-card-title">템플릿 다운</span>
            <button className="doc-template-btn" onClick={() => handleDownload("표준_템플릿.csv")}>
              템플릿 파일 받기 📥
            </button>
          </div>

          <div
            className={`doc-dropzone ${dragActive ? "active" : ""}`}
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
              accept=".csv,.xlsx,.pdf,.txt"
            />
            <span className="doc-upload-icon">📂</span>
            <span className="doc-upload-text">파일을 드래그하여 놓거나 클릭하여 선택</span>
            <button type="button" className="doc-upload-btn" onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}>
              업로드
            </button>
            <span className="doc-upload-hint">지원 파일 형식 (csv, xlsx, pdf, txt)</span>
          </div>

          <div className="doc-schedule-btn-wrapper">
            <button
              className="doc-schedule-btn"
              onClick={handleStartSchedule}
              disabled={scheduleStatus === "running" || documents.length === 0}
            >
              {scheduleStatus === "running" ? "일정 생성 중..." : "일정 수립하기"}
            </button>
            <button
              className="doc-schedule-btn"
              onClick={handleSyncR2}
              disabled={r2Syncing}
              style={{ marginLeft: "12px", backgroundColor: "#10b981" }}
            >
              {r2Syncing ? "동기화 중..." : "☁️ 클라우드페어 DB동기화"}
            </button>
          </div>
        </div>

        {/* Recent Files Card (Right) */}
        <div className="doc-recent-card">
          <span className="doc-card-title">최근 수정된 문서</span>
          <div className="doc-recent-list">
            {RECENT_DOCUMENTS.map((doc) => (
              <div key={doc.id} className="doc-recent-item" onClick={() => handleDownload(doc.name)}>
                <div className="doc-recent-left">
                  <span className="doc-file-icon">📄</span>
                  <span className="doc-recent-name">{doc.name}</span>
                </div>
                <div className="doc-recent-right">
                  <span className="doc-ext-badge">{doc.type}</span>
                  <button className="doc-icon-btn" title="다운로드" onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(doc.name);
                  }}>
                    📥
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Table Section ── */}
      <div className="doc-table-card">
        <div className="eq-table-title" style={{ padding: "20px 24px 12px" }}>
          내 문서 목록 ({documents.length})
        </div>
        <div className="doc-table-wrapper">
          <table className="doc-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>파일 유형</th>
                <th>크기</th>
                <th>업로드 날짜</th>
                <th>수정한 날짜</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {documents.length > 0 ? (
                documents.map((doc, idx) => (
                  <tr key={doc.id} className="doc-row animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <td className="doc-cell-name">
                      <span>📄</span> {doc.name}
                    </td>
                    <td className="doc-cell-type">{doc.type}</td>
                    <td>{doc.size}</td>
                    <td className="doc-cell-date">{doc.uploadDate}</td>
                    <td className="doc-cell-author">{doc.author}</td>
                    <td>
                      <div className="doc-table-actions">
                        <button className="doc-icon-btn" title="다운로드" onClick={() => handleDownload(doc.name)}>
                          📥
                        </button>
                        <button className="doc-icon-btn delete" title="삭제" onClick={() => handleDelete(doc)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="doc-empty-cell">
                    등록된 문서가 없습니다. 템플릿 파일을 받아 업로드해 보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
