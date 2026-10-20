# UC053 그룹 공유 알림

## 목표와 경계

FR022/NFR005/007/008: 그룹 공유/회수와 명시 그룹 구성·활성 변경으로 발생한 공유 연결/해제를 본인 알림함에 연결한다. 동적 권한의 현재 구성원 조회와 알림의 사건 당시 수신자 snapshot을 분리한다. 알림은 현재 접근권 증명이 아니며 원본·소스·개인 공유/직접 권한·독립 사본은 변경하지 않는다. MK AI 연동·외부 메시지 발송은 제외한다.

## 원장·수신자

새 EnterpriseNotificationAudience(eventId,recipientId PK)는 그룹 감사 이벤트의 당시 활성/같은 조직 구성원을 고정한다. group audit subjectId는 계속 groupId이고 개인 번호로 재해석하지 않는다. 그룹 공유/복제 동의 변경은 dashboard.group-shared, 회수는 group-unshared다. 활성 공유가 있는 그룹에서 구성원 추가/활성 복원은 group-joined, 제외/그룹 비활성은 group-left다. 그룹 이름만 변경하면 수신자 알림을 추가하지 않는다. 현재 유효한 자원 소유/조직/활성/단일 mapping과 active delivery만 대상으로 하고 소유자는 자기 알림에서 제외한다.

공유 관계/그룹 변경·감사·audience snapshot은 저장의 원자 기록이며 실패 시 전체 rollback이다. 표시 상태/조회/외부 알림 전송은 이 transaction에 포함하지 않는다. 알림 조회 실패가 이미 commit된 공유/구성을 되돌리지 않는다. 재시도 영수증/그룹 CAS는 중복 사건과 audience를 추가하지 않는다. 기존 group audit는 당시 명단이 없어 현재 명단으로 소급 생성하지 않는다.

## 조회·표시

기존 개인 action+subjectId 또는 명시 group action+audience에 해당하는 이벤트만 현재 활성 본인/현재 조직에서 읽고 mark한다. SQL/이름/그룹 명단/링크/원본 자료 없이 기존 응답에 그룹 알림에서만 viaGroup=true를 추가한다. UI는 그룹 조회 공유/회수로 구분하고 실제 접근은 매 요청 별도 검사함을 안내한다. 회수 뒤에도 당시 수신자는 사건을 읽음/제거할 수 있다. 나중 구성원은 과거 사건을 볼 수 없으며 명시 추가 사건부터 받는다. 직원의 조직/계정 활성 변경만으로 새 그룹 알림을 생성하는 기능은 후속이다.

기존20개 cursor·읽기 쓰기0·멱등 개인 read/remove·조직/로그인 epoch 보호를 유지한다. 그룹 권한 grant action이나 group.updated subject를 개인 알림으로 출력하지 않는다.

## 구현·검증

별도 audience entity/추가 전용 migration, 그룹 공유 저장과 그룹 구성 변경에서 원자 사건 기록, NotificationService의 목록/mark 허용 조건, API/기존 알림 UI에 연결한다. 실제 SQLite/JWT로 snapshot/늦은 가입·제외/비활성·재활성·타 조직/번호 충돌·CAS/replay/no-op·원자 rollback·조회 장애 뒤 공유 유지·cursor/개인 표시 상태를 검증한다. FE 그룹 표시·추가 필드 validation/기존 회귀와 type/lint/build를 실행한다. 실제 Ego96 사용자 제어권·새390/768/1440 실측·실휴대폰/MySQL/운영/사람 수용은 NOT_RUN이며 전체16개 수용은 Open이다.
