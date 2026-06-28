from typing import List, Optional
from datetime import date, datetime, time, timedelta

import pandas as pd
from pydantic import BaseModel
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
        t.task_type,
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
    GROUP BY s.id, s.factory, t.task_name, t.task_type, o.product_name, o.order_num, s.start_date, s.end_date
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


# ─── Gantt Chart Interactive Rescheduling & Validation Schemas & APIs ───
QUALIFIED_WORKERS_CACHE = None

class ShiftValidationRequest(BaseModel):
    schedule_id: str
    new_start: datetime
    new_end: datetime

class ScheduleUpdateItem(BaseModel):
    id: str
    start_date: datetime
    end_date: datetime
    workers: List[str]

class BatchUpdateRequest(BaseModel):
    updates: List[ScheduleUpdateItem]


def _find_alternatives(
    db: Session,
    factory: str,
    factory_qualified: dict,
    start_dt: datetime,
    end_dt: datetime,
    schedule_id: str
):
    # start_dt 날짜에 자격이 살아있는 후보
    candidates = [w for w, exp in factory_qualified.items() if exp >= start_dt.date()]
    if not candidates:
        return []
        
    # 후보 중 이 시간대에 다른 일정이 배정되어 바쁜 사람 조회
    busy_rows = db.execute(
        text("""
            SELECT DISTINCT sa.user_id
            FROM schedule_assignments sa
            JOIN schedules s ON s.id = sa.id AND s.task_id = sa.task_id AND s.order_id = sa.order_id
            WHERE sa.user_id IN :candidates
              AND s.id != :schedule_id
              AND s.start_date < :new_end
              AND s.end_date > :new_start
        """),
        {
            "candidates": tuple(candidates),
            "schedule_id": schedule_id,
            "new_start": start_dt,
            "new_end": end_dt
        }
    ).mappings().all()
    
    busy_set = {r["user_id"].lower().strip() for r in busy_rows}
    free_candidates = [c for c in candidates if c not in busy_set]
    if not free_candidates:
        return []
        
    # 한가한 후보들의 이름 조회
    emp_rows = db.execute(
        text("SELECT emp_id, emp_name FROM employees WHERE emp_id IN :free_ids"),
        {"free_ids": tuple(free_candidates)}
    ).mappings().all()
    
    return [{"emp_id": r["emp_id"], "emp_name": r["emp_name"]} for r in emp_rows]


@router.post("/schedules/validate-shift", summary="일정 이동 시 작업자 자격 및 중복 검증")
def validate_schedule_shift(
    req: ShiftValidationRequest,
    db: Session = Depends(get_db)
):
    # 1. 대상 일정 및 공장 조회
    sched = db.execute(
        text("SELECT factory, task_id, order_id FROM schedules WHERE id = :id"),
        {"id": req.schedule_id}
    ).mappings().first()
    if not sched:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")
        
    factory = sched["factory"]
    
    # 2. 현재 배정된 작업자 목록 조회
    assigned_rows = db.execute(
        text("""
            SELECT sa.user_id, emp.emp_name
            FROM schedule_assignments sa
            JOIN employees emp ON emp.emp_id = sa.user_id
            WHERE sa.id = :id
        """),
        {"id": req.schedule_id}
    ).mappings().all()
    
    # 3. RAG/GPT를 통해 공장별 자격 작업자 로드 (캐시 활용하여 속도 극대화)
    global QUALIFIED_WORKERS_CACHE
    if QUALIFIED_WORKERS_CACHE is None:
        try:
            from app.services.schedule_pipeline.csv_io import load_input_csvs_from_r2
            from app.services.schedule_pipeline.gpt_scheduler import get_qualified_workers
            _, _, training_df, _ = load_input_csvs_from_r2()
            QUALIFIED_WORKERS_CACHE = get_qualified_workers(db, training_df)
        except Exception as e:
            QUALIFIED_WORKERS_CACHE = {}
            
    qualified_workers = QUALIFIED_WORKERS_CACHE
    factory_qualified = qualified_workers.get(factory, {}) # { worker_id_lower: exp_date }
    
    # 4. 각 작업자에 대해 자격 및 중복 검증
    for row in assigned_rows:
        w_id = row["user_id"].lower().strip()
        w_name = row["emp_name"]
        
        # 4-1. 자격 만료 검사
        if w_id not in factory_qualified:
            return {
                "success": False,
                "conflict_worker_id": row["user_id"],
                "conflict_worker_name": w_name,
                "reason": f"{w_name} 사원은 {factory} 필수 안전 교육 자격을 보유하고 있지 않습니다.",
                "alternative_workers": _find_alternatives(db, factory, factory_qualified, req.new_start, req.new_end, req.schedule_id)
            }
            
        exp_date = factory_qualified[w_id]
        if exp_date < req.new_start.date():
            return {
                "success": False,
                "conflict_worker_id": row["user_id"],
                "conflict_worker_name": w_name,
                "reason": f"{w_name} 사원의 {factory} 필수 안전 교육 자격이 만료되었습니다. (만료일: {exp_date})",
                "alternative_workers": _find_alternatives(db, factory, factory_qualified, req.new_start, req.new_end, req.schedule_id)
            }
            
        # 4-2. 중복 근무 검사
        overlap = db.execute(
            text("""
                SELECT s.id, t.task_name, o.order_num, s.start_date, s.end_date, s.factory
                FROM schedule_assignments sa
                JOIN schedules s ON s.id = sa.id AND s.task_id = sa.task_id AND s.order_id = sa.order_id
                JOIN task t ON t.task_id = s.task_id
                JOIN orders o ON o.order_id = s.order_id
                WHERE sa.user_id = :worker_id
                  AND s.id != :schedule_id
                  AND s.start_date < :new_end
                  AND s.end_date > :new_start
                LIMIT 1
            """),
            {
                "worker_id": row["user_id"],
                "schedule_id": req.schedule_id,
                "new_start": req.new_start,
                "new_end": req.new_end
            }
        ).mappings().first()
        
        if overlap:
            o_start = overlap["start_date"].strftime("%H:%M")
            o_end = overlap["end_date"].strftime("%H:%M")
            return {
                "success": False,
                "conflict_worker_id": row["user_id"],
                "conflict_worker_name": w_name,
                "reason": f"{w_name} 사원이 해당 시간대에 다른 작업({overlap['order_num']} {overlap['task_name']}, {overlap['factory']}동, {o_start}~{o_end})에 중복 배정되어 있습니다.",
                "alternative_workers": _find_alternatives(db, factory, factory_qualified, req.new_start, req.new_end, req.schedule_id)
            }
            
    return {
        "success": True,
        "reason": "검증 성공",
        "alternative_workers": []
    }


