import React from "react";
import { DocFile } from "../../types/document";
import styles from "./DocumentsTable.module.css";

interface DocumentsTableProps {
  documents: DocFile[];
  handleDownload: (doc: DocFile) => void;
  handleDelete: (doc: DocFile) => void;
}

export function DocumentsTable({ documents, handleDownload, handleDelete }: DocumentsTableProps) {
  const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const formatDate = (dt: string) => dt?.replace("T", " ").substring(0, 16).replace(/-/g, ".") ?? "-";

  return (
    <div className={styles.docTableCard}>
      <div style={{ padding: "20px 24px 12px", fontWeight: 700 }}>내 문서 목록 ({documents.length})</div>
      <div className={styles.docTableWrapper}>
        <table className={styles.docTable}>
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
              <tr key={doc.file_id} className={styles.docRow}>
                <td><span>📄</span> {doc.file_name}</td>
                <td style={{ textTransform: "uppercase", fontSize: 12 }}>{doc.file_extension}</td>
                <td>{formatSize(doc.file_size)}</td>
                <td style={{ color: "#64748b" }}>{formatDate(doc.file_created_at)}</td>
                <td>{doc.uploader}</td>
                <td>
                  <div className={styles.docTableActions}>
                    <button className={styles.docIconBtn} onClick={() => handleDownload(doc)}>📥</button>
                    <button className={`${styles.docIconBtn} ${styles.delete}`} onClick={() => handleDelete(doc)}>🗑️</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className={styles.docEmptyCell}>등록된 문서가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
