# UC053 개인 알림함: 권한 변경 기록

## 목표와 범위

FR022/NFR005/007/008의 첫 구현 단위다. 기존 권한 부여·변경·회수 transaction에 저장된 감사 이벤트를 수신자 본인 알림으로 투영한다. 자원 grant와 별개인 본인 읽음/목록 제거만 새로 저장한다. FR021 직원/그룹 전달·독립 사본과 공유/export 이벤트 알림은 후속이며 전체 요건 완료로 계산하지 않는다.

## 데이터와 권한

- 기존 `enterprise_audit_event`의 `source.permissions`/`dashboard.permissions`와 subjectId를 이벤트 원장으로 사용한다. 별도 비동기 전송이 없어 권한 저장 성공 뒤 알림 생성만 실패하는 구간을 만들지 않는다. 외부 발송/알림 worker는 추가하지 않는다.
- 새 `enterprise_notification_state`: recipientId+eventId 복합 PK, read/removed 기본 false. 둘 다 false→true 단방향이며 목록 제거는 감사 기록/권한/원본/사본을 삭제하지 않는다.
- 본인 active User 및 현재 Membership와 event.organizationId를 매 요청 재검사한다. 다른 직원·이전 조직·다른 종류 감사 이벤트는 조회/변경 불가다. 공유 링크 JWT도 본인 계정이 없으면 거절한다.
- 응답은 eventId·유형·자원 번호·권한 버전·시각·읽음만 반환한다. SQL·자료·기업/직원 이름·링크 토큰은 포함하지 않는다. 알림은 현재 권한 증명이 아니며 실제 열람은 기존 권한 경계를 따른다.
- 기존 권한 이벤트도 현재 조직에 해당하면 표시된다. 권한 회수 후에도 일반 변경 알림은 남는다. 조직을 떠나면 이전 조직 알림은 노출되지 않는다.

## API와 복구

GET `/enterprise/notifications?beforeId=...`: 최신 id 내림차순 20개+nextBeforeId. 조회는 쓰기0. 제거된 행은 제외한다. 새 이벤트가 생겨도 다음 페이지는 cursor 이전만 읽는다.

POST `/:eventId/read`, POST `/:eventId/remove`: 본인 이벤트를 다시 확인하고 상태 행 insert-ignore 후 필요한 flag만 true로 update한다. SQLite 공통 metadata transaction/큐에 참여한다. 응답 유실 후 같은 요청 재시도는 동일 상태로 끝나며 read/remove 동시 실행은 removed를 되돌리지 않는다. MySQL 실제 경합은 별도 실행 gate다.

## UI

기존 조직 화면에 본인 알림함을 접힌 영역으로 추가한다. admin 전용이 아니다. 명시 열기/새로 읽기/더 보기·읽음/목록 제거만 둔다. 일반 도구 32px·본문14px·보조12px·wrap/min-w-0을 유지한다. 조회 실패 시 낡은 목록을 숨기고 재조회한다. 쓰기 실패는 항목을 유지해 동일 동작 재시도한다. 조직 변경/닫기/unmount 이후 늦은 응답은 무시한다. 새로고침 후 서버 상태를 읽는다.

## 검증·종료 조건

SQLite migration 두 번 실행/기존 감사 보존·실제 서비스 원장 투영/타인/이전 조직/비활성 거절·멱등 read/remove·읽기 쓰기0·권한/감사 불변·JWT HTTP 보호·컴포넌트 실패/재시도/늦은 응답/페이지 경계를 확인한다. type/lint/build 및 기존 조직 회귀를 실행한다. Ego96은 사용자 제어 중이므로 새 실제 UI/390·768·1440/실기기 검증은 BLOCKED/NOT_RUN으로 기록한다. 운영 MySQL·사람 수용·FR021/022 전체 완료를 주장하지 않는다.
