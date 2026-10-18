# UC051 SQLite 공통 트랜잭션·권한 조회 경계

NFR005/007/008·TC050 E02/E03/E12 후속이며 전체16개 요건 목표를 유지한다. 현재 cf2a2ede에서 실제 단일 SQLite 연결의 Studio transaction과 enterprise transaction을 겹치면 두 번째 쓰기가 먼저 성공 처리되고 Studio rollback 후 값이0으로 돌아가는 결함을 재현했다. 재현 로그는 Git 제외 증빙에 보존한다.

## 설계

DataSource별 공통 메타데이터 작업 큐를 둔다. SQLite에서만 서로 다른 논리 작업의 transaction을 겹치지 않게 한다. 같은 작업의 명시적으로 기다리는 하위 서비스는 AsyncLocalStorage의 살아 있는 작업 범위에서 재진입해 기존 shared-manager 조합을 유지한다. 종료된 작업의 비동기 문맥은 재진입 권한을 유지하지 않는다. 다른 DataSource는 서로 막지 않고 MySQL 등 다른 드라이버의 기존 transaction/lock/CAS 의미는 바꾸지 않는다.

기존 enterprise/view/semantic/Studio 큐는 공통 조정기를 사용한다. Studio의 기존32개 대기 제한과 같은 인스턴스 순서는 유지한다. 명시 metadata transaction 진입점은 공통 wrapper를 사용해 큐에 참여하며 기존 isolation level/transaction manager·영수증/버전 CAS·rollback을 유지한다. 중첩 서비스의 shared manager는 계속 전달하며 별도 HTTP 요청을 같은 작업으로 간주하지 않는다. 범위 안의 하위 작업은 기다리는 같은 호출 흐름으로 조합한다. 현재 범위를 점유한 채 그 뒤에 별도로 예약한 작업의 완료를 기다리는 조합은 지원하지 않는다. 모든 쓰기를 재시도하거나 실패를 성공으로 치환하지 않는다.

일반 SourceAccess/기업 권한·소스 상태 관리 조회는 공통 읽기 경계로 확정된 grant/활성/소속만 읽는다. 공통 쓰기 안에서 manager를 사용하는 권한 재검사는 같은 범위로 실행해 자기 교착을 만들지 않는다. 이전 작업에서 생성됐지만 종료 후 실행한 비동기 작업은 새 작업으로 대기한다. 조회 중 이미 권한 검사를 통과한 요청의 SQL을 일괄 취소하는 계약은 아니다.

## 현재 단위와 잔여

이 단위는 명시 transaction과 기존 쓰기 큐·권한 읽기 경계를 통합한다. 원시 Repository 단일 save/update/delete와 그 밖의 일반 데이터 읽기까지 전부 조정됐다고 주장하지 않는다. 후속에서는 그 경로를 별도로 대조하고 작업별 원자성/조회 응답·파일 수신/알림까지 TC050 전체를 검증해야 한다. 공통 분류·조건·수신자/출력/보관 요건도 그대로 남긴다.

## 변경·검증

common/metadata-work helper, 기존 큐 helper, SourceAccess/enterprise policy/lifecycle, Studio와 명시 transaction의 BI/AI/commerce/dashboard 호출자를 연결한다. 새 의존성/DB schema/API/제품 UI는 없다.

실제 SQLite의 Studio rollback→다른 쓰기 대기/독립 commit, 역순/오류 후 대기열 진행, 다른 DataSource/드라이버, 중첩 조합/만료 작업 문맥, 미커밋 활성/권한 조회 차단과 rollback 후 원래 상태를 확인한다. 기존 생성·저장·영수증·409·게시/복제/개인 보기·기업 권한/활성 상태 회귀와 type/lint/build/core를 검증한다. 독립 리뷰·문서 동기화/strict/pin/check/packet과 비공개 정보 검사 뒤 commit/push한다. 새 UI/실기기·MySQL 경합/운영 부하·전체 수용은 미검증으로 남긴다.

## 후속 정적 대조

현재 원시 쓰기 후보는 DatabaseService의 create/uploadFile/switchFile/update/remove, MetricService create/update/remove, AuthService setRefreshKey/deleteRefreshToken/legacy rehash와 UserService 계정 변경·LoginService 가입이다. SampleService 가입 후 비동기 provisioning 및 dataset/widget/table-query/template/dashboard-widget·익명 shareToken 갱신도 별도다. 이 목록은 정적 조사이며 각 실제 경로 재현/수정 완료가 아니다. 다음 최소 단위는 소스/지표의 메타데이터 경계이고, 세션 회전의 여러 쓰기 원자성·기존 remove의 다중 삭제 원자성은 별도 설계한다. 전체 공통 조건/전달/export 목표를 이 기반 조사로 대체하지 않는다.

독립 검토 후속에는 AuthService.verifyRefreshToken의 User/RefreshToken 확정 조회를 명시한다. 현재 확정 인증 범위는 JWT guard/validate다. Studio get/prepare가 집계까지 큐를 점유해 SQLite의 다른 인증을 기다리게 하는 tradeoff도 남는다. 메타데이터 snapshot/집계 경계를 분리하고 동시 응답 지연을 실제 확인하기 전 성능을 보장하지 않는다. 이 두 항목은 일반 raw CRUD 후속과 함께 열린다.
