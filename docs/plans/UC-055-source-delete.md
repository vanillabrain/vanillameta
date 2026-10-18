# UC055 소스 사용처 확인·영구 삭제·파일 정리 복구

## 목표

FR024/NFR005/007/008의 source 삭제 단위다. 기존 Dataset/TableQuery/Widget 순차 연쇄 삭제를 제거하고 현재 소유자가 영향을 확인한 뒤 참조 없는 Source만 영구 삭제한다. 외부 DB의 테이블/원본 데이터는 삭제하지 않는다. 서버 업로드 파일은 등록된 자기 소스의 관리 UUID 디렉터리만 별도 지속 정리 절차로 처리한다. MK AI 연동·기업 비공개 원문/경로는 제외한다.

## 현재 사용처와 조회

JWT/no-store GET `/database/:id/delete-impact`는 현재 활성 User/JWT epoch·현재 조직(없으면 null)·Source 실제 ownerId를 확인한다. read grant/admin만으로 삭제하지 않으며 비활성 소스의 소유 metadata 관리도 허용한다. SQL/집계는 실행하지 않고 비밀 연결/경로/SQL/수신자/그룹/게시 링크는 반환하지 않는다.

SUCCESS data `{sourceId,actorId,organizationId,revision,canDelete,managedFileCount,dependencies:[{kind,count}]}`다. revision은 Source 전체 저장 metadata/연결 설정과 최신 카탈로그·조건 버전의 SHA256이며 실제 자격정보/경로가 아니다. 고정 종류는 datasets/tableQueries/metrics/dashboards/exploreViews/directPermissions/groupPermissions/publications/exportJobs/sharedFiles다. 각 종류의 저장 자원 수를 표시하고 같은 종류 안의 중복 참조를 합친다.

Dataset/TableQuery는 현재 행, Metric은 Y, Dashboard는 현재 analysis/structured/Studio/Pivot과 재시도 가능한 실행의 명시 Source 참조를 확인한다. 삭제된 Dashboard의 과거 문서와 inactive Metric/과거 감사/영수증은 원본에 접근하는 현재 자원으로 묶지 않는다. ExploreView/소스 PersonalView는 저장 행을 확인한다. Source 직접/그룹 grant의 켜진 권리는 만료/계정·그룹 비활성과 별도로 차단한다. active legacy 게시/미회수 Studio 게시(비공개 포함)는 캡처 Source를 별도로 확인한다. Export queued/running은 명시 취소 전 차단하고 ready 파일은 미만료일 때 현재 Source 권한을 필요로 하므로 차단한다. expired ready/failed/cancelled의 과거 파일·요청은 지우지 않는다. 다른 Source의 현재/과거 파일 또는 커머스 자료가 같은 UUID 디렉터리의 전체 하위 경로를 참조하면 sharedFiles로 차단한다. 같은 소스 또는 소스 미확정 손상 metadata를 빈 참조로 간주하지 않는다.

## 명시 삭제와 지속 영수증

JWT/no-store DELETE `/database/:id`는 정확한 `{requestId:lowerUUIDv4,expectedRevision:SHA256,expectedActorId:양의정수,expectedOrganizationId:양의정수|null}`를 요구한다. 현재 actor/org/epoch·실제 소유/Source revision과 모든 사용처를 transaction 안에서 재검사한다. 참조가 있으면409/연쇄 삭제0이며 사용자 자산·공유/게시·작업을 자동으로 지우거나 취소하지 않는다.

허용된 한 transaction은 Database 행 하나만 삭제하고 지속 `source_delete_receipt`와 조직 감사(`source-deletion.completed`, resourceId=영수증ID/version=1)를 저장한다. nullable 조직의 legacy 소유자는 영수증으로 추적하고 가짜 조직0을 만들지 않는다. 중간 실패는 Source·영수증·감사 전체 rollback이다. 같은 actor/org/대상/revision/requestId는 과거 결과를 재확인하며 새로 생성/복원된 ID를 다시 삭제하지 않는다. 다른 본문/조직과 현재 inactive/낡은 JWT는 거절한다. body 없는 기존 삭제 route는 없다.

반환 data `{sourceId,requestId,receiptId,deleted:true,replayed,cleanup:{status:'pending'|'complete'|'retry_required',managedFiles:number}}`는 metadata 삭제와 파일 정리를 구별한다. 연결 전용 소스는 파일0개이며 commit 후 cached connection 종료가 성공하면 cleanup complete다. 실패하면 retry_required 영수증을 남긴다. 서버 파일 계획/소스 설정/권한 proof는 내부 암호화 필드에만 보관하고 응답/알림/로그에 경로를 반환하지 않는다.

