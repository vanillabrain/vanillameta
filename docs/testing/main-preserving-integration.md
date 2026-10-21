# develop → main 기능 보존 통합 검증

2026-10-20 · 로컬 명시 범위 검증 완료. `main 552b06f8`과 `develop b0239e8b`의 두 이력을 유지하는 merge 후보이며, 운영 배포·전체 제품 수용과 구분한 결과다. [통합 계획](../plans/main-preserving-integration.md)을 따른다.

## 보존 범위

| 영역                | 통합 방식                                                                                  | 검증 범위                                            |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Studio·AI·조직 권한 | develop의 최신 문서·초안·권한 epoch·소유권·회수 계약 유지                                  | 기존 회귀와 격리 MySQL HTTP                          |
| 캐시                | main L1/L2·Redis·대시보드 캐시 유지, 현재 actor/소스 권한과 revision을 hit 전후 확인       | 소스·literal·parameter identity, 현재 정의/권한 변경 |
| 배치·백그라운드 SQL | 기존 실행 기능 유지, 서버가 저장한 actor/epoch·현재 소유권을 worker와 조회/취소에서 재검사 | 소유 MySQL/native DuckDB·선택 Redis                  |
| 진단·관측           | main 모니터링·로그·성능 기능 유지, 서버 운영자 allowlist 분리, URL 대신 라우트 템플릿      | guard·DI·로그 비노출·실제 HTTP                       |
| UI                  | develop shadcn·Studio·반응형과 main 언어·성능/스트리밍 구성요소 유지                       | FE 전체 회귀·빌드·실제 화면                          |
| 서비스 워커         | Vite 빌드에 manifest 주입·등록 연결, 정적 파일만 캐시                                      | 보호 API 제외·빌드 산출물                            |
| DB 최적화           | main의 두 최적화 계열·명시 설정 보존                                                       | 로컬 타입/관련 회귀, 외부 warehouse 미실행           |

`JobQueueModule`, `BatchProcessingModule`, `OptimizationModule`, `QueryTimeoutModule`은 기존 main에서도 AppModule에 직접 연결되지 않았던 별도 모듈이다. 파일·의존성을 보존하되 새로 활성화하지 않는다. 실제 연결된 `BackgroundJobModule`/`BatchModule`과 구분한다. 기존 미구현 메모리 probe·외부 알림 또는 문서상의 기능을 구현 완료로 승격하지 않는다.

## 구성

- Nest 10 계열을 맞추고 최신 native DuckDB·TS·파일/인증 계약을 유지한다.
- Redis는 `REDIS_URL` 또는 명시한 `REDIS_HOST`/`REDIS_PORT`에서 선택 활성화한다. 미설정이면 기존 작업 이력은 읽을 수 있고 새 작업 접수는 503이다.
- 전체 서버 진단은 현재 유효 JWT와 `LEGACY_OPERATIONS_USER_IDS`의 명시 ID가 모두 필요하다. 기본은 빈 목록이며 조직 admin과 다르다.
- 테스트는 새 소유 Docker MySQL 8.4.11·별도 임시 파일·loopback Redis에서만 수행한다. 운영 migration/배포 또는 기존 사용자 DB·파일에 대한 검증이 아니다.

## 현재 확인

- FE 전체: 202개 파일 / 3,287개 테스트 PASS. 2 workers, 112.59초.
- FE type·build PASS. 서비스 워커 산출물의 manifest 치환과 임시 파일 제거 확인, 보호 경계 6개 PASS.
- 초기 통합 Nest/MySQL/Redis HTTP 권한 행렬: 299 요청 / 12개 의미 검증 PASS. 최종 후보 재확인은 아래 후속 결과로 구분한다.
- Redis 미설정 전체 Nest/MySQL 기동 PASS. 후속 HTTP 및 Redis 실행 결과는 진행 중이다.
- 전체 BE 최초 실행은 환경의 loopback 거절과 legacy fixture/인터페이스 불일치를 검출했다. 최초 실패 보고를 통과로 처리하지 않으며 수정 후 재검증을 기록한다.

## 후속 결과

- 최종 전체 앱의 실제 MySQL 8.4.11/Bull Redis/native DuckDB: 작업 결과 합계 600·본인 격리·실행 중 취소·epoch 회수 후 결과 차단·두 공개 이벤트 수집의 저장 행 확인, 6개 검사 PASS. 단순 mocked queue 결과가 아니다.
- Redis 미설정 앱: 진단 401/403/운영자 200·소스 소유권·접수 503/쓰기 없음·이력 조회의 20 HTTP/3개 검사 PASS.
- 별도 소유 MySQL child schema: 보존 migration의 복사/재실행·원본 hash·소수초·열별 기본값·신규 시각 자동 생성·손실 행의 legacy 보존 17개 PASS. child schema 삭제·부재 확인 완료. 활성 앱 schema를 조작한 검증이 아니다.
- Ego 117: 실제 로그인→샘플 분석→새로고침과 언어 선택 유지 확인. 390/768/1440px 넘침 0, 조회·AI 컨트롤 36px, 모바일 날짜 입력 16px, 숫자와 308px 시계열/막대 차트 렌더링 확인. 실휴대폰 검증은 아니다.
- 전체 backend lint 오류 0, frontend src/e2e lint 오류 0. 기존 경고는 남는다. 타입·빌드 결과와 최종 CI/Redis 캐시 후속은 완료 시 아래에 확정한다.

