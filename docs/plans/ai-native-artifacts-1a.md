# 1a. 조직 권한 기반 구현 계획 (결정 반영본)

상위 설계: [ai-native-artifacts.md](ai-native-artifacts.md). 이 문서는 그중 1a(등급, 조직 규칙, 가드)의 구현 계획이다. 구현 전이며 코드는 바꾸지 않았다.

이 문서는 architect 검토와 사용자 결정(10절)을 반영했다. 반영 뒤의 문서 전체는 아직 architect가 다시 보지 않았다. 구현 시작 전 가드 구조 확인(4절 1단계)으로 핵심 가정을 다시 검증한다. 바뀐 것: (1) 판정 위치를 `validate`가 아니라 `canActivate`로 고쳤다. (2) 쓰기 라우트가 약 70곳이 아니라 약 260개이고, POST인데 읽기인 라우트가 40개 넘게 있어 분류 체계를 늘렸다. (3) 원격 `/mcp` 쓰기가 가드 밖에 있는 것을 1a 범위에 넣었다. (4) 마이그레이션 대신 읽을 때 `member`를 `editor`로 바꾸는 별칭 방식으로 바꿨다. (5) 권한 부여 admin 전용은 한 줄 변경이 아니라 별도 작업으로 나눴다. (6) 모드 스위치의 의미와 부팅 조건을 정리했다.

근거 표기. 직접은 이 작업에서 소스를 열어 확인한 것, 검토는 architect가 코드를 읽고 제시한 줄 번호, 조사는 조사 에이전트의 보고다. 구현 시작 전에 각 줄을 다시 연다.

## 구현 상태 (2026-11-05)

브랜치 `feat/org-roles-1a`(기준 `feat/docker-quickstart` `72096fd9`). 검증 근거는 [docs/testing/docker-quickstart.md](../testing/docker-quickstart.md)의 "조직 관리 모드와 등급 실검증"이다.

| 단계 | 상태       | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 완료       | 쓰기 라우트 271개 분류 표(`auth/route-capabilities.ts`)와 누락·오분류 방지 테스트. 데코레이터가 아니라 표로 했다                                                                                                                                                                                                                                                                                                                                                                    |
| 2    | 완료       | 4등급 타입, 허용 목록 6곳을 `isMemberRole`로, 프런트 shape 가드. 마이그레이션 없이 읽을 때 `member`를 `editor`로 간주                                                                                                                                                                                                                                                                                                                                                               |
| 3    | 완료       | 관리 모드: 부트스트랩 계정만 조직 생성(enterprise·거버넌스), 시드, 부팅 규칙, `context()` 확장                                                                                                                                                                                                                                                                                                                                                                                      |
| 4    | 완료       | `JwtAuthGuard.canActivate`에서 등급·소속 판정, 4등급 입력, `member.role_changed` 감사. 분류에 없는 쓰기 라우트는 `manage`, 컨텍스트가 없으면 거부                                                                                                                                                                                                                                                                                                                                   |
| 5    | 완료       | 원격 MCP 쓰기(`comments:write`·`suggestions:write` → comment, `shares:write` → share)에 등급 적용                                                                                                                                                                                                                                                                                                                                                                                   |
| 6    | 완료(API)  | `grantAuthority`: 같은 조직 admin이 소유자와 무관하게 권한을 주고 회수한다. 권한 행은 자원 소유자 기준으로 저장해 조회가 된다. admin이 자기가 속한 그룹에 남의 자원 권한을 주거나 그런 그룹에 자기를 넣는 일은 거부(사용자 결정). 부여 때 소유자 계정을 함께 잠그고 소유자가 바뀌었으면 409. SQLite 단위 테스트와 실제 PostgreSQL 스택 API 13개로 확인했고 **동시 요청 경쟁은 NOT_RUN**. 관리 화면의 자원 목록은 본인 소유만 보여 주므로 UI에서 남의 자원을 고르는 일은 하지 않았다 |
| 7    | 완료(일부) | 등급 선택지 4개, 관리 모드 안내, 소속 없는 계정을 `/organization`으로 보내는 인터셉터, 조직 번호 자동 입력(리다이렉트는 조직 페이지, 거버넌스 `/organizations`, 로그인·공유·공개 화면을 제외). 거버넌스 화면의 조직 생성 버튼 숨김은 하지 않았다                                                                                                                                                                                                                                    |
| 8    | 완료       | compose 기본값 `guest`, smoke의 등급 시나리오, 실제 스택·브라우저 확인                                                                                                                                                                                                                                                                                                                                                                                                              |

