"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnalyticsPanel } from "../../components/schedules/AnalyticsPanel";
import styles from "./page.module.css";

// ─── 타입 정의 ────────────────────────────────────────────────
type ScheduleMode = "forward" | "backward" | "cpsat";

interface StageInfo {
  id: string;
  label: string;
  icon: string;
  description: string;
  status: "idle" | "running" | "done" | "error";
  durationMs?: number;
}

interface KpiData {
  deadline_compliance_rate: number;
  avg_delay_days: number;
  worker_utilization_rate: number;
}

interface WorkerEfficiency {
  worker_id: string;
  worker_name: string;
  allocated_minutes: number;
  idle_minutes: number;
  utilization_pct: number;
  order_count: number;
}

interface DelayedOrder {
  order_num: string;
  product_name: string;
  due_date: string;
  end_date: string;
  delay_cause: string;
}

interface PipelineResult {
  total_schedules: number;
  total_orders: number;
  mode: string;
  kpi: KpiData;
  delayed_orders?: DelayedOrder[];
}

// ─── 스테이지 초기 정의 ───────────────────────────────────────
const INITIAL_STAGES: StageInfo[] = [
  {
    id: "load",
    label: "입력 데이터 로드",
    icon: "📥",
    description: "R2 스토리지에서 주문서, 장비, 교육이력, 작업 목록을 불러옵니다.",
    status: "idle",
  },
  {
    id: "gpt",
    label: "RAG + GPT 자격 매핑",
    icon: "🧠",
    description: "안전 규정을 벡터 검색하고 GPT로 공장별 자격 작업자를 매핑합니다.",
    status: "idle",
  },
  {
    id: "rag_hours",
    label: "근무시간 · 요일 조회",
    icon: "🕰️",
    description: "RAG에서 일일 근무시간 및 근무 요일 규정을 추출합니다.",
    status: "idle",
  },
  {
    id: "conflict",
    label: "일정 충돌 해소 · 배정",
    icon: "⚡",
    description: "EDD+SPT 우선순위로 분 단위 타임슬롯을 배정하고 자원 충돌을 해소합니다.",
    status: "idle",
  },
  {
    id: "summary",
    label: "요약 & KPI 계산",
    icon: "📊",
    description: "납기 준수율, 지연일, 작업자 가동률 등 KPI 지표를 집계합니다.",
    status: "idle",
  },
  {
    id: "upload",
    label: "R2 업로드",
    icon: "📤",
    description: "생산일정결과.csv 및 생산일정요약.csv를 R2에 저장합니다.",
    status: "idle",
  },
];

