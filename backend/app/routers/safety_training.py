from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.safety_training import SafetyTraining
from app.routers.auth import Permission, PermissionChecker
from app.schemas.scheduler import SafetyTrainingCreate, SafetyTrainingResponse

router = APIRouter(prefix="/api/safety-trainings", tags=["Safety Training"])


@router.get("", response_model=List[SafetyTrainingResponse], summary="안전 교육 목록 조회")
def get_safety_trainings(
    emp_id: Optional[str] = Query(None, description="직원 ID로 필터링"),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    """안전 교육 이수 목록 조회. emp_id 파라미터로 개인 조회 가능."""
    stmt = select(SafetyTraining)
    if emp_id:
        stmt = stmt.where(SafetyTraining.emp_id == emp_id)
    return db.execute(stmt).scalars().all()


@router.get("/{training_id}", response_model=SafetyTrainingResponse, summary="안전 교육 단건 조회")
def get_safety_training(training_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_READ))):
    """특정 안전 교육 내역을 단건 조회합니다."""
    training = db.query(SafetyTraining).filter(SafetyTraining.training_id == training_id).first()
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="교육 내역을 찾을 수 없습니다.")
    return training


@router.post("", response_model=SafetyTrainingResponse, status_code=status.HTTP_201_CREATED, summary="안전 교육 등록")
def create_safety_training(data: SafetyTrainingCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE))):
    """새로운 안전 교육 내역을 등록합니다."""
    training = SafetyTraining(**data.model_dump())
    db.add(training)
    db.commit()
    db.refresh(training)
    return training


@router.put("/{training_id}", response_model=SafetyTrainingResponse, summary="안전 교육 수정")
def update_safety_training(training_id: str, data: SafetyTrainingCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE))):
    """기존 안전 교육 내역을 수정합니다."""
    training = db.query(SafetyTraining).filter(SafetyTraining.training_id == training_id).first()
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="교육 내역을 찾을 수 없습니다.")
    for key, value in data.model_dump().items():
        setattr(training, key, value)
    db.commit()
    db.refresh(training)
    return training


@router.delete("/{training_id}", status_code=status.HTTP_204_NO_CONTENT, summary="안전 교육 삭제")
def delete_safety_training(training_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE))):
    """특정 안전 교육 내역을 삭제합니다."""
    training = db.query(SafetyTraining).filter(SafetyTraining.training_id == training_id).first()
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="교육 내역을 찾을 수 없습니다.")
    db.delete(training)
    db.commit()