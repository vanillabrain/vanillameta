# DESIGN-04 — 위젯 생성 키보드 후속

2026-10-13 후속: [차트 설정 키보드](native-popups-chart-keyboard.md)에서 선형·원형·분산형·표의 선택 속성을 검증했다. 추가/삭제 버튼 이름·삭제 후 초점·표 라디오 그룹 이름/중복 ID를 수정·재검증했다. 아래 기록의 모든 차트 전체 속성·결과표 셀·VoiceOver 잔여를 전체 완료로 바꾸지 않는다.

2026-10-13, `develop-v2`, 시작 `f833ac66`. 기존 차트 계산·생성/재조회 검증은 재사용하고, 선택 카드와 숫자판 대표 속성·저장 취소의 미검증 키보드 경로를 선택했다. FE3483/API4683·기존 격리 DB·승인된 headed Chromium을 재사용했다. Aside 연결 제약은 기존과 같다. AI는 Codex `gpt-6-luna` 설정 유지, 이번 호출0이다.

## 발견·수정

- 위젯 타입 카드50개가 Tab/Enter/Space 대상이 아니었다. 실제 ButtonBase와 pressed 상태, 장식 이미지 빈 alt를 추가했다.
- 위젯 생성의 데이터 선택도 미리보기로 읽혔다. 선택 모드만 이름을 선택으로 바꾸고 pressed 상태를 추가했다. 데이터 목록의 실제 미리보기 이름은 유지한다.
- 공통 SelectForm이 존재하지 않는 userInputSelect에 라벨을 연결하고, TextFieldForm은 ID 없는 입력에 이름을 연결하지 않았다. useId 기반 고유 연결과 기존 호출자 ID를 보존한다. 명시된 aria-label은 중복 라벨 없이 유지한다.
- 색상 Popover에 이름 있는 dialog와 버튼 expanded/controls/haspopup 상태를 추가했다. 색상 계산·저장 방식은 변경하지 않았다.

## 실제 브라우저 검증

| 조건 | 결과 / 범위 |
| --- | --- |
| 데이터→타입 | PASS: 샘플 데이터셋25 Space 선택→다음 Enter. 숫자판 Space 선택 pressed=true·다음 활성. |
| 타입50개 Tab | PASS: 화면에 보이는 카드50개, 고유 이름50개, 이름/outline 누락0. 카드는 순회만 했으며50개 차트를 다시 렌더·저장한 결과가 아니다. |
| 숫자판 속성 | PASS: field 메뉴 End→value 선택, 제목 MD 키보드 숫자판 입력. 이전→다음 후 제목·필드 유지. 메뉴 Enter/Escape로 복귀. 미리보기 값8795000 관찰은 기존 계산 정확성 검사를 재판정하지 않는다. |
| 모바일 Tab | PASS: 이름/메시지/폰트/색상/숨기기/필드/집계/폰트/색상/서식/소수/표시/Prefix/Suffix/저장의15개 대상 이름·outline 확인. 페이지 scrollWidth=viewport=390. |
| 팝업·저장 취소 | PASS: desktop/mobile 색상 버튼 Enter→이름 있는 dialog→Escape→색상 버튼 복귀. 저장 버튼 Enter→이름 있는 위젯 저장 창→취소 Enter→저장 버튼 복귀. 확인창의 저장 액션은 실행하지 않았다. |
| 데이터 보존 | PASS: 인증 GET widget 전후200·응답 동일. 관찰된 widget/AI POST·PUT·PATCH·DELETE0. |

처음 Tab 개수를 셀 때 숨겨진 데이터 선택 카드까지 포함한85개를 사용했다. 해당 `type-tabs.json`은 최종 증거가 아니며 `type-tabs-visible.json`의50개로 다시 확인했다. 처음 속성 Tab 검사는 로딩 전에 진행돼 이름/저장만 나온 `settings-tabs-mobile.json`으로 보존했다. 메시지 입력 표시 완료 후 `settings-tabs-mobile-final.json`의15개로 확인했다.

## 하위 검사와 증빙

공통 라벨 회귀3개 PASS: 반복 Select의 고유 라벨 연결, 호출자 ID/명시 이름 보존, ID 없는 텍스트 입력 연결. 실제 MUI를 사용한다. 최초 Vitest Emotion ESM 로딩 실패는 테스트에서 MUI의 CJS 진입점을 읽도록 수정했다. MUI 컨트롤·접근성 동작을 가짜 구현으로 대체하지 않았다.

FE 타입·변경8파일 ESLint·빌드·git diff --check PASS. 이전599개 전체 단위/BE 빌드는 반복하지 않았다. Vite 설정/Toast UI CSS 빌드 경고 유지. 새 자동 UI 테스트·의존성·상시 서비스는 추가하지 않았다.

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/widget-keyboard`:

- 최초 `types-before-aria.txt`, `types-before.png`, `settings-before-aria.txt`, `tests-before.log`.
- 최종 `type-tabs-visible.json`, `settings-tabs-mobile-final.json`, `settings-after-aria.txt`, `color-after-aria.txt`, `results.json`, `tests-after.log`, `types.log`, `lint.log`, `build.log`.
- 화면 `types-after-desktop.png`, `types-after-mobile.png`, `settings-after-desktop.png`, `settings-after-mobile.png`, `color-mobile.png`.

실제 VoiceOver 발화·읽기 순서, 숫자판 외 모든 차트 속성/색상 스와치 전체 키보드 조작, 결과표 전체 셀, 매출·환불 화면 전체 키보드는 아직 미검증이다. DESIGN-04 부분 완료 및130개(129완료/1부분 완료) 집계를 유지한다. 공통 라벨 수정으로 모든 차트의 전체 접근성을 검증했다고 주장하지 않는다.
