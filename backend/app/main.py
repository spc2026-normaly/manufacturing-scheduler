from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.models import Base
from app.routers.health import router as health_router
from app.routers.scheduler_api import router as scheduler_router
from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.safety_training import router as safety_training_router
from app.routers.equipment import router as equipment_router
from app.routers.documents import router as documents_router
from app.routers.chatbot import router as chatbot_router
from prometheus_fastapi_instrumentator import Instrumentator
from app.routers.schedule_generator import router as schedule_generator_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 DB 테이블 생성 (개발 편의용 — 프로덕션에서는 Alembic 사용)"""
    # pgvector 확장 활성화 (벡터 임베딩 저장용)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # 레거시 테이블 호환성 유지
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS task ADD COLUMN IF NOT EXISTS task_factory VARCHAR(255) NULL"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS equipments ADD COLUMN IF NOT EXISTS durability INTEGER NOT NULL DEFAULT 0"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS equipments ADD COLUMN IF NOT EXISTS rest_duration INTEGER NOT NULL DEFAULT 0"
            )
        )
    # SQLAlchemy 모델 기반 테이블 자동 생성
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Manufacturing Scheduler API",
    description="생산 일정 관리 시스템 백엔드 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 라우터 등록 ──────────────────────────────────────────────────────────────
# 주의: 구체적인 라우터를 스텁(scheduler_router)보다 먼저 등록해야
#       경로 충돌 시 실제 엔드포인트가 우선 매칭됩니다.
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(safety_training_router)
app.include_router(equipment_router)
app.include_router(documents_router)
app.include_router(chatbot_router)
app.include_router(scheduler_router)  # 스텁 라우터는 항상 마지막에 등록

# Prometheus 메트릭 연동
Instrumentator().instrument(app).expose(app)

app.include_router(schedule_generator_router)

@app.get("/", include_in_schema=False)
def root():
    return {"message": "Manufacturing Scheduler API is running 🚀"}
