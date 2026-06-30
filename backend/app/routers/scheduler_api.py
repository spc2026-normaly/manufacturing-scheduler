from typing import List, Optional
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, status, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.scheduler import (
    EmployeeCreate, EmployeeResponse,
    OrderCreate, OrderResponse,
    TaskCreate, TaskResponse,
    ScheduleCreate, ScheduleResponse,
    CalendarScheduleResponse,
    ScheduleAssignmentCreate, ScheduleAssignmentResponse,
    DocumentCreate, DocumentResponse
)

# hasattr

router = APIRouter(prefix="/api", tags=["Manufacturing Scheduler (API Stubs)"])


def _to_factory_label(factory: str) -> str:
    if factory.endswith("공장동"):
        return factory
    if factory.endswith("동"):
        return f"{factory[:-1]}공장동"
    return f"{factory}공장동"


def _compute_range(view: str, base_date: date) -> tuple[datetime, datetime]:
    if view == "day":
        start_dt = datetime.combine(base_date, time.min)
        end_dt = datetime.combine(base_date, time.max)
        return start_dt, end_dt

    if view == "week":
        monday = base_date - timedelta(days=base_date.weekday())
        sunday = monday + timedelta(days=6)
        start_dt = datetime.combine(monday, time.min)
        end_dt = datetime.combine(sunday, time.max)
        return start_dt, end_dt

    if view == "month":
        first_day = base_date.replace(day=1)
        first_monday = first_day - timedelta(days=first_day.weekday())

        if first_day.month == 12:
            next_first = first_day.replace(year=first_day.year + 1, month=1, day=1)
        else:
            next_first = first_day.replace(month=first_day.month + 1, day=1)
        last_day = next_first - timedelta(days=1)
        last_sunday = last_day + timedelta(days=6 - last_day.weekday())

        start_dt = datetime.combine(first_monday, time.min)
        end_dt = datetime.combine(last_sunday, time.max)
        return start_dt, end_dt

    raise HTTPException(status_code=400, detail="view는 month/week/day 중 하나여야 합니다.")


# ─────────────── Employee Endpoints ───────────────────────────────────────
@router.get("/employees", response_model=List[EmployeeResponse], summary="직원 목록 조회")
def get_employees():
    """등록된 모든 직원 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, summary="직원 등록")
def create_employee(employee: EmployeeCreate):
    """새로운 직원을 등록합니다. (API 스텁)"""
    return {
        "emp_id": "emp_new",
        "login_id": employee.login_id,
        "emp_name": employee.emp_name,
        "emp_role": employee.emp_role,
        "emp_date": employee.emp_date
    }


# ─────────────── Order Endpoints ──────────────────────────────────────────
@router.get("/orders", response_model=List[OrderResponse], summary="주문 목록 조회")
def get_orders(db: Session = Depends(get_db)):
    """등록된 모든 생산 주문 목록을 조회합니다."""
    sql = """
    SELECT order_id, order_num, product_name, order_count, due_date, order_status
    FROM orders
    ORDER BY order_num ASC
    """
    rows = db.execute(text(sql)).mappings().all()
    return [
        {
            "order_id": row["order_id"],
            "order_num": row["order_num"],
            "product_name": row["product_name"],
            "order_count": row["order_count"],
            "due_date": row["due_date"],
            "order_status": row["order_status"]
        }
        for row in rows
    ]

@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, summary="주문 등록")
def create_order(order: OrderCreate):
    """새로운 생산 주문을 등록합니다. (API 스텁)"""
    return {
        "order_id": "ord_new",
        "order_num": order.order_num,
        "product_name": order.product_name,
        "order_count": order.order_count,
        "due_date": order.due_date,
        "order_status": order.order_status
    }


# ─────────────── Task Endpoints ───────────────────────────────────────────
@router.get("/tasks", response_model=List[TaskResponse], summary="작업 목록 조회")
def get_tasks():
    """공정 흐름별 세부 작업 정의 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, summary="작업 등록")
