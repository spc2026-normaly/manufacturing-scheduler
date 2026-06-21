<<<<<<< HEAD
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
=======
import uuid
from datetime import datetime
from sqlalchemy import String, BigInteger, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    file_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    uploader: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_extension: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    file_created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    file_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    embedding_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    embedding_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
>>>>>>> fb129ad28ce94a8a809f70d41dae7fdb7b6a90ad
