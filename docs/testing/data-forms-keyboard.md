# DESIGN-04 — 소스·데이터셋 폼 키보드 후속

2026-10-13, `develop-v2`, 시작 `8c5e5ce5`. 이전 데이터 목록 검증 다음으로 소스 생성/수정 및 데이터셋 생성/수정 폼의 미검증 키보드 경로를 선택했다. 실제 headed Chromium의 FE3483/API4683·기존 격리 DB를 재사용했다. Aside 인증 연결 제약으로 기존 승인된 대체 브라우저를 유지했다.

## 오류와 수정

- 소스 타입 13개 카드가 Tab/Enter/Space 대상이 아니었다. 실제 ButtonBase로 변경하고 `aria-pressed` 상태 및 장식 이미지 빈 alt를 지정했다.
- 이미 선택한 타입을 다시 누르면 저장된 이름/파일 경로가 화면에서 지워졌다. 같은 타입은 값을 유지하고, 다른 타입으로 전환하면 이전 연결 성공 상태를 해제한다.
- SQL 편집기는 이름이 없고 Tab을 들여쓰기로 처리해 다음 버튼으로 이동하는 방법을 안내하지 않았다. 한영 SQL 이름·키보드 안내, Esc→Run 이동을 추가했다. Tab 들여쓰기와 Shift+Tab으로 편집기 복귀는 유지한다.
- 소스 선택 및 AI SQL 입력에 명시적인 이름을 추가했다. 언어 변경 시 기존 SQL 입력의 이름도 갱신한다.

## 실제 브라우저 결과

| 조건 | 결과 / 한정 범위 |
| --- | --- |
| 소스 타입 탐색 | PASS: MySQL부터 Databricks까지 13개 버튼→이름→Filename→TEST CONNECT의 16개 Tab 정지점, 포커스 outline 확인. SQLite Space/Enter 선택과 pressed 상태 확인. 외부 드라이버 접속은 실행하지 않았다. |
| 수정 값 유지 | PASS: 소스1 재조회 후 선택된 SQLite에 Enter, 기존 이름/파일명 동일. 이전 실패 화면 `source-after-mobile.png`는 입력 초기화 상태로 보존, 최종은 `source-after-mobile-final.png`. |
| 타입 변경 후 연결 상태 | PASS: 실제 SQLite TEST CONNECT를 키보드로 실행해 저장 활성화→PostgreSQL Space 선택 후 저장 비활성. PostgreSQL 접속/저장은 실행하지 않았다. |
| 데이터셋 폼 | PASS: 데이터 목록 수정 버튼 Enter→`/data/set/modify/25`, 이름→AI 입력→생성→SQL 편집기 Tab 이동. 생성 폼의 이름 있는 소스 목록 Enter/Escape도 확인. AI 생성은 호출하지 않았다. |
| 편집기 빠져나오기 | PASS: Tab은 편집기에 유지, Esc→Run, Shift+Tab→SQL. 키보드로 `SELECT 1 AS keyboard_value` 입력 후 Esc·Enter, 실제 조회 결과1. 저장은 실행하지 않았다. |
| 취소·기존 데이터 보존 | PASS: 이전 버튼 Enter로 목록 복귀, 인증된 GET dataset25 전후 응답 완전 동일. 최초 검사 도구의 잘못된 토큰 읽기401은 올바른 기존 로그인 토큰으로 수정해 전후200을 확인했다. 제품 오류로 판정하지 않았다. |
| 언어·모바일 | PASS: 열린 생성 폼에서 영어 전환 후 SQL query 이름과 Esc→Run, 한국어 복귀 확인. 390×844 수정 화면의 페이지 폭=scrollWidth=390. |

관찰된 POST는 읽기 조회 `/v1/database/execute`와 연결 검사 `/v1/database/test` 각각1개다. PUT/PATCH/DELETE 및 데이터 생성·저장 요청은0. LLM 호출0, Codex `gpt-6-luna` 설정 유지. 긴 REPL 명령의 입력 잘림은 취소 후 짧은 명령으로 재실행했다.

FE 타입 검사·변경5파일 ESLint·FE 빌드·`git diff --check` PASS. 타입 검사에서 Ace 타입 선언에 없는 getElement 사용이 발견돼 실제 editor.container textarea 참조로 수정했다. 전체 단위599개/BE 빌드는 이전 통합 결과를 재사용했고 이번에 반복 실행하지 않았다. 관련 UI 동작은 위 실제 브라우저 결과로 검증했다. 새 의존성/상시 서비스/자동 E2E 코드는 추가하지 않았다.

## 증빙과 남은 조건

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data-forms-keyboard`:

- 최초 `source-before-aria.txt`, `source-before.png`, `dataset-before-aria.txt`.
- 최종 `source-tabs.json`, `source-after-aria.txt`, `dataset-after-aria.txt`, `dataset-modify-after-aria.txt`, `dataset-en-aria.txt`, `requests.json`, `results.json`, `types.log`, `lint.log`, `build.log`.
- 화면 `source-after-desktop.png`, `source-after-mobile-final.png`, `source-type-reset.png`, `dataset-run-desktop.png`, `dataset-run-mobile.png`.

실제 VoiceOver 발화·읽기 순서, 모든 외부 DB 폼, 쿼리 결과 표 전체 셀 탐색, 다른 위젯/메트릭/매출·환불 화면의 전체 키보드 경로는 미검증이다. AX 관찰을 실제 음성 발화로 대체하지 않는다. DESIGN-04는 부분 완료 유지, 전체 집계는130개 중129완료/1부분 완료다.
