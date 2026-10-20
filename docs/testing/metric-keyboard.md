# DESIGN-04 — 메트릭 화면 키보드 후속

2026-10-13, `develop-v2`, 시작 `0a8525e5`. 완료된 메트릭 CRUD·집계 명세는 재사용하고, 남은 키보드 탐색·모바일 입력 가시성 조건만 선택했다. FE3483/API4683, 기존 격리 DB와 승인된 headed Chromium을 사용했다. Aside 인증 연결 제약은 기존과 같다. Codex `gpt-6-luna` 설정은 유지했고 모델 호출은 없다.

## 발견 및 수정

- 추가 창의 데이터베이스·집계 함수 Select에 이름 연결이 없었다. useId 기반 InputLabel/labelId로 연결했다.
- 삭제 아이콘이 무명이고 여러 메트릭의 평가 버튼을 구별하기 어려웠다. 각 메트릭 이름을 포함한 한영 접근성 이름을 부여했다. 삭제 동작은 변경하지 않았다.
- 390px에서 집계 함수와 컬럼을 가로 배치해 집계 대상 라벨이 잘렸다. 작은 화면은 세로로 배치했다. 추가 창은 첫 이름 입력에 포커스를 둔다.
- 평가 결과에 이름 있는 Tab 대상 region과 결과 제목 status를 추가했다. 실제 발화 성공으로 판정하지 않는다.

## 실제 브라우저 결과

| 조건 | 결과 |
| --- | --- |
| 추가 창 열기·순환 | PASS: 추가 버튼 Enter→이름 입력. 이름/설명/DB/테이블/집계/대상/그룹/취소/생성 9개 Tab 대상 및 이름으로 순환, outline 확인. |
| 메뉴 키보드 | PASS: DB Enter·Home·Enter→샘플 SQLite DB, 집계 Enter·End·Enter→COUNT_DISTINCT. 메뉴 Escape는 Select로 복귀, 이어서 Escape는 추가 창 닫기. |
| 입력·취소 | PASS: 키보드로 이름 MD-keyboard-unsaved, 설명, uploaded_data, amount, category 입력. Tab→취소 Enter 후 추가 버튼에 포커스 복귀. 생성 버튼은 누르지 않았다. |
| 모바일 | PASS: 390×844, dialog clientWidth=scrollWidth=326, 페이지 폭390. 집계 대상 이름이 보이며 최종 취소 버튼 포커스 캡처. |
| 평가 결과 탐색 | PASS: 기존 메트릭 평가 버튼 Enter→실제 결과 표시. 다음 Tab은 이름 있는 삭제 버튼, 다음 Tab은 이름 있는 결과 region. 삭제 버튼은 실행하지 않았다. 기존 집계 정확성 검사를 반복 판정하지 않았다. |
| 데이터 보존 | PASS: 인증된 GET metric 검증 전후200·응답 동일. 관찰된 변경 메서드 요청은 기존 메트릭 evaluate POST1개뿐이고 생성/수정/삭제0. |

FE 변경3파일 ESLint·타입 검사·빌드, git diff --check PASS. 기존 Vite 설정/Toast UI CSS 경고는 유지한다. 직전 통합의 전체 단위599개 및 BE 빌드는 관련 변경이 없어 반복하지 않았다. 이번 변경 동작은 실제 브라우저로 확인했다. 새 자동 E2E/의존성/상시 서비스는 추가하지 않았다.

## 증빙·남은 범위

`/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/metric-keyboard`:

- 최초 `dialog-before-aria.txt`, `dialog-before-mobile.png`(열림 전환 중 캡처 포함).
- 최종 `dialog-tabs.json`, `dialog-after-aria.txt`, `result-aria.txt`, `results.json`, `types.log`, `lint.log`, `build.log`.
- 화면 `dialog-after-desktop.png`, `dialog-after-mobile-final.png`, `result-mobile.png`. 초기 후속 `dialog-after-mobile.png`는 입력 라벨 전환 중 캡처이며 최종 이미지로 대체했다.

실제 VoiceOver 발화·읽기 순서, 평가 결과 표의 모든 셀 탐색·읽기, 실패 상태 전체, 위젯/매출·환불 등 다른 화면의 전체 키보드 경로는 남아 있다. DESIGN-04는 부분 완료, 집계130개(129완료/1부분 완료)를 유지한다. 현재 테스트를 전체 WCAG 준수나 출시 회귀 완료로 확대하지 않는다.
