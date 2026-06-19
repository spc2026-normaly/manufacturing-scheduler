"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useToast } from "../AppLayout";

// ─── Interfaces & Types ─────────────────────────────────────
type TabType = "month" | "week" | "day";

<<<<<<< HEAD
interface ProductionTask {
  facility: string;
  taskName: string;
=======
interface MonthWeek {
  label: string;
  range: string;
  monday: Date;
  sunday: Date;
}

interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
}

interface ProductionTask {
  id: string;
  facility: string;
  taskName: string;
  taskType: string;
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
  equipment: string;
  workers: string[];
  product: string;
  colorClass: string;
<<<<<<< HEAD
=======
  startDate: Date;
  endDate: Date;
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
  // Monthly Gantt positioning: week index of month (0 = Week 1, 4 = Week 5)
  startWeek: number; 
  endWeek: number;
}

<<<<<<< HEAD
// ─── Mock Schedule Dataset ───────────────────────────────────
// Adjusted tasks to span weekly ranges for Monthly Gantt View
const MOCK_TASKS: ProductionTask[] = [
  // A공장동
  { facility: "A공장동", taskName: "밀링가공", equipment: "밀링머신 #01", product: "FLANGE-A 가공", workers: ["김철수", "이영수", "박지민"], colorClass: "bar-blue", startWeek: 0, endWeek: 1 },
  { facility: "A공장동", taskName: "밀링가공", equipment: "밀링머신 #01", product: "BRACKET-B 가공", workers: ["이영희", "박진우"], colorClass: "bar-blue", startWeek: 3, endWeek: 4 },
  { facility: "A공장동", taskName: "선반가공", equipment: "CNC선반 #02", product: "SHAFT-C 선반", workers: ["박민수"], colorClass: "bar-blue", startWeek: 1, endWeek: 2 },
  { facility: "A공장동", taskName: "선반가공", equipment: "CNC선반 #02", product: "BOLT-D 선반", workers: ["최지훈"], colorClass: "bar-blue", startWeek: 3, endWeek: 4 },
  { facility: "A공장동", taskName: "조립", equipment: "조립라인 #A", product: "PUMP-100 조립", workers: ["정수현", "김도현", "이선우", "최지아"], colorClass: "bar-green", startWeek: 1, endWeek: 2 },
  { facility: "A공장동", taskName: "조립", equipment: "조립라인 #A", product: "VALVE-200 조립", workers: ["이서연", "임민재", "한우현"], colorClass: "bar-green", startWeek: 3, endWeek: 4 },
  { facility: "A공장동", taskName: "검사", equipment: "3차원측정기 #01", product: "FLANGE-A 검사", workers: ["박준호"], colorClass: "bar-purple", startWeek: 1, endWeek: 2 },
  { facility: "A공장동", taskName: "검사", equipment: "3차원측정기 #01", product: "PUMP-100 검사", workers: ["임지원"], colorClass: "bar-purple", startWeek: 3, endWeek: 4 },
  // B공장동
  { facility: "B공장동", taskName: "절단", equipment: "레이저절단기 #01", product: "PLATE-E 절단", workers: ["김현우"], colorClass: "bar-green", startWeek: 0, endWeek: 2 },
  { facility: "B공장동", taskName: "절단", equipment: "레이저절단기 #01", product: "PLATE-F 절단", workers: ["오세훈"], colorClass: "bar-green", startWeek: 3, endWeek: 4 },
  { facility: "B공장동", taskName: "용접", equipment: "용접로봇 #01", product: "FRAME-G 용접", workers: ["박성우", "최윤재"], colorClass: "bar-green", startWeek: 1, endWeek: 3 },
  { facility: "B공장동", taskName: "용접", equipment: "용접로봇 #01", product: "TANK-H 용접", workers: ["이민수"], colorClass: "bar-green", startWeek: 3, endWeek: 4 },
  { facility: "B공장동", taskName: "도장", equipment: "도장라인 #03", product: "CASE-I 도장", workers: ["김하나"], colorClass: "bar-green", startWeek: 1, endWeek: 3 },
  // C공장동
  { facility: "C공장동", taskName: "금형가공", equipment: "머시닝센터 #01", product: "MOLD-J 가공", workers: ["유재석"], colorClass: "bar-purple", startWeek: 0, endWeek: 1 },
  { facility: "C공장동", taskName: "금형가공", equipment: "머시닝센터 #01", product: "MOLD-K 가공", workers: ["강동원"], colorClass: "bar-purple", startWeek: 3, endWeek: 4 },
  { facility: "C공장동", taskName: "사출", equipment: "사출성형기 #01", product: "PRODUCT-L 사출", workers: ["손예진"], colorClass: "bar-pink", startWeek: 1, endWeek: 3 },
  { facility: "C공장동", taskName: "사출", equipment: "사출성형기 #01", product: "PRODUCT-M 사출", workers: ["송혜교"], colorClass: "bar-pink", startWeek: 4, endWeek: 4 }
];
=======
interface CalendarScheduleDto {
  id: string;
  facility: string;
  task_name: string;
  task_type: string;
  equipment: string;
  workers: string[];
  product: string;
  order_num: string;
  start_date: string;
  end_date: string;
}

