---
task_id: T07_S01
sprint_sequence_id: S01
status: pending
complexity: High
last_updated: 2025-06-15T00:00:00Z
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

- [ ] `docker-compose.yml` 파일 생성 (루트 디렉토리)
- [ ] 백엔드 Dockerfile 생성 (`backend-api/Dockerfile`)
- [ ] 프론트엔드 Dockerfile 생성 (`frontend-web/Dockerfile`)
- [ ] `docker compose up` 명령으로 전체 스택 실행
- [ ] 백엔드가 http://localhost:3000 에서 정상 응답
- [ ] 프론트엔드가 http://localhost:80 에서 정상 로드
- [ ] 프론트엔드에서 백엔드 API 정상 호출
- [ ] SQLite 데이터가 컨테이너 재시작 후에도 유지
- [ ] 모든 서비스가 healthy 상태로 시작

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
*(이 섹션은 작업 진행 시 업데이트됩니다)*

[2025-06-15 00:00:00] Task 생성됨 - Docker Compose 통합 환경 구성 시작