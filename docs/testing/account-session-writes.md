# UC051 계정·세션 저장 경계

2026-10-18 · develop-v2 · 기준0f54883a · [설계](../plans/UC-051-account-session-writes.md). FR016/017·NFR005/008·TC050 E02/E03 기반의 선택 검증이며 전체16개 요건/사람 수용은 미완료다.

## 세션 재현·구현

실제 메모리 SQLite의 User.jwtId UPDATE trigger를 실패시켜 세션 행 저장 다음 사용자 연결 갱신을 거절했다. 기존에는 token row가 따로 commit되어 이전 token이 바뀌거나 최초 연결의 고아 row가 남았다. 또한 다른 현재 연결의 힌트로 제3 session 행이 바뀌는 경우·비활성/오래된 epoch 기록·다른 transaction rollback이 로그아웃 성공을 지우는 경우를 포함한6개 회귀가 수정 전 모두 실패했다. Git 제외 `.aiwf/evidence/UC051-account-session-writes/session-red.log`에 보존한다.

setRefreshKey는 새 서명 token의 actor/epoch를 확인하고 실제 manager transaction에서 현재 User와 현재 연결 RefreshToken을 읽어 함께 저장한다. MySQL/MariaDB는 계정 행 pessimistic_write를 사용하고 SQLite는 기존 공통 큐를 사용한다. 전달된 이전 jwtId 힌트로 다른 row를 선택하지 않는다. active/epoch가 바뀐 token과 사용자 연결 UPDATE 실패는 거절하고 token/연결을 rollback한다. API signin 응답/cookie/인자 모양은 유지한다. 실제 MySQL 동시성 검증은 별도다.

실제 SQLite의 동시 최초 로그인 두 개는 같은 연결 행1개를 유지하며 마지막 token만 refresh 인증에 성공한다. JWT 검증은 queue 전 수행하고 계정/연결은 commit 시 재확인한다. 로그아웃은 guard가 검증한 token을 요청 내부에서만 넘겨 id+token 조건 UPDATE로 비운다. 이미 새 token으로 교체된 행은 no-op으로 보존한다. 검증 token이 없으면401이며 기존 HTTP 응답/cookie와 단일 현재 refresh 정책을 유지한다. 이미 발급한 access token을 로그인 교체만으로 일괄 회수하는 새 정책은 아니다. 일반 password 검사·legacy rehash도 공통 SQLite 범위로 수행한다.

## 계정·가입/샘플

계정 변경/삭제의 password 검사와 저장·소속 확인은 같은 SQLite 범위에서 실행하고 재발급 계정 조회/매핑 작업도 확정 상태로 조정한다. SQLite 가입의 중복 확인+저장을 조정한 뒤 lease를 벗어나 샘플을 시작한다. 같은 코드의 MySQL 동시 가입 유일성을 새로 보장하는 변경은 아니다. 샘플 실패는 가입 저장을 취소하지 않으며 metadata read/write만 조정해 물리 파일/seed를 queue에 가두지 않는다. 계정 실제 SQLite 수정 전4실패/5통과9개를 재현했다(별도 실행자의 관찰 capture). 계정/샘플 새2 suites/11개와 선택17 suites/123개 PASS다. 샘플 스펙은 수정 후 추가한 현재 경계 검사이며 별도 RED로 표시하지 않는다. 샘플 전체 원자 생성/영속 작업·재시작 복구를 이 단위 완료로 주장하지 않는다.

## 실행 상태

Auth 실제10개와 기존 session 선택의2 suites/31 tests PASS. 늦은 logout이 새 로그인 token을 지우는 추가 회귀는 수정 전1실패/9통과였고 조건 UPDATE 뒤 통과했다. 이 검증은 실제 SQLite이며 MySQL 경합 실행으로 표시하지 않는다. 최종 전체 BE146 suites/2394 tests PASS(87.466초), 기존 격리 Chromium8개 PASS(23.6초)다. 실제 cookie 로그인/로그아웃과 기존 위젯/저장/공유 여정을 포함하지만 새 기업 UI/Ego·실LLM·전체 TC050 수용 증거는 아니다. BE build/type 및 변경 lint는 명령별 로그에 기록하며 frontend 제품 소스는 미변경이다.

## 잔여·제한

나머지 dataset/widget/template/구형 공유 token 및 일부 config/정의 조회는 여전히 후속이다. SQLite의 같은 프로세스 조정이 모든 MySQL/운영 경합을 보장하지 않는다. 계정 변경/로그아웃의 전체 감사 이력·조직 탈퇴·전체 자산 정리는 별도다. 새 스키마/API/UI/의존성이 없다.

실제 Ego/390·768·1440은 기존 사용자 제어권 반환 전 BLOCKED다. 다른 브라우저로 우회하지 않고 새 UI PASS로 단위/핵심 회귀를 대체하지 않는다. 실휴대폰·MySQL·운영·사람 수용/전체 TC050은 NOT_RUN을 유지한다.

서명 오류/다른 actor token은 token/연결 쓰기0으로 거절한다. MySQL lock 옵션은 mock으로 전달을 확인했으며 실제 MySQL row lock 실행 증거는 아니다. 현재 mysql2 기본 FOUND_ROWS와 app 설정을 확인해 동일 jwtId UPDATE의 affected1 의존성을 코드에 기록했다. RefreshToken의 owner/FK 없이 오래된 DB 연결이 손상된 경우의 보완은 운영 데이터/스키마 후속이다.

## 독립 검토

Auth/CAS 후속은 APPROVE(critical/high/medium0), 계정/가입/샘플은 APPROVE(critical/high0·기존 MySQL 경합 medium2)다. 별도 검토자는 계정/샘플 관련5파일/17개를 재실행하고 source/file worker 구간·lease 해제 후 샘플 시작·조직409/계정 불변을 확인했다. MySQL userId/email unique 부재와 membership userId FK 부재는 알려진 구현 잔여다. 동시 가입 중복/편입-삭제의 고아 방지를 실제 MySQL에서 보장한 것으로 표시하지 않는다. additive 제약/공통 잠금/409와 Docker 검증을 후속으로 추적하며 기존 데이터를 자동 삭제하지 않는다. 샘플 다중 생성/부분 실패 재시도·감사/typed request는 별도다.

최종 build/type PASS·변경 lint 오류0/기존 LoginController import 경고5개다. Strict는 오류0/기존 FR011·NFR002 상태 드리프트 경고2개로 exit1이며 승인 상태를 바꿔 숨기지 않는다. pin/check/packet은 로컬 검토 증빙이며 awaiting_review/acceptance not_recorded를 유지한다.
