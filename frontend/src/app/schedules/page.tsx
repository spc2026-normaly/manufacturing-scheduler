"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useToast } from "../AppLayout";

// ─── Interfaces & Types ─────────────────────────────────────
type TabType = "month" | "week" | "day";

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
  equipment: string;
  workers: string[];
  product: string;
  orderNum: string;
  colorClass: string;
  startDate: Date;
  endDate: Date;
  // Monthly Gantt positioning: week index of month (0 = Week 1, 4 = Week 5)
  startWeek: number; 
  endWeek: number;
}

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

const getFacilityColorClass = (facility: string) => {
  const fac = facility.replace("공장동", "");
  switch (fac) {
    case "A": return "bar-green";
    case "B": return "bar-blue";
    case "C": return "bar-orange";
    case "D": return "bar-purple";
    case "E": return "bar-teal";
    case "F": return "bar-pink";
    case "G": return "bar-indigo";
    default: return "bar-purple";
  }
};

const getRosterThemeClass = (facility: string) => {
  const fac = facility.replace("공장동", "");
  switch (fac) {
    case "A": return "roster-a";
    case "B": return "roster-b";
    case "C": return "roster-c";
    case "D": return "roster-d";
    case "E": return "roster-e";
    case "F": return "roster-f";
    case "G": return "roster-g";
    default: return "roster-d";
  }
};

