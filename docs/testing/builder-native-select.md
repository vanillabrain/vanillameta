# SQL 없는 제작 — 네이티브 선택 메뉴 후속

2026-10-13, develop-v2 `17503c94` 이후 변경. [self-service-builder.md](self-service-builder.md)의 SSBI-14 네이티브 메뉴 BLOCKED 조건만 선택했다. 기존 지표 계산·저장/재조회·파일·AI 통과는 반복하지 않았다. `$vanillameta-verify`를 사용하며 실제 VoiceOver 조건은 BLOCKED로 남긴다.

## 선택 명세·결과

| ID | 조작·기대 | 결과 |
| --- | --- | --- |
| SELECT-01 | 데스크톱 집계·숫자 표시의 네이티브 메뉴에서 방향키/Home/End/Enter 선택, Escape 취소·원래 값/초점 유지 | PASS_SELECTED_VARIANTS |
| SELECT-02 | 390px 소스·저장 지표·차트 종류·날짜/범주 열, 가중치 열을 실제 키보드로 선택하고 선택값·Tab 이동을 확인 | PASS_SELECTED_VARIANTS |
| SELECT-03 | 소스 변경의 조회 중/완료에도 초점 유지. 연속 선택 후 늦은 이전 프로파일이 최신 결과를 덮어쓰지 않음 | FAIL → PASS_SELECTED_VARIANTS: 모바일 지연 fixture·1440 완료·하위 순서 역전 검사 |

소스19/20은 기존 6행 주문 파일이다. 선택을 확인하기 위한 준비 데이터로 재사용했으며 이전 집계 정답·저장을 재검사한 결과가 아니다. 새로운 지표·대시보드·파일을 생성하거나 저장하지 않았다.

## 실제 메뉴·키보드

CUA로 해당 Chromium1228 창을 명시적으로 선택했다. AX click은 메뉴를 열지만 창이 전면이 아니면 키가 전달되지 않았다. 초기 Down/Return의 값 유지와 inactive 화면은 하네스 문제였고, 표준 윈도우의 Raise 후 입력으로 해결했다. 값 강제 변경/selectOption으로 성공을 대신하지 않았다.

1440px에서 집계 SUM→COUNT, End→합계 비율, 분자/분모 amount와 배율100을 선택했다. 소수 메뉴에서 Down→Escape는0자리와 초점을 유지했다. 같은 선택창을 Space로 다시 열고 Down 두 번→Enter로2자리, Tab→Space→Down→Enter로 축약 숫자를 선택했다. 각 선택 결과는 네이티브 AX와 DOM 값으로 대조했다. 합계 비율·가중 평균의 amount/amount는 메뉴 동작 확인용 미저장 정의이며 업무상 유효한 지표를 새로 추천한 것이 아니다.

390px에서 소스19→20→19, 저장 지표13(결제액 합계), 차트 line·날짜 date를 키보드로 선택했다. 별도 미저장 폼에서는 WEIGHTED_AVG·값/가중치 amount, bar·범주 channel을 선택했다. 날짜/가중치/범주 열은 Tab→Space→Home/End/방향키→Enter로 진입·확정했고 각 컨트롤에 초점이 남았다. 모바일 문서 폭390=viewport390, 선택한 범주 열의 테두리·라벨·값은 실제 캡처에서 가려지지 않았다. 네이티브 모든 항목 조합·터치 선택·전체 스크린리더 완료로 확대하지 않는다.

## 발견·수정·재검증

소스 변경 직후 데이터 조회 동안 selector를 disabled로 만들면 브라우저 초점이 BODY로 빠졌다. `source-native-mobile-before.png` 및 AX, 최초 관찰 값 source20/BODY를 보존했다. 조회 중에는 소스 선택을 활성 상태로 유지하도록 한 줄을 수정했다. 지표/대시보드 저장·미리보기 실행 중에는 기존 비활성화를 유지한다. 새 소스를 고르면 기존 revision·AbortController 처리가 이전 요청/결과를 무효화한다.

회귀를 먼저 추가해 source.disabled=true에서 실패를 확인한 뒤 수정했다. 프로파일2/3 응답 순서를 뒤집어 최신3의33행을 유지하고 늦은2의22행이 표시되지 않음을 확인한다. 이 검사는 DOM 비활성화·최신 결과 계약이며 실제 macOS 키보드 입력을 대신하지 않는다.

실제390px에서 소스20 프로파일 응답만1.8초 보류해 조회 중·완료의 focused=true/disabled=false를 확인했다. 이 지연은 관찰용 브라우저 fixture이며 DuckDB 실제 지연 성능이 아니다. 1440px 소스19 선택 완료에서도 초점을 유지했다. 저장/수정/삭제 요청0, AI 호출0, gpt-6-luna 설정 변경0이다.

## 환경·검사·증빙

Node24, FE `http://127.0.0.1:3483`, API `http://127.0.0.1:4683/v1`, 기존 metadata/DuckDB 워커를 재사용했다. Aside guide/repl 후 실제 탭 조회는 daemon 인증 challenge fetch 실패였다. 기존 승인된 headed Chromium 대체 창에서 CUA의 네이티브 입력·메뉴와 브라우저의 읽기/캡처를 사용했다. Aside 성공이나 VoiceOver 발화 성공으로 보고하지 않는다. 브라우저 최초 sandbox 기동 실패와 긴 PTY 입력 잘림은 하네스 문제로 구분하고 승인된 기동·파일 기반 명령으로 복구했다.

관련 Explore advanced + FileVersions 단위35개, FE 타입·변경 파일 lint·production build·diff check 통과. 이후 stale 응답 단언을 act로 끝까지 반영하도록 강화한 신규 회귀1개만 다시 확인했다. 기존 Vite config/Toast UI CSS 경고는 유지하며 BE·전체 단위·전체 E2E·기존 MD 통과는 반복하지 않았다. 새 UI suite·의존성·상시 서비스는 추가하지 않았다.

증빙 루트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/builder-native-select/`.

- `verification-results.json`: 환경·선택값·초점·초기 실패·검사 범위·저장 요청0.
- `native-key-attempt-desktop.png`: 전면이 아닌 창의 키 입력 실패(하네스).
- `source-native-mobile-before.png`/`*-ax.txt`: 제품 초점 소실 최초 증거.
- `count-native-desktop.png`, `ratio-selected-desktop.png`: 실제 선택 완료.
- `line-selected-mobile.png`, `weighted-category-selected-mobile.png`: 새 선택 경로·포커스 테두리.
- `source-loading-mobile-after.png`, `source-loaded-mobile-after.png`, `source-focus-desktop-after.png` 및 AX: 수정 후 조회 중/완료 초점.
- `focus-regression.log`, `build.log`: 선택 검사 증거.

SSBI-14 네이티브 메뉴는 위 선택 변형에 한해 차단을 해소한다. 실제 VoiceOver·전체 차트 속성/키보드·운영 통합 등은 그대로 남는다. 기존130개 카탈로그 집계와 SSBI 전체 부분 완료 상태는 유지한다.