// ─── 모드 정보 ────────────────────────────────────────────────
const MODE_INFO: Record<ScheduleMode, { label: string; icon: string; desc: string; color: string }> = {
  forward: {
    label: "기본 시뮬레이션",
    icon: "▶️",
    desc: "오늘 날짜부터 앞으로 스케줄링합니다. (빠르고 안정적)",
    color: "#3b82f6",
  },
  backward: {
    label: "납기일 역산",
    icon: "⏪",
    desc: "납기일로부터 역산하여 최적 시작일을 계산 후 스케줄링합니다.",
    color: "#8b5cf6",
  },
  cpsat: {
    label: "OR-Tools 최적화",
    icon: "🤖",
    desc: "Google OR-Tools CP-SAT 솔버로 납기 초과를 수학적으로 최소화합니다. (느리지만 최적)",
    color: "#10b981",
  },
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function ScheduleBuilderPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<ScheduleMode>("forward");
  const [phases, setPhases] = useState<"option" | "running" | "done">("option");
  const [stages, setStages] = useState<StageInfo[]>(INITIAL_STAGES);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [workerStats, setWorkerStats] = useState<WorkerEfficiency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // 경과 시간 타이머
  useEffect(() => {
    if (phases === "running") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phases]);

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
  };

  // ── 단계 헬퍼 ─────────────────────────────────────────────
  const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
  const markStage = (idx: number, status: StageInfo["status"]) =>
    setStages((prev) => prev.map((s, i) => i === idx ? { ...s, status } : s));

  // ── 메인 실행 핸들러 ──────────────────────────────────────
  const handleStartSchedule = async () => {
    const token = localStorage.getItem("token");
    if (!token) { setError("로그인이 필요합니다."); return; }

    // 상태 초기화
    setPhases("running");
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "idle" })));
    setCurrentStageIdx(0);
    setError(null);
    setResult(null);
    setWorkerStats([]);

    // ① API를 백그라운드에서 즉시 시작 (await하지 않음)
    const apiPromise = fetch(
      `/api/schedule/generate-from-r2?mode=${selectedMode}`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );

    try {
      // ② 단계 0 — 입력 데이터 로드 (고정 1.5초 애니메이션)
      setCurrentStageIdx(0); markStage(0, "running");
      await delay(1500);
      markStage(0, "done");

      // ③ 단계 1 — RAG + GPT 자격 매핑 (3초)
      setCurrentStageIdx(1); markStage(1, "running");
      await delay(3000);
      markStage(1, "done");

      // ④ 단계 2 — 근무시간·요일 조회 (1.2초)
      setCurrentStageIdx(2); markStage(2, "running");
      await delay(1200);
      markStage(2, "done");

      // ⑤ 단계 3 — 충돌 해소: 앞 단계가 다 끝나면 실제 API 완료까지 대기
      setCurrentStageIdx(3); markStage(3, "running");
      const apiResp = await apiPromise;   // ← 여기서 실제 API 응답 수신

      if (!apiResp.ok) {
        const err = await apiResp.json().catch(() => ({ detail: "알 수 없는 오류" }));
        markStage(3, "error");
        setError(err.detail || "서버 오류가 발생했습니다.");
        setPhases("done");
        return;
      }
      markStage(3, "done");

      // ⑥ 단계 4 — 요약 & KPI 계산 (0.8초)
      setCurrentStageIdx(4); markStage(4, "running");
      await delay(800);
      markStage(4, "done");

      // ⑦ 단계 5 — R2 업로드 (0.6초)
      setCurrentStageIdx(5); markStage(5, "running");
      await delay(600);
      markStage(5, "done");

      // ⑧ 결과 파싱
      const data: PipelineResult = await apiResp.json();
      setResult(data);

      // ⑨ 작업자 효율 추가 조회 (실패해도 무시)
      try {
        const schedRes = await fetch("/api/schedules/calendar?view=month&date=2026-07-01", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          setWorkerStats(buildWorkerStats(schedData));
        }
      } catch (_) { /* optional */ }

      // ⑩ 완료 전환
      setPhases("done");

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.";
      setStages((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "error" } : s));
      setError(msg);
      setPhases("done");
    }
  };


  // 캘린더 일정 데이터에서 작업자별 통계 계산
  const buildWorkerStats = (schedules: any[]): WorkerEfficiency[] => {
    const map: Record<string, { allocated: number; orders: Set<string> }> = {};
    for (const s of schedules) {
      const workers = s.workers || [];
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // 분 단위
      const orderNum = String(s.order_num || "");
      for (const w of workers) {
        const key = String(w).trim();
        if (!key) continue;
        if (!map[key]) map[key] = { allocated: 0, orders: new Set() };
        map[key].allocated += duration;
        map[key].orders.add(orderNum);
      }
    }
    // 총 근무 가용시간: 근무일(대략) × 480분
    const totalAvailable = 480 * 22; // ~1개월
    return Object.entries(map)
      .map(([k, v]) => ({
        worker_id: k,
        worker_name: k,
        allocated_minutes: v.allocated,
        idle_minutes: Math.max(0, totalAvailable - v.allocated),
        utilization_pct: Math.min(100, Math.round((v.allocated / totalAvailable) * 100)),
        order_count: v.orders.size,
      }))
      .sort((a, b) => b.allocated_minutes - a.allocated_minutes)
      .slice(0, 15);
  };

  const statusColor = {
    idle: "#64748b",
    running: "#3b82f6",
    done: "#10b981",
    error: "#ef4444",
  };

  return (
    <div className={styles.page}>
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🏭</span>
          <div>
            <h1 className={styles.headerTitle}>일정 수립</h1>
            <p className={styles.headerSub}>
              알고리즘을 선택하고 생산 일정을 자동으로 수립합니다
            </p>
          </div>
        </div>
        {phases === "done" && (
          <button className={styles.resetBtn} onClick={() => setPhases("option")}>
            ↩ 다시 수립
          </button>
        )}
      </div>

      {/* ══ 옵션 선택 단계 ═══════════════════════════════════ */}
      {phases === "option" && (
        <div className={styles.optionSection}>
          <h2 className={styles.sectionTitle}>스케줄링 알고리즘 선택</h2>
          <p className={styles.sectionSub}>
            입력 데이터와 목표에 맞는 알고리즘을 선택하세요.
          </p>

          <div className={styles.modeGrid}>
            {(Object.entries(MODE_INFO) as [ScheduleMode, typeof MODE_INFO[ScheduleMode]][]).map(
              ([mode, info]) => (
                <button
                  key={mode}
                  className={`${styles.modeCard} ${selectedMode === mode ? styles.modeCardActive : ""}`}
                  onClick={() => setSelectedMode(mode)}
                  style={selectedMode === mode ? { borderColor: info.color } : {}}
                >
                  <div
                    className={styles.modeIconWrap}
                    style={selectedMode === mode ? { background: `${info.color}22` } : {}}
                  >
                    <span className={styles.modeIcon}>{info.icon}</span>
                  </div>
                  <div className={styles.modeLabel} style={selectedMode === mode ? { color: info.color } : {}}>
                    {info.label}
                  </div>
                  <p className={styles.modeDesc}>{info.desc}</p>
                  {selectedMode === mode && (
                    <div className={styles.modeCheck} style={{ background: info.color }}>✓</div>
                  )}
                </button>
              )
            )}
          </div>

          {/* 선택 요약 */}
          <div className={styles.selectionSummary} style={{ borderColor: MODE_INFO[selectedMode].color }}>
            <span className={styles.summaryIcon}>{MODE_INFO[selectedMode].icon}</span>
            <div>
              <strong style={{ color: MODE_INFO[selectedMode].color }}>
                {MODE_INFO[selectedMode].label}
              </strong>{" "}
              모드가 선택되었습니다.
              <br />
              <span className={styles.summaryDesc}>{MODE_INFO[selectedMode].desc}</span>
            </div>
          </div>

          <button
            className={styles.startBtn}
            style={{ background: `linear-gradient(135deg, ${MODE_INFO[selectedMode].color}, ${MODE_INFO[selectedMode].color}cc)` }}
            onClick={handleStartSchedule}
          >
            <span>🚀</span> 일정 수립 시작
          </button>
        </div>
      )}

      {/* ══ 진행 단계 ════════════════════════════════════════ */}
      {phases === "running" && (
        <div className={styles.runningSection}>
          <div className={styles.runningHeader}>
            <div className={styles.runningPulse} />
            <span className={styles.runningTitle}>일정 수립 진행 중…</span>
            <span className={styles.runningTimer}>⏱ {formatMs(elapsedMs)}</span>
          </div>

          {/* 전체 진행 바 */}
          <div className={styles.totalProgressWrap}>
            <div className={styles.totalProgressTrack}>
              <div
                className={styles.totalProgressBar}
                style={{
                  width: `${Math.round(((currentStageIdx + 1) / INITIAL_STAGES.length) * 100)}%`,
                }}
              />
            </div>
            <span className={styles.totalProgressLabel}>
              {currentStageIdx + 1} / {INITIAL_STAGES.length} 단계
            </span>
          </div>

          {/* 단계별 카드 */}
          <div className={styles.stageList}>
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className={`${styles.stageCard} ${stage.status === "running" ? styles.stageRunning : ""}`}
                style={{ borderLeftColor: statusColor[stage.status] }}
              >
                <div className={styles.stageLeft}>
                  <div
                    className={styles.stageStatusDot}
                    style={{ background: statusColor[stage.status] }}
                  >
                    {stage.status === "running" && <span className={styles.dotPulse} />}
                    {stage.status === "done" && "✓"}
                    {stage.status === "error" && "✕"}
                    {stage.status === "idle" && idx + 1}
                  </div>
                  <div>
                    <div className={styles.stageIcon}>{stage.icon}</div>
                  </div>
                  <div className={styles.stageInfo}>
                    <div className={styles.stageLabel}>{stage.label}</div>
                    <div className={styles.stageDesc}>{stage.description}</div>
                  </div>
                </div>
                <div className={styles.stageRight}>
                  {stage.status === "running" && (
                    <span className={styles.spinnerSmall} />
                  )}
                  {stage.status === "done" && (
                    <span className={styles.stageDone}>완료</span>
                  )}
                  {stage.status === "idle" && (
                    <span className={styles.stageWait}>대기</span>
                  )}
                  {stage.status === "error" && (
                    <span className={styles.stageError}>오류</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ 완료 + 리포트 단계 ═══════════════════════════════ */}
      {phases === "done" && (
        <div className={styles.doneSection}>
          {error ? (
            <div className={styles.errorBanner}>
              <span className={styles.errorIcon}>⚠️</span>
              <div>
                <strong>일정 수립 실패</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* 성공 배너 */}
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>🎉</span>
                <div>
                  <strong>일정 수립 완료!</strong>
                  <p>
                    총 {result?.total_orders}개 주문, {result?.total_schedules}개 작업 슬롯 배정 완료
                    &nbsp;·&nbsp; 총 소요 시간: {formatMs(elapsedMs)}
                  </p>
                </div>
                <button
                  className={styles.viewScheduleBtn}
                  onClick={() => router.push("/schedules")}
                >
                  양산 일정 보기 →
                </button>
              </div>

              {/* KPI 카드 */}
              {result?.kpi && (
                <section className={styles.kpiSection}>
                  <h2 className={styles.sectionTitle}>📈 핵심 성과 지표 (KPI)</h2>
                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard} style={{ borderTop: "3px solid #10b981" }}>
                      <div className={styles.kpiValue} style={{ color: "#10b981" }}>
                        {result.kpi.deadline_compliance_rate}%
                      </div>
                      <div className={styles.kpiLabel}>납기 준수율</div>
                      <div className={styles.kpiBar}>
                        <div
                          className={styles.kpiBarFill}
                          style={{
                            width: `${result.kpi.deadline_compliance_rate}%`,
                            background: "#10b981",
                          }}
                        />
                      </div>
                      <div className={styles.kpiHint}>
                        {result.kpi.deadline_compliance_rate >= 90
                          ? "✅ 우수"
                          : result.kpi.deadline_compliance_rate >= 70
                          ? "⚠️ 보통"
                          : "❌ 개선 필요"}
                      </div>
                    </div>

                    <div className={styles.kpiCard} style={{ borderTop: "3px solid #f59e0b" }}>
                      <div className={styles.kpiValue} style={{ color: "#f59e0b" }}>
                        {result.kpi.avg_delay_days}일
                      </div>
                      <div className={styles.kpiLabel}>평균 납기 지연일</div>
                      <div className={styles.kpiBar}>
                        <div
                          className={styles.kpiBarFill}
                          style={{
                            width: `${Math.min(100, result.kpi.avg_delay_days * 10)}%`,
                            background: "#f59e0b",
                          }}
                        />
                      </div>
                      <div className={styles.kpiHint}>
                        {result.kpi.avg_delay_days === 0
                          ? "✅ 지연 없음"
                          : result.kpi.avg_delay_days <= 3
                          ? "⚠️ 소폭 지연"
                          : "❌ 지연 심각"}
                      </div>
                    </div>

                    <div className={styles.kpiCard} style={{ borderTop: "3px solid #3b82f6" }}>
                      <div className={styles.kpiValue} style={{ color: "#3b82f6" }}>
                        {result.kpi.worker_utilization_rate}%
                      </div>
                      <div className={styles.kpiLabel}>작업자 가동률</div>
                      <div className={styles.kpiBar}>
                        <div
                          className={styles.kpiBarFill}
                          style={{
                            width: `${result.kpi.worker_utilization_rate}%`,
                            background: "#3b82f6",
                          }}
                        />
                      </div>
                      <div className={styles.kpiHint}>
                        {result.kpi.worker_utilization_rate >= 75
                          ? "✅ 효율적"
                          : result.kpi.worker_utilization_rate >= 50
                          ? "⚠️ 보통"
                          : "❌ 유휴 많음"}
                      </div>
                    </div>

                    <div className={styles.kpiCard} style={{ borderTop: "3px solid #8b5cf6" }}>
                      <div className={styles.kpiValue} style={{ color: "#8b5cf6" }}>
                        {result.mode === "cpsat" ? "OR-Tools" : result.mode === "backward" ? "역산" : "Forward"}
                      </div>
                      <div className={styles.kpiLabel}>사용 알고리즘</div>
                      <div className={styles.kpiBar}>
                        <div
                          className={styles.kpiBarFill}
                          style={{ width: "100%", background: "#8b5cf6" }}
                        />
                      </div>
                      <div className={styles.kpiHint}>{MODE_INFO[result.mode as ScheduleMode]?.label ?? result.mode}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* ⚠️ 납기 지연 원인 분석 리포트 */}
              {result?.delayed_orders && result.delayed_orders.length > 0 && (
                <section className={styles.delaySection}>
                  <h2 className={styles.sectionTitle} style={{ color: "#b91c1c" }}>
                    ⚠️ 납기 지연 분석 리포트 ({result.delayed_orders.length}건)
                  </h2>
                  <p className={styles.sectionSub}>
                    일정 수립 결과, 납기일 내 완료가 불가능하여 지연이 예상되는 수주와 주요 지연 원인 목록입니다.
                  </p>

                  <div className={styles.delayList}>
                    {result.delayed_orders.map((d) => (
                      <div key={d.order_num} className={styles.delayCard}>
                        <div className={styles.delayCardHeader}>
                          <span className={styles.delayOrderNum}>{d.order_num}</span>
                          <span className={styles.delayProdName}>{d.product_name}</span>
                        </div>
                        <div className={styles.delayCardBody}>
                          <div className={styles.delayDateRow}>
                            <span>📅 납기일: <strong>{d.due_date}</strong></span>
                            <span>🏁 생산종료예정일: <strong style={{ color: "#ef4444" }}>{d.end_date}</strong></span>
                          </div>
                          <div className={styles.delayCauseBox}>
                            <span className={styles.delayCauseIcon}>🚨</span>
                            <span className={styles.delayCauseText}>
                              주요 지연 원인: <strong>{d.delay_cause}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 작업자 효율 리포트 */}
              {workerStats.length > 0 && (
                <section className={styles.reportSection}>
                  <h2 className={styles.sectionTitle}>👷 직원별 효율 분석 리포트</h2>
                  <p className={styles.sectionSub}>
                    배정 작업시간 / 가용 작업시간 기준 가동률 및 공백시간을 분석합니다.
                  </p>

                  <div className={styles.workerTable}>
                    <div className={styles.workerTableHead}>
                      <span>직원</span>
                      <span>배정 작업시간</span>
                      <span>공백 시간</span>
                      <span>가동률</span>
                      <span>담당 주문수</span>
                    </div>
                    {workerStats.map((w) => (
                      <div key={w.worker_id} className={styles.workerRow}>
                        <span className={styles.workerName}>
                          <span
                            className={styles.workerAvatar}
                            style={{
                              background:
                                w.utilization_pct >= 75
                                  ? "#10b981"
                                  : w.utilization_pct >= 50
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          >
                            {w.worker_name[0]}
                          </span>
                          {w.worker_name}
                        </span>
                        <span className={styles.workerAllocated}>
                          {Math.floor(w.allocated_minutes / 60)}시간 {w.allocated_minutes % 60}분
                        </span>
                        <span
                          className={styles.workerIdle}
                          style={{ color: w.idle_minutes > 3000 ? "#ef4444" : "#10b981" }}
                        >
                          {Math.floor(w.idle_minutes / 60)}시간 {w.idle_minutes % 60}분
                        </span>
                        <span className={styles.workerUtil}>
                          <div className={styles.utilBarWrap}>
                            <div
                              className={styles.utilBarFill}
                              style={{
                                width: `${w.utilization_pct}%`,
                                background:
                                  w.utilization_pct >= 75
                                    ? "#10b981"
                                    : w.utilization_pct >= 50
                                    ? "#f59e0b"
                                    : "#ef4444",
                              }}
                            />
                          </div>
                          <span className={styles.utilPct}>{w.utilization_pct}%</span>
                        </span>
                        <span className={styles.workerOrders}>{w.order_count}건</span>
                      </div>
                    ))}
                  </div>

                  {/* 효율 분포 요약 */}
                  <div className={styles.efficiencySummary}>
                    <div className={styles.effCard} style={{ borderColor: "#10b981" }}>
                      <span className={styles.effDot} style={{ background: "#10b981" }} />
                      <strong style={{ color: "#10b981" }}>
                        {workerStats.filter((w) => w.utilization_pct >= 75).length}명
                      </strong>
                      <span>가동률 75% 이상 (효율적)</span>
                    </div>
                    <div className={styles.effCard} style={{ borderColor: "#f59e0b" }}>
                      <span className={styles.effDot} style={{ background: "#f59e0b" }} />
                      <strong style={{ color: "#f59e0b" }}>
                        {workerStats.filter((w) => w.utilization_pct >= 50 && w.utilization_pct < 75).length}명
                      </strong>
                      <span>가동률 50~75% (보통)</span>
                    </div>
                    <div className={styles.effCard} style={{ borderColor: "#ef4444" }}>
                      <span className={styles.effDot} style={{ background: "#ef4444" }} />
                      <strong style={{ color: "#ef4444" }}>
                        {workerStats.filter((w) => w.utilization_pct < 50).length}명
                      </strong>
                      <span>가동률 50% 미만 (유휴 많음)</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 완료된 단계 요약 */}
              <section className={styles.stageLogSection}>
                <h2 className={styles.sectionTitle}>🔍 파이프라인 실행 로그</h2>
                <div className={styles.stageLogList}>
                  {stages.map((stage) => (
                    <div key={stage.id} className={styles.stageLogRow}>
                      <span className={styles.stageLogIcon}>{stage.icon}</span>
                      <span className={styles.stageLogLabel}>{stage.label}</span>
                      <span
                        className={styles.stageLogStatus}
                        style={{ color: statusColor[stage.status] }}
                      >
                        {stage.status === "done" ? "✅ 완료" : stage.status === "error" ? "❌ 실패" : "⏸ 건너뜀"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* 📊 생산 분석 대시보드 연동 */}
      {phases !== "running" && (
        <AnalyticsPanel dateStr="2026-07-01" refreshTrigger={result} />
      )}
    </div>
  );
}

