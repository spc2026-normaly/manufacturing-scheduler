import React from "react";
import { UpcomingEquipment } from "../../types/equipment";
import styles from "./UpcomingEquipmentPanel.module.css";

interface UpcomingEquipmentPanelProps {
  upcomingEquipments: UpcomingEquipment[];
}

export function UpcomingEquipmentPanel({ upcomingEquipments }: UpcomingEquipmentPanelProps) {
  // Function to determine badge class based on D-day
  const getDDayBadgeClass = (dday: string) => {
    if (dday.includes("D-0") || dday === "만료") {
      return styles.badgeDanger;
    }
    const days = parseInt(dday.replace("D-", ""), 10);
    if (isNaN(days)) return styles.badgeWarning;
    if (days <= 3) {
      return styles.badgeWarning;
    }
    return styles.badgeInfo;
  };

  return (
    <div className={styles.eqAlarmCard}>
      <div className={styles.eqAlarmHeader}>
        <span className={styles.eqAlarmIcon}>🔔</span>
        <div className={styles.eqAlarmTitle}>점검일이 다가오는 장비</div>
        {upcomingEquipments.length > 0 && (
          <span className={styles.eqAlarmCount}>{upcomingEquipments.length}</span>
        )}
      </div>
      <div className={styles.eqAlarmList}>
        {upcomingEquipments.length > 0 ? (
          upcomingEquipments.map((eq, idx) => (
            <div key={idx} className={styles.eqAlarmItemWrapper}>
              <div className={styles.eqAlarmItem}>
                <div className={styles.eqAlarmLeft}>
                  <div className={styles.eqIconCircle}>🔧</div>
                  <div className={styles.eqInfoContent}>
                    <div className={styles.eqName}>{eq.eq_name}</div>
                    <div className={styles.eqDate}>
                      점검일: {eq.check_date.replace(/-/g, ".")}
                    </div>
                  </div>
                </div>
                <div className={styles.eqAlarmRight}>
                  <span className={`${styles.ddayBadge} ${getDDayBadgeClass(eq.dday)}`}>
                    {eq.dday}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyAlarm}>
            ✨ 7일 이내 점검 예정 장비가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
