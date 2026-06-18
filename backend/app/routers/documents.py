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
