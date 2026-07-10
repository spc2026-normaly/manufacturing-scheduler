import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKeyConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, backref
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    chunk_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    uploader: Mapped[str] = mapped_column(String(255), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 1536 is standard for OpenAI embeddings (e.g. text-embedding-3-small).
    # This can be adjusted if using a different embedding model.
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Composite foreign key constraint to link with the documents table
    __table_args__ = (
        ForeignKeyConstraint(
            ["file_id", "uploader"],
            ["documents.file_id", "documents.uploader"],
            ondelete="CASCADE",
        ),
    )

    # Relationship to easily fetch document info from a chunk
    document = relationship("Document", backref=backref("chunks", cascade="all, delete-orphan", passive_deletes=True))
