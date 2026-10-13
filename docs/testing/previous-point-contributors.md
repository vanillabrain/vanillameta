# 이전 기간 시점별 집계 입력 원본

대용량/스크린리더 후속: [detail-large-screenreader.md](detail-large-screenreader.md)에서 139만 행의 선택 원본 상세 성능·AX를 검증했다. 아래 미검증은 당시 기록이며 실제 VoiceOver는 후속도 BLOCKED다.

기존 KPI-INPUT/CONTRIB/TIME의 통과 조건은 반복하지 않는다. 이번 명세는 이전 기간의 KPI 추세·시간 차트 시점 상세를 검증한다. Codex `gpt-6-luna` 설정은 유지하며 수동 탐색에는 모델 호출이 필요하지 않다.

## 계약

현재 기간 바로 앞의 같은 길이 이전 기간을 서버가 계산한다. 날짜는 UTC 일 기준, 정밀 기간은 초 단위의 종료 미포함 범위다. 이전 시점 상세는 현재 기간·공통 필터·비교 모드를 변경하지 않고 이전 기간 안의 해당 버킷 집계 입력만 반환한다. 주·월 버킷이 두 기간에 걸쳐도 기간별 범위로 제한한다.

클라이언트는 이전 기간 식별자와 실제 표시된 시점/그룹 버전을 전달한다. 임의 이전 날짜·SQL을 보내지 않는다. 같은 파일 snapshot·저장 정의·원본 WHERE·집계별 입력 조건을 확인하며 서버의 이전 기간 응답도 화면의 비교 문맥과 대조한다. 값이 NULL인 가중 평균의 분모 전용 입력과 비NULL 입력이 없는 SUM의 0행을 구분한다.

## 선택 명세

| ID | 입력·기대 결과 | 상태 |
| --- | --- | --- |
| PREV-INPUT-01 | 13행 CSV, 현재03-01/이전02-29·online. 이전 KPI 시간 시점 SUM190/5행, NULL 가중 시점은 분모 전용 id3/1행·NULL SUM0행. 수치와 row_id 독립 Decimal oracle 대조 | PASS_SELECTED_VARIANTS |
| PREV-INPUT-02 | 이전 일·월요일 주·월의 입력 교집합, 양쪽에 같은 주 시작을 표시해도 현재40/id7과 이전190/5행 분리. 초 단위 이전 기간10:30~11:00의 SUM90/3행·가중38/3행, 이전 시간 차트 시점 상세 | PASS_SELECTED_VARIANTS |
| PREV-INPUT-03 | 비교 끔/날짜 없음·위조 기간/시점/입도/hash·오래된 파일/정의·응답 기간 불일치 차단, 오류에서 이전 행 제거·재시도/저장 정의 재조회 복구·페이지 문맥 | PASS_SELECTED_VARIANTS |
| PREV-INPUT-04 | 실제1440/390, 현재/이전 구분·실제 이전 UTC 범위·표/차트 방향키·Tab/Enter/Space·상세 초점/스크롤/Escape 복귀. 원본 상세 열기 전후 현재 필터·기간·비교 모드 유지·문서 overflow 없음 | PASS_SELECTED_VARIANTS |

## 환경·증빙

