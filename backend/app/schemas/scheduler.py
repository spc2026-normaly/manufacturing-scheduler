from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ─── Employee Schemas ─────────────────────────────────────────
class EmployeeBase(BaseModel):
    login_id: str = Field(..., description="로그인 ID")
    emp_name: str = Field(..., description="직원 이름")
    emp_role: str = Field(..., description="직원 역할 (leader / member)")
    emp_date: date = Field(..., description="입사일")

class EmployeeCreate(EmployeeBase):
    login_pw: str = Field(..., description="로그인 비밀번호")

class EmployeeResponse(EmployeeBase):
    emp_id: str = Field(..., description="직원 ID")

    class Config:
        from_attributes = True


# ─── Order Schemas ────────────────────────────────────────────
class OrderBase(BaseModel):
    order_num: str = Field(..., description="주문 번호")
    product_name: str = Field(..., description="제품명")
    order_count: int = Field(..., description="주문 수량")
    due_date: date = Field(..., description="납기일")
    order_status: str = Field(..., description="주문 상태 (PENDING, PROCESSING, COMPLETED)")

class OrderCreate(OrderBase):
    pass

class OrderResponse(OrderBase):
    order_id: str = Field(..., description="주문 ID")

    class Config:
        from_attributes = True


# ─── Task Schemas ─────────────────────────────────────────────
class TaskBase(BaseModel):
    task_level: str = Field(..., description="작업 난이도 (상 / 중 / 하)")
    task_name: str = Field(..., description="작업명")
    task_type: str = Field(..., description="작업 타입 (Mixing, Fermentation, Baking, Packaging 등)")
    task_time: int = Field(..., description="작업 소요 시간 (분 단위)")

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    task_id: str = Field(..., description="작업 ID")

    class Config:
        from_attributes = True


# ─── Schedule Schemas ─────────────────────────────────────────
class ScheduleBase(BaseModel):
    start_date: datetime = Field(..., description="시작 일시")
    end_date: datetime = Field(..., description="종료 일시")
    factory: str = Field(..., description="생산 공장/라인 정보")

class ScheduleCreate(ScheduleBase):
    id: str = Field(..., description="일정 ID")
    task_id: str = Field(..., description="작업 ID")
    order_id: str = Field(..., description="주문 ID")

class ScheduleResponse(ScheduleBase):
    id: str = Field(..., description="일정 ID")
    task_id: str = Field(..., description="작업 ID")
    order_id: str = Field(..., description="주문 ID")

    class Config:
        from_attributes = True


class CalendarScheduleResponse(BaseModel):
    id: str = Field(..., description="일정 ID")
    facility: str = Field(..., description="공장동 (예: A공장동)")
    task_name: str = Field(..., description="작업명")
    task_type: str = Field(..., description="작업 구분")
    equipment: str = Field(..., description="필요 장비 문자열")
    workers: List[str] = Field(..., description="배정 작업자 이름 목록")
    product: str = Field(..., description="제품명")
    order_num: str = Field(..., description="주문번호")
    start_date: datetime = Field(..., description="시작 일시")
    end_date: datetime = Field(..., description="종료 일시")


# ─── Schedule Assignment Schemas ─────────────────────────────
class ScheduleAssignmentBase(BaseModel):
    pass

class ScheduleAssignmentCreate(ScheduleAssignmentBase):
    id: str = Field(..., description="일정 ID")
    user_id: str = Field(..., description="직원 ID")
    task_id: str = Field(..., description="작업 ID")
    order_id: str = Field(..., description="주문 ID")

class ScheduleAssignmentResponse(ScheduleAssignmentBase):
    id: str = Field(..., description="일정 ID")
    user_id: str = Field(..., description="직원 ID")
    task_id: str = Field(..., description="작업 ID")
    order_id: str = Field(..., description="주문 ID")

    class Config:
        from_attributes = True


# ─── Safety Training Schemas ──────────────────────────────────
class SafetyTrainingBase(BaseModel):
    training_name: str = Field(..., description="훈련/교육명")
    training_date: date = Field(..., description="교육 일자")
    expired_date: date = Field(..., description="만료 일자")
    training_status: str = Field(..., description="교육 이수 상태 (COMPLETED, PENDING 등)")

class SafetyTrainingCreate(SafetyTrainingBase):
    training_id: str = Field(..., description="교육 ID")
    emp_id: str = Field(..., description="직원 ID")

class SafetyTrainingResponse(SafetyTrainingBase):
    training_id: str = Field(..., description="교육 ID")
    emp_id: str = Field(..., description="직원 ID")

    class Config:
        from_attributes = True


# ─── Equipment Schemas ────────────────────────────────────────
class EquipmentBase(BaseModel):
    eq_name: str = Field(..., description="장비명")
    eq_count: int = Field(..., description="전체 장비 수")
    available_eq_count: int = Field(..., description="사용 가능한 장비 수")
    check_cycle: int = Field(..., description="점검 주기 (일 단위)")
    eq_status: str = Field("정상", description="장비 상태 (정상, 점검 필요 등)")
    check_date: date = Field(..., description="점검 일자")
    recent_check_date: date = Field(..., description="최근 점검 일자")
    durability: int = Field(0, description="내구도 (사용 횟수)")
    rest_duration: int = Field(0, description="장비 휴식 시간 (분 단위)")

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentResponse(EquipmentBase):
    eq_id: str = Field(..., description="장비 ID")

    class Config:
        from_attributes = True


# ─── Document Schemas ─────────────────────────────────────────
class DocumentBase(BaseModel):
    file_name: str = Field(..., description="파일명")
    file_size: int = Field(..., description="파일 크기 (바이트 단위)")
    file_extension: str = Field(..., description="파일 확장자 (pdf, docx, csv 등)")
    file_path: str = Field(..., description="저장 경로")
    is_template: bool = Field(False, description="템플릿 여부")
    file_created_at: datetime = Field(..., description="등록 일시")
    file_updated_at: datetime = Field(..., description="수정 일시")
    embedding_date: datetime = Field(..., description="임베딩 일시")
    embedding_status: str = Field(..., description="임베딩 진행 상태 (PENDING, COMPLETED, FAILED)")

class DocumentCreate(DocumentBase):
    file_id: str = Field(..., description="파일 ID")
    uploader: str = Field(..., description="업로더 직원 ID")

class DocumentResponse(DocumentBase):
    file_id: str = Field(..., description="파일 ID")
    uploader: str = Field(..., description="업로더 직원 ID")

    class Config:
        from_attributes = True
