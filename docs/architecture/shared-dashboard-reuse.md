# UC-021 공유·게시 대시보드 재사용

P5/FR-012 후속, Draft. UC020 소유 복제의 안전한 열 연결·ticket·원자 저장·영수증을 재사용한다. 수신자는 로그인하고 자신의 DuckDB 파일 소스를 반드시 선택한다. 원본 소스 접근·SQL 읽기·데이터 복사 권한은 부여하지 않는다.

## 권한과 버전

소유자가 재사용을 명시 허용한 활성/미만료 링크만 진입·미리보기·최초 저장에 사용할 수 있다. 기존 링크는 기본 불허다. 공유는 별도 소유자 설정 `allowReuse=false`에서 시작하고 현재 저장 정의를 사용한다. 게시 미리보기는 `allowReuse=true`를 선택했을 때만 내부 재사용 정의를 캡처하고 같은 게시 transaction에서 저장한다. 게시본은 이후 원본 수정/삭제된 소스와 분리된 게시 버전의 계산·배치를 사용한다. 재게시/중지/만료/재사용 불허는 미저장 ticket을 무효화한다. 이미 저장한 수신자 복사본의 동일 요청 영수증 재조회는 원본 링크 중지 후에도 허용한다.

게시 `reuseDefinition`은 nullable private text, 공유 `allowReuse`는 boolean default false다. migration은 기존 데이터를 유지한다. 내부 정의는 제한 SQL·필요 열 타입·표시/배치만 포함하고 집계 결과·소스 경로·연결/권한·지표 링크를 포함하지 않는다. 익명 게시 GET은 기존 집계 snapshot과 재사용 가능 여부만 반환한다. 로그인 재사용 GET은 제목·필요 열 이름/타입·내 소스 목록·불투명 revision만 반환하며 원본 ID/소스 ID/SQL/결과/인증은 노출하지 않는다. SQL의 문자열 조건은 서버 내부에서만 보존한다.

## 흐름과 경계

`/reuse/:kind/:uuid` 보호 화면(kind=share/publication), `/bi/reuse/:kind/:uuid` 로그인 API의 draft→preview→save를 UC020 UI/서비스에 연결한다. 링크 보유만으로 저장을 허용하지 않는다. targetId/profile/preview는 항상 수신자 owner 검사, preview와 저장 입력 whitelist, actor/reference/revision/target/ticket binding을 유지한다. 원본과 공유/게시 상태를 저장 전후 metadata transaction에서 검사해 경합 시 전체 rollback한다. 저장 SQL은 서버가 연결한 새 소스에서만 실행한다. 응답 preview에도 원본 SQL/비공개 필터 문자열을 반환하지 않는다. 새 복사본은 새 ID·비공개·원본 모든 폭 배치 유지이며 중앙 지표/게시/권한은 복사하지 않는다.

동일 요청 재시도는 기존 영수증 namespace에 origin kind/key를 포함해 다른 원본/요청과 충돌을 거절한다. 기존 소유 복제는 그대로 유지한다. 기존 shared live 화면은 공개된 위젯 결과를 읽기 위한 제한된 shareToken을 계속 사용한다. 재사용 API는 이 토큰을 받거나 반환하지 않는다. 기존 공유 메타데이터 응답에서도 analysisDefinition/structuredDefinition을 제거하되 live renderer의 제한 토큰은 유지한다.

## 검증과 종료

권한 없는 actor/익명·타인 target·불허/중지/만료/재게시·원본 수정 경합·부분 실패 rollback·중복 방지·기밀 필드 비노출과 게시 버전 불변을 자동 검사한다. Ego에서 별도 수신자 계정의 공유/게시→내 소스 선택/열 연결→preview→save→reload, 원본 불변 및390/768/1440 크기/정렬을 확인한다. 공개 Rill fixture의 임시 링크만 사용하고 마지막에 중지한다. 운영 MySQL·실휴대폰·질문으로 remix·임의 SQL·외부 엔진·전체 P5/TC005는 별도다.

## 재사용 허용의 공개 범위

미리보기 전송은 원본 SQL/조건 문자열을 노출하지 않는다. 다만 복사본 소유자는 저장 후 자신의 소스에서 실행되는 복사본 SQL을 편집·조회할 수 있다. 소유자의 재사용 허용은 계산식·필터 조건·표시/배치를 공유하는 권한이며 UI에서 이 범위를 명시한다. 필터의 문자열을 비밀 보관하는 방식으로 재사용을 제공하지 않는다. 원본 데이터/소스 연결권·전체 스키마·중앙 지표 권한은 계속 별개다.
