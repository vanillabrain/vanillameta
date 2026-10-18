# UC050 업무 기준을 사용하는 새 지표·차원 생성

2026-10-18 · 기준 e763aee3 · FR015/FR014/FR018·NFR005/006/008 · TC050 E01/E04/E08/E13/E14. 전체16개 완료 목표의 후속이며 MK AI 연동은 제외한다.

## 사용자 결과

업무 표시명·수치/범주/날짜·날짜 형식·단위를 저장한 소스로 직접 지표/차원을 선택하거나 AI에 질문하면 같은 의미의 새 분석을 만든다. 숫자 코드의 범주 선언을 SUM하지 않고 분류로 쓰며, 고정 형식 문자열 날짜도 추세로 쓴다. 전체 미리보기→원자 저장→새로고침→게시/복제·소스 교체까지 계산 의미를 유지한다. 기존 native Metric/제안·분석을 최신 metadata로 재해석하지 않는다.

## 고정 업무 기준

선택적 businessBasis는 서버가 해당 소스의 정확한 SourceCatalogEntry 이력과 실제 schema로 만든다. 필드는 schemaVersion:1, catalogVersion:양의정수 또는 null(native), schemaRevision, columns다. 열은 column/nativeType/label/description/unit/businessType/dateFormat/classification과 선택적 classificationRef를 담는다. SQL/표현식을 받지 않는다. nativeType과 schemaRevision은 실제 schema에서 재검증하며 카탈로그의 단위/이름/선언/분류 ref와 일치해야 한다. null은 명시 native 기준이며 기존 basis 없는 정의도 native로 유지한다.

AI/직접 생성 문맥은 전체 schema의 같은 업무 투영을 사용한다. 제안과 비공개 작성 문맥에는 전체 기준을 고정해 기본 시계열 열 선택과 날짜가 아닌 범주 선언도 보존한다. 새 Metric/차원/블록 snapshot에는 각 정의가 사용하는 열과 숫자 블록의 고정 기본 날짜만 보존한다. `defaultDateColumn` 생략은 기존 자동 선택, null은 기본 시간 축 없음이며 첫 카탈로그 채택 때 비대상 native 블록도 보존한다. 공개/수신자 mapping 응답에는 실제 사용 열만 투영한다. 미선택 열 설명을 공유/게시 recipe에 자동 포함하지 않는다. 계산 identity에는 사용 열의 실행 의미를 포함하며 표시명/미사용 열 수정 때문에 원래 계산을 다른 계산으로 추측하지 않는다. catalogVersion은 Metric.definitionVersion이나 실제 파일 버전을 대신하지 않는다.

새 생성은 현재 기준을 서버가 확보하고 LLM/SQL 뒤 변경이면409다. parent 제안 수정은 검증된 고정 기준을 유지한다. 최신 기준 채택은 명시 동작으로 새 제안/digest·전체 미리보기를 만들며 실패하면 이전 질문·제안을 보존한다. 이미 고정된 역사 기준은 정확한 이력/schema가 유효하면 최신 metadata 변경 후에도 보존한다. 파일/schema·Metric 실제 버전·현재 권한/epoch는 실행과 저장 전후 재검사한다. 현재 source 조건은 별도이며 자동 채택하지 않는다. 역사 제안의 명시 저장은 허용하지만 저장 실행 시작 당시 최신 기준과 최종 transaction의 최신 기준이 다르면409다.

## 공통 실행과 생성

- auto/basis 없음: 기존 native 동작 유지.
- number: 실제 numeric 검증 후 기존 정밀 집계/비율·가중치 규칙 유지.
- category: 숫자 코드도 차원으로 허용하고 native 값 정밀도를 유지한다. COUNT_DISTINCT/COUNT는 허용하되 SUM/AVG/MIN/MAX와 비율·가중치 피연산자로 새 생성하지 않는다.
- date: native/세 고정 VARCHAR 형식을 날짜 차원으로 사용한다. 전체 값의 유효 날짜·빈 값·NULL은 기존 공통 검증과 구별한다. SELECT/GROUP BY/정렬·시간 추세가 같은 서버 표현식을 쓴다. 산술 집계의 새 피연산자로 쓰지 않는다.
- 표시명은 SQL 식별자로 쓰지 않는다. 물리 이름과 업무 이름을 같이 제공하고 모호한 매핑은 질문으로 확인한다. 단위는 금액 등에만 기본 승계하며 개수/비율에 원본 단위를 덮어씌우지 않는다. 원천 열24자/기존 Metric12자 한도를 구별하며 상속한 값이12자를 넘으면 명시 수정하도록 거절하고 자르지 않는다.

새 지표는 기존 직접 BiService 생성과 semantic 제안/Studio 생성에서 같은 validator/compiler를 사용한다. 저장 Metric 재사용은 그 정의의 native/frozen 기준으로 실행하며 새 제안 basis를 덮지 않는다. 새 Dimension CRUD를 별도로 요구하지 않으며 기존 차원 snapshot/배치/참조 계약에 실행 의미를 보존한다.

## SQL·저장·소비자 경계

임의 함수 허용 목록을 넓혀 날짜 파서를 통과시키지 않는다. 정확히 검증한 basis에서 서버가 만든 고정 날짜 표현식만 기존 SELECT grammar에 연결하고 임의 SQL·schema·파일 접근을 거절한다. private draft/Metric/Studio 정의와 안전 집계 증명·추세 추출·게시 snapshot·remix template을 함께 연결한다. public 응답에는 기존 숫자/추세만 반환하며 SQL/업무 전체 schema/분류 사전은 공개하지 않는다.

소스 교체는 실제 사용한 열의 실행 의미를 대상 schema/현재 카탈로그와 비교한 뒤 대상 기준으로 새로 묶는다. 불일치하면 기존 질문/제안/선택을 보존하고 명시 수정하도록 차단한다. 원본 기준/분류ID를 대상에 자동 이관하지 않는다. 기존 layout/블록ID·미대상 내용은 유지한다.

SQL/전체 날짜 검증은 metadata queue 밖에서 고정 파일로 실행한다. 최종 transaction에서는 현재 actor→Source→Metric 잠금과 기준을 재검사하고 원자 저장한다. 기존 requestId/영수증·응답 유실/취소·reload 복구를 유지한다. 한도 초과는 명시 거절하며 기준/열을 자르거나 native로 fallback하지 않는다.

## 검증과 종료

숫자 범주101/102와 금액10/20/30, 세 고정 형식 날짜·NULL의 독립 SQL로 총합60·날짜별30/30·범주별40/20을 확인한다. 직접/실제 AI 제안·전체 미리보기·저장/reload·게시/소스 교체가 같은 결과여야 한다. category SUM/잘못된 연산·표본 밖 invalid/빈 날짜/잘못된 윤일은 쓰기0이다. v1 제안 뒤 v2 편집에도 저장 지표/제안은 불변이며 새 생성은v2, 명시 최신 채택은 새 digest다. LLM/SQL/최종 저장 사이 catalog/file/Metric/권한/epoch 변경과 동일 요청 재확인·rollback을 검사한다. 기존 native 정답 회귀·실제 화면390/768/1440 크기/정렬·별도 검토·AIWF strict/pin/check/packet 후 commit/push한다. 실행 범위는 증빙에 기록하며 Ego/실휴대폰/운영·사람/전체16개 수용을 자동 통과로 표시하지 않는다.
