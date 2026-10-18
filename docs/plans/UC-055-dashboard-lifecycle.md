# UC055 조직 대시보드 비활성화·복원

## 목적과 경계

FR024/NFR005/007/008·TC050 E03/E11/E12/E14의 자산 비활성화 단위다. 개인 보관은 본인 목록 선호, 비활성화는 해당 대시보드의 새 보호 요청 차단, 영구 삭제는 별도 사용처 기반 작업이다. 기존 소스 활성 상태는 유지하며 MK AI 연동/비공개 사례는 제외한다. 이 단위로16개 요건 전체 수용을 완료 처리하지 않는다.

Dashboard에 assetActive(boolean defaulttrue), assetVersion(integer default0)을 추가한다. 기존 행/정의/ID/좌표/소유/직접·그룹 grant/전달/게시 snapshot/live share/영수증/사본은 보존한다. 마이그레이션은 기존 데이터 보존·재실행 안전·파괴적 down 거절이다. Metric.useYn 논리 삭제와 혼용하지 않는다.

## 관리 권한과 영향 확인

현재 활성 User/JWT epoch·현재 조직의 admin이며 해당 대시보드의 유일한 원 소유자인 계정만 관리한다. 다른 직원의 자산을 admin이라는 이유만으로 가져오지 않는다. source read가 없어도 이 metadata 관리/복원은 가능하며 일반 read/edit/publish grant는 관리 권한이 아니다. legacy 무소속 계정은 기존 조회를 보존하되 조직 비활성화 관리권을 새로 주지 않는다.

JWT/no-store GET `/enterprise/resources/dashboard/:id/lifecycle`은 SUCCESS data `{dashboardId,actorId,organizationId,active,version,revision,dependencies:[{kind,count}]}`를 반환한다. SQL/원본/연결 정보/수신자 이름/그룹 이름/익명 URL은 반환하지 않는다. 고정8종은 기존 대시보드 삭제의 directPermissions/groupPermissions/directDeliveries/groupDeliveries/liveShare/legacyPublications/studioPublications/sharedShareRecords를 재사용한다. 영향 있음은 비활성화를 금지하지 않고 새 접근이 중단될 설정 건수를 설명한다. 독립 사본은 영향받는 현재 사용처로 계산하지 않는다. revision은 Dashboard 삭제 기준(활성 필드 포함)과8종 건수의 SHA256이다. 수신자별 명세나 모든 조직 의존 그래프를 제공한다고 주장하지 않는다.

## 명시 상태 변경과 재확인

POST 같은 경로는 정확한 `{requestId:lowerUUIDv4,expectedActorId,expectedOrganizationId,expectedVersion,expectedRevision:SHA256,active:boolean,acknowledgedImpact:true}`를 요구한다. actor/org/epoch·현재 관리 권한·Dashboard 부모 잠금·버전/영향 기준을 한 metadata transaction에서 재검사한다. 변경 또는 새 영향은 코드 DASHBOARD_LIFECYCLE_STALE의409/쓰기0이며 사용자가 다시 읽고 명시 동의한다. 같은 값의 명시 요청도 새 assetVersion을 만들고 기준을 소비한다. 동시 상태 변경/정의 저장/권한·전달/게시 설정은 동일 Dashboard 부모 잠금을 따른다.

상태 CAS·`dashboard_lifecycle_receipt`·조직 감사 dashboard.activate/deactivate를 원자 저장한다. 영수증은 actorId/requestId unique·organizationId/dashboardId/payloadDigest/active/version/createdAt이다. 감사 resourceId는 실제 dashboardId, version은 상태 버전이며 actor/시각/행위를 추적한다. 정확히 같은 현재 actor/org/본문의 재시도는 과거 영수증을 반환하고 현재 상태를 다시 덮지 않는다. 다른 본문/조직/소유/권한·낡은 epoch는 거절한다. SUCCESS data 결과 `{dashboardId,actorId,organizationId,requestId,receiptId,active,version,replayed}`는 과거 확인이며 현재 조회 결과와 구별한다. 새로 생성된 동일 ID에 과거 요청을 재적용하지 않는다.

## 소비자와 복원

SourceAccess.dashboard와 EnterpriseResourcePolicy의 dashboard read/edit/publish/export, owner fallback, 목록/받은 자료/복제 resolver를 비활성에서 차단한다. 일반 existing-ID Dashboard 부모 잠금도 비활성을 거절한다. 단, 비활성 상태의 현재 소유 admin에게만 관리/정책 정리·공유 중지·게시 회수·재사용 동의 회수·삭제 영향·보호 삭제는 명시 allowInactive 내부 옵션을 통해 유지한다. 임의 일반 요청에서 allowInactive를 받지 않는다. 활성 상태의 기존 회수 권한은 유지하고 비활성 회수는 전용 내부 dashboardRevocation 검사로 제한한다. 비활성화 때문에 명시 회수를 위해 먼저 링크를 다시 열게 만들지 않는다. 비활성 자산도 관리자 소유 자원 목록에 남아 복원할 수 있어야 한다.