architect 검토 후 사용자가 정한 것: (1) BI 거버넌스 컨트롤러 전체를 조직 밖 계정에 계속 연다(외부 파트너 접근 보존). (2) 문서 공유와 재사용 권한 부여는 editor도 한다(2.3의 `share`는 보고서 한정이 아니라 읽기 공유와 재사용 접근으로 넓어졌다). (3) 운영의 부트스트랩 계정 선점 틈은 문서로만 안내한다.

계획과 달라진 점: 분류는 데코레이터가 아니라 표, `member`는 마이그레이션 없이 별칭, `role()`은 4등급과 레거시 `member`를 모두 받아 입력값 그대로 저장한다(계획은 새로 쓸 때 4등급만이었다). `staff-transfer.service.ts:366`의 `role: 'member'` 하드코딩은 그대로 둬서 열린 모드에서 다른 조직으로 이동한 viewer가 editor급으로 들어간다(받는 쪽 admin의 승인은 필요). 인계(handover) 서비스는 등급을 보지 않는다. 다음 작업 후보로 남긴다.

## 1. 목표와 범위

목표: 요구 5·6을 서버에서 강제한다. 회원에게 4등급(`admin`/`editor`/`contributor`/`viewer`)이 있고, 권한 부여는 admin만 하며, 조직 밖 사용자는 쓸 수 없고, 조직은 부트스트랩 admin만 만든다.

범위 안:

- 4등급과 기존 `member`의 별칭 처리.
- 인증 가드에서 조직 소속과 등급 능력 판정(HTTP 쓰기 전 구간)과 라우트 분류 테스트.
- 원격 `/mcp` 쓰기 도구의 등급 검사.
- 조직 생성 경로 2곳 차단과 부트스트랩 admin.
- 권한 부여 admin 전용(별도 단계).
- 프런트의 역할 타입·화면·대기 화면.
- Docker 체험 스택의 시드·compose·문서 정합.

범위 밖(1b 이후): 외부 AI용 MCP 쓰기 scope 추가, 대시보드 저장 이력, 관리자 페이지 `/admin`, 서버 AI 설정 화면. 백그라운드 실행(내보내기 작업 `run`, 파일 새로 고침 재시도)은 접수 시점에만 검사한다. WebSocket은 emit만 하고 `@SubscribeMessage`가 없어 구멍이 아니다(검토).

## 2. 핵심 설계 결정

### 2.1 판정 위치: `JwtAuthGuard.canActivate` + 라우트 분류 테스트

`JwtAuthGuard`는 `AuthGuard('jwt')`를 상속하지만 `canActivate`를 통째로 덮어쓰고 `super`를 부르지 않는다. `validate(payload, accessPath)`는 `ExecutionContext`가 없어 라우트 메타데이터를 읽을 수 없다(직접 `auth/guards/jwt-auth.guard.ts:19-36,77`). 그래서 판정은 `canActivate`의 일반 토큰 분기(`accessPath === true`) 끝에 둔다.

- 생성자 `(jwt, db)`는 바꾸지 않는다. 이 시그니처를 직접 쓰는 곳이 많다. 하위 클래스 둘(`legacy-operations.guard.ts`, `studio-publication.controller.ts`), 직접 생성하는 spec(`staff-transfer.spec.ts`, `sqlite-committed-auth.spec.ts`, `delivery.spec.ts`, `enterprise-auth-revocation.spec.ts`, `jwt-auth.guard.spec.ts`), bare provider 모듈(`commerce.module.ts`, `mcp-oauth.module.ts`)이다(검토).
- 메타데이터는 `Reflect.getMetadata`로 읽고 멤버십은 이미 주입된 `DataSource`로 조회한다. 하위 클래스는 `super.canActivate`를 거치므로 자동으로 덮인다.
- `authorization-url`(공유 토큰) 분기는 계정이 없으므로 건너뛰고 테스트로 고정한다.
- 부수 영향을 계획에 적는다. `StudioPublicationGuard`는 헤더가 없을 때만 공개 조회를 통과시키므로 관리 모드의 비소속 로그인 사용자는 익명이 읽는 공개 게시물에서 403을 받는다. `template.controller`는 클래스의 `JwtAuthGuard`와 메서드의 `LegacyOperationsGuard`가 겹쳐 검사가 두 번 돈다. `LEGACY_OPERATIONS_USER_IDS`의 운영자가 조직에 속하지 않으면 관리 모드에서 운영 라우트가 막힌다.

라우트 분류 (1단계에서 표 방식으로 확정).

