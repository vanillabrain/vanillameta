# UC050 소스 활성 상태의 서버 적용

FR014·NFR005/007·TC050 E01/E02/E03의 후속이다. 전체 추가 요건 목표는 유지한다. 기존 원본/분석/게시를 삭제하지 않고 다음 보호 요청을 차단하는 소스 상태를 구현한다. 조직 공통 분류·공식 승인/전체 영향 그래프·전체 수용은 후속이다.

## 계약

Database에 catalogActive(boolean defaulttrue), catalogVersion(integer default0)를 추가한다. 이 catalogVersion은 활성 상태 CAS이며 /bi/sources의 동명 catalogVersion(업무 설명 이력 버전)과 다른 내부 값이다. 상태 API는 version으로 반환한다. 기존 소스는 활성으로 호환하며 상태 변경은 원본 데이터·연결정보·분석 정의·게시 snapshot을 바꾸지 않는다. 마이그레이션은 기존 행/소유권을 보존하고 파괴적 down을 거절한다.

JWT 관리 API `GET /enterprise/resources/source/:id/lifecycle`는 `{sourceId,active,version}`만 반환한다. POST 같은 경로는 exact `{expectedVersion,active}`이며 boolean/안전 정수/범위를 검증한다. 같은 조직의 활성 소유 admin만 조회/변경한다. 일반 source edit grant·타 조직 관리자·다른 소유자에게 상태 관리 권한을 주지 않는다. 비활성 상태에서도 이 관리 경로와 자원 권한 관리 목록은 유지해 다시 활성화할 수 있다.

동일 enterprise 쓰기 큐/transaction 안에서 관리 권한을 다시 확인하고 소유자/버전 CAS 업데이트와 실제 actor/source/version 감사(action source.activate/source.deactivate)를 원자화한다. 같은 값도 명시 변경 요청이면 새 버전/감사를 만들며 낡은 요청 재전송은409다. 드라이버 잠금/교착은409로 변환하고 조회 중 사라진 소스는403이다. 응답 유실은 GET으로 현재 상태를 명시 재조회하며 자동 재전송하지 않는다.

일반 SourceAccess assert의 owner/read/edit/publish/export와 연결 dashboard/widget/source 검사에서 비활성은403이다. source 직접 정책 assert도 비활성을 거절한다. 파일/SQL/원본 값 조회 전에 차단하며 공개 snapshot/재사용도 기존 현재 게시자·원 소스 검사를 통해 차단된다. 조회 중 이미 표시한 화면/다운로드를 원격으로 회수하거나 진행 중 SQL을 일괄 취소하지 않는다. 재활성 후 기존 grant/원본 정의/게시 만료·중지 상태는 그대로 현재 검사한다. 소스 목록은 비활성을 제외하되 상태를 관리할 admin 소유 자원 목록은 유지한다. 일반 연결 목록/이름 수정/삭제/파일 교체도 비활성에서는 차단하며 조직 자원 관리가 재활성 진입점이다.

## 화면·검증

기존 조직 자원 권한 패널에서 선택된 source의 접힌 상태 관리 컴포넌트를 제공한다. 명시 읽기→현재/변경 차이→연결된 분석·게시 새 조회 차단 경고와 동의→저장→재조회다. 입력 변경은 동의를 초기화하고409/통신 실패는 초안을 보존하되 명시 재조회 전 새 저장은 잠근다.403은 이전 상태·제어를 제거한다. source/조직 전환·늦은 응답은 이전 상태를 적용하지 않는다. 기본36px/도구32px·wrap/min-width0를 사용한다.

실제 SQLite의 관리 권한·CAS/감사/rollback·migration과 SourceAccess/목록·저장/미리보기·공개 게시/재사용/CSV 차단·재활성 후 복구/원본 불변을 검증한다. FE 상태 조회/동의/저장/재조회·오류/늦은 응답/readonly를 검사하고 기존 전체 BE/선택 FE/type/lint/build/core를 확인한다. 독립 리뷰·문서/pin/check/packet·비공개 정보 검사 뒤 commit/push한다. Ego 사용자 제어권 미반환으로 실제 UI/390·768·1440은 BLOCKED이며 MySQL·실기기/전체 수용은 별도다.

관리 자원 목록의 표시명은 최대300자 요약이며 긴 기존 SQLite 이름은 말줄임과 ID로 구분한다. 실제 저장된 이름/연결 정보는 이 요약 때문에 변경하지 않는다.
