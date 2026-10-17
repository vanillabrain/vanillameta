# Studio 건수 표시·게시 단일 점 — 2026-10-17

## 범위와 원인

P2/P3 생성/편집 결과와 P4 게시 결과의 가시성을 좁게 보완한다. 계산·데이터·지표 정의·저장/게시 경로는 변경하지 않는다. `vanillameta-verify`·systematic-debugging·TDD로 이전 기록의 단일 날짜 차트를 먼저 재관찰했다.

실제 편집기5 ECharts 인스턴스에는 data=[13000], showSymbol=true, circle/5px가 있었고 안정된 화면에서 점이 보였다. 직전 빈 차트 캡처를 편집기의 지속 오류로 일반화하지 않는다. ECharts 공식 showSymbol/showAllSymbol 문서를 Context7로 확인했다. 게시 PublishedBlockView는 showSymbol=false를 항상 전달해 단일 점을 숨기는 실제 경로가 있었다. 게시 데이터가 정확히1행일 때만 showSymbol=true/symbolSize7, 0행·다중 행은 기존false를 유지한다. 전역 차트 테마·일반 LineChart는 변경하지 않는다.

건수는 `localizedMetricSuffix`가 한국어 ko/ko-*에서 canonical count/공백count만 `건`으로 표시한다. 영어/언어 미확인·사용자 임의 suffix·KRW는 유지한다. Studio 생성 미리보기/실제 편집기/게시 렌더러에서만 적용하며 formatMetric의 기본 숫자 계약을 바꾸지 않는다. 원본 prefix/suffix·게시 snapshot은 수정하지 않는다.

## MD 조건·결과

| ID | 조건 | 결과·범위 |
|---|---|---|
| DISPLAY-01 | 편집기 한 날짜 데이터 | 조사 PASS: 안정된 기존 화면/런타임 data13000/circle5를 확인, 별도 편집기 점 수정 없음 |
| DISPLAY-02 | 게시 렌더러 한 점·빈/다중 행 | PASS_SELECTED: 회귀 및 실제 격리 렌더러 showSymboltrue/7px/data13000. 빈/다중false는 컴포넌트 검사 |
| DISPLAY-03 | count 한국어/영어·커스텀 단위 | PASS_SELECTED: 회귀·실제 렌더러 한국어2건/영어2 count·저장본6의2건/1건. 저장 suffix/count와2/1/50 불변 |
| DISPLAY-04 | 화면 폭/키보드 | 실제 편집기1440/768/390 캡처·게시 격리1440/768 가로 넘침0·키보드 언어 전환/집계 표. 게시390는 아래 Ego17 후속에서 PASS_SELECTED |

## 실제 화면·수치

Ego16의 기존 source4/dashboard5·6과 공개 링크를 생성하지 않는 로컬 임시 HTML fixture를 사용했다. fixture는 실제 PublishedBlockView를 합성 count2/일별13000으로 마운트했다. 별도 게시 API/LLM 호출·저장0이다. 게시 라이프사이클이나 수신자 권한을 새로 검증한 것으로 보고하지 않는다.

게시 렌더러 화면의 점7px와 원화13000, 한국어2건/영어2 count, 키보드 집계 표의 날짜/정확한 값을 확인했다. 실제 Studio6의2건·1건·50.00%도 재조회했고 API의2/1/50 및 저장 suffix count/%는 직전 증빙과 같다. dashboard6/database4/metric11/publication0 불변이다. 모델 gpt-6-luna는 유지했으며 이번에는 모델 요청0, VoiceOver BLOCKED 유지다.

fixture에 viewport meta가 없어 모바일 에뮬레이션390 호출에서도 실제 CSS viewport는980이었다. 해당 이미지는 `*-viewport980.png`로 바로잡고 게시390 모바일 PASS로 집계하지 않았다. 브라우저 종료 후 발견했으므로 같은 목표의 새 작업 공간을 임의로 열지 않았다. 실제 앱 Studio390 캡처는 별도 `editor-ko-390.png`이며 이 한계를 실제 휴대폰/전체 게시 반응형 통과로 확대하지 않는다.

## 검사와 증빙

단위 초기3 FAIL→구현/관련 회귀 보완 후 FE4 suite88 PASS. FE type/lint/build·diff whitespace PASS. 전체 suite/core E2E와 기존 BE/LLM 조건은 재사용했다. 변경파일: formatMetric.ts/helper 회귀, StudioSemanticReview/StudioEditor/PublishedDashboard, 신규 PublishedBlockView.test.tsx. UI 임시 fixture는 증빙 폴더에만 보관하고 public/build에서 제거했으며 최종 build를 다시 확인했다.