- 분류는 컨트롤러에 데코레이터를 다는 대신 한 파일의 표 `backend-api/src/auth/route-capabilities.ts`(`컨트롤러.핸들러 → 능력`)에 둔다. 약 270개를 70여 개 컨트롤러에 흩어 고치면 다른 변경과 충돌하기 쉽고, 표는 리뷰와 스냅샷 diff가 한 곳에서 된다. 가드는 `context.getClass().name`과 `context.getHandler().name`으로 표를 조회한다.
- GET·HEAD는 암묵적으로 `read`다. POST·PUT·PATCH·DELETE·ALL은 표에 있어야 하고, 없으면 `route-capabilities.spec.ts`가 실패한다(기본 닫힘). 표의 낡은 항목, 알 수 없는 능력, 로그인 가드가 있는 라우트의 `public` 분류, 로그인 가드가 없는 라우트의 비`public` 분류, 운영자 가드 없는 `operator`도 실패한다.
- POST인데 읽기인 라우트(미리보기, 탐색 쿼리, 목록, AI 보조 조회)는 `read`로 분류해 viewer의 정상 읽기를 막지 않는다. 능력 값 13개의 의미는 표 파일 머리말에 있다.
- 테스트는 누락과 형식 오류만 잡고 잘못된 분류는 못 잡는다. 스냅샷(`__snapshots__/route-capabilities.spec.ts.snap`)이 라우트마다 한 줄씩 `VERB /path -> 능력`을 담아 분류 변경이 diff로 보이게 한다.
- 1단계 결과: 쓰기 동사 라우트 271개, 컨트롤러 79개. 로그인 가드가 없는 13개는 모두 익명 인증·분석·개발용·MCP 라우트이고 `public`이다. 계획의 가정(쓰기 컨트롤러는 모두 `JwtAuthGuard` 계열이거나 알려진 예외)이 성립한다.

### 2.2 모드와 등급 적용

- 저장된 등급은 두 모드 모두에서 적용한다. 기존 `member`는 읽을 때 `editor`로 간주한다(2.4). 이렇게 하면 "비관리 모드에서만 `member`를 editor로 보고 나머지는 무시한다"는 모순이 없다.
- 관리 모드(`BOOTSTRAP_ADMIN_USER_ID`가 설정된 경우)만 두 가지를 더한다. (1) 멤버십이 없는 사용자는 허용 목록 밖에서 403(`ORGANIZATION_REQUIRED`)을 받는다. (2) 조직 생성은 부트스트랩 사용자만, 조직이 없을 때만 가능하다.
- 변수 값은 로그인 ID(`userId`) 문자열이다(결정됨).
- 허용 목록은 경로 문자열이 아니라 분류 표(`route-capabilities.ts`)의 `own-account`·`public` 분류와 별도 허용 목록으로 두어 `route-capabilities.spec.ts`가 함께 검사한다. 포함: `/login/*`, `/access/*`, `GET /enterprise/context`, 등록 코드 발급·취소(`DELETE /enterprise/enrollment` 포함), `POST /enterprise/organizations`(부트스트랩 admin이 조직을 만들기 전에는 비소속자이므로 허용하되 서비스가 부트스트랩 사용자만 통과시킨다), 계정 자기관리 라우트 `GET /user/userinfo`, `PATCH /user/change-info`, `DELETE /user/delete-account`(허용, 결정됨), 로그인한 비소속 사용자의 공개 게시물 조회(허용, 결정됨), `LEGACY_OPERATIONS_USER_IDS` 운영자와 BI 거버넌스 admin의 각자 라우트(허용, 결정됨. 조직 밖 권한을 열어 두는 결정이라 운영 문서에 명시한다). 로그아웃은 `LocalAuthGuard`라 해당 없다.
- 부팅 조건. 관리 모드에서 부트스트랩 계정이 아직 없고 `SIGNUP_MODE`가 `open`이면, 그 로그인 ID로 먼저 가입한 사람이 인스턴스 admin이 되므로 부팅을 거부한다(결정됨). 계정이 시드되어 있으면 탈취가 불가능하다. prod에서 부트스트랩 사용자 존재는 새 설치가 부팅 뒤에 가입하므로 거부가 아니라 경고로 둔다(`production-guard.ts:18,78-95`, `main.ts:97-103`).
- "스위치 해제로 원복"은 소속 필수와 조직 생성 제한만 되돌린다. 이미 설정된 등급 제한은 남는다.

### 2.3 능력과 등급

능력은 한 파일(`enterprise/role-capabilities.ts`)의 표로 정의한다.

