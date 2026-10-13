# 차트 집계 입력 행 상세 탐색

후속 구현: [KPI 미니 추세 시점별 입력 행](kpi-point-contributors.md). 아래 기록 당시 남았던 현재 KPI 시점 상세를 구현·선택 검증했다. 이전 기간 상세·복잡한 SQL·대규모 성능·VoiceOver는 그대로 후속이다.

기존 DRILL/TIME 및 AI 통과 케이스를 반복하지 않고 위젯별 집계 입력 행의 새 조건만 검증한다. Codex `gpt-6-luna` 연결은 유지하며 수동 탐색에는 모델 호출이 필요하지 않다.

## 계약

공통 필터 원본 상세와 차트 집계 입력 상세를 구분한다. 집계 상세는 저장된 대시보드 정의·파일 버전·선택한 차트·현재 필터·기간·집계 단위를 확인하고 차트 자체 WHERE를 함께 적용한다. 전체 차트는 실제 표시된 그룹만, 항목 상세는 선택한 실제 그룹만 조회한다. 값 0·음수·같은 값의 서로 다른 물리 행을 보존한다.

SUM/AVG/COUNT(표현식)/MIN/MAX는 해당 표현식이 NULL이 아닌 입력 행, COUNT(*)는 조건에 맞는 모든 행, COUNT_IF는 참인 행을 표시한다. MIN/MAX의 상세는 극값 행만이 아닌 집계에 입력된 비NULL 행이다. 여러 집계로 만든 비율·가중 평균은 각 입력의 합집합이며 어느 집계에 참여했는지 행별로 표시한다. 이는 인과적 영향이나 환불 주문과의 조인 계보를 뜻하지 않는다. DISTINCT/HAVING/window 및 안전하게 추적하지 못하는 SQL은 지원 제한을 안내하고 공통 원본 행으로 바꾸어 성공처럼 표시하지 않는다.

## 선택 명세

| ID | 입력·기대 결과 | 상태 |
| --- | --- | --- |
| CONTRIB-01 | 13행 CSV, accepted=true WHERE. 총매출560·입력10행. 온라인340·8행, 값0/음수/중복50 보존, NULL amount·accepted=false 제외 | PASS_SELECTED_VARIANTS |
| CONTRIB-02 | 채널 TOP2 실제 표시 그룹의 입력9행; 선택 online8행/retail1행. NULL 그룹을 표시하는 별도 범위에서는 id9만. 표시하지 않은 그룹을 위조 선택하면 거부 | PASS_SELECTED_VARIANTS |
| CONTRIB-03 | 환불 비율56/560=0.1, 입력11행; 가중 평균1240/16=77.5, 입력10행. amount NULL인 id3는 각각 환불·분모에만 기여. COUNT(amount)=10 vs COUNT(*)=12. 지원 불가 SQL 안내 | PASS_SELECTED_VARIANTS |
| CONTRIB-04 | online+02-29 UTC 기간: 매출190/5행·비율19/190 입력6행·가중290/9 입력6행. 주·월 재집계 선택과 원본 WHERE/기간 교집합, 원본 정의 revision 불변 | PASS_SELECTED_VARIANTS |
| CONTRIB-05 | 저장 정의 변경/파일 버전 변경409·소유권·선택 위조 거부, 조회 실패→재시도/새로조회. 늦은 응답이 다른 차트/항목 상세를 덮지 않음, 페이지·안전한 컬럼 전송 | PASS_SELECTED_VARIANTS |
| CONTRIB-06 | 실제1440/390 화면. 차트 버튼·정확값 표의 항목 버튼 Enter/Space, 상세 Tab/스크롤/Escape·원래 버튼 초점 복귀. 문서 overflow 없음, 표 가로 스크롤은 이름 있는 영역 내부 | PASS_SELECTED_VARIANTS |

## 환경·증빙

Node24, FE3483/API4683, 기존 metadata DB·서버 DuckDB worker를 재사용한다. Aside guide/guide repl 후 로컬 daemon 인증 challenge 실패 및 미실행을 확인했다. 이전에 허용된 실제 headed Chromium 대체 검증을 사용한다.

