"use client";

import { useEffect, useState } from "react";

// ─── Interfaces & Types ─────────────────────────────────────
interface HealthData {
  status: string;
  timestamp: string;
  database: string;
  version: string;
}

interface WorkerAssignment {
  role: string;
  taskName: string;
  workers: string[];
}

interface DayAssignment {
  dateStr: string;
  facility: string;
  totalWorkers: number;
  assignments: WorkerAssignment[];
  pills: Array<{ label: string; count: number; colorClass: string }>;
}

// ─── Mock Schedule Data for June 2026 ────────────────────────
const MOCK_DAILY_SCHEDULES: Record<number, DayAssignment> = {
  15: {
    dateStr: "2026.06.15",
    facility: "A동",
    totalWorkers: 7,
    pills: [
      { label: "A공장", count: 4, colorClass: "pill-green" },
      { label: "B공장", count: 3, colorClass: "pill-blue" }
    ],
    assignments: [
      { role: "RAM", taskName: "원료 배합 및 반죽믹싱", workers: ["이대리", "박사원"] },
      { role: "RAM", taskName: "반죽 분할 및 발효", workers: ["이대리"] },
      { role: "RAM", taskName: "포장 작업", workers: ["박사원", "임꺽정", "홍길동"] }
    ]
  },
  16: {
    dateStr: "2026.06.16",
    facility: "A동",
    totalWorkers: 7,
    pills: [
      { label: "A공장", count: 5, colorClass: "pill-green" },
      { label: "C공장", count: 2, colorClass: "pill-orange" }
    ],
    assignments: [
      { role: "RAM", taskName: "원료 배합 및 반죽믹싱", workers: ["이대리", "박사원", "김선생"] },
      { role: "RAM", taskName: "반죽 분할 및 발효", workers: ["박사원", "최인턴"] }
    ]
  },
  17: {
    dateStr: "2026.06.17",
    facility: "A동",
    totalWorkers: 11,
    pills: [
      { label: "A공장", count: 6, colorClass: "pill-green" },
      { label: "B공장", count: 3, colorClass: "pill-blue" },
      { label: "D공장", count: 2, colorClass: "pill-purple" }
    ],
    assignments: [
      { role: "RAM", taskName: "원료 배합 및 반죽믹싱", workers: ["이대리", "박사원", "최인턴", "김부장"] },
      { role: "RAM", taskName: "반죽 분할 및 발효", workers: ["이대리", "박사원"] },
      { role: "RAM", taskName: "오븐 베이킹", workers: ["박사원", "홍길동", "임꺽정"] },
      { role: "RAM", taskName: "제품 냉각 및 자동 포장", workers: ["이대리", "김부장"] }
    ]
  },
  18: {
    dateStr: "2026.06.18",
    facility: "A동",
    totalWorkers: 7,
    pills: [
      { label: "A공장", count: 5, colorClass: "pill-green" },
      { label: "C공장", count: 2, colorClass: "pill-orange" }
    ],
    assignments: [
      { role: "RAM", taskName: "원료 배합 및 반죽믹싱", workers: ["이대리", "박사원"] },
      { role: "RAM", taskName: "반죽 분할 및 발효", workers: ["이대리"] },
      { role: "RAM", taskName: "제품 냉각 및 자동 포장", workers: ["박사원", "김부장", "홍길동", "임꺽정"] }
    ]
  },
  19: {
    dateStr: "2026.06.19",
    facility: "A동",
    totalWorkers: 8,
    pills: [
      { label: "A공장", count: 4, colorClass: "pill-green" },
      { label: "B공장", count: 4, colorClass: "pill-blue" }
    ],
    assignments: [
      { role: "RAM", taskName: "원료 배합 및 반죽믹싱", workers: ["이대리", "최인턴"] },
      { role: "RAM", taskName: "반죽 분할 및 발효", workers: ["박사원", "홍길동", "임꺽정", "김부장"] }
    ]
  },
  20: {
    dateStr: "2026.06.20",
    facility: "A동",
    totalWorkers: 14,
    pills: [
      { label: "A공장", count: 3, colorClass: "pill-green" },
      { label: "B공장", count: 5, colorClass: "pill-blue" },
      { label: "C공장", count: 2, colorClass: "pill-orange" },
      { label: "D공장", count: 4, colorClass: "pill-purple" }
    ],
    assignments: [
      { role: "RAM", taskName: "설비 정기 예방 점검", workers: ["김부장", "이대리", "박사원"] },
      { role: "RAM", taskName: "현장 안전 진단", workers: ["김부장", "이대리", "박사원", "홍길동", "임꺽정", "최인턴"] }
    ]
  },
  21: {
    dateStr: "2026.06.21",
    facility: "A동",
    totalWorkers: 5,
    pills: [
      { label: "A공장", count: 2, colorClass: "pill-green" },
      { label: "D공장", count: 3, colorClass: "pill-purple" }
    ],
    assignments: [
      { role: "RAM", taskName: "공정 일요 당직 정비", workers: ["이대리", "박사원", "최인턴", "홍길동", "임꺽정"] }
    ]
  }
};

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(17); // Set default to June 17th as highlighted in mockups
  const [toastText, setToastText] = useState<string | null>(null);

<<<<<<< HEAD
  // Fetch API Health
=======
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

  // Fetch API Health & Dashboard data
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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
<<<<<<< HEAD
    checkHealth();
=======

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
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
    const id = setInterval(checkHealth, 15000);
    return () => clearInterval(id);
  }, []);

  const triggerToast = (text: string) => {
    setToastText(text);
    setTimeout(() => {
      setToastText(null);
    }, 2500);
  };

  // Selected schedule data
  const currentSchedule = MOCK_DAILY_SCHEDULES[selectedDay] || {
    dateStr: `2026.06.${selectedDay.toString().padStart(2, "0")}`,
    facility: "A동",
    totalWorkers: 0,
    assignments: [],
    pills: []
  };

  // Generate calendar days for June 2026 (June 1st is Monday)
  const calendarDays = [];
  for (let i = 1; i <= 30; i++) {
    calendarDays.push(i);
  }

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

