import React, { useState } from "react";
import { ProductionTask } from "../../types/schedule";
import styles from "./WorkerRosterView.module.css";

interface WorkerRosterViewProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedWorker: string | null;
  selectedWorkerRoster: { date: Date; tasks: ProductionTask[] }[] | null;
  getDayName: (date: Date) => string;
  allWorkersThisWeek: string[];
  selectedDayTasks: ProductionTask[];
}

export function WorkerRosterView({
  selectedDate,
  setSelectedDate,
  selectedWorker,
  selectedWorkerRoster,
  getDayName,
  allWorkersThisWeek = [],
  selectedDayTasks = [],
}: WorkerRosterViewProps) {
  // ─── States ─────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"timeline" | "summary">("timeline");
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  if (!selectedWorker && allWorkersThisWeek.length === 0) {
    return (
      <div className={`${styles.individualRosterSection} animate-in`} style={{ animationDelay: "0.06s", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
        <p>💡 이번 주에는 일정이 잡힌 작업자가 없습니다.</p>
      </div>
    );
  }

  // ─── Theme Resolver ─────────────────────────────────────────
  const getRosterThemeClass = (facility: string) => {
    const fac = facility.replace("공장동", "");
    switch (fac) {
      case "A": return styles.rosterA;
      case "B": return styles.rosterB;
      case "C": return styles.rosterC;
      case "D": return styles.rosterD;
      case "E": return styles.rosterE;
      case "F": return styles.rosterF;
      case "G": return styles.rosterG;
      default: return styles.rosterD;
    }
  };

  // ─── Time calculation helpers (09:00 - 18:00 is 540 minutes) ───
  const getTimelineBarStyles = (task: ProductionTask, isVertical: boolean = false) => {
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    
    // Base Day constraints (09:00 - 18:00)
    const baseStart = new Date(selectedDate);
    baseStart.setHours(9, 0, 0, 0);
    const baseEnd = new Date(selectedDate);
    baseEnd.setHours(18, 0, 0, 0);

    let startOffsetMin = 0;
    let endOffsetMin = 540;

    if (start.getTime() > baseStart.getTime()) {
      startOffsetMin = (start.getHours() - 9) * 60 + start.getMinutes();
    }
    if (end.getTime() < baseEnd.getTime()) {
      endOffsetMin = (end.getHours() - 9) * 60 + end.getMinutes();
    }

    // Constraints check
    startOffsetMin = Math.max(0, Math.min(540, startOffsetMin));
    endOffsetMin = Math.max(0, Math.min(540, endOffsetMin));

    const offsetPct = (startOffsetMin / 540) * 100;
    const durationPct = Math.max(2, ((endOffsetMin - startOffsetMin) / 540) * 100); // Minimum 2% for visibility

    if (isVertical) {
      return {
        top: `${offsetPct}%`,
        height: `${durationPct}%`,
        left: "4px",
        width: "calc(100% - 8px)"
      };
    } else {
      return {
        left: `${offsetPct}%`,
        width: `${durationPct}%`
      };
    }
  };

  const getFormattedTime = (dateObj: Date) => {
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const mins = String(dateObj.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
  };

  // ─── Handler ───
  const totalTasks = selectedWorkerRoster?.reduce((acc, d) => acc + d.tasks.length, 0) ?? 0;

  return (
    <div className={`${styles.individualRosterSection} animate-in`} style={{ animationDelay: "0.06s" }}>
      {/* ── 뷰 모드 토글 헤더 ── */}
      <div className={styles.rosterSectionHeader}>
        <div className={styles.rosterSectionTitle}>
          <span className={styles.rosterWorkerAvatar}>🛠️</span>
          <strong>작업 현황 분석 및 타임테이블</strong>
        </div>
        <div className={styles.toggleButtonGroup}>
          <button 
            className={`${styles.toggleBtn} ${viewMode === "timeline" ? styles.active : ""}`}
            onClick={() => setViewMode("timeline")}
          >
            📊 시간별 타임라인 (당일)
          </button>
          <button 
            className={`${styles.toggleBtn} ${viewMode === "summary" ? styles.active : ""}`}
            onClick={() => setViewMode("summary")}
          >
            📅 주간 요약 (선택 직원)
          </button>
        </div>
      </div>

      {/* ── VIEW 1: 시간별 리소스 타임라인 (당일) ── */}
      {viewMode === "timeline" && (
        <div className={styles.timelineContainer}>
          <div className={styles.timelineDateHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", alignSelf: "stretch" }}>
            <div className={styles.timelineTitleText}>
              📅 {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)}요일) 작업자 리소스 타임라인
            </div>
            <button 
              className={styles.orientationToggleBtn}
              onClick={() => setOrientation(prev => prev === "horizontal" ? "vertical" : "horizontal")}
            >
              🔄 {orientation === "horizontal" ? "세로축 시간 보기" : "가로축 시간 보기"}
            </button>
          </div>

          {orientation === "horizontal" ? (
            /* 가로축 시간 뷰 */
            <div className={styles.timelineChartWrapper}>
              {/* 시간별 세로 가이드라인 및 라벨 */}
              <div className={styles.timelineGridHeader}>
                <div className={styles.workerLabelColumnPlaceholder}>작업자</div>
                <div className={styles.timelineHoursColumns}>
                  {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((h, i) => (
                    <div key={i} className={styles.hourLabelCell}>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.timelineRowsContainer}>
                {/* 점심시간 영역 안내 (12:00 ~ 13:00) */}
                <div className={styles.lunchTimeOverlay} style={{ left: "33.333%", width: "11.111%" }}>
                  <span className={styles.lunchText}>점심시간</span>
                </div>

                {allWorkersThisWeek.map((workerName, wIdx) => {
                  // 이 작업자에게 배정된 당일 태스크 필터링
                  const workerTasksOnDay = selectedDayTasks.filter((task) =>
                    task.workers.some((w) => w.toLowerCase().includes(workerName.toLowerCase()))
                  );

                  const isSelectedWorker = selectedWorker && workerName.toLowerCase() === selectedWorker.toLowerCase();

                  return (
                    <div key={wIdx} className={`${styles.timelineRow} ${isSelectedWorker ? styles.selectedWorkerRow : ""}`}>
                      <div className={styles.workerNameCol}>
                        <span className={styles.workerMiniAvatar}>{workerName.substring(0, 1)}</span>
                        <span className={styles.workerNameText}>{workerName}</span>
                      </div>

                      <div className={styles.timelineBarArea}>
                        {/* 시간 그리드 실선 표시 */}
                        <div className={styles.rowGridLines}>
                          {Array.from({ length: 9 }).map((_, lineIdx) => (
                            <div key={lineIdx} className={styles.gridLineSegment}></div>
                          ))}
                        </div>

                        {/* 배정된 태스크 바 렌더링 */}
                        {workerTasksOnDay.length > 0 ? (
                          workerTasksOnDay.map((task, tIdx) => {
                            const barStyle = getTimelineBarStyles(task, false);
                            const themeClass = getRosterThemeClass(task.facility);
                            const startTime = getFormattedTime(task.startDate);
                            const endTime = getFormattedTime(task.endDate);

                            return (
                              <div
                                key={tIdx}
                                className={`${styles.timelineTaskBar} ${themeClass}`}
                                style={barStyle}
                              >
                                <div className={styles.timelineTaskBarInner}>
                                  <span className={styles.barFactoryBadge}>{task.facility}</span>
                                  <span className={styles.barTaskNameText}>{task.taskName}</span>
                                </div>

                                {/* 커스텀 호버 툴팁 */}
                                <div className={styles.timelineBarTooltip}>
                                  <strong>{task.product} ({task.orderNum})</strong>
                                  <div>공장: {task.facility}</div>
                                  <div>공정: {task.taskName} ({task.equipment})</div>
                                  <div>시간: {startTime} ~ {endTime}</div>
                                  <div>담당: {task.workers.join(", ")}</div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <span className={styles.timelineIdleText}>대기중 (Idle)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 세로축 시간 뷰 */
            <div className={styles.verticalTimelineWrapper}>
              {/* X축 헤더 (작업자 목록) */}
              <div className={styles.verticalTimelineXHeader}>
                <div className={styles.verticalTimeColPlaceholder}>시간</div>
                <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
                  {allWorkersThisWeek.map((workerName, wIdx) => {
                    const isSelectedWorker = selectedWorker && workerName.toLowerCase() === selectedWorker.toLowerCase();
                    return (
                      <div key={wIdx} className={`${styles.verticalWorkerHeaderCell} ${isSelectedWorker ? styles.selectedWorkerHeader : ""}`}>
                        <span className={styles.workerMiniAvatar}>{workerName.substring(0, 1)}</span>
                        <strong>{workerName}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Y축 그리드 바디 */}
              <div className={styles.verticalTimelineBody}>
                {/* Y축 시간 레이블 */}
                <div className={styles.verticalTimeLabelsCol}>
                  {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((h, i) => (
                    <div key={i} className={styles.verticalHourLabelCell} style={{ top: `${(i / 9) * 100}%` }}>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* 세로 차트 드로잉 영역 */}
                <div className={styles.verticalChartArea}>
                  {/* 점심시간 가로 밴드 */}
                  <div className={styles.lunchTimeVerticalOverlay} style={{ top: "33.333%", height: "11.111%" }}>
                    <span className={styles.lunchTextVertical}>점심시간 (12:00 ~ 13:00)</span>
                  </div>

                  {/* 격자 수평 실선 */}
                  <div className={styles.verticalGridLines}>
                    {Array.from({ length: 10 }).map((_, lineIdx) => (
                      <div key={lineIdx} className={styles.verticalGridLineSegment} style={{ top: `${(lineIdx / 9) * 100}%` }}></div>
                    ))}
                  </div>

                  {/* 작업자별 세로 레일 */}
                  <div style={{ display: "flex", flex: 1, height: "100%", overflowX: "auto" }}>
                    {allWorkersThisWeek.map((workerName, wIdx) => {
                      const workerTasksOnDay = selectedDayTasks.filter((task) =>
                        task.workers.some((w) => w.toLowerCase().includes(workerName.toLowerCase()))
                      );

                      const isSelectedWorker = selectedWorker && workerName.toLowerCase() === selectedWorker.toLowerCase();

                      return (
                        <div key={wIdx} className={`${styles.verticalWorkerColumn} ${isSelectedWorker ? styles.selectedWorkerCol : ""}`}>
                          {workerTasksOnDay.map((task, tIdx) => {
                            const barStyle = getTimelineBarStyles(task, true);
                            const themeClass = getRosterThemeClass(task.facility);
                            const startTime = getFormattedTime(task.startDate);
                            const endTime = getFormattedTime(task.endDate);

                            return (
                              <div
                                key={tIdx}
                                className={`${styles.verticalTaskBar} ${themeClass}`}
                                style={barStyle}
                              >
                                <div className={styles.verticalTaskBarInner}>
                                  <span className={styles.vertFactoryBadge}>{task.facility}</span>
                                  <strong className={styles.vertTaskNameText}>{task.taskName}</strong>
                                  <span className={styles.vertTaskTimeText}>{startTime}~{endTime}</span>
                                </div>

                                {/* 커스텀 호버 툴팁 */}
                                <div className={styles.verticalBarTooltip}>
                                  <strong>{task.product} ({task.orderNum})</strong>
                                  <div>공장: {task.facility}</div>
                                  <div>공정: {task.taskName} ({task.equipment})</div>
                                  <div>시간: {startTime} ~ {endTime}</div>
                                  <div>담당: {task.workers.join(", ")}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: 주간 요약 (기존의 요일별 카드 리스트 뷰) ── */}
      {viewMode === "summary" && (
        <div>
          <div className={styles.individualRosterTitle}>
            <span className={styles.rosterWorkerAvatar}>
              {selectedWorker ? selectedWorker.substring(0, 1) : "👤"}
            </span>
            <strong>{selectedWorker || "선택된 작업자"}</strong>님의 주간 상세 일정 (이번 주 총 {totalTasks}건 배정)
          </div>
          
          <div className={styles.individualRosterGrid}>
            {selectedWorkerRoster?.map((dayInfo, idx) => {
              const isSelected = dayInfo.date.toDateString() === selectedDate.toDateString();
              const dateStr = `${dayInfo.date.getMonth() + 1}/${dayInfo.date.getDate()}`;
              const dayOfWeek = getDayName(dayInfo.date);
              const isSat = dayOfWeek === "토";
              const isSun = dayOfWeek === "일";

              return (
                <div 
                  key={idx} 
                  className={`${styles.individualRosterDay} ${isSelected ? styles.activeDay : ""}`}
                  onClick={() => setSelectedDate(dayInfo.date)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.individualDayHeader}>
                    <span className={`${isSat ? styles.sat : isSun ? styles.sun : ""}`} style={{ fontWeight: "700" }}>{dayOfWeek}요일</span>
                    <span className={styles.dateLbl}>{dateStr}</span>
                  </div>
                  
                  {dayInfo.tasks.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {dayInfo.tasks.map((task, tIdx) => {
                        const themeClass = getRosterThemeClass(task.facility);
                        return (
                          <div key={tIdx} className={`${styles.individualTaskCard} ${themeClass}`}>
                            <span className={styles.individualTaskFactory}>{task.facility}</span>
                            <span className={styles.individualTaskName}>{task.taskName}</span>
                            <span className={styles.individualTaskProduct}>{task.product}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: "14px" }}>
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
