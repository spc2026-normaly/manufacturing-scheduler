"""
orchestrator.py — 일정 수립 파이프라인 오케스트레이터 (v2)
══════════════════════════════════════════════════════════════════════════════
5단계 파이프라인:
  1. R2에서 입력 CSV 로드
  2. RAG + GPT 자격 작업자 매핑 · 근무시간 · 요일 추출
  3. 일정 수립 (simulation 또는 cpsat 모드)
  4. 요약 DataFrame 집계 + KPI 계산
  5. 결과 CSV R2 업로드

mode 파라미터:
  "forward"  — 오늘부터 앞으로 시뮬레이션 (기본)
  "backward" — 납기일 역산 시작일 후 forward 시뮬레이션
  "cpsat"    — OR-Tools CP-SAT 최적화 (실패 시 forward로 폴백)
══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import pandas as pd
from datetime import date
from sqlalchemy.orm import Session

from app.services.schedule_pipeline.csv_io import load_input_csvs_from_r2, upload_schedule_to_r2
from app.services.schedule_pipeline.gpt_scheduler import (
    get_qualified_workers,
    get_daily_work_minutes,
    get_work_days_from_rag,
)
from app.services.schedule_pipeline.conflict_resolver import resolve_conflicts, _calc_tardiness

try:
    from app.utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


def _compute_kpi(schedule_df: pd.DataFrame, summary_df: pd.DataFrame) -> dict:
    """
    스케줄 결과에서 KPI 지표를 계산합니다.

    Returns
    -------
    dict with keys:
      deadline_compliance_rate : 납기 준수율 (%)
      avg_delay_days           : 평균 납기 지연일
      worker_utilization_rate  : 작업자 총 배정시간 / 전체 작업시간 (%)
    """
    total_orders = len(summary_df)
    if total_orders == 0:
        return {
            "deadline_compliance_rate": 0.0,
            "avg_delay_days": 0.0,
            "worker_utilization_rate": 0.0,
        }

    # 납기 준수율
    on_time = (summary_df["납기상태"] == "납기내완료").sum()
    compliance_rate = round(on_time / total_orders * 100, 1)

    # 평균 납기 지연일
    delay_days = []
    for _, row in summary_df.iterrows():
        try:
            end_d = pd.to_datetime(row["생산종료일"]).date()
            due_d = pd.to_datetime(row["납기일"]).date()
            delay_days.append(max(0, (end_d - due_d).days))
        except Exception:
            delay_days.append(0)
    avg_delay = round(sum(delay_days) / len(delay_days), 1)

    # 작업자 가동률: 전체 배정 작업시간 / (고유 작업자 수 × 총 근무일 × 480분)
    total_allocated = int(schedule_df["작업시간_분"].sum())
    unique_workers  = schedule_df["배정직원"].str.split(";").explode().nunique()
    if not schedule_df.empty:
        try:
            min_date = pd.to_datetime(schedule_df["시작일"]).dt.date.min()
            max_date = pd.to_datetime(schedule_df["종료일"]).dt.date.max()
            span_days = max(1, (max_date - min_date).days + 1)
        except Exception:
            span_days = 1
    else:
        span_days = 1
    total_available = unique_workers * span_days * 480
    utilization = round(total_allocated / max(total_available, 1) * 100, 1)

    return {
        "deadline_compliance_rate": compliance_rate,
        "avg_delay_days":           avg_delay,
        "worker_utilization_rate":  min(utilization, 100.0),
    }


def generate_and_upload_schedule(
    db: Session,
    mode: str = "forward",
    multistart_n: int = 3,   # Multi-start Greedy 반복 횟수 (1 = 기존 동작)
) -> dict:
    """
    전체 일정 수립 파이프라인을 실행합니다.

    Parameters
    ----------
    mode : "forward" | "backward" | "cpsat"
    """
    logger.info(f"🚀 일정 수립 파이프라인 시작 (mode={mode})")

    # ── Step 1: R2에서 입력 CSV 로드 ─────────────────────────────────────────
    logger.info("📥 R2에서 입력 CSV 로드 중...")
    orders_df, equip_df, training_df, tasks_df = load_input_csvs_from_r2()

    # ── Step 2: RAG + GPT 자격 매핑 ──────────────────────────────────────────
    logger.info("🧠 RAG + GPT 자격 작업자 매핑 중...")
    qualified_workers = get_qualified_workers(db, training_df)
    logger.info(f"✅ 자격 작업자 맵: {list(qualified_workers.keys())}")

    logger.info("🕰️ RAG에서 일일 근무시간 조회 중...")
    daily_work_minutes = get_daily_work_minutes(db)
    logger.info(f"✅ 일일 근무시간: {daily_work_minutes}분 ({daily_work_minutes / 60:.1f}시간)")

    logger.info("📅 RAG에서 근무 요일 조회 중...")
    work_days = get_work_days_from_rag(db)
    logger.info(f"✅ 근무 요일: {work_days}")

    # ── Step 3: 일정 수립 ────────────────────────────────────────────────────
    today = date.today()

    schedule_df = pd.DataFrame()

    if mode == "cpsat":
        logger.info("⚙️ CP-SAT 최적화 모드로 일정 수립 중...")
        try:
            from app.services.schedule_pipeline.cpsat_scheduler import schedule_with_cpsat
            schedule_df = schedule_with_cpsat(
                db=db,
                orders_df=orders_df,
                equip_df=equip_df,
                tasks_df=tasks_df,
                qualified_workers=qualified_workers,
                daily_work_minutes=daily_work_minutes,
                start_date=today,
                work_days=work_days,
                time_limit_seconds=60,
            )
        except Exception as e:
            logger.error(f"CP-SAT 실패 ({e}) — forward 시뮬레이션으로 폴백")
            mode = "forward"

    if schedule_df.empty and mode in ("forward", "backward"):
        # ── Multi-start Greedy ────────────────────────────────────────────────
        # N회 반복 중 tardiness 합이 최소인 결과를 채택.
        # trial=0 은 노이즈 없는 기존 ATC 순서 (재현성 보장).
        n_trials = max(1, multistart_n)
        logger.info(f"⚡ {mode} 시뮬레이션 모드 — Multi-start Greedy {n_trials}회 시작...")
        best_df: pd.DataFrame = pd.DataFrame()
        best_tardiness = float("inf")
        for trial in range(n_trials):
            noise = 0.0 if trial == 0 else 0.10   # trial 0 = 결정적, 이후 ±10% 노이즈
            logger.info(f"  [trial {trial + 1}/{n_trials}] atc_noise={noise:.0%}")
            candidate_df = resolve_conflicts(
                db=db,
                orders_df=orders_df,
                equip_df=equip_df,
                tasks_df=tasks_df,
                qualified_workers=qualified_workers,
                daily_work_minutes=daily_work_minutes,
                start_date=today,
                work_days=work_days,
                mode=mode,
                atc_noise=noise,
            )
            if candidate_df.empty:
                continue
            cand_rows = candidate_df.to_dict(orient="records")
            tardiness = _calc_tardiness(cand_rows)
            logger.info(f"  [trial {trial + 1}] tardiness={tardiness:.1f}일")
            if tardiness < best_tardiness:
                best_tardiness = tardiness
                best_df = candidate_df
                if tardiness == 0:
                    break   # 완벽한 해 발견 → 조기 종료

        schedule_df = best_df
        logger.info(
            f"Multi-start Greedy 완료 — 최선 tardiness={best_tardiness:.1f}일 "
            f"({n_trials}회 시도)"
        )

    if schedule_df.empty:
        raise ValueError("생성된 일정이 비어 있습니다. 입력 데이터를 확인하세요.")

    # ── Step 4: 요약 집계 + KPI 계산 ─────────────────────────────────────────
    logger.info("📊 일정 요약 생성 중...")
    summary_rows = []
    for order_num, group in schedule_df.groupby("주문번호"):
        prod_name = group["제품명"].iloc[0]
        qty       = group["수량"].iloc[0]
        due_date  = group["납기일"].iloc[0]

        start_dates = pd.to_datetime(group["시작일"])
        end_dates   = pd.to_datetime(group["종료일"])

        start_min = start_dates.min().strftime("%Y-%m-%d")
        end_max   = end_dates.max().strftime("%Y-%m-%d")

        total_tasks = len(group)
        total_mins  = group["작업시간_분"].sum()

        due_dt = pd.to_datetime(due_date)
        status = "납기내완료" if end_dates.max() <= due_dt else "납기초과"

        cause = group["지연원인"].iloc[0] if "지연원인" in group.columns else ("장비 및 작업자 자원 제한" if status == "납기초과" else "정상 완료")

        summary_rows.append({
            "주문번호":    order_num,
            "제품명":      prod_name,
            "수량":        qty,
            "납기일":      due_date,
            "생산시작일":  start_min,
            "생산종료일":  end_max,
            "총작업수":    total_tasks,
            "총작업시간_분": total_mins,
            "납기상태":    status,
            "지연원인":    cause,
        })

    summary_df = pd.DataFrame(summary_rows).sort_values(
        by="주문번호"
    ).reset_index(drop=True)

    kpi = _compute_kpi(schedule_df, summary_df)
    logger.info(
        f"📈 KPI — 납기준수율: {kpi['deadline_compliance_rate']}%, "
        f"평균지연일: {kpi['avg_delay_days']}일, "
        f"작업자가동률: {kpi['worker_utilization_rate']}%"
    )

    # 납기 지연 목록 추출
    delayed_orders_info = []
    for _, row in summary_df.iterrows():
        if row["납기상태"] == "납기초과":
            delayed_orders_info.append({
                "order_num": row["주문번호"],
                "product_name": row["제품명"],
                "due_date": row["납기일"],
                "end_date": row["생산종료일"],
                "delay_cause": row.get("지연원인", "작업량 과다")
            })

    # ── Step 5: R2 업로드 ────────────────────────────────────────────────────
    logger.info("📤 결과 CSV R2 업로드 중...")
    upload_schedule_to_r2(schedule_df, "생산일정결과.csv")
    upload_schedule_to_r2(summary_df, "생산일정요약.csv")

    logger.info("🎉 일정 수립 파이프라인 완료!")
    return {
        "total_schedules": len(schedule_df),
        "total_orders":    len(summary_df),
        "mode":            mode,
        "kpi":             kpi,
        "delayed_orders":  delayed_orders_info
    }
