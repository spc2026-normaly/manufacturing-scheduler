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
  return (
    <div className={styles.eqMetricsGrid}>
      {metrics.map((metric) => (
        <div key={metric.title} className={styles.eqMetricCard}>
          <div className={styles.eqMetricTitle}>{metric.title}</div>
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
