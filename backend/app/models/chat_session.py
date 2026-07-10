from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatSession(Base):
    """채팅 세션 메타데이터 모델"""

    __tablename__ = "chat_sessions"

    session_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    employee_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    last_activity: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ChatSession(session_id='{self.session_id}', employee_id='{self.employee_id}', title='{self.title}')>"
