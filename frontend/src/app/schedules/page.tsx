"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useToast } from "../AppLayout";

// ─── Interfaces & Types ─────────────────────────────────────
type TabType = "month" | "week" | "day";

interface ProductionTask {
  facility: string;
  taskName: string;
  equipment: string;
  workers: string[];
  product: string;
  colorClass: string;
  // Weekly Gantt positioning: day of week index (0=Mon, 6=Sun)
  startDay: number; 
  endDay: number;
}

// ─── Mock Schedule Dataset ───────────────────────────────────
const MOCK_TASKS: ProductionTask[] = [
  // A공장동
  { facility: "A공장동", taskName: "밀링가공", equipment: "밀링머신 #01", product: "FLANGE-A 가공", workers: ["김철수", "이영수", "박지민"], colorClass: "bar-blue", startDay: 0, endDay: 2 },
  { facility: "A공장동", taskName: "밀링가공", equipment: "밀링머신 #01", product: "BRACKET-B 가공", workers: ["이영희", "박진우"], colorClass: "bar-blue", startDay: 3, endDay: 4 },
  { facility: "A공장동", taskName: "선반가공", equipment: "CNC선반 #02", product: "SHAFT-C 선반", workers: ["박민수"], colorClass: "bar-blue", startDay: 1, endDay: 3 },
  { facility: "A공장동", taskName: "선반가공", equipment: "CNC선반 #02", product: "BOLT-D 선반", workers: ["최지훈"], colorClass: "bar-blue", startDay: 4, endDay: 6 },
  { facility: "A공장동", taskName: "조립", equipment: "조립라인 #A", product: "PUMP-100 조립", workers: ["정수현", "김도현", "이선우", "최지아"], colorClass: "bar-green", startDay: 1, endDay: 3 },
  { facility: "A공장동", taskName: "조립", equipment: "조립라인 #A", product: "VALVE-200 조립", workers: ["이서연", "임민재", "한우현"], colorClass: "bar-green", startDay: 4, endDay: 6 },
  { facility: "A공장동", taskName: "검사", equipment: "3차원측정기 #01", product: "FLANGE-A 검사", workers: ["박준호"], colorClass: "bar-purple", startDay: 2, endDay: 3 },
  { facility: "A공장동", taskName: "검사", equipment: "3차원측정기 #01", product: "PUMP-100 검사", workers: ["임지원"], colorClass: "bar-purple", startDay: 4, endDay: 5 },
  // B공장동
  { facility: "B공장동", taskName: "절단", equipment: "레이저절단기 #01", product: "PLATE-E 절단", workers: ["김현우"], colorClass: "bar-green", startDay: 0, endDay: 3 },
  { facility: "B공장동", taskName: "절단", equipment: "레이저절단기 #01", product: "PLATE-F 절단", workers: ["오세훈"], colorClass: "bar-green", startDay: 3, endDay: 5 },
  { facility: "B공장동", taskName: "용접", equipment: "용접로봇 #01", product: "FRAME-G 용접", workers: ["박성우", "최윤재"], colorClass: "bar-green", startDay: 1, endDay: 4 },
  { facility: "B공장동", taskName: "용접", equipment: "용접로봇 #01", product: "TANK-H 용접", workers: ["이민수"], colorClass: "bar-green", startDay: 4, endDay: 6 },
  { facility: "B공장동", taskName: "도장", equipment: "도장라인 #03", product: "CASE-I 도장", workers: ["김하나"], colorClass: "bar-green", startDay: 2, endDay: 5 },
  // C공장동
  { facility: "C공장동", taskName: "금형가공", equipment: "머시닝센터 #01", product: "MOLD-J 가공", workers: ["유재석"], colorClass: "bar-purple", startDay: 0, endDay: 2 },
  { facility: "C공장동", taskName: "금형가공", equipment: "머시닝센터 #01", product: "MOLD-K 가공", workers: ["강동원"], colorClass: "bar-purple", startDay: 4, endDay: 6 },
  { facility: "C공장동", taskName: "사출", equipment: "사출성형기 #01", product: "PRODUCT-L 사출", workers: ["손예진"], colorClass: "bar-pink", startDay: 2, endDay: 4 },
  { facility: "C공장동", taskName: "사출", equipment: "사출성형기 #01", product: "PRODUCT-M 사출", workers: ["송혜교"], colorClass: "bar-pink", startDay: 5, endDay: 6 }
];