<<<<<<< HEAD
      {/* ── Row 1: Stats Grid (Mockup Style Data) ── */}
=======
      {/* ── Row 1: Stats Grid (Real-time API Data) ── */}
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
      <div className="stats-row">
        {/* Card 1: 전체 직원 수 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">전체 직원 수</span>
          </div>
          <div className="stat-card-body">
<<<<<<< HEAD
            <span className="stat-number">128</span>
            <span className="stat-unit">명</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">지난 달 대비 ▲ 5명</span>
=======
            <span className="stat-number">{employeesCount}</span>
            <span className="stat-unit">명</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">실시간 연동 완료</span>
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
          </div>
        </div>

        {/* Card 2: 교육 완료율 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">교육 완료율</span>
          </div>
          <div className="stat-card-body">
<<<<<<< HEAD
            <span className="stat-number">86.7</span>
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">지난 달 대비 ▲ 4.2%</span>
=======
            <span className="stat-number">{completionRate}</span>
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text positive">실시간 교육 이수율</span>
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
          </div>
        </div>

        {/* Card 3: 점검 예정 설비 */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">점검 예정 설비</span>
          </div>
          <div className="stat-card-body">
<<<<<<< HEAD
            <span className="stat-number">12</span>
=======
            <span className="stat-number">{upcomingCount}</span>
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
            <span className="stat-unit">건</span>
          </div>
          <div className="stat-card-footer">
            <span className="trend-text negative">7일 이내 예정</span>
          </div>
        </div>

<<<<<<< HEAD
        {/* Card 4: 업로드 문서 */}
=======
        {/* Card 4: 업로드 문서 (문서 관련 항목이므로 목업 유지) */}
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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

<<<<<<< HEAD
=======

>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
      {/* ── Row 2: Calendar & Details ── */}
      <div className="calendar-detail-row">
        {/* Calendar Card (Left) */}
        <div className="card calendar-card">
          <div className="calendar-card-header">
            <div className="calendar-nav">
              <span className="calendar-current-month">주간 일정 (2026.06.15 - 06.21)</span>
              
              {/* Factory Filter Dropdown as seen in mockup */}
              <select 
                className="nav-today-btn" 
                style={{ marginLeft: "14px", paddingRight: "10px" }}
                onChange={(e) => triggerToast(`'${e.target.value}' 필터 적용됨`)}
              >
                <option value="전체 공장">공장 선택 - 전체 공장</option>
                <option value="A공장">A공장</option>
                <option value="B공장">B공장</option>
                <option value="C공장">C공장</option>
                <option value="D공장">D공장</option>
              </select>
            </div>
            
            <div className="calendar-view-modes">
              <button className="mode-btn" onClick={() => triggerToast("주간 보기 전환")}>주간</button>
              <button className="mode-btn active">월간</button>
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
            {calendarDays.map((day) => {
              const hasSchedule = !!MOCK_DAILY_SCHEDULES[day];
              const schedule = MOCK_DAILY_SCHEDULES[day];
              const isSelected = selectedDay === day;
              const isToday = day === 18; // Today is June 18th in mock data

              return (
                <div
                  key={day}
                  className={`calendar-day-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${hasSchedule ? "has-data" : ""}`}
                  onClick={() => setSelectedDay(day)}
                >
                  <div className="day-number-wrapper">
                    <span className="day-number">{day}</span>
                    {isToday && <span className="today-dot">오늘</span>}
                  </div>
                  
                  {/* Staff Allocation Mini Pills */}
                  {hasSchedule && (
                    <div className="day-pills-list">
                      {schedule.pills.map((p, pIdx) => (
                        <div key={pIdx} className={`calendar-staff-pill ${p.colorClass}`}>
                          <span>{p.label} {p.count}명</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Speech bubble tooltip on the 20th to match sketch */}
                  {day === 20 && (
                    <div className="tooltip-bubble animate-pulse">
                      <span>날짜를 클릭하면 해당 일자의 배정 내역이 나타납니다.</span>
                      <div className="tooltip-arrow"></div>
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
              {currentSchedule.dateStr} {currentSchedule.facility} ({currentSchedule.totalWorkers}명)
            </h2>
            <button className="btn-detail-refresh" onClick={() => triggerToast("배정 현황 갱신 완료")}>🔄</button>
          </div>
          <div className="divider"></div>

          <div className="details-assignments-list">
            {currentSchedule.assignments.length > 0 ? (
              currentSchedule.assignments.map((asg, idx) => (
                <div key={idx} className="assignment-item animate-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className="assignment-meta">
                    <span className="assignment-role-tag">{asg.role}</span>
                    <span className="assignment-task-name">{asg.taskName}</span>
                  </div>
                  <div className="assignment-workers">
                    <span className="workers-label">작업자 이름:</span>
                    <div className="workers-names-list">
                      {asg.workers.map((w, wIdx) => (
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
                <span className="placeholder-sub">설비 정기 점검 또는 공정 휴무일</span>
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
<<<<<<< HEAD
            {[
              { name: "압축기 #2 (B공장)", dday: "D-2", urgent: true },
              { name: "보일러 #1 (A공장)", dday: "D-3", urgent: true },
              { name: "냉각탑 #3 (B공장)", dday: "D-5", urgent: true },
              { name: "펌프 #1 (C공장)", dday: "D-6", urgent: true }
            ].map((eq, idx) => (
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
            ))}
=======
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
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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
