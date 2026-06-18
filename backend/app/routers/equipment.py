from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.equipment import Equipment
from app.schemas.scheduler import EquipmentCreate, EquipmentResponse

router = APIRouter(prefix="/api/equipments", tags=["Equipment"])


@router.get("", response_model=List[EquipmentResponse], summary="장비 목록 조회")
def get_equipments(
    status: Optional[str] = Query(None, description="상태 필터 (정상, 점검 필요 등)"),
    upcoming_days: Optional[int] = Query(None, description="N일 이내 점검 예정 장비 필터"),
    db: Session = Depends(get_db)
):
    """장비 목록 조회. 상태 필터 및 다가오는 점검일 필터 지원."""
    stmt = select(Equipment)
    if status:
        stmt = stmt.where(Equipment.eq_status == status)
    if upcoming_days is not None:
        today = date.today()
        deadline = today + timedelta(days=upcoming_days)
        # check_date가 오늘과 deadline 사이인 장비를 필터링
        stmt = stmt.where(Equipment.check_date <= deadline, Equipment.check_date >= today)
    return db.execute(stmt).scalars().all()


@router.get("/{eq_id}", response_model=EquipmentResponse, summary="장비 단건 조회")
def get_equipment(eq_id: str, db: Session = Depends(get_db)):
    """특정 장비의 상세 정보를 조회합니다."""
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    return equipment


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED, summary="장비 등록")
def create_equipment(data: EquipmentCreate, db: Session = Depends(get_db)):
    equipment = Equipment(**data.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.put("/{eq_id}", response_model=EquipmentResponse, summary="장비 수정")
def update_equipment(eq_id: str, data: EquipmentCreate, db: Session = Depends(get_db)):
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    for key, value in data.model_dump().items():
        setattr(equipment, key, value)
    db.commit()
    db.refresh(equipment)
    return equipment


@router.delete("/{eq_id}", status_code=status.HTTP_204_NO_CONTENT, summary="장비 삭제")
def delete_equipment(eq_id: str, db: Session = Depends(get_db)):
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    db.delete(equipment)
    db.commit()