## 관리 파일 정리와 실패 복구

DB commit 전에 파일을 지우지 않는다. 삭제 계획은 현재 Source 설정/소유와 관리 UUID 경계·manifest를 검증하며 다른 Source의 현재/과거 파일 공유도 확인한다. SQL/외부 원본은 대상이 아니다. 등록이 보조 단계였던 정상 업로드는 manifest.databaseId가 없을 수 있어, 현재 metadata의 유일한 Source 연결과 고정 manifest proof를 근거로만 처리한다. 외부 Source에 등록된 manifest/심볼릭 링크/관리 root 밖 경로는 거절하고 임의 경로/미등록 디렉터리를 추측해 지우지 않는다.

삭제 commit 후에만 자기 영수증에 묶인 명시 정리 POST `/database/deletions/:receiptId/cleanup`을 실행한다. 정확한 `{requestId}`로 원 요청을 확인하며 현재 actor/org/epoch와 receipt의 과거 소유를 다시 검사한다. 삭제한 Source와 같은 ID가 다시 생기면 정리를 중단한다. GET `/database/deletions`는 본인·현재 조직의 미완료 영수증을 beforeId로20개씩 조회하며 GET `/database/deletions/:receiptId`로 원 요청을 확인한다. reload는 자동 삭제/정리를 실행하지 않는다. 파일 제거는 metadata transaction 밖에서 실행하고 같은 worker의 이전 query 뒤에 처리한다. 소스 삭제 후 새 파일 참조/다른 Source 소유를 다시 확인하고, 실제 제거 직전에도 관리 경계/manifest proof를 재검사한다. 완료한 UUID 디렉터리의 재시도는 멱등이며 다른 자료·원본·사본을 지우지 않는다.

파일 일부 삭제 후 실패/응답 유실/프로세스 재시작은 영수증·암호화 계획을 보존해 같은 명시 정리를 재시도한다. 삭제가 성공한 metadata를 되살리거나 다른 Source로 계획을 재바인딩하지 않는다. 동시에 실행되는 정리는 DB CAS/lease로 하나만 선점하고 만료된 lease만 재선점한다. lease 중 오류나 현재 권한/조직 변경은 파일 정리를 자동 확정하지 않는다. 파일 시스템과 DB를 단일 원자 transaction이라고 표시하지 않는다. 이미 끝난 파일 제거 자체를 rollback/회수한다고 약속하지 않는다.

## 동시 쓰기와 우회 방지

SQLite 공통 metadata 큐/transaction과 MySQL/MariaDB User→기존 Dashboard ID 오름차순→Source ID 오름차순→Metric ID 오름차순을 유지한다. Source 생성 후 기존-ID metadata 수정/파일 전환, Dataset/TableQuery/Widget 참조 생성·재바인딩, Source grant/게시·기존 Metric/AI/Studio/탐색/Export 최종 쓰기는 같은 Source 부모 잠금/현재 존재 확인을 따른다. SQL/LLM/집계는 새 잠금 밖에서 준비하고 저장 전에 현재 소유·권한·기준을 확인한다. 삭제가 먼저면 대기 새 참조는 실패하고 먼저 참조가 확정되면 삭제409다. DTO 타입만으로 미정의 편집 필드/ownerId/catalogActive/ID를 허용하지 않는다.

## 화면·검증

기존 데이터 목록의 삭제 진입은 영향 dialog로 바꾼다. 참조가 있으면 삭제 비활성/수동 정리 안내를 표시한다. 삭제 응답 불명확은 같은 UUID/body를 유지해 결과를 확인하고, metadata 삭제 후 파일 정리 pending/retry_required는 별도 명시 정리 버튼을 제공한다. 정상 token 갱신/접기에는 유지하고 새 로그인은 private 정보와 로컬 의도를 render부터 숨기고 정리한다. 원래 질문·SQL 편집 초안/다른 소스 선택을 지우지 않는다. source cleanup의 브라우저 reload 복구는 서버 영수증 조회로 명시 확인하며 자동 DELETE/파일 제거를 실행하지 않는다.

실제 SQLite/JWT·관리 파일/실 worker·두 연결 MySQL 경합, 실패 rollback/부분 파일 실패·재시작/lease/응답 유실·다른 Source/사본 보존을 확인한다. headless 실제 삭제→정리→reload·390/768/1440과 실제 Ego/실휴대폰/운영·사람 수용을 구별한다. 전체 TC050/16개 완료는 이 단위만으로 판정하지 않는다. type/lint/build·독립 리뷰·문서/증빙·pin/check/packet 후 commit/push한다.

현재 실행 범위는 [증빙](../testing/source-deletion.md)을 따른다.
