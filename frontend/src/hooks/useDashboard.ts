import { useState, useEffect } from "react";
import { HealthData, CalendarTask, CalendarScheduleDto, CalendarView } from "../types/dashboard";
import {
  checkBackendHealth,
  fetchEmployeesCount,
  fetchSafetyTrainings,
  fetchAllEquipments,
  fetchCalendarSummary,
} from "../services/dashboardService";

// Date utilities
export const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const startOfWeekMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfWeekSunday = (date: Date) => {
  const d = startOfWeekMonday(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getFacilityOrder = (facility: string) => {
  const match = facility.trim().match(/^([A-Ga-g])/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  return match[1].toUpperCase().charCodeAt(0) - 65;
};

const compareByFacility = (a: string, b: string) => {
  const orderDiff = getFacilityOrder(a) - getFacilityOrder(b);
  if (orderDiff !== 0) {
    return orderDiff;
  }
  return a.localeCompare(b, "ko");
};

export function useDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [factoryFilter, setFactoryFilter] = useState<string>("전체 공장");
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);

  // Real-time API States
  const [employeesCount, setEmployeesCount] = useState(128); // default mock values
  const [completionRate, setCompletionRate] = useState(86.7);
  const [upcomingCount, setUpcomingCount] = useState(12);
  const [upcomingList, setUpcomingList] = useState<Array<{ name: string; dday: string; urgent: boolean }>>([]);
  const [equipments, setEquipments] = useState<any[]>([]);

  const triggerToast = (text: string) => {
    setToastText(text);
    setTimeout(() => {
      setToastText(null);
    }, 2500);
  };

  const getDateRangeTitle = () => {
    if (calendarView === "week") {
      const weekStart = startOfWeekMonday(selectedDate);
      const weekEnd = endOfWeekSunday(selectedDate);
      return `주간 일정 (${toYmd(weekStart).replace(/-/g, ".")} - ${toYmd(weekEnd).slice(5).replace(/-/g, ".")})`;
    }
    return `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 일정`;
  };

  const calendarDays = (() => {
    if (calendarView === "week") {
      const monday = startOfWeekMonday(selectedDate);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { date: d, isCurrentMonth: true };
      });
    }

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = startOfWeekMonday(firstDay);

    const days = [];
    for (let w = 0; w < 6; w++) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + w * 7);

      // 이번 주 시작일(월요일)이 이미 다음 달로 넘어갔다면 주 생성 중단
      if (w > 0 && weekStart.getMonth() !== month) {
        break;
      }

      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + d);
        days.push({
          date: dayDate,
          isCurrentMonth: dayDate.getMonth() === month,
        });
      }
    }
    return days;
  })();

  const selectedDayTasks = calendarTasks
    .filter((task) => {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      return task.startDate <= dayEnd && task.endDate >= dayStart;
    })
    .sort((a, b) => compareByFacility(a.facility, b.facility));

  const selectedDayChecks = equipments.filter((eq) => {
    if (!eq.check_date) return false;
    const checkDate = new Date(eq.check_date);
    checkDate.setHours(0, 0, 0, 0);
    
    const selDate = new Date(selectedDate);
    selDate.setHours(0, 0, 0, 0);
    
    return checkDate.getTime() === selDate.getTime();
  });

  // Fetch API Health & Dashboard data
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await checkBackendHealth();
        if (res.ok) {
          setHealth(await res.json());
        }
      } catch (e) {
        console.error("Backend health check failed:", e);
      }
    };

    const fetchDashboardData = async () => {
      try {
        // 1. Fetch employee total count
        const empRes = await fetchEmployeesCount();
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployeesCount(empData.total);
        }

        // 2. Fetch safety training records for completion rate
        const stRes = await fetchSafetyTrainings();
        if (stRes.ok) {
          const stData = await stRes.json();
          if (stData.length > 0) {
            const completed = stData.filter((t: any) => t.training_status === "COMPLETED").length;
            const rate = Math.round((completed / stData.length) * 1000) / 10;
            setCompletionRate(rate);
          }
        }

        // 3. Fetch all equipments
        const eqRes = await fetchAllEquipments();
        if (eqRes.ok) {
          const allEquipments = await eqRes.json();
          setEquipments(allEquipments);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const deadline = new Date(today);
          deadline.setDate(today.getDate() + 7);
          deadline.setHours(23, 59, 59, 999);
          
          const upcomingEq = allEquipments.filter((item: any) => {
            if (!item.check_date) return false;
            const checkDate = new Date(item.check_date);
            return checkDate >= today && checkDate <= deadline;
          });
          
          setUpcomingCount(upcomingEq.length);
          
          const mapped = upcomingEq.slice(0, 4).map((item: any) => {
            const target = new Date(item.check_date);
            const diffTime = target.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
              name: `${item.eq_name} (${item.eq_status})`,
              dday: diffDays >= 0 ? `D-${diffDays}` : "만료",
              urgent: diffDays <= 3
            };
          });
          setUpcomingList(mapped);
        }

      } catch (err) {
        console.error("Failed to load dashboard data from backend", err);
      }
    };

    checkHealth();
    fetchDashboardData();
    const id = setInterval(checkHealth, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await fetchCalendarSummary(
          calendarView,
          toYmd(selectedDate),
          factoryFilter
        );

        if (!res.ok) {
          throw new Error(`calendar fetch failed: ${res.status}`);
        }

        const data: CalendarScheduleDto[] = await res.json();
        const mapped: CalendarTask[] = data.map((row) => ({
          id: row.id,
          facility: row.facility,
          taskName: row.task_name,
          taskType: row.task_type,
          equipment: row.equipment,
          workers: row.workers ?? [],
          product: row.product,
          orderNum: row.order_num,
          startDate: new Date(row.start_date),
          endDate: new Date(row.end_date),
        }));

        setCalendarTasks(mapped);
      } catch (error) {
        console.error("Failed to load calendar summary data", error);
        setCalendarTasks([]);
      }
    };

    fetchCalendar();
  }, [calendarView, selectedDate, factoryFilter]);

  return {
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
  };
}
