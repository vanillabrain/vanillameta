# UC051 비공개 대시보드 최종 인계·원자 이전

Status: Draft

## 목표와 첫 실행 범위

FR016/FR017/NFR005/NFR007·UC051 A7/BR-051-08·TC050 E02/E03. [의향](UC-051-handover-proposal.md)과 [관측](UC-051-handover-custody.md)은 이전 승인이 아니다. 이번에는 소유자의 별도 최종 동의→수신자의 별도 최종 수락→소유자 명시 실행→같은 번호의 과거 영수증 조회를 구현한다.

첫 실행은 현재 활성·단독 소유 비공개 대시보드1~20개만 전부 함께 이전한다. 선택 source가 하나라도 있으면 부분 실행하지 않고 source_transfer_deferred로 차단한다. 명시 저장 연결의 모든 소스는 이미 수신자가 활성 소유해야 한다(단순 grant는 불충분). 소스/파일/지표 소유권·외부 계정·행 데이터·익명 게시를 새로 이전하지 않는다. source 없는 빈 대시보드도 지원한다. 공유/미지원 legacy widget 연결·templateId·governed 대시보드, 손상/미지원 정의·다른 source/metric/dimension 참조, 활성 공유/게시/권한/전달과 미해결 작업은 차단한다. 현재 공유를 자동 정리하거나 기존 사본/게시/역사 관계를 삭제하지 않는다. 이 범위 밖의 전체 자산 인계/퇴사 완료는 후속이다.

## 실행 효과와 보존

전체 UserMapping이 정확히1행인 선택 대시보드의 userInfoId를 기존 소유자에서 수신자로 원자 변경한다. mapping ID·Dashboard ID/제목/정의/layout/StudioDocument의 블록 ID·모든 폭 배치·원본/Metric/파일·독립 사본·과거 actor/게시/영수증은 유지한다. Dashboard.assetVersion을1 증가시켜 기존 준비 요청을 무효화한다. StudioState가 있으면 기존 legacyRevision이 현재 dashboardRevision과 일치해야 하며, document bytes는 유지한 채 legacyRevision만 새 revision에 묶어 저장된 블록/배치가 fallback으로 유실되지 않게 한다. 이전 소유자의 소유권 기반 조회/수정은 같은 token으로 즉시 거절한다. 관련 없는 source grant·계정 로그인·조직 소속/역사 권한은 변경하지 않는다.

활성 직접/그룹 dashboard grant·직접/그룹 delivery(비활성 allowCopy 이상 상태 포함)·live share/allowReuse 또는 손상 share 연결·legacy/Studio publication·공유 share 레코드가 있으면 차단한다. inactive 관계/중지 게시/이력은 보존한다. StudioExecution의 succeeded/unsupported/cancelled 외 재시도 가능한 상태를 차단한다. ExportJob에는 dashboardId가 없으므로 대시보드별 출력 작업 부재를 추정하지 않는다. 소스 소유권을 변경하지 않는 이 범위에서 기존 출력은 원래 소스/현재 권한 경계와 과거 actor를 유지한다. 관련 여부가 불명확한 저장 참조/작업을 안전하다고 추측하지 않는다. 원자 이전 자체가 모든 기존 raw writer/운영 경합을 보장하지는 않는다.

일반 AI/Studio 저장도 DashboardWidget을 생성하므로 그 존재만으로 차단하지 않는다. 지원하는 canonical 저장본의 draft widgets와 ID 오름차순 링크·Widget/Component·Dataset/소스·layout Widget ID 집합을 대조하고, 공유 Widget/Dataset·고아/추가/중복 링크·손상 SQL/정의는 차단한다. Widget/Dataset ID·내용을 이전 중 변경하지 않는다. metadata만으로 서버 저장 SQL 변환을 재검증할 수 없는 scope/재집계 형태는 미지원으로 구분한다. governed=false여도 BiDashboardPolicy 연결은 제외한다. 개인 보기/보관은 사용자 상태로 그대로 두며 수신자에게 이관하지 않는다.

## 새 최종 요청·HTTP 계약

