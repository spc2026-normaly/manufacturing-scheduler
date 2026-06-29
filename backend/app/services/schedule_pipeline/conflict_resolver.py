"""
conflict_resolver.py — 일정 수립 핵심 엔진 (v2)
══════════════════════════════════════════════════════════════════════════════
개선 내역:
  · EDD + SPT 기반 주문 우선순위 정렬 (납기 준수율 향상)
  · 비트마스크(Python int) 기반 슬롯 탐색 — O(1) 가용 슬롯 계산
  · 공휴일 반영 (holidays 라이브러리 + company_holidays DB)
  · actual_step_end 초기화 버그 수정
  · 제품 타입 명시적 컬럼('제품군') 우선 처리
  · Backward Scheduling 옵션 (납기일 역산 시작일 계산)
  · 장비 PM 일정 반영 (equipment_maintenance 테이블)
  · 작업 의존성 DAG ('선행작업ID' 컬럼)
══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import math
import re
from datetime import date, timedelta, datetime, time as dt_time
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from app.utils.logger import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)

from app.services.schedule_pipeline.holiday_calendar import (
    is_workday_kr,
    next_workday_kr,
)

# ══════════════════════════════════════════════════════════════════════════════
# 슬롯 상수 (09:00 – 18:00, 1분 = 1 슬롯, 총 540 슬롯)
# ══════════════════════════════════════════════════════════════════════════════
TOTAL_SLOTS = 540          # 09:00–18:00
LUNCH_START = 180          # 12:00 (offset from 09:00)
LUNCH_END   = 240          # 13:00
_ALL_MASK   = (1 << TOTAL_SLOTS) - 1
_LUNCH_MASK = sum(1 << m for m in range(LUNCH_START, LUNCH_END))
WORK_MASK   = _ALL_MASK & ~_LUNCH_MASK   # 점심 제외 가용 슬롯 비트마스크


# ══════════════════════════════════════════════════════════════════════════════
# 비트마스크 유틸리티
# ══════════════════════════════════════════════════════════════════════════════
def _slots_from_mask(mask: int) -> List[int]:
    """비트마스크에서 1인 슬롯 인덱스 목록 반환."""
    slots, pos = [], 0
    while mask:
        if mask & 1:
            slots.append(pos)
        mask >>= 1
        pos += 1
    return slots


def _count_bits(mask: int) -> int:
    return bin(mask).count("1")


def _find_contiguous_start(mask: int, length: int) -> int:
    """
    `length`개의 연속된 1비트가 처음 시작되는 슬롯 인덱스 반환.
    없으면 -1.  sliding-AND 기법으로 O(length) 연산.
    """
    if length <= 0:
        return 0
    run = mask
    for _ in range(length - 1):
        run &= run >> 1
    if not run:
        return -1
    return (run & -run).bit_length() - 1


def _make_run_mask(start: int, length: int) -> int:
    """start 위치부터 length개의 비트를 1로 설정한 마스크."""
    return ((1 << length) - 1) << start


def _first_n_bits(mask: int, n: int) -> int:
    """마스크에서 첫 n개의 1비트만 남긴 마스크 반환."""
    result, count, pos = 0, 0, 0
    while mask and count < n:
        if mask & 1:
            result |= 1 << pos
            count += 1
        mask >>= 1
        pos += 1
    return result


def _left_pack_mask(free_mask: int, length: int) -> int:
    """Left Packing: 가용 슬롯 중 가장 앞쪽(이른 시각) length개를 선택.
    _first_n_bits와 동일하지만 의미를 명확히 하기 위해 별도 정의.
    - 연속 블록을 찾지 못하더라도 가장 이른 슬롯부터 채워
      Idle Time을 최소화하는 핵심 전략.
    """
    return _first_n_bits(free_mask, length)


def _find_contiguous_runs(mask: int) -> List[Tuple[int, int]]:
    """마스크에서 연속된 1비트 구간 (start, length) 목록을 반환."""
    runs: List[Tuple[int, int]] = []
    pos = 0
    remaining = mask
    while remaining:
        # 0비트 건너뜀
        tz = (remaining & -remaining).bit_length() - 1
        remaining >>= tz
        pos += tz
        # 연속 1비트 세기
        length = 0
        tmp = remaining
        while tmp & 1:
            length += 1
            tmp >>= 1
        runs.append((pos, length))
        remaining >>= length
        pos += length
    return runs


def _atc_score(due_date: "date", today: "date", proc_minutes: int, avg_proc_days: float, k: float = 2.0) -> float:
    """ATC (Apparent Tardiness Cost) 우선순위 점수.
    높을수록 먼저 처리.
    priority = exp(-max(d-t,0) / (k*avg_p)) / p
    """
    remaining_days = max((due_date - today).days, 0)
    proc_days = max(proc_minutes / 480.0, 0.001)   # 분 → 일 환산
    avg_p = max(avg_proc_days, 0.001)
    import math as _math
    return _math.exp(-remaining_days / (k * avg_p)) / proc_days


def _calc_tardiness(schedule_rows: List[Dict]) -> float:
    """납기 초과 일수 합계(Objective) 계산. 낮을수록 좋음."""
    per_order: Dict[str, Dict] = {}
    for row in schedule_rows:
        onum = row["주문번호"]
        if onum not in per_order:
            per_order[onum] = {"due": row["납기일"], "end": row["종료일"]}
        else:
            if row["종료일"] > per_order[onum]["end"]:
                per_order[onum]["end"] = row["종료일"]
    total = 0.0
    for onum, v in per_order.items():
        try:
            end_d = datetime.strptime(v["end"], "%Y-%m-%d %H:%M:%S").date()
            due_d = datetime.strptime(v["due"], "%Y-%m-%d").date()
            total += max(0, (end_d - due_d).days)
        except Exception:
            pass
    return total


# ══════════════════════════════════════════════════════════════════════════════
# 메인 스케줄러
# ══════════════════════════════════════════════════════════════════════════════
def resolve_conflicts(
    db: Session,
    orders_df: pd.DataFrame,
    equip_df: pd.DataFrame,
    tasks_df: pd.DataFrame,
    qualified_workers: Dict[str, List[str]],
    daily_work_minutes: int = 480,
    start_date: Optional[date] = None,
    work_days: Optional[List[int]] = None,
    mode: str = "forward",   # "forward" | "backward"
    atc_noise: float = 0.0,   # Multi-start Greedy용 ATC 점수 노이즈 (0 = 고정)
) -> pd.DataFrame:
    """
    분 단위 시뮬레이션 기반 일정 수립 엔진.

    Parameters
    ----------
    mode : "forward"  — 오늘부터 앞으로 스케줄링 (기본값)
           "backward" — 납기일부터 역산하여 시작일 도출 후 forward 실행
    """
    if start_date is None:
        start_date = date.today()
    if work_days is None:
        work_days = [0, 1, 2, 3, 4]   # 월–금

    work_days_set: Set[int] = set(work_days)

    def _is_workday(d: date) -> bool:
        return is_workday_kr(d, work_days_set, db)

    def _next_workday(d: date) -> date:
        return next_workday_kr(d, work_days_set, db)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. 직원 이름 조회
    # ──────────────────────────────────────────────────────────────────────────
    valid_csv_emp_ids: Set[str] = set()
    for workers in qualified_workers.values():
        valid_csv_emp_ids.update(workers)

    emp_rows = db.execute(
        text("SELECT emp_id, emp_name FROM employees")
    ).mappings().all()
    emp_names: Dict[str, str] = {
        row["emp_id"].lower().strip(): row["emp_name"]
        for row in emp_rows
        if row["emp_id"].lower().strip() in valid_csv_emp_ids
    }

    # ──────────────────────────────────────────────────────────────────────────
    # 2. 장비 매핑
    # ──────────────────────────────────────────────────────────────────────────
    equip_symbol_map: Dict[str, str] = {}
    equip_capacities: Dict[str, int] = {}
    for _, row in equip_df.iterrows():
        eq_id     = str(row["장비ID"]).strip()
        eq_symbol = str(row["장비기호"]).strip()
        cap_col   = next(
            (c for c in ["보유수량", "가용 장비 수량", "장비 전체 수량", "보유 수량"] if c in row.index),
            None,
        )
        cap = int(row[cap_col]) if cap_col else 1
        equip_symbol_map[eq_symbol.lower()] = eq_id
        equip_capacities[eq_id] = cap

    # ──────────────────────────────────────────────────────────────────────────
    # 3. 장비 PM 일정 → 사전 점유 마스크
    # ──────────────────────────────────────────────────────────────────────────
    pm_equip_blocked: Dict[date, Dict[str, int]] = {}
    try:
        with db.begin_nested():
            pm_rows = db.execute(text(
                "SELECT equipment_id, pm_date, start_slot, end_slot "
                "FROM equipment_maintenance"
            )).mappings().all()
            for pm in pm_rows:
                pm_d  = pm["pm_date"]
                eq_id = str(pm["equipment_id"]).strip()
                s, e  = int(pm["start_slot"]), int(pm["end_slot"])
                mask  = _make_run_mask(s, max(0, e - s))
                pm_equip_blocked.setdefault(pm_d, {})
                pm_equip_blocked[pm_d][eq_id] = pm_equip_blocked[pm_d].get(eq_id, 0) | mask
            logger.debug(f"PM 일정 로드: {len(pm_rows)}건")
    except Exception:
        logger.debug("equipment_maintenance 테이블 없음 — PM 일정 건너뜀.")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. 작업 의존성 DAG
    # ──────────────────────────────────────────────────────────────────────────
    task_predecessors: Dict[str, List[str]] = {}
    if "선행작업ID" in tasks_df.columns:
        for _, row in tasks_df.iterrows():
            t_id     = str(row["작업ID"]).strip()
            pred_raw = str(row.get("선행작업ID", "")).strip()
            if pred_raw and pred_raw.lower() not in ("nan", "없음", "-", ""):
                preds = [p.strip() for p in re.split(r"[;,/]+", pred_raw) if p.strip()]
                if preds:
                    task_predecessors[t_id] = preds
        logger.info(f"DAG 의존성 로드: {len(task_predecessors)}개 작업")

    # ──────────────────────────────────────────────────────────────────────────
    # 5. 주문 목록 구성
    # ──────────────────────────────────────────────────────────────────────────
    orders_df = orders_df.copy()
    orders_df["order_num_clean"] = orders_df["주문번호"].apply(lambda x: str(x).strip())

    orders: List[Dict] = []
    for _, row in orders_df.iterrows():
        order_num    = str(row["주문번호"]).strip()
        product_name = str(row["제품명"]).strip()
        quantity     = int(row["수량"])
        due_date     = datetime.strptime(str(row["납기일"]).strip(), "%Y-%m-%d").date()

        # 제품 타입: 명시 컬럼 우선 → 이름 포함 체크 → 경고
        product_type = str(row.get("제품군", "")).strip().upper()
        if product_type not in ("DRAM", "NAND"):
            product_type = "DRAM" if "DRAM" in product_name.upper() else "NAND"
            logger.warning(
                f"주문 {order_num}: '제품군' 컬럼 없음 — "
                f"제품명 기반 분류 결과 '{product_type}'"
            )

        orders.append({
            "order_num":    order_num,
            "product_name": product_name,
            "quantity":     quantity,
            "due_date":     due_date,
            "product_type": product_type,
            "current_date": start_date,
        })

    # ──────────────────────────────────────────────────────────────────────────
    # 6. 작업 목록 필터링 & 그룹화
    # ──────────────────────────────────────────────────────────────────────────
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
                equip_syms = [
                    e.strip()
                    for e in re.split(r"[;,/]+", str(row["필요장비"]))
                    if e.strip()
                ]
                req_equips = [
                    equip_symbol_map[s.lower()]
                    for s in equip_syms
                    if s.lower() in equip_symbol_map
                ]
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

    # ──────────────────────────────────────────────────────────────────────────
    # 7. 총 예상 작업시간 계산 → EDD+SPT 우선순위 정렬
    # ──────────────────────────────────────────────────────────────────────────
    def _estimate_total_minutes(order: Dict) -> int:
        mult = math.ceil(order["quantity"] / 1000)
        return sum(
            t["base_time"] * mult
            for step_tasks in product_tasks.get(order["product_type"], {}).values()
            for t in step_tasks
        )

    for o in orders:
        o["total_estimated_minutes"] = _estimate_total_minutes(o)

    # ── ATC (Apparent Tardiness Cost) 우선순위 ────────────────────────────────
    # 납기가 급하고 처리시간이 짧은 작업을 자동으로 우선 처리.
    # EDD+SPT보다 현실적인 APS 표준 Dispatch Rule.
    avg_proc_days = (
        sum(o["total_estimated_minutes"] for o in orders)
        / max(len(orders), 1)
        / 480.0
    )
    today_ref = start_date
    for o in orders:
        o["atc_score"] = _atc_score(
            o["due_date"], today_ref,
            o["total_estimated_minutes"], avg_proc_days
        )
    if atc_noise > 0.0:
        import random
        for o in orders:
            o["atc_score"] *= random.uniform(1.0 - atc_noise, 1.0 + atc_noise)
    orders.sort(key=lambda o: -o["atc_score"])   # 높을수록 우선
    logger.info(
        "ATC 우선순위 정렬 완료: "
        + str([f"{o['order_num']}(ATC={o['atc_score']:.3f})" for o in orders])
    )

    # ──────────────────────────────────────────────────────────────────────────
    # 8. Backward Scheduling: 납기일 역산 시작일 계산
    # ──────────────────────────────────────────────────────────────────────────
    if mode == "backward":
        logger.info("Backward scheduling 모드 — 납기일로부터 역산합니다.")
        for o in orders:
            days_needed = math.ceil(
                o["total_estimated_minutes"] / max(daily_work_minutes, 1)
            )
            proposed = o["due_date"]
            counted  = 0
            while counted < days_needed:
                proposed -= timedelta(days=1)
                if _is_workday(proposed):
                    counted += 1
            # 오늘보다 과거로 설정되지 않도록 보정
            o["current_date"] = max(proposed, start_date)
            logger.debug(
                f"주문 {o['order_num']}: backward 시작일 → {o['current_date']}"
            )

    # ──────────────────────────────────────────────────────────────────────────
    # 9. 자원 타임라인 초기화 함수
    #    worker: dict[date][emp_id] = int(bitmask)  — 1비트 = 해당 슬롯 점유
    #    equip:  dict[date][eq_id]  = List[int]     — 슬롯별 현재 사용 수
    # ──────────────────────────────────────────────────────────────────────────
    worker_mask: Dict[date, Dict[str, int]] = {}
    equip_timeline: Dict[date, Dict[str, List[int]]] = {}
    worker_total_load: Dict[str, int] = {}      # 누적 총 작업 분
    worker_day_load:   Dict[str, Dict[date, int]] = {}   # 날짜별 당일 작업 분
    worker_last_slot:  Dict[str, Dict[date, int]] = {}   # 날짜별 마지막 사용 슬롯

    def _init_worker(d: date, w: str) -> None:
        worker_mask.setdefault(d, {})
        if w not in worker_mask[d]:
            worker_mask[d][w] = _LUNCH_MASK   # 점심 사전 점유

    def _init_equip(d: date, eq: str) -> None:
        equip_timeline.setdefault(d, {})
        if eq not in equip_timeline[d]:
            cap   = equip_capacities.get(eq, 1)
            slots = [0] * TOTAL_SLOTS
            for m in range(LUNCH_START, LUNCH_END):
                slots[m] = cap           # 점심 사전 점유
            # PM 사전 점유 적용
            pm_mask = pm_equip_blocked.get(d, {}).get(eq, 0)
            for m in _slots_from_mask(pm_mask):
                if 0 <= m < TOTAL_SLOTS:
                    slots[m] = cap
            equip_timeline[d][eq] = slots

    def _equip_full_mask(d: date, eq: str) -> int:
        """장비 eq가 해당 날짜에서 capacity 이상 점유된 슬롯의 비트마스크."""
        cap   = equip_capacities.get(eq, 1)
        slots = equip_timeline.get(d, {}).get(eq, [cap] * TOTAL_SLOTS)
        mask  = 0
        for m, cnt in enumerate(slots):
            if cnt >= cap:
                mask |= 1 << m
        return mask

    # ──────────────────────────────────────────────────────────────────────────
    # 10. DAG 완료 날짜 추적
    # ──────────────────────────────────────────────────────────────────────────
    task_done_date: Dict[str, date] = {}

    # ──────────────────────────────────────────────────────────────────────────
    # 11. 메인 스케줄링 루프
    # ──────────────────────────────────────────────────────────────────────────
    schedule_rows: List[Dict] = []
    order_bottlenecks: Dict[str, Dict[str, int]] = {}

    for step in range(1, 13):
        for order in orders:
            p_type = order["product_type"]
            if step not in product_tasks[p_type]:
                continue
            tasks = product_tasks[p_type][step]
            if not tasks:
                continue

            # DAG: 모든 선행 작업 완료일 이후 시작
            dag_earliest = order["current_date"]
            for t in tasks:
                for pred_id in task_predecessors.get(t["task_id"], []):
                    pred_done = task_done_date.get(pred_id)
                    if pred_done and pred_done > dag_earliest:
                        dag_earliest = _next_workday(pred_done - timedelta(days=1))

            order_start_date = dag_earliest
            if not _is_workday(order_start_date):
                order_start_date = _next_workday(order_start_date - timedelta(days=1))

            # 작업자 사전 배정 (부하 균등 배분)
            task_assignments: Dict[str, List[str]] = {}
            for t in tasks:
                factory = t["factory"]
                eligible_map = qualified_workers.get(factory, {})
                # 실제 작업이 배정되기 시작하는 날짜(order_start_date) 기준으로 교육이 만료되지 않은 직원만 배정 가능
                eligible = [
                    w_id for w_id, exp_d in eligible_map.items()
                    if exp_d >= order_start_date
                ]
                if not eligible:
                    eligible = list(emp_names.keys())

                req_equips = t["required_equipments"]
                max_workers = (
                    max(1, min(equip_capacities.get(eq, 1) for eq in req_equips))
                    if req_equips else 10
                )
                num_to_assign = max(1, min(len(eligible), max_workers))

                # ── Worker Score 기반 배정 ────────────────────────────────────
                # score = α×누적이용률 + β×당일작업분 + γ×마지막슬롯
                # 점수 낮은(=유휴 시간 많은) 작업자 우선 배정 → Load Balancing
                def _worker_score(w_id: str) -> float:
                    total_load = worker_total_load.get(w_id, 0)
                    day_load   = worker_day_load.get(w_id, {}).get(order_start_date, 0)
                    last_slot  = worker_last_slot.get(w_id, {}).get(order_start_date, 0)
                    return 1.0 * total_load + 0.5 * day_load + 0.3 * last_slot

                eligible_sorted = sorted(eligible, key=_worker_score)
                assigned = eligible_sorted[:num_to_assign]
                task_assignments[t["task_id"]] = assigned

                mult    = math.ceil(order["quantity"] / 1000)
                avg_dur = math.ceil(t["base_time"] * mult / len(assigned))
                for w in assigned:
                    worker_total_load[w] = worker_total_load.get(w, 0) + avg_dur

            # 일 단위 시뮬레이션
            curr_date   = order_start_date
            step_completed = False
            actual_step_end = order_start_date   # ← 버그 수정: 항상 초기화

            mult           = math.ceil(order["quantity"] / 1000)
            remaining_mins = {t["task_id"]: t["base_time"] * mult for t in tasks}

            while not step_completed:
                if not _is_workday(curr_date):
                    curr_date = _next_workday(curr_date - timedelta(days=1))
                    continue

                any_allocation = False

                for t in tasks:
                    t_id = t["task_id"]
                    rem  = remaining_mins[t_id]
                    if rem <= 0:
                        continue

                    assigned_workers = task_assignments[t_id]
                    req_equips       = t["required_equipments"]
                    num_workers      = len(assigned_workers)

                    for w in assigned_workers:
                        _init_worker(curr_date, w)
                    for eq in req_equips:
                        _init_equip(curr_date, eq)

                    req_elapsed = math.ceil(rem / num_workers)

                    # ── 비트마스크 가용 슬롯 계산 (O(1)) ──────────────────
                    worker_busy: int = 0
                    for w in assigned_workers:
                        worker_busy |= worker_mask[curr_date].get(w, 0)

                    equip_busy: int = 0
                    for eq in req_equips:
                        equip_busy |= _equip_full_mask(curr_date, eq)

                    free_mask = WORK_MASK & ~worker_busy & ~equip_busy
                    total_avail = _count_bits(free_mask)

                    if total_avail == 0:
                        # 원인 누적
                        w_busy_cnt = _count_bits(worker_busy & WORK_MASK)
                        eq_busy_cnt = _count_bits(equip_busy & WORK_MASK)
                        order_bottlenecks.setdefault(order["order_num"], {"workers": 0, "equipments": 0})
                        if w_busy_cnt >= eq_busy_cnt:
                            order_bottlenecks[order["order_num"]]["workers"] += 1
                        else:
                            order_bottlenecks[order["order_num"]]["equipments"] += 1
                        continue

                    # ── Left Packing 슬롯 배정 전략 ──────────────────────────
                    # 1) 소규모 작업: 연속 블록 탐색 우선
                    #    - 연속 블록 없으면 → Left Pack (skip 대신 가능한 가장 앞쪽 슬롯 채움)
                    #    - 이전 코드는 연속 실패 시 다음 날로 skip → 불필요한 Idle 발생
                    # 2) 대규모 작업: Left Pack으로 가용 슬롯 최대한 채움
                    usable_slots = 300
                    is_small     = req_elapsed <= usable_slots

                    if is_small:
                        run_start = _find_contiguous_start(free_mask, req_elapsed)
                        if run_start >= 0:
                            # 연속 블록 발견 → 연속 배정 (장비 셋업 효율 최적)
                            alloc_mask = _make_run_mask(run_start, req_elapsed)
                        else:
                            # 연속 블록 없음 → Left Pack (가장 이른 가용 슬롯부터 채움)
                            # 기존: 다음 날 skip → 개선: 당일 가용 슬롯 최대한 활용
                            take = min(total_avail, req_elapsed)
                            if take == 0:
                                w_busy_cnt  = _count_bits(worker_busy & WORK_MASK)
                                eq_busy_cnt = _count_bits(equip_busy & WORK_MASK)
                                order_bottlenecks.setdefault(order["order_num"], {"workers": 0, "equipments": 0})
                                if w_busy_cnt >= eq_busy_cnt:
                                    order_bottlenecks[order["order_num"]]["workers"] += 1
                                else:
                                    order_bottlenecks[order["order_num"]]["equipments"] += 1
                                continue
                            alloc_mask = _left_pack_mask(free_mask, take)
                    else:
                        # 대규모 작업: Left Pack으로 가용 슬롯 최대한 채움
                        take = min(total_avail, req_elapsed)
                        alloc_mask = _left_pack_mask(free_mask, take)

                    alloc_slots = _slots_from_mask(alloc_mask)
                    if not alloc_slots:
                        continue

                    # 자원 점유 기록
                    for w in assigned_workers:
                        worker_mask[curr_date][w] |= alloc_mask
                        # Worker Score 추적: 당일 작업 분 및 마지막 슬롯 갱신
                        slot_count = len(alloc_slots)
                        worker_day_load.setdefault(w, {})
                        worker_day_load[w][curr_date] = worker_day_load[w].get(curr_date, 0) + slot_count
                        worker_last_slot.setdefault(w, {})
                        if alloc_slots:
                            worker_last_slot[w][curr_date] = max(
                                worker_last_slot[w].get(curr_date, 0), alloc_slots[-1]
                            )
                    for eq in req_equips:
                        for m in alloc_slots:
                            equip_timeline[curr_date][eq][m] += 1

                    work_done = len(alloc_slots) * num_workers
                    remaining_mins[t_id] -= work_done
                    any_allocation = True

                    # 연속 세그먼트로 묶어서 output row 생성
                    segments: List[Tuple[int, int]] = []
                    s_m = p_m = alloc_slots[0]
                    for m in alloc_slots[1:]:
                        if m == p_m + 1:
                            p_m = m
                        else:
                            segments.append((s_m, p_m))
                            s_m = p_m = m
                    segments.append((s_m, p_m))

                    for seg_s, seg_e in segments:
                        base_dt     = datetime.combine(curr_date, dt_time(9, 0))
                        alloc_start = base_dt + timedelta(minutes=seg_s)
                        alloc_end   = base_dt + timedelta(minutes=seg_e + 1)
                        seg_duration = seg_e - seg_s + 1
                        status = (
                            "납기내완료"
                            if alloc_end.date() <= order["due_date"]
                            else "납기초과"
                        )
                        worker_strs = [
                            f"{w.upper()}({emp_names.get(w, 'UNKNOWN')})"
                            for w in assigned_workers
                        ]
                        schedule_rows.append({
                            "주문번호":    order["order_num"],
                            "제품명":      order["product_name"],
                            "수량":        order["quantity"],
                            "작업단계":    step,
                            "작업ID":      t["task_id"],
                            "작업명":      t["task_name"],
                            "작업구분":    t["task_type"],
                            "공장동":      t["factory"],
                            "필요장비":    t["equip_symbols"],
                            "배정직원":    ";".join(worker_strs),
                            "시작일":      alloc_start.strftime("%Y-%m-%d %H:%M:%S"),
                            "종료일":      alloc_end.strftime("%Y-%m-%d %H:%M:%S"),
                            "작업시간_분": seg_duration,
                            "납기일":      order["due_date"].strftime("%Y-%m-%d"),
                            "납기상태":    status,
                        })

                # 완료 여부 체크
                if all(rem <= 0 for rem in remaining_mins.values()):
                    step_completed  = True
                    actual_step_end = curr_date
                    for t in tasks:
                        task_done_date[t["task_id"]] = curr_date
                else:
                    curr_date = _next_workday(curr_date)

            order["current_date"] = _next_workday(actual_step_end)

    # ──────────────────────────────────────────────────────────────────────────
    # 11.5. Dynamic Repacking — Forward 결과 Idle Gap 압축
    # ──────────────────────────────────────────────────────────────────────────
    #
    # 동일 주문·작업자·날짜 내 세그먼트 간 Idle Gap을 제거하여
    # 연속 블록으로 압축. 자원 마스크가 이미 확정된 상태이므로
    # 시작 시각만 재계산하는 경량 후처리.
    def _repack_schedule(rows: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        # (주문번호, 작업ID, 날짜) 기준 세그먼트 그룹화
        groups: Dict = defaultdict(list)
        for idx, row in enumerate(rows):
            key = (row["주문번호"], row["작업ID"], row["시작일"][:10])
            groups[key].append((idx, row))

        for key, items in groups.items():
            if len(items) <= 1:
                continue
            # 시작 시각 오름차순 정렬
            items.sort(key=lambda x: x[1]["시작일"])
            # 첫 세그먼트 시작 시각 기준으로 압축
            base_dt = datetime.strptime(items[0][1]["시작일"], "%Y-%m-%d %H:%M:%S")
            cursor  = base_dt
            for orig_idx, row in items:
                dur_m = row["작업시간_분"]
                new_start = cursor
                new_end   = cursor + timedelta(minutes=dur_m)
                # 점심(12:00–13:00) 건너뜀
                lunch_s = base_dt.replace(hour=12, minute=0, second=0)
                lunch_e = base_dt.replace(hour=13, minute=0, second=0)
                if new_start < lunch_e and new_end > lunch_s:
                    if new_start < lunch_s:
                        overflow = (new_end - lunch_s).seconds // 60
                        new_end  = lunch_e + timedelta(minutes=overflow)
                    else:
                        new_start = lunch_e
                        new_end   = lunch_e + timedelta(minutes=dur_m)
                rows[orig_idx]["시작일"] = new_start.strftime("%Y-%m-%d %H:%M:%S")
                rows[orig_idx]["종료일"] = new_end.strftime("%Y-%m-%d %H:%M:%S")
                cursor = new_end
        return rows

    schedule_rows = _repack_schedule(schedule_rows)
    logger.info("Dynamic Repacking 완료 — Idle Gap 압축 적용됨.")

    # ──────────────────────────────────────────────────────────────────────────
    # 11.7. Gap Fitting — 작업자 Idle Gap에 잔여 작업 Best Fit 삽입
    # ──────────────────────────────────────────────────────────────────────────
    def _gap_fit(rows: List[Dict]) -> List[Dict]:
        """
        각 (작업자, 날짜) 쌍의 idle 구간을 스캔하여
        해당 날짜에 아직 시작 안 된 작업 세그먼트 중 Best Fit을 삽입.
        Best Fit = gap에 딱 맞거나 조금 작은 것 중 가장 큰 작업.
        """
        # (날짜, 작업자) → 점유 마스크 재구성
        wm: Dict[str, Dict[str, int]] = {}   # date_str → worker → mask
        for row in rows:
            d_str = row["시작일"][:10]
            try:
                s_dt = datetime.strptime(row["시작일"], "%Y-%m-%d %H:%M:%S")
                e_dt = datetime.strptime(row["종료일"], "%Y-%m-%d %H:%M:%S")
            except Exception:
                continue
            s_slot = (s_dt.hour - 9) * 60 + s_dt.minute
            e_slot = (e_dt.hour - 9) * 60 + e_dt.minute
            duration = max(0, e_slot - s_slot)
            if duration <= 0:
                continue
            for w_str in row["배정직원"].split(";"):
                w_id = w_str.split("(")[0].strip().lower()
                wm.setdefault(d_str, {})
                wm[d_str][w_id] = wm[d_str].get(w_id, _LUNCH_MASK) | _make_run_mask(s_slot, duration)

        # 납기 초과 주문의 마지막 종료일(최대 end) 계산
        order_end: Dict[str, str] = {}
        for row in rows:
            onum = row["주문번호"]
            if onum not in order_end or row["종료일"] > order_end[onum]:
                order_end[onum] = row["종료일"]

        added_rows: List[Dict] = []
        for d_str, w_masks in sorted(wm.items()):
            try:
                day_date = datetime.strptime(d_str, "%Y-%m-%d").date()
            except Exception:
                continue
            base_dt = datetime.combine(day_date, dt_time(9, 0))

            for w_id, occ_mask in w_masks.items():
                free_mask_gf = WORK_MASK & ~occ_mask
                if not free_mask_gf:
                    continue
                runs = _find_contiguous_runs(free_mask_gf)
                if not runs:
                    continue

                # 이 날짜 이후에 납기 초과 가능한 주문의 작업을 후보로 수집
                candidates: List[Dict] = []
                for row in rows:
                    onum = row["주문번호"]
                    if row["납기상태"] != "납기초과":
                        continue
                    try:
                        row_start = datetime.strptime(row["시작일"], "%Y-%m-%d %H:%M:%S").date()
                    except Exception:
                        continue
                    if row_start < day_date:
                        # 이 날보다 일찍 시작된 작업 → 이동 후보
                        dur_m = row["작업시간_분"]
                        if dur_m > 0:
                            candidates.append({"dur": dur_m, "row": row})

                if not candidates:
                    continue

                for run_start, run_len in runs:
                    if run_len < 5:   # 5분 미만 갭은 무시
                        continue
                    # Best Fit: gap에 들어갈 수 있는 것 중 가장 큰 dur
                    fits = [c for c in candidates if c["dur"] <= run_len]
                    if not fits:
                        continue
                    best = max(fits, key=lambda c: c["dur"])
                    dur_m = best["dur"]
                    src_row = best["row"]

                    new_start = base_dt + timedelta(minutes=run_start)
                    new_end   = new_start + timedelta(minutes=dur_m)
                    status = (
                        "납기내완료"
                        if new_end.date() <= datetime.strptime(src_row["납기일"], "%Y-%m-%d").date()
                        else "납기초과"
                    )
                    added_rows.append({
                        **src_row,
                        "시작일":      new_start.strftime("%Y-%m-%d %H:%M:%S"),
                        "종료일":      new_end.strftime("%Y-%m-%d %H:%M:%S"),
                        "작업시간_분": dur_m,
                        "납기상태":    status,
                        "배정직원":    src_row["배정직원"],
                    })
                    # 사용한 후보 제거 (같은 row 중복 삽입 방지)
                    candidates = [c for c in candidates if c["row"] is not src_row]
                    # 점유 마스크 업데이트
                    occ_mask |= _make_run_mask(run_start, dur_m)
                    wm[d_str][w_id] = occ_mask

        if added_rows:
            logger.info(f"Gap Fitting: {len(added_rows)}개 세그먼트 삽입")
        return rows + added_rows

    # NOTE: _gap_fit 비활성화 — 현재 구현이 행을 move가 아닌 copy하여
    # 원본 행이 남아 max 종료일이 늘어나는 버그 존재. Local Search로 대체.
    # schedule_rows = _gap_fit(schedule_rows)


    # ──────────────────────────────────────────────────────────────────────────
    # 11.8. Local Search — Move: 납기 초과 작업을 더 이른 슬롯으로 이동
    # ──────────────────────────────────────────────────────────────────────────
    def _local_search_move(rows: List[Dict], max_iter: int = 30) -> List[Dict]:
        """
        납기 초과 주문의 작업 행을 더 이른 (날짜, 슬롯)으로 이동하여
        tardiness 합을 줄이는 Move 연산.
        개선 시에만 적용, 개선이 없으면 조기 종료.
        """
        def _tardiness(rows: List[Dict]) -> float:
            return _calc_tardiness(rows)

        def _rebuild_wm(rows: List[Dict]) -> Dict[str, Dict[str, int]]:
            """(date_str, worker) → 점유 비트마스크 재구성."""
            wm: Dict[str, Dict[str, int]] = {}
            for row in rows:
                d_str = row["시작일"][:10]
                try:
                    s_dt = datetime.strptime(row["시작일"], "%Y-%m-%d %H:%M:%S")
                    e_dt = datetime.strptime(row["종료일"], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    continue
                s_slot = (s_dt.hour - 9) * 60 + s_dt.minute
                e_slot = (e_dt.hour - 9) * 60 + e_dt.minute
                duration = max(0, e_slot - s_slot)
                if duration <= 0:
                    continue
                for w_str in row["배정직원"].split(";"):
                    w_id = w_str.split("(")[0].strip().lower()
                    wm.setdefault(d_str, {})
                    wm[d_str][w_id] = wm[d_str].get(w_id, _LUNCH_MASK) | _make_run_mask(s_slot, duration)
            return wm

        current_tardiness = _tardiness(rows)
        if current_tardiness == 0:
            return rows   # 이미 전부 납기 내 완료

        improved = True
        iteration = 0
        while improved and iteration < max_iter:
            improved = False
            iteration += 1

            # 납기 초과 주문 행: 종료일이 가장 늦은 것 우선
            late_rows_idx = [
                i for i, r in enumerate(rows)
                if r.get("납기상태") == "납기초과"
            ]
            if not late_rows_idx:
                break

            # 종료일 내림차순 정렬 (가장 늦은 작업 우선 시도)
            late_rows_idx.sort(key=lambda i: rows[i]["종료일"], reverse=True)

            wm = _rebuild_wm(rows)
            all_dates = sorted(set(r["시작일"][:10] for r in rows))

            for idx in late_rows_idx[:10]:   # 최대 10행씩 시도
                row = rows[idx]
                dur_m = row["작업시간_분"]
                if dur_m <= 0:
                    continue

                try:
                    cur_start_dt = datetime.strptime(row["시작일"], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    continue

                workers_in_row = [
                    w_str.split("(")[0].strip().lower()
                    for w_str in row["배정직원"].split(";")
                    if w_str.strip()
                ]
                if not workers_in_row:
                    continue

                due_date_str = row["납기일"]
                try:
                    due_d = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                except Exception:
                    continue

                # 현재 날짜보다 이전 날짜들을 탐색
                moved = False
                for d_str in all_dates:
                    if d_str >= cur_start_dt.strftime("%Y-%m-%d"):
                        continue   # 같은 날이나 이후는 스킵
                    try:
                        day_date = datetime.strptime(d_str, "%Y-%m-%d").date()
                    except Exception:
                        continue

                    # 모든 배정 작업자의 free mask 교집합
                    combined_occ = 0
                    for w_id in workers_in_row:
                        combined_occ |= wm.get(d_str, {}).get(w_id, _LUNCH_MASK)
                    free_m = WORK_MASK & ~combined_occ

                    run_start = _find_contiguous_start(free_m, dur_m)
                    if run_start < 0:
                        continue   # 이 날에는 연속 블록 없음

                    base_dt   = datetime.combine(day_date, dt_time(9, 0))
                    new_start = base_dt + timedelta(minutes=run_start)
                    new_end   = new_start + timedelta(minutes=dur_m)
                    new_status = (
                        "납기내완료" if new_end.date() <= due_d else "납기초과"
                    )

                    # 임시 적용 후 tardiness 재계산
                    old_start = rows[idx]["시작일"]
                    old_end   = rows[idx]["종료일"]
                    old_status = rows[idx]["납기상태"]
                    rows[idx]["시작일"]   = new_start.strftime("%Y-%m-%d %H:%M:%S")
                    rows[idx]["종료일"]   = new_end.strftime("%Y-%m-%d %H:%M:%S")
                    rows[idx]["납기상태"] = new_status

                    new_tardiness = _tardiness(rows)
                    if new_tardiness < current_tardiness:
                        # 개선 → 수용
                        current_tardiness = new_tardiness
                        improved = True
                        moved = True
                        logger.debug(
                            f"LS-Move 수용: {row['주문번호']}/{row['작업ID']} "
                            f"{old_start[:10]} → {d_str}  tardiness {new_tardiness:.1f}"
                        )
                        break   # 이 행에 대해 첫 개선 발견 시 다음 행으로
                    else:
                        # 롤백
                        rows[idx]["시작일"]   = old_start
                        rows[idx]["종료일"]   = old_end
                        rows[idx]["납기상태"] = old_status

                if moved:
                    break   # 1개라도 개선됐으면 마스크 재구성 후 다음 iter

        logger.info(
            f"Local Search Move 완료: {iteration}회 반복, "
            f"최종 tardiness={current_tardiness:.1f}일"
        )
        return rows

    schedule_rows = _local_search_move(schedule_rows, max_iter=30)

    # ──────────────────────────────────────────────────────────────────────────
    # 11.6. 지연 원인 후처리 (Post-processing)
    # ──────────────────────────────────────────────────────────────────────────
    order_final_dates = {}
    for row in schedule_rows:
        onum = row["주문번호"]
        try:
            end_d = datetime.strptime(row["종료일"], "%Y-%m-%d %H:%M:%S").date()
        except Exception:
            end_d = start_date
        if onum not in order_final_dates or end_d > order_final_dates[onum]:
            order_final_dates[onum] = end_d

    for row in schedule_rows:
        onum = row["주문번호"]
        try:
            due_d = datetime.strptime(row["납기일"], "%Y-%m-%d").date()
        except Exception:
            due_d = start_date
        final_d = order_final_dates.get(onum, due_d)
        
        if final_d <= due_d:
            row["지연원인"] = "정상 완료"
        else:
            stats = order_bottlenecks.get(onum, {"workers": 0, "equipments": 0})
            if stats["workers"] == 0 and stats["equipments"] == 0:
                row["지연원인"] = "작업량 과다 (단순 일정 포화)"
            elif stats["workers"] > stats["equipments"]:
                row["지연원인"] = "자격 작업자 부족 (공장별 필수 안전교육 미이수)"
            else:
                row["지연원인"] = "장비 용량 부족 (해당 공정 가용 장비 부족)"

    # ──────────────────────────────────────────────────────────────────────────
    # 12. 결과 DataFrame 조립
    # ──────────────────────────────────────────────────────────────────────────
    result_df = pd.DataFrame(schedule_rows)
    if not result_df.empty:
        result_df = result_df.sort_values(
            by=["주문번호", "작업단계", "작업ID"]
        ).reset_index(drop=True)
        result_df.insert(
            0, "일정ID",
            result_df.index.map(lambda i: f"SCH{i + 1:04d}")
        )

    return result_df
