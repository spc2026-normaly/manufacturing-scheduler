from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.document import Document
from app.models.employee import Employee
from app.routers.auth import require_leader
from app.services.document_service import (
    DocumentCategory,
    get_document_bytes,
    process_uploaded_document,
    sync_r2_documents,
)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", summary="문서 목록 조회")
def get_documents(db: Session = Depends(get_db), _: object = Depends(require_leader)):
    return db.execute(select(Document)).scalars().all()


@router.post("", summary="문서 업로드")
async def upload_document(
    file: UploadFile,
    category: DocumentCategory = Query(default="rag"),
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(require_leader),
):
    return await process_uploaded_document(
        db,
        uploader=current_emp.emp_id,
        upload=file,
        category=category,
    )


@router.post("/sync-r2", summary="R2 문서 동기화")
def sync_documents_from_r2(
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(require_leader),
):
    return sync_r2_documents(db, uploader=current_emp.emp_id)


@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    return doc


@router.get("/{file_id}/download", summary="문서 다운로드")
def download_document(file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)):
    doc, file_bytes = get_document_bytes(db=db, file_id=file_id)
    return Response(
        content=file_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제")
def delete_document(file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    db.delete(doc)
    db.commit()
