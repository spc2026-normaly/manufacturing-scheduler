import csv
import io
import json
import re
import uuid
from datetime import date as date_type, datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.core.config import settings
from app.core.database import get_db
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.safety_training import SafetyTraining, SafetyTrainingMetadata
from app.routers.auth import Permission, PermissionChecker, TokenData
from app.schemas.scheduler import SafetyTrainingCreate, SafetyTrainingResponse
from app.services.document_service import sync_r2_documents
from app.services.schedule_pipeline.rag import search_safety_rules
from app.services.r2_service import upload_bytes_to_r2, build_r2_key
from app.services.document_service import _upsert_document_metadata

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

router = APIRouter(prefix="/api/safety-trainings", tags=["Safety Training"])


def _normalize_training_code(name: str) -> str:
    m = re.search(r"(\d{1,2})", str(name or ""))
    if not m:
        return str(name or "").strip()
    return f"교육{int(m.group(1))}"


def _cleanup_training_label(label: str) -> str:
    text = re.sub(r"\s+", " ", str(label or "").strip())
    text = re.sub(r"교육\s*$", "", text).strip()
    return text


def _extract_labels_regex(context: str) -> dict[str, str]:
    labels: dict[str, str] = {}
    for raw_line in context.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue

        m = re.search(
            r"교육\s*0?(\d{1,2})\s+(.+?)\s+(?:전체|공통\s*심화|[A-G]동)\b",
            line,
        )
        if not m:
            continue

        code = f"교육{int(m.group(1))}"
        label = _cleanup_training_label(m.group(2))
        if label:
            labels[code] = label

    # Pattern 2) key-value block format, e.g.

    kv_pattern = re.compile(
        r"교육번호\s*[:：]\s*교육\s*0?(\d{1,2}).{0,120}?교육명\s*[:：]\s*([^\n\r]+)",
        re.IGNORECASE | re.DOTALL,
    )
    for m in kv_pattern.finditer(context):
        code = f"교육{int(m.group(1))}"
        label = _cleanup_training_label(m.group(2))
        if label:
            labels[code] = label

    return labels


def _extract_labels_ai(context: str) -> dict[str, str]:
    if not settings.OPENAI_API_KEY or OpenAI is None:
        return {}

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = f"""다음 텍스트는 안전규정 문서 일부입니다.
"교육번호-교육명-관련공장동" 표를 찾아 교육번호별 교육명만 JSON으로 추출하세요.

규칙:
- 키는 반드시 교육1, 교육2 ... 형식
- 값은 교육명에서 맨 끝의 '교육' 단어를 제거한 문자열
- 설명 문장 없이 JSON만 출력

텍스트:
{context}
"""

    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    parsed = json.loads((response.choices[0].message.content or "{}").strip())

    cleaned: dict[str, str] = {}
    if isinstance(parsed, dict):
        for k, v in parsed.items():
            code = _normalize_training_code(str(k))
            label = _cleanup_training_label(str(v))
            if code.startswith("교육") and label:
                cleaned[code] = label
    return cleaned


def _load_broad_safety_context(db: Session, limit: int = 200) -> str:
    """Load broader safety-related chunk text to avoid missing appended entries like 교육22+."""
    stmt = (
        select(DocumentChunk.content)
        .join(
            Document,
            and_(
                Document.file_id == DocumentChunk.file_id,
                Document.uploader == DocumentChunk.uploader,
            ),
        )
        .where(
            or_(
                Document.file_path.like("safety_manage/%"),
                Document.file_path.like(f"{settings.R2_RAG_PREFIX.rstrip('/')}/%"),
            ),
            or_(
                DocumentChunk.content.ilike("%교육번호%"),
                DocumentChunk.content.ilike("%교육명%"),
                DocumentChunk.content.ilike("%교육 22%"),
                DocumentChunk.content.ilike("%교육22%"),
            ),
        )
        .limit(limit)
    )
    rows = db.execute(stmt).scalars().all()
    return "\n".join(rows)


