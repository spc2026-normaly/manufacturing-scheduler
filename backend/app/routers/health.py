from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="헬스 체크")
def health_check(db: Session = Depends(get_db)):
    """서버 및 데이터베이스 연결 상태를 반환합니다."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="ok",
        timestamp=datetime.now(tz=timezone.utc),
        database=db_status,
        version="0.1.0",
    )
