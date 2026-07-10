"use client";

import React from "react";
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
  } = useSchedules();

  return (
    <div id="sched-container-root" className={`${styles.schedContainer} animate-in`}>
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
    </div>
  );
}
