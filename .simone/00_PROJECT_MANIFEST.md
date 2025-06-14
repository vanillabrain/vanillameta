---
project_name: VanillaMeta
current_milestone_id: M01
highest_sprint_in_milestone: S07
current_sprint_id: S01
status: active
last_updated: 2025-06-12 22:43:00
---

# Project Manifest: VanillaMeta

This manifest serves as the central reference point for the project. It tracks the current focus and links to key documentation.

## 1. Project Vision & Overview

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 50개 이상의 차트 타입으로 시각화를 생성하고 대시보드를 구축할 수 있습니다. 

주요 특징:
- 다중 데이터베이스 지원 (PostgreSQL, MySQL, Oracle, BigQuery 등)
- 코드 없는 차트 위젯 제작
- 사용자 맞춤형 대시보드
- 고급 SQL 쿼리 편집기

This project follows a milestone-based development approach.

## 2. Current Focus

- **Milestone:** M01 - MVP 안정화 및 핵심 기능 강화
- **Sprint:** S01 - 테스트 인프라 복구

## 3. Sprints in Current Milestone

### S01 테스트 인프라 복구 (📋 PLANNED - NEXT)

📋 테스트 설정 파일 추가 및 의존성 주입 문제 해결
📋 디렉토리명 오타 수정 및 파일 시스템 정리
📋 기본 테스트 커버리지 20% 달성

### S02 시스템 안정성 기반 (📋 PLANNED)

📋 전역 에러 핸들러 구현 (T01_S02)
📋 프론트엔드 Error Boundary (T02_S02)
✅ 구조화된 JSON 로깅 시스템 (T03_S02) - COMPLETED
📋 Correlation ID 구현 (T04_S02)
📋 CloudWatch 로그 최적화 (T05_S02)
📋 SQL 인젝션 방지 강화 (T06_S02)

### S03 데이터베이스 성능 (📋 PLANNED)

✅ 데이터베이스 인덱스 분석 및 구현 (T01_S03) - COMPLETED (2025-06-12 22:43)
📋 N+1 쿼리 문제 해결 (T02_S03)
📋 TypeORM 쿼리 최적화 (T03_S03)
📋 연결 풀 최적화 (T04_S03)
✅ 쿼리 실행 계획 분석 (T05_S03) - COMPLETED (2025-06-12 23:52)
📋 느린 쿼리 모니터링 설정 (T06_S03)
📋 데이터베이스별 특화 최적화 (T07_S03)

### S04 API Lambda 최적화 (📋 PLANNED)

📋 Lambda 콜드 스타트 최적화
📋 API 응답 압축 구현
📋 페이지네이션 개선

### S05 프론트엔드 성능 (📋 PLANNED)

✅ 번들 크기 최적화 (T01_S05) - Tree shaking과 코드 스플리팅 - COMPLETED (2025-06-14 14:55)
📋 동적 임포트 구현 (T02_S05) - React.lazy() 활용
📋 리소스 지연 로딩 (T03_S05) - 이미지 및 리소스 최적화
📋 차트 렌더링 최적화 (T04_S05) - 가상화, 디바운싱
📋 React 메모이제이션 (T05_S05) - React.memo, useMemo 적용
📋 웹 폰트 최적화 (T06_S05) - Pretendard 서브셋팅
📋 Service Worker 구현 (T07_S05) - 오프라인 지원
📋 성능 모니터링 설정 (T08_S05) - Web Vitals 추적

### S06 대용량 데이터 처리 (📋 PLANNED)

📋 스트리밍 구현
📋 쿼리 캐싱 전략
📋 배치 처리 로직

### S07 모니터링 및 문서화 (📋 PLANNED)

📋 CloudWatch 대시보드 구성
📋 API 문서 업데이트
📋 사용자 매뉴얼 작성

## 4. Key Documentation

- [Architecture Documentation](./01_PROJECT_DOCS/ARCHITECTURE.md)
- [Current Milestone Requirements](./02_REQUIREMENTS/MVP_안정화_및_핵심_기능_강화/)
- [General Tasks](./04_GENERAL_TASKS/)
- [Latest Project Review](./10_STATE_OF_PROJECT/2025-06-12-12-00-needs-focus.md)

## 5. General Tasks

### T001 Backend Test Suite Enhancement (🔄 IN PROGRESS)
🔄 기존 테스트 케이스를 분석하여 포괄적인 단위 테스트와 E2E 테스트 스위트 구성
- **Target Coverage**: 80% 이상
- **Status**: In Progress (2025-06-13 10:38)
- **File**: [T001_Backend_Test_Suite_Enhancement.md](./04_GENERAL_TASKS/T001_Backend_Test_Suite_Enhancement.md)

### T002 Frontend Build Error Fix Dynamic Import (📋 NOT STARTED)
📋 프론트엔드 빌드 실패를 일으키는 TypeScript 타입 오류 해결
- **Issue**: API 서비스 타입 정의와 실제 axios 응답 구조 불일치
- **Status**: Not Started (2025-06-14 20:04)
- **File**: [T002_Frontend_Build_Error_Fix_Dynamic_Import.md](./04_GENERAL_TASKS/T002_Frontend_Build_Error_Fix_Dynamic_Import.md)

## 6. Quick Links

- **Current Sprint:** [S01 Sprint Folder](./03_SPRINTS/S01_MVP_안정화_및_핵심_기능_강화_테스트_인프라_복구/)
- **Active Tasks:** Check sprint folder for T##_S01_*.md files
- **Project Reviews:** [Latest Review](./10_STATE_OF_PROJECT/)
