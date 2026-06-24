import React from "react";
import { DocFile } from "../../types/document";
import styles from "./RecentDocuments.module.css";

interface RecentDocumentsProps {
  documents: DocFile[];
  handleDownload: (doc: DocFile) => void;
}

export function RecentDocuments({ documents, handleDownload }: RecentDocumentsProps) {
  return (
    <div className={styles.docRecentCard}>
      <span className={styles.docCardTitle}>최근 업로드된 문서</span>
      <div className={styles.docRecentList}>
        {documents.slice(0, 4).map((doc) => (
          <div key={doc.file_id} className={styles.docRecentItem} onClick={() => handleDownload(doc)}>
            <div className={styles.docRecentLeft}>
              <span>📄</span>
              <span className={styles.docRecentName}>{doc.file_name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <span className={styles.docExtBadge}>{doc.file_extension.toUpperCase()}</span>
              <button className={styles.docIconBtn} onClick={() => handleDownload(doc)}>📥</button>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p style={{ fontSize: 13, color: "#94a3b8" }}>업로드된 문서가 없습니다.</p>}
      </div>
    </div>
  );
}
