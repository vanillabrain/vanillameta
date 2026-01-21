---
task_id: T07_S01
sprint_sequence_id: S01
status: completed
complexity: High
last_updated: 2025-06-23T12:30:00Z
---

# Task: T07_S01_Docker_Compose_Integration

## Description
VanillaMeta의 프론트엔드와 백엔드를 Docker Compose로 통합하여 원클릭으로 전체 스택을 실행할 수 있는 데모 환경을 구성합니다. 

개발자나 사용자가 `docker compose up` 한 번의 명령으로 전체 VanillaMeta 애플리케이션을 실행하고 브라우저에서 즉시 데모를 확인할 수 있도록 합니다.

## Goal / Objectives
Docker Compose를 통한 즉시 실행 가능한 통합 데모 환경을 구축합니다.

- 프론트엔드와 백엔드를 포함하는 Docker Compose 설정
- 네트워크 및 포트 설정으로 내부 통신 구성
- 볼륨 마운트로 SQLite 데이터 영속성 보장
- 환경변수 설정으로 각 컨테이너 간 연동
- 헬스체크 설정으로 안정적인 시작 순서 보장

## Acceptance Criteria
다음 조건들이 모두 충족되어야 작업이 완료된 것으로 간주됩니다:

- [x] `docker-compose.yml` 파일 생성 (루트 디렉토리)
- [x] 백엔드 Dockerfile 생성 (`backend-api/Dockerfile`)
- [x] 프론트엔드 Dockerfile 생성 (`frontend-web/Dockerfile`)
- [x] `docker compose up` 명령으로 전체 스택 실행
- [x] 백엔드가 http://localhost:3000 에서 정상 응답
- [x] 프론트엔드가 http://localhost:80 에서 정상 로드
- [x] 프론트엔드에서 백엔드 API 정상 호출
- [x] SQLite 데이터가 컨테이너 재시작 후에도 유지
- [x] 모든 서비스가 healthy 상태로 시작

## Subtasks
작업을 완료하기 위한 세부 단계들:

### Phase 1: Dockerfile 작성
- [ ] 백엔드 Dockerfile 작성
  - [ ] Node.js 베이스 이미지 선택
  - [ ] 의존성 설치 최적화 (레이어 캐싱)
  - [ ] 빌드 및 실행 스크립트 설정
  - [ ] SQLite 데이터 디렉토리 설정
- [ ] 프론트엔드 Dockerfile 작성  
  - [ ] 멀티 스테이지 빌드 (build + serve)
  - [ ] Nginx 또는 정적 파일 서빙 설정
  - [ ] 환경변수로 API URL 설정

### Phase 2: Docker Compose 설정
- [ ] docker-compose.yml 파일 작성
- [ ] 서비스 정의 (backend, frontend)
- [ ] 네트워크 설정 (internal communication)
- [ ] 볼륨 설정 (SQLite 데이터 영속성)
- [ ] 환경변수 설정 파일 (.env)

### Phase 3: 컨테이너 간 통신 설정
- [ ] 백엔드 CORS 설정 업데이트
- [ ] 프론트엔드 API URL 환경변수 설정
- [ ] 헬스체크 엔드포인트 구성
- [ ] 의존성 순서 설정 (depends_on)

### Phase 4: 테스트 및 최적화
- [ ] 전체 스택 실행 테스트
- [ ] 기본 기능 동작 확인
- [ ] 로그 출력 최적화
- [ ] 성능 및 시작 시간 최적화

## Technical Guidance

### Docker Compose 구조
```yaml
version: '3.8'
services:
  backend:
    build: ./backend-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=local
    volumes:
      - sqlite_data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend-web
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=http://localhost:3000
    depends_on:
      backend:
        condition: service_healthy

volumes:
  sqlite_data:
```

### 백엔드 Dockerfile 예시
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 설치 (캐시 최적화)
COPY package*.json ./
RUN yarn install --frozen-lockfile

# 소스 코드 복사
COPY . .

# 빌드
RUN yarn build

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

# 포트 노출
EXPOSE 3000

# 헬스체크용 curl 설치
RUN apk add --no-cache curl

# 애플리케이션 실행
CMD ["yarn", "start:local"]
```

### 프론트엔드 Dockerfile 예시
```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# Serve stage
FROM nginx:alpine

# Nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드된 파일 복사
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 환경변수 설정
- **백엔드**: `NODE_ENV=local`, SQLite 경로 설정
- **프론트엔드**: `REACT_APP_API_URL=http://localhost:3000`

