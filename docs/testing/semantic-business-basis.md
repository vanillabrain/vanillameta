# UC050 신규 생성의 고정 업무 기준

2026-10-18 · [계획](../plans/UC-050-semantic-business-basis.md) · FR015(보조 FR014/018)·NFR005/006/008·TC050 E01/E04/E08/E13/E14의 선택 구현·검증이다. 전체16개 요건/TC050의 수용 완료가 아니다.

## 구현과 경계

새 직접/AI 지표·차원은 서버가 정확한 카탈로그 이력과 실제 schema로 검증한 업무 기준을 고정한다. 숫자 범주는 차원/개수에 사용하고 새 산술 피연산자로 거절한다. 세 고정 문자열 날짜 형식은 같은 서버 표현식으로 날짜별 집계와 KPI 추세를 만든다. 기존 native 저장 지표를 최신 선언으로 재해석하지 않는다.

전체 제안/비공개 작성 ROOT는 전체 문맥, 지표·차원·블록 snapshot은 사용 열과 숫자 블록의 고정 기본 날짜만 보존한다. `defaultDateColumn` 생략은 기존 자동 선택, null은 기본 시간 축 없음이다. 첫 카탈로그 채택 때 비대상 native 블록도 이 차이를 유지한다. 새 제안/명시 채택 중 기준 변경은409이고 고정 V1 제안은 V2 등록 후에도 사용할 수 있다. 별도 저장 실행 중 최신 기준이 바뀌면409이며 질문/기존 제안은 보존한다. 소스 조건의 업무 의미는 별도다.

전체 날짜 검사/SQL은 metadata 큐 밖의 고정 파일에서 실행한다. 조회와 저장에서 현재 actor/epoch/조직·소스 권한·파일·정확한 이력을 재검사한다. 공개 AI/Studio 생성 요청은 JWT의 신뢰된 authVersion(legacy 생략은0)을 전달하며 저장 대기·영수증 재확인 전후에도 검사한다. 실제 epoch0 저장 후 DB epoch1로 변경한 뒤 이전 token0의 질문/기존 영수증 확인도401이며 저장 행 수는 불변이다. 재사용 지표 이력의 DB 장애는 후보를 조용히 삭제하거나 새 지표로 대체하지 않고 실패한다. 저장 영수증 재확인은 추가 SQL/생성 없이 기존 결과를 확인한다.

게시 안전 증명은 정확한 서버 집계식 대조이며 contribution drilldown 지원과 분리한다. 파싱 날짜의 상세 기여도는 지원하는 것으로 표시하지 않는다. 공개 snapshot에는 SQL/전체 schema/분류 ref를 넣지 않는다. 복제는 사용 열을 대상의 현재 기준에 다시 묶고 실행 의미가 다르면 차단한다. 원본/미대상 블록을 보존한다.

원천 열 단위는24자, 기존 Metric 표시 단위는12자 한도를 유지한다. 상속 단위가 Metric 한도를 넘으면 입력을 보존하며 명시 수정하도록 거절하고 자르지 않는다.

## 자동·실행 증빙

기록은 `.aiwf/evidence/UC050-semantic-business-basis/`에 있다. 중복 실행은 합산하지 않는다.

| 실행                          | 결과                            | 로그                                                                     |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| BE 선택20 suites              | 481 PASS /33.063초              | `backend-selected-final-network.log`                                     |
| 검토 수정 영향6 suites        | 161 PASS /19.919초              | `review-fixes-tests-network.log`; 위 배치와 중복, 새 경합/장애 검증 포함 |
| 실제 SQLite/DuckDB runtime    | 37 PASS                         | `runtime-final.log`; 위 배치 포함                                        |
| 세 날짜 형식·NULL·정밀도·추세 | 51 PASS                         | `trend-tests.log`; 위 배치 포함                                          |
| BE 후속 type/lint/build       | exit0                           | `review-{types,lint,build}.log`                                          |
| 신뢰된 JWT epoch 전달 후속    | 2 suites80 PASS/type/lint/build | `epoch-stale-{tests,types,lint}.log`와 `epoch-build.log`; 위 배치와 중복 |
| FE 통합 선택                  | 13 files182 PASS                | `fe-final-tests.log`                                                     |
| FE ROOT 경계 후속             | 6 files118 PASS                 | `fe-root-tests.log`; 앞 배치 중복                                        |
| FE 기본 날짜 보존 후속        | 7 files124 PASS/type/lint/build | `fe-date-{tests,types,lint,build}.log`                                   |
| FE SVG 수정 영향              | 5 files98 PASS/type/build       | `fe-resize-{tests,types,build}.log`; lint는 `fe-resize-lint-stable.log`  |

