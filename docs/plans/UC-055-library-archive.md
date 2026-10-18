# UC055 개인 산출물 보관·복원

## 목표와 보존

FR024/NFR005/007/008: 내 기본 목록에서 보관한 산출물을 숨기고 별도 보관 목록에서 현재 권한으로 복원한다. 개인 보관은 원본 삭제/조직 비활성/공유 중지와 다르며 다른 사람 목록·원본 정의/배치·게시·사본을 바꾸지 않는다. 기존 삭제의 사용처 보호와 조직 자산 비활성화는 별도 후속이며 전체16개 목표를 줄이지 않는다.

## 상태와 API

`personal_library_state`의 `(userId,organizationId,dashboardId)` 복합키, archived boolean, version 정수, updatedAt을 추가한다. 현재 조직에 묶인 본인 상태만 저장한다. 기존 행 없음은 archived=false/version=0이다. 실제 계정/조직 상태와 요청 JWT epoch를 큐 진입 후 재검사하고 MySQL 쓰기는 User/Membership 잠금·READ COMMITTED, SQLite는 공통 metadata transaction을 따른다.

- JWT/no-store GET `/dashboard/library?view=active|archived` (생략 active)는 기존 DashboardService.findAll + readableDashboardIds + SourceAccess.filterResults의 현재 read 허용 목록을 재사용한다. 결과 envelope `{status:'SUCCESS',data:{entries:[...기존Dashboard,library:{archived,version}],canArchive:boolean,organizationId:number|null,actorId:양의정수,view}}`다. 숨겨진 제목/상태를 읽기 권한 없이 내보내지 않는다. 기존 GET `/dashboard`와 세부 보기/정의/게시 API는 변경하지 않는다.
- 조직 없는 기존 계정은 현재 허용 목록을 active로 읽고 canArchive=false, organizationId=null이다. archived는 빈 목록이며 보관/복원 쓰기는403이다. 기존 대시보드 탐색·AI/공유를 막지 않는다.
- JWT/no-store PUT `/dashboard/:id/library` 정확한 `{archived:boolean,expectedVersion:0이상정수,expectedOrganizationId:양의정수,expectedActorId:양의정수}`는 현재 활성 본인/조직/JWT epoch·대시보드와 모든 소스 read를 재검사한다. 계정/대상 조직을 지정하는 입력은 받지 않는다. expectedActorId는 목록에서 확인한 본인 번호와 실제 요청 JWT actor의 일치 확인만 하며 불일치는 쓰기 전409다. 계정 전환 직전 클릭이 API interceptor에서 새 token을 받아도 다른 계정의 기본 version0 상태를 바꾸지 못한다. expectedOrganizationId는 읽은 조직과 현재 조직의 일치 확인만 하며 불일치는 쓰기 전409다. 조직 이동 전의 화면이 새 조직의 기본 version=0 상태를 변경하지 못한다. 응답 envelope의 data는 `{dashboardId,organizationId,archived,version}`다. 상태 변경은 CAS/원자 감사와 함께 저장한다. 미래 버전은409이고 현재와 다른 값의 낡은 버전은409다. 이미 같은 값인 반복 요청은 기존 상태를 반환해 추가 쓰기/감사0이다. actor/조직별 상태 한도1000개이며 한도 초과 신규 상태만 거절한다.
- 감사 `dashboard.library-archived/restored`는 조직/actor/subject=본인·resourceId=dashboard·version=개인 상태 버전이다. 알림 생성/공유 변경/권한 부여는 없다. 다른 조직으로 이동하면 과거 상태는 새 조직 목록에 적용하지 않는다. 권한 회수 후에는 숨긴 상태를 포함한 자료·상태 노출/복원 쓰기를 차단한다.

## UI와 복구

기존 산출물 제목 검색·유형·정렬과 열기/Studio/삭제 동작을 유지하고 기본 목록/보관함 전환 및 각 카드의 보관/복원만 추가한다. 보관함에도 현재 read 목록만 표시한다. 신규 목록 읽기가 실패하면 이전 목록/상태를 현재값처럼 사용하지 않는다. 쓰기 응답이 유실되거나409면 초안/선택/검색을 지우지 않고 명시 다시 읽기 후 현재 버전으로 처리한다. 새로고침은 읽기만 수행한다. 일반36px/도구32px/14px 본문·모바일16px 입력·wrap/min-w-0을 따른다. 다른 탭 요청의 늦은 응답은 현재 계정/조직/목록을 덮지 못한다.

## 검증과 종료

실제 SQLite/정책/JWT: 소유/공유 수신자 각 개인 상태 분리, 조직·계정/epoch·source read 회수, CAS·동일 반복·미래 버전·동시변경/rollback·audit·마이그레이션 반복과 기존 정의/공유/게시 불변을 확인한다. FE 목록/보관 전환·원본 불변·새로 읽기/응답 유실/409·검색/페이지·늦은 응답·기존 카드 동작을 검사한다. 선택 type/lint/build·독립 검토 후 commit/push한다. 실제 Ego96 사용자 제어권/새390·768·1440 실측·실휴대폰/MySQL/운영·전체 TC050 수용은 별도로 기록한다.

## 독립 검토 보완

목록의 upstream 성공 envelope/배열을 검증하며 손상 응답을 성공 빈 목록으로 바꾸지 않는다. 선택 초안 저장 정보가 손상된 경우에도 access token이 있는 읽기를 막지 않는다. 정상 저장 정보는 로그인 세대를 유지하고, 사용할 수 없으면 현재 token에 묶인 메모리 난수 scope로 cache/늦은 응답만 구분한다. 이 fallback은 인증 증명이 아니며 서버가 JWT를 검증한다. token 변경 시 fallback scope는 교체되어 새로 읽는다. raw token을 query key/로그/새 영속 저장에 넣지 않는다.
