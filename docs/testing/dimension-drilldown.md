# 차원 선택 · 원본 상세 탐색

이번 범위는 SSBI-05의 새 탐색 경로다. 기존 기간·파일 저장·개인 보기·AI 생성의 통과 조건은 반복하지 않는다. Codex gpt-6-luna 설정을 유지하며 수동 탐색에는 AI 호출이 없다.

## 계약

서버가 직접 원본 컬럼으로 확인한 범주 차트만 클릭/정확값 표의 버튼으로 공통 필터를 선택한다. 같은 컬럼의 값은 OR, 서로 다른 컬럼은 AND다. 날짜·집계·이전 기간 비교를 유지한다. NULL은 문자열 null과 구분한다. 계산한 차원·시간 버킷의 표시 이름을 원본 값으로 오인하지 않는다.

상세 내역은 **현재 공통 필터와 UTC 날짜에 맞는 원본 행**이다. 임의의 위젯 SQL WHERE/HAVING이나 비율의 분자 기여 내역이라는 의미로 표현하지 않는다. 25/50/100행 단위, 최대 50컬럼을 조회하며 전체 행수와 표시 범위를 구분한다. 파일 버전을 확인하고 count/행 조회를 하나의 immutable snapshot으로 고정한다. 이후 페이지의 버전 불일치는 409로 차단한다. 원본·대시보드 소유권 모두 필요하며 공유 토큰에는 허용하지 않는다. 대시보드 정의는 변경하지 않는다.

## MD 케이스

| ID | 입력·기대 결과 | 상태 |
| --- | --- | --- |
| DRILL-01 | source24의 channel 막대 online 클릭→채널 필터·KPI30·이전10·원본1행(01-12,online,30). 기존 01-11~12/주/비교 유지. 선택 해제→현재50/이전10/원본2행 | PASS_SELECTED_VARIANTS |
| DRILL-02 | 정확값 표의 범주 버튼 Enter/Space 선택, 필터 chip 제거, 상세 열기·표 탐색·닫기 초점 복귀. 390폭 overflow/겹침 없음 | PASS_SELECTED_VARIANTS |
| DRILL-03 | 25행 페이지에서 총수/다음·이전/정렬 안정성, NULL·복수 필터·빈 결과·잘못된 파라미터. 원본 CSV 독립 정답/API 대조 | PASS_SELECTED_VARIANTS |
| DRILL-04 | 타계정/공유 토큰 차단, 소스 변경409·갱신 안내, 조회 실패 안내/재시도, 늦은 응답이 새 조건을 덮어쓰지 않음 | PASS_SELECTED_VARIANTS |
| DRILL-05 | 직접 컬럼 alias만 연결. 계산 차원·시간 버킷은 필터 버튼을 제공하지 않으며 기존 차트 결과 보존. 정의 hash 동일 | PASS_SELECTED_VARIANTS |

## 환경·증빙

Node24.21.0, FE3483/API4683, 기존 metadata DB + DuckDB worker. Aside guide/guide repl 후 daemon 인증 challenge 실패·미실행을 확인했다. 이전에 허용된 실제 headed Chromium으로 검증한다. 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dimension-drilldown/`.

## 실제 결과

기존 source24/dashboard26의 channel 막대를 실제 마우스로 클릭했다. 01-11~12·주별·이전 기간 비교를 유지하며 online의 현재30/이전10/증감20/200%와 원본01-12 online30의1행이 일치했다. 원본 week1.csv의 Python Decimal/행 선택 oracle와 대조했다. 기존 대시보드 정의 revision은 변경 전후 동일하다.

새61행 CSV fixture(source25/dashboard29)는25·25·11행의 페이지별 ID1~25/26~50/51~61이 원본과 빠짐없이 일치했다. 실제390폭에서 표 영역310/scrollWidth600으로 내부 스크롤되며 문서390/viewport390이었다. ArrowRight로 scrollLeft63이 변하고 Enter로2페이지를 열었다. NULL을 문자열 null과 별도 버튼으로 선택했으며 NULL+North의 두 컬럼 AND 필터가 원본id1/값1/1행과 일치했다. 빈 결과는 API와 하위 렌더링 검사로 확인했다.

원본·대시보드 타계정 요청403, 잘못된 필터400, stale sourceRevision409를 실제 API로 확인했다. 공유 토큰 차단은 새 guard 하위 검사다. UI503/409는 브라우저 route fixture이며 실제 서버 장애/파일 교체라는 의미가 아니다. 안내/재시도 후 같은 날짜·주별·비교 상태와 정상 원본 행으로 돌아왔다. 늦은 응답·조건 변경/닫기·파일 snapshot 고정은 하위 검사로 대조했다.

## 오류 수정 · 선택 검사

범주 버튼의 조회 중 native disabled와 행 index key 때문에 키보드 초점이 BODY로 사라졌다. aria-disabled/동작 차단·타입별 안정 key로 바꾸고 실제 Enter/Space 및 NULL 버튼의 포커스 유지를 재검증했다. 제거한 필터 칩은 조회 성공 뒤 상세 버튼으로 복귀하며 사용자가 다른 곳으로 이동하면 복귀하지 않는다. 오류409 재조회는 MUI의 자동 초점 복귀 직후 버튼이 native disabled가 되어 BODY로 이동하는 실제 동작을 재현했다. 상세 버튼도 aria-disabled와 동작 차단으로 변경해 조회 중 초점이 유지되도록 수정했으며 1200ms 지연 재조회에서 pending/final 모두 상세 버튼 포커스가 유지됐다.

특수 컬럼 __proto__는 DuckDB object adapter에서 값이 누락되는 것을 실제 CSV/API로 재현했다. 상세 쿼리에 안전한 위치별 alias를 사용하고 Object.fromEntries로 원래 컬럼명을 복원했다. own-property 조회와 Select의 배열 검사로 __proto__/constructor 문자열·NULL·0을 보존했다. 실제 source26/dashboard30 모바일 표에 actual이 표시된다. 페이지당 행 수의 모바일 잘린 라벨은 최소 너비와 줄바꿈으로 보정했다.

신규 BE92개(직접 차원33·원본 상세42·새 guard17)와 FE47개(원본 상세/통합38·차트 선택9)의 선택 검사 통과. FE 타입·변경 파일 lint·production build, BE nest build·변경 파일 lint, diff check 통과. 전체 기존 MD/E2E·139만 행/Rill·AI 생성 통과는 반복하지 않았고 이번 통과에 더하지 않는다. 실제 VoiceOver, 시간 차트 클릭으로 버킷 기간 변경, 위젯별 기여 행/피벗·고급 탐색·대규모 원본 페이지 성능은 후속이다.

최종 화면: drill-final-desktop/mobile.png, details-final-desktop/mobile.png, null-and-region-mobile.png, pagination-wide/second-mobile.png, magic-columns-mobile.png. oracle-assertions/keyboard-categories-after/stale-focus-after/definition-preserved JSON과 API/CSV를 구분해 보관한다. 초기 캡처에는 개발 중 선택창 전환/잘린 라벨이 포함되므로 최종 캡처를 정상 증빙으로 사용한다. 외부 verification-results.json에 최종 커밋·파일 hash·환경·범위를 기록한다.

검증을 위해 만든 dashboard28/29/30와 source25/26만 API200/SUCCESS로 정리했다. 원본 CSV·응답·화면 증빙은 보존하고 기존 source24/dashboard26 및 다른 검증 자원은 유지했다.
