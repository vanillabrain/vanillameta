# UC051 인계 후 조직 탈퇴 확정

Status: Draft

## 목표와 경계

FR016/FR017/NFR005/NFR007/NFR008·UC051 A10/BR-051-11·TC050 E02/E03. [묶음 인계](UC-051-bundle-handover.md) 다음으로 본인의 명시 탈퇴 요청→다른 현재 조직 admin의 최신 잔여 검토→별도 명시 실행→현재 조직 관계/로그인 회수→재로그인/영수증을 연결한다. 법적 퇴사 처리·User 계정 삭제/비활성·조직 삭제·자동 자료 이관/삭제는 구현하지 않는다.

첫 범위는 본인/검토 admin 모두 active·같은 조직이며 미인계 소유 자료가 없는 경우다. 전체 개인 Source 소유와 UserMapping(공유/손상/고아 포함)이 하나라도 남으면 차단한다. 조직별 자료라고 추측하거나 자동 이전하지 않는다. 본인이 발행한 미중지 게시·queued/running/유효 ready export 및 미해제 lease·재시도 가능한 Studio 실행·갱신/보관 입력·미완료 파일 정리·유효 prepared/accepted 최종 인계(소스/대시보드/묶음)·미완료 조직 이동은 차단한다. 제목/SQL/파일 경로/원본은 공개하지 않고 고정 건수/코드만 제공한다. 제목 공개 의향 자체는 이전 승인이 아니며 epoch 변경으로 닫히므로 자동 삭제하지 않는다. 마지막 활성 admin은 탈퇴할 수 없다. 다른 active admin이 남아야 하며 검토 admin은 본인일 수 없다.

## 결과·보존·현재 기준

실행은 조직 소속만 제거한다. User는 active와 자격정보·ID를 유지하고 authVersion+1/jwtId=null로 기존 access/refresh를 회수한다. 직접/그룹 권한·직원 전달 관계는 해당 사용자의 owner/recipient 역할을 현재/역사 조직 모두 명시 비활성/CAS bump하고 그룹 가입을 해제/영향 그룹 version을 증가시킨다. 이전 관계가 재가입으로 살아나지 않게 하며 enrollment 미확정 코드는 폐기한다. 다른 직원·받는 쪽 소유 원본·독립 사본·Metric/카탈로그/조건·파일·Studio 문서/모든 폭 배치·과거 게시/출력/인계/감사·알림/개인 보기/보관 기록은 지우거나 actor를 재작성하지 않는다. 과거 자료 접근은 현재 권한을 따르며 완료 영수증은 현재 소속/접근권 증명이 아니다.

일반 Dashboard 생성은 빈 layout에도 User/epoch fence를 먼저 취득하도록 이번 필수 writer 경계에 포함한다. guard를 먼저 통과한 옛 요청도 User 잠금 후 현재 active/epoch를 재검사한다. 생성 선행이면 owned 자산 검사로 탈퇴를 중단하고, 탈퇴 선행이면 옛 생성은403/생성 잔여0이다. Source/기존 부모 유무로 이 검사를 생략하지 않는다.

Studio 실행 신규 접수도 현재 actor의 User/epoch를 Dashboard→Source보다 먼저 잠근다. 소유 자료가 없는 grant 편집자라도 탈퇴 선행이면 늦은 접수를 거절하고, 접수 선행이면 열린 실행 건수로 탈퇴를 차단한다. 접수 transaction을 외부 LLM 작업 전에 종료한다.

SQLite 공통 metadata queue와 MySQL READ COMMITTED, 정렬 User/Membership→요청→조직→관계/그룹의 공통 순서를 사용한다. 현재 양쪽 active/epoch·같은 조직/admin·원 본인 동의/버전/기한·조직 version·잔여/권한 관계의 고정 basis를 잠금 뒤 다시 검사한다. 마지막 검사 이후 실행 직전에15분 기한을 재검사한다. 권한/그룹/소속/epoch·조직 version+1·감사/완료 영수증은 원자 저장하며 실패하면 전부 rollback한다. 동일 사용자로 새 권한/소유/작업을 쓰는 대표 writer와 실제 두 연결 대기를 검증하되 모든 raw writer/외부 파일시스템·운영 보장으로 확대하지 않는다. 탈퇴 뒤 재로그인한 사용자의 새로운 개인 작업은 과거 탈퇴를 되돌리는 행위가 아니다.

## API·영속 계약