### 발견·수정한 main 기존 충돌

같은 이름의 `job_results`와 `analytics_events`를 서로 다른 entity가 공유하여 실제 MySQL의 결과 저장을 막았다. 네 물리 테이블로 추가 분리하고 기존 공유 테이블은 수정·삭제하지 않는다. 명확히 분류할 수 있고 현재 타입으로 손실 없이 표현되는 행만 복사하며, 목적지 ID·부모 연결도 덮어쓰지 않는다. 모호·고아·손실 예상 행은 legacy에 남겨 **별도 검토가 필요**하다. 모든 과거 이력이 새 화면에서 자동으로 조회된다고 주장하지 않는다.

기존 main-only 미완성 테스트의 존재하지 않는 API 기대는 실제 공개 계약과 실패/경계 조건으로 정리했다. 사용하지 않던 모듈을 활성화하거나 테스트에서만 존재하던 기능을 새로 만들지 않았다. constructor의 관측·미사용 큐 타이머는 종료 시 정리하고 HTTP 서버 생존과 분리했다.

서비스 워커는 정책·빌드 manifest/등록 코드까지 검증했으며 설치 후 오프라인 여정은 이번 실행 범위가 아니다. 큰 작업 결과의 외부 저장·외부 알림과 일부 기존 probe TODO를 완료 기능으로 계산하지 않는다.

### 최종 Git·캐시·CI 확정

- backend 전체 CI 설정(`--maxWorkers=2`): **305 suites / 5,477 tests PASS**, 10 suites / 175 tests opt-in SKIP, exit 0, 294.148초. worker 1개가 종료 제한에 걸려 Jest가 종료한 경고가 남아 있으며 완전한 teardown 통과로 표기하지 않는다. 단일 장수 프로세스 실행의 기존 15초 timeout은 해당 49개 독립 회귀 통과와 구분했고, CI를 실제 전체 검증한 2-worker 범위로 맞췄다. 해당 timeout을 늘리거나 assertion을 제거하지 않았다.
- frontend 전체 **202 files / 3,287 tests PASS**, type·build·src/e2e lint 오류 0. backend build·전체 src lint 오류 0(경고는 별도)이다.
- 최종 전체 Nest/MySQL 앱의 권한 행렬 **298 HTTP / 12개 검사 PASS**. 초기 후보 299 요청과 중복 합산하지 않는다. 같은 fixture의 조건에 따른 읽기 요청 수 차이는 완료율이 아니다.
- 실제 Redis 캐시 **4개 검사 PASS**: 첫 miss→hit, 두 SQL 리터럴의 서로 다른 결과·합계 600, 다른 직원 403, 정상 감독기 재시작의 새 API PID·첫 요청 hit·Redis hit 증가를 확인했다. 작은 결과의 NONE envelope 역직렬화를 수정하고 구형 raw/NONE/GZIP/Brotli 및 손상 payload 회귀 22개가 전체 배치에 포함됐다.
- 최종 코드의 실제 작업/이벤트 6개 검사와 Ego 로그인·샘플 새로고침을 확인했다. LLM 호출은 이번 Git 통합에서 실행하지 않았다.
- 독립 리뷰에서 캐시 권한 대기 경계·인증 DI·URL 로그·테이블 분리/소수초·캐시 codec의 확인된 finding을 해소했다. 리뷰는 해당 수정 범위이며 운영/전체 수용 승인이 아니다.
- 부모 `552b06f8`(main)와 `b0239e8b`(develop)를 유지하는 일반 merge commit으로 반영한다. 원격 반영 SHA는 Git 로그로 확인한다. 사용자 소유 `.omx-state-locks*`는 미추적 상태로 보존한다.

원시 증빙은 Git 제외 `.aiwf/evidence/main-preserving-merge/`와 실행기별 고유 디렉터리에 있다. 테스트용 감독기 복구 이력도 이 위치에 남기며 사용자 실행 환경을 종료하지 않았다.

## 경계

운영 DB migration·실제 외부 warehouse·외부 메일/웹훅 발송·실기기·고객 업무 수용은 이번 로컬 통합의 검증 범위가 아니다. FR014~025/NFR005~008 전체 16개 수용 완료와 이 merge 완료는 구분한다. 원시 로그·임시 계정·토큰·비공개 자료는 Git 제외 증빙에만 둔다.
