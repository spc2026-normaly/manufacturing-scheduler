"use client";

import React, { useState } from "react";
import { useSchedules } from "../../hooks/useSchedules";
import { ScheduleHeader } from "../../components/schedules/ScheduleHeader";
import { StatsBar } from "../../components/schedules/StatsBar";
import { GanttMonthView } from "../../components/schedules/GanttMonthView";
import { WeeklyCalendarView } from "../../components/schedules/WeeklyCalendarView";
import { WorkerRosterView } from "../../components/schedules/WorkerRosterView";
import { DailyListView } from "../../components/schedules/DailyListView";
import styles from "./page.module.css";
import { useToast } from "../AppLayout";

export default function SchedulesPage() {
  const showToast = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const {
    currentTab,
    setCurrentTab,
    selectedDate,
    setSelectedDate,
    hoveredTask,
    setHoveredTask,
    tooltipPos,
    tasks,
    factoryFilter,
    setFactoryFilter,
    orderNumFilter,
    setOrderNumFilter,
    summary,
    ganttGroupBy,
    setGanttGroupBy,
    ordersList,
    workerSearchFilter,
    setWorkerSearchFilter,
    selectedWorker,
    setSelectedWorker,
    getFormattedDate,
    getDayName,
    monthWeeks,
    currentWeekIndexInMonth,
    weeklyCalendarDays,
    weekTasks,
    selectedDayTasks,
    selectedWorkerRoster,
    allWorkersThisWeek,
    handlePrevDay,
    handleNextDay,
    handlePrevWeek,
    handleNextWeek,
    handlePrevMonth,
    handleNextMonth,
    handleGoToday,
    handleMouseMove,
    isDirty,
    conflictModal,
    handleMoveTask,
    handleSaveChanges,
  } = useSchedules();

  return (
    <div id="gantt-container-root" className={`${styles.schedContainer} animate-in`}>
      {/* ── 변경사항 임시 저장 플로팅 배너 ── */}
      {isDirty && (
        <div className={styles.saveFloatingBanner}>
          <div className={styles.saveBannerText}>
            <span className={styles.saveBannerIcon}>📅</span>
            <span>
              <strong>일정 변경사항이 존재합니다.</strong> 최종 저장 버튼을 눌러야 클라우드 파일과 데이터베이스에 적용됩니다.
            </span>
          </div>
          <button className={styles.saveApplyBtn} onClick={handleSaveChanges}>
            변경사항 최종 저장 (클라우드 동기화)
          </button>
        </div>
      )}

      {/* ── Header tab navigation ── */}
      <ScheduleHeader
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        handlePrevDay={handlePrevDay}
        handleNextDay={handleNextDay}
        handlePrevWeek={handlePrevWeek}
        handleNextWeek={handleNextWeek}
        handlePrevMonth={handlePrevMonth}
        handleNextMonth={handleNextMonth}
        handleGoToday={handleGoToday}
      />

      {/* ── Content Card ── */}
      <div className={styles.schedCard}>
        {/* ── 1) MONTH VIEW (GANTT CHART - WEEKLY GRANULARITY) ── */}
        {currentTab === "month" && (
          <div>
            {summary && <StatsBar summary={summary} />}
            <GanttMonthView
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              setCurrentTab={setCurrentTab}
              tasks={tasks}
              factoryFilter={factoryFilter}
              setFactoryFilter={setFactoryFilter}
              orderNumFilter={orderNumFilter}
              setOrderNumFilter={setOrderNumFilter}
              ganttGroupBy={ganttGroupBy}
              setGanttGroupBy={setGanttGroupBy}
              ordersList={ordersList}
              monthWeeks={monthWeeks}
              currentWeekIndexInMonth={currentWeekIndexInMonth}
              setHoveredTask={setHoveredTask}
              handleMouseMove={handleMouseMove}
              showToast={showToast}
              handleMoveTask={handleMoveTask}
              isEditMode={isEditMode}
              setIsEditMode={setIsEditMode}
            />
          </div>
        )}

        {/* ── 2) WEEK VIEW (INTERACTIVE DOUBLE-LAYER ROSTER VIEW) ── */}
        {currentTab === "week" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <WeeklyCalendarView
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              currentWeekIndexInMonth={currentWeekIndexInMonth}
              workerSearchFilter={workerSearchFilter}
              setWorkerSearchFilter={setWorkerSearchFilter}
              weeklyCalendarDays={weeklyCalendarDays}
              weekTasks={weekTasks}
              selectedWorker={selectedWorker}
              setSelectedWorker={setSelectedWorker}
              getDayName={getDayName}
            />
            <WorkerRosterView
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedWorker={selectedWorker}
              selectedWorkerRoster={selectedWorkerRoster}
              getDayName={getDayName}
              allWorkersThisWeek={allWorkersThisWeek}
              selectedDayTasks={selectedDayTasks}
            />
          </div>
        )}

        {/* ── 3) DAY VIEW ── */}
        {currentTab === "day" && (
          <DailyListView
            selectedDate={selectedDate}
            selectedDayTasks={selectedDayTasks}
            getFormattedDate={getFormattedDate}
            getDayName={getDayName}
          />
        )}
      </div>

      {/* ── Gantt Weekly Hover Tooltip ── */}
      {currentTab === "month" && hoveredTask && (
        <div
          className={`${styles.ganttTooltip} animate-in`}
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <strong>{hoveredTask.product}</strong>
          <span>공장: {hoveredTask.facility}</span>
          <span>작업명: {hoveredTask.taskName} ({hoveredTask.equipment})</span>
          <span>작업 수 : {hoveredTask.workers.length}개 공정</span>
          <span>총 작업시간 : {(hoveredTask.endWeek - hoveredTask.startWeek + 1)}주일 (주 40h 기준)</span>
          <span>담당자 : {hoveredTask.workers.join(", ")}</span>
        </div>
      )}

      {/* ── 자격/중복 충돌 해결 모달 ── */}
      {conflictModal.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{conflictModal.title}</span>
              <button className={styles.modalCloseBtn} onClick={conflictModal.onCancel}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalReasonText}>{conflictModal.reason}</p>
              
              <div className={styles.altWorkersSection}>
                <span className={styles.altSectionTitle}>💡 자격요건을 갖춘 유휴 작업자 추천</span>
                {conflictModal.workers && conflictModal.workers.length > 0 ? (
                  <div className={styles.altWorkersList}>
                    {conflictModal.workers.map((w) => (
                      <button
                        key={w.emp_id}
                        className={styles.altWorkerBtn}
                        onClick={() => conflictModal.onSelect(w.emp_id)}
                      >
                        👤 {w.emp_name} ({w.emp_id.toUpperCase()}) 배정하기
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noWorkersText}>⚠️ 이 시간대에 대체 배정 가능한 유휴 자격 작업자가 없습니다.</p>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={conflictModal.onCancel}>취소 (일정 복구)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
