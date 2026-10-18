# UC051 동적 그룹과 자원 권한

## 목표와 범위

FR016/017/NFR005/007/008: 조직 admin이 고유 ID 그룹/명시 구성원을 관리하고 자원 소유 admin이 그룹에 read/edit/publish/export를 부여·회수한다. 현재 직원 team 문자열과 자동 연결/이관하지 않는다. 기존 직접 grant/조회 delivery/원본/사본을 보존한다. FR021 동적 그룹 전달·복제 동의/받은함과 FR022 그룹 변경 알림은 후속이며 전체16개 수용을 이 단위로 축소하지 않는다.

## 모델

EnterpriseGroup(id,organizationId,name,nameKey,active,version): 조직+NFKC/소문자 nameKey unique, 이름100 UTF16 units, create version1/active. GroupMember(groupId,userId) 복합 PK·userId/groupId 인덱스. GroupResourceGrant(resourceKind,resourceId,groupId) 복합 PK·organizationId/ownerId/version·4권한, 기본 false. 그룹 ID는 이름/팀과 독립이다. 삭제 대신 비활성으로 관계/감사를 보존한다. 새 물리 cascade/User 삭제 제약은 추가하지 않는다.

EnterpriseGroupRequest(actorId,requestId UUID) 복합 PK는 organizationId·정규화 이름 SHA256·groupId를 보관한다. 생성 body는 `{name,requestId}`다. 현재 admin/조직을 재검증한 동일 요청은 이름/구성원이 변경된 뒤에도 원래 그룹의 현재 상세와 replayed=true를 반환한다. 다른 내용/조직은409이며 그룹/감사/영수증은 한 transaction이다.

## 권한과 변경

- 그룹 CRUD는 같은 조직의 현재 active admin만 수행한다. 수정 body는 expectedVersion/name/active/중복 없는 memberIds 최대200명이다. 신규 추가는 같은 조직 active User만 허용한다. 기존 비활성/탈퇴 연결은 유지/명시 제거할 수 있으나 실제 권한에는 현재 계정/소속 검사가 필요하다. 재활성/재소속은 보존한 연결의 효력이 돌아올 수 있으므로 UI에 명시한다.
- 그룹 상태/전체 구성원 교체/감사는 metadata transaction과 그룹 CAS로 원자 저장한다. SQLite 공통 큐에 참여하며 MySQL의 actor User/Membership·그룹 잠금 분기는 실제 DB 검증과 구분한다. 동일 변경 재시도는 최신 version을 요구하고 응답 불명확/409 시 초안을 보존해 명시 재조회한다.
- 그룹 자원 정책은 기존 ‘현재 소유 admin’ 관리 계약을 따른다. 그룹 현재 version과 정책 expectedVersion을 모두 확인한다. 활성 그룹에만 권한을 추가하며 비활성 그룹의 기존 정책 회수는 가능하다. read 없이 다른 권한은 불가하고 source publish는 금지한다.
- 실제 권한은 같은 조직·양쪽 active 계정/현재 자원 owner binding·활성 그룹·현재 GroupMember와 현재 Membership가 모두 일치하는 grant의 OR다. 직접 grant와 그룹 grant는 합산한다. 직접 read 회수는 그룹 권한을 지우지 않고 그룹 회수는 직접 권한을 지우지 않는다. dashboard delivery는 종전대로 read만 더한다. 대시보드의 모든 소스 read는 별도로 요구한다.
- 발견 목록도 같은 DB join을 사용해 그룹 허용 ID를 추가한다. JWT에 그룹 권한을 캐시하지 않으므로 기존 token도 다음 요청에서 새 구성을 읽는다. 그룹 비활성/구성원 제거·계정 비활성/조직 이탈·소유권 변경은 현재 조회에서 차단한다. 이미 전달한 데이터 회수는 보장하지 않는다.
- 그룹 생성/수정은 group.created/updated resourceId=groupId 감사다. 자원 그룹 정책은 source/dashboard.group-permissions, resourceId=자원, subjectId=groupId로 기록한다. 이 action의 subject는 직원이 아니며 개인 알림 whitelist에 넣지 않는다. 개인별 알림 fanout은 후속이다.

## API·UI

GET/POST `/enterprise/groups`, GET/POST `/:id`: admin 명시 목록20+cursor/그룹 조회·생성·전체 roster 저장. 그룹에 남은 이전 소속의 계정명은 노출하지 않고 내부 번호/현재 소속 확인 필요로 표시한다. GET/POST `/enterprise/resources/:kind/:id/group-policies`: 그룹별 권한/CAS. 기존 조직 화면에 접힌 그룹 관리, 자원 선택 아래 접힌 그룹 정책을 배치한다. 추가/활성 복원과 구성원 변화가 모든 그룹 자원에 영향을 준다는 확인을 요구한다. 도구32px·입력36px/모바일16px·wrap/min-w-0을 유지하고 오류/늦은 응답/조직 전환을 구분한다.

생성 응답 불명확 시 이름/requestId를 고정하고 명시 동일 요청 확인을 제공한다. 새 작성은 명시 초기화이며 이미 생성된 그룹을 삭제하지 않는다. 생성 대기 기록의 브라우저 reload 보존은 후속이다.

## 검증·종료 기준

SQLite/JWT HTTP로 그룹 이름 unique/교차 조직/활성·roster CAS/추가 조건/rollback·그룹 version 경합·직접/다중 그룹 OR·source/dashboard 모든 동작/허용 목록·구성원 추가/제외·그룹/계정 비활성·같은 token 재요청·소스 독립/원본 불변을 검증한다. UI는 명시 조회/동의·초안 보존/409 재조회·비활성/이탈 구성원·페이지 버전·늦은 응답을 확인한다. type/lint/build와 영향이 큰 권한 소비자의 전체 회귀를 실행한다. 실제 Ego96 사용자 제어권·실휴대폰/MySQL/운영/사람 수용·독립 리뷰는 미실행 상태를 유지한다.
