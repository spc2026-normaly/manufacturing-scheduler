import React from "react";
import styles from "./Templates.module.css";

export function Templates() {
  return (
    <div className={styles.docTemplatesCard}>
      <span className={styles.docCardTitle}>템플릿</span>
      <div className={styles.docTemplatesList}>
        <p className={styles.docTemplatesEmptyText}>등록된 템플릿이 없습니다.</p>
      </div>
    </div>
  );
}
