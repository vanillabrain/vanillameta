# 분석 화면 UI Kit

UI-001 전환 기준: 모든 공통 제어 UI는 공식 shadcn Radix 컴포넌트와 Tailwind를 사용한다. 원본은 `frontend-web/src/components/analysis/AnalysisUi.tsx`, `frontend-web/src/components/ui/`, 공유 토큰은 `frontend-web/src/styles/tokens.css`이며 `src/index.css`에서 가져온다. 이전 MUI UI Kit는 e8f657fd 이전 이력에 있으며, 당시 화면 PASS를 새 구현의 검증 결과로 재사용하지 않는다.

## 공통 기준

| 요소      | 구현                                                          | 기준                                               |
| --------- | ------------------------------------------------------------- | -------------------------------------------------- |
| 일반 액션 | shadcn Button                                                 | default32px/lg36px, sm28px 분석 밀도; variant 사용 |
| 분석 선택 | AnalysisChoice → Button outline/sm                            | aria-pressed와 의미 토큰의 선택 상태               |
| 입력      | TextField → Field/FieldLabel/Input 또는 Textarea/NativeSelect | 32px 입력, 고유 id/label 및 aria-describedby       |
| 공지/오류 | Notice → Alert/AlertDescription                               | 오류 destructive, role=alert, 본문 유지            |
| 보기 그룹 | analysisModeGroupClassName                                    | 테두리, 내부 여백, gap와 그룹 이름                 |
| 패널      | analysisPanelClassName                                        | border/bg-muted 의미 토큰,12px 여백                |
| 표        | shadcn Table 및 analysisTableCellClassName                    | 숫자 tabular-nums, 12px/6px・8px 셀 밀도           |
| 모달      | Dialog/AlertDialog                                            | Title/Description, 실제 portal와 focus 관리        |

AnalysisUiProvider는 `data-analysis-ui`가 있는 Tailwind 컨테이너다. 부모 descendant selector로 자식 버튼의 높이를 강제하지 않는다. 일반 버튼/필드의 variant/size를 선택하며 화면마다 색/폰트 예외를 쌓지 않는다. Portal도 전역 CSS 변수 토큰을 사용한다. 앱 분기는 sm600/md900/lg1200을 유지하고 JavaScript matchMedia도 같은 값을 사용한다. 랜딩은 마케팅 레이아웃의 md768/lg1024를 별도로 유지한다. 일반 버튼과 데이터 행의 높이를 일괄 강제하지 않는다.

## 보존할 동작

기간/타임존/필터/숫자 정밀도/단위, CSV와 저장 보기, 선택 분석/지표 snapshot의 원자 저장, 기존 블록 ID/폭별 좌표/복제/undo-redo는 디자인 변경과 분리한다. 긴 축/이름의 wrap, 표 내부 가로 스크롤, 오류/빈 결과/로딩 문구와 키보드 포커스를 유지한다. 실제 계산 geometry나 chart 수치/사용자 색은 동적 style을 사용할 수 있으며 정적 UI 디자인은 Tailwind를 사용한다.

## Rill 비교와 검증

Rill은 Explore/Pivot의 밀도와 탐색 UX 기준이다. 로컬 Rill의 h-7/text-xs 밀도에 맞추어 분석 버튼은 shadcn sm28px를 사용한다. 대화/블록/게시 화면은 제품 여정에 맞추며 Rill로 제한하지 않는다.

새 구현의 실제 기능/디자인 PASS는 UI-001 검증 증빙에서 판정한다. 기존 MUI 시점의 1440/390 화면, 숫자/API와 이전 테스트 결과를 새 화면 PASS로 주장하지 않는다. 동일 데이터/기간/필터의 수치와 렌더링을 분리하고 390/768/1440 대표 폭, 긴 이름/빈 결과/오류/포커스 상태를 Ego 실제 화면으로 확인한다.

- 실행 계획: [UI-001](../plans/UI-001-shadcn-tailwind.md)
- 공통 검증 기준: [workflow](../testing/workflow.md)
- 이전 적용 여부 감사: [baseline audit](shadcn-tailwind-audit.md)

DialogContent의 desktop 최대 폭은 `sm:max-w-*`로 명시해 공식 기본값과 같은 breakpoint에서 덮어쓴다. 긴 미리보기는 header/body/footer를 나누고 가운데 body만 `min-h-0`과 스크롤을 갖게 한다. 직접 트리거가 없는 모달은 닫힘 시 원래 실행 버튼으로 포커스를 복구한다.
