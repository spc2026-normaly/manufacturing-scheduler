import uuid
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import Employee
from app.routers.auth import Permission, PermissionChecker
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeResponse,
    EmployeeUpdate,
    EmployeePasswordUpdate,
)

router = APIRouter(prefix="/api/employees", tags=["팀원 관리"])


# ─── 비밀번호 해싱 헬퍼 ───────────────────────────────────────────────────────

def _hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _gen_emp_id() -> str:
    """emp_ + UUID 앞 8자리로 고유 emp_id 생성"""
    return f"emp_{uuid.uuid4().hex[:8]}"


# ─── 엔드포인트 ──────────────────────────────────────────────────────────────

@router.get("", response_model=EmployeeListResponse, summary="팀원 목록 조회")
def list_employees(
    q: Optional[str] = Query(None, description="이름 검색어"),
    role: Optional[str] = Query(None, description="역할 필터: leader | member"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.EMPLOYEE_READ)),
):
    """등록된 팀원 목록을 조회합니다. 이름 검색 및 역할 필터를 지원합니다."""
    query = db.query(Employee)

    if q:
        query = query.filter(Employee.emp_name.ilike(f"%{q}%"))
    if role:
        query = query.filter(Employee.emp_role == role)

    total = query.count()
    items = query.order_by(Employee.emp_id.asc()).offset(skip).limit(limit).all()

    return EmployeeListResponse(total=total, items=items)


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED, summary="팀원 등록")
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EMPLOYEE_WRITE))):
    """새로운 팀원을 등록합니다. 비밀번호는 bcrypt로 해싱하여 저장됩니다."""
    # login_id 중복 체크
    existing = db.query(Employee).filter(Employee.login_id == body.login_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"이미 사용 중인 아이디입니다: '{body.login_id}'",
        )

    emp = Employee(
        emp_id=_gen_emp_id(),
        login_id=body.login_id,
        login_pw=_hash_pw(body.login_pw),
        emp_name=body.emp_name,
        emp_role=body.emp_role,
        emp_date=body.emp_date,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/{emp_id}", response_model=EmployeeResponse, summary="팀원 상세 조회")
def get_employee(emp_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EMPLOYEE_READ))):
    """특정 팀원의 상세 정보를 조회합니다."""
    emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="팀원을 찾을 수 없습니다.")
    return emp


@router.patch("/{emp_id}", response_model=EmployeeResponse, summary="팀원 정보 수정")
def update_employee(emp_id: str, body: EmployeeUpdate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EMPLOYEE_WRITE))):
    """팀원 정보를 부분 수정합니다. (이름, 역할, 입사일, 비밀번호)"""
    emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="팀원을 찾을 수 없습니다.")

    if body.emp_name is not None:
        emp.emp_name = body.emp_name
    if body.emp_role is not None:
        # DB 제약조건에 맞춰 leader/member 검사
        if body.emp_role not in ("leader", "member"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="역할은 'leader' 또는 'member'이어야 합니다.",
            )
        emp.emp_role = body.emp_role
    if body.emp_date is not None:
        emp.emp_date = body.emp_date
    if body.login_pw is not None:
        emp.login_pw = _hash_pw(body.login_pw)

    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{emp_id}", status_code=status.HTTP_204_NO_CONTENT, summary="팀원 삭제 (하드)")
def delete_employee(emp_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EMPLOYEE_WRITE))):
    """팀원을 데이터베이스에서 삭제합니다. (하드 삭제)"""
    emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="팀원을 찾을 수 없습니다.")

    db.delete(emp)
    db.commit()


@router.patch("/{emp_id}/password", response_model=EmployeeResponse, summary="팀원 비밀번호 전용 변경")
def change_employee_password(
    emp_id: str,
    body: EmployeePasswordUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.EMPLOYEE_WRITE)),
):
    """팀원의 비밀번호를 전용으로 변경합니다. (bcrypt 해싱 저장)"""
    emp = db.query(Employee).filter(Employee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="팀원을 찾을 수 없습니다.")

    emp.login_pw = _hash_pw(body.new_password)
    db.commit()
    db.refresh(emp)
    return emp

