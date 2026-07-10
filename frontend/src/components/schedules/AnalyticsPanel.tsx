import React, { useEffect, useState } from "react";
import { fetchAnalyticsApi } from "../../services/scheduleService";
import styles from "./AnalyticsPanel.module.css";

interface WorkerUtil {
  emp_id: string;
  emp_name: string;
  worked_minutes: number;
  utilization_pct: number;
}
interface EquipUtil {
  equipment_id: string;
  used_minutes: number;
  utilization_pct: number;
}
interface BottleneckTask {
  task_name: string;
  factory: string;
  avg_duration: number;
  task_count: number;
  total_minutes: number;
}
interface AtRiskOrder {
  order_num: string;
  due_date: string;
  days_remaining: number;
  risk_level: "위험" | "경고";
}
interface Analytics {
  worker_utilization: WorkerUtil[];
  equipment_utilization: EquipUtil[];
  bottleneck_tasks: BottleneckTask[];
  at_risk_orders: AtRiskOrder[];
  on_time_rate: number;
  total_orders: number;
  makespan_days: number;
  avg_worker_utilization: number;
}

const EMPTY_ANALYTICS: Analytics = {
  worker_utilization: [],
  equipment_utilization: [],
  bottleneck_tasks: [],
  at_risk_orders: [],
  on_time_rate: 0,
  total_orders: 0,
  makespan_days: 0,
  avg_worker_utilization: 0,
};

interface AnalyticsPanelProps {
  dateStr: string;
  refreshTrigger?: any;
}

function UtilBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className={styles.barTrack}>
      <div
        className={styles.barFill}
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
      <span className={styles.barLabel}>{pct}%</span>
    </div>
  );
}