별도 enterprise_staff_departure: requestId UUID PK, userId/organizationId/발급 authVersion/발급 organizationVersion, version, status requested/completed/cancelled, requestedAt/expiresAt/completedAt/cancelledAt, completedBy/completeOrganizationVersion nullable, payloadHash/completePayloadHash(nullable)/단계별 감사 ID. 실제 완료 당시의 정확한 기록을 남기며 운영 additive migration1792620200000을 제공한다. 한 사용자당 유효 미완료 요청은1개이며 취소/만료 뒤 새 UUID로 별도 동의한다. 기존 기록을 덮거나 재활성화하지 않는다.

- POST `/enterprise/staff-departure`: 정확한 `{requestId,expectedOrganizationVersion,acknowledgedDeparture:true}`. 본인 현재 조직/epoch·버전 확인→requested v1,expiresAt15분. 같은 UUID/정확 입력의 replay는 과거/현재 기록이며 새 요청을 만들지 않는다.
- GET `/enterprise/staff-departure/:id`: 현재 인증된 본인은 재로그인/탈퇴 후에도 본인 과거 기록만 조회한다. 다른 사용자는 원 조직의 현재 active admin만 조회하며 요청자의 새 조직/자료는 공개하지 않는다. 타 조직/일반 직원은403, 없으면404다.
- GET `/:id/review`: 같은 원 조직의 다른 active admin만 현재 요청·잔여를 읽는다. 정확 응답 `{requestId,userId,organizationId,requestVersion,organizationVersion,checkedAt,basis,eligible,blockers,counts}`. counts 고정키는 ownedSources/ownedDashboards/activePublications/openExports/openRefreshes/openExecutions/pendingHandovers/pendingTransfer/pendingCleanup. blockers는 owned_assets/active_publications/open_work/pending_handover/pending_transfer/last_admin/unsupported_state의 고정 allowlist다. 내부 관계/문서/파일 hash는 HMAC basis에만 포함한다.
- POST `/:id/complete`: 정확한 `{expectedVersion,reviewBasis,acknowledgedDeparture:true}`. 현재 다른 admin의 읽은 basis/조직/자원·기한 재검사 후 전체 원자 완료v2. 정확한 원 실행 admin/입력의 완료 replay는 추가 회수/epoch 증가0이며 같은 역사 기록이다. 타 admin은 GET으로 과거 상태만 확인한다.
- POST `/:id/cancel`: 본인의 정확한 `{expectedVersion,acknowledgedDeparture:true}`,requested만 취소v2. 완료는 되돌리지 않는다. 조직/epoch가 이미 달라진 본인도 현재 인증으로 미실행 의향만 취소할 수 있다.

record 정확 응답은 `{requestId,userId,organizationId,version,status,requestedAt,expiresAt,completedAt,cancelledAt,completedBy,completeOrganizationVersion,replayed}`다. 내부 epoch/hash/관계 목록/사용자 로그인명/원본 내용을 응답하지 않는다. own pending이 stale/만료여도 역사로 조회할 수 있고 새 실행은 거절한다. 요청 대상/실행 admin의 현재 인증은 매 호출 확인하며 GET 후 신원/행이 바뀌면409로 다시 확인한다.

## UI와 실행 검증

조직 화면에 접힌 '조직 탈퇴'를 제공한다. 본인 요청은 효과/보존 범위·별도 체크 후 실행한다. admin은 요청 UUID를 명시 입력→잔여 검토→별도 체크/탈퇴 확정만 가능하며 내용/파일을 열지 않는다. 소속 없는 재로그인 화면에서도 본인 UUID 영수증 조회는 제공한다. 요청/완료 미확정은 최소 UUID/입력을 계정/조직/요청 scoped sessionStorage24h/8KiB에 보존하고 reload→GET부터 확인한다. 생성404 뒤 같은 UUID 재시도, 완료는 같은 상태/입력 확인 후 명시 재시도만 허용한다. 자동 실행/새 UUID/리다이렉트가 없다. 늦은 결과/다른 계정/조직·실패는 이전 basis/체크를 제거한다.

소유/열린 작업 차단·권한/그룹 실제 회수·epoch+1과 같은 access/refresh 거절·계정/원본/인계·문서/파일·과거 actor 보존·관계 변경409/기한/rollback·정확 replay·자기/타 조직 거절을 SQLite/HTTP와 owned Docker MySQL 두 연결에서 검증한다. Ego 한 공간에서 공개 합성 자료 인계 후 직원의 본인 요청→관리자 잔여/통신 실패·재조회/확정→reload→직원 재로그인·조직 없음/과거 영수증·수신자 원본 보존을 확인한다.390/768/1440의36px/도구32px·입력16/16/14px·정렬/넘침0을 실측한다. 독립 검토·AIWF packet awaiting_review/acceptance not_recorded·현재 branch commit/push로 종료한다. 운영/실휴대폰·계정 삭제/법적 퇴사·전체16개/TC050 사람 수용은 별도다.
