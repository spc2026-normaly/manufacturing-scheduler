import os
import uuid
from urllib.parse import unquote
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_db
from app.models.document import Document
from app.models.employee import Employee
from app.routers.auth import get_current_employee

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", summary="문서 업로드")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_emp: Employee = Depends(get_current_employee)
):
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

@router.get("", summary="문서 목록 조회")
def get_documents(db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    return db.execute(select(Document).where(Document.uploader == current_emp.emp_id)).scalars().all()

@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(file_id: str, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    doc = db.query(Document).filter(Document.file_id == file_id, Document.uploader == current_emp.emp_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    return doc

@router.get("/{file_id}/download", summary="문서 다운로드")
def download_document(file_id: str, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    doc = db.query(Document).filter(Document.file_id == file_id, Document.uploader == current_emp.emp_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="파일이 서버에 존재하지 않습니다.")
    return FileResponse(path=doc.file_path, filename=doc.file_name)

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제")
def delete_document(file_id: str, db: Session = Depends(get_db), current_emp: Employee = Depends(get_current_employee)):
    doc = db.query(Document).filter(Document.file_id == file_id, Document.uploader == current_emp.emp_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    db.delete(doc)
    db.commit()
