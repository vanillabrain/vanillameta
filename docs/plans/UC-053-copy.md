# UC053 받은 분석을 내 소스로 독립 복제

## 목표와 계약

FR021/022/NFR005/007/008: 소유자의 명시 복제 허용→수신자 받은 자료→본인 소스/열 연결→전체 미리보기→새 비공개 사본 원자 저장→재조회다. 원본/직접 권한/게시/기존 사본을 보존한다. 익명 게시나 원본 데이터 복사는 하지 않는다. 동적 그룹/일반 소유 member 공유·실제 Ego/모바일/MySQL·전체 TC050 수용은 별도다.

## 허용과 버전

기존 delivery에 allowCopy boolean(default false)을 additive migration한다. 조회 공유만으로 복제를 허용하지 않는다. 기존 공유 API의 선택 allowCopy는 true/false 명시 때만 갱신하고 생략하면 보존한다. 신규 공유는 기본 false, 회수는 false다. active/allowCopy 변화는 같은 관계 version/CAS/감사/영수증 경계를 따른다. 소유 UI는 구조화된 계산식/조건을 수신자의 편집 가능한 사본으로 제공한다는 명시 확인을 요구한다.

## 재사용 흐름

기존 StudioRemixService의 template/preview/remix에 서버 내부 resolver를 주입할 수 있게 하며 기존 게시 resolver는 기본값 그대로 유지한다. 새 `/studio/received` 경로는 필수 JWT·no-store를 적용한다. 서버는 current active delivery/allowCopy·조직/유일 소유권·모든 원본 소스 read를 확인한다. Studio의 검증된 현재 문서/표준 지표/원본 native schema로 제한 template를 캡처한다. 임의 SQL을 추론하지 않고 기존 미지원 블록/명시 제외 계약을 유지한다.

reference는 조직/소유자/분석/관계 version과 문서·schema·파일 revision·template의 digest에 묶인 내부 식별자다. 익명 capability가 아니며 매 template/preview/save와 transaction 저장 뒤에도 현재 권한/정의를 확인한다. 정의/허용 변경은409 또는403이며 이미 저장한 수신자 사본은 독립이다. 기존 복제 영수증과 새 소스 소유권/파일 버전/모든 폭 새 블록 ID/원자 rollback을 재사용한다. 중지 후 새 복제는 막고 사본 소유자의 직접 열람은 유지한다.

## 화면·검증

공유 설정에 접힌 복제 허용 확인을 추가한다. 받은 자료에서 허용한 경우에만 ‘내 소스로 복제’로 이동하고 기존 Studio 소스 선택·미리보기/저장 화면을 재사용한다. 기존 게시 복제와 사내 받은 자료의 제목/돌아가기 경로를 구분한다. 도구32px/기존 Studio UI Kit·긴 글 wrap/min-w-0을 유지한다.

실제 SQLite/DuckDB로 미허용/타인/소스·정의409·preview쓰기0·내 소스 oracle/새 ID/원본 보존·동일 저장 영수증·복제 허용/조회 회수 후 새 복제 거절과 기존 사본 유지·기존 게시 복제 회귀를 검증한다. FE 명시 허용/동일 재시도/받은 자료 버튼·private API 라우팅/미리보기/저장 이동과 type/lint/build/core를 실행한다. 실제 Ego96 사용자 제어권·실휴대폰/MySQL·사람 수용은 NOT_RUN으로 남긴다.