Node24, 기존 FE3483/API4683·metadata DB·서버 DuckDB worker를 재사용한다. 증빙 폴더는 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/previous-point-contributors/`다. 13행 CSV는 입력으로 재사용하고 이번 이전 기간/시점 정답은 별도로 계산한다. 새 검증 소스·대시보드만 정리하고 source24/dashboard26은 보존한다.

이전/현재 선 겹침 비교 디자인·업무 시간대·전년 비교·복잡한 SQL·대용량 상세 성능·실제 VoiceOver·Rill/LLM 생성은 미실행이다. 선택 변형 통과를 전체 SSBI/출시 회귀 완료로 확대하지 않는다.

## 실제 결과 — 2026-10-13

별도 Python Decimal·UTC 달력 정답과 실제 API16조건이 일치한다. 현재03-01/이전02-29·online의 이전10시 SUM190/5행(id1,2,4,11,12), 가중290/6=48.333…/같은5행, 환불9/190/같은5행이다. 이전11시 NULL SUM은0행이며 NULL 가중/환불은 각각 분모 또는 분자에만 참여하는 id3/1행을 반환한다. 0·음수·물리 중복을 유지한다.

일·주·월의 버킷은 서버가 계산한 이전 범위와 교차한다. 같은 주 시작02-26이 양쪽에 있어도 현재40/id7과 이전190/5행을 분리한다. 이전 일별 가중290/9=32.222…/6행과 환불19/190/6행도 일치한다. 정밀 현재02-29 11:00~11:30의 이전10:30~11:00 종료 미포함 범위는 SUM90/3행(id2,11,12), 가중190/5=38/같은3행이다. 이전 시간 차트의 일·주·월 그룹도 실제 표시 목록 및 정의 hash에 고정한다.

실제 API 거부11조건은 비교 끔/누락·날짜 없음·임의 기간/period·현재 목록에 없는 이전 그룹·그룹 hash/파일/정의 버전 불일치·지원 범위 아래 이전 날짜를 차단한다. 페이지별 문맥·소유권·동시 snapshot·정의 재확인·기간별240점 제한·응답 기간/컬럼/정밀도 불일치와 늦은 응답 차단은 관련 하위 검사로 확인한다.

실제1440 화면에서 이전 추세 summary를 Enter로 펼치고 그래프 방향키→별도 원본 버튼→Enter로 NULL 가중 시점의 id3/1행을 확인했다. 이전 그래프 포인터는 공통 기간을 바꾸거나 조회하지 않는다. Escape는 실행 버튼으로 돌아간다. 390 화면에서 이전 정확값 표 Tab3회→Space로 같은 시점 상세를 열고, 상세 내부 Tab7회·ArrowRight 수평 이동·Escape 복귀를 확인했다. NULL SUM0행과 이전 시간 차트 주별190/5행도 확인했다. 원본 버튼은44px 이상이며 문서 scrollWidth/viewport390/390, 상세 표client308/scroll828·실제scrollLeft2다. 현재03-01/channelonline/비교 켬은 유지된다.

새 검증 dashboard35의 설명을 별도 요청으로 변경한 실제409는 오래된 이전 행을0개로 제거했다. 저장 정의 GET→새 preview→이전 시간 차트 상세5행으로 복구하며 현재 기간과 비교 모드를 보존했다. 브라우저 route503 fixture 후 실제 재시도는 이전 주별 가중6행으로 복구했으나 초점이 Dialog 외곽으로 빠져 Escape가 실패했다. 최초 실패 캡처는 `retry-focus-before.png`다. 이 조건의 수정·재검증은 아래 후속 기록으로 분리한다.503은 실제 서버 장애 재현이 아니다.

## 검사·증빙

검증 폴더의 `oracle.json`, `api-oracle.json`, `api-rejections.json`, `desktop.json`, `mobile-keyboard.json`, `line-mobile.json`, `definition-recovery.json`과 캡처를 함께 사용한다. 스크린샷만으로 수치·버전 검사를 대신하지 않는다. Aside guide/guide repl 후 실제 연결은 daemon 인증 challenge 실패/Aside 미실행으로 사용할 수 없었으며, 앞서 허용된 headed Chromium에서 실제 화면을 검증했다.

초기 선택 고유 검사 BE119(신규24/관련95)+FE101(신규58/관련43)=220개 PASS다. SourceDetails의 오류 재시도 초점 수정 검사는 별도 후속으로 기록한다. 정확한 명령/코드 hash는 `backend-verification.json`, `fe-verification.json`, `previous-point-verification.json`에 있다. BE Nest build·변경 lint, FE 타입·변경 lint·production build는 실행했으며 마지막 수정 이후 체크는 후속 기록을 따른다. 기존 Vite CommonJS/ToastUI CSS 경고는 유지한다.

Codex gpt-6-luna 연결 설정은 변경하지 않았으며 모델 호출0회다. 기존 MD 통과 조건과 전체 E2E는 반복하지 않았다. 복잡한 SQL·대용량 상세 성능·실제 VoiceOver·Rill/LLM 비교는 NOT_RUN이며 현재 전체 출시 회귀 완료로 확대하지 않는다.

## 오류 수정·재검증 후속

재시도 버튼에 초점이 있으면 요청을 시작하기 전에 항상 남는 ‘원본 상세 닫기’ 버튼으로 옮기도록 수정했다.390 화면에서 실패했던503→키보드 Enter 재시도만 다시 실행했다. 실제201/이전02-29 주별 가중6행 복구, 닫기 버튼 초점 유지, Tab의 대화상자 내부 이동, Escape 닫기와 정확한 이전 표 실행 버튼 복귀가 모두 PASS다. 현재03-01·online·이전 비교 켬도 유지한다. `retry-focus-recheck.json`, `retry-focus-after-mobile.png`가 수정 후 증빙이며 성공했던 나머지 MD 조건은 반복하지 않았다.

검증용 dashboard35/source30은 각각 API200/SUCCESS로 삭제하고 전용 탭을 닫았다. 기존 source24/dashboard26 및 revision `5cec6eb632a8b9c884ebf4c184a4961776885d1c00f38f677987d2fc5f0f9806`은 보존했다. `cleanup.json`에 확인 값을 남겼다.

최종 고유 선택 검사 **226개 PASS**: 초기220개에 재시도 초점 신규3개와 앞선 선택에 없던 관련 오류 처리3개를 더했다. 재실행한 기존 시점/이전 키보드3개는 중복 집계하지 않았다. 신규85개/관련 기존141개이며 `retry-focus-verification.json`에9개 실행 중 중복 여부를 기록했다. 마지막 코드에서 FE 타입·scoped lint·최종 production build(2.25초)·diff/변경 MD 링크 확인 PASS다. 빌드 로그는 `frontend-build-final.log`에 보존한다.

최종 독립 정적 검토에서 추가 P1/P2는 없었으며 재시도 초점 P2는 수정/브라우저 재검증 근거로 닫았다. `review.json`은 최종 코드 hash를 기록하며 정적 검토 자체를 화면 검증으로 취급하지 않는다.