`/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-display-20261017/`: chart-option-before.json/chart-before.png, published-option.json, published-renderer-1440.png/768.png/viewport980.png, published-renderer-en-viewport980.png, published-table.txt, editor-ko1440/768/390 캡처, editor-ko.txt, layouts.json, api-final.json, renderer-fixture.html, 선택 검사 로그·manifest.json. 이미지는 직접 검토했다. 기존 메뉴/공유·실고객·운영/실휴대폰·전체 접근성은 이번 완료 조건이 아니다.

기준 develop-v2 `2ef07437` + 기존 Commerce 문맥/추천 질문 및 이번 미커밋 변경. 검증 전용 브라우저·서버는 종료하고 기존 비공개 검증 데이터를 유지한다.


## DISPLAY-04 게시 390px 후속 — 2026-10-17 / Ego17

사용자 요청으로 남겨 둔 게시 렌더러390px만 실행했다. 앞선 fixture를 재사용하고 `<meta name="viewport" content="width=device-width, initial-scale=1">`를 추가했다. 이전1440/768·영어·전체 단위/빌드·LLM 케이스는 반복하지 않았다. 실제 PublishedBlockView를 합성 데이터로 마운트한 격리 화면이며 게시 링크/수신자 권한/전체 공개 페이지 wrapper를 새로 검증한 것은 아니다.

초기390 전환 직후에는 차트 부모302px에 비해 canvas가 이전 폭1112px로 남아 document가1156px로 확장됐다(`overflow-first.png`). resize가 완료되는 관찰 조건 `innerWidth === 390 && document.documentElement.scrollWidth === 390`을 기다린 뒤 canvas302×160·clientWidth390·scrollWidth390을 확인했다. 일시 resize 상태를 영구적인 제품 오류로 취급하지 않았고 제품 코드 수정은 하지 않았다. 검증 fixture의 viewport와 캡처 대기 조건만 수정했다.

- 숫자/기능 PASS_SELECTED: 한국어2건·단일 점13000/7px를 실제390px 화면에서 확인했다. 키보드 Enter로 표를 열고 날짜 `2025-01-01 00:00:00+00`·정확한13,000과 버튼 focus-visible을 확인했다. Tab으로 표 region에 진입/가시 포커스→ShiftTab/Enter 닫기 후 table0·너비390/가로넘침0을 확인했다.
- 디자인 PASS_SELECTED: 대표 화면·표 열림/포커스 캡처를 직접 검토했다. 제목/숫자/점/축/버튼이 겹치거나 사라지지 않고 표 region302px 안에 날짜/값이 들어간다. 실제 휴대폰/VoiceOver 전체 접근성으로 확대하지 않는다.
- 보존: Commerce/대시보드/StudioState/게시/지표/Database 전체 행의 전후 해시가 모두 같았다. API 서버를 기동하지 않았고 별도 AI/저장/게시 동작은0이다. gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다.

기존 제품 코드와 검사 결과는 재사용하고 이번에 전체 단위/타입/린트/build를 재실행하지 않았다. 변경은 이 MD와 상태 요약뿐이며 diff whitespace PASS다. Ego17·검증 프런트는 종료했고 임시 fixture는 public에서 제거했다. build를 실행하지 않아 배포 결과물에 fixture를 복사하지 않았다.

