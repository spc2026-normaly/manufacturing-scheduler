# Kubernetes 첫 실행 온보딩

## 0) 목적

이 문서는 이 프로젝트를 쿠버네티스에서 처음 실행할 때,
실패 가능성을 줄이기 위한 최소 순서를 정리한 가이드입니다.

## 1) 사전 체크

1. 이미지 경로와 태그 확인
   - deployments/backend/backend-deployment.yaml
   - deployments/frontend/frontend-deployment.yaml
   - deployments/monitoring/grafana-deployment.yaml
   - your-dockerhub-id 를 실제 계정/조직명으로 교체

2. 클러스터 준비 확인
   - ingress-nginx
   - StorageClass
   - (온프레미스라면) MetalLB

3. DB 정책 확인
   - 쿠버네티스 기본값은 DB_AUTO_CREATE_TABLES=false
   - 즉, DB 스키마는 Migration Job으로 먼저 반영해야 함

## 2) Baseline 리비전 1회 생성 (중요)

현재 Alembic versions 폴더가 비어 있으면,
Migration Job이 실행되어도 실제 스키마 생성이 되지 않을 수 있습니다.

먼저 baseline 리비전을 1회 생성하고 저장소에 커밋하세요.

예시(로컬 compose 사용 시):

    docker compose up -d db backend
    docker compose exec backend alembic revision --autogenerate -m baseline_init

생성 확인 경로:

- backend/alembic/versions

## 3) 쿠버네티스 적용 순서

1. 네임스페이스

   kubectl apply -f deployments/namespace.yaml

2. 설정/시크릿

   kubectl apply -f deployments/configmaps/
   kubectl apply -f deployments/secrets/
   kubectl apply -f deployments/monitoring/grafana-secret.yaml
   kubectl apply -f deployments/monitoring/postgres-exporter-secret.yaml

3. PostgreSQL

   kubectl apply -f deployments/postgres/

4. Migration Job

   kubectl -n manufacturing-app delete job backend-migrate --ignore-not-found
   kubectl apply -f deployments/migrations/backend-migrate-job.yaml
   kubectl -n manufacturing-app logs job/backend-migrate -f
   kubectl -n manufacturing-app get job backend-migrate

5. Backend/Frontend

   kubectl apply -f deployments/backend/
   kubectl apply -f deployments/frontend/

6. Ingress/Monitoring

   kubectl apply -f deployments/ingress/
   kubectl apply -f deployments/monitoring/

7. (선택) 데모용 Seed

   kubectl -n manufacturing-app create configmap db-seed-sql --from-file=seed.sql=db/seed.sql --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n manufacturing-app delete job backend-seed --ignore-not-found
   kubectl apply -f deployments/migrations/backend-seed-job.yaml
   kubectl -n manufacturing-app logs job/backend-seed -f

8. 마지막으로 NetworkPolicy

   kubectl apply -f deployments/networkpolicy/

## 4) 트러블슈팅 핵심

1. ImagePullBackOff
   - 이미지 경로/태그 오타 또는 미푸시 여부 확인

2. backend-migrate 실패
   - baseline 리비전 파일 존재 여부 확인
   - DB 접속 문자열/secret 값 일치 여부 확인

3. 외부 접속 불가
   - ingress-nginx, ingressClassName, MetalLB 상태 확인
