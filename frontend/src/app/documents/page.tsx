"use client";
import React, { useState, useRef, useEffect } from "react";
import { useToast } from "../AppLayout";

const API_BASE = "/api/documents";

interface DocFile {
  file_id: string;
  file_name: string;
  file_extension: string;
  file_size: number;
  file_created_at: string;
  uploader: string;
}

export default function DocumentsPage() {
  const showToast = useToast();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchDocuments = async () => {
    try {
      const res = await fetch(API_BASE, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setDocuments(await res.json());
    } catch {
      showToast("문서 목록을 불러오지 못했습니다.");
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const addUploadedFile = async (file: File) => {
    const supportedTypes = ["csv", "xlsx", "pdf", "txt", "docx"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!supportedTypes.includes(ext)) {
      showToast("지원하지 않는 파일 형식입니다.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        showToast(`'${file.name}' 파일이 업로드되었습니다.`);
        fetchDocuments();
      } else {
        showToast("업로드에 실패했습니다.");
      }
    } catch {
      showToast("서버 연결에 실패했습니다.");
    }
  };

  const handleDelete = async (doc: DocFile) => {
    if (!confirm(`'${doc.file_name}' 파일을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`${API_BASE}/${doc.file_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        showToast(`'${doc.file_name}' 파일이 삭제되었습니다.`);
        fetchDocuments();
      }
    } catch {
      showToast("삭제에 실패했습니다.");
    }
  };

  const handleDownload = (doc: DocFile) => {
    window.open(`${API_BASE}/${doc.file_id}/download`, "_blank");
    showToast(`'${doc.file_name}' 다운로드를 시작합니다.`);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await addUploadedFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await addUploadedFile(file);
    }
  };

  const handleStartSchedule = async () => {
    setScheduleStatus("running");
    setProgress(0);

    const file_ids = ["c2d7df63-7fc9-4537-b009-e3a251660f83"];

    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ file_ids }),
      });

      if (res.ok) {
        const result = await res.json();
        setScheduleStatus("completed");
        showToast(`일정 ${result.schedules.length}개가 생성되었습니다!`);
        console.log("생성된 일정:", result);
      } else {
        setScheduleStatus("failed");
        showToast("일정 생성에 실패했습니다.");
      }
    } catch {
      setScheduleStatus("failed");
      showToast("서버 연결에 실패했습니다.");
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scheduleStatus === "running") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) { clearInterval(interval); return 90; }
          return prev + 5;
        });
      }, 200);
    }
    if (scheduleStatus === "completed") setProgress(100);
    return () => clearInterval(interval);
  }, [scheduleStatus]);

  const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const formatDate = (dt: string) => dt?.replace("T", " ").substring(0, 16).replace(/-/g, ".") ?? "-";

  return (
    <div className="doc-container animate-in">
      <style>{`
        .doc-container { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .doc-status-banner { background-color: var(--card-bg, #ffffff); border: 1px solid var(--border, #e2e8f0); border-left: 4px solid #3b82f6; border-radius: 8px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .doc-status-text { font-size: 14px; font-weight: 600; color: var(--text-main, #1e293b); }
        .doc-status-progress-container { display: flex; align-items: center; gap: 12px; }
        .doc-status-progress-bar { width: 150px; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .doc-status-progress-fill { height: 100%; background-color: #3b82f6; transition: width 0.2s linear; }
        .doc-status-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
        .badge-info { background-color: #dbeafe; color: #1e40af; }
        .badge-success { background-color: #dcfce7; color: #15803d; }
        .badge-error { background-color: #fee2e2; color: #b91c1c; }
        .doc-top-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
        .doc-upload-card { background-color: var(--card-bg, #ffffff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 16px; }
        .doc-card-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-card-title { font-size: 15px; font-weight: 700; color: var(--text-main, #0f172a); }
        .doc-dropzone { border: 2px dashed var(--border, #cbd5e1); border-radius: 8px; padding: 32px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; background-color: #fafafa; transition: all 0.2s ease; cursor: pointer; }
        .doc-dropzone.active { border-color: #3b82f6; background-color: #eff6ff; }
        .doc-upload-icon { font-size: 40px; color: #94a3b8; }
        .doc-upload-text { font-size: 14px; color: var(--text-main, #334155); font-weight: 500; }
        .doc-upload-btn { background-color: #64748b; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .doc-upload-hint { font-size: 11px; color: var(--text-muted, #94a3b8); }
        .doc-schedule-btn-wrapper { display: flex; justify-content: flex-end; }
        .doc-schedule-btn { background-color: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .doc-schedule-btn:disabled { background-color: #cbd5e1; color: #94a3b8; cursor: not-allowed; }
        .doc-recent-card { background-color: var(--card-bg, #ffffff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 16px; }
        .doc-recent-list { display: flex; flex-direction: column; gap: 12px; }
        .doc-recent-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border, #f1f5f9); cursor: pointer; }
        .doc-recent-item:hover { background-color: #f8fafc; }
        .doc-recent-left { display: flex; align-items: center; gap: 10px; }
        .doc-recent-name { font-size: 13px; font-weight: 500; color: var(--text-main, #334155); }
        .doc-ext-badge { background-color: #f1f5f9; color: #475569; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .doc-icon-btn { background: none; border: none; color: #3b82f6; font-size: 14px; cursor: pointer; }
        .doc-icon-btn.delete { color: #ef4444; }
        .doc-table-card { background-color: var(--card-bg, #ffffff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
        .doc-table-wrapper { overflow-x: auto; }
        .doc-table { width: 100%; border-collapse: collapse; text-align: left; }
        .doc-table th { background-color: #f8fafc; padding: 14px 24px; font-size: 13px; font-weight: 600; color: var(--text-muted, #475569); border-bottom: 1px solid var(--border, #e2e8f0); }
        .doc-table td { padding: 14px 24px; font-size: 14px; color: var(--text-main, #334155); border-bottom: 1px solid var(--border, #f1f5f9); }
        .doc-row:hover { background-color: #f8fafc; }
        .doc-table-actions { display: flex; gap: 12px; }
        .doc-empty-cell { text-align: center; padding: 40px !important; color: var(--text-muted, #64748b); }
      `}</style>

      <div className="doc-status-banner">
        <span className="doc-status-text">
          {scheduleStatus === "idle" && "대기 중: 일정 수립 문서를 업로드하고 시작해 주세요."}
          {scheduleStatus === "running" && `일정 생성 중...(${String(progress).padStart(2, "0")}%)`}
          {scheduleStatus === "completed" && "스마트 일정 생성이 완료되었습니다!"}
          {scheduleStatus === "failed" && "일정 생성에 실패했습니다. 다시 시도해주세요."}
        </span>
        <div className="doc-status-progress-container">
          {scheduleStatus === "running" && (
            <div className="doc-status-progress-bar">
              <div className="doc-status-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          <span className={`doc-status-badge ${scheduleStatus === "completed" ? "badge-success" : scheduleStatus === "failed" ? "badge-error" : "badge-info"}`}>
            {scheduleStatus === "idle" && "READY"}
            {scheduleStatus === "running" && "PROCESSING"}
            {scheduleStatus === "completed" && "SUCCESS"}
            {scheduleStatus === "failed" && "FAILED"}
          </span>
        </div>
      </div>

      <div className="doc-top-grid">
        <div className="doc-upload-card">
          <div className="doc-card-header">
            <span className="doc-card-title">템플릿 다운</span>
          </div>
          <div
            className={`doc-dropzone ${dragActive ? "active" : ""}`}
            onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} accept=".csv,.xlsx,.pdf,.txt,.docx" multiple />
            <span className="doc-upload-icon">📂</span>
            <span className="doc-upload-text">파일을 드래그하여 놓거나 클릭하여 선택 (여러 파일 가능)</span>
            <button type="button" className="doc-upload-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>업로드</button>
            <span className="doc-upload-hint">지원 파일 형식 (csv, xlsx, pdf, txt)</span>
          </div>
          <div className="doc-schedule-btn-wrapper">
            <button className="doc-schedule-btn" onClick={handleStartSchedule} disabled={scheduleStatus === "running"}>
              {scheduleStatus === "running" ? "일정 생성 중..." : "일정 수립하기"}
            </button>
          </div>
        </div>

        <div className="doc-recent-card">
          <span className="doc-card-title">최근 업로드된 문서</span>
          <div className="doc-recent-list">
            {documents.slice(0, 4).map((doc) => (
              <div key={doc.file_id} className="doc-recent-item">
                <div className="doc-recent-left">
                  <span>📄</span>
                  <span className="doc-recent-name">{doc.file_name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="doc-ext-badge">{doc.file_extension.toUpperCase()}</span>
                  <button className="doc-icon-btn" onClick={() => handleDownload(doc)}>📥</button>
                </div>
              </div>
            ))}
            {documents.length === 0 && <p style={{ fontSize: 13, color: "#94a3b8" }}>업로드된 문서가 없습니다.</p>}
          </div>
        </div>
      </div>

      <div className="doc-table-card">
        <div style={{ padding: "20px 24px 12px", fontWeight: 700 }}>내 문서 목록 ({documents.length})</div>
        <div className="doc-table-wrapper">
          <table className="doc-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>파일 유형</th>
                <th>크기</th>
                <th>업로드 날짜</th>
                <th>업로더</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {documents.length > 0 ? documents.map((doc) => (
                <tr key={doc.file_id} className="doc-row">
                  <td><span>📄</span> {doc.file_name}</td>
                  <td style={{ textTransform: "uppercase", fontSize: 12 }}>{doc.file_extension}</td>
                  <td>{formatSize(doc.file_size)}</td>
                  <td style={{ color: "#64748b" }}>{formatDate(doc.file_created_at)}</td>
                  <td>{doc.uploader}</td>
                  <td>
                    <div className="doc-table-actions">
                      <button className="doc-icon-btn" onClick={() => handleDownload(doc)}>📥</button>
                      <button className="doc-icon-btn delete" onClick={() => handleDelete(doc)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="doc-empty-cell">등록된 문서가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}