새 enterprise_handover_transfer는 proposalId UUID PK(의향 하나당 최종 요청 하나), unique requestId UUID, organizationId/ownerId/recipientId·양쪽 epoch/조직 버전, version, status(prepared/accepted/completed/cancelled), expiresAt(의향 만료와 준비+15min 중 이른 시각), acceptedAt/completedAt nullable, 고정 dashboard manifestJson(id/title만), 내부 basisHash/payloadHash, 무작위 reviewBasis와 prepare/accept/execute/cancel의 정확한 감사 ID 연결을 저장한다. 내부 hash/감사 상세는 응답하지 않는다. additive migration은 기존 호환성 검사를 하고 이상 schema는 중단한다. 자동 삭제/rollback은 없다. 만료/취소 후 재시작은 새 의향을 검토한다.

- `GET /enterprise/handover/:id/transfer-review`: 현재 소유자만 현재 수락 의향/양쪽 기준/원 manifest를 확인하고 최종 효과를 읽는다. 응답은 정확히 proposalId/organizationId/ownerId/recipientId/proposalVersion/checkedAt/basis/eligible/blockers/dashboards(id/title)다. basis는 서버 secret HMAC으로 묶은 불투명 현재 기준이며 raw metadata fingerprint가 아니다. blockers는 source_transfer_deferred/recipient_source_ownership_required/shared_dashboard/unsupported_definition/running_work/stale_studio/governed_dashboard/unsupported_widget/asset_version_limit의 고정 코드만 반환하며 미선택 자료 신원/SQL/경로/다른 직원/작업 상세는 숨긴다. eligible은 현재 지원 범위의 준비 가능 표시이며 실행 승인 ticket이 아니다.
- `POST /enterprise/handover/:id/transfer`: 소유자의 정확한 requestId/expectedProposalVersion/basis/acknowledgedTransfer=true를 검증한다. 읽은 현재 기준과 eligible을 다시 확인해 최종 요청 version1/prepared와 prepare 감사만 원자 저장한다. 같은 requestId·같은 입력의 재시도는 현재 상태를 반환하고 다른 입력/다른 UUID면409다. 새 UUID를 자동 재전송하지 않는다.
- `GET /enterprise/handover/:id/transfer`: 현재 조직의 활성 당사자만 최종 기록을 명시 조회한다. 의향이 없으면404, 당사자 아님403, 최종 행이 없으면404다. 완료 이후 자산 소유 검사로 과거 영수증 조회를 막지 않는다. 응답은 정확히 proposalId/requestId/organizationId/ownerId/recipientId/version/status/reviewBasis/expiresAt/acceptedAt/completedAt/detailsAvailable/dashboards/replayed다. 준비/수락의 제목 공개는 기존 의향의 당사자/epoch/만료/철회 규칙을 따른다. 닫힌 공개는 dashboards=[]로 표시하고 기록은 현재 접근권으로 표현하지 않는다.
- `POST /enterprise/handover/:id/transfer/accept`: 지정 수신자가 expectedVersion/reviewBasis/acknowledgedTransfer=true로 최종 목록의 전체 내용/정의·블록/배치 소유권을 넘겨받음에 별도 동의한다. 현재 양쪽/의향/최종 요청 기준·expiry·지원 범위/동일 basis를 재검사해 version2/accepted와 감사 저장한다. 원래 제목 공개 의향 수락을 최종 수락으로 승계하지 않는다.
- `POST /enterprise/handover/:id/transfer/execute`: 소유자의 expectedVersion2/reviewBasis/acknowledgedTransfer=true를 검증하고 최신 기준/최종 수락·양쪽 현재 신원/소속/epoch를 다시 검사해 전체 mapping/assetVersion/Studio 기준·최종 version3/completed/시각/execute 감사 연결을 한 transaction으로 저장한다. 하나라도 실패하면 전부 rollback이다. 같은 실행(expectedVersion2·동일 reviewBasis) 재시도는 이미 완료된 현재 기록만 반환하며 추가 쓰기/다시 이전은 없다.
- `POST /enterprise/handover/:id/transfer/cancel`: 소유자가 읽은 expectedVersion/reviewBasis/acknowledgedTransfer=true로 prepared/accepted를 명시 취소한다. 만료/기준 변경 후에도 현재 당사자 소유자는 취소할 수 있지만 completed는 취소/되돌리기하지 않는다. 취소된 최종 요청을 재활성화하지 않는다. accept/execute/cancel의 정확한 과거 재시도는 현재 행을 반환하며 현재 신원/당사자·조직 검사는 유지한다.