| 능력       | 대표 라우트                                      | admin       | editor | contributor | viewer |
| ---------- | ------------------------------------------------ | ----------- | ------ | ----------- | ------ |
| `read`     | 모든 GET, POST 읽기(미리보기·탐색 쿼리·목록)     | O           | O      | O           | O      |
| `comment`  | 보고서·대시보드 댓글과 제안, 알림 읽음           | O           | O      | O           | O      |
| `personal` | 개인 뷰, 개인 보관                               | O           | O      | O           | O      |
| `write`    | 본인 아티팩트 생성·수정·삭제                     | O           | O      | O           | X      |
| `source`   | 데이터 소스 연결·업로드·새로 고침                | O           | O      | O           | X      |
| `publish`  | 게시, 게시 취소, 공유 링크                       | O           | O      | X           | X      |
| `share`    | 보고서 읽기 공유(수신자 지정)                    | O           | O      | X           | X      |
| `export`   | 내보내기 작업 생성·실행                          | O           | O      | X           | X      |
| `manage`   | 회원·등급, 권한 부여, 그룹, 전달, 수명주기, 이관 | O           | X      | X           | X      |
| `operator` | 레거시 운영 라우트(템플릿 등)                    | 운영자 목록 |        |             |        |

대시보드 읽기 공유(전달, `delivery`)는 지금 admin이면서 소유자만 할 수 있다(검토 `resource-policy.service.ts`, `delivery.service.ts:190,236`). 보고서 읽기 공유(`report-sharing.service`)는 `member`도 한다. 그래서 표의 `share`는 보고서 한정이고, 대시보드 전달은 `manage`다. editor에게 대시보드 전달은 열지 않는다(결정됨. 요구 6의 "권한을 주는 것은 admin만"과 맞다).

`database execute`(임의 SQL 실행, `database.controller.ts:230,253,329`)는 `source` 능력이다(결정됨). viewer는 만들어진 대시보드·보고서를 보는 데 집중한다.

### 2.4 `member` 별칭 (마이그레이션 없음)

데이터 이관 대신 공유 `normalizeRole()`로 읽을 때 `member`를 `editor`로 바꾼다. 새로 쓸 때는 4등급 값만 쓴다. 이유는 셋이다. (1) 메타데이터 DB의 마이그레이션은 엔진별 위치가 두 곳이고(`src/migrations/postgres/` 최신 `1793600000000`, 기존 디렉터리 최신 `1793440000000`) `app.module.ts:160-217`에 배열로 등록해야 한다. (2) 자동 실행은 `NODE_ENV==='local'`일 때만이고(`app.module.ts:221`) Docker 스택은 `dev`라서 돌지 않는다(직접). (3) `down()`이 값 손실이다. `enterprise_membership.role`은 `varchar(16)`이라 스키마 변경도 필요 없다.

적용 방식.

- 엔티티 타입은 `EnterpriseRole | 'member'`(레거시 별칭)로 둔다.
- 허용 목록 6곳(`reports/report-sharing.service.ts:177,305,352,431`, `mcp-oauth/mcp-report.service.ts:489`, `enterprise/classification-context.ts:50`)은 `isEnterpriseRole(normalizeRole(role))` 같은 공유 헬퍼로 바꾼다. 새 등급이 목록에 없어 조용히 거부되는 회귀를 막기 위해서다.
- SQL 안의 `role = 'admin'`(`staff-departure-basis.ts:147-149`)은 영향이 없다.
- `bi/source-classifications.ts:62`는 저장된 등급을 하드코딩한 것이 아니라 `canManage ? 'admin' : 'member'`로 만드는 응답 값이다. 상수로 바꾸면 API 응답이 바뀌므로 그대로 둔다(검토).
- `staff-transfer.service.ts:366`의 `role: 'member'` 하드코딩은 기본 등급 상수(`editor`)로 바꾼다.

### 2.5 권한 부여는 admin만 (1a 마지막 단계, 별도 작업)

`resource-policy.service.ts:102`의 `management()`는 "admin이면서 소유자"다. 소유자 조건만 빼면 되는 문제가 아니다.

- grant를 쓸 때 `ownerId: actor`로 저장하는데(`:371,432,537,621`) `currentRights`는 `ownerId: resource.ownerId`로 grant를 찾는다(`:132,148,158`). admin이 남의 자원에 준 grant는 조회되지 않아 효과가 없다(직접 확인). 회수 CAS(`:602-614`)도 `prior.ownerId === actor`를 전제한다.
- `management()`는 `assertManagement`를 통해 `delivery.service.ts:190,236`, `group-delivery.service.ts:27,84`, `source-lifecycle.service.ts:22`, `source-access.service.ts:180`도 받친다. 소유자 조건을 빼면 admin이 남의 비활성 대시보드에 소유자급 쓰기, 남의 대시보드 전달, 소스 비활성화를 갖게 된다.
- 계획 초안이 말한 "소유자가 같은 조직이어야 한다는 조건"은 지금 코드에 따로 없었다. 소유자 본인 조건이 그 역할을 암묵적으로 했다.
- 관리 대상 목록(`:485-498`)은 actor 자신의 `UserMapping`만 훑는다.

