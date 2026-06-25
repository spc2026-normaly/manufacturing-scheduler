import React from "react";
import { UpcomingEquipment } from "../../types/equipment";
import styles from "./UpcomingEquipmentPanel.module.css";

interface UpcomingEquipmentPanelProps {
  upcomingEquipments: UpcomingEquipment[];
}

export function UpcomingEquipmentPanel({ upcomingEquipments }: UpcomingEquipmentPanelProps) {
  return (
    <div className={styles.eqAlarmCard}>
      <div className={styles.eqAlarmTitle}>점검일이 다가오는 장비</div>
      <div className={styles.eqAlarmList}>
        {upcomingEquipments.length > 0 ? (
          upcomingEquipments.map((eq, idx) => (
            <div key={idx}>
              <div className={styles.eqAlarmItem}>
                <div>
                  <span className={styles.eqAlarmMeta}>장비명: </span>
                  <span className={styles.eqAlarmValue}>{eq.eq_name}</span>
                </div>
                <div>
                  <span className={styles.eqAlarmMeta}>점검날짜: </span>
                  <span className={styles.eqAlarmValue} style={{ color: "#c5221f" }}>
                    {eq.check_date.replace(/-/g, ".")} ({eq.dday})
                  </span>
                </div>
              </div>
              {idx < upcomingEquipments.length - 1 && <hr className={styles.eqDivider} />}
            </div>
          ))
        ) : (
          <div style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", textAlign: "center", padding: "10px 0" }}>
            7일 이내 점검 예정 장비가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
