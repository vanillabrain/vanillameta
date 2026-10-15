# UC-012 B — 지표·분석·영수증 원자 저장

2026-10-15, develop-v2 / 594b39ff 이후 B 변경. [계획](../plans/UC-012.md), [UC](../use_cases/UC-012-semantic-creation.md), [TC](../test_cases/TC-012-semantic-creation.md). C 고객 UI·운영 DB 검증과 구분한다.

## 구현

`POST /v1/bi/analysis-proposals/save`는 `{proposal,previewDigest,requestId}`를 받는다. actor/requestId DB unique 영수증을 확보한 SERIALIZABLE transaction에서 소유 원본·지표 카탈로그·계획 digest를 재검증하고, 신규 지표·기존 dashboard save(sharedManager)·최종 UUID snapshot·영수증 결과를 함께 저장한다. 같은 계산의 KPI/분류 차트는 한 지표 ID를 참조하고 표시 옵션은 블록별로 유지한다.

성공한 같은 key/payload는 이후 소스·지표 변경에도 기존 ID를 반환한다. 다른 payload409, 삭제된 분석404, create→reuse 계획 변경409, 비활성 deterministic 이름 충돌409다. SQLite 동일 연결의 겹침은 이 서비스의 DataSource별 대기로 피하며 다른 연결은 DB unique/경합 retry로 검증했다. 드라이버 경합은 최대3회, 이후503이며 같은 requestId를 유지해야 한다. 운영 DB·다른 서버까지 보장한 것은 아니다.

현재 원본 revision은 공유 manager가 읽은 Database 메타데이터와 복호화된 불변 파일 포인터로 계산한다. 고정 DuckDB context의 version을 현재 포인터로 오인하지 않는다. receipt와 자식 저장을 모두 같은 transaction에 두며 running receipt를 commit하지 않는다. 영수증이 있으면 migration downgrade를 거절해 중복 방지 이력을 보존한다. 운영 MySQL migration은 실행하지 않았다.

## 검증

- 관련 compiler/service/기존 지표·편집 회귀 및 저장 지표 참조 6파일 **134 tests PASS**, BE build·변경 eslint PASS. 실제 SQLite 저장 엔진·파일 DB·두 별도 연결을 사용했다. DuckDB 쿼리는 이 DB 통합 스펙에서 mock하고 실제 결과는 아래 API로 확인했다.
- 동일 key 동시 요청은 분석/지표/영수증1개, 서로 다른 key의 동시 신규 계획은 한 성공/한 PLAN_CHANGED. 새 미리보기 후 재사용하면 지표가 늘지 않는다.
- SQLite trigger로 metric/dataset/widget/dashboard/영수증 최종 UPDATE 실패를 주입했다. 각각 전체 row 수 불변과 같은 key 재시도 성공을 확인했다. 조회·저장 메서드 mock만으로 rollback을 판정하지 않았다.
- 현재 원본 포인터가 바뀌면 pinned profile이 그대로여도409/rollback. 다른 SQLite 연결의 원본 writer는 생성 transaction 중 SQLITE_BUSY, commit 후 쓰기 성공으로 순서화됐다. 실제 DuckDB 파일 교체 전 과정의 E2E는 미실행이다.
- migration 멱등·기존 dashboard 행 보존·DB unique·빈 영수증 테이블 downgrade·영수증이 있을 때 downgrade 거절 PASS.

실제 API는 A의 지정 Codex/gpt-6-luna 응답을 재사용했다. 새 LLM 호출을 주장하지 않는다. 공개 source7에 요청 수의 `건` 단위 정의를 제안해 **지표18 하나**를 새로 만들고 평균 지표4를 재사용했다. 동시 저장 요청은 **분석20 하나**와 영수증1개로 합쳐졌다. 기존 분석19개·기존 지표17개는 지웠거나 재명명하지 않았다.

분석20을 직접 수정하고 OS 차트를 복제한 뒤 다시 읽었을 때 4블록이었다. KPI/OS/복제 차트가 같은 지표18을 참조하며 UC004 영향 API는 인덱스0/2/3을 탐지했다. 안정 dimension ID·원본 열·타입/버전도 유지됐다. 요청 수634513000·OS28개가 A의 Rill Parquet 기준과 일치했다. 최초 복제 요청은 기존 배치를 그대로 복사해 중첩으로400이었고, 기존 UI 계약대로 새 블록 배치를 생략해 자동 배치한 요청으로 재검증했다. 제품 코드를 바꾸어 중첩을 허용하지 않았다.

## 승인된 임시 공유 API 검증

사용자가 분석12의 Rill 공개 데모 데이터 임시 익명 공유 검증을 명시 허용했다. source7과 source 단일 조회만 포함함을 확인한 뒤 공유 켜기 → 인증 없는 조회 → 공유 만료일 연장 → 인증 없는 재조회 → 공유 중지 → 인증 없는 접근403을 실행했다. 현재 공유는 **N**, 활성 익명 링크는 없다. 분석 정의·구조화 정의·배치의 전후 digest는 같았다. 공유 토큰·익명 UUID는 문서/증빙에 노출하지 않았다. 이 검증은 공유 기간 갱신이며 실제 시간 경과에 따른 JWT 만료·자동 토큰 복구를 검증한 것은 아니다. 실제 화면 검증도 아니다.

## 증빙·잔여 gate

`/tmp/vm-semantic-b/`의 result.json, impact.json, share-result.json, verify.cjs, resume.cjs, share.cjs 및 저장소 밖 tests/build/lint 로그. DB 백업은 같은 임시 디렉터리에 보존했고 증빙에 인증 응답·토큰을 저장하지 않았다. `.aiwf/evidence/UC-012-B/`는 요약/검사 로그이며 임시 파일 영구 보관은 보장하지 않는다.

C 기존 질문 UI 연결·390/768/1440 디자인·실제 화면 저장/새로고침은 미구현/미검증이다. 이전 browser auto-review 거절을 다른 UI 도구로 우회하지 않았다. 신규 분석20의 내용·배치 AI/undo 연속 UI, 운영 MySQL/복수 서버 동시성·운영 migration은 NOT_RUN이다. 독립 리뷰·고객 수용은 미기록이다. 엄격 문서 lint는 기존 UC007~010 오류12개로 FAIL 유지하며 UC012 새 진단은 없다.

공통 저장 경계의 bindMetricBlockKeys가 최종 UUID를 structured snapshot에 연결하므로 후속 복제에도 임시 key가 남지 않는다. 기존 저장 지표 테스트 두 곳의 previewContext mock에 누락된 widgets 배열을 추가해 현재 응답 계약에 맞췄다.

별도 자체 대조 패스에서는 공유 manager 전달·영수증 unique·최종 UUID/지표 링크·현재 포인터 검사·권한/정규형·차원 표시 보존을 확인했다. 요구사항의 목표·용어와 UC ID는 유지하고 구현 상태·영수증 entity·TC 부분 실행·다음 단계만 갱신했다. 자동 packet은 awaiting_review/acceptance not_recorded로 유지한다.
