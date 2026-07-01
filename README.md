# 생산 일정 관리 시스템 (Manufacturing Scheduler)

본 프로젝트는 제조 공정의 효율성을 극대화하기 위해 자원(장비 및 작업자) 제약 조건과 제품 공정 단계를 고려하여 최적의 생산 일정을 수립하는 **지능형 생산 일정 관리 시스템(APS)**입니다.

---

## 🏗️ 아키텍처 및 데이터 흐름

```
   사용자 브라우저 (Next.js 웹 앱)
            │
            ▼
          Nginx (리버스 프록시)
   ┌────────┴────────┐
   │ /api/*          │ (그 외 정적 페이지)
   ▼                 ▼
FastAPI (백엔드)   Next.js (프론트엔드)
   │                 │
   ├─► PostgreSQL (데이터베이스) └─► 대시보드 및 AI 챗봇
   │
   ├─► Cloudflare R2 (입출력 CSV 저장 및 동기화)
   └─► OpenAI API (RAG 및 자격증 정보 임베딩)
```

### 데이터 파이프라인 흐름
1. **자원 및 주문 로드**: Cloudflare R2 스토리지에서 입력 데이터(주문 정보, 장비 사양, 작업자 교육 이수 정보 등)를 가져옵니다.
2. **AI 데이터 보정 (RAG)**: GPT와 RAG 서비스를 활용해 비정형 문서 및 안전 교육 이수 자격을 해석하여 작업자 매핑 테이블을 구성합니다.
3. **일정 수립 엔진 실행**: 사용자 설정에 따라 **Forward**, **Backward**, 또는 **CP-SAT** 알고리즘 중 하나를 구동합니다.
4. **결과 업로드 및 시각화**: 생성된 최종 일정 데이터(상세 배치 정보, KPI 요약본)를 CSV 파일로 변환하여 R2에 재업로드하고, 프론트엔드 대시보드에 시각화합니다.
5. **모니터링 및 로깅**: Prometheus와 Grafana를 내장하여 시스템 가용성과 자원 소모 메트릭을 추적합니다.

---

## ⚙️ 일정 수립 알고리즘 설명

본 시스템은 제조 환경에 최적화된 3가지 일정 수립 알고리즘 모드를 제공합니다.

### 1. Forward 시뮬레이션
* **개요**: 오늘(현재 시점)부터 시작하여 제품 생산에 필요한 각 단계별 작업을 순방향으로 배치합니다.
* **우선순위 규칙**: ATC(Apparent Tardiness Cost) Dispatching Rule을 적용하여 납기일이 급하고 총 공정 시간이 짧은 주문을 자동으로 우선 처리합니다.
* **자원 제약**: 비트마스크(Bitmask) 연산 기법을 통해 09:00~18:00 근무 시간 내에 장비 및 배정된 작업자의 가용 슬롯을 실시간(O(1))으로 체크하며 밀접 배치합니다.

### 2. Backward 시뮬레이션
* **개요**: 주문의 납기일(Due Date)로부터 필요한 작업 영업일수를 역산하여 최적의 시작일(Start Date)을 계산합니다.
* **동작**: 계산된 각 주문의 시작일 이후부터 다시 Forward 시뮬레이션을 작동시켜 납기 준수율을 지키는 동시에 불필요한 선행 생산으로 인한 재고 적체를 방지합니다.

### 3. CP-SAT 최적화
* **개요**: Google OR-Tools의 CP-SAT(Constraint Programming SAT) 솔버를 사용한 수학적 최적화 모드입니다.
* **제약조건 정의**:
  - **NoOverlap**: 특정 작업자는 동일한 시간대에 겹쳐서 작업할 수 없습니다.
  - **Cumulative**: 공정별로 사용 중인 장비의 수량이 보유한 장비 기대의 한도(Capacity)를 초과할 수 없습니다.
  - **작업 의존성(DAG)**: 선행 작업이 종료된 후에만 후속 작업이 시작될 수 있습니다.
  - **자격 만료**: 배정된 작업자의 필수 안전교육 만료일 이내에 작업이 완료되어야 합니다.
