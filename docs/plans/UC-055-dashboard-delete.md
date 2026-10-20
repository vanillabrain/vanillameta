# UC055 대시보드 사용처 확인·원자 삭제

## 목표

FR024/NFR005/007/008: 현재 소유자가 사용처를 확인한 뒤 명시 삭제한다. 설정된 권한/공유/게시가 남으면409이며 자동 중지/연쇄 삭제를 하지 않는다. 개인 보관은 별도이고 소스/지표 삭제·조직 비활성·전체16개 수용은 후속이다. 기존 순차 hard-delete를 보호 경로로 교체하며 삭제된 ID의 기존 저장 재삽입도 차단한다.

## 권한·영향 조회

JWT/no-store GET `/dashboard/:id/delete-impact`는 현재 활성 User/JWT epoch, 단일 UserMapping의 실제 소유자와 현재 조직(없으면 null)을 확인한다. 원본 데이터 조회가 아닌 소유 metadata 관리이므로 source read/집계 실행을 대신 요구하지 않는다. SQL/원본/회사·수신자·그룹명/링크/token을 반환하지 않는다.

SUCCESS data: `{dashboardId,actorId,organizationId,revision,canDelete,dependencies:[{kind,count}]}`. revision은 저장 정의/layout/pivotDefinitions/연결 shareId와 저장 시각을 포함한 삭제 기준 SHA256이며 데이터 hash가 아니다. 종류는 directPermissions/groupPermissions/directDeliveries/groupDeliveries/liveShare/legacyPublications/studioPublications/sharedShareRecords다. 종류와 건수는 고정 enum/정수이며 전체 이용 현황이나 실제 접속자 수로 오인하지 않는다.

직접/그룹 grant의 하나라도 켜진 권리, active 전달, shareYn=Y, active legacy 게시, revokedAt 없는 Studio 게시를 차단한다. 만료·구성원/그룹 비활성에도 켜진 설정은 먼저 명시 중지한다. 다른 Dashboard가 같은 share 행을 참조하면 소유 연결이 불명확하므로 차단한다. 보관/보기/알림/과거 영수증·독립 사본/고정 출력 파일은 원본의 활성 참조가 아니며 삭제/차단 대상으로 삼지 않는다. 불명확한 schema/조회 오류는 canDelete=true/빈 사용처로 바꾸지 않는다.

## 명시 삭제와 영수증

JWT/no-store DELETE `/dashboard/:id`는 정확한 `{requestId:UUIDv4,expectedRevision:SHA256,expectedActorId:양의정수,expectedOrganizationId:양의정수|null}`를 요구한다. 계정/조직 입력은 대상 선택이 아니라 읽은 의도의 일치 검사다. 현재 actor/org/JWT epoch가 다르면 쓰기 전 거절한다. body 없는 기존 경로로 우회하지 않으며 repo 내 두 UI 진입점과 테스트 소비자도 같은 계약을 쓴다.

`dashboard_delete_receipt`는 generated id, actorId+requestId unique, nullable organizationId, dashboardId, expectedRevision, digest, createdAt을 저장한다. 같은 actor/org/본문 재확인은 과거 확정 결과만 반환하며 삭제를 다시 실행하지 않는다. 다른 본문/조직은409다. 반환 data는 `{dashboardId,requestId,receiptId,deleted:true,replayed:boolean}`이며 과거 요청 확인이지 현재 권한/ID 상태의 증명이 아니다.

새 요청은 계정/조직→부모 Dashboard 잠금→현재 단일 소유권/기준 확인→현재 사용처 재조회→허용 시 한 transaction에서 DashboardWidget 연결·본인 UserMapping·유일하며 중지된 DashboardShare·원본 Dashboard 삭제와 영수증을 저장한다. Widget/Dataset/Source/Metric·다른 Dashboard/사본·게시/관계/개인 상태/과거 영수증은 삭제하지 않는다. 회원 조직은 `dashboard-deletion.completed` 감사의 resourceId=삭제 영수증ID/version=1로 원본ID/기준을 추적한다. 조직 없는 기존 계정도 영수증에 actor/대상/기준/시각이 남으며 가짜 조직0을 만들지 않는다. 중간 실패는 원본·연결·영수증·감사 전체 rollback이다.

## 동시 쓰기 규약

SQLite는 공통 metadata transaction/queue다. MySQL/MariaDB는 READ COMMITTED 삭제와 동일 Dashboard FOR UPDATE를 기존-ID 저장·지표 batch·Pivot·공유/권한·전달·게시 최종 transaction에도 적용한다. 존재 확인은 잠금 후이며 사라진 부모를 create로 전환하지 않는다. 계정 잠금이 필요한 경로는 계정 먼저, 여러 Dashboard는 ID 오름차순 선잠금이다. LLM/집계 SQL은 새로 잠금 안으로 옮기지 않는다. 기존 Studio/게시의 잠금은 공통 규약을 유지하고 gap만 보완한다. 삭제 뒤 기다리던 저장/새 공유는 실패하고, 먼저 확정된 참조가 있으면 삭제가409다.

## 화면·복구·검증

목록/상세의 삭제 진입은 공통 영향 확인 dialog를 쓴다. 사용처 종류/개수와 중지 안내를 표시하며 차단이면 삭제 버튼 비활성이다. 보관은 대안이며 자동 실행하지 않는다. 오류/409는 대상·질문/편집기 초안을 지우지 않고 영향 다시 읽기로 복구한다. 응답 유실은 frozen UUID/body의 명시 결과 재확인만 허용한다. 새 기준/새 대상은 미확정 요청을 조용히 덮지 않는다. 같은 로그인 세션에서 접기/재열기·정상 token 갱신은 UUID/body를 유지하고 재열기 자동 영향 조회를 하지 않는다. 새 로그인/로그아웃은 이전 사적 제목·기준을 render 단계부터 숨기고 로컬 요청을 폐기한다. 로그인 간/브라우저 새로고침 후 삭제 의도 복구는 이 단위에서 지원하지 않으며 이미 확정됐을 수 있는 결과는 새 로그인 후 목록으로 확인한다. 성공 후 목록 갱신/조회 복귀와 새로고침으로 상태를 확인한다.

실제 SQLite/JWT: 각 사용처·새 참조·원본 변경·현재 actor/org/epoch·권한 부족·단일 소유권·독립 사본 보존·원자 rollback·같은 요청 재확인/다른 내용409·저장 재삽입 차단을 검증한다. 공통 잠금 helper와 기존 저장/공유/게시 회귀를 선택 실행하며 실제 MySQL 경합은 별도다. FE 영향/차단/성공/실패/응답 유실·늦은 계정/대상 응답과 UI Kit를 검사한다. 실제 Ego96 사용자 제어권/새390·768·1440/실휴대폰/MySQL/운영·사람 수용은 미실행을 유지한다.
