# DESIGN-04 — 날짜·파일 팝업과 차트 설정 키보드 후속

2026-10-13, develop-v2 시작 `5f01ac2a`. 기존 날짜 입력/필터 계산·파일 저장·숫자판·색상 선택창 통과는 재사용한다. 실제 VoiceOver는 BLOCKED로 유지하고 AI는 Codex gpt-6-luna 설정을 변경하지 않는다.

## 선택 명세

| ID | 조작·기대 | 결과 |
| --- | --- | --- |
| POPUP-01 | 시작/종료 날짜의 달력 버튼에 Tab 진입, Space 열기, 방향키 일/주 이동, Enter 확정·Escape 닫기, 입력값/복귀 포커스 확인. 1440/390px | PASS_SELECTED_VARIANTS: 시작2026-10-21/종료2026-10-05, 확정/취소 후 달력 버튼 복귀. 월·연 변경 전체는 NOT_RUN |
| POPUP-02 | 파일 버튼 Tab/Space 또는 Enter로 실제 OS 대화상자 열기, 공개 샘플을 목록 방향키/Enter로 선택, 재열기/Escape 취소 시 기존 파일과 버튼 포커스 유지. 업로드 저장은 실행하지 않음 | PASS_SELECTED_VARIANTS: macOS 주문 CSV 선택/취소, 390px에서도 열기/취소. 휴대폰 OS 선택창은 NOT_RUN |
| CHART-KEY-01 | 선형 설정의 축·필드·집계·레이블·표시·범례를 키보드 조작하고 실제 선택값 확인 | PASS_SELECTED_VARIANTS: total/최소/표시/mark 없음/아래쪽/범례 집계 표시, 390px 12개 Tab 대상 |
| CHART-KEY-02 | 추가/삭제 아이콘에 이름, Enter/Space 시리즈 추가/삭제, 마지막 추가 항목 삭제 후 안정적인 추가 버튼에 초점 유지 | FAIL→PASS_SELECTED_VARIANTS: 이름 없음·삭제 후 BODY 포커스 수정. 선형 desktop/mobile 실제 삭제 후 항목 추가에 초점 |
| CHART-KEY-03 | 원형의 이름·필드·레이블·집계·범례, 분산형의 축·레이블·크기 등 서로 다른 속성 키보드 조작 | PASS_SELECTED_VARIANTS: 원형 total/퍼센트/평균/아래쪽, 분산형 X/Y total/크기25/표시/아래쪽. 390px |
| CHART-KEY-04 | 표 설정의 열 추가/삭제·필드·제목·병합 라디오·정렬에 이름과 키보드 조작, 390px에서 초점/가로 overflow 확인 | FAIL→PASS_SELECTED_VARIANTS: 라디오 그룹 이름·중복 ID 수정, 방향키 병합/분리·Right 정렬, 마지막 열 삭제 후 항목 추가 초점 |

같은 설정 모듈을 공유하는 차트는 코드 공유 범위와 실제 실행한 차트 종류를 구분한다. 모든 50개 차트의 렌더·저장 완료로 확대하지 않는다. 새 MD 조건만 선택하며 기존 저장/계산 정답은 다시 판정하지 않는다.

## 환경과 실제 조작

FE3483/API4683의 기존 격리 서버·메타데이터·업로드 볼륨을 재사용했다. Node24.21.0으로 하위 검사를 실행했다. Aside guide/repl을 읽고 목록 조회를 시도했으나 daemon 인증 challenge fetch 실패였다. 기존 허용된 headed Chromium과 CUA 네이티브 키 입력으로 대체했다. 1440×900/390×844는 Chromium viewport이며 실기기 테스트가 아니다.

승인된 로컬 검증 계정5로 로그인하고 기존 Commerce 샘플2·데이터셋 `권한 확인 60`을 읽었다. 과거 기록의 다른 테스트 계정 매칭 실패와 중복 Chromium 창/파일 경로 입력 시간 초과는 준비 과정 오류이며 제품 실패로 집계하지 않는다. 토큰·암호는 증빙에 출력하지 않았다.

날짜는 Tab으로 Chromium 달력 버튼에 진입해 Space로 열고 Right/Down으로 시작일21, Up/Left로 종료일5를 선택했다. Enter 확정과 재열기/Escape 후 해당 달력 버튼에 포커스가 돌아왔다. Chromium은 방향키 이동 중에도 입력값을 변경한다. 역순 draft는 적용하지 않고 화면을 떠났으며 기존 날짜 계산/오류 안내 테스트를 반복하지 않았다. 월 선택 화면의 Tab/Space 진입은 관찰했지만 월 변경 확정은 증명하지 못했으므로 해당 변형은 NOT_RUN이다.

파일은 실제 macOS 파일 선택창을 열어 공개 `backend-api/src/commerce/samples/orders.csv`를 목록 방향키/Enter로 선택했다. 주문 버튼의 ORDERS.CSV 표시·9열/표본5행 미리보기와 버튼 포커스, 재열기/Escape 후 선택 유지, 390px에서 Enter 열기/Escape 취소를 확인했다. setInputFiles로 이 검증을 대신하지 않았다. CSV 가져오기/서버 저장·나머지 세 파일 선택창·버전 교체 선택창은 실행하지 않았다.

