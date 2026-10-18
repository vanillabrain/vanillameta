# UC051 자원별 권한 연결

FR017·NFR005/007·TC050 E02/E03의 다음 구현 단위다. [전체 목표](enterprise-completion.md)를 유지하며 일부 경로 연결을 전체 수용으로 선언하지 않는다.

## 계약

기존 UserMapping은 대시보드 소유자 증명이며 수신자를 추가하지 않는다. Database.ownerId도 바꾸지 않는다. 별도 EnterpriseResourceGrant(resourceKind source/dashboard,resourceId,recipientId 복합PK,organizationId,ownerId,version,read,edit,publish,export)를 저장한다. false 전체도 버전 있는 회수 tombstone으로 보존한다. 새 grant expectedVersion0, 이후 현재 version CAS로 원자 변경/감사를 기록한다. 같은 요청 재전송의 멱등 영수증은 이 단계에 새로 보장하지 않으며409 후 재조회한다.

활성 동일 조직 admin이면서 자원 소유자인 계정만 부여/회수한다. 조직 admin이라는 이유만으로 타인 데이터 관리 권한을 얻지 않는다. 대상도 같은 조직 활성 직원이어야 한다. 자원 소유자/조직/대상 소속이 달라지면 과거 grant는 무효다. 본인 grant·다른 조직·NULL source owner·다중 dashboard owner는 거절한다. 서버에서 actor/owner/조직을 계산하고 본문에서 받지 않는다.

열람(read), 편집(edit), 게시(publish), 내보내기(export)는 독립 boolean이다. edit/publish/export에는 read=true가 필요하다. source의 publish=true는 지원하지 않아400이며 dashboard 게시만 지원한다. grant 재부여/변경은 원본 소유권을 이동하지 않는다. 기존 소유자는 기존 허용 동작을 유지하고 비소유자는 명시 action의 현재 grant만 사용한다. 삭제·연결 비밀/서버 경로·임의 SQL 실행·권한 재배포는 grant로 열지 않는다.

대시보드 권한은 연결 소스 권한으로 전이하지 않는다. 대시보드 읽기/편집/게시/export에는 각 연결 소스의 별도 read 허용도 필요하다. 대시보드 편집은 소스 지표/업무 설명 편집을 허용하지 않는다. 실행 기록·초안·영수증은 실제 요청 actor를 유지하며 소유자 ID로 치환하지 않는다. 저장/게시 transaction 안과 재시도·replay·파일 전송에서도 현재 권한을 재검사한다. 기존 게시에도 실제 publisherId/sourceId를 보존해 게시자의 현재 publish와 원래 소스 read를 확인한다. 이전 null 기록만 단일 원래 소유자 기준으로 호환한다. 회수 후 다음 보호 요청은403이며 기존 내려받은 데이터 회수는 보장하지 않는다.

## 정책 API (raw JSON)

- JWT `GET /enterprise/resources?after=dashboard:ID|source:ID`: 관리 가능한 본인 자원 `{entries:[{kind,id,label}],nextAfter}`. 고정 kind/ID 순서20+1. SQL/연결정보 없음. 소속/계정이 사라진 기존 수신자는 정책 목록에서 userId에 “직원 #ID (소속 확인 필요)” 표시 문자열을 사용한다. 요청의 대상 식별은 항상 recipientId로만 처리하며 이 표시 문자열을 로그인 ID로 사용하지 않는다.
- `GET /enterprise/resources/:kind/:id/policies`: `{kind,resourceId,entries:[{recipientId,userId,version,rights:{read,edit,publish,export}}]}`. 동일 조직 자원 소유 admin만.
- `POST /enterprise/resources/:kind/:id/policies` `{recipientId,expectedVersion,rights:{read,edit,publish,export}}`: `{kind,resourceId,recipientId,version,rights}`. exact key/boolean·버전·소속 검증, transaction CAS/감사 원자화.
- `GET /enterprise/resources/:kind/:id/access`: 대시보드는 연결 소스까지 검사한 현재 사용자 `{rights:{read,edit,publish,export}}`. 민감 자원 메타데이터 없이 허용 action을 알린다. 접근 없으면403.

공통 정책 서비스 `assert(kind,id,actor,action,manager?)`·`sourceIds(actor)`·`dashboardIds(actor)`·`capabilities(kind,id,actor)`를 제공한다. SourceAccess의 기존 기본 owner-only 의미는 유지하고 명시 action 전달 경로만 grant를 받는다. 목록은 허용 ID의 합집합이며 매 요청 최신 조직/활성/grant를 확인한다.

## 연결·검증 표

1. source 목록/프로파일/지표/Explore catalog/query/values/pivot는 read, 업무 설명·지표 생성은 edit, 서버 CSV는 export. 임의 SQL/연결정보/삭제는 소유자 전용 유지.
2. dashboard 목록/상세/Studio get는 read, 직접·AI preview/save는 edit, 게시 상태/링크 조회와 게시 두 경로는 publish. 일반 read 응답에는 소유자의 익명 공유 UUID/토큰을 반환하지 않는다. 공개 게시 읽기도 게시자의 현재 권한/연결 소스 상태를 확인한다. 개인 실행 기록 접근은 별도 보존.
3. UI는 조직 화면의 접힌 자원 권한 편집기에서 자원→직원→권한 변경 요약→동의→저장/재조회. 수정은 동의 해제·409/통신 실패는 초안 보존·403은 이전 권한/목록 제거. 소스/대시보드 화면에서 권한 없는 수정·게시/export 컨트롤을 숨기거나 설명하되 서버 검사가 최종이다.
4. 같은 조직 reader/editor/publisher/exporter·타 조직·inactive·grant 회수·source 권한만 회수·소유자 성공을 실제 DB/HTTP로 대조한다. source query와 export 독립 수치 oracle, dashboard 직접/AI→preview→save/reload, 게시·replay를 확인한다.
5. 코드/선택 회귀/type/lint/build/core8·독립 리뷰·실UI390/768/1440를 구분한다. Ego 사용자 제어권이 반환되지 않았다면 실제 UI/디자인은 BLOCKED이며 우회하지 않는다. MySQL/실휴대폰/사람 수용은 별도다.
