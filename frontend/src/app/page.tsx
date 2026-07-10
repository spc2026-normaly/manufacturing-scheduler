"use client";

import React from "react";
import { useDashboard } from "../hooks/useDashboard";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { StatsGrid } from "../components/dashboard/StatsGrid";
import { CalendarSection } from "../components/dashboard/CalendarSection";
import { ScheduleDetails } from "../components/dashboard/ScheduleDetails";
import { BottomWidgets } from "../components/dashboard/BottomWidgets";
import styles from "./page.module.css";

export default function DashboardPage() {
  const {
    health,
    selectedDate,
    setSelectedDate,
    calendarView,
    setCalendarView,
    factoryFilter,
    setFactoryFilter,
    calendarTasks,
    toastText,
    triggerToast,
    employeesCount,
    completionRate,
    upcomingCount,
    upcomingList,
    equipments,
    getDateRangeTitle,
    calendarDays,
    selectedDayTasks,
    selectedDayChecks,
    documentsCount,
  } = useDashboard();

  return (
    <div className={`${styles.dashboardContent} animate-in`}>
      {/* ── Page Header ── */}
      <DashboardHeader health={health} />

      {/* ── Row 1: Stats Grid (Real-time API Data) ── */}
      <StatsGrid
        employeesCount={employeesCount}
        completionRate={completionRate}
        upcomingCount={upcomingCount}
        documentsCount={documentsCount}
      />

      {/* ── Row 2: Calendar & Details ── */}
      <div className={styles.calendarDetailRow}>
        {/* Calendar Card (Left) */}
        <CalendarSection
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          calendarView={calendarView}
          setCalendarView={setCalendarView}
          factoryFilter={factoryFilter}
          setFactoryFilter={setFactoryFilter}
          calendarDays={calendarDays}
          calendarTasks={calendarTasks}
          equipments={equipments}
          getDateRangeTitle={getDateRangeTitle}
        />

        {/* Schedule Details Card (Right) */}
        <ScheduleDetails
          selectedDayTasks={selectedDayTasks}
          selectedDayChecks={selectedDayChecks}
          onRefresh={() => triggerToast("배정 현황 갱신 완료")}
        />
      </div>

      {/* ── Row 3: Recent Documents & Equipment Inspections ── */}
      <BottomWidgets
        upcomingList={upcomingList}
        triggerToast={triggerToast}
      />

      {/* ── Page Toast notification ── */}
      {toastText && (
        <div className={styles.pageToast}>
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}
