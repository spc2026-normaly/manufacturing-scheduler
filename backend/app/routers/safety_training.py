import csv
import io
import uuid
from datetime import date as date_type
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.safety_training import SafetyTraining, SafetyTrainingMetadata
from app.routers.auth import Permission, PermissionChecker
from app.schemas.scheduler import SafetyTrainingCreate, SafetyTrainingResponse

router = APIRouter(prefix="/api/safety-trainings", tags=["Safety Training"])


@router.get("/training-names", response_model=Dict[str, Any], summary="교육명 목록 조회")
def get_training_names(db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_READ))):
    metadata = db.execute(select(SafetyTrainingMetadata)).scalars().first()
    if not metadata:
        return {"training_names": []}
    return {"training_names": metadata.training_names}


@router.get("", response_model=List[SafetyTrainingResponse], summary="안전 교육 목록 조회")
def get_safety_trainings(
    emp_id: Optional[str] = Query(None, description="직원 ID로 필터링"),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    stmt = select(SafetyTraining)
    if emp_id:
        stmt = stmt.where(SafetyTraining.emp_id == emp_id)
    return db.execute(stmt).scalars().all()


@router.post("/upload/csv", status_code=status.HTTP_201_CREATED, summary="안전교육 CSV 업로드")
async def upload_safety_training_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE)),
):
    content = await file.read()

    decoded = ""
    for encoding in ["utf-8-sig", "utf-8", "cp949", "euc-kr"]:
        try:
            decoded = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not decoded:
        raise HTTPException(status_code=400, detail="파일 인코딩을 인식할 수 없습니다.")

    reader = csv.DictReader(io.StringIO(decoded))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV 파일이 비어있습니다.")

    # 교육명 추출
    headers = reader.fieldnames or []
    training_names = []
    for h in headers:
        h = h.strip()
        if h.endswith(" 이수일"):
            name = h.replace(" 이수일", "")
            if name not in training_names:
                training_names.append(name)

    # DB에서 실제 emp_id 목록 가져오기 (대소문자 매핑용)
    from app.models.employee import Employee
    employees = db.execute(select(Employee)).scalars().all()
    emp_id_map = {e.emp_id.upper(): e.emp_id for e in employees}

    # 기존 데이터 삭제
    db.query(SafetyTraining).delete()

    created = []
    for row in rows:
        raw_emp_id = row.get("사원ID", "").strip()
        emp_id = emp_id_map.get(raw_emp_id.upper())
        if not emp_id:
            continue

        for name in training_names:
            training_date_str = row.get(f"{name} 이수일", "").strip()
            expired_date_str = row.get(f"{name} 만료일", "").strip()
            if not training_date_str or not expired_date_str:
                continue
            try:
                training = SafetyTraining(
                    training_id=f"trn_{uuid.uuid4().hex[:8]}",
                    emp_id=emp_id,
                    training_name=name,
                    training_date=date_type.fromisoformat(training_date_str),
                    expired_date=date_type.fromisoformat(expired_date_str),
                    training_status="completed",
                )
                db.add(training)
                created.append(training)
            except Exception:
                continue

    # 메타데이터 업데이트
    db.query(SafetyTrainingMetadata).delete()
    db.add(SafetyTrainingMetadata(training_names=training_names))
    db.commit()

    return {"message": f"{len(created)}건의 교육 이수 내역이 등록되었습니다.", "training_names": training_names}


@router.get("/{training_id}", response_model=SafetyTrainingResponse, summary="안전 교육 단건 조회")
def get_safety_training(training_id: str, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_READ))):
    training = db.query(SafetyTraining).filter(SafetyTraining.training_id == training_id).first()
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="교육 내역을 찾을 수 없습니다.")
    return training


@router.post("", response_model=SafetyTrainingResponse, status_code=status.HTTP_201_CREATED, summary="안전 교육 등록")
def create_safety_training(data: SafetyTrainingCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE))):
    training = SafetyTraining(**data.model_dump())
    db.add(training)
    db.commit()
    db.refresh(training)
    return training


@router.put("/{training_id}", response_model=SafetyTrainingResponse, summary="안전 교육 수정")
def update_safety_training(training_id: str, data: SafetyTrainingCreate, db: Session = Depends(get_db), _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE))):
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
    training = db.query(SafetyTraining).filter(SafetyTraining.training_id == training_id).first()
    if not training:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="교육 내역을 찾을 수 없습니다.")
    db.delete(training)
    db.commit()