import math
import re
from datetime import date, timedelta, datetime
import pandas as pd
from typing import Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

def is_weekend(d: date) -> bool:
    """Checks if a date falls on a weekend."""
    return d.weekday() >= 5

def next_weekday(d: date) -> date:
    """Returns the next weekday after the given date."""
    curr = d + timedelta(days=1)
    while is_weekend(curr):
        curr += timedelta(days=1)
    return curr

def add_weekdays(start_date: date, days: int) -> date:
    """Adds weekdays to a start date."""
    curr = start_date
    added = 0
    while added < days:
        curr += timedelta(days=1)
        if not is_weekend(curr):
            added += 1
    return curr

def calculate_end_date(start_date: date, duration_days: int) -> date:
    """Calculates the end date of a task running for duration_days weekdays."""
    if duration_days <= 1:
        return start_date
    curr = start_date
    days_left = duration_days - 1
    while days_left > 0:
        curr += timedelta(days=1)
        if not is_weekend(curr):
            days_left -= 1
    return curr

def resolve_conflicts(
    db: Session,
    orders_df: pd.DataFrame,
    equip_df: pd.DataFrame,
    tasks_df: pd.DataFrame,
    qualified_workers: Dict[str, List[str]],
    daily_work_minutes: int = 480,
    start_date: date = None,
    work_days: List[int] = None
) -> pd.DataFrame:
    """
    Simulates scheduling step-by-step and day-by-day.
    Allocates task minutes to resources and shifts dates in case of overload.
    """
    if start_date is None:
        start_date = date.today()
    if work_days is None:
        work_days = [0, 1, 2, 3, 4] # Default Monday to Friday
        
    work_days_set = set(work_days)
    
    def is_workday(d: date) -> bool:
        return d.weekday() in work_days_set
        
    def next_workday(d: date) -> date:
        curr = d + timedelta(days=1)
        while not is_workday(curr):
            curr += timedelta(days=1)
        return curr
        
    # Collect all qualified employee IDs from qualified_workers (which already excludes emp000)
    valid_csv_emp_ids = set()
    for workers in qualified_workers.values():
        valid_csv_emp_ids.update(workers)

    # 1. Fetch employee names for formatting, filtering to only include workers from qualified_workers
    emp_rows = db.execute(text("SELECT emp_id, emp_name FROM employees")).mappings().all()
    emp_names = {
        row["emp_id"].lower().strip(): row["emp_name"] 
        for row in emp_rows 
        if row["emp_id"].lower().strip() in valid_csv_emp_ids
    }
    
    # 2. Map equipment symbol/name to ID and build available counts
    # E.g. '장비1' -> 'EQ001', '장비2' -> 'EQ002'
    equip_symbol_map = {}
    equip_capacities = {} # eq_id -> count
    for _, row in equip_df.iterrows():
        eq_id = str(row["장비ID"]).strip()
        eq_symbol = str(row["장비기호"]).strip()
        available_count = int(row["보유수량"]) # or available_eq_count
        equip_symbol_map[eq_symbol.lower()] = eq_id
        equip_capacities[eq_id] = available_count

    # 3. Prepare orders list
    # Sort orders by 주문번호 (PO001, PO002, ...)
    orders_df["order_num_clean"] = orders_df["주문번호"].apply(lambda x: str(x).strip())
    orders_df = orders_df.sort_values("order_num_clean")
    
    orders = []
    for _, row in orders_df.iterrows():
        order_num = str(row["주문번호"]).strip()
        product_name = str(row["제품명"]).strip()
        quantity = int(row["수량"])
        due_date_str = str(row["납기일"]).strip()
        due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
        
        # Determine product type (DRAM or NAND)
        product_type = "DRAM" if "DRAM" in product_name.upper() else "NAND"
        
        orders.append({
            "order_num": order_num,
            "product_name": product_name,
            "quantity": quantity,
            "due_date": due_date,
            "product_type": product_type,
            "current_date": start_date
        })

    # 4. Filter tasks and group them by step
    # We will build step tasks mapping for each product type
    product_tasks = {"DRAM": {}, "NAND": {}}
    
    for p_type in ("DRAM", "NAND"):
        # Filter tasks that apply to this product type
        filtered = tasks_df[
            (tasks_df["적용제품군"].str.strip() == "전체") | 
            (tasks_df["적용제품군"].str.strip().str.upper() == p_type.upper())
        ].copy()
        
        filtered["step_int"] = filtered["작업단계"].astype(int)
        grouped = filtered.groupby("step_int")
        
        for step, group in grouped:
            step_tasks = []
            for _, row in group.iterrows():
                task_id = str(row["작업ID"]).strip()
                task_name = str(row["작업명"]).strip()
                task_type = str(row["작업구분"]).strip()
                factory = str(row["사용공장동"]).strip()
                equip_symbols = [eq.strip() for eq in re.split(r"[;,/]+", str(row["필요장비"])) if eq.strip()]
                base_time = int(row["작업시간_분"])
                
                # Resolve equipment symbols to IDs
                req_equips = []
                for sym in equip_symbols:
                    eq_id = equip_symbol_map.get(sym.lower())
                    if eq_id:
                        req_equips.append(eq_id)
                
                step_tasks.append({
                    "task_id": task_id,
                    "task_name": task_name,
                    "task_type": task_type,
                    "factory": factory,
                    "equip_symbols": row["필요장비"],
                    "required_equipments": req_equips,
                    "base_time": base_time
                })
            product_tasks[p_type][step] = step_tasks

    # 5. Initialize resource load trackers
    # Date -> ResourceID -> minutes_allocated
    worker_daily_load: Dict[date, Dict[str, int]] = {}
    equip_daily_load: Dict[date, Dict[str, int]] = {}
    worker_total_load: Dict[str, int] = {} # emp_id -> total_allocated_minutes (for balancing)

    def get_load(dct, d, key):
        return dct.setdefault(d, {}).setdefault(key, 0)
        
    def add_load(dct, d, key, val):
        dct.setdefault(d, {})
        dct[d][key] = dct[d].get(key, 0) + val

    # 6. Schedule step-by-step
    schedule_rows = []
    
    # We loop through steps 1 to 12
    for step in range(1, 13):
        # We process active orders at this step
        for order in orders:
            p_type = order["product_type"]
            if step not in product_tasks[p_type]:
                continue
                
            tasks = product_tasks[p_type][step]
            if not tasks:
                continue
                
            order_start_date = order["current_date"]
            if not is_workday(order_start_date):
                order_start_date = next_workday(order_start_date)
                
            # Pre-assign workers for each task in this step
            task_assignments = {}
            for t in tasks:
                factory = t["factory"]
                eligible = qualified_workers.get(factory, [])
                if not eligible:
                    # Fallback to general employees
                    eligible = list(emp_names.keys())
                    
                # Determine max parallel workers (capped by equipment availability)
                req_equips = t["required_equipments"]
                max_workers = max(1, min(equip_capacities.get(eq, 1) for eq in req_equips)) if req_equips else 10
                num_workers_to_assign = min(len(eligible), max_workers)
                num_workers_to_assign = max(1, num_workers_to_assign)
                
                # Sort eligible workers by their total workload so far
                eligible_sorted = sorted(eligible, key=lambda emp: worker_total_load.get(emp, 0))
                assigned = eligible_sorted[:num_workers_to_assign]
                task_assignments[t["task_id"]] = assigned
                
                # Update total workload
                multiplier = math.ceil(order["quantity"] / 1000)
                task_duration = t["base_time"] * multiplier
                avg_duration = math.ceil(task_duration / len(assigned))
                for w in assigned:
                    worker_total_load[w] = worker_total_load.get(w, 0) + avg_duration

            # Simulate scheduling day-by-day starting from order_start_date
            curr_date = order_start_date
            step_completed = False
            
            # Remaining minutes for each task in the step
            multiplier = math.ceil(order["quantity"] / 1000)
            remaining_mins = {t["task_id"]: t["base_time"] * multiplier for t in tasks}
            
            # Track start and end date for each task in the step
            task_start_dates = {}
            task_end_dates = {}
            
            while not step_completed:
                if not is_workday(curr_date):
                    curr_date = next_workday(curr_date)
                    continue
                    
                # Check if we can allocate minutes on curr_date
                any_allocation_made = False
                
                for t in tasks:
                    t_id = t["task_id"]
                    rem = remaining_mins[t_id]
                    if rem <= 0:
                        continue
                        
                    assigned_workers = task_assignments[t_id]
                    req_equips = t["required_equipments"]
                    num_workers = len(assigned_workers)
                    
                    # Calculate maximum elapsed time we want to allocate on this day
                    req_elapsed = math.ceil(rem / num_workers)
                    
                    # 1. Limit by worker availability
                    w_avail_limit = req_elapsed
                    for w in assigned_workers:
                        w_load = get_load(worker_daily_load, curr_date, w)
                        w_avail = max(0, daily_work_minutes - w_load)
                        w_avail_limit = min(w_avail_limit, w_avail)
                        
                    # 2. Limit by equipment availability
                    eq_avail_limit = req_elapsed
                    for eq in req_equips:
                        eq_load = get_load(equip_daily_load, curr_date, eq)
                        eq_cap = equip_capacities.get(eq, 1) * daily_work_minutes
                        eq_avail = max(0, eq_cap - eq_load)
                        # Parallel workers use parallel equipments
                        eq_elapsed_limit = eq_avail // num_workers
                        eq_avail_limit = min(eq_avail_limit, eq_elapsed_limit)
                        
                    # Max we can allocate on this day
                    alloc_elapsed = min(w_avail_limit, eq_avail_limit)
                    
                    # Contiguous Scheduling Rule:
                    # If the remaining task duration is less than or equal to daily work minutes,
                    # we only schedule it if we can complete it in full on this day.
                    # Otherwise, if the task duration exceeds a single day, we allocate whatever is available.
                    if req_elapsed <= daily_work_minutes:
                        if alloc_elapsed < req_elapsed:
                            continue # Skip allocation today, wait for next workday when capacity is available
                    else:
                        if alloc_elapsed <= 0:
                            continue
                            
                    # Allocate if possible
                    if alloc_elapsed > 0:
                        work_done = min(rem, alloc_elapsed * num_workers)
                        
                        # Record start/end dates
                        if t_id not in task_start_dates:
                            task_start_dates[t_id] = curr_date
                        task_end_dates[t_id] = curr_date
                        
                        # Add load
                        for w in assigned_workers:
                            add_load(worker_daily_load, curr_date, w, alloc_elapsed)
                        for eq in req_equips:
                            add_load(equip_daily_load, curr_date, eq, work_done)
                            
                        remaining_mins[t_id] -= work_done
                        any_allocation_made = True
                
                # Check if all tasks in the step are finished
                if all(rem <= 0 for rem in remaining_mins.values()):
                    step_completed = True
                    actual_step_end = curr_date
                else:
                    # If we couldn't allocate anything on this day (deadlock/overload), we must shift day
                    curr_date = next_workday(curr_date)
            
            # Record the schedule for all tasks in this step
            for t in tasks:
                t_id = t["task_id"]
                assigned_workers = task_assignments[t_id]
                
                # Format worker string: "EMP001(김민수);EMP002(박지훈)"
                worker_strs = []
                for w in assigned_workers:
                    name = emp_names.get(w, "UNKNOWN")
                    # Format as EMP001 (capitalize ID)
                    worker_strs.append(f"{w.upper()}({name})")
                worker_formatted = ";".join(worker_strs)
                
                # Retrieve individual task start and end dates
                t_start = task_start_dates.get(t_id, order_start_date)
                t_end = task_end_dates.get(t_id, order_start_date)
                
                # Determine status based on this task's end date
                multiplier = math.ceil(order["quantity"] / 1000)
                task_duration = t["base_time"] * multiplier
                status = "납기내완료" if t_end <= order["due_date"] else "납기초과"
                
                schedule_rows.append({
                    "주문번호": order["order_num"],
                    "제품명": order["product_name"],
                    "수량": order["quantity"],
                    "작업단계": step,
                    "작업ID": t["task_id"],
                    "작업명": t["task_name"],
                    "작업구분": t["task_type"],
                    "공장동": t["factory"],
                    "필요장비": t["equip_symbols"],
                    "배정직원": worker_formatted,
                    "시작일": t_start.strftime("%Y-%m-%d"),
                    "종료일": t_end.strftime("%Y-%m-%d"),
                    "작업시간_분": task_duration,
                    "납기일": order["due_date"].strftime("%Y-%m-%d"),
                    "납기상태": status
                })
                
            # Set order's current date to the next weekday after this step's end date
            order["current_date"] = next_workday(actual_step_end)

    # 7. Convert to DataFrame and sort by order_num and step
    result_df = pd.DataFrame(schedule_rows)
    if not result_df.empty:
        # Add index column for 일정ID
        result_df = result_df.sort_values(by=["주문번호", "작업단계", "작업ID"]).reset_index(drop=True)
        result_df.insert(0, "일정ID", result_df.index.map(lambda idx: f"SCH{idx+1:04d}"))
        
    return result_df