def create_task(task: TaskCreate):
    """새로운 세부 작업을 정의합니다. (API 스텁)"""
    return {
        "task_id": "tsk_new",
        "task_level": task.task_level,
        "task_name": task.task_name,
        "task_type": task.task_type,
        "task_time": task.task_time
    }

# ─────────────── Document Endpoints ───────────────────────────────────────
@router.get("/documents", response_model=List[DocumentResponse], summary="업로드 문서 목록 조회")
def get_documents():
    """업로드된 문서 및 임베딩 처리 상태를 조회합니다. (API 스텁)"""
    return []

@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="문서 정보 등록")
def create_document(document: DocumentCreate):
    """신규로 업로드한 문서 메타 정보를 등록합니다. (API 스텁)"""
    return {
        "file_id": document.file_id,
        "uploader": document.uploader,
        "file_name": document.file_name,
        "file_size": document.file_size,
        "file_extension": document.file_extension,
        "file_path": document.file_path,
        "is_template": document.is_template,
        "file_created_at": document.file_created_at,
        "file_updated_at": document.file_updated_at,
        "embedding_date": document.embedding_date,
        "embedding_status": document.embedding_status
    }


# ─────────────── Schedule Endpoints ───────────────────────────────────────
@router.get(
    "/schedules/calendar",
    response_model=List[CalendarScheduleResponse],
    summary="캘린더 일정 조회"
)
def get_calendar_schedules(
    view: str = Query("month", description="month | week | day"),
    date_param: Optional[date] = Query(None, alias="date", description="기준일 (YYYY-MM-DD)"),
    factory: Optional[str] = Query(None, description="공장동 필터 (예: A공장동)"),
    order_num: Optional[str] = Query(None, description="주문번호 필터 (예: PO001)"),
    db: Session = Depends(get_db),
):
    base_date = date_param or date(2026, 7, 1)
    start_dt, end_dt = _compute_range(view=view, base_date=base_date)

    sql = """
    SELECT
        s.id,
        s.factory,
        t.task_name,
        t.product_category AS task_type,
        o.product_name,
        o.order_num,
        s.start_date,
        s.end_date,
        COALESCE(string_agg(DISTINCT e.eq_name, ', ' ORDER BY e.eq_name), '') AS equipment,
        array_remove(array_agg(DISTINCT emp.emp_name ORDER BY emp.emp_name), NULL) AS workers
    FROM schedules s
    JOIN task t ON t.task_id = s.task_id
    JOIN orders o ON o.order_id = s.order_id
    LEFT JOIN schedule_assignments sa
      ON sa.id = s.id
     AND sa.task_id = s.task_id
     AND sa.order_id = s.order_id
    LEFT JOIN employees emp ON emp.emp_id = sa.user_id
    LEFT JOIN required_equipments re ON re.task_id = s.task_id
    LEFT JOIN equipments e ON e.eq_id = re.eq_id
    WHERE s.start_date <= :end_dt
      AND s.end_date >= :start_dt
      AND (:factory_raw IS NULL OR s.factory = :factory_raw)
      AND (:order_num IS NULL OR o.order_num = :order_num)
    GROUP BY s.id, s.factory, t.task_name, t.product_category, o.product_name, o.order_num, s.start_date, s.end_date
    ORDER BY s.start_date ASC, s.id ASC
    """

    # 프론트 필터값(A공장동)과 DB값(A동)을 맞춘다.
    factory_raw = None
    if factory:
        factory_raw = factory.replace("공장동", "동")

    rows = db.execute(
        text(sql),
        {
            "start_dt": start_dt,
            "end_dt": end_dt,
            "factory_raw": factory_raw,
            "order_num": order_num,
        },
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "facility": _to_factory_label(row["factory"]),
            "task_name": row["task_name"],
            "task_type": row["task_type"],
            "equipment": row["equipment"],
            "workers": row["workers"] or [],
            "product": row["product_name"],
            "order_num": row["order_num"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
        }
        for row in rows
    ]


