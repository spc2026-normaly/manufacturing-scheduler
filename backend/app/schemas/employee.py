from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class EmployeeCreate(BaseModel):
    """팀원 등록 요청 스키마"""
    emp_name: str = Field(..., description="직원 이름", min_length=1, max_length=100)
    login_id: str = Field(..., description="로그인 ID (고유)", min_length=2, max_length=50)
    login_pw: str = Field(..., description="비밀번호 (평문, 서버에서 해싱)", min_length=4)
    emp_role: str = Field("member", description="역할: leader | member")
    emp_date: date = Field(..., description="입사일 (YYYY-MM-DD)")


class EmployeeUpdate(BaseModel):
    """팀원 정보 수정 요청 스키마 (부분 수정 허용)"""
    emp_name: Optional[str] = Field(None, max_length=100)
    emp_role: Optional[str] = None
    emp_date: Optional[date] = None
    login_pw: Optional[str] = Field(None, description="비밀번호 변경 시에만 전달 (평문, 서버에서 해싱)", min_length=4)


class EmployeeResponse(BaseModel):
    """팀원 응답 스키마"""
    emp_id: str
    login_id: str
    emp_name: str
    login_pw: str
    emp_role: str
    emp_date: date

    model_config = {"from_attributes": True}


class EmployeeListResponse(BaseModel):
    """팀원 목록 응답 스키마"""
    total: int
    items: list[EmployeeResponse]


class EmployeePasswordUpdate(BaseModel):
    """비밀번호 전용 변경 요청 스키마"""
    new_password: str = Field(..., description="새로운 비밀번호 (평문, 서버에서 해싱)", min_length=4)

