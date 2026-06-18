import uuid
from datetime import date
from sqlalchemy import String, Integer, Date, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database import Base
from app.models.base import TimestampMixin


class EquipmentStatus(str, enum.Enum):
    정상 = "정상"
    점검필요 = "점검 필요"
    점검중 = "점검중"
    고장 = "고장"


class Equipment(Base):
    __tablename__ = "equipments"

    eq_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    eq_name: Mapped[str] = mapped_column(String(100), nullable=False)
    eq_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    available_eq_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    check_cycle: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 일 단위
    eq_status: Mapped[EquipmentStatus] = mapped_column(
        SAEnum(EquipmentStatus), nullable=False, default=EquipmentStatus.정상
    )
    check_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recent_check_date: Mapped[date | None] = mapped_column(Date, nullable=True)