증빙 폴더는 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/aggregate-contributors/`다. `contributions.csv` 13행과 Python Decimal `oracle.json`을 별도로 계산해 실제 API 및 화면을 대조한다. 기존 source24/dashboard26의 데이터·정의는 변경하지 않는다. 테스트용 새 소스·대시보드만 종료 시 정리한다.

실제 VoiceOver, 대규모 상세 성능, 복잡한 SQL 계보, 이전 기간 상세, Rill/LLM 생성은 이번 선택 범위 밖이다. 미실행은 통과로 보고하지 않는다.

## 실제 결과 — 2026-10-13

CONTRIB-01~06의 선택 조건은 **PASS_SELECTED_VARIANTS**다. `api-oracle.json`의 실제 API17조건이 별도 Decimal 정답과 수치·row_id 모두 일치했다. 전체 매출560/10행, 채널 TOP2의9행(online340/8행·retail200/id5), 환불 비율0.1/11행, 가중 평균77.5/10행이다. id3는 amount가 NULL이라 SUM(amount)에는 없지만 SUM(refund)와 SUM(weight)에만 참여한다. amount=0과 -10, 같은 금액50의 id2·id12를 모두 보존했다. NULL 그룹 선택은 API에서 id9만 반환했다. COUNT(amount)=10, COUNT(*)=12, COUNT_IF(amount>0)=8, MIN(amount)=-10/비NULL 입력10행도 일치했다.

online+02-29는190/5행(id1,2,4,11,12), 환불 비율19/190 입력6행, 가중290/9 입력6행이다. 일·주·월 재집계 그룹을 실제 반환값으로 선택한3조건 모두 같은5행을 반환했다. 390폭 실제 화면에서도 주별 표를 Tab→표 영역→기간 버튼→집계 원본 버튼으로 이동하고 Space로 열어5행을 확인했다. 표시 주 시작은02-26이며 원본 조회 기간은 적용한02-29로 제한된다. Escape 초점은 해당 주별 원본 버튼으로 복귀했다.

1440폭에서 정상 매출10행·가중 입력10행 및 id3의 `SUM(weight)` 전용 라벨을 캡처했다. 정확값 표의 online 상세는 Enter로8행, 390폭 retail 상세는 Space로 id5/1행을 표시했다. 상세를 열어도 공통 channel 필터는 변경하지 않는다. 표 영역에서 ArrowRight는 내부 scrollLeft40을 만들었고 client308/scroll800, document390/viewport390이다. Tab6회는 대화상자 안에 머물렀으며 Escape·닫기 후 원래 카드/항목 버튼으로 돌아왔다. 항목 버튼은44px 최소 타깃이다. DISTINCT 위젯은 숫자 자체를 계속 표시하면서 상세 버튼은 비활성 사유를 안내한다. 실제 VoiceOver는 실행하지 않았다.

`api-rejections.json`의7조건에서 오래된 파일 버전·정의·표시하지 않은 NULL 그룹·그룹 집합 불일치·SQL 삽입 형태 선택은409, 예상 밖 SQL 요청 키는400, DISTINCT 상세는422다. 소유권·실제 파일 교체 snapshot·페이지·원본 magic 컬럼 및 늦은 응답/조건 변경은 신규 하위 검사로 확인했다. 실제 브라우저에서 테스트 대시보드32의 저장 정의를 다른 요청으로 변경한409는 이전 행0개를 표시했으며, 저장 정의 GET 이후 미리보기와 상세를 재조회해 현재 조건의5행으로 복구했다. 503은 브라우저 route fixture이며 실제 서버 장애가 아니다. 이 실패에서도 이전 행0개이며 재시도는 실제 서버에서 가중 입력6행으로 복구했다.

원래 source24/dashboard26의 정의 revision은 검증 전후 `5cec6eb632a8b9c884ebf4c184a4961776885d1c00f38f677987d2fc5f0f9806`으로 같다. 기존 대시보드의 신규 집계 상세3행도 확인해 최종 브라우저에 남겼다. 테스트용 source28/dashboard32·33만 API200/SUCCESS로 정리했다. fixture32의 정의 변경은409 검증용이며 일반 탐색의 정의 수정으로 계산하지 않는다.

## 오류 수정·검사

최초 실제 API는 생성한 `WHERE ((amount) IS NOT NULL)`을 기존 SQL 검증기가 함수로 오인해400을 반환했다. `api-first-failure.json` 및 `query-error-before.png`에 보존했다. SQL의 구조 키워드 뒤 괄호를 구분하도록 수정하고 알 수 없는 함수·다중 관계·쓰기 거부는 유지했다. 수정 뒤 같은 매출 입력10행과 전체17조건을 통과했다. 생성된 시간 그룹의 strftime/date_trunc 동등 그룹 증명도 보완했다.

독립 리뷰에서 동률 TOP N을 다시 조회하면 표시 그룹이 달라질 수 있는 문제를 확인했다. preview의 타입을 보존한 그룹 집합 hash를 상세의 매 페이지에서 대조하고 응답에서도 확인하도록 수정했다. 실제 동률에서 비결정성이 발생했다는 브라우저 재현 주장은 하지 않는다. 그룹 교체·hash 위조 거부는 하위 검사와 실제 API로 확인했다. `__proto__` 결과 별칭은 추적 지원을 거절하고 원본 컬럼의 동일 이름은 안전한 전송 별칭으로 보존한다. 최종 독립 범위 리뷰에서 추가 P1/P2는 없었다.

브라우저 검증 스크립트가 열린 modal 때문에 aria-hidden 상태가 된 배경 버튼의 boundingBox를 역할 locator로 읽다가 timeout이 났다. 당시 online Enter8행·retail Space1행·초점 복귀 검사는 진행된 상태였다. 동일 retail 상세 상태에서 숨겨진 locator를 명시해 측정·Tab·닫기를 이어서 확인했다. 제품 오류로 계산하거나 이미 통과한 동작을 반복하지 않았다.

마지막 시각 확인에서 모바일 구성요소 식이 임의 글자에서 끊기는 것을 보완했다. 해당 열을128px로 확보하고 칩의 box sizing을 고정했다. 기존 대시보드의 새 상세 화면에서 SUM 식3개 모두 한 줄·chip overflow 없음, document390/viewport390을 확인했다(`layout-after.json`, `existing-contributors-mobile.png`). CSS 변경 화면과 lint·최종 FE production build만 다시 확인했으며 수치/키보드 통과 동작은 반복하지 않았다.

BE 신규79 + 영향받는 기존291 =370개, FE 신규51(상세/상태42·차트9) + 영향받는 기존19 =70개, **고유 선택 검사440개 PASS**다. 수정 뒤 반복한 부분 검사는 고유 개수에 더하지 않았다. SQL 검증기 공통 변경으로 기존 SQL 경계·필터/상세·snapshot·Assistant·기간 관련 하위 검사만 선택했다. FE 타입·변경 파일 lint·production build, BE nest build·변경 파일 lint, diff check PASS. FE 기존 Vite CommonJS/Toast UI CSS 빌드 경고는 남아 있다. 정확한 명령·결과·hash는 `fe-verification.json`, `chart-verification.json` 및 상위 evidence 폴더의 `aggregate-input-backend-verification.json`에 있다.

기존 MD/E2E 통과 케이스, Rill139만 행 성능, LLM 생성, 전체 출시 회귀는 NOT_RUN이다. 모델 호출0이며 Codex gpt-6-luna와 기존 연결·metadata DB·DuckDB worker를 유지했다. 안전하게 추적하지 못하는 DISTINCT/HAVING/window·계산 차원·복잡한 SQL은 명시적 미지원이다. 그룹240개·집계 구성요소16개·원본 컬럼50개·기존 페이지 한도를 적용한다. KPI 전체 집계·현재 차트의 전체/항목 상세를 구현했으며 KPI 미니 추세의 개별 시점 상세와 이전 기간 상세는 후속이다.

## 증빙

독립 데이터/정답은 `contributions.csv`, `oracle.json`; 실제 결과는 `api-oracle.json`, `api-rejections.json`, `desktop.json`, `group-mobile-keyboard.json`, `period-mobile.json`, `recovery.json`, `cleanup-original.json`에 있다. 대표 화면은 `sum-inputs-desktop.png`, `weighted-inputs-desktop.png`, `online-group-desktop.png`, `retail-group-mobile.png`, `week-inputs-mobile.png`, `query-error-mobile.png`, `definition-conflict-mobile.png`, `definition-recovered-mobile.png`, `unsupported-distinct-mobile.png`, `existing-contributors-desktop.png`이다. 최종 실행 receipt는 `verification-results.json`에 커밋/코드·이미지 hash와 정리 결과를 기록한다.
