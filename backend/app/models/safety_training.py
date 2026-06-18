import uuid
from datetime import date
from sqlalchemy import String, Date
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