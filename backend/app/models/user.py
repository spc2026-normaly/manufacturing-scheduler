from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class User(Base, TimestampMixin):
    """사용자 계정 모델"""

    __tablename__ = "users"

    emp_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    emp_name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    login_id: Mapped[str] = mapped_column(String(255), nullable=False)
    login_pw: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    emp_role: Mapped[str] = mapped_column(String(30), default="user", nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
