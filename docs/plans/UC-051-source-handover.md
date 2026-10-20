# UC051 관리 파일 소스 최종 인계

Status: Draft

## 목표·지원 범위

FR016/FR017/NFR005/NFR007·UC051 A8/BR-051-09·TC050 E02/E03. 기존 의향은 제목 공개 수락이며 [대시보드 이전](UC-051-handover-transfer.md)·[파일 관측](UC-051-handover-custody.md)을 최종 소스 이전 승인으로 승계하지 않는다. 활성 같은 조직 소유자 준비→수신자 별도 최종 수락→소유자 명시 실행→영수증/reload를 연결한다.

첫 실행은 고정 의향이 **관리 DuckDB 파일 소스만1~20개**일 때 전부 함께 이전한다. dashboard 혼합·외부 연결/SQLite·fileModel·관리 경계/ready/등록이 불명확한 파일은 차단한다. 현재와 과거 fileVersions를 중복 제거해 소스당1~5개 모두 검사한다. Database ID·Metric ID/정의·카탈로그/조건의 저장 정의와 이력·파일 경로/bytes/manifest·원본 업로드·기존 사본/과거 actor는 보존한다. Database.ownerId만 수신자로 변경하고 catalogVersion을1 증가시킨다. connectionConfig/파일명 hash를 다시 생성하지 않는다. OS 파일 소유자나 파일 위치를 바꾸거나 복사/삭제하지 않으며 서버 보관 파일의 앱 관리권을 넘긴다. 구 소유자의 소스/지표/파일 보호 요청은 같은 token으로 다음 요청부터 거절한다. 이미 전달된 데이터·진행 SQL의 원격 회수를 보장하지 않는다.

실제 내용 공개는 실행 이후 현재 새 소유권으로만 허용한다. 준비/수락 목록에는 source ID/title·filesChecked/metricCount만 공개하고 SQL/정의/원본 행/경로/신원 proof·타인/미선택 자료는 공개하지 않는다. 별도 동의에는 파일 데이터와 저장 업무 정의·지표 관리권 전체를 받는 효과를 명시한다. 직원 퇴사/탈퇴 확정·대시보드와 함께 이전·외부 DB credential 이전·전역 소비자 부재 보장은 후속이다.

## 안전한 현재 기준

선택 소스의 고정 원 manifest·양쪽 현재 active/epoch/조직/version, Source owner/active/catalogVersion·모든 Metric/최신 카탈로그/조건 정의와 아래 사용처·관리 파일 신원 signature를 내부 basis에 포함한다. 준비·최종 수락·실행마다 현재 기준을 검사한다. GET은 읽기 전용이며 조회 후 현재 신원/metadata를 재확인한다. 공개 basis는 서버 secret HMAC, 최종 reviewBasis는 random64다.

활성 직접/그룹 source grant가 있으면 회수했다고 가정하지 않고 차단한다. 다른 Dashboard/Studio/Pivot 정의·Dataset/TableQuery·개인 보기/ExploreView·활성 legacy/Studio 게시·재시도 가능한 StudioExecution·queued/running 또는 유효 ready export·미해제 export lease·갱신의 queued/running/미지원 상태/미해제 lease·보관 입력/열린 admission·정리 진행/미완료 삭제 영수증은 차단한다. Metric은 소스의 자식 정의로 함께 관리하되 다른 소스 참조/손상은 차단한다. inactive 관계와 닫힌 작업/게시/과거 영수증은 재작성하지 않으며 새로운 접근권으로 되살리지 않는다. 애매한 참조/지원 범위를 넘는 순회는 unresolved로 차단하고 미선택 신원은 숨긴다.

파일 검사는 기존 bounded 비재귀 관리 경계/NOFOLLOW·일반 파일·ready 정확한 databaseId 등록·최대1MiB manifest·root/directory/file 신원 재검사·hardlink/알려진 Database/Commerce 공유 소비자(최대2000)와 미해제 갱신을 재사용한다. none_observed를 배타 보관 증명으로 바꾸지 않으며 양성 공유는 다른 실패에도 유지한다. 서버 DataSource에 설정된 정확한 SQLite metadata 파일만 별도 NOFOLLOW/일반 파일/안전 ancestor 신원 비교로 다룬다. 이는 기본 seed의 실제 연결을 검사하는 것이며 NULL owner나 파일명만으로 소비자를 무시하지 않는다. symlink/잘못된 신원은 계속 실패한다. 그 외 미지원/손상 consumer 설정은 unresolved로 차단하고 실제 검증을 위해 사용자 데이터를 제거하거나 정상값으로 위장하지 않는다. 앱이 관리하는 파일 writer는 User/Source fence·현재 소유권을 재검사한다. 신뢰된 서버 관리 루트 밖 적대적 같은 UID 프로세스의 경로 바꿔치기를 원자 동결한다고 주장하지 않는다.

검사는 준비/수락/실행 때 현재 파일 signature와 대조한다. 파일 검사와 metadata 사이에는 검사 전후 동일 기준을 확인한다. 파일 bytes 전체 hash/SQL 계산을 metadata transaction에서 실행하지 않으며, 짧고 제한된 파일 신원/manifest 검사를 Source fence 아래 재확인한다. 파일에 쓰지 않으므로 FS와 DB의 이중 쓰기 rollback은 만들지 않는다. 내부 custody signature를 영수증에 보존하되 외부로 반환하지 않는다.

## 영속 요청·API