@router.get(
    "/training-labels", response_model=Dict[str, Any], summary="교육 헤더명 자동 추출"
)
def get_training_labels(
    db: Session = Depends(get_db),
    current_emp: TokenData = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    """RAG 문서에서 교육번호별 교육명을 자동 추출해 반환합니다."""
    # Keep DB metadata/chunks in sync with current Cloudflare R2 state on every refresh.
    # This makes newly added 교육23/24 appear and removed 교육22 disappear without manual sync.
    try:
        sync_r2_documents(db, uploader=current_emp.emp_id)
    except Exception as e:
        # Continue with existing indexed data if sync fails.
        print(f"⚠️ training-labels sync skipped: {e}")

    chunks = search_safety_rules(
        db,
        "부록 A 교육-공장동 매핑표 교육번호 교육명 부록 D 교육번호 교육22",
        top_k=12,
    )
    context = "\n".join(chunks)
    broad_context = _load_broad_safety_context(db)
    merged_context = f"{context}\n{broad_context}".strip()

    labels: dict[str, str] = {}
    source = "none"

    try:
        labels = _extract_labels_ai(merged_context)
        if labels:
            source = "ai"
    except Exception:
        labels = {}

    if not labels:
        labels = _extract_labels_regex(merged_context)
        source = "regex" if labels else "none"

    return {
        "labels": labels,
        "source": source,
        "context_count": len(chunks),
    }


@router.get(
    "/training-names", response_model=Dict[str, Any], summary="교육명 목록 조회"
)
def get_training_names(
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    metadata = db.execute(select(SafetyTrainingMetadata)).scalars().first()
    if not metadata:
        return {"training_names": []}
    return {"training_names": metadata.training_names}


@router.get(
    "", response_model=List[SafetyTrainingResponse], summary="안전 교육 목록 조회"
)
def get_safety_trainings(
    emp_id: Optional[str] = Query(None, description="직원 ID로 필터링"),
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    stmt = select(SafetyTraining)
    if emp_id:
        stmt = stmt.where(SafetyTraining.emp_id == emp_id)
    return db.execute(stmt).scalars().all()


@router.post(
    "/upload/csv", status_code=status.HTTP_201_CREATED, summary="안전교육 CSV 업로드"
)
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

    # R2에 업로드
    try:
        r2_key = build_r2_key(file.filename, settings.R2_SAFETY_MANAGE_PREFIX)
        upload_bytes_to_r2(data=content, r2_key=r2_key, content_type="text/csv")
        _upsert_document_metadata(
            db,
            uploader="emp000",
            file_name=file.filename,
            file_size=len(content),
            file_extension="csv",
            file_path=r2_key,
            file_updated_at=datetime.utcnow(),
        )
    except Exception as e:
        print(f"R2 업로드 실패: {e}")

    first_line = decoded.split("\n")[0] if decoded else ""
    delimiter = ","
    for d in ["\t", ";"]:
        if d in first_line:
            delimiter = d
            break

    reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV 파일이 비어있습니다.")

    headers = reader.fieldnames or []

    def _normalize_header(value: str) -> str:
        return "".join((value or "").strip().lower().split())

    normalized_headers = {_normalize_header(h): h for h in headers if h}

    def _match_header(candidates: list[str]) -> Optional[str]:
        for cand in candidates:
            matched = normalized_headers.get(_normalize_header(cand))
            if matched:
                return matched
        return None

    emp_id_header = _match_header(["사원ID", "직원ID", "emp_id", "id"])
    if not emp_id_header:
        raise HTTPException(status_code=400, detail="CSV 필수 헤더 누락: 사원ID")

    emp_name_header = _match_header(["직원명", "사원명", "이름", "emp_name", "name"])

    training_names = []
    for h in headers:
        h = h.strip()
        if h.endswith(" 이수일"):
            name = h.replace(" 이수일", "")
            if name not in training_names:
                training_names.append(name)

    from app.models.employee import Employee

    employees = db.execute(select(Employee)).scalars().all()
    emp_id_map = {e.emp_id.upper(): e.emp_id for e in employees}
    emp_by_id = {e.emp_id: e for e in employees}
    updated_employee_names = 0

    db.query(SafetyTraining).delete()

    created = []
    for row in rows:
        raw_emp_id = row.get(emp_id_header, "").strip()
        emp_id = emp_id_map.get(raw_emp_id.upper())
        if not emp_id:
            continue

        if emp_name_header:
            raw_emp_name = row.get(emp_name_header, "").strip()
            if raw_emp_name:
                employee = emp_by_id.get(emp_id)
                if employee and employee.emp_name != raw_emp_name:
                    employee.emp_name = raw_emp_name
                    updated_employee_names += 1

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

    db.query(SafetyTrainingMetadata).delete()
    db.add(SafetyTrainingMetadata(training_names=training_names))
    db.commit()

    return {
        "message": f"{len(created)}건의 교육 이수 내역이 등록되었습니다.",
        "training_names": training_names,
        "updated_employee_names": updated_employee_names,
    }


@router.get(
    "/{training_id}",
    response_model=SafetyTrainingResponse,
    summary="안전 교육 단건 조회",
)
def get_safety_training(
    training_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_READ)),
):
    training = (
        db.query(SafetyTraining)
        .filter(SafetyTraining.training_id == training_id)
        .first()
    )
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="교육 내역을 찾을 수 없습니다.",
        )
    return training


@router.post(
    "",
    response_model=SafetyTrainingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="안전 교육 등록",
)
def create_safety_training(
    data: SafetyTrainingCreate,
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE)),
):
    training = SafetyTraining(**data.model_dump())
    try:
        db.add(training)
        db.commit()
        db.refresh(training)
        return training
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"교육 등록 중 오류가 발생했습니다: {str(e)}",
        )


@router.put(
    "/{training_id}", response_model=SafetyTrainingResponse, summary="안전 교육 수정"
)
def update_safety_training(
    training_id: str,
    data: SafetyTrainingCreate,
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE)),
):
    training = (
        db.query(SafetyTraining)
        .filter(SafetyTraining.training_id == training_id)
        .first()
    )
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="교육 내역을 찾을 수 없습니다.",
        )
    for key, value in data.model_dump().items():
        setattr(training, key, value)
    try:
        db.commit()
        db.refresh(training)
        return training
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"교육 수정 중 오류가 발생했습니다: {str(e)}",
        )


@router.delete(
    "/{training_id}", status_code=status.HTTP_204_NO_CONTENT, summary="안전 교육 삭제"
)
def delete_safety_training(
    training_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(PermissionChecker(Permission.SAFETY_WRITE)),
):
    training = (
        db.query(SafetyTraining)
        .filter(SafetyTraining.training_id == training_id)
        .first()
    )
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="교육 내역을 찾을 수 없습니다.",
        )
    try:
        db.delete(training)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"교육 삭제 중 오류가 발생했습니다: {str(e)}",
        )