const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function SchedulesPage() {
  const showToast = useToast();
  
  // ─── States ─────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<TabType>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-07-01"));
  const [hoveredTask, setHoveredTask] = useState<ProductionTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [factoryFilter, setFactoryFilter] = useState<string>("전체");
  const [orderNumFilter, setOrderNumFilter] = useState<string>("");
  const [summary, setSummary] = useState<{ total: number; factories: Record<string, number> } | null>(null);
  const [ganttGroupBy, setGanttGroupBy] = useState<"facility" | "order">("facility");
  const [ordersList, setOrdersList] = useState<string[]>([]);
  const [workerSearchFilter, setWorkerSearchFilter] = useState<string>("");
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

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
    
    const weeks: MonthWeek[] = [];
    const firstDay = new Date(year, month, 1);
    
    // Find the Monday of the week containing firstDay
    let day = firstDay.getDay();
    let diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
    let startOfWeek = new Date(firstDay.setDate(diff));
    
    // Generate 4~6 weeks based on actual calendar boundaries.
    for (let w = 0; w < 6; w++) {
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

      const isAfterMonth = weekMon.getMonth() !== month && weekSun.getMonth() !== month;
      if (isAfterMonth) {
        weeks.pop();
        break;
      }
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

    const days: CalendarCell[] = [];
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

  // Extract all unique workers for the current week
  const allWorkersThisWeek = useMemo(() => {
    const workersSet = new Set<string>();
    weekTasks.forEach((task) => {
      task.workers.forEach((worker) => {
        if (worker && worker.trim()) {
          workersSet.add(worker.trim());
        }
      });
    });
    return Array.from(workersSet).sort();
  }, [weekTasks]);

  // Auto-select first worker when week changes or selected worker is not scheduled in the current week
  useEffect(() => {
    if (allWorkersThisWeek.length > 0) {
      if (!selectedWorker || !allWorkersThisWeek.includes(selectedWorker)) {
        setSelectedWorker(allWorkersThisWeek[0]);
      }
    } else {
      setSelectedWorker(null);
    }
  }, [allWorkersThisWeek, selectedWorker]);

  // Map the single selected worker to their 7-day schedule for the selected week
  const selectedWorkerRoster = useMemo(() => {
    if (!selectedWorker) return null;
    return weeklyCalendarDays.map((day) => {
      const dayStart = new Date(day.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day.date);
      dayEnd.setHours(23, 59, 59, 999);

      const tasksOnDay = weekTasks.filter(
        (task) =>
          task.workers.includes(selectedWorker) &&
          task.startDate <= dayEnd &&
          task.endDate >= dayStart
      );

      return {
        date: day.date,
        tasks: tasksOnDay,
      };
    });
  }, [selectedWorker, weeklyCalendarDays, weekTasks]);

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
            orderNum: row.order_num,
            colorClass: getFacilityColorClass(row.facility),
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

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const params = new URLSearchParams({
          date: toYmd(selectedDate),
        });
        const res = await fetch(`/api/schedules/summary?${params.toString()}`);
        if (!res.ok) {
          throw new Error("요약 데이터 조회 실패");
        }
        const data = await res.json();
        setSummary(data);
      } catch (e) {
        console.error("Failed to fetch schedules summary", e);
        setSummary(null);
      }
    };

    if (currentTab === "month") {
      fetchSummary();
    }
  }, [selectedDate, currentTab]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const data = await res.json();
          const nums = data.map((o: any) => o.order_num);
          setOrdersList(nums);
        }
      } catch (e) {
        console.error("Failed to fetch orders", e);
      }
    };
    fetchOrders();
  }, []);

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
    setSelectedDate(new Date("2026-07-01"));
    showToast("기준일(2026.07.01)로 이동했습니다.");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = document.querySelector(".sched-container");
    if (container) {
      const rect = container.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    } else {
      setTooltipPos({
        x: e.clientX + 15,
        y: e.clientY + 15
      });
    }
  };

  return (
    <div className="sched-container animate-in">
      <style>{`
        .sched-container {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
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
        .sched-btn, .sched-date-picker {
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
        .sched-btn:hover, .sched-date-picker:hover, .sched-date-picker:focus {
          background-color: #f8fafc;
          border-color: #3b82f6;
        }
        .sched-date-picker {
          outline: none;
          font-family: inherit;
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

        /* ── Month View Summary Stats ── */
        .sched-stats-bar {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 1200px) {
          .sched-stats-bar {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 640px) {
          .sched-stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .stat-widget {
          background-color: #ffffff;
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          padding: 12px 10px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .stat-widget:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          border-color: #cbd5e1;
        }
        .stat-widget-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .stat-widget-value {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
        }
        .stat-widget-value span {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #64748b);
          margin-left: 2px;
        }
        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .dot-total { background-color: #64748b; }
        .dot-a { background-color: #16a34a; }
        .dot-b { background-color: #2563eb; }
        .dot-c { background-color: #ea580c; }
        .dot-d { background-color: #9333ea; }
        .dot-e { background-color: #0d9488; }
        .dot-f { background-color: #db2777; }
        .dot-g { background-color: #4f46e5; }

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
          padding-top: 12px;
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
          padding-top: 16px;
          padding-bottom: 10px;
          height: 52px;
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
        .current-week-header {
          background-color: #eff6ff !important;
          border-bottom: 2px solid #2563eb !important;
        }
        .current-week-badge {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #2563eb;
          color: white;
          font-size: 8px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 20px;
          box-shadow: 0 2px 4px rgba(37,99,235,0.2);
          white-space: nowrap;
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
        .bar-orange { background-color: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
        .bar-teal { background-color: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }
        .bar-indigo { background-color: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }

        /* Gantt Tooltip */
        .gantt-tooltip {
          position: absolute;
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
          font-size: 10.5px;
          font-weight: 700;
          padding: 4px 6px;
          border-radius: 4px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
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

        /* Roster Table Styles */
        .roster-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .roster-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
          padding: 10px 14px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12px;
          color: #475569;
        }
        .roster-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .roster-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .roster-table-container {
          overflow-x: auto;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .roster-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
          table-layout: fixed;
        }
        .roster-table th, .roster-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 10px;
          font-size: 13px;
        }
        .roster-table th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #475569;
          text-align: center;
          border-top: none;
        }
        .roster-table th.roster-worker-col {
          width: 160px;
          text-align: left;
          padding-left: 16px;
        }
        .roster-table td.roster-worker-cell {
          font-weight: 700;
          color: #0f172a;
          padding-left: 16px;
          vertical-align: middle;
          background-color: #f8fafc;
          position: sticky;
          left: 0;
          z-index: 2;
          border-right: 2px solid #e2e8f0;
        }
        .roster-worker-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .roster-worker-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
        }
        .roster-worker-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background-color: #e0f2fe;
          color: #0369a1;
          border-radius: 50%;
          font-size: 11px;
          font-weight: 700;
        }
        .roster-worker-count {
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
        }
        .roster-day-cell {
          vertical-align: top;
          height: 100%;
          background-color: white;
          text-align: center;
        }
        .roster-day-cell.selected-day {
          background-color: #eff6ff;
        }
        .roster-empty-cell {
          color: #cbd5e1;
          font-weight: 400;
          font-size: 16px;
          padding: 8px 0;
        }
        .roster-task-badge-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: stretch;
        }
        .roster-task-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.3;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: all 0.15s ease-in-out;
          border-left: 3px solid transparent;
        }
        .roster-task-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0,0,0,0.08);
          filter: brightness(0.97);
        }
        /* Factory Roster Themes */
        .roster-a {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #dcfce7;
          border-left: 3px solid #16a34a;
        }
        .roster-b {
          background-color: #eff6ff;
          color: #1e40af;
          border: 1px solid #dbeafe;
          border-left: 3px solid #2563eb;
        }
        .roster-c {
          background-color: #fff7ed;
          color: #9a3412;
          border: 1px solid #ffedd5;
          border-left: 3px solid #ea580c;
        }
        .roster-d {
          background-color: #faf5ff;
          color: #6b21a8;
          border: 1px solid #f3e8ff;
          border-left: 3px solid #9333ea;
        }
        .roster-e {
          background-color: #f0fdfa;
          color: #115e59;
          border: 1px solid #ccfbf1;
          border-left: 3px solid #0d9488;
        }
        .roster-f {
          background-color: #fdf2f8;
          color: #9d174d;
          border: 1px solid #fce7f3;
          border-left: 3px solid #db2777;
        }
        .roster-g {
          background-color: #eef2ff;
          color: #3730a3;
          border: 1px solid #e0e7ff;
          border-left: 3px solid #4f46e5;
        }
        .roster-task-factory {
          font-weight: 700;
          font-size: 10px;
          opacity: 0.85;
          text-transform: uppercase;
        }
        .roster-task-name {
          font-size: 11px;
          margin-top: 1px;
        }
        .roster-task-product {
          font-size: 9.5px;
          opacity: 0.7;
          font-weight: normal;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* Roster Worker Badges inside Calendar Day Cell */
        .roster-worker-badge-btn {
          display: inline-block;
          background-color: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
          width: calc(50% - 4px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .roster-worker-badge-btn:hover {
          background-color: #e2e8f0;
          border-color: #94a3b8;
          color: #0f172a;
        }
        .roster-worker-badge-btn.active {
          background-color: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
          box-shadow: 0 0 0 1px #3b82f6;
        }
        .roster-workers-list-wrapper {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
          overflow-y: auto;
          max-height: 280px;
          padding-right: 2px;
        }

        /* Bottom Selected Worker Schedule */
        .individual-roster-section {
          margin-top: 24px;
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .individual-roster-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .individual-roster-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
        }
        .individual-roster-day {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background-color: #f8fafc;
          min-height: 140px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .individual-roster-day.active-day {
          background-color: #eff6ff;
          border-color: #dbeafe;
        }
        .individual-day-header {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
        }
        .individual-day-header span.date-lbl {
          font-weight: normal;
          color: #94a3b8;
        }
        .individual-task-card {
          padding: 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          border-left: 3px solid transparent;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .individual-task-factory {
          font-size: 10px;
          font-weight: 700;
          display: block;
        }
        .individual-task-name {
          margin-top: 2px;
          display: block;
        }
        .individual-task-product {
          font-size: 9.5px;
          font-weight: normal;
          opacity: 0.8;
          display: block;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      {/* ── Header tab navigation ── */}
      <div className="sched-header">
        <div className="sched-tabs">
          <button className={`sched-tab ${currentTab === "month" ? "active" : ""}`} onClick={() => { setCurrentTab("month"); handleGoToday(); }}>월간</button>
          <button className={`sched-tab ${currentTab === "week" ? "active" : ""}`} onClick={() => setCurrentTab("week")}>주간</button>
          <button className={`sched-tab ${currentTab === "day" ? "active" : ""}`} onClick={() => setCurrentTab("day")}>일간</button>
        </div>

        <div className="sched-controls">
          <input
            type="date"
            className="sched-date-picker"
            value={toYmd(selectedDate)}
            onChange={(e) => {
              if (e.target.value) {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setSelectedDate(new Date(y, m - 1, d));
              }
            }}
          />
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
            {summary && (
              <div className="sched-stats-bar animate-in" style={{ animationDelay: "0.05s" }}>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-total"></span>전체 공정 수
                  </span>
                  <span className="stat-widget-value">{summary.total}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-a"></span>A 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["A공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-b"></span>B 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["B공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-c"></span>C 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["C공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-d"></span>D 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["D공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-e"></span>E 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["E공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-f"></span>F 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["F공장동"] ?? 0}<span>건</span></span>
                </div>
                <div className="stat-widget">
                  <span className="stat-widget-label">
                    <span className="stat-dot dot-g"></span>G 공장
                  </span>
                  <span className="stat-widget-value">{summary.factories["G공장동"] ?? 0}<span>건</span></span>
                </div>
              </div>
            )}

            <div className="gantt-title-row">
              <span className="gantt-title">생산 일정 캘린더 ({selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월)</span>
              <div className="gantt-filters">
                <select
                  className="gantt-select"
                  value={ganttGroupBy}
                  onChange={(e) => setGanttGroupBy(e.target.value as "facility" | "order")}
                  style={{ fontWeight: "bold", borderColor: "#3b82f6", color: "#2563eb" }}
                >
                  <option value="facility">정렬 기준: 공장동별</option>
                  <option value="order">정렬 기준: 주문번호별</option>
                </select>
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
                <select
                  className="gantt-select"
                  style={{ minWidth: "180px" }}
                  value={orderNumFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOrderNumFilter(e.target.value)}
                >
                  <option value="">주문번호 선택 - 전체</option>
                  {ordersList.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                <button className="sched-btn" onClick={() => showToast("캘린더 데이터를 새로고침했습니다.")}>C 새로고침</button>
              </div>
            </div>

            <div className="gantt-wrapper">
              {ganttGroupBy === "facility" ? (
                <table className="gantt-table">
                  <thead>
                    <tr>
                      <th>공장동</th>
                      <th>주문번호</th>
                      <th>생산제품</th>
                      {monthWeeks.map((week, index) => {
                        const isCurrent = index === currentWeekIndexInMonth;
                        return (
                          <th
                            key={index}
                            className={`gantt-header-day ${isCurrent ? "current-week-header" : ""}`}
                            style={{ position: "relative" }}
                          >
                            {isCurrent && <span className="current-week-badge">이번 주</span>}
                            {week.label}
                            <div style={{ fontSize: "10px", fontWeight: "normal", color: isCurrent ? "#2563eb" : "#64748b", marginTop: "2px" }}>
                              ({week.range})
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(tasks.map((t) => t.facility))).map((facility) => {
                      const facilityTasks = tasks.filter((t) => t.facility === facility);
                      const uniqueOrderNums = Array.from(new Set(facilityTasks.map((t) => t.orderNum)));

                      return uniqueOrderNums.map((orderNum, idx) => {
                        const orderTasks = facilityTasks.filter((t) => t.orderNum === orderNum);
                        const productName = orderTasks[0]?.product || "";
                        const isFirstForFacility = idx === 0;

                        return (
                          <tr key={`${facility}_${orderNum}`} className="eq-row">
                            {isFirstForFacility && (
                              <td className="gantt-col-facility" rowSpan={uniqueOrderNums.length}>
                                {facility}
                              </td>
                            )}
                            <td className="gantt-col-task">{orderNum}</td>
                            <td className="gantt-col-eq">{productName}</td>
                            {monthWeeks.map((_, weekIndex) => {
                              const task = orderTasks.find((t) => t.startWeek === weekIndex);
                              const isWithin = orderTasks.some((t) => weekIndex > t.startWeek && weekIndex <= t.endWeek);

                              if (isWithin) {
                                return null;
                              }

                              const colSpan = task ? (task.endWeek - task.startWeek + 1) : 1;

                              return (
                                <td
                                  key={weekIndex}
                                  colSpan={colSpan}
                                  className="gantt-cell-day"
                                >
                                  {task && (
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
                                      {task.taskName}
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
              ) : (
                <table className="gantt-table">
                  <thead>
                    <tr>
                      <th>주문번호</th>
                      <th>생산제품</th>
                      <th>공장동</th>
                      {monthWeeks.map((week, index) => {
                        const isCurrent = index === currentWeekIndexInMonth;
                        return (
                          <th
                            key={index}
                            className={`gantt-header-day ${isCurrent ? "current-week-header" : ""}`}
                            style={{ position: "relative" }}
                          >
                            {isCurrent && <span className="current-week-badge">이번 주</span>}
                            {week.label}
                            <div style={{ fontSize: "10px", fontWeight: "normal", color: isCurrent ? "#2563eb" : "#64748b", marginTop: "2px" }}>
                              ({week.range})
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(tasks.map((t) => t.orderNum))).map((orderNum) => {
                      const orderTasks = tasks.filter((t) => t.orderNum === orderNum);
                      const uniqueFacilities = Array.from(new Set(orderTasks.map((t) => t.facility)));
                      const productName = orderTasks[0]?.product || "";

                      return uniqueFacilities.map((facility, idx) => {
                        const facilityOrderTasks = orderTasks.filter((t) => t.facility === facility);
                        const isFirstForOrder = idx === 0;

                        return (
                          <tr key={`${orderNum}_${facility}`} className="eq-row">
                            {isFirstForOrder && (
                              <>
                                <td className="gantt-col-task" rowSpan={uniqueFacilities.length} style={{ fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                                  {orderNum}
                                </td>
                                <td className="gantt-col-eq" rowSpan={uniqueFacilities.length} style={{ fontWeight: "600", fontSize: "13px" }}>
                                  {productName}
                                </td>
                              </>
                            )}
                            <td className="gantt-col-facility" style={{ color: "#1e3a8a", fontWeight: "700", textAlign: "center", backgroundColor: "#f8fafc" }}>
                              {facility}
                            </td>
                            {monthWeeks.map((_, weekIndex) => {
                              const task = facilityOrderTasks.find((t) => t.startWeek === weekIndex);
                              const isWithin = facilityOrderTasks.some((t) => weekIndex > t.startWeek && weekIndex <= t.endWeek);

                              if (isWithin) {
                                return null;
                              }

                              const colSpan = task ? (task.endWeek - task.startWeek + 1) : 1;

                              return (
                                <td
                                  key={weekIndex}
                                  colSpan={colSpan}
                                  className="gantt-cell-day"
                                >
                                  {task && (
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
                                      {task.taskName}
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
              )}
            </div>
          </div>
        )}

        {/* ── 2) WEEK VIEW (INTERACTIVE DOUBLE-LAYER ROSTER VIEW) ── */}
        {currentTab === "week" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Roster Header and Search */}
            <div className="roster-header-row animate-in" style={{ animationDelay: "0.02s" }}>
              <span className="gantt-title">
                주간 요일별 출근자 ({selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {currentWeekIndexInMonth + 1}주차)
              </span>
              <div className="gantt-filters">
                <input
                  type="text"
                  className="gantt-select"
                  style={{ minWidth: "220px" }}
                  placeholder="작업자 이름 검색..."
                  value={workerSearchFilter}
                  onChange={(e) => setWorkerSearchFilter(e.target.value)}
                />
                {workerSearchFilter && (
                  <button
                    className="sched-btn"
                    onClick={() => setWorkerSearchFilter("")}
                    style={{ padding: "6px 10px" }}
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            {/* Top Section: Week Calendar Grid with Worker buttons */}
            <div className="month-days-grid animate-in" style={{ gridAutoRows: "260px", animationDelay: "0.04s" }}>
              {weeklyCalendarDays.map((day, idx) => {
                const isSelected = day.date.toDateString() === selectedDate.toDateString();
                const isCurrentMonth = day.isCurrentMonth;
                const dayOfWeek = getDayName(day.date);
                
                const cellStart = new Date(day.date);
                cellStart.setHours(0, 0, 0, 0);
                const cellEnd = new Date(day.date);
                cellEnd.setHours(23, 59, 59, 999);

                const tasksOfDay = weekTasks.filter((task) => task.startDate <= cellEnd && task.endDate >= cellStart);
                const workersOfDay = Array.from(new Set(tasksOfDay.flatMap((t) => t.workers).filter(Boolean))).sort();
                
                const filteredWorkersOfDay = workerSearchFilter.trim()
                  ? workersOfDay.filter(w => w.toLowerCase().includes(workerSearchFilter.trim().toLowerCase()))
                  : workersOfDay;

                return (
                  <div
                    key={idx}
                    className={`month-day-cell ${isSelected ? "selected" : ""} ${isCurrentMonth ? "" : "other-month"}`}
                    onClick={() => setSelectedDate(day.date)}
                    style={{ display: "flex", flexDirection: "column", padding: "10px", height: "260px", overflow: "hidden" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="month-day-num" style={{ fontSize: "14px", fontWeight: "700" }}>{day.date.getDate()}</span>
                      <span style={{ fontSize: "12px", color: isSelected ? "#2563eb" : "#64748b", fontWeight: "600" }}>{dayOfWeek}요일</span>
                    </div>
                    
                    <div className="roster-workers-list-wrapper">
                      {filteredWorkersOfDay.length > 0 ? (
                        filteredWorkersOfDay.map((workerName, wIdx) => {
                          const isActive = workerName === selectedWorker;
                          return (
                            <button
                              key={wIdx}
                              className={`roster-worker-badge-btn ${isActive ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorker(workerName);
                              }}
                              title={workerName}
                            >
                              {workerName}
                            </button>
                          );
                        })
                      ) : (
                        <span style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "16px", alignSelf: "center", width: "100%", textAlign: "center" }}>
                          {workersOfDay.length > 0 ? "검색 결과 없음" : "출근자 없음"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Section: Clicked Worker's Detailed Week Timeline */}
            {selectedWorker ? (
              <div className="individual-roster-section animate-in" style={{ animationDelay: "0.06s" }}>
                <div className="individual-roster-title">
                  <span className="roster-worker-avatar" style={{ width: "30px", height: "30px", fontSize: "13px", display: "inline-flex" }}>
                    {selectedWorker.substring(0, 1)}
                  </span>
                  <strong>{selectedWorker}</strong>님의 주간 상세 일정 (이번 주 총 {selectedWorkerRoster?.reduce((acc, d) => acc + d.tasks.length, 0) ?? 0}건 배정)
                </div>
                
                <div className="individual-roster-grid">
                  {selectedWorkerRoster?.map((dayInfo, idx) => {
                    const isSelected = dayInfo.date.toDateString() === selectedDate.toDateString();
                    const dateStr = `${dayInfo.date.getMonth() + 1}/${dayInfo.date.getDate()}`;
                    const dayOfWeek = getDayName(dayInfo.date);
                    const isSat = dayOfWeek === "토";
                    const isSun = dayOfWeek === "일";

                    return (
                      <div 
                        key={idx} 
                        className={`individual-roster-day ${isSelected ? "active-day" : ""}`}
                        onClick={() => setSelectedDate(dayInfo.date)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="individual-day-header">
                          <span className={`${isSat ? "sat" : isSun ? "sun" : ""}`} style={{ fontWeight: "700" }}>{dayOfWeek}요일</span>
                          <span className="date-lbl">{dateStr}</span>
                        </div>
                        
                        {dayInfo.tasks.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {dayInfo.tasks.map((task, tIdx) => {
                              const themeClass = getRosterThemeClass(task.facility);
                              return (
                                <div key={tIdx} className={`individual-task-card roster-task-badge ${themeClass}`}>
                                  <span className="individual-task-factory">{task.facility}</span>
                                  <span className="individual-task-name">{task.taskName}</span>
                                  <span className="individual-task-product">{task.product}</span>
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
            ) : (
              <div className="individual-roster-section animate-in" style={{ animationDelay: "0.06s", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <p>💡 이번 주에는 일정이 잡힌 작업자가 없습니다.</p>
              </div>
            )}
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
                  <span className="day-stat-value">
                    {new Set(selectedDayTasks.flatMap((t) => t.workers).filter(Boolean)).size}
                  </span>
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
              <span className="day-nav-title">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({getDayName(selectedDate)}) 작업 목록
              </span>
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
