from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.embedding_service import (
    chunk_and_embed,
    create_query_embedding,
    is_embedding_target,
)
from app.services.csv_sync_service import sync_schedule_input_csv
from app.services.r2_service import (
    build_r2_key,
    download_file_from_r2,
    guess_content_type,
    list_r2_objects,
    upload_bytes_to_r2,
)

DocumentCategory = Literal["rag", "schedule_input", "schedule_output"]

CATEGORY_PREFIX_MAP: dict[DocumentCategory, str] = {
    "rag": settings.R2_RAG_PREFIX,
    "schedule_input": settings.R2_SCHEDULE_INPUT_PREFIX,
    "schedule_output": settings.R2_SCHEDULE_OUTPUT_PREFIX,
}

ALLOWED_EXTENSIONS = {"pdf", "csv", "txt", "docx", "md"}


def _utc_now() -> datetime:
    return datetime.utcnow()


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def _file_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def _validate_file(upload: UploadFile, data: bytes) -> str:
    if not upload.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="파일명이 없습니다.")

    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(data) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일 크기 제한({settings.MAX_UPLOAD_SIZE_MB}MB)을 초과했습니다.",
        )

    extension = _file_extension(upload.filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 확장자입니다: {extension}",
        )
    return extension


def _find_document_by_path(db: Session, r2_key: str) -> Document | None:
    stmt = select(Document).where(Document.file_path == r2_key)
    return db.execute(stmt).scalar_one_or_none()


def _vector_table_available(db: Session) -> bool:
    stmt = text("SELECT to_regclass('public.document_chunks')")
    return db.execute(stmt).scalar_one_or_none() is not None


def _replace_document_chunks(
    db: Session,
    doc: Document,
    chunks: list[str],
    embeddings: list[list[float]],
) -> bool:
    if not chunks or not embeddings:
        return False

    if len(chunks) != len(embeddings):
        raise RuntimeError("청크와 임베딩 개수가 일치하지 않습니다.")

    if not _vector_table_available(db):
        return False

    db.query(DocumentChunk).filter(
        DocumentChunk.file_id == doc.file_id,
        DocumentChunk.uploader == doc.uploader,
    ).delete(synchronize_session=False)

    for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        db.add(
            DocumentChunk(
                chunk_id=str(uuid.uuid4()),
                file_id=doc.file_id,
                uploader=doc.uploader,
                chunk_index=index,
                content=chunk,
                embedding=embedding,
            )
        )

    return True


def _upsert_document_metadata(
    db: Session,
    *,
    uploader: str,
    file_name: str,
    file_size: int,
    file_extension: str,
    file_path: str,
    file_updated_at: datetime,
) -> tuple[Document, bool]:
    existing = _find_document_by_path(db, file_path)
    now = _utc_now()

    if existing is None:
        doc = Document(
            file_id=str(uuid.uuid4()),
            uploader=uploader,
            file_name=file_name,
            file_size=file_size,
            file_extension=file_extension,
            file_path=file_path,
            file_created_at=now,
            file_updated_at=file_updated_at,
            embedding_date=now,
            embedding_status="pending",
        )
        db.add(doc)
        return doc, True

    changed = (
        existing.file_size != file_size
        or _normalize_datetime(existing.file_updated_at) != _normalize_datetime(file_updated_at)
    )

    existing.file_name = file_name
    existing.file_size = file_size
    existing.file_extension = file_extension
    existing.file_path = file_path
    existing.file_updated_at = file_updated_at
    return existing, changed


def _run_embedding_pipeline(db: Session, doc: Document, file_bytes: bytes) -> str:
    if not is_embedding_target(doc.file_extension):
        doc.embedding_status = "pending"
        return "벡터화 대상 확장자가 아니어서 임베딩을 건너뛰었습니다."

    try:
        doc.embedding_status = "processing"
        chunks, embeddings = chunk_and_embed(file_bytes=file_bytes, file_extension=doc.file_extension)
        stored = _replace_document_chunks(
            db=db,
            doc=doc,
            chunks=chunks,
            embeddings=embeddings,
        )
        doc.embedding_date = _utc_now()
        doc.embedding_status = "completed" if stored else "pending"
        if stored:
            return f"청크 {len(chunks)}개 임베딩 저장 완료"
        return f"청크 {len(chunks)}개 생성 완료(벡터 테이블 미존재로 저장 보류)"
    except Exception as exc:
        doc.embedding_status = "failed"
        return f"임베딩 실패: {exc}"