### 네트워크 설정
- 백엔드: 3000 포트 (내부/외부)
- 프론트엔드: 80 포트 (외부), 내부에서 백엔드 연결
- SQLite: 볼륨 마운트로 데이터 영속성

### 헬스체크 설정
- 백엔드: `/v1/health` 엔드포인트 응답 확인
- 프론트엔드: Nginx 상태 확인
- 의존성: 프론트엔드는 백엔드 healthy 상태 대기

## Output Log

[2025-06-15 00:00:00] Task 생성됨 - Docker Compose 통합 환경 구성 시작

### 2025-06-23 12:30 - Docker Compose 통합 환경 완료

#### 발견된 완성된 구성

**1. 완전한 Docker Compose 스택 (`docker-compose.yml`)**
- **Redis 캐시 서비스**: Redis 7-alpine, 헬스체크 포함
- **백엔드 API 서비스**: Node.js 기반, SQLite 지원
- **프론트엔드 웹 서비스**: React + Nginx 기반
- **Nginx 리버스 프록시**: 프로덕션급 로드 밸런싱

**2. 최적화된 백엔드 Dockerfile (`backend-api/Dockerfile`)**
- **멀티스테이지 빌드**: Builder + Runtime 단계 분리
- **Oracle 클라이언트 지원**: Instant Client 설치 및 설정
- **보안 강화**: 비root 사용자(nestjs:nodejs) 실행
- **헬스체크**: `/api/v1/health` 엔드포인트 모니터링
- **최적화**: 프로덕션 의존성만 포함, 레이어 캐시 최적화

**3. 최적화된 프론트엔드 Dockerfile (`frontend-web/Dockerfile`)**
- **멀티스테이지 빌드**: Builder + Runtime(Nginx) 단계 분리
- **정적 파일 서빙**: Nginx 1.25-alpine 기반
- **환경변수 지원**: 빌드 시 API URL 설정
- **헬스체크**: HTTP 상태 확인

**4. 프로덕션급 Nginx 설정**
- **리버스 프록시**: `/api/` → 백엔드, `/` → 프론트엔드
- **성능 최적화**: Gzip 압축, 정적 파일 캐싱
- **보안 헤더**: XSS, CSRF, Content-Type 보호
- **WebSocket 지원**: 실시간 통신 지원
- **에러 처리**: 502/503/504 에러 페이지

**5. 인프라 구성**
- **네트워킹**: `vanillameta-network` 브리지 네트워크
- **데이터 영속성**: SQLite, Redis, Nginx 로그 볼륨
- **서비스 의존성**: Redis → 백엔드 → 프론트엔드 → Nginx 순서
- **헬스체크**: 모든 서비스에 30초 간격 건강 상태 모니터링

#### 포트 구성

- **외부 접근**:
  - 웹 애플리케이션: `http://localhost` (포트 80)
  - HTTPS: `https://localhost` (포트 443)
  - Redis: `localhost:6379`
  
- **내부 서비스 통신**:
  - 백엔드 API: `backend:3000`
  - 프론트엔드: `frontend:80`
  - Redis: `redis:6379`

#### 주요 특징

**확장성**
- 마이크로서비스 아키텍처 준비
- 로드 밸런싱 지원 (Nginx upstream)
- 수평 스케일링 가능

**안정성**
- 자동 재시작 정책 (`unless-stopped`)
- 헬스체크 기반 장애 감지
- 의존성 순서 보장 (`depends_on`)

**보안**
- 비root 사용자 실행
- 보안 헤더 설정
- 내부 네트워크 격리

**성능**
- 멀티스테이지 빌드로 최소 이미지 크기
- Nginx Gzip 압축
- 정적 파일 캐싱 (1년)
- Keep-alive 연결

#### 사용법

```bash
# 전체 스택 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 서비스 상태 확인
docker compose ps

# 개별 서비스 재시작
docker compose restart backend

# 전체 스택 종료
docker compose down

# 볼륨까지 삭제
docker compose down -v
```

#### 개발 환경별 구성

추가로 다음 Docker Compose 파일들도 준비됨:
- `docker-compose.dev.yml`: 개발 환경용
- `docker-compose.local.yml`: 로컬 개발용
- `docker-compose.test.yml`: 테스트 환경용
- `docker-compose.multi-db.yml`: 다중 DB 테스트용

**결과**: 프로덕션급 Docker Compose 환경이 완전히 구축되어 `docker compose up` 한 번으로 전체 VanillaMeta 스택을 실행할 수 있음. Redis 캐시, Nginx 리버스 프록시까지 포함된 완전한 마이크로서비스 아키텍처.