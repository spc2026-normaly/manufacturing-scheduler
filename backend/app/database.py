<<<<<<< HEAD
from sqlalchemy import create_engine
=======
from sqlalchemy import create_engine, event
>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # 연결 상태 자동 점검
    pool_size=10,
    max_overflow=20,
)

<<<<<<< HEAD
=======

@event.listens_for(engine, "connect")
def _set_connection_encoding(dbapi_connection, connection_record):
    """DB 세션마다 UTF-8 client_encoding을 강제해 인코딩 불일치를 예방한다."""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("SET client_encoding TO 'UTF8'")
    finally:
        cursor.close()

>>>>>>> 0e576a401d9772abf362a970b015f2bc8545e15c
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