async def process_uploaded_document(
    db: Session,
    *,
    uploader: str,
    upload: UploadFile,
    category: DocumentCategory,
) -> dict:
    data = await upload.read()
    extension = _validate_file(upload=upload, data=data)

    prefix = CATEGORY_PREFIX_MAP[category]
    r2_key = build_r2_key(upload.filename, prefix)
    upload_bytes_to_r2(data=data, r2_key=r2_key, content_type=upload.content_type or guess_content_type(upload.filename))

    document, changed = _upsert_document_metadata(
        db,
        uploader=uploader,
        file_name=upload.filename,
        file_size=len(data),
        file_extension=extension,
        file_path=r2_key,
        file_updated_at=_utc_now(),
    )

    message = "메타데이터만 저장됨"
    if category == "rag" and changed:
        message = _run_embedding_pipeline(db=db, doc=document, file_bytes=data)
    elif category == "schedule_input" and changed and extension == "csv":
        sync_result = sync_schedule_input_csv(db=db, file_name=upload.filename, file_bytes=data)
        message = f"CSV 동기화 완료: {sync_result}"

    db.commit()
    db.refresh(document)

    return {
        "message": "uploaded",
        "file_id": document.file_id,
        "file_name": document.file_name,
        "r2_key": document.file_path,
        "embedding_status": document.embedding_status,
        "detail": message,
    }


def sync_r2_documents(db: Session, *, uploader: str) -> dict:
    prefixes = [
        settings.R2_RAG_PREFIX,
        settings.R2_SCHEDULE_INPUT_PREFIX,
        settings.R2_SCHEDULE_OUTPUT_PREFIX,
    ]

    created = 0
    updated = 0
    skipped = 0

    for prefix in prefixes:
        objects = list_r2_objects(prefix)
        category: DocumentCategory = "rag"
        if prefix == settings.R2_SCHEDULE_INPUT_PREFIX:
            category = "schedule_input"
        elif prefix == settings.R2_SCHEDULE_OUTPUT_PREFIX:
            category = "schedule_output"

        for obj in objects:
            file_name = obj["file_name"]
            extension = _file_extension(file_name)
            if extension not in ALLOWED_EXTENSIONS:
                skipped += 1
                continue

            existed = _find_document_by_path(db, obj["key"]) is not None

            doc, changed = _upsert_document_metadata(
                db,
                uploader=uploader,
                file_name=file_name,
                file_size=obj["size"],
                file_extension=extension,
                file_path=obj["key"],
                file_updated_at=_normalize_datetime(obj["last_modified"]),
            )

            if not existed and changed:
                created += 1
            elif changed:
                updated += 1
            else:
                skipped += 1

            if category == "rag" and changed:
                file_bytes = download_file_from_r2(obj["key"])
                _run_embedding_pipeline(db=db, doc=doc, file_bytes=file_bytes)
            elif category == "schedule_input" and changed and extension == "csv":
                file_bytes = download_file_from_r2(obj["key"])
                sync_schedule_input_csv(db=db, file_name=file_name, file_bytes=file_bytes)

    db.commit()

    return {
        "message": "sync completed",
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }


def search_rag_chunks(db: Session, query: str, top_k: int | None = None) -> list[dict]:
    if not query.strip():
        return []

    k = top_k or settings.RAG_TOP_K
    query_embedding = create_query_embedding(query)

    stmt = (
        select(
            DocumentChunk,
            Document.file_name,
            DocumentChunk.embedding.cosine_distance(query_embedding).label("distance"),
        )
        .join(
            Document,
            and_(
                Document.file_id == DocumentChunk.file_id,
                Document.uploader == DocumentChunk.uploader,
            ),
        )
        .where(Document.file_path.like(f"{settings.R2_RAG_PREFIX.rstrip('/')}/%"))
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(k)
    )

    rows = db.execute(stmt).all()
    return [
        {
            "chunk_id": row[0].chunk_id,
            "file_name": row[1],
            "content": row[0].content,
            "distance": float(row[2]),
        }
        for row in rows
    ]


def get_document_bytes(db: Session, file_id: str) -> tuple[Document, bytes]:
    doc = db.get(Document, file_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")

    file_bytes = download_file_from_r2(doc.file_path)
    return doc, file_bytes
