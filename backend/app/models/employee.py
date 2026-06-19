from datetime import date
from sqlalchemy import String, Date, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Employee(Base):
    """직원 계정 모델 (원래 데이터베이스 스키마 준수)"""

    __tablename__ = "employees"

    emp_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    login_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    login_pw: Mapped[str] = mapped_column(String(255), nullable=False)
    emp_name: Mapped[str] = mapped_column(String(255), nullable=False)
    emp_role: Mapped[str] = mapped_column(
        String(50), 
        nullable=False
    )
    emp_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        CheckConstraint("emp_role IN ('leader', 'member')", name="CK_EMPLOYEES_ROLE"),
    )

    def __repr__(self) -> str:
        return f"<Employee(emp_id='{self.emp_id}', login_id='{self.login_id}', role='{self.emp_role}')>"
