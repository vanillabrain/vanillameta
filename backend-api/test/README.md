# 테스트 디렉토리 구조

이 디렉토리는 VanillaMeta 백엔드 테스트를 위한 표준화된 구조를 따릅니다.

## 디렉토리 구조

```
test/
├── unit/          # 단위 테스트 (서비스, 컨트롤러 등)
├── integration/   # 통합 테스트 (모듈 간 상호작용)
├── e2e/          # E2E 테스트 (전체 플로우)
├── helpers/      # 테스트 헬퍼 함수 및 유틸리티
├── fixtures/     # 테스트 데이터 및 모킹 도구
├── performance/  # 성능 테스트
├── security/     # 보안 테스트
└── setup.ts      # 테스트 전역 설정
```

## 파일 명명 규칙

- **단위 테스트**: `*.spec.ts`
- **통합 테스트**: `*.integration.spec.ts`
- **E2E 테스트**: `*.e2e-spec.ts`
- **Mock 파일**: `*.mock.ts`
- **Helper 파일**: `*.helper.ts`
- **Fixture 파일**: `*.fixture.ts`

## Jest 설정

### 기본 테스트 실행
```bash
# 모든 테스트
yarn test

# 단위 테스트만
yarn test:unit

# 통합 테스트만  
yarn test:integration

# E2E 테스트만
yarn test:e2e

# 빠른 테스트 (캐시 활용)
yarn test:fast
```

### 커버리지
```bash
yarn test:cov
```

## 테스트 작성 가이드

1. **단위 테스트**: 개별 함수/클래스의 로직 검증
2. **통합 테스트**: 여러 모듈 간의 상호작용 검증
3. **E2E 테스트**: 실제 HTTP 요청을 통한 전체 플로우 검증

각 테스트는 독립적이어야 하며, 테스트 간 의존성이 없어야 합니다.