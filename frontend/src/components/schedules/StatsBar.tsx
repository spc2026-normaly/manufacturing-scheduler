import React from "react";
import styles from "./StatsBar.module.css";

interface StatsBarProps {
  summary: {
    total: number;
    factories: Record<string, number>;
  };
}

export function StatsBar({ summary }: StatsBarProps) {
  return (
    <div className={`${styles.schedStatsBar} animate-in`} style={{ animationDelay: "0.05s" }}>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotTotal}`}></span>전체 공정 수
        </span>
        <span className={styles.statWidgetValue}>
          {summary.total}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotA}`}></span>A 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["A공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotB}`}></span>B 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["B공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotC}`}></span>C 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["C공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotD}`}></span>D 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["D공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotE}`}></span>E 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["E공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotF}`}></span>F 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["F공장동"] ?? 0}<span>건</span>
        </span>
      </div>
      <div className={styles.statWidget}>
        <span className={styles.statWidgetLabel}>
          <span className={`${styles.statDot} ${styles.dotG}`}></span>G 공장
        </span>
        <span className={styles.statWidgetValue}>
          {summary.factories["G공장동"] ?? 0}<span>건</span>
        </span>
      </div>
    </div>
  );
}
