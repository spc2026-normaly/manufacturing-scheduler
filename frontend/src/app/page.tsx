"use client";

import { useEffect, useState } from "react";

// ─── Interfaces & Types ─────────────────────────────────────
interface HealthData {
  status: string;
  timestamp: string;
  database: string;
  version: string;
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

interface CalendarTask {
  id: string;
  facility: string;
  taskName: string;
  taskType: string;
  equipment: string;
  workers: string[];
  product: string;
  orderNum: string;
  startDate: Date;
  endDate: Date;
}

type CalendarView = "week" | "month";

const toYmd = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const startOfWeekMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeekSunday = (date: Date) => {
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

export default function DashboardPage() {
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

  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
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

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, isCurrentMonth: d.getMonth() === month };
    });
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

  // Fetch API Health & Dashboard data
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          setHealth(await res.json());
        }
      } catch (e) {
        console.error("Backend health check failed:", e);
      }
    };

    const fetchDashboardData = async () => {
      try {
        const headers = getAuthHeaders();

        // 1. Fetch employee total count
        const empRes = await fetch("/api/employees?limit=1", { headers });
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployeesCount(empData.total);
        }

        // 2. Fetch safety training records for completion rate
        const stRes = await fetch("/api/safety-trainings", { headers });
        if (stRes.ok) {
          const stData = await stRes.json();
          if (stData.length > 0) {
            const completed = stData.filter((t: any) => t.training_status === "COMPLETED").length;
            const rate = Math.round((completed / stData.length) * 1000) / 10;
            setCompletionRate(rate);
          }
        }

        // 3. Fetch equipments for upcoming inspections
        const eqRes = await fetch("/api/equipments?upcoming_days=7", { headers });
        if (eqRes.ok) {
          const eqData = await eqRes.json();
          setUpcomingCount(eqData.length);
          
          const mapped = eqData.slice(0, 4).map((item: any) => {
            const today = new Date();
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
    const fetchCalendarSummary = async () => {
      try {
        const params = new URLSearchParams({
          view: calendarView,
          date: toYmd(selectedDate),
        });

        if (factoryFilter !== "전체 공장") {
          params.append("factory", factoryFilter);
        }

        const res = await fetch(`/api/schedules/calendar?${params.toString()}`, {
          headers: getAuthHeaders(),
        });

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

    fetchCalendarSummary();
  }, [calendarView, selectedDate, factoryFilter]);

  const triggerToast = (text: string) => {
    setToastText(text);
    setTimeout(() => {
      setToastText(null);
    }, 2500);
  };

  // Weekday labels
  const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="dashboard-content animate-in">
      {/* ── Page Header ── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">라인 운영 현황</h1>
          <p className="dashboard-subtitle">실시간 작업자 배치도 및 스마트 설비 모니터링</p>
        </div>
        {health && (
          <div className="health-status-badge">
            <span className={`status-dot ${health.database === "connected" ? "online" : "offline"}`}></span>
            <span className="health-text">DB {health.database === "connected" ? "연결 상태 정상" : "연결 유실"}</span>
          </div>
        )}
      </div>

      {/* ── Row 1: Stats Grid (Real-time API Data) ── */}
      <div className="stats-row">
        {/* Card 1: 전체 직원 수 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">전체 직원 수</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-number">{employeesCount}</span>
            <span className="stat-unit">명</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">실시간 연동 완료</span>
          </div>
        </div>

        {/* Card 2: 교육 완료율 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">교육 완료율</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-number">{completionRate}</span>
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">실시간 교육 이수율</span>
          </div>
        </div>

        {/* Card 3: 점검 예정 설비 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">점검 예정 설비</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-number">{upcomingCount}</span>
            <span className="stat-unit">건</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text negative">7일 이내 예정</span>
          </div>
        </div>

        {/* Card 4: 업로드 문서 (문서 관련 항목이므로 목업 유지) */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">업로드 문서</span>
          </div>
          <div className="stat-card-body">
            <span className="stat-number">36</span>
            <span className="stat-unit">개</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text" style={{ color: "var(--text-muted)" }}>전체 문서 수</span>
          </div>
        </div>
      </div>


      {/* ── Row 2: Calendar & Details ── */}
      <div className="calendar-detail-row">
        {/* Calendar Card (Left) */}
        <div className="card calendar-card">
          <div className="calendar-card-header">
            <div className="calendar-nav">
              <span className="calendar-current-month">{getDateRangeTitle()}</span>
              
              {/* Factory Filter Dropdown as seen in mockup */}
              <select 
                className="nav-today-btn" 
                style={{ marginLeft: "14px", paddingRight: "10px" }}
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
              >
                <option value="전체 공장">공장 선택 - 전체 공장</option>
                <option value="A공장동">A공장</option>
                <option value="B공장동">B공장</option>
                <option value="C공장동">C공장</option>
                <option value="D공장동">D공장</option>
                <option value="E공장동">E공장</option>
                <option value="F공장동">F공장</option>
                <option value="G공장동">G공장</option>
              </select>
            </div>
            
            <div className="calendar-view-modes">
              <button className={`mode-btn ${calendarView === "week" ? "active" : ""}`} onClick={() => setCalendarView("week")}>주간</button>
              <button className={`mode-btn ${calendarView === "month" ? "active" : ""}`} onClick={() => setCalendarView("month")}>월간</button>
            </div>
          </div>

          <div className="calendar-weekday-header">
            {WEEKDAYS.map((w) => (
              <span key={w} className={`weekday-label ${w === "토" ? "sat" : w === "일" ? "sun" : ""}`}>
                {w}
              </span>
            ))}
          </div>

          <div className="calendar-days-grid">
            {calendarDays.map((cell) => {
              const cellStart = new Date(cell.date);
              cellStart.setHours(0, 0, 0, 0);
              const cellEnd = new Date(cell.date);
              cellEnd.setHours(23, 59, 59, 999);

              const tasksOfDay = calendarTasks.filter((task) => task.startDate <= cellEnd && task.endDate >= cellStart);
              const hasSchedule = tasksOfDay.length > 0;
              const isSelected = cell.date.toDateString() === selectedDate.toDateString();
              const now = new Date();
              const isToday =
                cell.date.getFullYear() === now.getFullYear() &&
                cell.date.getMonth() === now.getMonth() &&
                cell.date.getDate() === now.getDate();

              const workersByFacility = new Map<string, Set<string>>();
              tasksOfDay.forEach((task) => {
                if (!workersByFacility.has(task.facility)) {
                  workersByFacility.set(task.facility, new Set<string>());
                }
                task.workers.forEach((worker) => workersByFacility.get(task.facility)!.add(worker));
              });

              const dayBadges = Array.from(workersByFacility.entries())
                .sort(([facilityA], [facilityB]) => compareByFacility(facilityA, facilityB))
                .slice(0, 3)
                .map(([facility, workers], idx) => {
                  const colorClass = idx === 0 ? "pill-green" : idx === 1 ? "pill-blue" : "pill-orange";
                  return {
                    text: `${facility.replace("공장동", "공장")} ${workers.size}명`,
                    colorClass,
                  };
                });

              return (
                <div
                  key={toYmd(cell.date)}
                  className={`calendar-day-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${hasSchedule ? "has-data" : ""} ${cell.isCurrentMonth ? "" : "other-month"}`}
                  onClick={() => setSelectedDate(new Date(cell.date))}
                >
                  <div className="day-number-wrapper">
                    <span className="day-number">{cell.date.getDate()}</span>
                    {isToday && <span className="today-dot">오늘</span>}
                  </div>
                  
                  {/* Staff Allocation Mini Pills */}
                  {dayBadges.length > 0 && (
                    <div className="day-pills-list">
                      {dayBadges.map((badge, idx) => (
                        <div key={idx} className={`calendar-staff-pill ${badge.colorClass}`}>
                          <span>{badge.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule Details Card (Right) */}
        <div className="card details-card">
          <div className="details-card-header">
            <h2 className="details-title">
              {toYmd(selectedDate).replace(/-/g, ".")} 작업 세부내용
            </h2>
            <button className="btn-detail-refresh" onClick={() => triggerToast("배정 현황 갱신 완료")}>🔄</button>
          </div>
          <div className="divider"></div>

          <div className="details-assignments-list">
            {selectedDayTasks.length > 0 ? (
              selectedDayTasks.map((task, idx) => (
                <div key={`${task.id}-${idx}`} className="assignment-item animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="assignment-meta">
                    <span className="assignment-role-tag">{task.facility}</span>
                    <span className="assignment-task-name">{task.product} ({task.taskName})</span>
                  </div>
                  <div className="assignment-workers">
                    <span className="workers-label">작업자 이름:</span>
                    <div className="workers-names-list">
                      {task.workers.map((w, wIdx) => (
                        <span key={wIdx} className="worker-name-pill">{w}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-assignments-placeholder">
                <span className="placeholder-icon">🏖️</span>
                <p>해당 일자에는 예정된 공정이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Documents & Equipment Inspections ── */}
      <div className="bottom-widgets-row">
        {/* Bottom Left: 최근 업로드 문서 */}
        <div className="card widget-card">
          <div className="widget-header">
            <h3>최근 업로드 문서</h3>
            <span className="widget-badge purple">임베딩 동기화됨</span>
          </div>
          <div className="widget-divider"></div>
          <div className="documents-list">
            {[
              { name: "안전교육_2024_05.csv", size: "2.1 MB", ext: "CSV", date: "2024.05.19" },
              { name: "설비점검_리스트.xlsx", size: "1.4 MB", ext: "XLSX", date: "2024.05.18" },
              { name: "작업수칙_가이드.pdf", size: "3.7 MB", ext: "PDF", date: "2024.05.17" },
              { name: "위험성평가_표준.txt", size: "0.8 MB", ext: "TXT", date: "2024.05.16" }
            ].map((doc, idx) => (
              <div key={idx} className="doc-row-item">
                <div className="doc-icon-title">
                  <span className="doc-icon">📄</span>
                  <div className="doc-info-texts">
                    <span className="doc-file-name">{doc.name}</span>
                    <span className="doc-meta-sub">{doc.date} | {doc.size}</span>
                  </div>
                </div>
                <div className="doc-actions">
                  <span className="doc-ext-badge">{doc.ext}</span>
                  <button 
                    className="doc-download-btn" 
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
        <div className="card widget-card">
          <div className="widget-header">
            <h3>점검일이 다가오는 설비</h3>
            <span className="widget-badge orange">긴급 점검 대상</span>
          </div>
          <div className="widget-divider"></div>
          <div className="equipments-list">
            {upcomingList.length > 0 ? (
              upcomingList.map((eq, idx) => (
                <div key={idx} className="eq-row-item">
                  <div className="eq-info">
                    <span className="eq-icon">⚙️</span>
                    <div className="eq-info-texts">
                      <span className="eq-name-text">{eq.name}</span>
                      <span className="eq-date-sub">정기 안전 진단 점검 예정</span>
                    </div>
                  </div>
                  <span className={`eq-status-badge ${eq.urgent ? "urgent" : "normal"}`}>
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

      {/* ── Page Toast notification ── */}
      {toastText && (
        <div className="page-toast animate-in">
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}
