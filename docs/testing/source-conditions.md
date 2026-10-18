# UC052 소스 조건·전체 모집단 검증

2026-10-18 · develop-v2 · 기준48fa3d7f · [설계](../plans/UC-052.md). FR018/019·NFR005/006/007/008·TC050 E04/E05 기반이며 전체16개 수용은 미완료다.

## 실제 구현

소스 탐색의 접힌 조건 패널에서 포함/제외 트리를 편집하고 전체 모집단 건수를 미리보기한 후 정확한 입력을 명시 저장한다. 실제 원본 유형·고정 연산자·중첩/노드/값/크기 한도를 서버 검증하고 값은 바인딩한다. NULL 비교는 false이고 NULL을 찾는 연산자는 별도이므로 제외 true 행만 제거한다. 시계열은 UTC, DATE는 civil date이며 세션 시간대 추측을 하지 않는다. 현재 Studio/기존 필터·게시·공유 결과에는 자동 적용하지 않는다.

미리보기는 전체·포함충족·충족 중 제외·최종 건수와 전체 대비 두 비율을 반환하고 전체0은 비율null이다. 소스 read/edit 정책과 활성 상태를 검증하며 권한 전에 연결 snapshot/집계를 실행하지 않는다. 권한·소스 metadata·조건 entry·연결 캡처를 공통 metadata lease에서 고정하고 DESCRIBE/집계는 lease 밖에서 실행한다. snapshot 집계 후 현재 sourceRevision/조건 version과 read 권한을 이전 snapshot에 묶이지 않는 새 캡처로 다시 확인한다. 변경 중 집계는409 또는 현재 권한 거절로 종료한다. 저장은 sourceId/version 복합 PK append CAS로 actor/원본 revision과 정의를 보존한다. 실패 시 기존 데이터/조건 저장0, 임의 SQL·원본 행·연결정보 응답0이다.

## 실행 증빙

Git 제외 `.aiwf/evidence/UC052-source-conditions/`의 명령별 로그를 사용한다. 서비스 RED는 미구현 모듈의 compile failure로 검사0이며 동작 결함을 재현한 것으로 표현하지 않는다. 컴파일러/화면 parity의 별도 RED와 GREEN은 해당 로그를 따른다. 순수 컴파일러 실제 DuckDB worker와 독립 JS oracle, 별도 SQLite/JWT HTTP/정책/실제 DuckDB 경로, FE mock API 검사 범위를 구분한다. 최종 수치와 리뷰 결과는 아래에 기록한다.

Rill 공식 [Filters & Comparisons](https://docs.rilldata.com/guide/dashboards/filters)는 차원 선택/제외·필터와 다른 뷰 상태의 연결을 설명한다. 포함/제외를 명시하는 방향을 대조했으며 Rill과 현재 앱의 실제 화면 동등성을 검증한 결과는 아니다. 새 중첩 트리는 현재 추가 업무 요건이며 Rill에 동일 편집 UI가 존재한다고 추정하지 않는다.

## 남은 경계

Ego TaskSpace96은 사용자 제어 중으로 제어 반환 전 실제 Ego/390·768·1440 크기/정렬·키보드 UI는 NOT_RUN이다. CSS/DOM 단위 검사·기존 headless core를 이 검증으로 승계하지 않는다. 실제 FE↔BE 브라우저 여정·물리 기기·이번 단위 운영 MySQL/기존 데이터·사람 수용은 별도다.

현재 공통 저장은 소스별1개 버전 조건이다. 여러 이름 세트·Studio/AI 제안 차이·분포/표본·시간대/기간/지표 문맥과 출력·영속 저장 영수증 복구는 후속이다. 저장 후 응답 유실은 입력을 유지하고 명시 최신 조회로 반영 여부를 확인하며 자동 재저장하지 않는다. 소스 교체 후 저장 정의가 현재 열과 맞지 않거나 손상된 경우409이며 자동 폐기/추측 변환하지 않는다.

기존 DuckDB worker의 SQL 세미콜론 거절 가드는 유지한다. 세미콜론이 포함된 식별자의 escape 안전성은 소유 fixture의 직접 DuckDB 연결에서 검사했으며 실제 worker 지원으로 표시하지 않는다. 운영 보호 가드를 넓히지 않는다.

## 독립 검토 후 보완

첫 독립 검토는 세 가지 Medium으로 변경 요청했다. TIMESTAMP_NS→TIMESTAMPTZ 변환이1ns/2ns를 구별하지 못하는 실제 반례, SQLite 권한 조회 뒤 미커밋 연결을 pin해 rollback 열을 반환하는 합성 재현, read409인 손상 정의에 save가 새 버전을 추가하는 실제 반례다. 이를 전체 기능 승인의 근거로 삼지 않고 수정 대상으로 기록했다.

Native TIMESTAMP_NS는 ISO 정의를 유지하되 바인딩은 정확한 epoch ns 문자열과 make_timestamp_ns를 사용하고, 지원하는 유한 구간(-9223372036854775806~9223372036854775806) 밖은 저장/실행 전에 거절한다. 다른 timestamp는 후행0 제거 후6자리를 초과하면 거절한다. DECIMAL 비교를 DOUBLE로 승격시키거나 입력을 원본 scale로 반올림하지 않도록 양쪽을 보존하는 공통 DECIMAL binding을 사용한다. 안전 정수 경계는 명시 정수 binding으로 큰 원본 값을 잘못 동일시하지 않는다. 화면 숫자 입력도 Number 변환에서 원래 십진 값이 변하면 교정을 요청한다.

공통 ConnectionService에 확정 metadata snapshot 캡처를 추가하고 UC052가 기존 Bi.profile의 미커밋 metadata/연결 조회에 의존하지 않게 했다. 실제 SQLite rollback 대기·이전 pin 안의 fresh capture·느린 SQL 중 독립 metadata 성공을 검사한다. prepare/저장 직전 모두 기존 정의를 검증해 손상 상태에서 read/preview/save409·추가 버전0이다.

## 최종 검사

최종 서버 선택7 suites/215 tests(compiler130·서비스/HTTP/확정 연결18과 기존 연결/카탈로그 회귀)와 화면 관련123 tests(새 조건57개 포함) PASS다. 독립 검토자는 기존 Medium3건의 수정 범위만 CLEAR로 확인했다. 이후 NS 유한 구간은 실제 RED7개→GREEN130개와 Main 통합 선택 검사로 확인했으며 별도 전체 구조 승인으로 표시하지 않는다.

앞선 전체 BE151 suites/2550 tests PASS(MySQL opt-in9 skip), 전체 FE1639 PASS는 이후 정밀도·확정 연결·저장 응답 검증 보완 전 실행으로 구분한다. 최종 보완은 위 선택 회귀/type/lint/build로 확인하며 이 숫자를 합쳐 전체 완료율로 계산하지 않는다. 최종 빌드·기존 핵심 브라우저와 문서 검사 결과는 아래에 기록한다.

최종 BE/FE type/lint/build는 exit0이다. 최종 빌드의 기존 Chromium core8개 PASS는 로그인·CSV 집계/저장·Explore/Pivot 복원·위젯/대시보드·공유/임베드·보호 경로이며 새 조건 화면의 Ego 실행은 아니다. AIWF strict는 기존 FR011/NFR002 상태 경고2개·0 errors로 exit1이며 상태를 임의 승인으로 변경하지 않았다.
