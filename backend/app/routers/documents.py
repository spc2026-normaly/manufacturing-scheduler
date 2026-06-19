from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.document import Document

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("", summary="문서 목록 조회")
def get_documents(db: Session = Depends(get_db)):
    return db.execute(select(Document)).scalars().all()


@router.get("/{file_id}", summary="문서 단건 조회")
def get_document(file_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    return doc


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="문서 삭제")
def delete_document(file_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")
    db.delete(doc)
    db.commit()