import React from "react";
import { DocFile } from "../../types/document";
import styles from "./DocumentsTable.module.css";

interface DocumentsTableProps {
  documents: DocFile[];
  handleDownload: (doc: DocFile) => void;
  handleDelete: (doc: DocFile) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sortField: 'file_name' | 'file_created_at' | 'file_size' | 'file_extension' | 'uploader';
  sortOrder: 'asc' | 'desc';
  toggleSort: (field: 'file_name' | 'file_created_at' | 'file_size' | 'file_extension' | 'uploader') => void;
}

export function DocumentsTable({
  documents,
  handleDownload,
  handleDelete,
  searchQuery,
  setSearchQuery,
  sortField,
  sortOrder,
  toggleSort,
}: DocumentsTableProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const formatDate = (dt: string) => dt?.replace("T", " ").substring(0, 16).replace(/-/g, ".") ?? "-";

  const renderSortableHeader = (
    label: string,
    field: 'file_name' | 'file_created_at' | 'file_size' | 'file_extension' | 'uploader'
  ) => {
    const isActive = sortField === field;
    return (
      <th
        className={styles.sortableHeader}
        onClick={() => toggleSort(field)}
      >
        {label}
        {isActive ? (
          <span className={styles.sortActive}>{sortOrder === "asc" ? "▲" : "▼"}</span>
        ) : (
          <span className={styles.sortIndicator}>⇅</span>
        )}
      </th>
    );
  };

  return (
    <div className={styles.docTableCard}>
      <div className={styles.docTableTopBar}>
        <div className={styles.docTableTitle}>내 문서 목록 ({documents.length})</div>
        <div className={styles.docTableSearchWrapper}>
          <input
            type="text"
            className={styles.docTableSearchInput}
            placeholder="파일명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className={styles.docTableSearchIcon}>🔍</span>
        </div>
      </div>
      <div className={styles.docTableWrapper}>
        <table className={styles.docTable}>
          <thead>
            <tr>
              {renderSortableHeader("파일명", "file_name")}
              {renderSortableHeader("파일 유형", "file_extension")}
              {renderSortableHeader("크기", "file_size")}
              {renderSortableHeader("업로드 날짜", "file_created_at")}
              {renderSortableHeader("업로더", "uploader")}
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
