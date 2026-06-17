from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 DB 테이블 생성 (개발 편의용 — 프로덕션에서는 Alembic 사용)"""
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

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 라우터 등록 ──────────────────────────────────────────────────────────────
app.include_router(health_router)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "Manufacturing Scheduler API is running 🚀"}
