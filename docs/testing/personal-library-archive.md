# UC055 개인 산출물 보관·복원

[구현 계획](../plans/UC-055-library-archive.md)은 현재 허용된 대시보드 목록과 본인/현재 조직의 개인 보관 상태를 결합한다. 원본 정의/배치·공유/게시·독립 사본이나 다른 사람 목록을 변경하지 않는다. FR024/NFR005/007/008의 일부이며 사용처 기반 삭제 보호·조직 자산 비활성화·전체16개 수용은 별도다.

## 구현 계약

별도 `personal_library_state`의 userId/organizationId/dashboardId 복합키에 archived/version/updatedAt만 저장한다. 기존 상태 없음은 기본 목록·version0이다. 원본 대시보드의 revision이나 updatedAt을 바꾸지 않는다. 감사는 개인 상태 버전과 대상 대시보드·실제 actor에 묶인 library-archived/restored 사건이다.

`GET /dashboard/library?view=active|archived`는 기존 DashboardService/SourceAccess의 소유·공유 허용 목록을 재사용한 뒤 개인 상태를 적용한다. 조직 없는 기존 계정은 active 탐색을 유지하며 canArchive=false다. `PUT /dashboard/:id/library`는 요청 JWT epoch와 현재 계정/조직/모든 소스 read를 확인하고 읽은 조직 ID/개인 버전을 검사해 원자 상태/감사를 저장한다. 다른 조직으로 이동한 옛 화면의 version0 요청은 새 조직의 상태를 변경하지 못한다. 같은 값의 반복은 추가 쓰기/감사0이며 충돌은 명시 다시 읽기로 복구한다.

기존 `/dashboard` 목록/상세/Studio/공유·게시·삭제 API는 바꾸지 않는다. 기본 목록과 보관함의 같은 제목 검색·유형·정렬을 유지하고 카드의 보관/복원만 추가한다. 새 로그인 세대의 목록은 이전 계정 cache/늦은 응답과 분리한다. 새로고침은 읽기만 하며 실패한 조회를 이전 목록으로 대체하지 않는다.

## 검증 기록

실제 SQLite·기존 User/Dashboard/SourceAccess/Enterprise 정책과 JWT HTTP를 사용한 개인 보관 검사65개 PASS다. 기본/보관 목록과 소유/공유 수신자 분리, 원본·share/publication·grant 불변, 조직 이동의 과거 상태 미적용·옛 조직 요청409/상태0/감사0, 현재 계정/epoch·대시보드 및 모든 소스 read 회수를 검사했다. 동시 동일/충돌·미래 버전·최대 버전·quota·원자 감사 실패/복원 실패·소스 권한 변경 rollback과 마이그레이션 반복/복합키도 포함한다. 실제 프로세스 재시작은 이번 검사 범위가 아니다. 로그는 Git 제외 `.aiwf/evidence/UC055-library-archive/backend-tests.log`다.

격리 headless core8개도 PASS다. 이는 실제 root module의 새 경로/마이그레이션 통합과 기존 로그인·생성·공유·CSV 흐름의 회귀이며, 새 보관/복원 전체 흐름의 실제 Ego 증거가 아니다. FE3 suites/57개 PASS로 기본/보관 전환·보관/복원·재조회/응답 유실/409·검색/페이지·기존 열기/Studio/삭제와 계정별 cache/늦은 응답을 검사했다. 실제 session helper를 사용해 손상된 선택 metadata의 읽기 유지·token별 fallback 격리와 정상 갱신/계정 전환 순서도 검사했다. 실제 HTTP 인증 검증은 위 BE 범위이며 client의 JWT decode를 권한 증명으로 해석하지 않는다. 독립 검토의 보완 두 항목은 아래에 기록한다. 컴포넌트/실제 DB/API·실제 UI·운영 수용은 구분한다. 실제 Ego96은 사용자 제어 상태이며 새 UI/390·768·1440 실측·실휴대폰/MySQL/운영·사람 수용은 NOT_RUN이다. 과거 core 통과를 새 보관함 실제 화면 검증으로 승계하지 않는다.

## 잔여

[삭제 보호 후속](../plans/UC-055-dependency-deletion.md)은 현재 legacy 순차 삭제와 사용처 재검사의 공백을 기록한다. 개인 보관을 참조 중 삭제 보호나 전체 E11 완료로 처리하지 않는다. [전체 목표](../plans/enterprise-completion.md)는 계속 열린다.

## 독립 검토 보완

upstream/필터 후 목록 모두 SUCCESS envelope와 배열을 요구하며 잘못된 응답은500이다. 잘못된 upstream/필터 후 응답14개와 정상 빈 목록/기존 계정2개를 구별하고, 예상 계정 경계7개도 추가해 최종65개다. 클라이언트는 선택 draft metadata가 깨져도 저장 token이 있으면 메모리의 token별 난수 scope로 읽기를 유지한다. 정상 metadata에서는 로그인 세대와 token의 actor/인증 버전을 cache 경계에 묶어 새 metadata/옛 token의 순서를 구별한다. 같은 actor/인증 버전의 정상 갱신은 발행 시각/서명이 달라도 scope를 유지한다. 이는 cache/늦은 응답 구분이며 서버 인증을 대체하지 않는다. raw token은 새 query key/로그/영속 저장에 넣지 않는다.

계정 전환 직전 클릭과 실제 HTTP 요청 token 선택 사이도 서버에서 보호한다. 목록의 검증된 actorId를 expectedActorId로 되보내며 현재 JWT actor와 다르면 쓰기 전에409다. 예상 actor/조직은 권한 대상 선택이 아니라 읽은 상태의 일치 확인이다. 같은 조직의 두 수신자가 같은 자료/기본 version0을 볼 수 있어도 다른 계정의 개인 상태를 변경하지 않는다.

독립 native code-reviewer(Sol)는 초기 선택 저장 정보·잘못된 upstream 응답의 두 지적을 재검토해 닫았고, 최종 계정 일치 확인도 검토해 추가 지적0/한정 변경 승인으로 보고했다. reviewer는 targeted lint/diff를 실행했으며 runtime 재실행은 하지 않았다. Main은 최종 BE65/FE57·양쪽 type/lint/build·core-release8 로그를 확인했다. strict 명세 lint는 오류0·기존 FR011/NFR002 상태 경고2개이며 억제/요건 수용 상태 승계는 없다.