후속 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-display-mobile-20261017/`. `renderer-fixture.html`, `overflow-first.png`, `layout-before-table.json`, `published-renderer-390.png`, `published-table-keyboard-390.png`, `published-table-focus-390.png`, `table-layout.json`, `table-keyboard.txt`, `keyboard-final.json`, `db-before.json`, `db-unchanged.json`, `manifest.json`.

이전 게시390 NOT_RUN은 당시 기록으로 보존하며 최신 범위는 이 후속 결과를 따른다. 전체 게시 여정·실기기/고객/운영 gate는 계속 별도다.


## DISPLAY-05 전체 게시 화면 후속 — 2026-10-17 / Ego19

남아 있던 전체 PublishedDashboard wrapper의 모바일 가시성을 선택했다. 실제 게시 페이지·라우터·게시 응답 검증기·블록 렌더러를 사용하되 Axios adapter에서 합성 응답만 반환하는 로컬 HTML fixture로 실행했다. 토큰은 실행 가능한 공개 링크가 아니며 API 서버/LLM/게시/저장 요청은 없다. 따라서 실제 수신자 권한·만료·게시 라이프사이클 검증으로 확대하지 않는다.

실제390px 최초 화면에서 헤더의 모든 a에 적용된 color:inherit가 공통 primary 버튼의 글자를 어둡게 덮는 문제를 발견했다. 해당 색 덮어쓰기를 제거해 공통 버튼의 밝은 전경색을 복원했다. 모바일 제목과 공개 상태는 세로로 배치해 긴 제목의 좁은 줄바꿈을 줄였다. 변경은 studio.css의 게시 헤더/599px 이하 제목 영역에 한정한다. 숫자/저장 정의/모델은 그대로다.

- 기능 PASS_SELECTED: 키보드로 건너뛰기 Enter→다음 Tab이 본문 집계 버튼에 진입하고 focus-visible을 유지한다. Enter로 정확한 집계 표를 열어 합성값2를 확인했다. 한국어2건·원화 단일 점13000은 기존 계산 결과를 재사용하는 표시 확인이다.
- 디자인 PASS_SELECTED: 수정 후390/768/1440의 scrollWidth는 각각 viewport와 같고 복제/재확인 버튼은36px 높이·14px 글자다. 모바일 제목은 column, 태블릿/데스크톱은 기존 row다. 로고·버튼·긴 제목·게시 시각·읽기 전용 안내·카드/표를 캡처로 직접 확인했다. 대비는 실제 글자색 복원 확인이며 전체 WCAG 감사가 아니다.
- 실행 한계: 초기 fixture의 라우터 모듈을 다른 URL로 불러와 토큰 전달이 실패했다. 같은 Vite dependency URL로 맞춘 뒤 정상 조회했다. 또한 CDP 폭은 호출마다 지정해야 하며 폭을 다시 지정하지 않은1800px 캡처(`overflow-first.png`)를 모바일 실패로 집계하지 않는다. 실제390px 수정 전 증빙은 `full-wrapper-390.png`다.

단위/타입/린트는 CSS만 추가 변경되어 직전 결과를 재사용한다. 임시 fixture를 public에서 제거한 후 최종 FE build와 diff whitespace를 확인했다. fixture가 있던 초기 build 결과는 최종 배포 검증으로 사용하지 않는다. 브라우저 작업공간과 전용 프런트 서버는 종료했다. gpt-6-luna·VoiceOver BLOCKED 유지, 이번 변경은 미커밋이다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-published-wrapper-20261017/`의 `wrapper-fixture.html`, `full-wrapper-390.png`, `full-wrapper-after-390.png`, `full-wrapper-after-768.png`, `full-wrapper-after-1440.png`, `table-keyboard-390.png`, `skip-next-focus-390.png`, `results.json`, `keyboard.txt`, `build-final.log`, `manifest.json`. 실휴대폰·서버 권한·실고객/운영 전체 수용은 별도다.


## DISPLAY-06 모바일 오류·복구 — 2026-10-17 / Ego20

DISPLAY-05의 정상 화면 결과를 재사용하고390px 전체 PublishedDashboard의503→키보드 명시 재시도→로딩→200→키보드 재확인/410만 추가 검증했다. 같은 실제 컴포넌트와 검증기를 사용하고 로컬 Axios adapter에서 합성 상태를 반환했다. 공개 토큰/실제 게시/권한 변경·서버 장애 주입은 없으며 실제 권한/서버 복구 검증으로 확대하지 않는다.

기능 PASS_SELECTED: 최초503은role=alert·카드0/숫자0/복제링크0·재확인 가능이었다. 키보드 Enter 재시도 후role=status·버튼 disabled·오류 제거를 확인하고 대기 응답을200으로 해제해 카드2/한국어2건·복제링크 복원을 확인했다. 같은 버튼의 Enter로410을 반환한 뒤 중지/만료 안내·기존 카드/숫자/복제링크0·재확인 버튼의 가시 포커스를 확인했다. adapter 기록은 GET3개(503/대기후200/410), 쓰기0이다. 로딩 중 포커스 보존 자체를 통과로 주장하지 않는다(비활성화 시 포커스가 버튼을 떠남). 서버 만료 타이머 자체는 이번 범위가 아니다.

디자인 PASS_SELECTED:503/로딩/복구/410 각각 innerWidth=scrollWidth=390, 안내·로고·버튼의 겹침/잘림 없이 상태가 전환됐다.4개 캡처를 직접 검토했다. 이전 정상3폭·집계표·단위/숫자 검사는 반복하지 않았다. 신규 제품 코드 수정이 없어 직전 단위/타입/린트/build를 재사용했고 diff whitespace만 확인했다.

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-published-recovery-20261017/`의 `recovery-fixture.html`, `error503-390.png`, `loading-390.png`, `recovered-390.png`, `expired-390.png`, `results.json`, `expired.txt`, `manifest.json`이다. 초기 브라우저 선택자의role 단독 구문은 지원되지 않아 CSS role 선택자로 수정했으며 제품 실패로 집계하지 않는다. fixture는 public에서 제거했고 build를 실행하지 않아 배포 결과물에 추가하지 않았다. Ego20·검증 프런트 종료, API 서버 기동0·LLM0·gpt-6-luna/VoiceOver BLOCKED 유지. 실제 네트워크/수신자/실휴대폰·전체 접근성/고객·운영 수용은 별도다.
