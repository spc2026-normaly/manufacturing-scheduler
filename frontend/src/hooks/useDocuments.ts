import { useState, useEffect } from "react";
import { DocFile } from "../types/document";
import { useToast } from "../app/AppLayout";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  downloadDocumentUrl,
  generateScheduleFromR2,
  syncR2Data,
} from "../services/documentService";

export function useDocuments() {
  const showToast = useToast();
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [r2SyncMessage, setR2SyncMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [r2Syncing, setR2Syncing] = useState(false);

  const loadDocuments = async () => {
    try {
      const res = await fetchDocuments();
      if (res.ok) {
        setDocuments(await res.json());
      } else {
        showToast("문서 목록을 불러오지 못했습니다.");
      }
    } catch {
      showToast("문서 목록을 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const addUploadedFile = async (file: File) => {
    const supportedTypes = ["csv", "xlsx", "pdf", "txt", "docx"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!supportedTypes.includes(ext)) {
      showToast("지원하지 않는 파일 형식입니다.");
      return;
    }

    try {
      const res = await uploadDocument(file);
      if (res.ok) {
        showToast(`'${file.name}' 파일이 업로드되었습니다.`);
        loadDocuments();
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
      const res = await deleteDocument(doc.file_id);
      if (res.ok) {
        showToast(`'${doc.file_name}' 파일이 삭제되었습니다.`);
        loadDocuments();
      } else {
        showToast("삭제에 실패했습니다.");
      }
    } catch {
      showToast("삭제에 실패했습니다.");
    }
  };

  const handleDownload = async (doc: DocFile) => {
    const url = await downloadDocumentUrl(doc.file_id);
    window.open(url, "_blank");
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

    try {
      const res = await generateScheduleFromR2();
      if (res.ok) {
        const result = await res.json();
        setScheduleStatus("completed");
        showToast(`✅ 일정 ${result.saved_count}개가 생성되었습니다!`);
      } else {
        const errText = await res.text();
        console.error("❌ 에러:", errText);
        setScheduleStatus("failed");
        showToast("일정 생성에 실패했습니다. 로그 확인!");
      }
    } catch (err) {
      console.error("🔴 요청 에러:", err);
      setScheduleStatus("failed");
      showToast("서버 연결에 실패했습니다.");
    }
  };

  const handleSyncR2 = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("로그인이 필요합니다.");
      return;
    }

    setR2Syncing(true);

    try {
      const response = await syncR2Data();
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const { created = 0, updated = 0 } = data;
      if (created === 0 && updated === 0) {
        setR2SyncMessage({ type: 'warning', message: '변경내역이 없습니다' });
        showToast("변경된 내용이 없습니다.");
      } else {
        setR2SyncMessage({ type: 'success', message: 'Cloud fare R2 저장소의 csv 파일이 DB에 반영되었습니다!' });
        showToast("✅ 동기화 완료!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setR2SyncMessage({ type: 'error', message: '동기화에 실패했습니다' });
      showToast(`❌ 동기화 실패: ${message}`);
    } finally {
      setR2Syncing(false);
    }
  };

  // Progress Bar simulation effect
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

  // R2 Sync Message auto-hide effect (7 seconds)
  useEffect(() => {
    if (r2SyncMessage) {
      const timer = setTimeout(() => {
        setR2SyncMessage(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [r2SyncMessage]);

  return {
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
  };
}