export default function SchedulesPage() {
  const showToast = useToast();
  
  // ─── States ─────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<TabType>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-06-18")); // default to June 18th, 2026
  const [hoveredTask, setHoveredTask] = useState<ProductionTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Date formatting helpers
  const getFormattedDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  };

  const getDayName = (date: Date) => {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return weekdays[date.getDay()];
  };

  // ─── Weekly Gantt calculations ──────────────────────────────
  // Get start date of the week (Monday)
  const currentWeekMonday = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  }, [selectedDate]);

  // Generate 7 week dates
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const temp = new Date(currentWeekMonday);
      temp.setDate(currentWeekMonday.getDate() + i);
      dates.push(temp);
    }
    return dates;
  }, [currentWeekMonday]);

  // Highlight today's date on Gantt if it falls in the current week
  const todayIndex = useMemo(() => {
    const today = new Date();
    // For mockup consistency, let's also allow selectedDate as the "today cursor"
    // Find index of selectedDate inside the current view week
    const targetDateStr = selectedDate.toDateString();
    return weekDates.findIndex(d => d.toDateString() === targetDateStr);
  }, [selectedDate, weekDates]);

  // ─── Monthly Grid calculations ──────────────────────────────
  // Generate calendar days for the selected month
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Number of days in month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Day of week for first day (0=Sunday, 6=Saturday)
    const startOffset = firstDay.getDay();

    const days = [];
    // Pad previous month days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Pad next month days to make grid square (multiple of 7, up to 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [selectedDate]);

  // Daily assignments for selected Date (filtered mock data)
  const selectedDayTasks = useMemo(() => {
    // We map startDay & endDay of week indexes to simulate daily tasks
    // Let's filter mock tasks based on selected day of the week index (0-6)
    const dayOfWeekIndex = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1; // Mon=0, Sun=6
    return MOCK_TASKS.filter(
      (task) => dayOfWeekIndex >= task.startDay && dayOfWeekIndex <= task.endDay
    );
  }, [selectedDate]);

  // Date Navigation handlers
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date("2026-06-18")); // default mockup today
    showToast("기준일(2026.06.18)로 이동했습니다.");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({
      x: e.clientX + 15,
      y: e.clientY + 15
    });
  };

  return (
    <div className="sched-container animate-in">
      <style>{`
        .sched-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Header Tab Navigation ── */
        .sched-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sched-tabs {
          display: flex;
          background-color: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid var(--border, #cbd5e1);
        }
        .sched-tab {
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          background: none;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          transition: all 0.2s;
        }
        .sched-tab.active {
          background-color: white;
          color: var(--text-main, #0f172a);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .sched-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sched-btn {
          background-color: white;
          border: 1px solid var(--border, #e2e8f0);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main, #334155);
          cursor: pointer;
          transition: all 0.2s;
        }
        .sched-btn:hover {
          background-color: #f8fafc;
        }

        /* ── Content Card ── */
        .sched-card {
          background-color: var(--card-bg, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          padding: 24px;
          min-height: 480px;
          position: relative;
        }

        /* ── 1) Week View (Gantt Chart) ── */
        .gantt-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .gantt-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
        }
        .gantt-filters {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .gantt-select {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border, #cbd5e1);
          font-size: 13px;
          background-color: white;
          color: var(--text-main);
        }

        .gantt-wrapper {
          overflow-x: auto;
          width: 100%;
        }
        .gantt-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }
        .gantt-table th, .gantt-table td {
          border: 1px solid #e2e8f0;
          padding: 10px;
          vertical-align: middle;
        }
        .gantt-table th {
          background-color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted, #475569);
          text-align: center;
        }
        .gantt-header-day {
          width: 9.5%;
        }
        .gantt-header-day.sat { color: #2563eb; }
        .gantt-header-day.sun { color: #dc2626; }
        
        .gantt-col-facility {
          width: 12%;
          font-weight: 700;
          color: #1e3a8a;
          background-color: #f8fafc;
          text-align: center;
        }
        .gantt-col-task {
          width: 10%;
          font-weight: 600;
          font-size: 13px;
        }
        .gantt-col-eq {
          width: 12%;
          font-size: 12px;
          color: var(--text-muted);
        }
        .gantt-cell-day {
          position: relative;
          padding: 0;
          height: 48px;
        }
        .gantt-today-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 2px;
          border-left: 2px dotted #3b82f6;
          z-index: 10;
          pointer-events: none;
        }
        
        /* Gantt Blocks */
        .gantt-block {
          position: absolute;
          top: 6px;
          bottom: 6px;
          left: 6px;
          right: -6px; /* spans columns */
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          cursor: pointer;
          z-index: 5;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: transform 0.1s;
        }
        .gantt-block:hover {
          transform: scaleY(1.04);
        }
        .bar-blue { background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .bar-green { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .bar-purple { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
        .bar-pink { background-color: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }

        /* Gantt Tooltip */
        .gantt-tooltip {
          position: fixed;
          background-color: rgba(15, 23, 42, 0.95);
          color: white;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          z-index: 100;
          pointer-events: none;
          box-shadow: 0 4px 6px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          gap: 4px;
          line-height: 1.4;
        }
        .gantt-tooltip strong {
          color: #38bdf8;
          font-size: 12px;
        }

        /* ── 2) Month View ── */
        .month-grid-container {
          display: grid;
          grid-template-columns: 2fr 1.1fr;
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .month-grid-container {
            grid-template-columns: 1fr;
          }
        }
        
        .month-calendar-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          border-bottom: 1px solid var(--border, #cbd5e1);
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .month-calendar-header span.sat { color: #2563eb; }
        .month-calendar-header span.sun { color: #dc2626; }
        
        .month-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-auto-rows: 90px;
          gap: 4px;
        }
        .month-day-cell {
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .month-day-cell:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
        }
        .month-day-cell.selected {
          border-color: #3b82f6;
          background-color: #eff6ff;
          box-shadow: inset 0 0 0 1px #3b82f6;
        }
        .month-day-cell.other-month {
          opacity: 0.4;
        }
        .month-day-num {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-main, #334155);
        }
        .month-day-cell.selected .month-day-num {
          color: #2563eb;
        }
        
        /* Mini stats badges inside monthly cells */
        .month-cell-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 4px;
          border-radius: 4px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cell-badge-green { background-color: #e6f4ea; color: #137333; }
        .cell-badge-blue { background-color: #e8f0fe; color: #1a73e8; }
        .cell-badge-orange { background-color: #fef7e0; color: #b06000; }
        .cell-badge-purple { background-color: #f3e8ff; color: #6b21a8; }
        .cell-badge-gray { background-color: #f1f3f4; color: #5f6368; }

        /* Right Detail Panel inside Monthly view */
        .month-detail-panel {
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 10px;
          padding: 20px;
          background-color: #fafafa;
          max-height: 570px;
          overflow-y: auto;
        }
        .month-panel-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          margin-bottom: 12px;
        }
        .month-panel-subtitle {
          font-size: 13px;
          font-weight: 600;
          color: #1e3a8a;
          margin-bottom: 16px;
        }
        
        .panel-task-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background-color: white;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid var(--border, #e2e8f0);
          margin-bottom: 10px;
          font-size: 13px;
        }
        .panel-task-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .panel-task-role {
          font-size: 10px;
          font-weight: 800;
          background-color: #f1f5f9;
          color: #475569;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .panel-task-name {
          font-weight: 700;
          color: var(--text-main, #1e293b);
        }
        .panel-task-workers {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }
        .panel-worker-pill {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 11px;
          color: #334155;
        }
        .panel-no-tasks {
          text-align: center;
          padding: 40px 10px;
          color: var(--text-muted);
          font-size: 13px;
        }

        /* ── 3) Day View ── */
        .day-view-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px 0;
        }
        .day-card {
          width: 100%;
          max-width: 440px;
          background-color: white;
          border: 1px solid var(--border, #cbd5e1);
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .day-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background-color: #f8fafc;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .day-nav-arrow {
          font-size: 18px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-main);
          font-weight: bold;
          transition: transform 0.1s;
        }
        .day-nav-arrow:hover {
          transform: scale(1.2);
        }
        .day-header-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-main);
        }
        .day-card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 300px;
        }
        .day-body-date {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-muted);
        }
        .day-body-facility {
          font-size: 15px;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 8px;
        }
        
        .day-task-item {
          border-bottom: 1px dashed var(--border, #cbd5e1);
          padding-bottom: 12px;
          margin-bottom: 4px;
        }
        .day-task-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .day-task-product {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-main);
        }
        .day-task-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .day-task-workers-title {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 6px;
        }
        .day-task-workers-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }
        .day-worker-dot {
          background-color: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
          color: #334155;
        }
      `}</style>

      {/* ── Header tab navigation ── */}
      <div className="sched-header">
        <div className="sched-tabs">
          <button className={`sched-tab ${currentTab === "month" ? "active" : ""}`} onClick={() => setCurrentTab("month")}>월간</button>
          <button className={`sched-tab ${currentTab === "week" ? "active" : ""}`} onClick={() => { setCurrentTab("week"); handleGoToday(); }}>주간</button>
          <button className={`sched-tab ${currentTab === "day" ? "active" : ""}`} onClick={() => setCurrentTab("day")}>일간</button>
        </div>

        <div className="sched-controls">
          {currentTab === "month" && (
            <>
              <button className="sched-btn" onClick={handlePrevMonth}>&lt; 이전달</button>
              <button className="sched-btn" onClick={handleGoToday}>오늘</button>
              <button className="sched-btn" onClick={handleNextMonth}>다음달 &gt;</button>
            </>
          )}
          {currentTab === "week" && (
            <>
              <button className="sched-btn" onClick={handlePrevWeek}>&lt; 이전주</button>
              <button className="sched-btn" onClick={handleGoToday}>오늘</button>
              <button className="sched-btn" onClick={handleNextWeek}>다음주 &gt;</button>
            </>
          )}
          {currentTab === "day" && (
            <>
              <button className="sched-btn" onClick={handlePrevDay}>&lt; 이전날</button>
              <button className="sched-btn" onClick={handleGoToday}>오늘</button>
              <button className="sched-btn" onClick={handleNextDay}>다음날 &gt;</button>
            </>
          )}
        </div>
      </div>

      {/* ── Content Card ── */}
      <div className="sched-card">

        {/* ── 1) WEEK VIEW (GANTT CHART) ── */}
        {currentTab === "week" && (
          <div>
            <div className="gantt-title-row">
              <span className="gantt-title">생산 일정 캘린더 ({getFormattedDate(weekDates[0])} - {getFormattedDate(weekDates[6])})</span>
              <div className="gantt-filters">
                <select className="gantt-select" onChange={(e) => showToast(`공장 필터: ${e.target.value}`)}>
                  <option value="전체">공장 선택 - 전체 공장</option>
                  <option value="A동">A공장동</option>
                  <option value="B동">B공장동</option>
                  <option value="C동">C공장동</option>
                </select>
                <select className="gantt-select" onChange={(e) => showToast(`상태 필터: ${e.target.value}`)}>
                  <option value="전체">납기상태 - 전체</option>
                  <option value="진행중">진행중</option>
                  <option value="대기">대기</option>
                  <option value="완료">완료</option>
                </select>
                <button className="sched-btn" onClick={() => showToast("캘린더 데이터를 새로고침했습니다.")}>C 새로고침</button>
              </div>
            </div>

            <div className="gantt-wrapper">
              <table className="gantt-table">
                <thead>
                  <tr>
                    <th>공장동</th>
                    <th>작업명</th>
                    <th>필요장비</th>
                    {weekDates.map((d, index) => (
                      <th
                        key={index}
                        className={`gantt-header-day ${index === 5 ? "sat" : index === 6 ? "sun" : ""}`}
                      >
                        {d.getDate()}({getDayName(d)})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* We group rows logically by facility */}
                  {["A공장동", "B공장동", "C공장동"].map((facility) => {
                    const facilityTasks = MOCK_TASKS.filter(t => t.facility === facility);
                    return facilityTasks.map((task, idx) => {
                      const isFirstForFacility = idx === 0;
                      return (
                        <tr key={`${task.equipment}_${idx}`} className="eq-row">
                          {isFirstForFacility && (
                            <td className="gantt-col-facility" rowSpan={facilityTasks.length}>
                              {facility}
                            </td>
                          )}
                          <td className="gantt-col-task">{task.taskName}</td>
                          <td className="gantt-col-eq">{task.equipment}</td>
                          {/* 7 Days cells */}
                          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                            const isStart = task.startDay === dayIndex;
                            const isWithin = dayIndex >= task.startDay && dayIndex <= task.endDay;
                            const colSpan = task.endDay - task.startDay + 1;

                            if (isWithin && !isStart) {
                              // Skip rendering cell because it is covered by colSpan from the start cell
                              return null;
                            }

                            return (
                              <td
                                key={dayIndex}
                                colSpan={isStart ? colSpan : 1}
                                className="gantt-cell-day"
                              >
                                {dayIndex === todayIndex && <div className="gantt-today-line"></div>}
                                {isStart && (
                                  <div
                                    className={`gantt-block ${task.colorClass}`}
                                    onMouseEnter={(e) => {
                                      setHoveredTask(task);
                                      handleMouseMove(e);
                                    }}
                                    onMouseMove={handleMouseMove}
                                    onMouseLeave={() => setHoveredTask(null)}
                                    onClick={() => {
                                      setSelectedDate(weekDates[dayIndex]);
                                      setCurrentTab("day");
                                      showToast(`${getFormattedDate(weekDates[dayIndex])} 일간 계획으로 이동했습니다.`);
                                    }}
                                  >
                                    {task.product} ({task.workers[0]} 외 {task.workers.length - 1}명)
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 2) MONTH VIEW ── */}
        {currentTab === "month" && (
          <div className="month-grid-container">
            {/* Calendar Left */}
            <div>
              <div className="gantt-title-row">
                <span className="gantt-title">
                  {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월
                </span>
              </div>
              
              <div className="month-calendar-header">
                {["월", "화", "수", "목", "금", "토", "일"].map((w, index) => (
                  <span key={w} className={index === 5 ? "sat" : index === 6 ? "sun" : ""}>{w}</span>
                ))}
              </div>

              <div className="month-days-grid">
                {calendarDays.map((day, idx) => {
                  const isSelected = day.date.toDateString() === selectedDate.toDateString();
                  const isCurrentMonth = day.isCurrentMonth;
                  const dayOfWeek = day.date.getDay() === 0 ? 6 : day.date.getDay() - 1; // Mon=0

                  // Calculate mockup badges based on weekday index to simulate allocation
                  const dayBadges = [];
                  if (isCurrentMonth) {
                    if (dayOfWeek === 0 || dayOfWeek === 1) {
                      dayBadges.push({ label: "A공장 4명", class: "cell-badge-green" });
                      dayBadges.push({ label: "B공장 3명", class: "cell-badge-blue" });
                    } else if (dayOfWeek === 2 || dayOfWeek === 3) {
                      dayBadges.push({ label: "A공장 5명", class: "cell-badge-green" });
                      dayBadges.push({ label: "C공장 2명", class: "cell-badge-orange" });
                      if (dayOfWeek === 2) dayBadges.push({ label: "D공장 2명", class: "cell-badge-purple" });
                    } else if (dayOfWeek === 4) {
                      dayBadges.push({ label: "A공장 4명", class: "cell-badge-green" });
                      dayBadges.push({ label: "B공장 5명", class: "cell-badge-blue" });
                    } else if (dayOfWeek === 5) {
                      dayBadges.push({ label: "A공장 3명", class: "cell-badge-green" });
                      dayBadges.push({ label: "C공장 2명", class: "cell-badge-orange" });
                      dayBadges.push({ label: "D공장 4명", class: "cell-badge-purple" });
                    } else {
                      dayBadges.push({ label: "A공장 2명", class: "cell-badge-green" });
                      dayBadges.push({ label: "D공장 3명", class: "cell-badge-purple" });
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className={`month-day-cell ${isSelected ? "selected" : ""} ${isCurrentMonth ? "" : "other-month"}`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <span className="month-day-num">{day.date.getDate()}</span>
                      {dayBadges.map((badge, bIdx) => (
                        <div key={bIdx} className={`month-cell-badge ${badge.class}`}>
                          {badge.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail Panel Right */}
            <div className="month-detail-panel animate-in">
              <div className="month-panel-title">{getFormattedDate(selectedDate)} 배정 현황</div>
              <div className="month-panel-subtitle">A동 ({selectedDayTasks.length * 3}명 배치)</div>
              
              <div className="month-detail-tasks-list">
                {selectedDayTasks.length > 0 ? (
                  selectedDayTasks.map((task, idx) => (
                    <div key={idx} className="panel-task-item animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="panel-task-meta">
                        <span className="panel-task-role">{task.facility.substring(0, 4)}</span>
                        <span className="panel-task-name">{task.product}</span>
                      </div>
                      <div className="panel-task-meta" style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>장비: {task.equipment} ({task.taskName})</span>
                      </div>
                      <div className="panel-task-workers">
                        {task.workers.map((w, wIdx) => (
                          <span key={wIdx} className="panel-worker-pill">{w}</span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="panel-no-tasks">
                    <p>☕ 예정된 작업 일정이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 3) DAY VIEW ── */}
        {currentTab === "day" && (
          <div className="day-view-container">
            <div className="day-card animate-in">
              {/* Day navigation header */}
              <div className="day-card-header">
                <button className="day-nav-arrow" onClick={handlePrevDay}>&lt;</button>
                <span className="day-header-title">
                  {selectedDate.getMonth() + 1}/{selectedDate.getDate()} ({getDayName(selectedDate)})
                </span>
                <button className="day-nav-arrow" onClick={handleNextDay}>&gt;</button>
              </div>

              {/* Day body card */}
              <div className="day-card-body">
                <span className="day-body-date">{getFormattedDate(selectedDate)}</span>
                <div className="day-body-facility">A동 ({selectedDayTasks.length * 3}명 배정)</div>
                <hr style={{ border: "none", height: "1px", backgroundColor: "#cbd5e1", margin: "8px 0" }} />

                <div className="day-tasks-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {selectedDayTasks.length > 0 ? (
                    selectedDayTasks.map((task, idx) => (
                      <div key={idx} className="day-task-item animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                        <div className="day-task-product">제품 : {task.product.split(" ")[0]}</div>
                        <div className="day-task-meta">
                          작업명 : {task.taskName} ({task.equipment})
                        </div>
                        <div className="day-task-workers-title">작업자 이름:</div>
                        <div className="day-task-workers-list">
                          {task.workers.map((w, wIdx) => (
                            <span key={wIdx} className="day-worker-dot">{w}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="panel-no-tasks" style={{ padding: "80px 0" }}>
                      <p>🔋 해당 날짜에는 작업 일정이 비어있습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Gantt Weekly Hover Tooltip ── */}
      {currentTab === "week" && hoveredTask && (
        <div
          className="gantt-tooltip animate-in"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <strong>{hoveredTask.product}</strong>
          <span>공장: {hoveredTask.facility}</span>
          <span>작업명: {hoveredTask.taskName} ({hoveredTask.equipment})</span>
          <span>작업 수 : {hoveredTask.workers.length}개 공정</span>
          <span>총 작업시간 : {(hoveredTask.endDay - hoveredTask.startDay + 1) * 8}시간 (1일 8h 기준)</span>
          <span>담당자 : {hoveredTask.workers.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