function minutesToH(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function AnalyticsPanel({ dateStr, refreshTrigger }: AnalyticsPanelProps) {
  const [d, setD] = useState<Analytics>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"workers" | "equipment" | "bottleneck" | "risk">(
    "workers"
  );

  useEffect(() => {
    setLoading(true);
    fetchAnalyticsApi(dateStr)
      .then((r) => r.json())
      .then((json) => {
        setD({ ...EMPTY_ANALYTICS, ...json });
        setLoading(false);
      })
      .catch(() => {
        setD(EMPTY_ANALYTICS);
        setLoading(false);
      });
  }, [dateStr, refreshTrigger]);

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelTitle}>📊 생산 분석 대시보드</div>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const hasData = d.total_orders > 0;
  if (!hasData) {
    return null;
  }

  const ontimeColor =
    d.on_time_rate >= 80 ? "#10b981" : d.on_time_rate >= 60 ? "#f59e0b" : "#ef4444";
  const utilizationColor =
    d.avg_worker_utilization >= 70
      ? "#10b981"
      : d.avg_worker_utilization >= 40
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className={`${styles.panel} animate-in`} style={{ animationDelay: "0.15s", marginTop: "32px" }}>
      {/* ── 패널 타이틀 ── */}
      <div className={styles.panelTitle}>📊 생산 분석 대시보드</div>

      {/* ── KPI 헤더 카드 ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: "rgba(16,185,129,0.15)" }}>
            📦
          </div>
          <div>
            <div className={styles.kpiLabel}>전체 주문</div>
            <div className={styles.kpiValue}>
              {d.total_orders}<span>건</span>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div
            className={styles.kpiIcon}
            style={{ background: `rgba(${ontimeColor === "#10b981" ? "16,185,129" : ontimeColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.15)` }}
          >
            ✅
          </div>
          <div>
            <div className={styles.kpiLabel}>납기 준수율</div>
            <div className={styles.kpiValue} style={{ color: ontimeColor }}>
              {d.on_time_rate}<span>%</span>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div
            className={styles.kpiIcon}
            style={{ background: `rgba(${utilizationColor === "#10b981" ? "16,185,129" : utilizationColor === "#f59e0b" ? "245,158,11" : "239,68,68"},0.15)` }}
          >
            👷
          </div>
          <div>
            <div className={styles.kpiLabel}>평균 작업자 이용률</div>
            <div className={styles.kpiValue} style={{ color: utilizationColor }}>
              {d.avg_worker_utilization}<span>%</span>
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: "rgba(99,102,241,0.15)" }}>
            📅
          </div>
          <div>
            <div className={styles.kpiLabel}>전체 Makespan</div>
            <div className={styles.kpiValue}>
              {d.makespan_days}<span>일</span>
            </div>
          </div>
        </div>

        {d.at_risk_orders.length > 0 && (
          <div className={styles.kpiCard} style={{ border: "1px solid rgba(239,68,68,0.4)" }}>
            <div className={styles.kpiIcon} style={{ background: "rgba(239,68,68,0.15)" }}>
              ⚠️
            </div>
            <div>
              <div className={styles.kpiLabel}>납기 위험 주문</div>
              <div className={styles.kpiValue} style={{ color: "#ef4444" }}>
                {d.at_risk_orders.length}<span>건</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 탭 네비게이션 ── */}
      <div className={styles.tabNav}>
        {(["workers", "equipment", "bottleneck", "risk"] as const).map((tab) => {
          const labels: Record<string, string> = {
            workers: "👷 작업자 이용률",
            equipment: "⚙️ 장비 이용률",
            bottleneck: "🔴 병목 공정",
            risk: "⚠️ 납기 위험",
          };
          return (
            <button
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {labels[tab]}
              {tab === "risk" && d.at_risk_orders.length > 0 && (
                <span className={styles.badge}>{d.at_risk_orders.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className={styles.tabContent}>
        {/* 작업자 이용률 */}
        {activeTab === "workers" && (
          <div className={styles.listWrapper}>
            {d.worker_utilization.length === 0 ? (
              <p className={styles.empty}>이번 달 배정 데이터가 없습니다.</p>
            ) : (
              d.worker_utilization.map((w) => {
                const barColor =
                  w.utilization_pct >= 70
                    ? "#10b981"
                    : w.utilization_pct >= 40
                    ? "#f59e0b"
                    : "#ef4444";
                return (
                  <div key={w.emp_id} className={styles.listRow}>
                    <div className={styles.listMeta}>
                      <span className={styles.listName}>{w.emp_name || w.emp_id}</span>
                      <span className={styles.listSub}>{minutesToH(w.worked_minutes)} 작업</span>
                    </div>
                    <UtilBar pct={w.utilization_pct} color={barColor} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 장비 이용률 */}
        {activeTab === "equipment" && (
          <div className={styles.listWrapper}>
            {d.equipment_utilization.length === 0 ? (
              <p className={styles.empty}>이번 달 장비 가동 데이터가 없습니다.</p>
            ) : (
              d.equipment_utilization.map((eq) => {
                const barColor =
                  eq.utilization_pct >= 70
                    ? "#6366f1"
                    : eq.utilization_pct >= 40
                    ? "#f59e0b"
                    : "#94a3b8";
                return (
                  <div key={eq.equipment_id} className={styles.listRow}>
                    <div className={styles.listMeta}>
                      <span className={styles.listName}>{eq.equipment_id}</span>
                      <span className={styles.listSub}>{minutesToH(eq.used_minutes)} 가동</span>
                    </div>
                    <UtilBar pct={eq.utilization_pct} color={barColor} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 병목 공정 Top 5 */}
        {activeTab === "bottleneck" && (
          <div className={styles.listWrapper}>
            {d.bottleneck_tasks.length === 0 ? (
              <p className={styles.empty}>분석할 공정 데이터가 없습니다.</p>
            ) : (
              d.bottleneck_tasks.map((t, i) => {
                const maxTotal = d.bottleneck_tasks[0]?.total_minutes || 1;
                const pct = Math.round((t.total_minutes / maxTotal) * 100);
                const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22d3ee"];
                return (
                  <div key={t.task_name + t.factory} className={styles.listRow}>
                    <div className={styles.listMeta}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={styles.rankBadge} style={{ background: colors[i] }}>
                          #{i + 1}
                        </span>
                        <span className={styles.listName}>{t.task_name}</span>
                        <span className={styles.factoryChip}>{t.factory}</span>
                      </div>
                      <span className={styles.listSub}>
                        평균 {t.avg_duration}분 · {t.task_count}건 · 총 {minutesToH(t.total_minutes)}
                      </span>
                    </div>
                    <UtilBar pct={pct} color={colors[i]} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 납기 위험 주문 */}
        {activeTab === "risk" && (
          <div className={styles.listWrapper}>
            {d.at_risk_orders.length === 0 ? (
              <p className={styles.empty} style={{ color: "#10b981" }}>
                ✅ 납기 위험 주문이 없습니다.
              </p>
            ) : (
              d.at_risk_orders.map((o) => (
                <div
                  key={o.order_num}
                  className={styles.riskRow}
                  style={{
                    borderLeft: `3px solid ${o.risk_level === "위험" ? "#ef4444" : "#f59e0b"}`,
                  }}
                >
                  <div className={styles.listMeta}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className={styles.riskChip}
                        style={{
                          background: o.risk_level === "위험" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                          color: o.risk_level === "위험" ? "#ef4444" : "#f59e0b",
                        }}
                      >
                        {o.risk_level}
                      </span>
                      <span className={styles.listName}>{o.order_num}</span>
                    </div>
                    <span className={styles.listSub}>
                      납기일 {o.due_date} · 잔여{" "}
                      <strong style={{ color: o.risk_level === "위험" ? "#ef4444" : "#f59e0b" }}>
                        {o.days_remaining}일
                      </strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