선형은 필드·축 total, 레이블 `Keyboard series`, 최소 집계/넘버 표시/마크 없음/범례 아래쪽·집계 표시를 실제 메뉴 Space/방향키/Enter로 지정했다. 원형은 이름/필드 total·레이블 퍼센트·집계 평균·범례 아래쪽, 분산형은 레이블 `Keyboard scatter`·두 축 total·크기24 입력 후 Up으로25·넘버 표시·범례 아래쪽을 확인했다. 미리보기의60은 준비 데이터 관찰이며 계산 정답을 재판정하지 않는다. 색상 선택창은 기존 통과를 재사용했다.

표는 첫 컬럼 total/제목 `Total keyboard`를 키보드로 지정하고 라디오 Right→분리/Left→병합, 정렬 End→Right를 확인했다. 추가 후 rowSpan1/2/3 각각 `컬럼 병합 1/2/3`으로 구별되고 라디오 ID 중복이 없었다. Tab/Shift+Tab으로 마지막 삭제에 진입해 Space 삭제 후 rowSpan1/2와 제목·첫 병합 선택을 유지하고 항목 추가에 초점이 돌아왔다. 390px과1440px의 document 폭이 각각390/1440이었다.

## 수정과 회귀

- 공통 추가/삭제 아이콘 버튼에 한영 기본 접근성 이름을 제공하고 호출자 명시 이름은 보존했다.
- 마지막 시리즈/컬럼 삭제 시 제거될 버튼 대신 같은 설정 섹션의 추가 버튼으로 초점을 돌린다. 기존 목록/저장 로직은 유지한다.
- RadioForm은 useId 또는 호출자 ID로 라벨·그룹을 연결하고 각 라디오의 중복 ID를 제거했다. 표 호출자는 컬럼별 고유 이름·ID를 지정한다.

실패를 재현한 버튼/라디오 회귀4개와 기존 라벨/위젯 UI 회귀를 포함한31개가 통과했다. 타입 오류(NodeList spread)와 신규 서식 오류를 수정한 뒤 해당7개만 재검사했다. FE 타입·변경 파일 lint·production build·diff check 결과는 증빙 로그에 남긴다. lint의 기존 미사용 변수 경고3개, Vite 설정/Toast UI CSS 빌드 경고는 남아 있다. 전체 단위/E2E·BE 빌드·기존 저장 케이스를 반복하지 않았고 새 UI 자동화 프레임워크·의존성은 추가하지 않았다.

인증 준비 이후 관찰한 POST/PUT/PATCH/DELETE 요청0·AI 호출0이다. 새 소스/위젯/대시보드를 저장하지 않았다. Codex gpt-6-luna 제공자·연결/catalog 설정은 변경하지 않았다. VoiceOver 제어 설정을 건드리지 않았으며 실제 발화 DETAIL-SR-02는 BLOCKED 유지다.

## 증빙과 제한

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/native-popups-chart-keyboard`:

- 날짜: `date-checks.json`, `calendar-mobile-ax.txt`, `calendar-mobile.png`, `calendar-desktop.png`, `calendar-selected-desktop.png`. 네이티브 앱 캡처는 팝업 레이어를 포함하지 않을 수 있어 열린 날짜 셀 선택은 AX 기록, 확정 값은 캡처/입력값으로 확인한다.
- 파일: `file-dialog-orders-desktop.png`, `file-selected-desktop.png`, `file-dialog-mobile.png`, `file-selected-mobile.png`. `file-checks.json`/`file-page-state.png`는 경로 준비 중 빈 input 기록이며 최종 파일 선택 증거가 아니다.
- 실패: `chart-line-before-aria.txt/png`, `delete-last-before-ax.txt`, `table-before-aria.txt/png`, `buttons-before.log`, `radio-before.log`.
- 최종: `verification-results.json`에 환경·커밋/diff·파일 hash·케이스 결과를 기록했다. 상세 `chart-checks-final.json`, `line-settings.json`, `line-mobile-focus.json`, `line-desktop-after.png`, `line-mobile-after.png`, `pie-mobile.png`, `scatter-mobile.png`, `scatter-desktop.png`, `table-final-ax.txt`, `table-mobile-final-before-remove.png`, `table-mobile-final.png`, `table-desktop-final.png`.
- 검사: `unit-final.log`, `unit-final-recheck.log`, `types.log`, `lint.log`, `build.log`, `mutation-requests.json`. `tableBeforeRemove`는 HMR 중간 상태이며 최종 판정은 `tableFinalBeforeRemove`/`tableFinalAfterRemove`다. 페이지의 기존 styled-menu/__react-alert__ ID 중복은 이번 라디오 수정 범위 밖으로 남긴다.

다른 차트별 전체 속성·결과표 셀 편집·월/연 전체 조합·실제 iOS/Android OS 선택창·VoiceOver는 미검증 또는 BLOCKED다. DESIGN-04는 부분 완료, 기존 카탈로그130개 중129완료/1부분 완료 집계를 유지한다.

이번 검증 전용 Chromium9338·probe 세션을 종료하고 임시 읽기 스크립트를 삭제했다. 기존 FE/API 서버는 유지한다. 변경 사항은 develop-v2 작업 트리에 남겼으며 이 요청에서 커밋은 실행하지 않았다.
