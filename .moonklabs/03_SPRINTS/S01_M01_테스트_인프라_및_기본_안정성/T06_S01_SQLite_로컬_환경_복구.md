---
task_id: T06_S01
sprint_sequence_id: S01
status: open
complexity: Medium
last_updated: 2025-06-23T14:00:00Z
---

# Task: SQLite 로컬 환경 복구

## Description
개발자가 로컬에서 쉽게 개발할 수 있도록 SQLite 기반 로컬 개발 환경을 복구하고 안정화합니다. MySQL 의존성 없이 SQLite만으로 기본적인 개발 및 테스트가 가능하도록 환경을 구성합니다.

## Goal / Objectives
- SQLite 기반 로컬 개발 환경 구축
- `yarn start:local` 명령어로 로컬 서버 실행 가능
- 로컬 환경에서 기본적인 CRUD 기능 동작 확인
- 개발자 온보딩 시간 단축 (30분 이내 환경 구축)

## Acceptance Criteria
- [ ] SQLite 데이터베이스 설정 및 연결 정상 작동
- [ ] `yarn start:local` 명령어로 백엔드 서버 실행 가능
- [ ] 기본 테이블 생성 및 시드 데이터 삽입 성공
- [ ] 주요 API 엔드포인트가 SQLite에서 정상 동작
- [ ] 로컬 환경 설정 문서 업데이트
- [ ] 환경 변수 설정 가이드 작성

## Subtasks
- [ ] SQLite 설정 파일 및 연결 구성 검토
- [ ] TypeORM 설정에서 SQLite 환경 분리
- [ ] 로컬 환경용 마이그레이션 파일 정리
- [ ] 시드 데이터 스크립트 작성 및 실행
- [ ] 로컬 실행 스크립트 개선
- [ ] 환경 변수 템플릿 파일 생성
- [ ] 로컬 환경 테스트 및 검증

## 기술 가이드

### 코드베이스 주요 구성
- **ORM 설정**: `/backend-api/ormconfig.ts`
- **데이터베이스 설정**: `/backend-api/src/data-source.ts`
- **시드 스크립트**: `/backend-api/database/seeds/`
- **로컬 실행 스크립트**: `/backend-api/scripts/start-local.js`

### 기존 SQLite 설정 분석
- SQLite 파일 위치: `/identifier.sqlite`
- TypeORM 설정에서 SQLite 옵션
- 마이그레이션 파일 호환성
- 엔티티 관계 및 제약조건 처리

### 환경 분리 패턴
```typescript
// 환경별 데이터베이스 설정
const config = {
  development: {
    type: 'sqlite',
    database: './identifier.sqlite',
    synchronize: true,
  },
  production: {
    type: 'mysql',
    // MySQL 설정
  }
};
```

### 통합 지점
- **환경 변수**: `.env.local` 파일 설정
- **마이그레이션**: SQLite 호환 마이그레이션
- **시드 데이터**: 기본 개발 데이터 제공
- **API 테스트**: Postman/Thunder Client 설정

### 시드 데이터 구성
- 기본 사용자 계정 (admin/test user)
- 샘플 데이터베이스 연결 정보
- 기본 대시보드 및 위젯 템플릿
- 컴포넌트 및 차트 타입 데이터

## 구현 노트

### 단계별 접근법
1. 현재 SQLite 설정 상태 확인
2. TypeORM 설정 환경별 분리
3. SQLite 호환 마이그레이션 수정
4. 시드 데이터 스크립트 작성
5. 로컬 실행 환경 테스트
6. 문서 업데이트

### SQLite 특화 고려사항
- **제약조건**: SQLite의 제한된 ALTER TABLE 지원
- **데이터 타입**: MySQL과 SQLite 타입 매핑
- **외래키**: SQLite 외래키 활성화 설정
- **인덱스**: 성능 최적화를 위한 인덱스 설정

### 로컬 환경 최적화
- 빠른 시작을 위한 synchronize 옵션 활용
- 개발 편의를 위한 로깅 활성화
- 핫 리로드 지원을 위한 watch 모드
- 에러 상황 대응을 위한 복구 스크립트

### 성능 고려사항
- SQLite WAL 모드 활성화
- 연결 풀 설정 최적화
- 메모리 캐시 활용
- 동시성 처리 개선

### 호환성 보장
- MySQL과 SQLite 간 SQL 문법 차이 해결
- 날짜/시간 타입 처리 통일
- JSON 컬럼 타입 호환성
- 대소문자 구분 설정 통일

## Output Log
*(This section is populated as work progresses on the task)*