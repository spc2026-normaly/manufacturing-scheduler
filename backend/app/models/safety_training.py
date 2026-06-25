import uuid
from datetime import date
from sqlalchemy import String, Date, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SafetyTraining(Base):
    """안전 교육 이수 내역 모델 (원래 데이터베이스 스키마 준수)"""

    __tablename__ = "safety_training"

    training_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: f"trn_{uuid.uuid4().hex[:8]}"
    )
    emp_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, nullable=False
    )
    training_name: Mapped[str] = mapped_column(String(255), nullable=False)
    training_date: Mapped[date] = mapped_column(Date, nullable=False)
    expired_date: Mapped[date] = mapped_column(Date, nullable=False)
    training_status: Mapped[str] = mapped_column(String(50), nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyTraining(training_id='{self.training_id}', emp_id='{self.emp_id}', name='{self.training_name}')>"


class SafetyTrainingMetadata(Base):
    """업로드된 CSV 파일의 교육명 목록을 저장하는 메타데이터 모델"""

    __tablename__ = "safety_training_metadata"

    metadata_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: f"meta_{uuid.uuid4().hex[:8]}"
    )
    training_names: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)

    def __repr__(self) -> str:
        return f"<SafetyTrainingMetadata(training_names={self.training_names})>"