# DESIGN-04 — 매출·환불 키보드 후속

2026-10-13, develop-v2 시작 `ff65e1e4`. FE3483/API4683의 기존 격리 환경과 승인된 headed Chromium을 재사용했다. Aside 연결 제약은 이전 기록과 같다. 기존 COMMERCE-01~08의 저장·계산·Rill·AI 결과는 재사용하며 이번 결과로 다시 판정하지 않는다. AI는 Codex `gpt-6-luna` 설정 유지, 호출0이다.

## 발견과 수정

- 일별 차트에 키보드로 읽을 수 있는 정확값 표가 없었다. 기존 report.daily와 USD 포맷을 그대로 사용하는 접이식 표를 추가했다. UTC/통화 이름, 열 헤더, 스크롤 중 고정 헤더를 제공한다.
- 주문 표는 Chromium에서 Tab으로 스크롤 영역에 들어갈 수 있었지만 이름이 없었다. 일별·채널·주문 표에 이름과 region/Tab 진입을 명시하고 주문 펼치기 버튼을 대상 표에 연결했다.
- AI 창의 초기 포커스가 창 컨테이너였다. 편집 요청 입력에 autofocus를 추가했다. 호출·집계·저장 로직은 변경하지 않았다.

## 실제 검증

현재 격리 DB에는 Commerce 프로젝트가 없었으므로 기존 Analytics Engineering 정상 CSV4개를 화면에 지정하고 프로젝트 `MD 접근성 매출·환불` ID1을 준비했다. 이는 이번 키보드 검증의 픽스처 준비이며 기존 파일 선택·저장 케이스를 반복 검증한 것으로 집계하지 않는다. OS 파일 선택창 전체 키보드 경로는 NOT_RUN이다.

| 조건 | 결과 / 확인 범위 |
| --- | --- |
| 일별 표 | PASS: summary Enter→Tab으로 이름 있는 region 진입, outline 2px, ArrowRight/Down으로 실제 scrollLeft/Top 각각40 이동. 1,096행의 날짜·금액 표시가 API report 포맷과 모두 동일. 서버 계산의 독립 정확성 검사는 기존 oracle 결과 재사용. |
| 채널·주문 표 | PASS: 채널 summary Space→Tab으로 region 진입. 주문 전체100건 Enter→Tab으로 region 진입, ArrowRight로40 이동. 표의 이름/열 헤더는 AX snapshot 확인. 실제 스크린리더 발화 검증은 아니다. |
| AI 창 | PASS: 열기 버튼 Enter→AI 편집 요청 초기 포커스. Tab으로 취소→초안 생성→입력 순환, 비활성 저장 제외. Escape→열기 버튼 복귀. 모델 요청과 저장은 실행하지 않았다. |
| 가져오기 영역 | PASS: 열기 Enter 후 대상/프로젝트 이름/파일 선택4개/가져오기7개 Tab 대상과 outline 확인. 닫기 Enter. 다시 가져오기는 실행하지 않았다. |
| 프로젝트·채널 메뉴 | PASS: Enter로 열기, 채널 End 이동, Escape로 닫고 Select 복귀. 선택 적용·기존 필터 수치 검사는 재사용한다. 날짜 입력 전체 세그먼트 조작은 이번에 실행하지 않았다. |
| 모바일 | PASS: 실제390×844, 페이지 scrollWidth=viewport=390. 표 내부 가로·세로 스크롤과 고정 헤더 캡처. desktop1440×900도 확인. |
| 상태 보존 | PASS: 픽스처 준비 이후 GET report 전후 응답 동일, 관찰된 Commerce POST/PUT/PATCH/DELETE0. |

## 검사·증빙·잔여