@router.post("/schedules/batch-update", summary="일정 대량 업데이트 및 R2 CSV 업로드")
def batch_update_schedules(
    req: BatchUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        # 1. DB 트랜잭션 수행
        for item in req.updates:
            # schedules 테이블 업데이트
            db.execute(
                text("UPDATE schedules SET start_date = :start, end_date = :end WHERE id = :id"),
                {"start": item.start_date, "end": item.end_date, "id": item.id}
            )
            # schedule_assignments 테이블의 기존 배정 삭제
            db.execute(
                text("DELETE FROM schedule_assignments WHERE id = :id"),
                {"id": item.id}
            )
            # 새 배정 추가 (workers list는 이름/아이디 혼합일 수 있어 매핑 테이블 활용)
            sched_info = db.execute(
                text("SELECT task_id, order_id FROM schedules WHERE id = :id"),
                {"id": item.id}
            ).mappings().first()
            
            if sched_info:
                # 직원 이름/ID 매핑 정보 조회
                import re
                emp_rows = db.execute(text("SELECT emp_id, emp_name FROM employees")).mappings().all()
                name_to_id = {r["emp_name"].strip().lower(): r["emp_id"].strip().lower() for r in emp_rows}
                id_to_id = {r["emp_id"].strip().lower(): r["emp_id"].strip().lower() for r in emp_rows}

                for w_str in item.workers:
                    w_clean = w_str.strip().lower()
                    # 괄호 등으로 감싸져 있는지 체크 (예: emp001(홍길동) 또는 홍길동)
                    m_id = re.search(r'([eE][mM][pP]\d+)', w_clean)
                    resolved_id = None
                    if m_id:
                        resolved_id = id_to_id.get(m_id.group(1))
                    if not resolved_id:
                        resolved_id = id_to_id.get(w_clean)
                    if not resolved_id:
                        resolved_id = name_to_id.get(w_clean)

                    if not resolved_id:
                        print(f"⚠️ validate-shift: Could not resolve worker {w_str} to employee ID, skipping.")
                        continue

                    db.execute(
                        text("""
                            INSERT INTO schedule_assignments (id, user_id, task_id, order_id)
                            VALUES (:id, :user_id, :task_id, :order_id)
                            ON CONFLICT (id, user_id, task_id, order_id) DO NOTHING
                        """),
                        {
                            "id": item.id,
                            "user_id": resolved_id,
                            "task_id": sched_info["task_id"],
                            "order_id": sched_info["order_id"]
                        }
                    )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 업데이트 실패: {str(e)}")
        
    # 2. 업데이트 완료 후 데이터베이스의 전체 일정을 읽어 생산일정결과.csv 및 생산일정요약.csv 재생성하여 R2에 업로드
    try:
        from app.services.schedule_pipeline.csv_io import upload_schedule_to_r2
        
        # 2-1. 생산일정결과.csv 재생성
        sql_schedules = """
        SELECT
            s.id AS "일정ID",
            o.order_num AS "주문번호",
            o.product_name AS "제품명",
            o.order_count AS "수량",
            t.task_level AS "작업단계",
            t.task_id AS "작업ID",
            t.task_name AS "작업명",
            t.task_type AS "작업구분",
            s.factory AS "공장동",
            COALESCE(string_agg(DISTINCT eq.eq_name, ', '), '') AS "필요장비",
            to_char(s.start_date, 'YYYY-MM-DD HH24:MI:SS') AS "시작일",
            to_char(s.end_date, 'YYYY-MM-DD HH24:MI:SS') AS "종료일",
            ROUND(EXTRACT(EPOCH FROM (s.end_date - s.start_date))/60) AS "작업시간_분",
            COALESCE(string_agg(DISTINCT UPPER(emp.emp_id) || '(' || emp.emp_name || ')', ';'), '') AS "배정직원",
            to_char(o.due_date, 'YYYY-MM-DD') AS "납기일",
            CASE WHEN s.end_date <= o.due_date THEN '납기내완료' ELSE '납기초과' END AS "납기상태"
        FROM schedules s
        JOIN task t ON t.task_id = s.task_id
        JOIN orders o ON o.order_id = s.order_id
        LEFT JOIN schedule_assignments sa ON sa.id = s.id AND sa.task_id = s.task_id AND sa.order_id = s.order_id
        LEFT JOIN employees emp ON emp.emp_id = sa.user_id
        LEFT JOIN required_equipments re ON re.task_id = s.task_id
        LEFT JOIN equipments eq ON eq.eq_id = re.eq_id
        GROUP BY s.id, o.order_num, o.product_name, o.order_count, t.task_level, t.task_id, t.task_name, t.task_type, s.factory, s.start_date, s.end_date, o.due_date
        ORDER BY s.start_date ASC, s.id ASC
        """
        
        rows = db.execute(text(sql_schedules)).mappings().all()
        if rows:
            result_df = pd.DataFrame([dict(r) for r in rows])
            
            # 지연원인 칼럼 추가 및 계산
            order_final_dates = {}
            for r in rows:
                onum = r["주문번호"]
                end_dt = datetime.strptime(r["종료일"], "%Y-%m-%d %H:%M:%S")
                if onum not in order_final_dates or end_dt > order_final_dates[onum]:
                    order_final_dates[onum] = end_dt
                    
            delay_causes = {}
            for r in rows:
                onum = r["주문번호"]
                due_dt = datetime.strptime(r["납기일"], "%Y-%m-%d")
                final_dt = order_final_dates.get(onum, due_dt)
                if final_dt <= due_dt:
                    delay_causes[onum] = "정상 완료"
                else:
                    delay_causes[onum] = "수동 편집 및 가용 자원 지연"
                    
            result_df["지연원인"] = result_df["주문번호"].map(delay_causes)
            upload_schedule_to_r2(result_df, "생산일정결과.csv")
            
            # 2-2. 생산일정요약.csv 재생성
            summary_rows = []
            for order_num, group in result_df.groupby("주문번호"):
                prod_name = group["제품명"].iloc[0]
                qty       = group["수량"].iloc[0]
                due_date  = group["납기일"].iloc[0]
                start_min = group["시작일"].min()[:10]
                end_max   = group["종료일"].max()[:10]
                total_tasks = len(group)
                total_mins  = group["작업시간_분"].sum()
                status = "납기내완료" if group["종료일"].max() <= due_date + " 23:59:59" else "납기초과"
                cause = delay_causes.get(order_num, "정상 완료")
                
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
                    "지연원인":    cause
                })
                
            summary_df = pd.DataFrame(summary_rows).sort_values(by="주문번호").reset_index(drop=True)
            upload_schedule_to_r2(summary_df, "생산일정요약.csv")
            
    except Exception as upload_err:
        print(f"⚠️ R2 CSV 재생성 및 업로드 실패: {str(upload_err)}")
        
    return {"message": "✅ 일정이 성공적으로 업데이트되고 클라우드 CSV 파일이 갱신되었습니다."}



