# Manufacturing Scheduler

생산 일정 관리 시스템 — Next.js + FastAPI + PostgreSQL + Nginx 풀스택 보일러플레이트

## 아키텍처

```
브라우저
  │
  ▼
Nginx :80
  ├── /api/*        →  FastAPI :8000
  ├── /docs         →  Swagger UI
  └── /*            →  Next.js :3000
                           │
                    FastAPI ↔ PostgreSQL :5432
```

## 빠른 시작

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 패스워드 등을 수정하세요
```

### 2. 전체 스택 실행

```bash
docker compose up --build
```

| URL | 설명 |
|-----|------|
| http://localhost | Next.js 대시보드 |
| http://localhost/api/health | FastAPI 헬스체크 |
| http://localhost/docs | Swagger UI |
| http://localhost/redoc | ReDoc UI |

### 3. 개별 서비스 재시작

```bash
docker compose restart backend   # FastAPI 재시작
docker compose restart frontend  # Next.js 재시작
```

### 4. 로그 확인

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

## DB 마이그레이션 (Alembic)

```bash
# 컨테이너 내부에서 실행
docker compose exec backend alembic revision --autogenerate -m "add_orders_table"
docker compose exec backend alembic upgrade head
```

## 프로젝트 구조

```
manufacturing-scheduler/
├── docker-compose.yml
├── .env.example
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── frontend/               # Next.js 15 (App Router, TypeScript)
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   └── src/app/
│       ├── layout.tsx
│       ├── page.tsx        # 메인 대시보드
│       └── globals.css
└── backend/                # FastAPI + SQLAlchemy + Alembic
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    ├── alembic/
    └── app/
        ├── main.py
        ├── config.py
        ├── database.py
        ├── models/
        ├── routers/
        └── schemas/
```

## 개발 팁

- **핫 리로드**: 소스 코드 변경 시 자동 반영됩니다 (볼륨 마운트 적용)
- **DB 직접 접속**: `localhost:5432` (TablePlus, DBeaver 등 사용 가능)
- **새 API 라우터 추가**: `backend/app/routers/` 에 파일 생성 후 `main.py` 에 `include_router` 추가
- **새 모델 추가**: `backend/app/models/` 에 파일 생성 후 `models/__init__.py` 에 import 추가
