from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # 연결 상태 자동 점검
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """모든 SQLAlchemy 모델의 베이스 클래스"""
    pass


def get_db():
    """FastAPI 의존성 주입용 DB 세션 제공자"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
