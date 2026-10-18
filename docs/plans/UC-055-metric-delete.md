# UC055 지표 사용처 확인·보호된 논리 삭제

## 목표와 범위

FR024/NFR005/007/008의 다음 단위다. 현재 소스 소유자가 저장 지표의 사용처를 확인하고 명시 삭제한다. 기존 `MetricService.remove`의 무조건 useYn=N을 대체하며 source 영구 삭제/파일 정리·조직 비활성/전체16개 수용은 별도다. MK AI 연동과 기업 비공개 원문은 포함하지 않는다.

## 사용처와 권한

JWT/no-store GET `/metric/:id/delete-impact`는 현재 활성 User/JWT epoch·현재 조직(없으면 null)·Metric과 원본 Database의 실제 ownerId를 확인한다. 단순 grant나 조직 admin만으로 지표를 삭제하지 않는다. 소스 비활성 상태에서도 원래 소유자의 metadata 정리는 허용하며 SQL/집계·원본 데이터를 읽지 않는다.

SUCCESS data는 `{metricId,actorId,organizationId,revision,canDelete,dependencies:[{kind,count}]}`다. 종류는 `dashboardDefinitions`, `studioDocuments`, `exploreViews`, `exportJobs`의 고정4종이다. dashboardDefinitions는 구조화 정의 또는 붙은 Pivot을 참조하는 Dashboard 수이고 exploreViews는 ExploreView/소스 PersonalView 저장 행 수다. 개수는 각 종류에서 해당 지표를 명시 참조하는 저장 자원 수이며 같은 자원의 여러 참조는 한 번 센다. 종류가 다른 동일 Dashboard는 각각 표시된다. 이름/SQL/수신자/그룹/링크/파일 경로는 반환하지 않는다.

삭제되지 않은 Dashboard의 structuredDefinition(기존 structured-bi·metric-linked-analysis·structured-bi-dashboard 형식), 현재 Dashboard에 붙은 StudioState.document의 blocks.measureRefs, ExploreView의 measureVersions/state.measureIds, 소스 PersonalView의 state.measureIds와 Dashboard.pivotDefinitions의 상태를 확인한다. 소스가 같은 손상/알 수 없는 참조 metadata는 빈 사용처로 바꾸지 않고 확인 실패로 거절한다. 다른 소스의 확정된 정의·삭제된 Dashboard의 과거 StudioState·이미 독립 지표로 복제된 사본과 고정 게시/출력 snapshot은 원 지표의 현재 참조로 묶지 않는다. SQL/이름 문자열에서 참조를 추측하지 않는다.

## 명시 삭제·영수증

JWT/no-store DELETE `/metric/:id`는 정확한 `{requestId:lowerUUIDv4,expectedRevision:SHA256,expectedActorId:양의정수,expectedOrganizationId:양의정수|null}`를 요구한다. 지표 전체 저장 정의/사용 상태/수정 시각을 포함한 revision과 읽은 actor/org를 현재 값에 대조한다. 현재 참조가 하나라도 있으면409/쓰기0이다. 자동 참조 해제·대시보드/보기/소스/사본/게시 삭제는 없다.

허용된 요청만 한 transaction에서 Metric.useYn=N·지속 영수증·조직 감사(`metric-deletion.completed`, resourceId=영수증ID/version=1)를 저장한다. 정의 자체와 참조 자원은 유지하고 중간 실패는 전체 rollback이다. 조직 없는 기존 소유자는 nullable 조직 영수증으로 추적하며 가짜 조직0을 만들지 않는다. 동일 actor/org/대상/본문의 requestId는 과거 확정 결과 `{metricId,requestId,receiptId,deleted:true,replayed}`만 반환하고 새 삭제를 실행하지 않는다. 다른 내용/조직은409이며 inactive 계정/낡은 JWT는 재확인도 거절한다. 과거 영수증은 현재 접근권이나 재활성 후 현재 지표 상태의 증명이 아니다.

## 동시 쓰기 계약

SQLite 공통 metadata transaction/queue, MySQL/MariaDB 현재 행 잠금을 사용한다. 계정이 필요한 경로는 User 먼저, 기존 Dashboard가 필요한 경로는 Dashboard ID 오름차순, 이후 Source ID 오름차순→Metric ID 오름차순이다. 지표 삭제/수정/재활성 및 현재 지표 참조를 저장하는 AI/Studio/탐색 보기·생성/재사용 쓰기가 같은 기준으로 현재 Y/소스/버전을 재검사한다. 삭제가 먼저 확정되면 대기 참조 저장은 실패하며, 참조 저장이 먼저면 삭제는409다. SQL/LLM/집계는 새 잠금 구간 밖에서 준비하고 저장 전에 현재 기준을 다시 확인한다. 실제 MySQL 경합 증거와 dialect 옵션 검사는 구별한다.

## 화면·복구

기존 지표 페이지의 삭제 버튼은 영향 dialog를 열며 참조가 있으면 삭제를 비활성화한다. 같은 세션에서 응답 불명확은 frozen UUID/body를 접기/재열기와 정상 token 갱신에도 유지하고 자동 재실행하지 않는다.409는 다시 영향 확인을 요구한다. 새 로그인/로그아웃은 이전 private 제목/결과를 render부터 숨기고 로컬 확인 정보를 정리한다. 다른 대상의 미확정 요청을 조용히 덮지 않는다. 성공 후 목록 갱신/reload로 비활성을 확인한다. 브라우저 reload/로그인 간 삭제 의도 복구는 이번 단위 범위가 아니다. 기존 편집기 질문/초안은 바꾸지 않는다.

## 종료 증거

실제 SQLite/JWT:4종 참조·중복/다른 소스/독립 사본·손상 metadata·현재 소유/actor/org/epoch·변경 revision·삭제 전후 새 참조 경합·원자 실패 rollback·지속 같은 요청 재확인·기존 body 없는 우회 거절을 검사한다. FE 영향/차단/409/응답 유실·계정/대상 늦은 응답과 scoped cache/크기·정렬을 검사한다. 격리 headless 실제 화면·390/768/1440과 실제 Ego/실휴대폰/MySQL/운영/사람 수용은 각각 증빙하며 미실행을 PASS로 승계하지 않는다. 관련 기존 저장/게시/재사용/조건 회귀와 type/lint/build·독립 리뷰·spec pin/check/packet 후 commit/push한다.

출력 작업의 `queued/running` 상태는 지표의 현재 정의를 필요로 하므로 `exportJobs` 종류로 차단한다. 만료됐더라도 켜진 작업은 명시 취소 후 다시 확인한다. `ready/failed/cancelled`의 파일/과거 요청은 차단하지 않으며 실패 작업의 재실행은 현재 지표/버전을 Source→Metric 잠금 아래 재검사하고 새 실행 상태 쓰기 전 거절한다. 완료 파일을 현재 지표 참조로 자동 묶거나 삭제/취소하지 않는다.

기존 지표 create/update도 런타임 편집 필드를 name/description/databaseId/tableName/aggregation/expression/groupBy/filters로 제한한다. useYn/id/생성·수정 시각 등 미정의 필드를 통해 보호된 삭제/재활성을 우회하지 못한다. 제작 definition 직접 주입 금지는 유지한다. 실제 JWT 우회 시도에서 지표 상태·영수증·감사 불변을 확인한다.
