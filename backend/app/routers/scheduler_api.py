from typing import List
from fastapi import APIRouter, status

from app.schemas.scheduler import (
    EmployeeCreate, EmployeeResponse,
    OrderCreate, OrderResponse,
    TaskCreate, TaskResponse,
    ScheduleCreate, ScheduleResponse,
    ScheduleAssignmentCreate, ScheduleAssignmentResponse,
    SafetyTrainingCreate, SafetyTrainingResponse,
    EquipmentCreate, EquipmentResponse,
    DocumentCreate, DocumentResponse
)

router = APIRouter(prefix="/api", tags=["Manufacturing Scheduler (API Stubs)"])


# ─── Employee Endpoints ───────────────────────────────────────
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


# ─── Order Endpoints ──────────────────────────────────────────
@router.get("/orders", response_model=List[OrderResponse], summary="주문 목록 조회")
def get_orders():
    """등록된 모든 생산 주문 목록을 조회합니다. (API 스텁)"""
    return []

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


# ─── Task Endpoints ───────────────────────────────────────────
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


# ─── Schedule Endpoints ───────────────────────────────────────
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


# ─── Schedule Assignment Endpoints ────────────────────────────
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


# ─── Safety Training Endpoints ────────────────────────────────
@router.get("/safety-trainings", response_model=List[SafetyTrainingResponse], summary="안전 교육 관리 내역 조회")
def get_safety_trainings():
    """직원들의 안전 교육 이수 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/safety-trainings", response_model=SafetyTrainingResponse, status_code=status.HTTP_201_CREATED, summary="안전 교육 내역 등록")
def create_safety_training(training: SafetyTrainingCreate):
    """새로운 안전 교육 이수 내역을 등록합니다. (API 스텁)"""
    return {
        "training_id": training.training_id,
        "emp_id": training.emp_id,
        "training_name": training.training_name,
        "training_date": training.training_date,
        "expired_date": training.expired_date,
        "training_status": training.training_status
    }


# ─── Equipment Endpoints ──────────────────────────────────────
@router.get("/equipments", response_model=List[EquipmentResponse], summary="설비 및 장비 목록 조회")
def get_equipments():
    """공장 설비 및 생산 장비 목록을 조회합니다. (API 스텁)"""
    return []

@router.post("/equipments", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED, summary="설비 및 장비 등록")
def create_equipment(equipment: EquipmentCreate):
    """새로운 생산 장비를 등록합니다. (API 스텁)"""
    return {
        "eq_id": "eq_new",
        "eq_name": equipment.eq_name,
        "eq_count": equipment.eq_count,
        "available_eq_count": equipment.available_eq_count,
        "check_cycle": equipment.check_cycle,
        "eq_status": equipment.eq_status,
        "check_date": equipment.check_date,
        "recent_check_date": equipment.recent_check_date
    }


# ─── Document Endpoints ───────────────────────────────────────
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
