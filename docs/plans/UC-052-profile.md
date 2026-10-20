# UC052 전체 분포와 명시 표본 탐색

2026-10-18 · 기준851f0fd2 · FR019·NFR005/006/008·TC050 E05/E08/E13. 전체16개 목표를 유지하며 기존 Source 조건과 Studio의 현재 문서 범위에서 같은 정의의 전체 건수·값 분포·선택 열 표본을 확인한다. 저장/AI/게시/SQL/원본은 바꾸지 않는다.

## 계산과 응답

분모는 Source에서 전체 소스, Studio에서는 현재 기간/기존 공통 필터를 적용한 전체 행이다. 그 안에서 포함 충족/충족 중 제외/최종 건수와 비율을 같은 compiler로 계산한다. 실제 타입의 값별 분포는 전체 행을 그룹 집계하며 전체/포함/제외/최종 각 건수를 반환한다. NULL도 별도 그룹이다. 전체 건수 내림차순/원본 값 순서의 상위20그룹과 나머지 합계를 구분하고 그룹 수·원본 타입의 min/max를 제공한다. 숫자를 DOUBLE로 바꾸거나 표본으로 분포/건수를 추정하지 않는다. 이는 값 빈도 분포이며 연속형 동일 폭 histogram이라고 표시하지 않는다.

사용자가 열1~6개를 명시 선택한 뒤에만 표본을 조회한다. 같은 최종 조건에서 선택 열의 native 값 순서/NULL 우선으로 최대20행을 반환하며 중복은 유지한다. 무작위/대표표본이 아닌 '정렬 표본'과 전체 최종 행수/표시 행수/추가 행 유무를 명시한다. 선택하지 않은 열/조건에 쓰인 숨은 열은 응답하지 않는다. native scalar 값을 문자열로 투영해 BIGINT/DECIMAL/날짜 정밀도를 보존한다. NULL은 null이다. 셀/분포 라벨은 최대200문자와 잘림 표시, 전체 JSON256KiB 한도를 적용한다. binary/array/struct 등 미지원 열은 명시 거절한다. SQL·연결정보/저장 초안/권한 없는 데이터는 반환하지 않는다.

## 경계

Source POST /bi/source-conditions/profile는 기존 draft+columns와 현재 read 권한/metadata sourceRevision/조건 version을 사용한다. Studio POST /studio/dashboards/:id/profile는 current document/expectedRevision/expectedSourceRevision+columns로 dashboard read와 별도 source read를 확인한다. 고정 SQL/검증한 column/filter/date/condition만 조회하고 임의 블록 SQL을 실행하지 않는다. 실제 schema/native type과 파일 pin을 확정 metadata lease에서 캡처하고 긴 집계/표본 SQL은 lease 밖에서 실행한다. 응답 직전 현재 권한·활성·원본 파일/revision(및 Source 조건 version)을 새 캡처로 재검사하며 변경은409/현재 권한 거절이다. inherited pin을 최신 파일 검사로 사용하지 않는다. 새 저장/이력 모델은 없다.

## 화면과 보존

Source의 조건 패널과 Studio의 접힌 범위 탐색에서 열 체크→'분포·표본 조회'를 명시 실행한다. native 열 목록은 권한 보호 조회의 whitelist다. 조건/기간/공통 필터·소스/revision/선택 열 변경은 결과를 무효화하고 늦은 응답은 적용하지 않는다. 읽기는 질문/문서/선택 블록·생성안·undo/저장 상태를 바꾸지 않는다. 실패/취소는 입력을 보존하고 옛 결과를 새 범위로 표시하지 않는다. 전체 분포와 제한 표본의 분모/행수/잘림을 분명히 구분한다. UI Kit36/32px·긴 열명/값 줄바꿈·모바일 한 열·선택 열 표는 가로 스크롤 영역과 설명을 제공하고 페이지 자체 넘침을 막는다.

## 검증과 종료

실제 DuckDB/SQLite의 독립 원본 oracle로 중첩 포함/제외+기간/공통 필터·NULL·중복·0행·상위20+나머지·정밀 DECIMAL/BIGINT·잘림·열 선택/한도·injection·파일/조건 버전/권한/활성/느린 SQL 중 변경을 검사한다. 표본을 모집단 정답으로 사용하지 않는다. FE는 명시 요청/자동 요청0·정확 scope echo·선택/범위 전환/late·오류 입력 보존/읽기 전용·표본/전체/잘림 안내를 검사한다. 기존 조건/Studio 회귀·type/lint/build·별도 Main 검토/문서 동기화·strict/pin/check/packet·비공개 검사 후 현재 develop-v2 commit/push한다. 기존 native 하위 에이전트가 not_found이며 같은 역할 대체는 생성하지 않는다. Ego TaskSpace96은 사용자 제어 중으로 새 실제 Ego/390·768·1440/실기기/운영·이번 MySQL·사람 수용은 NOT_RUN이다. 기존 core/DOM을 해당 증거로 승계하지 않는다.