FE 타입·대상 ESLint·빌드·diff check PASS. UI 이름·표 대체수단·포커스 변경이므로 실제 브라우저로 검증하고 새 자동 UI 테스트나 의존성을 추가하지 않았다. 이전 전체599개 단위·BE 빌드는 재사용했다. 기존 Vite/Toast UI CSS 빌드 경고 유지.

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-keyboard`:

- 최초 `before-aria.txt`, `ai-before.png`, `table-before-mobile.png`.
- 최종 `results.json`, `baseline-report.json`, `after-aria.txt`, `types.log`, `lint.log`, `build.log`.
- 화면 `ai-after-mobile.png`, `orders-after-mobile.png`, `daily-after-desktop.png`, `daily-after-mobile-final.png`. 최종 모바일 이미지는 고정 헤더 추가 후 캡처다.

실제 VoiceOver 발화·읽기 순서, 전체 WCAG, OS 파일 선택창, 날짜 입력 전체 키보드 경로, 다른 차트 전체 속성은 미검증이다. DESIGN-04 부분 완료, 130ID의129완료/1부분 완료 집계를 유지한다.

## 2026-10-13 날짜 입력·필터 후속

시작 `e6d87577`, 같은 FE3483/API4683·프로젝트1·headed Chromium을 재사용했다. 기존 정확액/AI 결과는 반복 판정하지 않았다. 위 날짜 입력 미검증 중 아래 경로를 이번에 보완했다.

### 발견·수정

- 종료일 누락/역순 안내는 페이지 Alert에만 있고 입력은 aria-invalid=false, 설명 연결 없음이었다. 날짜별 helperText/error/ID를 연결하고 잘못된 입력으로 포커스를 이동한다. 기본 안내 줄 공간을 확보했다.
- 실제 키보드로 연·월만 입력하면 native date의 value=''이지만 validity.badInput=true였다. 기존 코드가 양쪽 빈 날짜로 판단해 전체 기간 GET을 실행했다. inputRef의 badInput을 먼저 확인해 미완성 입력을 차단한다.
- 같은 미완성 입력은 React 상태가 이미 빈 문자열이어서 초기화만으로 화면의 날짜 일부가 남을 수 있다. 초기화에서 실제 native 값도 비운다.
- 정상 조회의 disabled 버튼에서 BODY로 포커스가 사라졌다. aria-disabled와 핸들러의 reportBusy 가드로 중복 요청을 차단하면서 포커스를 유지한다. 표시 결과 범위는 status/atomic으로 제공한다. 실제 발화 확인은 아니다.

### 브라우저 결과

| 조건 | 결과 / 범위 |
| --- | --- |
| 연·월·일 입력 | PASS: 이 Chromium의 연→월→일 순서를 ArrowLeft/Right와 실제 키 입력으로 조작해 시작2025-09-01·종료2025-09-30 입력. 최초 월부터 입력한 0009-01-25는 테스트 입력 순서 오류이며 제품 날짜 변환 오류가 아니다. fill로 날짜를 우회하지 않았다. |
| Tab 경로 | PASS: 날짜 내부 세그먼트/달력 버튼을 거쳐 시작→종료→채널→적용→초기화로 이동. native 내부 포커스는 동일 input 요소로 보고된다. 달력 팝업 내부 탐색과 다른 OS/브라우저는 NOT_RUN. |
| 미완성 시작/종료 | PASS: 연·월 또는 연만 있는 badInput 차단. 시작/종료 각각 aria-invalid=true, helper 연결·해당 입력 포커스 확인. 최초 수정 전 전체 기간 GET1, 수정 후 차단 조건 GET0. |
| 한쪽 누락·역순 | PASS: 종료일 누락은 종료 입력, 역순2025-09-01/08-31은 시작 입력 포커스와 오류 상태. 해당 조건 GET0. |
| 정상 적용·느린 응답 | PASS: 정확한 start/end query, 표시 범위 Sep2025·일별30행. 1.2초 응답 지연을 명시 주입하고 Enter3번→GET1·완료 후 적용 포커스 유지. 지연은 실제 서버 장애가 아니다. `results.json`의 valid.focus=BODY는 포커스 수정 전 기록, busy.focus=적용이 최종 재검증이다. |
| 초기화·보존 | PASS: 두 입력 value='', badInput=false·오류 해제, 전체 표시 범위·초기화 포커스 유지. GET report는 기존 전체 응답과 동일. 저장/AI 요청 없음. |
| 모바일·오류 대비 | PASS: 390×844 페이지 폭390, 연결된 오류와 포커스 실제 캡처. 오류 글자 rgb(211,47,47)/배경 rgb(248,251,255)의 sRGB 대비4.80:1. 해당 문구만 측정했으며 전체 WCAG 통과가 아니다. |

FE 타입·대상 lint·빌드·diff check 통과. native badInput/세그먼트/포커스는 실제 Chromium으로 검증했으며 새 UI 자동 테스트/의존성은 추가하지 않았다. 기존 전체599개 단위와 BE 빌드는 재사용했다. AI 설정은 gpt-6-luna 유지·호출0.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-date-keyboard`: `missing-end-before.json/png`, `incomplete-before.json/png`, `results.json`, `filter-aria-final.txt`, `incomplete-after-desktop.png`, `reversed-after-mobile.png`, `incomplete-after-mobile-final.png`, `reset-after-mobile.png`, 타입/린트/빌드 로그. 초기화 후 없는 helper를 읽으려던 진단은 timeout으로 종료됐고 오류를 다시 표시한 뒤 실제 색상을 측정했다.

실제 VoiceOver·읽기 순서, native 달력 팝업/OS 파일 선택창, 다른 차트 전체 속성과 전체 WCAG는 계속 미검증이다. DESIGN-04 부분 완료와129완료/1부분 완료 집계를 유지한다.
