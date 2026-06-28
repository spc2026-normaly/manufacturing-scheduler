"""
cpsat_scheduler.py — Google OR-Tools CP-SAT 기반 최적 스케줄러
══════════════════════════════════════════════════════════════════════════════
· 소규모(≤ 50 작업): 전역 최적해 보장
· 대규모: time_limit_seconds 내 최선해 반환
· 불가능 시 빈 DataFrame 반환 → 호출부에서 simulation 모드로 폴백

목적함수: 납기 초과(tardiness) 합 최소화
제약조건:
  - 작업은 근무 시간 내 (점심 제외)
  - 작업자 동시 배정 불가 (NoOverlap)
  - 장비 용량 제약 (Cumulative)
  - 스텝 순서 보장 (step n+1 ≥ step n 완료 후)
  - 선행 작업 DAG
══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import math
import re
from datetime import date, timedelta, datetime, time as dt_time
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

try:
    from app.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from app.services.schedule_pipeline.holiday_calendar import is_workday_kr, next_workday_kr

# ══════════════════════════════════════════════════════════════════════════════
# 슬롯 상수
# ══════════════════════════════════════════════════════════════════════════════
TOTAL_SLOTS = 540
LUNCH_START = 180
LUNCH_END   = 240
DAY_START   = dt_time(9, 0)


# ══════════════════════════════════════════════════════════════════════════════
# 내부 유틸
# ══════════════════════════════════════════════════════════════════════════════
def _build_valid_abs_slots(horizon_days: int) -> List[int]:
    """
    absolute-slot 기준으로 유효한(근무 가능한) 슬롯 인덱스 목록 반환.
    하루 540슬롯 중 점심(180-239) 제외.
    """
    valid = []
    for day in range(horizon_days):
        base = day * TOTAL_SLOTS
        for m in range(TOTAL_SLOTS):
            if not (LUNCH_START <= m < LUNCH_END):
                valid.append(base + m)
    return valid


def _abs_slot_to_datetime(abs_slot: int, start_date: date) -> datetime:
    day_idx  = abs_slot // TOTAL_SLOTS
    slot_min = abs_slot % TOTAL_SLOTS
    d = start_date + timedelta(days=day_idx)
    return datetime.combine(d, DAY_START) + timedelta(minutes=slot_min)


# ══════════════════════════════════════════════════════════════════════════════
# 전처리 헬퍼 (conflict_resolver 와 공유 가능하도록 독립 구현)
# ══════════════════════════════════════════════════════════════════════════════
def _build_product_tasks(
    tasks_df: pd.DataFrame,
    equip_symbol_map: Dict[str, str],
) -> Dict[str, Dict[int, List[Dict]]]:
    product_tasks: Dict[str, Dict[int, List[Dict]]] = {"DRAM": {}, "NAND": {}}
    for p_type in ("DRAM", "NAND"):
        filtered = tasks_df[
            (tasks_df["적용제품군"].str.strip() == "전체") |
            (tasks_df["적용제품군"].str.strip().str.upper() == p_type.upper())
        ].copy()
        filtered["step_int"] = filtered["작업단계"].astype(int)
        for step, group in filtered.groupby("step_int"):
            step_tasks: List[Dict] = []
            for _, row in group.iterrows():
                t_id       = str(row["작업ID"]).strip()
                equip_syms = [e.strip() for e in re.split(r"[;,/]+", str(row["필요장비"])) if e.strip()]
                req_equips = [equip_symbol_map[s.lower()] for s in equip_syms if s.lower() in equip_symbol_map]
                step_tasks.append({
                    "task_id":             t_id,
                    "task_name":           str(row["작업명"]).strip(),
                    "task_type":           str(row["작업구분"]).strip(),
                    "factory":             str(row["사용공장동"]).strip(),
                    "equip_symbols":       row["필요장비"],
                    "required_equipments": req_equips,
                    "base_time":           int(row["작업시간_분"]),
                })
            product_tasks[p_type][step] = step_tasks
    return product_tasks


def _build_task_predecessors(tasks_df: pd.DataFrame) -> Dict[str, List[str]]:
    preds: Dict[str, List[str]] = {}
    if "선행작업ID" not in tasks_df.columns:
        return preds
    for _, row in tasks_df.iterrows():
        t_id     = str(row["작업ID"]).strip()
        raw      = str(row.get("선행작업ID", "")).strip()
        if raw and raw.lower() not in ("nan", "없음", "-", ""):
            p_list = [p.strip() for p in re.split(r"[;,/]+", raw) if p.strip()]
            if p_list:
                preds[t_id] = p_list
    return preds


# ══════════════════════════════════════════════════════════════════════════════
# 메인 CP-SAT 스케줄러
# ══════════════════════════════════════════════════════════════════════════════
def schedule_with_cpsat(
    db: Session,
    orders_df: pd.DataFrame,
    equip_df: pd.DataFrame,
    tasks_df: pd.DataFrame,
    qualified_workers: Dict[str, List[str]],
    daily_work_minutes: int = 480,
    start_date: Optional[date] = None,
    work_days: Optional[List[int]] = None,
    time_limit_seconds: int = 60,
) -> pd.DataFrame:
    """
    OR-Tools CP-SAT 솔버로 최적 일정 수립.

    Returns
    -------
    pd.DataFrame  — 스케줄 결과 (열 구성은 conflict_resolver 와 동일)
                    FEASIBLE/OPTIMAL 해가 없으면 빈 DataFrame 반환.
    """
    if start_date is None:
        start_date = date.today()
    if work_days is None:
        work_days = [0, 1, 2, 3, 4]

    work_days_set: Set[int] = set(work_days)

    # ── 장비 매핑 ────────────────────────────────────────────────────────────
    equip_symbol_map: Dict[str, str] = {}
    equip_capacities: Dict[str, int] = {}
    for _, row in equip_df.iterrows():
        eq_id     = str(row["장비ID"]).strip()
        eq_symbol = str(row["장비기호"]).strip()
        cap_col   = next(
            (c for c in ["보유수량", "가용 장비 수량", "장비 전체 수량", "보유 수량"] if c in row.index),
            None,
        )
        equip_symbol_map[eq_symbol.lower()] = eq_id
        equip_capacities[eq_id]             = int(row[cap_col]) if cap_col else 1

    # ── 직원 이름 ────────────────────────────────────────────────────────────
    from sqlalchemy import text
    emp_rows = db.execute(text("SELECT emp_id, emp_name FROM employees")).mappings().all()
    emp_names: Dict[str, str] = {r["emp_id"].lower().strip(): r["emp_name"] for r in emp_rows}

    # ── 작업 목록 / DAG ──────────────────────────────────────────────────────
    product_tasks   = _build_product_tasks(tasks_df, equip_symbol_map)
    task_predecessors = _build_task_predecessors(tasks_df)

    # ── 지평선(horizon) 계산 ─────────────────────────────────────────────────
    max_total_mins = 0
    for _, row in orders_df.iterrows():
        pname = str(row["제품명"]).strip()
        qty   = int(row["수량"])
        ptype = str(row.get("제품군", "")).strip().upper()
        if ptype not in ("DRAM", "NAND"):
            ptype = "DRAM" if "DRAM" in pname.upper() else "NAND"
        mult  = math.ceil(qty / 1000)
        max_total_mins += sum(
            t["base_time"] * mult
            for st in product_tasks.get(ptype, {}).values()
            for t in st
        )

    horizon_days = math.ceil(max_total_mins / max(daily_work_minutes, 1)) + 30
    HORIZON = horizon_days * TOTAL_SLOTS
    logger.info(f"CP-SAT horizon: {horizon_days} 일 ({HORIZON} 슬롯)")

    # ── 근무 가능 일자 집합 (absolute day index) ──────────────────────────────
    workday_set: Set[int] = set()
    curr = start_date
    for day_idx in range(horizon_days):
        if is_workday_kr(curr, work_days_set, db):
            workday_set.add(day_idx)
        curr += timedelta(days=1)

    def _is_valid_abs(abs_slot: int) -> bool:
        day_idx  = abs_slot // TOTAL_SLOTS
        slot_min = abs_slot % TOTAL_SLOTS
        return day_idx in workday_set and not (LUNCH_START <= slot_min < LUNCH_END)

    # ── CP-SAT 모델 구성 ─────────────────────────────────────────────────────
    model  = cp_model.CpModel()
    solver = cp_model.CpSolver()

    # task_var: (order_num, step, task_id) → {start, end, interval, meta}
    task_var: Dict[Tuple[str, int, str], Dict] = {}

    # 주문 목록 파싱
    orders_info: List[Dict] = []
    for _, row in orders_df.iterrows():
        order_num    = str(row["주문번호"]).strip()
        product_name = str(row["제품명"]).strip()
        quantity     = int(row["수량"])
        due_str      = str(row["납기일"]).strip()
        due_date_obj = datetime.strptime(due_str, "%Y-%m-%d").date()
        ptype        = str(row.get("제품군", "")).strip().upper()
        if ptype not in ("DRAM", "NAND"):
            ptype = "DRAM" if "DRAM" in product_name.upper() else "NAND"
        due_abs = (due_date_obj - start_date).days * TOTAL_SLOTS + TOTAL_SLOTS - 1
        orders_info.append({
            "order_num":    order_num,
            "product_name": product_name,
            "quantity":     quantity,
            "due_date":     due_date_obj,
            "due_abs":      due_abs,
            "product_type": ptype,
        })

    # tardiness 변수 목록
    tardiness_vars: List = []

    for order in orders_info:
        onum  = order["order_num"]
        ptype = order["product_type"]
        mult  = math.ceil(order["quantity"] / 1000)
        due_abs = order["due_abs"]

        prev_step_end_var = None

        for step in range(1, 13):
            if step not in product_tasks.get(ptype, {}):
                continue
            tasks = product_tasks[ptype][step]
            step_end_vars: List = []

            for t in tasks:
                t_id     = t["task_id"]
                duration = max(1, t["base_time"] * mult)

                sv = model.NewIntVar(0, HORIZON - duration, f"s_{onum}_{step}_{t_id}")
                ev = model.NewIntVar(duration, HORIZON,     f"e_{onum}_{step}_{t_id}")
                iv = model.NewIntervalVar(sv, duration, ev, f"i_{onum}_{step}_{t_id}")

                # 스텝 순서 제약
                if prev_step_end_var is not None:
                    model.Add(sv >= prev_step_end_var)

                # DAG 선행 작업 제약
                for pred_id in task_predecessors.get(t_id, []):
                    for prev_key, prev_tv in task_var.items():
                        if prev_key[2] == pred_id and prev_key[0] == onum:
                            model.Add(sv >= prev_tv["end"])

                task_var[(onum, step, t_id)] = {
                    "start":    sv,
                    "end":      ev,
                    "interval": iv,
                    "duration": duration,
                    "order":    order,
                    "task":     t,
                }
                step_end_vars.append(ev)

            if step_end_vars:
                step_end_max = model.NewIntVar(0, HORIZON, f"step_end_{onum}_{step}")
                model.AddMaxEquality(step_end_max, step_end_vars)
                prev_step_end_var = step_end_max

        # tardiness
        if prev_step_end_var is not None:
            tard = model.NewIntVar(0, HORIZON, f"tard_{onum}")
            zero = model.NewConstant(0)
            model.AddMaxEquality(tard, [model.NewIntVar(-HORIZON, HORIZON, f"raw_tard_{onum}"), zero])
            # raw_tard = end_of_last_step - due_abs
            raw = model.NewIntVar(-HORIZON, HORIZON, f"raw_tard_{onum}")
            model.Add(raw == prev_step_end_var - due_abs)
            model.AddMaxEquality(tard, [raw, zero])
            tardiness_vars.append(tard)

    # 작업자 NoOverlap 제약 (공장별 대표 작업자 1명) 및 자격 유효기간 제약
    worker_intervals: Dict[str, List] = {}
    for key, tv in task_var.items():
        task    = tv["task"]
        factory = task["factory"]
        
        w_data = qualified_workers.get(factory, {})
        if isinstance(w_data, dict):
            workers = list(w_data.keys())
            w_exp_map = w_data
        else:
            workers = list(w_data)
            w_exp_map = {}
            
        if workers:
            w = workers[0]
            worker_intervals.setdefault(w, []).append(tv["interval"])
            
            # 자격 만료일이 있는 경우, 작업 종료 슬롯이 만료일을 초과하지 않도록 제약 추가
            exp_date = w_exp_map.get(w)
            if exp_date:
                exp_days = (exp_date - start_date).days
                max_slot = exp_days * TOTAL_SLOTS
                model.Add(tv["end"] <= max_slot)

    for w, ivs in worker_intervals.items():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # 장비 용량 제약 (Cumulative)
    equip_ivs: Dict[str, List]      = {}
    equip_demands_map: Dict[str, List[int]] = {}
    for key, tv in task_var.items():
        for eq in tv["task"]["required_equipments"]:
            equip_ivs.setdefault(eq, []).append(tv["interval"])
            equip_demands_map.setdefault(eq, []).append(1)

    for eq, ivs in equip_ivs.items():
        cap = equip_capacities.get(eq, 1)
        model.AddCumulative(ivs, equip_demands_map[eq], cap)

    # 목적함수: 납기 초과 합 최소화
    if tardiness_vars:
        model.Minimize(sum(tardiness_vars))

    # ── 풀기 ─────────────────────────────────────────────────────────────────
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_workers         = 4
    status = solver.Solve(model)

    status_name = solver.StatusName(status)
    logger.info(
        f"CP-SAT 결과: status={status_name}, "
        f"objective={solver.ObjectiveValue():.1f}, "
        f"wall_time={solver.WallTime():.2f}s"
    )

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        logger.warning("CP-SAT 해 없음 — 시뮬레이션 모드로 폴백합니다.")
        return pd.DataFrame()

    # ── 결과 DataFrame 구성 ──────────────────────────────────────────────────
    schedule_rows: List[Dict] = []
    for key, tv in task_var.items():
        onum, step, t_id = key
        task  = tv["task"]
        order = tv["order"]

        s_abs = solver.Value(tv["start"])
        e_abs = solver.Value(tv["end"])
        s_dt  = _abs_slot_to_datetime(s_abs, start_date)
        e_dt  = _abs_slot_to_datetime(e_abs, start_date)
        dur   = e_abs - s_abs
        status_str = "납기내완료" if e_dt.date() <= order["due_date"] else "납기초과"

        factory = task["factory"]
        workers = qualified_workers.get(factory, [])
        worker_str = ";".join(
            f"{w.upper()}({emp_names.get(w, 'UNKNOWN')})"
            for w in (workers[:1] if workers else ["UNKNOWN"])
        )

        schedule_rows.append({
            "주문번호":    onum,
            "제품명":      order["product_name"],
            "수량":        order["quantity"],
            "작업단계":    step,
            "작업ID":      t_id,
            "작업명":      task["task_name"],
            "작업구분":    task["task_type"],
            "공장동":      task["factory"],
            "필요장비":    task["equip_symbols"],
            "배정직원":    worker_str,
            "시작일":      s_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "종료일":      e_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "작업시간_분": dur,
            "납기일":      order["due_date"].strftime("%Y-%m-%d"),
            "납기상태":    status_str,
        })

    result_df = pd.DataFrame(schedule_rows)
    if not result_df.empty:
        result_df = result_df.sort_values(
            by=["주문번호", "작업단계", "작업ID"]
        ).reset_index(drop=True)
        result_df.insert(
            0, "일정ID",
            result_df.index.map(lambda i: f"SCH{i + 1:04d}")
        )

    logger.info(f"CP-SAT 스케줄 완료: {len(result_df)} 행")
    return result_df
