# DESIGN-04 — 색상 선택창 키보드 후속

2026-10-13, develop-v2 시작 `f2aea926`. FE3483/API4683·기존 격리 DB·승인된 headed Chromium 재사용. Numeric Board 생성의 데이터셋25 경로는 화면 준비에만 사용했다. 기존 생성·계산·저장·AI 검증을 다시 판정하지 않았다. AI는 Codex gpt-6-luna 유지, 호출0.

## 실제 VoiceOver 재시도

BLOCKED 유지. `computer-use` 가이드를 읽고 Orca capabilities/list-apps를 시도했으나 runtime_unavailable이었다. 가이드의 open→재시작 경로도 runtime_open_timeout으로 종료됐다. CUA는 두 Chromium 버전의 동일 bundle ID를 모호하게 처리했다. 명시적인 chromium-1243 앱 경로를 선택해도3470/signup 창을 반환했고, 실제 검증 페이지3483/commerce/1을 bringToFront한 후에도 같은 다른 창이었다. 해당 창에는 입력을 보내지 않았다. VoiceOver를 켰다고 주장하거나 AX 트리로 발화를 대신 판정하지 않았다. 다른 브라우저/프로세스는 종료하지 않았다.

## 발견·수정

- HEX를3자리 `abc`까지 실제 입력하면 react-color의 onChangeComplete가 창을 닫아6자리 입력을 끝낼 수 없었다. 색상은 창 안에서 편집하고 명시 적용할 때만 기존 이름/value 이벤트를 전달하도록 수정했다. 취소·Escape·바깥 닫기는 초안을 버린다.
- 기존15개 preset은 tabindex를 가진 div여서 AX에 버튼으로 노출되지 않고 Space 선택을 지원하지 않았다. 기존 색상15개를 ButtonBase·색상 이름·pressed·선택 테두리로 제공한다.
- HEX/RGB는 기존 SketchPicker 입력·포인터 편집을 유지한다. 원시 입력이 잘못됐을 때 적용을 차단하고 안내한다. 같은 색상 preset 선택도 입력을 다시 구성해 잘못된 문자열에서 복구한다.
- 한영 편집 안내·preset 그룹·적용·오류 문구를 추가하고 dialog의 설명에 연결했다. 새 의존성은 없다.

## 검증 결과

| 조건 | 결과 / 범위 |
| --- | --- |
| 느린 HEX 입력 | PASS: 120ms 간격으로abcdef6자리 입력 후 창 유지. 수정 전 abc3자리에서 닫힘 실패 증빙과 구분. |
| Tab 순환 | PASS: HEX/R/G/B4개·preset15개·취소/적용2개, 총21개 대상 이름·solid outline 확인. |
| preset·적용 | PASS: #D0021B 버튼 Space→pressed=true→적용 Enter, 부모 색상 아이콘의 fill=#D0021B. 위젯 저장은 실행하지 않았다. |
| 취소·복귀 | PASS: abcdef 편집 후 취소 Enter→기존 #4A4A4A 유지, 다시 열면4A4A4A. Escape→색상 버튼 복귀. |
| 잘못된 입력 복구 | PASS: 모바일 xyz 입력→적용 disabled, 현재 색상과 같은 #D0021B preset Space→유효 D0021B로 복귀. |
| 모바일 | PASS:390×844, 페이지 scrollWidth=viewport=390. 최종 dialog248×467, top361·bottom828로 화면 안에 유지. 최초 캡처는 opacity 전환 중이므로 최종 이미지로 다시 확인했다. |
| 한영 | PASS: 실제 English 전환 후 이름 있는 Pick a color dialog·안내·Preset colors·Cancel/Apply 확인, 한국어 복귀. |
| 저장 경계 | PASS: 관찰된 widget/AI 변경 요청0. 선택한 색상은 생성 폼의 미저장 상태만 바뀐다. 저장 영속화 검사는 기존 결과 재사용. |

실제 MUI/SketchPicker 회귀4개 PASS: 명시 적용까지 이벤트 없음, 취소 후 원래 색상 재오픈, 잘못된 HEX와 같은 preset 복구, RGB999 차단·0 허용. MUI CJS 진입점은 기존 FormLabels 테스트 방식 재사용하며 컨트롤을 가짜로 대체하지 않았다. jsdom Canvas getContext 미지원 경고가 있으며 픽셀/그라데이션 검증은 실제 브라우저에서 관찰한 범위와 구분한다. FE 타입·대상 lint·빌드·diff check PASS. 전체599개 테스트·BE 빌드는 반복하지 않았다.

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/color-picker-keyboard`: `before-aria.txt`, `before-desktop.png`, `after-aria.txt`, `english-aria.txt`, `results.json`, `after-desktop.png`, `invalid-mobile.png`, `after-mobile-final.png`, `popup-mobile.png`, `popup-english.png`, `tests.log`, `types.log`, `lint.log`, `build.log`. 로케일 코드 HMR 전체 reload로 위젯 준비가 초기화된 첫 재검증은 locator timeout이었다. 다시 폼을 준비한 이후 결과만 PASS로 사용했다.

실제 VoiceOver·native 달력/OS 파일 창·다른 모든 차트 속성·별도 ColorField/ColorButton/SelectChip 계열·모든 포인터/오류 조합은 미검증이다. DESIGN-04 부분 완료,130개 중129완료/1부분 완료 유지. 접근성 전체 준수로 확대하지 않는다.
