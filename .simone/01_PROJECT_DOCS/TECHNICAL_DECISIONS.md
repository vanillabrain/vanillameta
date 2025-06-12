# 기술 결정 사항

## 주요 기술 선택 근거

### Frontend: React vs Vue vs Angular
**선택: React**
- 이유: 
  - 대규모 커뮤니티와 생태계
  - ECharts와의 원활한 통합
  - 컴포넌트 기반 아키텍처가 위젯 시스템에 적합
  - 기업 환경에서 널리 사용됨

### Backend: NestJS vs Express vs Fastify
**선택: NestJS**
- 이유:
  - 엔터프라이즈급 구조와 모듈 시스템
  - TypeScript 네이티브 지원
  - 의존성 주입으로 테스트 용이성
  - Serverless 환경과의 호환성

### 데이터베이스: TypeORM + Knex 이중 구조
**선택 이유:**
- TypeORM: 메타데이터 관리에 적합한 ORM 기능
- Knex: 다양한 DB 엔진 지원 및 동적 쿼리 빌딩
- 두 도구의 장점을 결합하여 유연성 확보

### 배포: Serverless (Lambda) vs Container (ECS/K8s)
**선택: Serverless**
- 이유:
  - 자동 확장성
  - 운영 오버헤드 최소화
  - 비용 효율성 (특히 초기 단계)
  - 빠른 배포 및 롤백

## 아키텍처 패턴

### Modular Monolith
- 마이크로서비스의 복잡성 없이 모듈화 달성
- 각 모듈이 명확한 경계와 책임 보유
- 향후 마이크로서비스로 전환 가능

### Repository Pattern
- 데이터 접근 로직 추상화
- 테스트 용이성 향상
- 데이터 소스 변경 시 영향 최소화

## 제약사항 및 트레이드오프

### Lambda Cold Start
- 문제: 첫 요청 시 지연
- 해결: Warmup 플러그인 사용
- 트레이드오프: 약간의 추가 비용

### 다중 데이터베이스 지원
- 도전: 각 DB의 SQL 방언 차이
- 해결: Knex 커스텀 dialect 구현
- 트레이드오프: 유지보수 복잡도 증가

### 실시간 업데이트 부재
- 현재: 폴링 방식
- 계획: WebSocket 도입
- 이유: 초기 단계에서는 단순성 우선