from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.models.equipment import Equipment
from app.routers.auth import Permission, PermissionChecker
from app.schemas.scheduler import EquipmentCreate, EquipmentResponse
from app.core.config import settings
from app.services.r2_service import build_r2_key, guess_content_type, upload_bytes_to_r2

router = APIRouter(prefix="/api/equipments", tags=["Equipment"])


@router.get("", response_model=List[EquipmentResponse], summary="장비 목록 조회")
def get_equipments(
    status: Optional[str] = Query(None, description="상태 필터 (정상, 점검 필요 등)"),
    upcoming_days: Optional[int] = Query(None, description="N일 이내 점검 예정 장비 필터"),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.EQUIPMENT_READ)),
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
def get_equipment(eq_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EQUIPMENT_READ))):
    """특정 장비의 상세 정보를 조회합니다."""
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    return equipment


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED, summary="장비 등록")
def create_equipment(data: EquipmentCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EQUIPMENT_WRITE))):
    equipment = Equipment(**data.model_dump())
    try:
        db.add(equipment)
        db.commit()
        db.refresh(equipment)
        return equipment
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"장비 등록 중 오류가 발생했습니다: {str(e)}"
        )


@router.put("/{eq_id}", response_model=EquipmentResponse, summary="장비 수정")
def update_equipment(eq_id: str, data: EquipmentCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EQUIPMENT_WRITE))):
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    for key, value in data.model_dump().items():
        setattr(equipment, key, value)
    try:
        db.commit()
        db.refresh(equipment)
        return equipment
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"장비 수정 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{eq_id}", status_code=status.HTTP_204_NO_CONTENT, summary="장비 삭제")
def delete_equipment(eq_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.EQUIPMENT_WRITE))):
    equipment = db.get(Equipment, eq_id)
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장비를 찾을 수 없습니다.")
    try:
        db.delete(equipment)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"장비 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/upload-csv", summary="CSV 파일로 장비 정보 동기화")
def upload_equipment_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.EQUIPMENT_WRITE))
):
    """CSV 파일을 업로드하여 모든 장비 데이터를 동기화합니다.
    기존 데이터는 삭제되고 새 데이터로 완전히 대체됩니다.
    """
    from app.services.csv_sync_service import _read_rows, _sync_equipments
    
    try:
        file_content = file.file.read()
        if not file_content:
            raise ValueError("빈 파일은 업로드할 수 없습니다.")

        r2_key = build_r2_key(file.filename or "equipment.csv", settings.R2_SCHEDULE_INPUT_PREFIX)
        upload_bytes_to_r2(
            file_content,
            r2_key,
            content_type=guess_content_type(file.filename or "equipment.csv") or "text/csv",
        )

        rows = _read_rows(file_content)
        result = _sync_equipments(db, rows)
        db.commit()
        return {
            "status": "success",
            "message": f"장비 정보가 동기화되었습니다. ({result['rows']}개)",
            "filename": file.filename,
            "r2_key": r2_key,
            "rows_processed": result['rows']
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"CSV 처리 오류: {str(e)}")