새 `enterprise_source_handover`는 proposalId UUID PK·requestId UUID unique·organizationId/ownerId/recipientId·양쪽 발급 epoch/조직 버전·version·status(prepared/accepted/completed/cancelled)·min(원 의향 만료,준비+15min) expiresAt·acceptedAt/completedAt·manifestJson(id/title/filesChecked/metricCount)·basisHash/payloadHash/custodyHash·random reviewBasis·단계별 정확한 감사 ID를 저장한다. additive migration의 기존 schema 불일치는 중단하며 destructive down은 없다. 의향 하나당 최종 요청 하나이며 만료/취소 뒤 새 의향으로만 재시작한다.

기준 경로 `/enterprise/handover/:id`:

- `GET /source-transfer-review`: 현재 수락 의향 소유자만 검토. 정확한 응답은 proposalId/organizationId/ownerId/recipientId/proposalVersion/checkedAt/basis/eligible/blockers/sources. sources는 id/title/filesChecked/metricCount다. blockers는 mixed_assets/unsupported_source/source_in_use/active_permissions/running_work/file_unresolved/file_shared/asset_version_limit의 고정 코드다. eligible은 현재 준비 가능 표시이며 실행 ticket이 아니다.
- `POST /source-transfer`: owner의 정확한 requestId/expectedProposalVersion/basis/acknowledgedTransfer=true. 최신 기준/파일 재검사→prepared v1/prepare 감사만 원자 저장. 같은 UUID/입력은 현재 역사 기록, 다른 입력/UUID는409.
- `GET /source-transfer`: 현재 활성 같은 조직 양쪽 당사자만 기록 조회. 응답은 proposalId/requestId/organizationId/ownerId/recipientId/version/status/reviewBasis/expiresAt/acceptedAt/completedAt/detailsAvailable/sources/replayed다. 원 의향 공개 종료/만료/epoch 변경 시 sources=[]로 제목을 숨기고 역사 상태만 표시한다. 완료 후 현재 자산 소유 검사로 구 소유자의 과거 영수증을 숨기지 않는다.
- `POST /source-transfer/accept`: recipient의 정확한 expectedVersion/reviewBasis/acknowledgedTransfer=true. 별도 최종 동의/현재 기준/파일·기한 재검사→accepted v2/감사.
- `POST /source-transfer/execute`: owner의 같은 형식 expectedVersion2. 현재 최종 수락/기준·파일/양쪽 신원/기한을 잠금 대기 뒤 재검사→전체 Database owner/catalogVersion·completed v3/time·정확 감사 ID를 한 transaction에 저장. 하나라도 실패하면 전부 rollback. 정확한 완료 재시도는 과거 영수증만 반환하고 다시 이전하지 않는다.
- `POST /source-transfer/cancel`: owner가 읽은 version/basis/ack로 prepared/accepted만 취소. 만료/기준 변경 후에도 현재 같은 조직 당사자 취소 허용, completed는 되돌리지 않는다. 정확한 accept/cancel 역사 재시도는 현재 기록만 반환한다.

의향 철회는 미실행 최종 수락/실행을 차단하지만 확정 이전을 되돌리지 않는다. 영수증은 현재 접근권이 아니다. 요청/응답 shape·actor/목록·버전/시각 일관성을 FE에서도 검사하며 공개 종료한 부모에 최종 제목이 재등장하는 모순 응답을 거절한다.

## 잠금·writer·UI

SQLite metadata queue·MySQL READ COMMITTED에서 sorted User/Membership→의향/final/조직→sorted Source→Metric/관련 행 순서를 따른다. 다른 Dashboard 잠금을 Source 이후 취득하지 않는다. Source 사용처 추가/소유권 기반 쓰기는 같은 Source fence/현재 권한을 잠금 후 검사하며 갱신 admission도 이 순서에 연결한다. 소유권을 읽은 뒤 기다리는 오래된 요청은 구 소유자로 commit하지 않는다. 권한 부여/갱신·metadata writer와 대표 두 연결 경합을 검증하며 모든 raw writer 보장을 주장하지 않는다.

기존 인계 패널에 접힌 ‘최종 소스·파일 인계’를 제공한다. owner 검토/명시 체크→준비, recipient 상태 명시 조회/별도 체크→최종 수락, owner 최신 상태 조회/별도 체크→실행을 자동 연결하지 않는다. 완료/취소에는 동의 체크를 숨긴다. 미확정 준비는 같은 UUID/입력을24h/8KiB scoped sessionStorage에 보존하고 reload/접기 뒤 상태 조회부터 한다.404 뒤에만 같은 준비 입력을 재시도하며 새 UUID 자동 생성/실행은 없다. 늦은 결과/조직·actor·의향 변경/조회 실패는 오래된 결과·체크를 제거하고 입력을 보존한다.36px/도구32px·390/768/1440 입력16/16/14px·줄바꿈/행 정렬/넘침0을 검증한다.

## 검증·종료

실제 임시 관리 DuckDB 파일과 보호 HTTP/SQLite/MySQL에서 별도 동의·최신 epoch/metadata/파일/CAS·만료/철회·원자 다중 rollback·응답 유실/정확 replay·파일 변조/공유/hardlink/symlink/열린 갱신/사용처 차단·구 소유자 같은 JWT403/수신자200를 검증한다. 이전 전후 원본/manifest/버전 파일 bytes/hash/mtime·source/Metric ID/정의/이력 불변과 catalogVersion+1·owner 변경을 대조한다. Ego 실제 준비→역할별 최종 수락/실행→reload·통신 실패/같은 요청 복구·모바일 정렬을 확인하고 독립 검토 후 현 branch에 commit/push한다. 운영/실휴대폰/퇴사·전체16개 수용은 별도다.
