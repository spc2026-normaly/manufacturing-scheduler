import uuid
from datetime import date
from sqlalchemy import String, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Equipment(Base):
    """장비 모델 (원래 데이터베이스 스키마 준수)"""

    __tablename__ = "equipments"

    eq_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, default=lambda: f"eq_{uuid.uuid4().hex[:8]}"
    )
    eq_name: Mapped[str] = mapped_column(String(255), nullable=False)
    eq_count: Mapped[int] = mapped_column(Integer, nullable=False)
    available_eq_count: Mapped[int] = mapped_column(Integer, nullable=False)
    check_cycle: Mapped[int] = mapped_column(Integer, nullable=False)  # 점검 주기 (일 단위)
    eq_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="정상"
    )
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    recent_check_date: Mapped[date] = mapped_column(Date, nullable=False)
    durability: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rest_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<Equipment(eq_id='{self.eq_id}', name='{self.eq_name}', status='{self.eq_status}')>"