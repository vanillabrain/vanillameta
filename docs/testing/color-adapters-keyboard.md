# DESIGN-04 — 별도 색상 입력 후속

2026-10-13, develop-v2 시작 `1019e4e8`. FE3483/API4683·기존 격리 DB·데이터셋25·승인된 headed Chromium을 재사용했다. Aside 연결 제약은 기존 기록을 재사용한다. 기존 저장/수치/AI 케이스는 반복하지 않았다. Codex gpt-6-luna 설정 유지, AI 호출0.

## 수정

- ColorButtonForm/ColorFieldForm/ColorFieldReForm의 중복 SketchPicker 팝업3개를 기존 ColorPickerForm으로 통합했다. 이름 있는 버튼·명시 적용·취소·Escape·색상 표본 동작을 공유한다. 기본 공통 버튼 이름은 유지하고 호출자별 이름을 선택적으로 전달한다.
- 색상 값 입력에 고유 ID·순번 이름을 제공하고 복합 차트에서 순번을 전달한다. 루트/series 팔레트와 series 항목 업데이트는 기존 배열을 변경하지 않고 복사한다. ColorFieldReForm은 기존 호출자 이벤트를 전달한다.
- 실제 히트맵에서 간격 없는 키 입력 `#123456`이 `#16`, 재현 시 `#123`으로 누락됐다. 입력을 로컬 초안으로 유지하고 포커스가 떠날 때 차트 옵션에 반영한다. 입력 중 불완전한 색상으로 차트를 매번 다시 그리지 않는다. 선택창 적용은 즉시 반영한다. 복합 차트에도 같은 입력 정책을 적용했다.

## 선택 검증

| 조건 | 결과 / 범위 |
| --- | --- |
| 선형 차트 ColorButton | PASS: 필드1 색상 선택 Enter→#4A90E2 Space→적용 Enter, 아이콘 색상 변경·해당 버튼 포커스 복귀. |
| 히트맵 ColorField | PASS: 색상1 #000000 적용 후 다른3개 색상 유지. 색상2 #123456 직접 입력→선택창 HEX123456, 다른 표본 선택 후 취소→기존 값 유지. |
| 빠른 입력 재검사 | PASS: 수정 후 간격 없는 #123456 입력 보존, Tab으로 반영 후 선택창 HEX123456. 복합 차트도 같은 입력·반영 확인. 수정 전 붙여넣기 #abcdef는 정상이고 연속 키 입력만 누락됐다. |
| 복합 선형/원형 ColorFieldRe | PASS: category/value로 화면 준비, 두 번째 표본 #9013FE 적용. 배열은 #6aa7eb/#9013FE/#94c983/#c1d96a, 다른 값 유지. Escape 취소 후 #9013FE 유지·두 번째 버튼 포커스 복귀. |
| 모바일 | PASS:390×844, scrollWidth=390. 히트맵과 복합 차트 팝업 실제 캡처. 최종 복합 차트 화면에서 적용 후 재오픈한 팝업의 입력·표본·취소/적용이 화면 안에 표시됨. |
| 상태 회귀 | PASS: 어댑터 경계5개—series 항목 불변성, 루트/중첩 팔레트 불변성2개, 원래 필드 이름 전달·blur 반영, 연속 초안 입력 후 한 번 반영. 수정 전 기존4개 실패로 문제를 확인했다. |

FE 타입·대상 lint·FE 빌드·diff check PASS. 테스트는 실제 MUI 입력과 상태 전달을 검사하며 선택창만 경계 mock이다. 실제 선택창4개 회귀·21개 Tab/한영 검사는 관련 동작 변경이 없어 기존 기록을 재사용했다. 전체599개·BE 빌드·기존 저장 E2E는 반복하지 않았다. 새 의존성/상시 테스트 훅은 없다.

## 증빙과 잔여 범위

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/color-adapters-keyboard`의 cleanup-plan.md, line-before-aria.txt/line-before.png, tests-before.log/tests-after.log, heatmap-after.png/heatmap-mobile.png, rapid-after.png, mixed-after.png/mixed-mobile-final.png, mixed-aria.txt, results.json, types.log/lint.log/build.log. 빠른 입력 최초 실패는 값 관찰 기록이며 실패 당시 스크린샷은 없다. 중간 테스트2개 실패는 미설치 toHaveValue matcher 때문으로 기본 value 비교로 수정한 뒤5개 통과했다.

폭포수 차트는 현재50개 타입 목록에 없어 계획한 UI 호출자를 실행하지 못했고 히트맵으로 대표 확인했다(NOT_RUN, 폭포수 통과 아님). SelectChipForm은 src에 호출자가 없어 제외했다. ColorField의 중첩 series 팔레트는 단위 검증만 했으며 브라우저에서는 루트 팔레트를 확인했다. 복합 차트 호출자 자체의 기존 중첩 상태 변경 패턴은 이번 어댑터 불변성 검사 범위 밖이다. 모든50개 차트의 속성·원시 입력 오류 조합·저장 영속화·실제 VoiceOver를 완료했다고 확대하지 않는다.

DESIGN-04는 부분 완료 유지. 전체130개 중129완료/1부분 완료/0미검증. 실제 VoiceOver BLOCKED와 다른 화면 전체 키보드 경로가 남아 있다.
