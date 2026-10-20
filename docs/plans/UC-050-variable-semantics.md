# UC050 업무 변수 유형·날짜 형식

FR015·NFR005/006/007·TC050 E01의 후속이다. 실제 목표 전체와 [완료 계획](enterprise-completion.md)은 유지한다. 기존 source_catalog_entry 추가 전용 버전과 권한/미리보기/명시 확인/CAS를 확장한다. 저장 준비에서 날짜를 확인하고 쓰기 큐 안에서는 동일 불변 파일 버전·현재 권한을 재확인하여 중복 전체 스캔을 피한다. 이 단위는 변수 사전의 검증·보존과 Explore/Studio 공통 표현이며 기존 SQL/AI 계산 자동 재작성은 아니다.

## 계약

열별 optional businessType(auto/number/category/date), dateFormat(빈 문자열/native/YYYY-MM-DD/YYYY/MM/DD/YYYYMMDD), classification(공백 정리·NFKC·최대80자)을 추가한다. auto는 원본 유형을 따른다. number는 실제 수치 열, category는 스칼라 범주 열, date는 실제 DATE/TIMESTAMP 또는 VARCHAR 열에만 허용한다. 수치 원본을 날짜로 암묵 변환하지 않는다. 원본 column/type과 업무 유형은 구분한다.

명시 date의 실제 DATE/TIMESTAMP는 native만, 문자열은 세 가지 고정 날짜 형식 중 하나가 필요하다. 그 외 유형은 dateFormat이 빈 값이어야 한다. 문자열 날짜는 실제 전체 데이터에서 null 제외·정확한 형식 왕복과 유효 날짜를 서버에서 검사한다. 열별 invalidCount/blankCount만 집계하고 원본 값은 오류/응답/감사에 반환하지 않는다. 빈 문자열은 NULL과 구분해 오류 건수로 안내한다. 실패는400·저장0이며 데이터 버전 변경은409다. 오류는 INVALID_BUSINESS_DATES 코드와 알려진 열/문자열 건수만 제공한다. 길이/유형/이름/불명 필드 검증과 전체60KB 한도는 유지한다.

이전 저장본의 생략 필드는 auto/빈 형식/빈 분류다. 이전 클라이언트가 새 필드를 생략한 저장은 동일 열의 현재 값을 보존한다. explicit 빈 분류/auto는 명시 변경으로 diff에 표시한다. 새 필드가 잘못된 최신 저장 이력은409로 격리하고 과거 정상 버전으로 대체하지 않는다. 날짜 값 검사는 선언된 date 열에만 수행한다. auto는 기존 계산을 바꾸지 않는다.

classification은 이 버전의 업무 분류 문자열이다. 조직 공통 분류 ID/사전·활성/승인 상태 및 조건/AI가 이 유형으로 실제 실행하는 계약은 후속 UC050/052이며 이 저장을 전체 FR015 완료로 보지 않는다. 활성 상태를 화면 체크박스만으로 구현하지 않는다. 다음 중앙 권한/조회/게시 적용 단위에서 실제로 차단해야 한다.

## 화면·보존

기존 접힌 편집기의 각 열에 추가 설정 details를 둔다. 유형/날짜 형식/분류는 기본36px 입력·32px 도구·14px 본문/12px 보조·min-width0·모바일1열/넓은폭3열을 따른다. 기존 표시명/설명/단위/원본 유형은 유지한다. 수정→전체 diff→동의→정확한 서버 draft 저장→reload를 잇고 수정 후 동의를 해제한다. 400/409/통신 실패·소스 전환·읽기전용·busy에서 초안/권한 경계를 유지한다. Studio 명시 조회에도 원본 형식과 별도로 같은 의미/형식을 표시하고 생성안/질문/SQL에 자동 적용하지 않는다.

## 변경·검증

BE source-catalog service(검증/이력/diff/호환), business-variable 순수 helper, BiService의 권한 보호 날짜 집계. FE SourceCatalogEditor/Changes·공통 변수 표현·StudioSourceCatalog와 테스트. 스키마/의존성 추가 없음.

실제 SQLite 버전/오류0쓰기/옛 클라이언트 보존·손상 이력·권한 회수, 실제 DuckDB 날짜/윤년/잘못된형식/null/문자열/인젝션 열 이름 독립 정답을 검증한다. FE 수정/preview/save/reload·서버 draft·오류/동의/readonly·Studio 표시/질문 보존을 확인한다. 필요한 범위/type/lint/build·기존 core 회귀·독립 리뷰/strict/pin/check/packet·비공개 정보 검사 후 commit/push한다. Ego는 사용자 제어권 미반환으로 BLOCKED이며 새 UI 실제390/768/1440 실측을 자동 검사로 대신하지 않는다. MySQL/실기기/전체 TC050 수용은 별도다.
