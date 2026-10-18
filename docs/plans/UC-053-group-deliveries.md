# UC053 동적 그룹 조회 공유와 받은함

## 목표·계약

FR021/NFR005/007/008: 현재 구성원 기반 그룹 공유→받은함→명시 동의 복제와 회수를 기존 개인 공유/직접·그룹 권한에 더한다. 개별 직원으로 복사한 snapshot 관계로 대체하지 않는다. MK AI 연동은 제외한다.

별도 EnterpriseGroupDelivery(ownerId,organizationId,dashboardId,groupId PK,version,active,allowCopy)를 추가한다. 삭제/회수는 기존 직접 권한·개인 공유·원본/독립 사본을 변경하지 않는다. 현재 조직/활성 계정·유일 소유권·활성 그룹/현재 구성원일 때 read만 합산하며 모든 소스 read는 독립이다. 나중에 들어온 구성원도 소스 접근이 있으면 조회할 수 있고 제외/비활성/소속 변경은 다음 요청에서 차단한다. 소스 권한을 그룹 공유가 자동 부여하지 않는다.

## API·원자 저장

GET/POST `/enterprise/deliveries/dashboard/:id/groups`: 현재 소유 admin. GET `{dashboardId,entries:[{groupId,version,active,allowCopy}]}`. POST 정확히 `{requestId,groupId,expectedGroupVersion,expectedVersion,active,allowCopy}`·UUIDv4/boolean/양의 그룹ID/비음수 CAS. 그룹 version은 양수다. active=false이면 allowCopy=false다. 그룹은 같은 조직이며 추가는 활성 그룹만, 비활성 그룹 회수는 허용한다. 그룹 버전/관계 CAS·감사·기존 owner UUID 영수증을 같은 transaction에 저장한다. digest에 group 도메인을 포함해 개인 공유 requestId와 혼동하지 않는다. 응답 `{requestId,dashboardId,entry:{...},replayed}`. replay는 과거 성공 확인이며 현재 권한 보장이 아니다. MySQL actor/group 잠금 분기는 실제 검증과 구분한다.

그룹 구성원마다 소스 권한을 미리 강제하지 않는다. 미래 구성원을 지원하며 받은함/열기에서 현재 소스를 검사한다. UI에 이 경계를 명시한다. 감사 action dashboard.group-shared/group-unshared·subjectId=groupId이며 개인 알림 whitelist에는 넣지 않는다. 그룹 수신자 알림은 후속이다.

## 읽기·재사용

허용 목록과 받은함은 개인/그룹 공유를 중복 없이 합산하고20후보+cursor·최대20 반환을 유지한다. 소스 미허용은 제목 없이 숨긴다. allowCopy는 현재 유효한 개인/그룹 관계 중 하나라도 허용할 때 true다. group version과 관계 identity/version을 private 복제 reference에 묶어 현재 구성원·복제 동의를 reference/preview/save마다 재검사한다. 개인 reference 호환은 유지한다. 정책 회수/명단 변경은 오래된 미리보기를 거절하며 원본/사본/좌표 보존 계약을 따른다.

## UI·검증

기존 공유 패널 옆에 접힌 그룹 공유를 추가한다. 명시 최신 조회/그룹 선택·현재→제안 active/복제 허용·그룹 전체/미래 구성원 영향 확인·명시 저장. 응답 불명확은 frozen UUID/body로 결과 재확인하며 재조회 전에 다른 쓰기를 막는다. 패널을 접어도 mount/초안/미확정 요청을 보존한다. 실제 페이지 이탈/reload의 요청 복구는 후속이다. 오류/409에 선택을 보존하고 명시 재조회가 초안을 초기화함을 알린다. 도구32px/입력36px·모바일16px·wrap/min-w-0.

SQLite/JWT: 현재/미래 구성원·동일token 회수·개인/그룹 OR·소스 독립·현재 owner/org/active·받은함 중복/페이지·복제 allowCopy/원본 변경/그룹 변경·CAS/rollback/replay/도메인 충돌·마이그레이션 반복. FE 명시 확인·pending 재시도·late/close·409 보존·정렬 클래스. type/lint/build·선택 및 필요 전체 회귀. 실제 Ego96 사용자 제어권·실휴대폰/MySQL/운영·사람 수용·독립 리뷰 미실행은 별도이며 전체16개 완료로 표시하지 않는다.
