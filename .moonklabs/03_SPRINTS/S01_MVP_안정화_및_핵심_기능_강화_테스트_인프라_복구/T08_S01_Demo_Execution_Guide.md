---
task_id: T08_S01
sprint_sequence_id: S01
status: pending
complexity: Medium
last_updated: 2025-06-15T00:00:00Z
---

# Task: T08_S01_Demo_Execution_Guide

## Description
VanillaMeta Docker 데모를 5분 내에 실행할 수 있는 완전한 가이드를 작성합니다. 기술적 배경 지식이 없는 사용자도 쉽게 따라할 수 있도록 단계별 설명과 스크린샷을 포함합니다.

README.md 업데이트와 별도의 DEMO.md 가이드를 통해 사용자 온보딩을 최적화합니다.

## Goal / Objectives
누구나 5분 내에 VanillaMeta 데모를 실행할 수 있는 완전한 가이드를 제공합니다.

- 전제 조건 및 필수 설치 프로그램 안내
- 단계별 실행 가이드 (명령어 포함)
- 주요 기능 데모 시나리오 제공
- 트러블슈팅 가이드 포함
- 스크린샷과 예시로 시각적 가이드 제공

## Acceptance Criteria
다음 조건들이 모두 충족되어야 작업이 완료된 것으로 간주됩니다:

- [ ] 루트 README.md 업데이트 (Quick Start 섹션)
- [ ] DEMO.md 파일 생성 (상세 데모 가이드)
- [ ] 전제 조건 명시 (Docker, Git 등)
- [ ] 5분 이내 실행 가능한 단계별 가이드
- [ ] 주요 기능 데모 시나리오 3개 이상
- [ ] 일반적인 문제 해결 가이드
- [ ] 데모 완료 후 정리 방법 안내
- [ ] 스크린샷 또는 GIF로 주요 단계 시각화

## Subtasks
작업을 완료하기 위한 세부 단계들:

### Phase 1: README.md 업데이트
- [ ] 프로젝트 개요 및 주요 기능 소개
- [ ] Quick Start 섹션 추가
- [ ] Docker 데모 실행 간단 가이드
- [ ] 기존 개발 환경 설정과 구분

### Phase 2: DEMO.md 상세 가이드 작성
- [ ] 전제 조건 및 시스템 요구사항
- [ ] 단계별 실행 가이드 작성
- [ ] 각 단계별 예상 소요 시간 명시
- [ ] 명령어 복사-붙여넣기 가능하도록 정리

### Phase 3: 데모 시나리오 작성
- [ ] 시나리오 1: 로그인 및 대시보드 둘러보기
- [ ] 시나리오 2: 데이터베이스 연결 및 데이터셋 생성
- [ ] 시나리오 3: 차트 위젯 생성 및 대시보드 구성
- [ ] 각 시나리오별 예상 결과 및 스크린샷

### Phase 4: 트러블슈팅 및 FAQ
- [ ] 일반적인 설치/실행 문제 해결
- [ ] 포트 충돌 문제 해결 방법
- [ ] 브라우저별 호환성 안내
- [ ] 성능 최적화 팁

## Technical Guidance

### README.md 구조
```markdown
# VanillaMeta

## 🚀 Quick Start (Docker 데모)

Docker가 설치되어 있다면 5분 내에 VanillaMeta를 체험할 수 있습니다:

```bash
git clone https://github.com/your-repo/vanillameta.git
cd vanillameta
docker compose up
```

브라우저에서 http://localhost 접속하여 데모를 확인하세요.

## 📖 상세 데모 가이드
자세한 데모 실행 가이드는 [DEMO.md](./DEMO.md)를 참조하세요.
```

### DEMO.md 구조
```markdown
# VanillaMeta 데모 가이드

## 전제 조건
- Docker Desktop 설치 (Windows/Mac) 또는 Docker Engine (Linux)
- Git 설치
- 최소 4GB RAM, 2GB 디스크 공간

## 실행 단계 (총 소요시간: 3-5분)

### 1단계: 프로젝트 클론 (30초)
### 2단계: Docker 실행 (2-3분)
### 3단계: 브라우저 접속 (10초)

## 데모 시나리오

### 시나리오 1: 첫 로그인 및 대시보드 (2분)
### 시나리오 2: 데이터 연결하기 (3분)
### 시나리오 3: 차트 만들기 (5분)

## 문제 해결
```

### 데모 시나리오 예시

**시나리오 1: 첫 로그인 및 대시보드**
1. http://localhost 접속
2. 기본 계정으로 로그인 (admin@example.com / password)
3. 대시보드 목록 확인
4. 샘플 대시보드 열어보기
5. 각 차트 위젯 상호작용 테스트

**시나리오 2: 데이터베이스 연결하기**
1. 데이터 소스 메뉴 접속
2. SQLite 연결 추가 (기본 제공)
3. 테이블 목록 확인
4. 간단한 SQL 쿼리 실행
5. 결과 데이터 확인

**시나리오 3: 차트 위젯 생성**
1. 새 위젯 생성 페이지
2. 데이터셋 선택
3. 차트 타입 선택 (예: Bar Chart)
4. 데이터 매핑 설정
5. 차트 미리보기 및 저장

### 트러블슈팅 가이드

**포트 충돌 문제**
```bash
# 포트 사용 확인
netstat -tulpn | grep :80
netstat -tulpn | grep :3000

# 다른 포트로 실행
docker compose -f docker-compose.override.yml up
```

**Docker 메모리 부족**
- Docker Desktop에서 메모리 할당량 4GB 이상 설정
- 불필요한 컨테이너/이미지 정리

**브라우저 캐시 문제**
- 시크릿 모드로 접속
- 브라우저 캐시 및 쿠키 삭제

### 스크린샷 포함 위치
- 로그인 화면
- 메인 대시보드
- 차트 생성 화면
- 데이터 소스 연결 화면

## Output Log
*(이 섹션은 작업 진행 시 업데이트됩니다)*

[2025-06-15 00:00:00] Task 생성됨 - 데모 실행 가이드 작성 시작