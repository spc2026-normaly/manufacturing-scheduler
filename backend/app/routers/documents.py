import os
import uuid
import logging
from urllib.parse import unquote
from typing import List
from fastapi import (
    APIRouter,
    UploadFile, File, Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_db
from app.models.document import Document
from app.models.employee import Employee
from app.routers.auth import require_leader, get_current_employee
from app.services.document_service import (
    DocumentCategory,
    get_document_bytes,
    process_uploaded_document,
    sync_r2_documents,
)

router = APIRouter(prefix="/api/documents", tags=["Documents"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# 문서 조회 및 다운로드 엔드포인트
@router.get("", summary="문서 목록 조회")
def get_documents(db: Session = Depends(get_db), _: object = Depends(require_leader)):
    """DB에 저장된 모든 문서 메타데이터 조회 (리더 권한 필요)"""
    return db.execute(select(Document)).scalars().all()


@router.post("", summary="문서 업로드")
async def upload_document(
    file: UploadFile = File(...),
    # category: RAG 임베딩용 또는 CSV 입력 데이터
    category: DocumentCategory = Query(default="rag"),
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(require_leader),
):
    """파일 업로드 + R2 저장 + 벡터 임베딩 처리"""
    return await process_uploaded_document(
        db,
        uploader=current_emp.emp_id,
        upload=file,
        category=category,
    )


@router.post("/upload", summary="간단 문서 업로드")
async def simple_upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(require_leader)
):
    """로컬 저장소에 파일 업로드"""
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        uploader=current_emp.emp_id,
        file_name=unquote(file.filename),
        file_size=len(content),
        file_extension=ext,
        file_path=file_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {"file_id": doc.file_id, "file_name": doc.file_name, "file_size": doc.file_size}


# R2 동기화 엔드포인트
@router.post("/sync-r2", summary="R2 문서 동기화")
def sync_documents_from_r2(
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(require_leader),
):
    """R2 클라우드페어의 모든 파일을 DB와 동기화 (추가/업데이트/삭제)"""
    return sync_r2_documents(db, uploader=current_emp.emp_id)


# 문서 상세 조회
@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(
    file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)
):
    """특정 파일ID의 문서 메타데이터 조회"""
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다."
        )
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="파일이 서버에 존재하지 않습니다.")
    return FileResponse(path=doc.file_path, filename=doc.file_name)

@router.get("/{file_id}/download", summary="문서 다운로드")
def download_document(
    file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)
):
    """R2에서 파일 다운로드 (바이너리 응답)"""
    doc, file_bytes = get_document_bytes(db=db, file_id=file_id)
    return Response(
        content=file_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )


@router.delete(
    "/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제"
)
def delete_document(
    file_id: str, db: Session = Depends(get_db), current_emp: Employee = Depends(require_leader)
):
    """문서 메타데이터만 DB에서 삭제 (R2는 수동으로 삭제 필요)"""
    doc = db.query(Document).filter(Document.file_id == file_id, Document.uploader == current_emp.emp_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다."
        )
    db.delete(doc)
    db.commit()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다."
        )
    db.delete(doc)
    db.commit()
