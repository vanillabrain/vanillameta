# Docker Compose 통합 가이드

## 개요

VanillaMeta 프로젝트는 Docker Compose를 통해 전체 애플리케이션 스택을 쉽게 실행하고 관리할 수 있도록 구성되어 있습니다.

## 아키텍처 구성

### 서비스 구성도

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│  Frontend   │     │   Redis     │
│  (Port 80)  │     │ (React App) │     │ (Port 6379) │
└──────┬──────┘     └─────────────┘     └──────▲──────┘
       │                                        │
       │            ┌─────────────┐             │
       └───────────▶│   Backend   │─────────────┘
                    │ (NestJS API)│
                    │ (Port 3000) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   SQLite    │
                    │  (Volume)   │
                    └─────────────┘
```

### 서비스 상세 설명

#### 1. Redis 서비스
- **용도**: 캐싱 및 세션 관리
- **이미지**: redis:7-alpine
- **포트**: 6379
- **데이터 영속성**: AOF(Append Only File) 활성화
- **헬스체크**: `redis-cli ping` 명령으로 상태 확인

#### 2. Backend 서비스 (NestJS)
- **용도**: REST API 서버
- **포트**: 3000
- **데이터베이스**: SQLite (로컬 개발용)
- **주요 기능**:
  - JWT 기반 인증
  - TypeORM을 통한 데이터베이스 관리
  - Redis를 통한 캐싱
  - 헬스체크 엔드포인트: `/api/v1/health`

#### 3. Frontend 서비스 (React)
- **용도**: 사용자 인터페이스
- **빌드**: 프로덕션 빌드 후 Nginx로 서빙
- **주요 기능**:
  - Material-UI 기반 디자인
  - ECharts를 통한 50+ 차트 타입 지원
  - React Grid Layout으로 대시보드 구성

#### 4. Nginx 서비스
- **용도**: 리버스 프록시 및 로드 밸런서
- **포트**: 80 (HTTP), 443 (HTTPS - 준비됨)
- **주요 기능**:
  - API 요청을 백엔드로 프록시
  - 정적 파일 캐싱
  - Gzip 압축
  - 보안 헤더 설정

## Docker 설정 파일 구조

```
vanillameta/
├── docker-compose.yml              # 기본 프로덕션 설정
├── docker-compose.override.yml     # 개발 환경 오버라이드
├── .env.example                    # 환경 변수 템플릿
├── docker-compose-helper.sh        # 헬퍼 스크립트
├── nginx/
│   ├── nginx.conf                  # Nginx 메인 설정
│   └── conf.d/
│       └── default.conf            # 서버 블록 설정
├── backend-api/
│   ├── Dockerfile                  # 프로덕션 빌드
│   └── Dockerfile.dev              # 개발 환경 빌드
└── frontend-web/
    ├── Dockerfile                  # 프로덕션 빌드
    └── Dockerfile.dev              # 개발 환경 빌드
```

## 환경별 실행 방법

### 프로덕션 환경

```bash
# 환경 파일 설정
cp .env.example .env
# .env 파일 편집하여 프로덕션 값 설정

# 서비스 시작
./docker-compose-helper.sh start -d

# 또는 직접 실행
docker-compose up -d
```

### 개발 환경

개발 환경에서는 `docker-compose.override.yml`이 자동으로 적용되어 다음 기능이 활성화됩니다:

- 소스 코드 볼륨 마운트 (핫 리로드)
- 디버그 로깅
- 개발 서버 사용

```bash
# 개발 모드 시작
./docker-compose-helper.sh dev

# 또는 직접 실행
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

## 볼륨 관리

### 볼륨 목록

1. **sqlite_data**: SQLite 데이터베이스 파일
2. **redis_data**: Redis 영구 저장 데이터
3. **log_data**: 애플리케이션 로그
4. **nginx_logs**: Nginx 액세스 및 에러 로그

### 데이터 백업 및 복원

```bash
# SQLite 데이터 백업
docker run --rm \
  -v vanillameta_sqlite_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/sqlite_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# SQLite 데이터 복원
docker run --rm \
  -v vanillameta_sqlite_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/sqlite_backup_20240118_120000.tar.gz -C /data

# Redis 데이터 백업
docker-compose exec redis redis-cli BGSAVE
docker run --rm \
  -v vanillameta_redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine cp /data/dump.rdb /backup/redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```