그래서 함수를 둘로 나눈다. `assertGrantAuthority`는 admin이고 자원 소유자가 같은 조직인지 새로 검사하며 grant를 쓸 때 `ownerId = resource.ownerId`를 쓴다. 기존 `assertManagement`는 그대로 둔다. 목록과 CAS 쿼리도 함께 고치고 호출처별 회귀 테스트를 둔다. grant는 자원 소유자 기준으로 저장해 조회가 되게 하고, 회수는 같은 조직의 admin이 한다(결정됨). 소유자 본인은 권한을 주거나 회수하지 못한다.

### 2.6 원격 `/mcp` 쓰기

`mcp.controller.ts:43-50`의 `@All()`에는 가드가 없다. 쓰기 도구(댓글, 답글, 수정 제안, 공유)는 `assertGrant`(`mcp-oauth.service.ts:1063-1090`)만 거쳐 조직 일치와 scope만 보고 등급은 보지 않는다. 그래서 `shares:write` grant를 가진 viewer는 MCP로 공유할 수 있다(검토). 등급 변경은 `authVersion`을 올리지 않아(`enterprise.service.ts:329-340`) 기존 MCP 토큰이 살아 있다.

`assertGrant`에서 scope를 능력으로 바꿔 `can(role, capability)`를 검사한다. scope 대응: `comments:write → comment`, `suggestions:write → comment`, `shares:write → share`. 한 곳만 고치면 된다. 이 변경은 기존 MCP 쓰기에 등급을 적용하는 동작 변경이며 적용하기로 결정했다.

### 2.7 감사

등급 변경은 `member.updated`로 기록되지만 이전·이후 값이 없어 등급 변경과 팀 변경을 구분할 수 없다(검토 `enterprise-audit-event.entity.ts:5-12`). 등급이 바뀌면 별도 action `member.role_changed`를 남긴다. 시드와 부트스트랩의 조직 생성도 `organization.created`로 기록한다. 이전·이후 열 추가는 1a에서 하지 않는다.

## 3. 변경 파일

백엔드.

