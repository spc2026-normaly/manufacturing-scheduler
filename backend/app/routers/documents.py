<<<<<<< HEAD
import os
import uuid
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.document import Document

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        filename=unique_name,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {"id": doc.id, "filename": doc.original_filename, "size": doc.file_size, "mime_type": doc.mime_type}

@router.get("/")
def get_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return docs
=======
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.document import Document
from app.routers.auth import require_leader

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", summary="문서 목록 조회")
def get_documents(db: Session = Depends(get_db), _: object = Depends(require_leader)):
    return db.execute(select(Document)).scalars().all()


@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    return doc


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제")
def delete_document(file_id: str, db: Session = Depends(get_db), _: object = Depends(require_leader)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    db.delete(doc)
    db.commit()
>>>>>>> fb129ad28ce94a8a809f70d41dae7fdb7b6a90ad