실제 DuckDB/SQLite에서 숫자 범주101/102·금액10/20/30의 원본 독립 SQL과 컴파일 결과 총합60·날짜30/30·범주40/20을 대조했다. 전체 날짜 검사·표본 밖 invalid/빈 값·윤일/NULL·큰 DECIMAL·역사 이력·저장/reload·게시·대상 소스 재연결을 선택 검증했다. 실제 서비스 SQL 이후 epoch/계정·조직·파일 변경과 저장 충돌은 기존 행을 보존한다.

## 실제 화면

최종 `ui-core-stable/playwright-001.log`는 실제 Codex 생성/게시를 포함한 핵심8개 PASS/27.3초(새 흐름13.7초)다. 직전 `ui-integrated-final/playwright-001.log`: 실제 Codex 질문→숫자/문자 날짜 선/숫자 범주 막대3개 제안→전체 미리보기→Studio 저장→reload→비공개 게시/복제 허용→고정 snapshot/템플릿 조회→게시 중지410, 1 PASS/11.5초다. 실제 원본 집계60·추세30/30·막대40/20과 공개 응답의 업무 schema/SQL 비노출을 확인했다. 합성 데이터/격리 계정만 사용했고 검증 게시본은 중지했다.

390/768/1440에서 직접 생성·제안·저장·게시 화면을 캡처하고 control36px·입력900px 미만16px/desktop14px·가로 넘침0을 검사했다. 초기 모바일 SVG가 이전 너비를 유지한 오류는 명시 ResizeObserver/초기 resize로 수정했다. SVG 자체의 너비를 검사하며390에서 컨테이너/SVG326px 일치를 확인했다. 저장 화면의 loading 캡처는 toolbar 준비 대기로 보완했다. 이전 가로 넘침0/빈 canvas 검사는 SVG 정렬의 통과 증명이 아니다. 최신 `ui-chart-fixed`와 `ui-core-stable` 캡처를 우선한다.

## 검토와 실패 기록

기본 executor/reviewer/test-engineer가 provider 사용량 제한으로 중단되어 지정된 역할 fallback(Devin transport의 Claude Haiku)을 사용했다. 제품 생성은 실제 Codex 경로이며 fallback 검토를 제품 LLM 통과로 대체하지 않았다.

초기 kernel3 실패는 크기 한도 테스트 표본 수정 후12 PASS다. 초기 AI 선택의 존재하지 않는2개 spec 경로는 실제 service spec으로 교정했다. 초기 타입 실패/ROOT·날짜 보존 통합3 실패는 후속 실행으로 해소했다. UI의 builder/제목 누락, 빌드 중 시작한 서버, SVG 검사 대상/준비 대기 오류는 각 원본 로그에 남겼다. EPERM loopback 테스트는 허용된 로컬 네트워크 실행에서 통과했다. 중간 E2E 정리 중 문법/format 진단도 최종 lint에서 수정했다.

검토에서 확인한 복제 블록의 미사용 metadata, reuse 후보 조회 DB 장애 은폐, 저장 SQL 중 카탈로그 변경을 수정했다. 오래된 제안 자체의 사용과 실행 도중 변경을 구분하고 기존 역사 저장 테스트를 유지했다. 날짜 proof cache는 현재 권한을 캐시하지 않으며 고정 파일 실행 후 새 파일/권한을 확인한다.

## 남은 수용

이번 단위의 실제 MySQL·Ego96 사용자 제어권 인수·물리 휴대폰/멀티터치·운영·모든 자연어/장애 조합·사람 업무 수용은 NOT_RUN이다. headless Chromium 폭 검증을 실제 Ego/휴대폰으로 승계하지 않는다. E01/E04/E08/E13/E14의 위 선택 증거와 전체 E01~E14/16개 수용을 구분한다. 새 테이블/DDL은 없으며 이전 단위 MySQL 결과를 이번 단위에 승계하지 않는다.
