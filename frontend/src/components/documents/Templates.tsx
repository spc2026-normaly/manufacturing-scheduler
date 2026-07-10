import React, { useEffect, useMemo, useState } from "react";
import styles from "./Templates.module.css";
import { fetchTemplates, downloadTemplateUrl, TemplateFileItem } from "../../services/documentService";

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function Templates() {
  const [templates, setTemplates] = useState<TemplateFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasTemplates = useMemo(() => templates.length > 0, [templates]);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchTemplates();
        if (!res.ok) {
          throw new Error(`템플릿 목록 조회 실패 (${res.status})`);
        }
        const data: TemplateFileItem[] = await res.json();
        setTemplates(data);
      } catch (e: any) {
        setError(e?.message || "템플릿 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();

    const handleDataUpdated = () => {
      loadTemplates();
    };
    window.addEventListener("data-updated", handleDataUpdated);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdated);
    };
  }, []);

  const handleDownloadTemplate = async (item: TemplateFileItem) => {
    const url = await downloadTemplateUrl(item.key);
    window.open(url, "_blank");
  };

  return (
    <div className={styles.docTemplatesCard}>
      <span className={styles.docCardTitle}>템플릿</span>
      <div className={styles.docTemplatesList}>
        {loading ? (
          <p className={styles.docTemplatesEmptyText}>템플릿을 불러오는 중...</p>
        ) : error ? (
          <p className={styles.docTemplatesErrorText}>{error}</p>
        ) : !hasTemplates ? (
          <p className={styles.docTemplatesEmptyText}>등록된 템플릿이 없습니다.</p>
        ) : (
          templates.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.docTemplateItem}
              onClick={() => handleDownloadTemplate(item)}
              title={`${item.file_name} 다운로드`}
            >
              <span className={styles.docTemplateFileName}>{item.file_name}</span>
              <span className={styles.docTemplateMeta}>{formatFileSize(item.size)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