* **목적 함수**: 전체 주문의 납기 지연 시간(Tardiness) 합을 최소화하는 해를 탐색하며, 타임아웃(기본 60초) 내 최적해를 도출하지 못할 경우 안전하게 Forward 시뮬레이션으로 폴백합니다.

---

## 📂 프로젝트 구조

```
manufacturing-scheduler/
├── docker-compose.yml
├── .env.example
├── nginx/                   # Reverse Proxy 설정
│   ├── Dockerfile
│   └── nginx.conf
├── db/                      # PostgreSQL 볼륨 및 백업 스크립트
├── frontend/                # Next.js 15 (App Router, TypeScript)
│   ├── Dockerfile
│   ├── src/
│   │   ├── app/             # 대시보드, 일정 빌더, AI 챗봇 등의 페이지
│   │   ├── components/      # 공통 UI 컴포넌트
│   │   ├── hooks/           # 커스텀 훅
│   │   ├── services/        # API 통신 서비스
│   │   └── types/           # TS 타입 정의
│   └── package.json
└── backend/                 # FastAPI + SQLAlchemy + Alembic
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    └── app/
        ├── main.py          # API 진입점
        ├── config.py        # 환경변수 로더
        ├── database.py      # SQLAlchemy DB 세션 설정
        ├── models/          # SQLAlchemy DB 스키마 모델
        ├── routers/         # API Endpoint
        ├── schemas/         # Pydantic 스키마 모델
        ├── utils/           # 로거 및 유틸리티
        └── services/        # 비즈니스 로직
            ├── r2_service.py           # Cloudflare R2 연동
            ├── embedding_service.py    # OpenAI Embedding 모델 연동
            ├── document_service.py     # RAG 업로드 문서 관리
            ├── csv_sync_service.py     # DB-R2 CSV 동기화
            └── schedule_pipeline/      # 일정 수립 코어 파이프라인
                ├── orchestrator.py     # 전체 파이프라인 제어
                ├── conflict_resolver.py# Forward/Backward 시뮬레이션 엔진
                └── cpsat_scheduler.py  # OR-Tools CP-SAT 최적화 스케줄러
```

---

## 🚀 빠른 시작

### 1. 환경 변수 설정
보안을 위해 실제 API Key 및 스토리지 Credential 정보는 공유되지 않습니다. `.env.example` 파일을 복사하여 실제 운용 환경에 맞게 `.env` 파일을 작성하십시오.

> [!WARNING]
> `.env` 파일에는 데이터베이스 패스워드와 OpenAI API Key 등 민감 정보가 포함되므로 절대 Git 등 원격 저장소에 노출되지 않도록 주의하십시오.

### 2. 서비스 빌드 및 실행
Docker Compose를 통해 전체 스택을 일괄 빌드 및 실행합니다.

```bash
docker compose up --build -d
```

| 서비스 주소 | 설명 |
| :--- | :--- |
| **http://localhost** | Next.js 일정 관리 대시보드 |
| **http://localhost/api/health** | FastAPI 헬스체크 API |

### 3. DB 마이그레이션 (Alembic)
DB 스키마 변경 사항이 있는 경우 백엔드 컨테이너 내부에서 Alembic 명령어를 실행합니다.

```bash
# 마이그레이션 스크립트 자동 생성
docker compose exec backend alembic revision --autogenerate -m "변경사항설명"

# 최신 스키마 버전으로 업그레이드
docker compose exec backend alembic upgrade head
```

---

## 🔒 보안 강화 및 RCE 취약점 예방 조치

Next.js SSR 원격 코드 실행(RCE) 등의 보안 위험을 예방하기 위해 프론트엔드 패키지 버전이 **`15.3.6`**으로 업데이트되었습니다. 변경 사항을 완전히 적용하려면 도커 명명 볼륨 캐시를 삭제하고 재빌드해야 합니다.

```bash
# 기존 컨테이너 중지 및 캐시 볼륨 초기화
docker compose down -v

# 캐시 없이 재빌드 및 재시작
docker compose build --no-cache
docker compose up -d
```