## 네트워킹

### 내부 네트워크

모든 서비스는 `vanillameta-network` 브리지 네트워크를 통해 통신합니다.

- 서비스 간 통신은 서비스 이름으로 가능 (예: `http://backend:3000`)
- 외부 접근은 노출된 포트를 통해서만 가능

### 포트 매핑

| 서비스 | 내부 포트 | 외부 포트 | 설명 |
|--------|----------|----------|------|
| Nginx | 80 | 80 | HTTP 트래픽 |
| Backend | 3000 | 3000 | API 직접 접근 (개발용) |
| Redis | 6379 | 6379 | Redis 클라이언트 접근 |
| Frontend | 3000 | 3001 | 개발 서버 (개발 모드) |

## 성능 최적화

### 1. 멀티 스테이지 빌드

모든 Dockerfile은 멀티 스테이지 빌드를 사용하여 최종 이미지 크기를 최소화합니다.

### 2. 레이어 캐싱

- package.json을 먼저 복사하여 의존성 레이어 캐싱
- 소스 코드 변경 시에도 의존성 재설치 방지

### 3. 헬스체크 최적화

각 서비스는 적절한 헬스체크를 구성하여 서비스 가용성을 보장합니다.

### 4. 리소스 제한

프로덕션 환경에서는 다음과 같은 리소스 제한을 권장합니다:

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## 보안 고려사항

### 1. 비밀 정보 관리

- `.env` 파일은 절대 커밋하지 않음
- 프로덕션에서는 Docker Secrets 사용 권장
- JWT 시크릿은 강력한 랜덤 값 사용

### 2. 네트워크 보안

- 필요한 포트만 외부에 노출
- Nginx를 통한 리버스 프록시로 백엔드 직접 접근 차단
- 보안 헤더 자동 설정

### 3. 컨테이너 보안

- 모든 컨테이너는 non-root 사용자로 실행
- 최소한의 베이스 이미지 사용 (Alpine Linux)
- 정기적인 이미지 업데이트

## 트러블슈팅 가이드

### 일반적인 문제 해결

#### 1. 컨테이너가 시작되지 않는 경우

```bash
# 로그 확인
docker-compose logs [service-name]

# 상태 확인
docker-compose ps

# 이벤트 확인
docker events --since 10m
```

#### 2. 네트워크 연결 문제

```bash
# 네트워크 확인
docker network ls
docker network inspect vanillameta_vanillameta-network

# 서비스 간 연결 테스트
docker-compose exec frontend ping backend
docker-compose exec backend nc -zv redis 6379
```

#### 3. 볼륨 권한 문제

```bash
# 볼륨 권한 확인
docker-compose exec backend ls -la /app/sqlite_data

# 권한 수정 (필요시)
docker-compose exec backend chown -R nestjs:nodejs /app/sqlite_data
```

#### 4. 메모리 부족

```bash
# 컨테이너 리소스 사용량 확인
docker stats

# Docker 시스템 정리
docker system prune -af
```

## 모니터링 및 로깅

### 로그 수집

```bash
# 모든 서비스 로그 수집
docker-compose logs > all_logs_$(date +%Y%m%d_%H%M%S).log

# 특정 서비스 로그 추적
docker-compose logs -f backend --tail=100

# 로그 파일 위치
# - Backend: /app/logs/
# - Nginx: /var/log/nginx/
```

### 메트릭 수집

프로덕션 환경에서는 다음 도구 추가를 권장합니다:

- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog 또는 New Relic

## CI/CD 통합

### GitHub Actions 예제

```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push Docker images
      run: |
        docker-compose build
        docker-compose push
    
    - name: Deploy
      run: |
        docker-compose up -d
```

## 업그레이드 가이드

### 무중단 업그레이드

```bash
# 1. 새 이미지 빌드
docker-compose build

# 2. 백업 생성
./backup.sh

# 3. 서비스 순차 업데이트
docker-compose up -d --no-deps backend
docker-compose up -d --no-deps frontend
docker-compose up -d --no-deps nginx

# 4. 헬스체크 확인
./docker-compose-helper.sh status
```

## 참고 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [NestJS Docker 가이드](https://docs.nestjs.com/recipes/docker)
- [React 프로덕션 빌드 가이드](https://create-react-app.dev/docs/production-build/)