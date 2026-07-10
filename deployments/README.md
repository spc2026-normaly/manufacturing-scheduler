# Deployments 안내

이 폴더에는 이 프로젝트를 쿠버네티스에 올릴 때 필요한 매니페스트가 들어 있습니다.
처음 보는 사람도 바로 이해할 수 있게, 역할별로 나누어 두었습니다.

## 전체 구조

- `namespace.yaml`
  - 쿠버네티스 네임스페이스를 만듭니다.
  - 앱용, 모니터링용, ingress-nginx용 공간을 분리합니다.

- `configmaps/`
  - 비밀값이 아닌 설정을 넣습니다.
  - 예: API 주소, 모델 이름, 업로드 설정

- `secrets/`
  - 비밀번호나 API 키 같은 민감한 값을 넣습니다.
  - 예: PostgreSQL 비밀번호, OpenAI 키, R2 키

- `postgres/`
  - 데이터베이스 관련 리소스입니다.
  - PVC, Service, StatefulSet이 있습니다.

- `backend/`
  - FastAPI 백엔드 리소스입니다.
  - Deployment와 Service가 있습니다.

- `frontend/`
  - Next.js 프론트엔드 리소스입니다.
  - Deployment와 Service가 있습니다.

- `ingress/`
  - 외부에서 들어오는 요청을 내부 서비스로 연결합니다.
  - 현재는 프론트엔드와 API 경로를 담당합니다.

- `monitoring/`
  - Grafana, Prometheus, postgres-exporter 관련 리소스입니다.
  - 모니터링 화면과 메트릭 수집을 담당합니다.
  - `postgres-exporter-secret.yaml` 로 monitoring 네임스페이스 전용 DB 접속 Secret을 관리합니다.

- `migrations/`
  - `backend-migrate-job.yaml`: Alembic 마이그레이션을 수동 1회 실행합니다.
  - `backend-seed-job.yaml`: 개발/데모용 seed.sql 을 수동 1회 실행합니다.

- `networkpolicy/`
  - Pod 간 통신 규칙을 제한합니다.
  - 기본 차단 후 필요한 통신만 허용하는 방식입니다.

## 적용 순서

처음 배포할 때는 아래 순서로 적용하면 이해하기 쉽습니다.

1. 프론트엔드와 백엔드 이미지를 Docker Hub에 빌드하고 업로드
2. 네임스페이스 생성
3. ConfigMap과 Secret 생성
4. PostgreSQL 생성
5. 마이그레이션 Job 실행
6. 백엔드 생성
7. 프론트엔드 생성
8. Ingress 생성
9. 모니터링 생성
10. NetworkPolicy 적용

NetworkPolicy는 너무 일찍 적용하면 통신이 막혀서 헷갈릴 수 있으니, 처음에는 마지막에 적용하는 편이 좋습니다.

## 네임스페이스

이 프로젝트는 네임스페이스를 3개로 나눕니다.

- `manufacturing-app`
  - 프론트엔드, 백엔드, PostgreSQL이 들어갑니다.

- `manufacturing-monitoring`
  - Prometheus, Grafana, postgres-exporter가 들어갑니다.

- `ingress-nginx`
  - Ingress Controller 전용입니다.

## 외부에서 볼 수 있는 것

현재 외부 접근 대상은 다음과 같습니다.

- 프론트엔드
- Grafana
- Prometheus

백엔드는 직접 서비스로 노출하지 않고, Ingress의 `/api` 경로로만 접근하게 합니다.

## 주의할 점

- 프론트엔드/백엔드/Grafana 이미지는 Docker Hub(또는 사내 레지스트리)에 올린 이미지를 사용한다고 가정합니다.
- Deployment 파일의 `your-dockerhub-id` 는 실제 레지스트리 계정(또는 조직명)으로 바꿔야 합니다.
- `latest` 대신 `v0.1.0`, `v0.1.1`, `sha-<git>` 같은 불변 태그를 사용해야 배포 이력과 롤백이 쉬워집니다.
- 프론트엔드 이미지는 빌드된 산출물(standalone)을 포함해 푸시하고, Pod 시작 시 `npm run build` 를 다시 수행하지 않습니다.
- 쿠버네티스 기본값은 `DB_AUTO_CREATE_TABLES=false` 이며, 스키마 변경은 `backend-migrate-job.yaml` 로만 수행합니다.
- seed 데이터는 운영에서 자동 실행하지 않고, 필요할 때만 `backend-seed-job.yaml` 을 수동 실행합니다.
- 네임스페이스 이름과 NetworkPolicy의 라벨이 서로 맞아야 합니다.
- Secret 값은 Git에 올릴 실서비스 비밀번호로 바꾸면 안 됩니다.
- Grafana와 Prometheus는 Ingress 경로를 사용하므로, 경로가 바뀌면 설정도 같이 바꿔야 합니다.
- 실제 클러스터에서는 StorageClass와 Ingress Controller, MetalLB가 먼저 준비되어 있어야 합니다.

## 이미지 태그 운영 규칙

- `latest` 태그는 사용하지 않는다.
- 재배포 시 같은 태그를 재사용하지 않고, 반드시 새 불변 태그를 발급한다.
  - 예: `3.2` -> `3.3`
- 운영 배포 전에 Deployment의 이미지 태그가 실제 푸시된 태그와 일치하는지 확인한다.
- 모니터링(Grafana/Prometheus 관련 설정) 변경도 애플리케이션 배포와 동일하게 태그를 증가시킨다.
- 롤백은 이전 불변 태그로 즉시 되돌리는 방식으로 수행한다.

## 마이그레이션 / 시드 실행 예시

```bash
# 1) DB 준비
kubectl apply -f deployments/postgres/

# 2) Alembic 마이그레이션
kubectl -n manufacturing-app delete job backend-migrate --ignore-not-found
kubectl apply -f deployments/migrations/backend-migrate-job.yaml
kubectl -n manufacturing-app logs job/backend-migrate -f

# 3) (선택) 개발/데모 시드 데이터
kubectl -n manufacturing-app create configmap db-seed-sql --from-file=seed.sql=db/seed.sql --dry-run=client -o yaml | kubectl apply -f -
kubectl -n manufacturing-app delete job backend-seed --ignore-not-found
kubectl apply -f deployments/migrations/backend-seed-job.yaml
kubectl -n manufacturing-app logs job/backend-seed -f
```

## 한 줄 요약

이 폴더는 애플리케이션, 데이터베이스, 모니터링, 접근 제어를 쿠버네티스 리소스로 나눈 배포용 설정 모음입니다.
