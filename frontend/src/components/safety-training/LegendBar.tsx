import React from "react";
import styles from "./LegendBar.module.css";

export function LegendBar() {
  return (
    <div className={styles.stLegend}>
      <div className={styles.stLegendItem}>
        <span className={`${styles.stDot} ${styles.green}`}></span>
        <span>30일 이상</span>
      </div>
      <div className={styles.stLegendItem}>
        <span className={`${styles.stDot} ${styles.yellow}`}></span>
        <span>7~30일</span>
      </div>
      <div className={styles.stLegendItem}>
        <span className={`${styles.stDot} ${styles.red}`}></span>
        <span>7일 이하</span>
      </div>
      <div className={styles.stLegendItem}>
        <span className={`${styles.stDot} ${styles.gray}`}></span>
        <span>만료</span>
      </div>
      <div className={styles.stLegendItem}>
        <span className={`${styles.stDot} ${styles.none}`}></span>
        <span>미완료</span>
      </div>
    </div>
  );
}
