# UC052 전체 분포·선택 열 정렬 표본 검증

2026-10-18 · develop-v2 · 기준851f0fd2 · [설계](../plans/UC-052-profile.md). FR019·NFR005/006/008·TC050 E05/E08의 선택 구현이며 전체16개 수용은 미완료다.

## 실제 계약

Source 현재 조건 입력과 Studio 문서의 현재 기간/공통 필터/포함·제외를 읽기만 한다. 분모는 각각 전체 소스 또는 기간·공통 필터를 적용한 전체 행이다. 같은 compiler 정의로 전체/포함/충족 중 제외/최종 건수·비율을 계산하고 실제 native 값별 전체 빈도를 구한다. 전체 빈도 상위20개와 나머지 합계/NULL/그룹 수·min/max를 구분한다. 분포를 표본으로 추정하거나 연속형 동일 폭 histogram으로 표시하지 않는다.

사용자가 선택한1~6열의 같은 최종 조건에서 native 값 순서/NULL 우선 최대20행을 반환한다. 중복은 유지하며 표본의 한도/전체 최종 행수·추가 행·정렬 표본/대표성 없음과 셀200문자 잘림을 명시한다. 값은 native 문자열/NULL로 투영해 BIGINT/DECIMAL/날짜 정밀도를 지키고 미선택 열/연결정보/SQL은 반환하지 않는다. 전체256KiB·미지원 native 열 제한을 적용한다. 불변 관리 파일 경로 hash는 내용 checksum이 아니므로 외부의 in-place 덮어쓰기를 탐지한다고 주장하지 않는다.

Source는 기존 metadata 포함 sourceRevision/조건 version을 사용하고 Studio는 별도 file hash/dashboard revision을 사용한다. 두 값을 서로 비교하지 않는다. 권한/활성·현재 정의와 확정 file pin/schema를 캡처하고 긴 SQL은 metadata lease 밖에서 실행한다. 응답 전 새 metadata 캡처로 권한/현재 기준을 확인한다. 중간 변경은409/현재 권한 거절이며 결과를 최신 값으로 돌려주지 않는다. Studio profile은 임의 블록 SQL이 아닌 공통 범위의 고정 생성 query만 실행한다. 새 영속 모델/AI 요청/저장/게시 동작은 없다.

## 실행 증빙

Git 제외 `.aiwf/evidence/UC052-profile/`의 명령 로그를 사용한다. native worker SQL와 실제 SQLite/JWT HTTP·FE mock 응답을 분리한다.

- 공통 계산/기존 조건20 PASS에서 실제 DuckDB의 NULL/중복·0행/0분모·기간/필터+중첩 포함·제외와 표본 선택 열을 확인했다. 상위20+나머지와 빈도11/9의 숫자 순서,43행 전체·20행 표본, 정확 BIGINT9007199254740993/DECIMAL(30,4) 값·Unicode 잘림·미선택 secret 열 비노출을 확인했다. DECIMAL fixture는 실제 native DECIMAL literal 관계를 사용하며 CSV 자동 DOUBLE 추론에서 잃은 값을 복구했다고 주장하지 않는다.
- 서버 선택4 suites51 PASS는 실제 JWT/SQLite 정책/read grant와 DuckDB 전체 분포/표본을 포함한다. 익명401·타 조직403·읽기 grant 성공/저장 거절·회수 후 SQL0, 집계 중 소스 비활성403/metadata 변경409와 저장0을 확인했다.
- Studio는 미저장 조건+현재 날짜 범위에서 전체1/최종1·Mobile/200 표본을 반환하며 원본 문서/영수증 불변이다. 조회 중 파일 교체409·무권한 SQL0과 느린 집계를 멈춘 동안 독립 metadata 쓰기가1초 안에 완료되는 실제 SQLite 검사를 포함한다.
- FE 선택4 files135 PASS는 명시 선택/조회·자동 요청0·올바른 scope echo/타입·표본/전체 구분·선택 한도/미지원 열·오류/late 응답 보존·Source read-only 연결과 Studio 질문/문서/저장 상태 불변을 검사한다. 정상 Studio 편집 문서는 revision 필드를 별도 expectedRevision으로 보내므로 이 계약에 맞춰 fixture 기대를 정정했다.

