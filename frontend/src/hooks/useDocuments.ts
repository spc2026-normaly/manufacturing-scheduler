import { useState, useEffect, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<'file_name' | 'file_created_at' | 'file_size' | 'file_extension' | 'uploader'>('file_created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'file_name' | 'file_created_at' | 'file_size' | 'file_extension' | 'uploader') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedDocuments = useMemo(() => {
    let result = [...documents];

    // Search by file_name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((doc) => doc.file_name.toLowerCase().includes(q));
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === "string") {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          return sortOrder === "asc" ? valA.localeCompare(valB, "ko") : valB.localeCompare(valA, "ko");
        }

        // Numeric or date
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [documents, searchQuery, sortField, sortOrder]);

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

  useEffect(() => {
    const handleDataUpdated = () => {
      console.log("[useDocuments] received 'data-updated' event, reloading documents list...");
      loadDocuments();
    };
    window.addEventListener("data-updated", handleDataUpdated);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdated);
    };
  }, []);

  const addUploadedFile = async (file: File) => {
    console.log("[useDocuments] addUploadedFile started for:", file.name);
    const supportedTypes = ["csv", "xlsx", "pdf", "txt", "docx"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!supportedTypes.includes(ext)) {
      console.log("[useDocuments] Unsupported file extension:", ext);
      showToast("지원하지 않는 파일 형식입니다.");
      return;
    }

    try {
      console.log("[useDocuments] Uploading file...");
      const res = await uploadDocument(file);
      console.log("[useDocuments] Upload response status:", res.status);
      if (res.ok) {
        showToast(`'${file.name}' 파일이 업로드되었습니다.`);
        loadDocuments();
        window.dispatchEvent(new CustomEvent("data-updated"));
      } else {
        showToast("업로드에 실패했습니다.");
      }
    } catch (err) {
      console.error("[useDocuments] Upload error:", err);
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
        window.dispatchEvent(new CustomEvent("data-updated"));
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
        window.dispatchEvent(new CustomEvent("data-updated"));
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
        window.dispatchEvent(new CustomEvent("data-updated"));
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
    documents: filteredAndSortedDocuments,
    dragActive,
    scheduleStatus,
    progress,
    r2SyncMessage,
    r2Syncing,
    searchQuery,
    setSearchQuery,
    sortField,
    sortOrder,
    toggleSort,
    handleDrag,
    handleDrop,
    handleFileChange,
    handleStartSchedule,
    handleSyncR2,
    handleDelete,
    handleDownload,
  };
}