live share/embed·legacy snapshot·Studio snapshot·공유/게시/받은 자료 재사용·대시보드 export 권한의 현재 보호 검사에서도 비활성을 확인한다. 이미 다운로드한 파일/표시한 데이터의 원격 회수, 진행 중 SQL/LLM 강제 취소, 독립 사본 비활성화는 보장하지 않는다. 새 저장/게시의 최종 commit은 비활성을 재확인한다. 공유 링크만으로 원본 Widget의 독립 접근권을 새로 주지 않는다.

복원은 기존 정의/공유/grant/게시의 수명주기를 바꾸지 않고 현재 권한·원 소스 상태·게시 만료/중지 등을 다시 검사한다. 만료·회수된 공유가 부활하거나 원 소스 비활성을 우회하지 않는다. 게시본 재사용도 원본 Dashboard의 lifecycle 버전을 private origin/준비 ticket·미리보기·최종 저장 기준에 묶는다. 게시 version/URL/snapshot은 바꾸지 않지만 비활성화→복원 전의 준비 요청은 쓰기0/409로 거절하고 새 준비를 요구한다. 이미 확정한 사본 영수증 재확인은 새 사본 생성과 구별한다. dashboardRevision/deletionRevision에 활성/버전을 포함하여 비활성→복원 전의 준비 ticket/저장 기준을 새 상태에 재사용하지 않는다.

## 화면과 검증

기존 조직 자원 관리의 대시보드에 접힌 상태 관리 패널을 추가한다. 명시 영향 읽기→현재/변경 비교→중단 영향 동의→명시 저장→현재 상태 읽기다. 원 요청 결과가 불명확하면 UUID/body를 동결해 같은 요청만 재확인하며 새 상태 저장을 잠근다. 잠금 timeout/deadlock 등 DASHBOARD_LIFECYCLE_RETRY_REQUIRED의409와 미분류409도 원 요청을 보존한다. 명시 STALE409만 기준 재조회로 넘기며 경합을 확정 거절로 해석하지 않는다. 정상 토큰 갱신/접기는 보존하고 새 로그인/자원·조직 전환에는 private 내용과 의도를 숨긴다. reload 복구는 본인 세션에 묶인 최소 요청만24h/8KiB 보관하고 권한 조회 후 명시 재확인한다. 자동 상태 변경/재게시를 하지 않는다. 관리 패널 실패는 기존 질문/SQL/대시보드 초안을 지우지 않는다. 일반36px/도구32px, 글자14px, wrap/min-width0를 사용한다.

실제 SQLite/JWT의 관리 경계/영향/CAS/rollback/영수증 재접속, 실제 두 연결 MySQL 상태/저장 경합, 익명·수신자 소비자 차단과 복원/독립 사본 보존, FE 미확정/세션/초안·UI·390/768/1440을 검증한다. 격리 headless와 실제 Ego/실휴대폰/운영·사람 수용을 구별한다. 독립 리뷰/type/lint/build·문서/증빙·pin/check/packet·비공개 정보 점검 후 develop-v2에 commit/push한다.

현재 독립 source export는 대시보드 전용 파일 API가 아니므로 다른 대시보드 비활성화에 연쇄 차단하지 않는다. 대시보드 export 권한과 독립 소스 파일 실행 문맥을 구분한다.

이번 단위의 실행 범위는 [조직 자산 상태 증빙](../testing/dashboard-asset-lifecycle.md)을 따른다. 기존 TC005의 dashboard-lifecycle 증빙은 별도 문서로 보존한다.

호환 경계: 새 클라이언트의 복제 lifecycle proof는 필수다. 캐시된 이전 클라이언트의 proof 없는 저장은 현재 원본/사본 권한과 정확한 기존 request hash/receipt가 일치할 때 과거 확인만 허용한다. 기록이 없으면 새 쓰기0으로 거절하며 미리보기/새 복제에 현재 proof를 추측해 채우지 않는다.

직접/그룹 받은 자료의 확정 사본 receipt에는 현재 원본 권한과 과거 준비 fingerprint 검사를 분리한다. 정확한 과거 actor/request hash가 먼저 일치한 경우에만 서버 내부 receipt authorizer로 현재 조직/소유자/대상·동일 직접 관계 또는 정확한 그룹/구성원·allowCopy·소스 read와 사본 접근을 확인한다. 과거 정의/관계 버전·fingerprint 불일치만으로 확정 결과 확인을 막지 않으며, 신규 복제의 엄격한 reference/lifecycle 검증은 유지한다. HTTP 요청에서 이 확인 전용 모드를 선택할 수 없다.