@router.get("/schedules/summary", summary="공장별 일정 요약")
def get_schedules_summary(
    date_param: Optional[date] = Query(None, alias="date", description="기준일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    base_date = date_param or date(2026, 7, 1)

    first_day = base_date.replace(day=1)
    first_monday = first_day - timedelta(days=first_day.weekday())

    if first_day.month == 12:
        next_first = first_day.replace(year=first_day.year + 1, month=1, day=1)
    else:
        next_first = first_day.replace(month=first_day.month + 1, day=1)
    last_day = next_first - timedelta(days=1)
    last_sunday = last_day + timedelta(days=6 - last_day.weekday())

    start_dt = datetime.combine(first_monday, time.min)
    end_dt = datetime.combine(last_sunday, time.max)

    sql = """
    SELECT s.factory, COUNT(DISTINCT s.id) as task_count
    FROM schedules s
    WHERE s.start_date <= :end_dt
      AND s.end_date >= :start_dt
    GROUP BY s.factory
    """

    rows = db.execute(
        text(sql),
        {
            "start_dt": start_dt,
            "end_dt": end_dt
        }
    ).mappings().all()

    factories = {
        "A공장동": 0, "B공장동": 0, "C공장동": 0, "D공장동": 0,
        "E공장동": 0, "F공장동": 0, "G공장동": 0
    }

    total = 0
    for row in rows:
        fac = row["factory"]
        count = row["task_count"]
        fac_label = _to_factory_label(fac)
        factories[fac_label] = count
        total += count

    return {
        "total": total,
        "factories": factories
    }


@router.get("/schedules/analytics", summary="생산 일정 상세 분석 (이용률·병목·위험주문)")
def get_schedules_analytics(
    date_param: Optional[date] = Query(None, alias="date", description="기준 월 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    월별 생산 일정 상세 분석 API.
    반환 항목:
      - worker_utilization  : 작업자별 이용률 (%)
      - equipment_utilization: 장비별 이용률 (%)
      - avg_idle_minutes    : 평균 Idle 시간 (분)
      - bottleneck_tasks    : 병목 공정 Top 5 (대기시간 기준)
      - at_risk_orders      : 납기 위험 주문 (잔여 납기 ≤ 3일)
      - on_time_rate        : 납기 준수율 (%)
      - makespan_days       : 전체 일정 기간 (일)
    """
    base_date = date_param or date(2026, 7, 1)
    first_day = base_date.replace(day=1)
    if first_day.month == 12:
        next_first = first_day.replace(year=first_day.year + 1, month=1, day=1)
    else:
        next_first = first_day.replace(month=first_day.month + 1, day=1)
    last_day = next_first - timedelta(days=1)

    start_dt = datetime.combine(first_day, time.min)
    end_dt   = datetime.combine(last_day, time.max)
    # 월 근무 가용 시간: 영업일 × 7시간(점심 제외) = 약 22일 × 420분
    workdays_in_month = 22
    available_mins_per_person = workdays_in_month * 420  # 7h×60

    # ── 1. 작업자 이용률 ─────────────────────────────────────────────────────
    worker_sql = """
        SELECT sa.employee_id, SUM(s.duration_minutes) as worked_mins
        FROM schedule_assignments sa
        JOIN schedules s ON sa.schedule_id = s.id
        WHERE s.start_date >= :start_dt AND s.end_date <= :end_dt
        GROUP BY sa.employee_id
    """
    worker_rows = db.execute(text(worker_sql), {"start_dt": start_dt, "end_dt": end_dt}).mappings().all()
    emp_name_rows = db.execute(text("SELECT emp_id, emp_name FROM employees")).mappings().all()
    emp_names_map = {r["emp_id"]: r["emp_name"] for r in emp_name_rows}

    worker_utilization = []
    for r in worker_rows:
        emp_id   = r["employee_id"]
        worked   = r["worked_mins"] or 0
        pct      = round(min(worked / max(available_mins_per_person, 1) * 100, 100), 1)
        worker_utilization.append({
            "emp_id":   emp_id,
            "emp_name": emp_names_map.get(emp_id, emp_id),
            "worked_minutes": worked,
            "utilization_pct": pct,
        })
    worker_utilization.sort(key=lambda x: -x["utilization_pct"])

    # ── 2. 장비 이용률 ─────────────────────────────────────────────────────
    equip_sql = """
        SELECT s.equipment_id,
               SUM(s.duration_minutes) as used_mins,
               COUNT(DISTINCT DATE(s.start_date)) as used_days
        FROM schedules s
        WHERE s.start_date >= :start_dt AND s.end_date <= :end_dt
          AND s.equipment_id IS NOT NULL AND s.equipment_id != ''
        GROUP BY s.equipment_id
    """
    equip_rows = db.execute(text(equip_sql), {"start_dt": start_dt, "end_dt": end_dt}).mappings().all()
    equipment_utilization = []
    for r in equip_rows:
        eq_id  = r["equipment_id"]
        used   = r["used_mins"] or 0
        avail  = workdays_in_month * 420
        pct    = round(min(used / max(avail, 1) * 100, 100), 1)
        equipment_utilization.append({
            "equipment_id": eq_id,
            "used_minutes": used,
            "utilization_pct": pct,
        })
    equipment_utilization.sort(key=lambda x: -x["utilization_pct"])

    # ── 3. 공정별 평균 Idle / 대기시간 (병목 Top 5) ───────────────────────
    task_sql = """
        SELECT s.task_name, s.factory,
               AVG(s.duration_minutes) as avg_duration,
               COUNT(*) as task_count,
               SUM(s.duration_minutes) as total_mins
        FROM schedules s
        WHERE s.start_date >= :start_dt AND s.end_date <= :end_dt
        GROUP BY s.task_name, s.factory
        ORDER BY total_mins DESC
        LIMIT 10
    """
    task_rows = db.execute(text(task_sql), {"start_dt": start_dt, "end_dt": end_dt}).mappings().all()
    bottleneck_tasks = [
        {
            "task_name":     r["task_name"],
            "factory":       _to_factory_label(r["factory"]),
            "avg_duration":  round(r["avg_duration"] or 0, 1),
            "task_count":    r["task_count"],
            "total_minutes": r["total_mins"] or 0,
        }
        for r in task_rows[:5]
    ]

    # ── 4. 납기 위험 주문 (잔여 납기 ≤ 5일, 미완료) ────────────────────────
    today = date.today()
    risk_sql = """
        SELECT s.order_num, MAX(s.due_date) as due_date,
               MAX(s.end_date) as last_end,
               MAX(s.completion_status) as status
        FROM schedules s
        WHERE s.due_date >= :today
        GROUP BY s.order_num
        HAVING MAX(s.completion_status) != '납기내완료'
           OR MAX(s.completion_status) IS NULL
    """
    try:
        risk_rows = db.execute(text(risk_sql), {"today": today}).mappings().all()
    except Exception:
        # completion_status 컬럼 없는 경우 납기 컬럼만으로 처리
        risk_sql2 = """
            SELECT s.order_num, MAX(s.due_date) as due_date,
                   MAX(s.end_date) as last_end
            FROM schedules s
            WHERE s.due_date >= :today
            GROUP BY s.order_num
        """
        risk_rows = db.execute(text(risk_sql2), {"today": today}).mappings().all()

    at_risk_orders = []
    for r in risk_rows:
        due  = r["due_date"]
        if due is None:
            continue
        due_d = due if isinstance(due, date) else datetime.strptime(str(due)[:10], "%Y-%m-%d").date()
        remaining = (due_d - today).days
        if remaining <= 5:
            at_risk_orders.append({
                "order_num":       r["order_num"],
                "due_date":        str(due_d),
                "days_remaining":  remaining,
                "risk_level":      "위험" if remaining <= 2 else "경고",
            })
    at_risk_orders.sort(key=lambda x: x["days_remaining"])

    # ── 5. 납기 준수율 ─────────────────────────────────────────────────────
    ontime_sql = """
        SELECT
          COUNT(DISTINCT order_num) as total_orders,
          SUM(CASE WHEN MAX(end_date) <= MAX(due_date) THEN 1 ELSE 0 END) as ontime_count
        FROM (
          SELECT order_num, MAX(end_date) as end_date, MAX(due_date) as due_date
          FROM schedules
          WHERE start_date >= :start_dt AND end_date <= :end_dt
          GROUP BY order_num
        ) sub
    """
    try:
        ot = db.execute(text(ontime_sql), {"start_dt": start_dt, "end_dt": end_dt}).mappings().first()
        total_orders = ot["total_orders"] or 0
        ontime_count = ot["ontime_count"] or 0
        on_time_rate = round(ontime_count / max(total_orders, 1) * 100, 1)
    except Exception:
        on_time_rate = 0.0
        total_orders = 0

    # ── 6. Makespan ────────────────────────────────────────────────────────
    span_sql = """
        SELECT MIN(DATE(start_date)) as first_start,
               MAX(DATE(end_date))   as last_end
        FROM schedules
        WHERE start_date >= :start_dt AND end_date <= :end_dt
    """
    span = db.execute(text(span_sql), {"start_dt": start_dt, "end_dt": end_dt}).mappings().first()
    makespan_days = 0
    if span and span["first_start"] and span["last_end"]:
        try:
            fs = span["first_start"] if isinstance(span["first_start"], date) else datetime.strptime(str(span["first_start"]), "%Y-%m-%d").date()
            le = span["last_end"]    if isinstance(span["last_end"], date)    else datetime.strptime(str(span["last_end"]), "%Y-%m-%d").date()
            makespan_days = (le - fs).days + 1
        except Exception:
            pass

    return {
        "worker_utilization":    worker_utilization,
        "equipment_utilization": equipment_utilization,
        "bottleneck_tasks":      bottleneck_tasks,
        "at_risk_orders":        at_risk_orders,
        "on_time_rate":          on_time_rate,
        "total_orders":          total_orders,
        "makespan_days":         makespan_days,
        "avg_worker_utilization": round(
            sum(w["utilization_pct"] for w in worker_utilization) / max(len(worker_utilization), 1), 1
        ),
    }


@router.get("/schedules", response_model=List[ScheduleResponse], summary="생산 일정 목록 조회")
def get_schedules():
    """배정된 생산 일정 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/schedules", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED, summary="일정 등록")
def create_schedule(schedule: ScheduleCreate):
    """새로운 생산 일정을 등록합니다. (API 스텁)"""
    return {
        "id": schedule.id,
        "task_id": schedule.task_id,
        "order_id": schedule.order_id,
        "start_date": schedule.start_date,
        "end_date": schedule.end_date,
        "factory": schedule.factory
    }


# ─────────────── Schedule Assignment Endpoints ────────────────────────────
@router.get("/schedule-assignments", response_model=List[ScheduleAssignmentResponse], summary="일정별 작업자 배정 현황 조회")
def get_schedule_assignments():
    """생산 일정별로 배정된 작업자 매핑 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/schedule-assignments", response_model=ScheduleAssignmentResponse, status_code=status.HTTP_201_CREATED, summary="일정 작업자 배정")
def create_schedule_assignment(assignment: ScheduleAssignmentCreate):
    """특정 일정에 작업자를 배정합니다. (API 스텁)"""
    return {
        "id": assignment.id,
        "user_id": assignment.user_id,
        "task_id": assignment.task_id,
        "order_id": assignment.order_id
    }


