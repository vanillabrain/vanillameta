# UC053 수신자 조회 공유 관계

## 전체 목표와 구현 순서

FR021/022/NFR005/007/008: 직원/그룹 수신자 전달·접근 공유와 독립 사본·원본 보존·회수·알림/재시도를 완성한다. 이번 단위는 별도 조회 공유 관계와 최대50명 원자적 배치/멱등 영수증·공유 알림을 구현한다. 팀은 현재 명단을 명시 선택하는 snapshot이며 향후 자동 소속 변화에 따른 동적 그룹 권한·수신자 독립 사본 전달/소스 교체는 기존 remix 계약에 연결할 후속이다. 전체 FR021 수용을 이 단위로 축소하지 않는다.

## 데이터 계약

`EnterpriseDashboardDelivery`: ownerId+organizationId+dashboardId+recipientId 복합 PK, active, version. 직접 ResourceGrant와 독립이다. 권한 합성은 유효한 같은 조직/현재 활성 계정·현재 자원 소유 binding의 delivery.active에서 read만 추가한다. edit/publish/export는 기존 직접 grant가 주는 권한만 유지한다. 읽기 없는 직접 grant도 delivery를 덮어쓰지 않는다. 공유 회수는 delivery만 false로 바꾸고 직접 grant/원본/수신자 독립 사본을 보존한다. 소스 읽기 권한은 별도로 필요하며 수신자 소스 회수/소스 비활성은 기존 SourceAccess에서 차단한다.

`EnterpriseDeliveryReceipt`: ownerId+requestId UUID 복합 PK, organizationId/요청 digest/고정 응답 JSON. 1~50명·중복 없는 수신자와 expectedVersion·active를 canonical sort로 해시한다. 같은 ID 다른 요청은409. replay는 옛 작업의 성공 확인이며 현재 권한을 증명하거나 회수된 공유를 재활성화하지 않는다. 현재 송신자 관리 권한·동일 조직을 재검사한 뒤 응답한다. 영수증 정리/만료 정책은 운영 후속이다.

## 쓰기/조회

POST `/enterprise/deliveries/dashboard/:id`: 소유 admin의 명시 공유/회수. 같은 조직 active 수신자만 신규 공유하며 자기 공유를 거절한다. 원본 소스 접근과 모든 수신자의 대시보드/소스 read를 transaction에서 검사한다. 검증 실패·한 수신자409는 전체 rollback이다. 회수는 현재 소속을 떠났거나 비활성인 기존 수신자에도 가능하다. SQLite는 공통 metadata 큐를 사용하고 MySQL/MariaDB는 첫 권한 snapshot 전에 actor/수신자의 User·Membership을 정렬 잠금한다. 잠금 경합/교착은409 재시도이며 실제 DB 경합 검증은 별도다. CAS는 관계별 version이며 no-op은 새 감사 이벤트를 만들지 않는다. 변경/감사/영수증은 같은 transaction이다. 공유 이벤트는 기존 개인 알림 원장에서 지연 투영하므로 알림 표시 상태 장애가 공유를 되돌리지 않는다.

GET 같은 경로: 현재 소유 admin만 본인 조직 관계/버전 확인. 수신자 목록에는 현재 공유 정의·SQL·링크 토큰을 반환하지 않는다. 받은 대시보드는 기존 권한 허용 목록에 합성하고 열 때 소스 권한을 재검사한다. 별도 받은함/독립 사본 UX는 후속이다.

## 검증 계약

실제 SQLite/JWT에서 직접 grant 보존·read 합성/추가 edit 금지·목록 합성·소스 미허용 전체 rollback·배치 일부409 rollback·동일 요청/다른 body·회수 뒤 replay·inactive/다른 조직·기존 수신자 회수·공유 알림·migration 반복 실행을 확인한다. FE 공유 제어는 명시 수신자 선택·미리보기 차이/원자 저장·재조회로 연결한다. 새 실제 Ego/모바일은 기존 사용자 제어권이 돌아오기 전 NOT_RUN이며 MySQL·실기기·사람 수용도 별도다.

## UI 및 남은 단위

조직→자원별 권한→대시보드의 접힌 조회 공유 패널에서 명시 최신 관계/직원 조회·직원 페이지 추가/조직 버전 대조·수신자/불러온 팀 선택·조회 공유/회수·변경 인원 미리보기/명시 확인 후 저장한다. 탈퇴/비활성 수신자는 기존 관계 번호로 회수할 수 있다. 응답 유실은 frozen 요청 ID/내용을 유지해 재전송하며, 최신 조회 실패에도 같은 요청 확인을 제공한다. 영수증 replay/저장 후 현재 관계를 다시 읽기 전에는 새 쓰기를 막는다. 도구32px/본문14px/보조12px·팀 긴 이름 wrap/min-w-0을 사용한다.

현재 조직 관리(admin+소유자) 공유 경로를 먼저 연결했다. 수신자 별도 받은함·일반 소유 member 공유 정책·동적 그룹 membership·수신자 명시 동의를 거친 독립 사본/소스 교체 전달·영수증 보존 정책·실제 Ego/MySQL/사람 수용은 남는다. 전체 목표는 이 후속을 포함한다.
