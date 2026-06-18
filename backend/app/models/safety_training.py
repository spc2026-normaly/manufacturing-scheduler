import uuid
from datetime import date
from sqlalchemy import String, Date
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SafetyTraining(Base):
    __tablename__ = "safety_training"

    training_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    emp_id: Mapped[str] = mapped_column(String(255), nullable=False)
    training_name: Mapped[str] = mapped_column(String(255), nullable=False)
    training_date: Mapped[date] = mapped_column(Date, nullable=False)
    expired_date: Mapped[date] = mapped_column(Date, nullable=False)
    training_status: Mapped[str] = mapped_column(String(50), nullable=False)