기존 의향과 최종 요청은 별개다. 의향 철회는 아직 실행되지 않은 최종 수락/실행을 차단한다. 완료 후 의향 철회·만료나 자료 변경은 이미 확정한 이전을 되돌리지 않는다. status GET/replay는 과거 기록이며 자산 현재 내용/접근권 증명이 아니다. source 신규 이전은 차단하고 기존 read-only 관측을 실행 기준으로 승계하지 않는다.

## 잠금·기준

SQLite 공통 metadata queue, MySQL READ COMMITTED에서 정렬 User/Membership→의향 행→최종 행/조직→정렬 Dashboard 부모→모든 참조 Source 부모→canonical Widget→Dataset 행 순서로 기존 writer와 조정한다. mutation은 기존 자식의 UPDATE/DELETE와도 FOR UPDATE로 조정하되 GET 검토에는 쓰기 잠금을 추가하지 않는다. 모든 부모/자식 잠금 대기와 basis 검사 뒤 최종 요청 기한을 다시 검사한다. 대기 중15분 기한이 지나면 수락/실행 모두409이며 mapping·상태·감사를 바꾸지 않는다. 완료 영수증의 정확한 replay에는 실행 기한을 다시 적용하지 않는다. 부모 잠금 후 현재 actor/정확한 mapping·원 manifest/최종 basis·소스/지표/공유/작업을 검사하며 오래된 pre-lock snapshot으로 실행하지 않는다. 권한/공유/저장 writer와 실제 두 연결 경합을 검증한다. 현재 지원하는 저장 형태와 refs만 명시 해석하며 미지원/손상은 차단한다. 외부 파일 검사·SQL을 transaction 안에서 실행하지 않는다. grant/게시/작업의 개별 행 존재만으로 임의 연결을 추측하지 않는다.

정규 Widget 연결에는 이후의 재연결 쓰기도 포함한다. 생성/편집에서 참조 Widget의 기존 Dashboard와 대상 Dashboard 부모를 ID 순으로 잠그고 현재 단독 소유 mapping을 재검사한다. source read grant만으로 다른 소유자의 canonical Widget을 새 layout에 붙일 수 없으며, 이전과 재연결의 양순서 경합을 검사한다. 하위 객체 수정/삭제·모든 raw writer의 전역 보장은 별도이고 현재 지원 저장본의 최종 기준에 자식 metadata를 포함한다.

## UI·복구·검증

조직 화면 기존 인계 패널에 별도 ‘최종 대시보드 인계’를 접어 제공한다. 소유자 현재 검토/효과 확인→별도 체크/최종 요청 준비, 수신자 요청 상태 조회/별도 체크/최종 수락, 소유자 최신 상태 조회/별도 체크/전체 이전을 명시 구분한다. 준비/수락/실행은 자동 연쇄하지 않는다. 취소와 과거 상태 조회·reload 복구를 제공한다. 응답 유실/5xx는 같은 최종 UUID/입력을 유지해 상태 조회부터 하며404 확인 후만 같은 준비 입력을 재시도한다. 명시4xx는 이전 검토/체크를 해제하고 입력을 유지한다. 탭 복구는24h/8KiB 내 최종 UUID/준비 입력만 유지하고 자동 재실행하지 않는다. org/actor/의향 변경·접기·실패·재조회 시 오래된 응답을 버리고 결과를 현재 권한으로 표현하지 않는다. 완료 이후 원 소유자의 의향 manifest는 역사 기록이므로 다시 실행 가능한 신규 후보로 표시하지 않는다.

기본36px/도구32px·390/768/1440 입력16/16/14px·높이/정렬/넘침과 권한 회수/기존 블록·배치 보존을 Ego에서 확인한다. 보호 HTTP/SQLite/MySQL의 양쪽 동의/현재 기준·완료/replay·응답 유실/rollback·중복 실행/저장/공유 경합과 전체 mapping 원자성, 실제 화면 준비→다른 계정 최종 수락→명시 실행→reload/기존 소유403/수신자 조회를 검증한다. source·파일 실제 이전/모든 raw writer/운영·실휴대폰/전체16개 수용은 별도다.