초기 helper compile failure는0 tests이며 동작 RED가 아니다. 생성 compiler SQL의 binding을 사용자 SELECT 문법 validator에 넣던 실제 실패는, validator를 완화하지 않고 검증된 base CTE와 내부 compiler fragment를 조합해 수정했다. Jest.each의 빈 배열 행이 done callback으로 해석되던 검사 timeout은 object case로 정정했다. bigint syntax는 기존 target에 맞는 BigInt 생성자를 사용한다. 이 실패들을 최종 통과로 덮지 않는다.

## 별도 Main 검토

독립 에이전트 리뷰를 수행했다고 표시하지 않는다. 별도 Main diff 검토에서 선택 열을 해제/재선택하면 동일 key의 옛 결과가 다시 보이는 반례를 실제 RED1로 확인했다. scope/disabled/선택 변경마다 결과를 완전히 폐기하도록 보완했고 최종 선택4 files136 PASS로 확인했다. 검증 fixture의 공유 zero 객체도 각 응답 복사본으로 고쳐 검증 실패 주입이 다음 사례를 오염시키지 않게 했다. 긴 문자열 공백은 보존하고 NULL을 '값 없음 (NULL)'로 구분한다.

동일 네이티브 값 집계/선택 열만 투영·binding 순서·fresh source 캡처와 읽기 전후 권한을 검토했다. Source 조건 preview는 공통 population parser를 재사용하며 기존 회귀로 수치 계약을 확인한다. 화면 결과 검증은 전체/나머지 합계·샘플 행수/열명/타입·대표성 없음/잘림을 확인한 필드만 투영한다. 새 조건·선택 변경이 저장/질문/undo를 만들지 않는다.

## 미실행과 후속

Ego TaskSpace96 사용자 제어권 반환은 확인되지 않았으며 다른 공간으로 우회하지 않았다. 새 실제 화면의 Source/Studio 조회 여정·390/768/1440 크기/정렬·실휴대폰/키보드·이번 MySQL·대규모 운영/사람 수용은 BLOCKED/NOT_RUN이다. 기존 core나 CSS/DOM을 이 증거로 승계하지 않는다. 값 빈도 표/정렬 표본을 무작위 대표표본·동일 폭 histogram·전체 FR019 수용으로 확대하지 않는다. 이름별 조건 세트·수신자/알림·영속 export·보관과 전체 TC050은 계속 열린다. MK AI 연동은 계속 제외한다.

## 최종 전달 검사

전체 BE158 suites2651 PASS(MySQL opt-in9/1 suite SKIP), 전체 FE117 files1701 PASS다. 이 전체 FE는 위 결과 재등장 수정 전이며 보완 후 최종 선택136개로 재검증했다. 결과를 합산해 새 전체 통과로 표시하지 않는다. 최종 BE/FE type·대상 lint·build는 각각 exit0이다. lint 초기의 미사용/빈 callback·증가 연산 스타일은 정리했고 요청 세대 의미를 바꾸지 않았다.

기존 Chromium core8 PASS(21.6s)는 격리 임시 DB/서버의 로그인·CSV/집계 저장·Explore/Pivot 복원·공유/보호 경로다. 테스트 서버/DB는 실행기가 종료 후 정리했다. 이는 새 분포 화면의 실제 Ego 검증이 아니다. 새 영속 객체가 없으므로 entity/glossary에 별도 모델을 추가하지 않았다. AIWF strict는0 errors/기존 FR011·NFR002 상태 경고2개로 exit1이며 상태를 임의 승인하지 않았다. pin/check·패킷은 내용 추적이며 사람 수용이 아니다.