| 파일                                                                                                                  | 변경                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enterprise/role-capabilities.ts` (신규)                                                                              | 4등급, `normalizeRole`, 능력 표, `can(role, capability)`                                                                                                                                                                                                                                                                                           |
| `enterprise/entities/enterprise-membership.entity.ts:8`                                                               | 역할 타입을 `EnterpriseRole \| 'member'`로                                                                                                                                                                                                                                                                                                         |
| `enterprise/enterprise.service.ts:41-45,255,295,316,320,333`                                                          | `role()` 검증을 4등급으로(기존 `member` 입력은 별칭 허용), 자기 admin 회수 금지 유지                                                                                                                                                                                                                                                               |
| `enterprise/enterprise.service.ts:161-181`                                                                            | 조직 생성: 관리 모드면 부트스트랩 사용자만, 조직이 없을 때만. 감사 기록                                                                                                                                                                                                                                                                            |
| `bi/governance.service.ts:104-127`                                                                                    | 조직 생성 게이트(부트스트랩 로그인 ID만). `setMember`(`:278`)는 BI 조직 소유자만 호출하고 읽기 전용 `viewer`만 추가하므로, 관리 모드에서 소유자가 부트스트랩 사용자뿐이 되는 생성 제한으로 충분하다고 판단해 변경하지 않았다. enterprise 멤버십이 없는 거버넌스 admin의 `/bi/organizations/*` 쓰기는 막지 않는다(결정: 비소속 거버넌스 admin 허용) |
| `enterprise/staff-transfer.service.ts:366`                                                                            | 기본 등급 상수                                                                                                                                                                                                                                                                                                                                     |
| `reports/report-sharing.service.ts`, `mcp-oauth/mcp-report.service.ts:489`, `enterprise/classification-context.ts:50` | 허용 목록을 공유 헬퍼로                                                                                                                                                                                                                                                                                                                            |
| `auth/guards/jwt-auth.guard.ts:19-75`                                                                                 | `canActivate` 일반 토큰 분기 끝에 소속·능력 검사. 공유 토큰 분기는 제외                                                                                                                                                                                                                                                                            |
| `auth/route-capabilities.ts` (1단계에서 추가)                                                                         | 쓰기 라우트 271개의 분류 표. 데코레이터는 쓰지 않는다                                                                                                                                                                                                                                                                                              |
| `route-inventory.spec.ts`와 스냅샷 파일 (신규)                                                                        | 선언 누락 실패, `route → capability` 스냅샷 비교                                                                                                                                                                                                                                                                                                   |
| `mcp-oauth/mcp-oauth.service.ts:1063-1090`                                                                            | `assertGrant`에서 scope를 능력으로 변환해 등급 검사                                                                                                                                                                                                                                                                                                |
| `enterprise/resource-policy.service.ts`                                                                               | `assertGrantAuthority` 신설, grant `ownerId`와 조회·회수 쿼리 정리(2.5)                                                                                                                                                                                                                                                                            |
| `enterprise/enterprise.service.ts` `context()`                                                                        | 응답에 `mode`, `canCreateOrganization` 추가                                                                                                                                                                                                                                                                                                        |
| `config/production-guard.ts`, `main.ts:52-53,99-103`                                                                  | 부트스트랩 형식 검사, 관리 모드 + 가입 개방 + 계정 없음 거부, prod 존재 검사는 경고. dev 스택용 검사는 `environmentProblems()`에                                                                                                                                                                                                                   |
| `database/seeds/create-initial-data.ts:1569-1586`                                                                     | 관리 모드면 조직과 admin 멤버십을 멱등하게 생성(`guest`가 부트스트랩이면 admin으로 연결). 감사 기록                                                                                                                                                                                                                                                |

프런트엔드.

| 파일                                                                              | 변경                                                                                                           |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `api/enterpriseService.ts:5,40,77,95`                                             | `EnterpriseRole`을 4등급+별칭으로, `contextShape`·`memberShape` 갱신, `mode`·`canCreateOrganization` 필드 허용 |
| `pages/Enterprise/index.tsx:35-37,84,111,389-439,789-801,925-935,508-511,639,658` | 역할 라벨·선택지 4개, 기본값, 안내 문구, 조직 생성 폼은 `canCreateOrganization`일 때만                         |
| `pages/Organization/index.tsx:182-190,298`                                        | 거버넌스 조직 생성 버튼 숨김(관리 모드)                                                                        |
| 소속 없는 사용자 대기 화면                                                        | `ORGANIZATION_REQUIRED`를 받으면 등록 코드 발급 안내                                                           |
| 관련 `*.test.tsx`                                                                 | 역할 리터럴과 문구 갱신                                                                                        |

체험 스택·문서.

| 파일                                            | 변경                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`                            | `BOOTSTRAP_ADMIN_USER_ID: ${BOOTSTRAP_ADMIN_USER_ID:-guest}`. 시드된 `guest`가 있으므로 가입 개방 거부 조건에 걸리지 않는다 |
| `.env.example`, `README_DOCKER.md`, `README.md` | 새 변수와 `guest`가 조직 admin이라는 점                                                                                     |
| `scripts/docker-smoke.sh`                       | `guest`의 `GET /enterprise/context`가 admin, 새 가입자의 쓰기가 403                                                         |

## 4. 구현 순서 (각 단계 끝에 검증)

1. **전수 목록과 가정 확인.** 쓰기 라우트 약 260개를 뽑아 능력을 분류하고(`read` 포함) 가드 사용을 확인한다. 가드 밖 쓰기 컨트롤러는 `/mcp`, 익명 인증 라우트(signin, signup, waitlist, analytics, mcp-oauth token/revoke)가 알려져 있다. 산출: 분류 초안과 스냅샷 파일. 가정이 깨지면 2.1로 돌아간다.
2. **타입·헬퍼·프런트 가드 (동작 불변).** `normalizeRole`과 공유 헬퍼, 허용 목록 6곳 교체, 프런트 `contextShape`·`memberShape`를 4등급·새 필드까지 허용하게. 이 시점에는 값이 `admin|member`뿐이라 동작이 변하지 않아야 하고 기존 테스트가 그대로 통과한다. 프런트 가드는 서버보다 먼저 배포한다.
3. **조직 생성 게이트와 부트스트랩.** 관리 모드 게이트, 시드, `context()` 확장, production-guard, 감사 기록. 이 단계에서는 등급 입력을 열지 않는다.
4. **가드 판정, 라우트 분류, 4등급 입력.** `canActivate` 검사(분류 표 조회), 분류 스냅샷 테스트, `role()`의 4등급 입력 허용을 같은 커밋에 넣는다(입력만 열고 검사를 늦추면 viewer가 이름뿐이 된다). 비관리 모드에서 기존 단위·e2e가 변하지 않는지 확인한다.
5. **`/mcp` 등급 검사.** `assertGrant` 변경과 테스트.
6. **권한 부여 admin 전용.** `assertGrantAuthority`, grant `ownerId`·조회·회수 쿼리, 호출처별 회귀 테스트.
7. **프런트 화면.** 역할 선택지, 대기 화면, 조직 생성 폼 조건, 테스트.
8. **체험 스택.** compose, smoke, 문서. 새로 띄운 스택에서 실제 요청으로 검증한다.

## 5. 검증 계획

테스트 실행은 규칙에 따라 `audit` 서브에이전트가 한다. 커밋하지 않은 변경은 패치 파일로 넘긴다.

백엔드 단위·통합.

- 능력 표: 4등급 × 능력 전수 테스트.
- 가드: 멤버십 없음(두 모드), 4등급별 쓰기 허용·거부, 읽기·POST 읽기가 전 등급 통과, 허용 목록 라우트, 공유 토큰 분기와 공개 게시물 경로, 하위 가드(`StudioPublicationGuard`, `LegacyOperationsGuard`)의 동작.
- 라우트 인벤토리: 쓰기 라우트 중 선언 없는 것이 없고 `route → capability` 스냅샷과 일치한다.
- 조직 생성: 부트스트랩 사용자 허용, 다른 사용자 거부, 조직이 이미 있으면 거부, 두 경로(enterprise, 거버넌스) 모두.
- 별칭: 저장된 `member`가 `editor`로 동작하고, 허용 목록 6곳이 4등급 수신자를 받는다.
- 권한 부여: 비admin의 부여·등급 변경은 403, admin의 부여가 `currentRights`에서 실제로 조회된다(`ownerId` 불일치 회귀), 회수, 본인 admin 회수 거부, 마지막 admin 보호.
- MCP: 등급이 viewer로 바뀐 뒤 같은 grant로 공유·댓글 쓰기가 거부된다(등급 변경은 `authVersion`을 올리지 않으므로 토큰은 살아 있다).
- 회귀: `jwt-auth.guard.spec`, 생성자를 직접 쓰는 spec 5개, `enterprise.service.spec`, `staff-transfer.spec`, `dashboard-lifecycle.spec`, `resource-policy.spec`, `report-sharing.service.spec`, `governance.service.spec`가 비관리 모드에서 변경 없이 통과한다.

프런트.

- 역할 shape 가드가 4등급과 새 필드를 받는다. 라벨·선택지 4개. 관리 모드에서 조직 생성 폼이 숨겨진다. 대기 화면.

체험 스택 실행(실제 요청).

- 새로 띄운 compose 스택에서 `guest`가 admin 컨텍스트를 받는다.
- 새 가입자는 관리 모드에서 대시보드 생성이 `ORGANIZATION_REQUIRED`로 거부된다.
- admin이 등급을 `viewer`로 바꾸면 그 사용자의 쓰기가 거부되고 읽기·미리보기는 된다.
- 비admin이 등급 변경을 시도하면 403이다.
- `scripts/docker-smoke.sh` 통과.

브라우저.

- 관리 모드용 Playwright 스펙을 최소 하나 추가한다(admin 로그인 → 회원 등급 변경 → viewer로 로그인 → 쓰기 거부 확인). 기존 e2e 스펙은 비관리 모드 기준이다.

NOT_RUN으로 남을 수 있는 것: MySQL 변형 spec(별도 DB 필요), 운영 DB 엔진별 동작, 기존 e2e 전체의 관리 모드 실행.

## 6. 위험

기준선 실패(1a와 무관, 기준 커밋 `72096fd9`에서도 동일하게 실패, 같은 방법으로 비교): `common/monitoring/connection-pool-monitor.service.spec.ts`, `dashboard/personal-library.spec.ts`, `data-source.spec.ts`, `database/seeds/seeder.service.spec.ts`. 전체 스위트를 병렬로 돌리면 `studio-pivot.integration`, `studio-remix-conditions`, `studio-remix.service`, `documents.service`, `staff-departure`, `classification.service` 등이 시간 초과로 실패할 수 있으나 병렬도를 낮추면(`--maxWorkers=2`) 통과한다.

| 위험                                                                                | 대응                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 허용 목록 6곳 누락으로 새 등급이 조용히 거부된다                                    | 2단계에서 공유 헬퍼로 교체하고 4등급 수신자 테스트 추가          |
| 프런트 shape 가드가 새 역할·필드를 거부해 사용자가 비소속처럼 보인다                | 프런트 가드를 2단계로 당겨 서버보다 먼저 배포                    |
| 입력은 열렸는데 검사가 늦어 viewer가 이름뿐이다                                     | 4단계에서 같은 커밋                                              |
| 분류 오류(쓰기를 읽기로 분류)                                                       | 스냅샷 diff 리뷰, 능력별 대표 라우트 실행 테스트                 |
| 가드 생성자를 쓰는 spec·모듈 회귀                                                   | 생성자 시그니처 유지, 회귀 목록 실행                             |
| 관리 모드에서 비소속 운영자·거버넌스 admin을 허용하기로 했다. 조직 밖 권한이 열린다 | 허용 목록에 명시하고 운영 문서에 적는다                          |
| 공개 게시물이 로그인한 비소속자에게는 403이다                                       | 부수 영향으로 문서화, 허용 목록 여부 결정                        |
| `develop`의 CI가 이미 빨갛다(frontend, backend, postgres-integration)               | 시작 전에 기준선 실패 목록을 기록해 새 실패와 구분               |
| 요청마다 멤버십 조회가 늘어난다                                                     | PK(`userId`) 조회라 가볍다. 측정 후 기존 쿼리와 합치는 방안 결정 |
| 소유자 단락·백그라운드 경로가 가드 밖에서 호출된다                                  | 범위 밖으로 명시, 1b 점검 항목                                   |

## 7. 되돌리기

1차 수단은 `BOOTSTRAP_ADMIN_USER_ID`를 비우는 것이다. 소속 필수와 조직 생성 제한이 꺼진다. 이미 설정한 등급 제한은 남는다(2.2). 데이터 이관이 없으므로 별도 롤백 작업은 없다. 별칭은 읽기 전용 변환이라 `member` 행이 그대로 남아 있다.

## 8. 브랜치와 커밋

기준 브랜치는 `feat/docker-quickstart`(사용자 결정)다. `develop`에는 보고서 댓글·MCP refresh 같은 미병합 작업이 없고 이 계획이 다루는 코드 일부가 그 위에 있어서, 새 브랜치 `feat/org-roles-1a`를 별도 worktree(`../vanillameta-1a`)에서 `72096fd9` 위에 만들었다. PR은 #487 → docker-quickstart → 1a 순서로 쌓인다. 단계별로 커밋을 나누고, 작업 트리의 무관한 5개 파일은 stage하지 않는다. 푸시와 PR은 요청이 있을 때만 한다.

## 9. 사실 출처와 정정

- 판정 위치: 직접 `auth/guards/jwt-auth.guard.ts:19-36,77`(`canActivate` 덮어쓰기, `validate`에 컨텍스트 없음).
- grant `ownerId` 불일치: 직접 `enterprise/resource-policy.service.ts:102,132,148,158,371,432,537,621`.
- 마이그레이션 자동 실행 조건: 직접 `app.module.ts:221`.
- 쓰기 라우트 약 260개, POST 읽기 40개 이상, `/mcp` 가드 없음, WebSocket 구멍 아님, 감사 열 없음: 검토.
- 쓰기 진입점의 접근 검사와 소유자 분기 줄 번호: 조사와 검토가 같은 줄을 지목(`source-access.service.ts:108-111,137`, `resource-policy.service.ts:122-124`).
- 검사가 없거나 미확인으로 보고된 곳: `bi-segment.service.ts:149`, `condition-report.service.ts:65`, `explore-view.service.ts:58`(읽기 등급으로 쓰기), commerce, 일부 handover. 1단계 전수 목록에서 확정한다.

## 10. 사용자 결정 (2026-11-05, 질문 도구 응답)

- 능력 표(2.3): 제안대로 확정(viewer=읽기·댓글·개인 뷰, contributor=본인 아티팩트 생성·수정·삭제와 소스 연결·업로드, editor=게시·보고서 읽기 공유·내보내기, admin=회원·권한 관리).
- 등급 적용(2.2): 저장된 등급은 두 모드 모두 적용. 기존 `member`는 읽을 때 `editor`로 간주.
- 부트스트랩(2.2): 변수 값은 로그인 ID. 계정이 없는데 `SIGNUP_MODE`가 `open`이면 부팅 거부. prod의 계정 존재 검사는 경고.
- `database execute`(2.3): `source` 능력.
- grant(2.5): 자원 소유자 기준으로 저장, 같은 조직 admin이 회수.
- 대시보드 전달(2.3): admin만 유지. 보고서 읽기 공유는 editor 이상.
- 관리 모드 허용 목록(2.2): 계정 자기관리, 공개 게시물 조회, 비소속 운영자·거버넌스 admin.
- 기존 MCP 쓰기(2.6): 등급 검사 적용.
