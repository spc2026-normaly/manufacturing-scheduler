import React from "react";
import styles from "./BottomWidgets.module.css";

interface BottomWidgetsProps {
  upcomingList: Array<{ name: string; dday: string; urgent: boolean }>;
  triggerToast: (msg: string) => void;
}

export function BottomWidgets({ upcomingList, triggerToast }: BottomWidgetsProps) {
  return (
    <div className={styles.bottomWidgetsRow}>
      {/* Bottom Left: 최근 업로드 문서 */}
      <div className={styles.widgetCard}>
        <div className={styles.widgetHeader}>
          <h3>최근 업로드 문서</h3>
          <span className={`${styles.widgetBadge} ${styles.purple}`}>임베딩 동기화됨</span>
        </div>
        <div className={styles.widgetDivider}></div>
        <div className={styles.documentsList}>
          {[
            { name: "안전교육_2024_05.csv", size: "2.1 MB", ext: "CSV", date: "2024.05.19" },
            { name: "설비점검_리스트.xlsx", size: "1.4 MB", ext: "XLSX", date: "2024.05.18" },
            { name: "작업수칙_가이드.pdf", size: "3.7 MB", ext: "PDF", date: "2024.05.17" },
            { name: "위험성평가_표준.txt", size: "0.8 MB", ext: "TXT", date: "2024.05.16" }
          ].map((doc, idx) => (
            <div key={idx} className={styles.docRowItem}>
              <div className={styles.docIconTitle}>
                <span className={styles.docIcon}>📄</span>
                <div className={styles.docInfoTexts}>
                  <span className={styles.docFileName}>{doc.name}</span>
                  <span className={styles.docMetaSub}>{doc.date} | {doc.size}</span>
                </div>
              </div>
              <div className={styles.docActions}>
                <span className={styles.docExtBadge}>{doc.ext}</span>
                <button 
                  className={styles.docDownloadBtn} 
                  onClick={() => triggerToast(`'${doc.name}' 다운로드 요청됨`)}
                  title="다운로드"
                >
                  📥
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Right: 점검일이 다가오는 설비 */}
      <div className={styles.widgetCard}>
        <div className={styles.widgetHeader}>
          <h3>점검일이 다가오는 설비</h3>
          <span className={`${styles.widgetBadge} ${styles.orange}`}>긴급 점검 대상</span>
        </div>
        <div className={styles.widgetDivider}></div>
        <div className={styles.equipmentsList}>
          {upcomingList.length > 0 ? (
            upcomingList.map((eq, idx) => (
              <div key={idx} className={styles.eqRowItem}>
                <div className={styles.eqInfo}>
                  <span className={styles.eqIcon}>⚙️</span>
                  <div className={styles.eqInfoTexts}>
                    <span className={styles.eqNameText}>{eq.name}</span>
                    <span className={styles.eqDateSub}>정기 안전 진단 점검 예정</span>
                  </div>
                </div>
                <span className={`${styles.eqStatusBadge} ${eq.urgent ? styles.urgent : styles.normal}`}>
                  {eq.dday}
                </span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", padding: "20px 0", textAlign: "center" }}>
              일주일 이내 점검 예정 장비가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
