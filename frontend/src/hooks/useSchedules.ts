import { useState, useMemo, useEffect } from "react";
import { TabType, MonthWeek, CalendarCell, ProductionTask, CalendarScheduleDto } from "../types/schedule";
import { useToast } from "../app/AppLayout";
import { fetchSchedulesApi, fetchSummaryApi, fetchOrdersApi } from "../services/scheduleService";

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

const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function useSchedules() {
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

  // ─── Gantt Drag & Drop and Conflict States ───
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    title: string;
    reason: string;
    workers: { emp_id: string; emp_name: string }[];
    onSelect: (empId: string) => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: "",
    reason: "",
    workers: [],
    onSelect: () => {},
    onCancel: () => {}
  });

  const isDirty = useMemo(() => Object.keys(pendingUpdates).length > 0, [pendingUpdates]);

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

  // Generate week ranges of the selected month
  const monthWeeks = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const weeks: MonthWeek[] = [];
    const firstDay = new Date(year, month, 1);
    
    let day = firstDay.getDay();
    let diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
    let startOfWeek = new Date(firstDay.setDate(diff));
    
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

  const currentWeekIndexInMonth = useMemo(() => {
    const time = selectedDate.getTime();
    return monthWeeks.findIndex(
      (w) => time >= w.monday.getTime() && time <= w.sunday.getTime() + 86400000
    );
  }, [selectedDate, monthWeeks]);

  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();

    const days: CalendarCell[] = [];
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const padCount = startOffset === 0 ? 6 : startOffset - 1; // Mon=1
    for (let i = padCount - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthTotalDays - i),
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [selectedDate]);

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

  const selectedDayTasks = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return tasks.filter((task) => task.startDate <= dayEnd && task.endDate >= dayStart);
  }, [selectedDate, tasks]);

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

  useEffect(() => {
    if (allWorkersThisWeek.length > 0) {
      if (!selectedWorker || !allWorkersThisWeek.includes(selectedWorker)) {
        setSelectedWorker(allWorkersThisWeek[0]);
      }
    } else {
      setSelectedWorker(null);
    }
  }, [allWorkersThisWeek, selectedWorker]);

  const selectedWorkerRoster = useMemo(() => {
    if (!selectedWorker) return null;
    return weeklyCalendarDays.map((day) => {
      const dayStart = new Date(day.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day.date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOfWeek = day.date.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      // Weekend is active only if there is at least one task starting or ending on that day of week
      const isActiveWorkday = !isWeekend || tasks.some(
        (t) => t.startDate.getDay() === dayOfWeek || t.endDate.getDay() === dayOfWeek
      );

      const tasksOnDay = isActiveWorkday
        ? weekTasks.filter(
            (task) =>
              task.workers.includes(selectedWorker) &&
              task.startDate <= dayEnd &&
              task.endDate >= dayStart
          )
        : [];

      return {
        date: day.date,
        tasks: tasksOnDay,
      };
    });
  }, [selectedWorker, weeklyCalendarDays, weekTasks, tasks]);

  const loadSchedules = async () => {
    try {
      const res = await fetchSchedulesApi(
        currentTab,
        toYmd(selectedDate),
        factoryFilter,
        orderNumFilter
      );
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

  useEffect(() => {
    loadSchedules();
  }, [currentTab, selectedDate, factoryFilter, orderNumFilter, monthWeeks]);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetchSummaryApi(toYmd(selectedDate));
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
        const res = await fetchOrdersApi();
        if (res.ok) {
          const data = await res.json();
          const nums = Array.from(new Set(data.map((o: any) => o.order_num).filter(Boolean))) as string[];
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
    const container = document.getElementById("gantt-container-root");
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

  const handleMoveTask = async (taskId: string, targetWeekIndex: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const originalStartWeek = task.startWeek;
    const weekDiff = targetWeekIndex - originalStartWeek;
    if (weekDiff === 0) return;
    
    const newStart = new Date(task.startDate);
    newStart.setDate(task.startDate.getDate() + (weekDiff * 7));
    const newEnd = new Date(task.endDate);
    newEnd.setDate(task.endDate.getDate() + (weekDiff * 7));
    
    try {
      const resp = await fetch("/api/schedules/validate-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: taskId,
          new_start: newStart.toISOString(),
          new_end: newEnd.toISOString()
        })
      });
      
      const resData = await resp.json();
      if (resData.success) {
        applyLocalUpdate(taskId, newStart, newEnd, task.workers, weekDiff);
        showToast("📅 일정이 임시 이동되었습니다. 상단의 [변경사항 최종 저장] 버튼을 누르시면 클라우드에 반영됩니다.");
      } else {
        setConflictModal({
          isOpen: true,
          title: "⚠️ 작업자 자격 및 스케줄 충돌 감지",
          reason: resData.reason,
          workers: resData.alternative_workers || [],
          onSelect: (selectedWorkerId: string) => {
            const newWorkers = [selectedWorkerId];
            applyLocalUpdate(taskId, newStart, newEnd, newWorkers, weekDiff);
            showToast("👷 대체 작업자를 배정하여 일정이 임시 배치되었습니다.");
            setConflictModal(prev => ({ ...prev, isOpen: false }));
          },
          onCancel: () => {
            setConflictModal(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    } catch (e) {
      showToast("일정 이동 검증에 실패했습니다.");
    }
  };

  const applyLocalUpdate = (taskId: string, start: Date, end: Date, workers: string[], weekDiff: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          startDate: start,
          endDate: end,
          startWeek: t.startWeek + weekDiff,
          endWeek: t.endWeek + weekDiff,
          workers: workers
        };
      }
      return t;
    }));
    
    setPendingUpdates(prev => ({
      ...prev,
      [taskId]: {
        id: taskId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        workers: workers
      }
    }));
  };

  const handleSaveChanges = async () => {
    try {
      const resp = await fetch("/api/schedules/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: Object.values(pendingUpdates)
        })
      });
      if (resp.ok) {
        showToast("🎉 일정 변경사항이 성공적으로 저장 및 클라우드(R2)에 동기화되었습니다.");
        setPendingUpdates({});
        loadSchedules();
      } else {
        throw new Error("저장 실패");
      }
    } catch (e) {
      showToast("❌ 변경사항 저장에 실패했습니다.");
    }
  };

  return {
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
    calendarDays,
    weeklyCalendarDays,
    weekTasks,
    selectedDayTasks,
    allWorkersThisWeek,
    selectedWorkerRoster,
    handlePrevDay,
    handleNextDay,
    handlePrevWeek,
    handleNextWeek,
    handlePrevMonth,
    handleNextMonth,
    handleGoToday,
    handleMouseMove,
    isDirty,
    pendingUpdates,
    conflictModal,
    setConflictModal,
    handleMoveTask,
    handleSaveChanges,
    refetch: loadSchedules
  };
}
