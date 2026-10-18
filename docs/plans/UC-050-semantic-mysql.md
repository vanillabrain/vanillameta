# UC050 고정 업무 기준 — 로컬 MySQL 검증

2026-10-18 · 기준305bc9af · FR014/015/018·NFR005/006/008·TC050 E01/E04/E08/E13/E14의 엔진별 검증 후속이다. 전체16개 수용 또는 운영 적용은 아니다.

## 범위와 종료 조건

기존 실제 DuckDB/SQLite Studio 업무 기준 통합 시나리오를 동일한 서비스·명시 소유 MySQL8.4 metadata DB에서 실행한다. 직접 생성의 업무 이름/숫자 범주/문자 날짜·정답60/30/30/40/20, 고정 제안/명시 최신 채택·비대상 native 기본 시간, 원자 저장/영수증·reload·게시/중지·소스 교체·권한/epoch·파일/이력 경계를 검사한다. LLM 응답은 구조화 fixture이며 실제 LLM/화면 통과는 직전 단위의 별도 증빙을 따른다.

새 테스트 전용 Docker 컨테이너/loopback 임의 포트/랜덤 credential·schema·owner marker만 사용한다. 환경 config0600·명시 owner·서버 UUID/버전/DB명/marker를 확인한 다음에만 schema 준비/검사를 한다. 운영 DB·기존 컨테이너·사용자 파일은 변경하지 않는다. 실행 종료 시 label/ID 소유권을 재검사해 이번 컨테이너와 임시 credential만 정리한다. 재연결·두 connection의 실제 InnoDB 잠금/저장 경합과 rollback을 선택 검증한다. 원천 집계는 native DuckDB이며 metadata MySQL 검증과 혼동하지 않는다.

실패하면 제품 차이/테스트 가정/환경 문제를 구분하고 확인된 제품 결함만 최소 수정한다. 같은 고정 테스트의 SQLite 회귀/type/lint/build·독립 검토 후 증빙/UC050/TC050/완료표/AGENTS를 갱신한다. 16개 요건과 E01~E14의 잔여는 코드/증거/미실행/운영/사람 수용으로 구분하며 하위 테스트 수를 전체 완료율로 계산하지 않는다. 비공개 기업 원문·식별자·출처 경로는 공개 Git에서 제외한다. commit/push와 원격 일치를 확인한다.
