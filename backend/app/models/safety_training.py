import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Date, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base
from app.models.base import TimestampMixin


class TrainingStatus(str, enum.Enum):
    완료 = "완료"
    진행중 = "진행중"
    미이수 = "미이수"


class SafetyTraining(Base, TimestampMixin):
    __tablename__ = "safety_training"

    training_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    emp_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("employees.emp_id"), nullable=False
    )
    training_name: Mapped[str] = mapped_column(String(100), nullable=False)
    training_date: Mapped[date] = mapped_column(Date, nullable=False)
    expired_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    training_status: Mapped[TrainingStatus] = mapped_column(
        SAEnum(TrainingStatus), nullable=False, default=TrainingStatus.미이수
    )

    employee: Mapped["Employee"] = relationship("Employee", back_populates="trainings")