# UC051 소스·연결 대시보드 묶음 인계

Status: Draft

## 목표와 범위

FR016/FR017/NFR005/NFR007·UC051 A9/BR-051-10·TC050 E02/E03. 소스 단독/대시보드 단독 최종 인계와 별도의 고정 묶음 준비→수신자 최종 수락→소유자 명시 실행→영수증/reload를 제공한다. 기존 제목 의향에 소스와 대시보드가 각각1개 이상, 전체2~20개 있어야 한다. 동일 소유자의 ready 등록 관리 DuckDB 소스와 그 소스에만 연결된 비공개 단독 대시보드를 전부 함께 이전한다. 선택하지 않은 소스/대시보드를 자동 추가하거나 제목을 노출하지 않는다.

모든 선택 대시보드는 명시 선언된 지원 소스가 있어야 하고 그 전부가 선택 소스여야 한다. 모든 선택 소스는 선택 대시보드 하나 이상에서 사용해야 한다. 누락·다른 소유자·미지원 정의/파일·외부 연결·활성 공유/grant/전달/게시·진행/재시도/미확정 출력·갱신·정리 작업은 전체 차단한다. 기존 소스 단독 검사의 source_in_use 예외는 검증된 선택 대시보드와 그 대시보드만 쓰는 canonical Widget/Dataset에만 한정한다. 미선택 Dashboard/Studio·공유 자식·임의 고아 Dataset/TableQuery·개인/Explore 보기·모호한 참조는 계속 차단한다. 정상 Studio 재저장으로 남은 미연결 자식은 현재 canonical 자식과 같은 소스/검증 SQL·제목/컴포넌트/옵션/설명이고 단독 소비자·외부 Dashboard 연결0일 때만 보존된 동등 정의로 함께 검사·잠금·hash에 포함한다. 동등하지 않은 과거 정의를 임의 역사로 간주하거나 삭제하지 않는다. 기존 단독 API의 판정은 약화하지 않는다.

## 원자 변경과 보존

실행은 현재 양쪽 계정/epoch/조직/version·원 의향/최종 수락·현재 Source/Dashboard/canonical 자식·파일 신원·최종 기한을 다시 검사한다. User/Membership→의향/final/조직→정렬 Dashboard→정렬 Source→정렬 Widget/Dataset/Metric의 기존 writer 잠금 순서를 따른다. Source 잠금 뒤 Dashboard 부모를 추가 취득하지 않는다. SQLite 공통 queue와 MySQL READ COMMITTED를 사용한다. 일부 소스/대시보드 갱신 실패는 owner/mapping/version/영수증/감사 전부 rollback한다.

변경은 Database.ownerId/catalogVersion+1, 기존 UserMapping.userInfoId, Dashboard.assetVersion+1, StudioState.legacyRevision의 일관된 재결합과 수정 시각뿐이다. Source ID/config/경로/모든 파일 bytes/manifest·Metric ID/정의·카탈로그/조건 역사·Dashboard ID/정의/layout·mapping ID·Widget/Dataset·Studio 문서 bytes/블록과 모든 폭 배치·독립 사본/과거 actor는 보존한다. 구 소유자의 다음 동일 JWT 보호 요청은403, 수신자는 같은 소스/대시보드/Studio를 열고 수정할 수 있어야 한다. 물리 파일 이동/chown·이미 전달한 데이터/진행 SQL 회수·퇴사/탈퇴 확정은 범위 밖이다.

## 최종 계약

별도 enterprise_bundle_handover 영속 기록은 source-handover와 같은 UUID/양쪽 identity/epoch·고정 목록·15분 최종 기한/4상태·version·payload/basis/custody hash·random reviewBasis·정확 단계 감사 ID를 보관한다. manifest에는 sources와 dashboards를 분리한다. 공개 응답에 내부 proof/SQL/config/파일 경로/다른 자산은 포함하지 않는다. 별도 additive migration을 제공하며 기존 단독 기록/영수증을 재해석하지 않는다.

`/enterprise/handover/:id/bundle-transfer-review` GET은 의향 소유자만 현재 검토한다. 응답: proposalId/organizationId/ownerId/recipientId/proposalVersion/checkedAt/basis/eligible/blockers/sources/dashboards. sources: id/title/filesChecked/metricCount, dashboards: id/title. blocker는 기존 source·dashboard 코드와 mixed_assets/connection_scope_required를 유한 allowlist로 제공한다. 지원 범위가 아니어도 내부 신원을 숨긴다.

`/bundle-transfer` POST는 정확한 requestId/expectedProposalVersion/basis/acknowledgedTransfer=true로 준비한다. GET은 현재 같은 조직의 양쪽 당사자만 조회한다. 응답은 기존 source record와 같고 sources/dashboards 배열을 가진다. `/accept|execute|cancel` POST는 expectedVersion/reviewBasis/acknowledgedTransfer=true만 허용한다. 준비v1→최종 수락v2→완료v3 또는 취소v2/v3, 정확 완료 replay는 추가 쓰기0이다. 같은 의향에 다른 최종 묶음 요청을 만들지 않는다. 기존 의향 만료/철회/epoch 변경은 새 동의·실행·제목 공개를 중단하며 완료 영수증은 현재 권한과 구별한다.

## UI·검증·종료

혼합 의향에서만 접힌 '소스·대시보드 함께 인계'를 보여 별도 조건 검토/명시 체크/준비·수신자 수락·소유자 실행을 제공한다. 기존 개별 패널은 순수 유형에서 유지하며 공개 종료 영수증은 모든 기록을 명시 조회할 수 있다. 미확정 준비 UUID/입력은24h/8KiB 계정/조직/의향 scoped 탭 저장으로 보존하고 reload 후 상태조회→404일 때만 같은 요청 재시도를 허용한다. 늦은 응답/실패는 체크/과거 결과를 제거하고 질문 대신 입력/요청 신원을 보존한다. 자동 수락/이전·재시도는 없다.

Docker MySQL 실제 두 연결의 부모/자식 대기·소유권 재검사·만료·rollback·정확 replay, SQLite/HTTP·FE 계약/상태/보존 검증을 실행한다. Ego 한 공간에서 공개 합성 CSV 일반 업로드와 실제 AI/Studio 저장 경로의 연결 분석을 준비하고 조건 검토→통신 실패/reload/동일 UUID→수신자 최종 수락→소유자 실행→reload·구 소유자 회수/수신자 열람·원본/문서/파일 불변을 검증한다. 390/768/1440 버튼36/도구32·입력36px/16·16·14px·정렬/가로 넘침0을 실측하고 screenshot을 열람한다. 독립 검토·문서 동기화·AIWF packet awaiting_review/acceptance not_recorded 후 현재 branch commit/push가 종료다. 운영/실휴대폰·전체16개/TC050 사람 수용은 별도다.
