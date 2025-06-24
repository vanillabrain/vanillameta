---
task_id: T09_S01
sprint_sequence_id: S01
status: open
complexity: Medium
last_updated: 2025-06-23T14:00:00Z
---

# Task: API 통합 테스트 작성

## Description
주요 API 엔드포인트에 대한 통합 테스트(E2E 테스트)를 작성하여 전체 요청-응답 플로우의 정확성을 검증합니다. Controller부터 Service, Repository까지의 전체 스택이 올바르게 동작하는지 확인하는 테스트를 구현합니다.

## Goal / Objectives
- 주요 API 엔드포인트의 통합 테스트 작성
- 요청-응답 플로우 전체 검증
- 인증이 필요한 API의 보안 테스트
- API 응답 형식 및 상태 코드 검증

## Acceptance Criteria
- [ ] Dashboard CRUD API 통합 테스트 작성
- [ ] Widget CRUD API 통합 테스트 작성
- [ ] Database connection API 테스트 작성
- [ ] Authentication API 테스트 작성
- [ ] 인증이 필요한 엔드포인트 보안 테스트
- [ ] API 응답 스키마 검증 테스트
- [ ] 에러 상황 API 응답 테스트

## Subtasks
- [ ] 테스트 데이터베이스 환경 설정
- [ ] Dashboard API 통합 테스트 작성
- [ ] Widget API 통합 테스트 작성
- [ ] Database API 통합 테스트 작성
- [ ] Authentication API 통합 테스트 작성
- [ ] API 보안 및 권한 테스트 작성
- [ ] 에러 응답 형식 테스트 작성
- [ ] 통합 테스트 실행 및 검증

## 기술 가이드

### 테스트 대상 API 엔드포인트
- **Dashboard API**: `/api/dashboard/*` (CRUD 엔드포인트)
- **Widget API**: `/api/widget/*` (위젯 관리 엔드포인트)
- **Database API**: `/api/database/*` (DB 연결 및 쿼리)
- **Auth API**: `/api/auth/*` (로그인, 토큰 갱신)

### 기존 E2E 테스트 패턴
```typescript
describe('Dashboard API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    // 테스트용 토큰 생성
    authToken = await getTestAuthToken(app);
  });

  describe('/dashboard (POST)', () => {
    it('should create a new dashboard', () => {
      return request(app.getHttpServer())
        .post('/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDashboardDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('id');
        });
    });
  });
});
```

### 테스트 환경 설정
- **데이터베이스**: SQLite 메모리 DB 또는 테스트 전용 DB
- **인증**: 테스트용 JWT 토큰 생성
- **외부 서비스**: Mock 또는 Test Double 활용
- **파일 시스템**: 임시 디렉토리 활용

### 검증 항목
- HTTP 상태 코드 정확성
- 응답 데이터 스키마 검증
- 인증/인가 로직 동작
- 비즈니스 규칙 준수

## 구현 노트

### 단계별 접근법
1. 테스트 환경 및 데이터베이스 설정
2. 인증 헬퍼 함수 작성
3. 주요 API별 통합 테스트 작성
4. 에러 케이스 및 보안 테스트 추가
5. 테스트 실행 및 결과 검증

### API별 테스트 시나리오
- **Dashboard**: 생성→조회→수정→삭제 플로우
- **Widget**: 위젯 생성, 데이터 연결, 설정 변경
- **Database**: 연결 테스트, 스키마 조회, 쿼리 실행
- **Auth**: 로그인, 토큰 갱신, 로그아웃

### 보안 테스트 포인트
- 인증되지 않은 요청 차단
- 권한이 없는 사용자 접근 제한
- SQL Injection 방지 검증
- XSS 방지 검증

### 성능 고려사항
- 테스트 데이터 정리 자동화
- 병렬 테스트 실행 지원
- 테스트 실행 시간 최적화

## Output Log
*(This section is populated as work progresses on the task)*