const TASK_TYPE_COLOR_MAP: Record<string, string> = {
  공정: "bar-blue",
  테스트: "bar-green",
};

const toColorClass = (taskType: string) => TASK_TYPE_COLOR_MAP[taskType] ?? "bar-purple";

const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c

export default function SchedulesPage() {
  const showToast = useToast();
  
  // ─── States ─────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<TabType>("week");
<<<<<<< HEAD
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-06-18")); // default to June 18th, 2026
  const [hoveredTask, setHoveredTask] = useState<ProductionTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
=======
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-07-01"));
  const [hoveredTask, setHoveredTask] = useState<ProductionTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [factoryFilter, setFactoryFilter] = useState<string>("전체");
  const [orderNumFilter, setOrderNumFilter] = useState<string>("");
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c

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

  // ─── Gantt Weekly/Monthly calculations ──────────────────────
  // Generate week ranges of the selected month
  const monthWeeks = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
<<<<<<< HEAD
    const weeks = [];
=======
    const weeks: MonthWeek[] = [];
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
    const firstDay = new Date(year, month, 1);
    
    // Find the Monday of the week containing firstDay
    let day = firstDay.getDay();
    let diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
    let startOfWeek = new Date(firstDay.setDate(diff));
    
<<<<<<< HEAD
    // Generate 5 weeks
    for (let w = 0; w < 5; w++) {
=======
    // Generate 4~6 weeks based on actual calendar boundaries.
    for (let w = 0; w < 6; w++) {
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
      const weekMon = new Date(startOfWeek);
      weekMon.setDate(startOfWeek.getDate() + w * 7);
      
      const weekSun = new Date(weekMon);
      weekSun.setDate(weekMon.getDate() + 6);
      
      weeks.push({
        label: `${w + 1}주차`,
        range: `${weekMon.getMonth() + 1}.${weekMon.getDate()} - ${weekSun.getMonth() + 1}.${weekSun.getDate()}`,
        monday: weekMon,
        sunday: weekSun
      });
<<<<<<< HEAD
=======

      const isAfterMonth = weekMon.getMonth() !== month && weekSun.getMonth() !== month;
      if (isAfterMonth) {
        weeks.pop();
        break;
      }
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
    }
    return weeks;
  }, [selectedDate]);

  // Find which week index in monthWeeks contains selectedDate
  const currentWeekIndexInMonth = useMemo(() => {
    const time = selectedDate.getTime();
    return monthWeeks.findIndex(
      (w) => time >= w.monday.getTime() && time <= w.sunday.getTime() + 86400000
    );
  }, [selectedDate, monthWeeks]);

  // ─── Monthly Grid calculations ──────────────────────────────
  // Generate calendar days for the selected month
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();

<<<<<<< HEAD
    const days = [];
=======
    const days: CalendarCell[] = [];
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
    // Pad previous month days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const padCount = startOffset === 0 ? 6 : startOffset - 1; // Mon=1
    for (let i = padCount - 1; i >= 0; i--) {
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

  // Filter only the 7 days of the selected week for the Weekly calendar view (Single Row)
  const weeklyCalendarDays = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);

    const weekMonTime = mon.getTime();
    const weekSunTime = weekMonTime + 6 * 86400000;

    return calendarDays.filter((cell) => {
      const cellTime = cell.date.getTime();
      return cellTime >= weekMonTime && cellTime <= weekSunTime + 3600000;
    });
  }, [selectedDate, calendarDays]);

<<<<<<< HEAD
  // Daily assignments for selected Date (filtered mock data based on current week index)
  const selectedDayTasks = useMemo(() => {
    const time = selectedDate.getTime();
    const weekIdx = monthWeeks.findIndex(
      (w) => time >= w.monday.getTime() && time <= w.sunday.getTime() + 86400000
    );
    if (weekIdx === -1) return [];
    
    return MOCK_TASKS.filter(
      (task) => weekIdx >= task.startWeek && weekIdx <= task.endWeek
    );
  }, [selectedDate, monthWeeks]);
