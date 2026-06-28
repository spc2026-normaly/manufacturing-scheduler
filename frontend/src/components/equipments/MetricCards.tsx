import React from "react";
import styles from "./MetricCards.module.css";

interface Metric {
  title: string;
  value: string;
  unit: string;
}

interface MetricCardsProps {
  metrics: Metric[];
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const getIcon = (title: string) => {
    switch (title) {
      case "전체 장비":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        );
      case "사용 가능 장비 수":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case "점검 예정 장비":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCardStyle = (title: string) => {
    switch (title) {
      case "전체 장비":
        return styles.cardBlue;
      case "사용 가능 장비 수":
        return styles.cardGreen;
      case "점검 예정 장비":
        return styles.cardOrange;
      default:
        return "";
    }
  };

  return (
    <div className={styles.eqMetricsGrid}>
      {metrics.map((metric) => (
        <div key={metric.title} className={`${styles.eqMetricCard} ${getCardStyle(metric.title)}`}>
          <div className={styles.cardHeader}>
            <div className={styles.eqMetricTitle}>{metric.title}</div>
            <div className={styles.iconWrapper}>{getIcon(metric.title)}</div>
          </div>
          <div className={styles.eqMetricValueWrapper}>
            {metric.title === "전체 장비" && <span className={styles.eqMetricPrefix}>총</span>}
            <span className={styles.eqMetricValue}>{metric.value}</span>
            <span className={styles.eqMetricUnit}>{metric.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
