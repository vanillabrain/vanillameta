# UC051 SQLite 교차 작업·확정 권한 조회 검증

2026-10-18 · develop-v2 · 기준 cf2a2ede 이후 [설계](../plans/UC-051-sqlite-coordination.md). FR016/017·NFR005/007/008·TC050 E02/E03/E12의 선택 기반 검증이다. 전체16개 요건과 TC050은 미완료다.

## 재현과 수정

실제 메모리 SQLite에 Studio transaction을 유지하고 별도 enterprise transaction을 실행했다. 종전 모듈별 큐에서는 두 번째 작업이 먼저 성공했지만 Studio rollback 후 최종 값이0이었다. 회귀는 `acknowledgedBeforeRelease:false, finalValue:2`를 요구하며 수정 전에는 `true,0`으로 실패했다. 새 DataSource별 공통 큐에서는 두 번째 쓰기가 rollback을 기다린 뒤 독립 commit한다. 재현/수정 로그는 Git 제외 `.aiwf/evidence/UC051-sqlite-coordination/`에 보존한다.

`common/metadata-work`는 SQLite에만 작업 큐를 적용한다. 기존 enterprise/view/semantic/Studio 큐와 명시 metadata transaction 진입점을 연결했다. 같은 기다리는 하위 서비스는 살아 있는 AsyncLocalStorage lease에서 재진입하고 종료된 비동기 문맥은 새로 대기한다. Studio32개 대기 제한·같은 manager/isolation·CAS/lock·영수증/취소/rollback을 유지한다. 큐는 권한 승인이 아니며 actor/grant 검사는 그대로다. 다른 DataSource와 MySQL 등은 직렬화하지 않는다.

SourceAccess·기업 정책/활성 관리/조직 문맥·JWT guard/validate와 Studio get/prepare·기존 UUID 게시 state/publicResult의 선택 조회 전체를 같은 범위로 묶었다. 실제 SQLite의 미커밋 소스 활성/계정 비활성을 유지한 동안 세 조회는 완료되지 않고 rollback 후 source read403·원래 토큰 actor1·상태false를 반환했다. 불완전한 과도 상태를 권한 결과로 사용하지 않는다.

기존 실제 DataSource의 연결 정보를 생략한 mock6곳은 options/connection을 보완했다. assertion/401/403/no-store 기대값은 완화하지 않았다. 새 의존성·스키마·API/제품 UI 변경은 없다.

## 실행 결과

- 실제 교차 transaction/확정 인증·활성 조회와 중첩/오류 후 진행·연결 분리/만료 문맥: 3 suites/5 tests PASS.
- 권한/인증 관련 선택 회귀: 5 suites/148 tests PASS.
- 전체 백엔드 최초 실행: 141 suites/2365 tests 중139 suites/2360 tests PASS, HTTP mock 연결 정보 누락5개 실패. 두 fixture 보완 후 해당2 suites/6 tests 전부 PASS. 전체 실행 로그의 실패를 삭제하거나 최종 전체 재실행으로 표현하지 않는다.
- BE type/build PASS. 변경 파일 lint 오류0/기존 경고7개다. 마지막 HTTP fixture 변경은 선택 회귀/추가 lint로 확인한다.
- 격리 합성 DB의 기존 core Chromium8개 PASS(25.3초). 새 기업 UI의 디자인 검증이나 실제 LLM/운영 수용 증거는 아니다. frontend 제품 소스는 미변경이다.
- AIWF strict 오류0/기존 FR011·NFR002 상태 드리프트 경고2개로 exit1. 상태를 바꿔 경고를 숨기지 않는다. pin/check/packet은 로컬 검토 산출물이며 승인/수용이 아니다.

## 독립 검토

Native code-reviewer가 실제 TypeORM 단일 cached QueryRunner/savepoint와 미조정 root-manager 쓰기의 rollback 유실을 별도 probe로 확인했다. 핵심3 suites/5 tests를 독립 재실행하고 APPROVE(critical/high0)를 반환했다. 두 medium은 refresh 인증 조회의 확정 읽기 적용과 Studio 읽기/preview의 큐 점유 범위다. 아래 후속으로 추적하며 전체 NFR 완료로 승격하지 않는다.

## 잔여와 제한

원시 Repository 단일 save/update/delete와 그 밖의 일반 조회 전체는 아직 조정하지 않았다. 다른 경로가 같은 연결에 미커밋 쓰기를 만들면 영향을 줄 수 있으므로 모든 SQLite 원자성/권한 경합이 끝났다고 보장하지 않는다. 현재 범위를 점유한 채 그 뒤에 별도로 예약한 작업을 기다리는 조합은 지원하지 않는다. 모든 호출자가 기다리는 같은 작업 흐름으로 조합해야 한다.

실제 Ego/390·768·1440 UI는 기존 사용자 제어권 반환 전까지 BLOCKED이며 기존 브라우저를 우회하지 않는다. 이 단위는 UI 변경이 없다. MySQL 실제 경합·실휴대폰·운영 부하·사람 수용도 미실행이다. 일반 Repository 쓰기/조회 후속, 공통 분류·조건 탐색·수신자 전달/알림·영속 export/비교·보관/전체 TC050을 계속 구현한다.

`AuthService.verifyRefreshToken`의 User/RefreshToken 조회와 세션 쓰기는 아직 범위 밖이다. 현재 확정 인증 증거는 JWT guard/validate에 한정한다. Studio get/prepare는 추가 메타데이터 조회가 섞이지 않도록 집계까지 범위를 점유하므로 SQLite에서 긴 집계가 다른 요청의 guard를 기다리게 할 수 있다. 확정 메타데이터 snapshot을 먼저 읽고 집계 전 lease를 해제하는 설계와 실제 동시 지연 측정이 후속이며 성능 SLA는 주장하지 않는다. MySQL passthrough는 변경하지 않았다.