=======
  const weekTasks = useMemo(() => {
    const time = selectedDate.getTime();
    const week = monthWeeks.find(
      (w) => time >= w.monday.getTime() && time <= w.sunday.getTime() + 86400000
    );
    if (!week) return [];

    return tasks.filter((task) => task.startDate <= week.sunday && task.endDate >= week.monday);
  }, [selectedDate, monthWeeks, tasks]);

  // Daily assignments for selected Date
  const selectedDayTasks = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return tasks.filter((task) => task.startDate <= dayEnd && task.endDate >= dayStart);
  }, [selectedDate, tasks]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const params = new URLSearchParams({
          view: currentTab,
          date: toYmd(selectedDate),
        });
        if (factoryFilter !== "전체") {
          params.append("factory", factoryFilter);
        }
        if (orderNumFilter.trim()) {
          params.append("order_num", orderNumFilter.trim());
        }

        const res = await fetch(`/api/schedules/calendar?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`조회 실패: ${res.status}`);
        }

        const data: CalendarScheduleDto[] = await res.json();
        const mapped: ProductionTask[] = data.map((row) => {
          const startDate = new Date(row.start_date);
          const endDate = new Date(row.end_date);

          const startWeek = monthWeeks.findIndex(
            (w) => startDate <= w.sunday && endDate >= w.monday
          );

          let endWeek = -1;
          for (let i = monthWeeks.length - 1; i >= 0; i--) {
            const w = monthWeeks[i];
            if (startDate <= w.sunday && endDate >= w.monday) {
              endWeek = i;
              break;
            }
          }

          return {
            id: row.id,
            facility: row.facility,
            taskName: row.task_name,
            taskType: row.task_type,
            equipment: row.equipment,
            workers: row.workers,
            product: row.product,
            colorClass: toColorClass(row.task_type),
            startDate,
            endDate,
            startWeek: Math.max(startWeek, 0),
            endWeek: Math.max(endWeek, 0),
          };
        });

        setTasks(mapped);
      } catch {
        setTasks([]);
        showToast("캘린더 데이터 조회에 실패했습니다.");
      }
    };

    fetchSchedules();
  }, [currentTab, selectedDate, factoryFilter, orderNumFilter, monthWeeks, showToast]);
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c

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
<<<<<<< HEAD
    setSelectedDate(new Date("2026-06-18")); // default mockup today
    showToast("기준일(2026.06.18)로 이동했습니다.");
=======
    setSelectedDate(new Date("2026-07-01"));
    showToast("기준일(2026.07.01)로 이동했습니다.");
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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

        /* ── 1) Month View (Gantt Chart - Weekly Granularity) ── */
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
          width: 13.5%;
        }
        
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
          right: -6px;
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

        /* ── 2) Week View (Single Row Grid) ── */
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
          grid-auto-rows: 95px;
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
          flex-direction: column;
          gap: 20px;
          padding: 4px 0;
          width: 100%;
        }
        /* Day view top summary bar */
        .day-summary-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          border-radius: 12px;
          padding: 20px 28px;
          color: white;
        }
        .day-summary-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .day-summary-date {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .day-summary-sub {
          font-size: 13px;
          opacity: 0.75;
        }
        .day-summary-stats {
          display: flex;
          gap: 24px;
        }
        .day-stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background-color: rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 10px 20px;
        }
        .day-stat-value {
          font-size: 24px;
          font-weight: 900;
        }
        .day-stat-label {
          font-size: 11px;
          opacity: 0.7;
          white-space: nowrap;
        }
        /* Day navigation row */
        .day-nav-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .day-nav-arrow {
          font-size: 16px;
          background-color: white;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 6px 14px;
          cursor: pointer;
          color: var(--text-main);
          font-weight: 700;
          transition: all 0.15s;
        }
        .day-nav-arrow:hover {
          background-color: #eff6ff;
          border-color: #3b82f6;
          color: #2563eb;
        }
        .day-nav-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main);
          flex: 1;
        }
        /* Task grid */
        .day-tasks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .day-task-card {
          background-color: white;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .day-task-card:hover {
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
          transform: translateY(-2px);
        }
        .day-task-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .day-task-facility-badge {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 3px 8px;
        }
        .day-task-product {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
          line-height: 1.3;
        }
        .day-task-divider {
          height: 1px;
          background-color: #f1f5f9;
          margin: 0;
        }
        .day-task-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted, #64748b);
        }
        .day-task-meta-icon {
          font-size: 13px;
          flex-shrink: 0;
        }
        .day-task-workers-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .day-task-workers-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .day-worker-dot {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
        }
        /* Legacy compat */
        .day-card { display: none; }
        .day-card-header { display: none; }
        .day-card-body { display: none; }
        .day-body-date { display: none; }
        .day-body-facility { display: none; }
        .day-task-item { display: none; }
        .day-task-meta { display: none; }
      `}</style>

      {/* ── Header tab navigation ── */}
      <div className="sched-header">
        <div className="sched-tabs">
          <button className={`sched-tab ${currentTab === "month" ? "active" : ""}`} onClick={() => { setCurrentTab("month"); handleGoToday(); }}>월간</button>
          <button className={`sched-tab ${currentTab === "week" ? "active" : ""}`} onClick={() => setCurrentTab("week")}>주간</button>
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

        {/* ── 1) MONTH VIEW (GANTT CHART - WEEKLY GRANULARITY) ── */}
        {currentTab === "month" && (
          <div>
            <div className="gantt-title-row">
              <span className="gantt-title">생산 일정 캘린더 ({selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월)</span>
              <div className="gantt-filters">
<<<<<<< HEAD
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
=======
                <select
                  className="gantt-select"
                  value={factoryFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFactoryFilter(e.target.value)}
                >
                  <option value="전체">공장 선택 - 전체 공장</option>
                  <option value="A공장동">A공장동</option>
                  <option value="B공장동">B공장동</option>
                  <option value="C공장동">C공장동</option>
                  <option value="D공장동">D공장동</option>
                  <option value="E공장동">E공장동</option>
                  <option value="F공장동">F공장동</option>
                  <option value="G공장동">G공장동</option>
                </select>
                <input
                  className="gantt-select"
                  style={{ minWidth: "180px" }}
                  placeholder="주문번호 필터 (예: PO001)"
                  value={orderNumFilter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderNumFilter(e.target.value)}
                />
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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
                    {monthWeeks.map((week, index) => (
                      <th key={index} className="gantt-header-day">
                        {week.label}
                        <div style={{ fontSize: "10px", fontWeight: "normal", color: "#64748b", marginTop: "2px" }}>
                          ({week.range})
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
<<<<<<< HEAD
                  {["A공장동", "B공장동", "C공장동"].map((facility) => {
                    const facilityTasks = MOCK_TASKS.filter(t => t.facility === facility);
=======
                  {Array.from(new Set(tasks.map((t) => t.facility))).map((facility) => {
                    const facilityTasks = tasks.filter((t) => t.facility === facility);
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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
<<<<<<< HEAD
                          {/* 5 Weeks cells */}
                          {[0, 1, 2, 3, 4].map((weekIndex) => {
=======
                          {monthWeeks.map((_, weekIndex) => {
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
                            const isStart = task.startWeek === weekIndex;
                            const isWithin = weekIndex >= task.startWeek && weekIndex <= task.endWeek;
                            const colSpan = task.endWeek - task.startWeek + 1;

                            if (isWithin && !isStart) {
                              return null;
                            }

                            return (
                              <td
                                key={weekIndex}
                                colSpan={isStart ? colSpan : 1}
                                className="gantt-cell-day"
                              >
                                {weekIndex === currentWeekIndexInMonth && <div className="gantt-today-line"></div>}
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
                                      // Go to the Monday of that week in day tab
                                      setSelectedDate(monthWeeks[weekIndex].monday);
                                      setCurrentTab("day");
                                      showToast(`${monthWeeks[weekIndex].label} 상세 계획으로 이동했습니다.`);
                                    }}
                                  >
<<<<<<< HEAD
                                    {task.product} ({task.workers[0]} 외 {task.workers.length - 1}명)
=======
                                    {task.product} ({task.workers[0] ?? "미배정"} 외 {Math.max(task.workers.length - 1, 0)}명)
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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

        {/* ── 2) WEEK VIEW (CALENDAR GRID - SINGLE ROW) ── */}
        {currentTab === "week" && (
          <div className="month-grid-container">
            {/* Calendar Left */}
            <div>
              <div className="gantt-title-row">
                <span className="gantt-title">
                  {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {currentWeekIndexInMonth + 1}주차 주간 일정
                </span>
              </div>
              
              <div className="month-calendar-header">
                {["월", "화", "수", "목", "금", "토", "일"].map((w, index) => (
                  <span key={w} className={index === 5 ? "sat" : index === 6 ? "sun" : ""}>{w}</span>
                ))}
              </div>

              <div className="month-days-grid" style={{ gridAutoRows: "110px" }}>
                {weeklyCalendarDays.map((day, idx) => {
                  const isSelected = day.date.toDateString() === selectedDate.toDateString();
                  const isCurrentMonth = day.isCurrentMonth;
<<<<<<< HEAD
                  const dayOfWeek = day.date.getDay() === 0 ? 6 : day.date.getDay() - 1; // Mon=0

                  // Calculate mockup badges based on weekday index to simulate allocation
                  const dayBadges = [];
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
=======
                  const cellStart = new Date(day.date);
                  cellStart.setHours(0, 0, 0, 0);
                  const cellEnd = new Date(day.date);
                  cellEnd.setHours(23, 59, 59, 999);

                  const tasksOfDay = weekTasks.filter((task) => task.startDate <= cellEnd && task.endDate >= cellStart);
                  const workersByFacility = new Map<string, Set<string>>();
                  tasksOfDay.forEach((task) => {
                    if (!workersByFacility.has(task.facility)) {
                      workersByFacility.set(task.facility, new Set<string>());
                    }
                    task.workers.forEach((worker) => workersByFacility.get(task.facility)!.add(worker));
                  });

                  const dayBadges = Array.from(workersByFacility.entries())
                    .slice(0, 3)
                    .map(([facilityName, workers], index) => {
                      const badgeClass = ["cell-badge-green", "cell-badge-blue", "cell-badge-orange"][index] ?? "cell-badge-purple";
                      return {
                        label: `${facilityName.replace("공장동", "공장")} ${workers.size}명`,
                        class: badgeClass,
                      };
                    });
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c

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
<<<<<<< HEAD
              <div className="month-panel-subtitle">A동 ({selectedDayTasks.length * 3}명 배치)</div>
=======
              <div className="month-panel-subtitle">
                총 {selectedDayTasks.reduce((acc, t) => acc + t.workers.length, 0)}명 배치
              </div>
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
              
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

            {/* ── Summary Bar ── */}
            <div className="day-summary-bar animate-in">
              <div className="day-summary-left">
                <span className="day-summary-date">
                  {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)})
                </span>
                <span className="day-summary-sub">{getFormattedDate(selectedDate)} 일간 생산 배정 현황</span>
              </div>
              <div className="day-summary-stats">
                <div className="day-stat-box">
                  <span className="day-stat-value">{selectedDayTasks.length}</span>
                  <span className="day-stat-label">작업 공정 수</span>
                </div>
                <div className="day-stat-box">
                  <span className="day-stat-value">{selectedDayTasks.reduce((acc, t) => acc + t.workers.length, 0)}</span>
                  <span className="day-stat-label">배정 작업자 수</span>
                </div>
                <div className="day-stat-box">
                  <span className="day-stat-value">{[...new Set(selectedDayTasks.map(t => t.facility))].length}</span>
                  <span className="day-stat-label">가동 공장동 수</span>
                </div>
              </div>
            </div>

            {/* ── Navigation Row ── */}
            <div className="day-nav-row">
              <button className="day-nav-arrow" onClick={handlePrevDay}>&#8592; 이전날</button>
              <span className="day-nav-title">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)}) 작업 목록
              </span>
              <button className="sched-btn" onClick={handleGoToday}>오늘</button>
              <button className="day-nav-arrow" onClick={handleNextDay}>다음날 &#8594;</button>
            </div>

            {/* ── Task Grid ── */}
            {selectedDayTasks.length > 0 ? (
              <div className="day-tasks-grid">
                {selectedDayTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="day-task-card animate-in"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    <div className="day-task-card-header">
                      <span className="day-task-facility-badge">{task.facility}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600 }}>
                        {task.taskName}
                      </span>
                    </div>
                    <div className="day-task-product">{task.product}</div>
                    <div className="day-task-divider" />
                    <div className="day-task-meta-row">
                      <span className="day-task-meta-icon">⚙️</span>
                      <span>{task.equipment}</span>
                    </div>
                    <div className="day-task-meta-row">
                      <span className="day-task-meta-icon">🏭</span>
                      <span>{task.facility} · {task.taskName} 공정</span>
                    </div>
                    <div className="day-task-workers-title">👷 배정 작업자</div>
                    <div className="day-task-workers-list">
                      {task.workers.map((w, wIdx) => (
                        <span key={wIdx} className="day-worker-dot">{w}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-no-tasks" style={{ padding: "80px 0", textAlign: "center" }}>
                <p style={{ fontSize: "32px", marginBottom: "12px" }}>🔋</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-muted)" }}>해당 날짜에는 배정된 작업 일정이 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Gantt Weekly Hover Tooltip ── */}
      {currentTab === "month" && hoveredTask && (
        <div
          className="gantt-tooltip animate-in"
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
