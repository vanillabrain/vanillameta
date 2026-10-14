# 분석 화면 UI Kit

Explore/Pivot의 조밀한 컨트롤과 상태를 Rill 기준으로 통일한다. 구현 원본은 `frontend-web/src/components/analysis/AnalysisUi.tsx`다. 화면에서 직접 버튼 크기를 덮어쓰거나 부모 descendant selector로 최소 높이를 강제하지 않는다.

## 기준과 적용

| 요소                | 기준                                            | 적용                                          |
| ------------------- | ----------------------------------------------- | --------------------------------------------- |
| 일반 액션·선택 버튼 | 높이/최소 높이28px,12px,좌우8px,반경4px         | AnalysisUiProvider 아래 MUI Button            |
| 선택 상태           | 옅은 indigo 배경·텍스트·테두리, aria-pressed    | AnalysisChoice / analysisToggleSx             |
| 보기 전환           | 한 테두리 안의 버튼,내부2px 여백                | analysisModeGroupSx, group와 접근 가능한 이름 |
| 입력·선택           | 32px,12px,반경4px                               | scoped theme / analysisFieldSx                |
| 필터·선택 칩        | 높이24px,12px,삭제 아이콘16px                   | scoped MUI Chip                               |
| 패널                | 여백12px,반경4px,옅은 배경·1px 테두리           | analysisPanelSx                               |
| 툴바 간격           | 기본8px,그룹 간12px                             | wrap 행은 gap 사용, sibling margin 중첩 금지  |
| 표                  | 12px,line-height1.5,셀6px/8px,숫자 tabular-nums | analysisTableCellStyle                        |
| 제목·보조           | 페이지 제목20px,본문13px,보조12px               | scoped typography / 의미에 따른 명시적 스타일 |

일반 버튼과 데이터 행은 역할이 다르다. 순위의 범주/수치 버튼은 내용 높이를 사용하며 비교값이 있으면 더 높게 표시한다. 시간·숫자 정밀도·통화·필터·저장/내보내기 계약을 디자인 때문에 바꾸지 않는다. 긴 축 이름은 좁은 화면에서 전체 행을 사용하고, 표는 결과 영역 내부에서 가로 스크롤한다.

AnalysisUiProvider는 기존 테마를 상속하는 국소 테마다. SourceExplore의 최상위 경계에 한 번 적용하며 하위 Explore/Pivot/저장 보기/내보내기 및 React portal에서 사용하는 MUI 요소에 적용한다. 다른 페이지의 전역 테마를 수정하지 않는다. 새로운 분석 화면도 같은 경계를 재사용하고 추가 예외는 역할·이유를 기록한다. 별도의 의존성을 추가하지 않았다.

## 상태

- 기본: 중립 텍스트·경계, 액션은 text 버튼을 사용할 수 있다.
- 선택: aria-pressed와 시각적 선택을 함께 표시한다. hover도 옅은 선택 배경을 유지한다.
- 비활성: 옅은 텍스트·투명 배경으로 표시하고 MUI disabled 계약을 유지한다. 선택 스타일보다 비활성 표시가 우선한다.
- 포커스: 키보드 focus-visible 테두리2px/offset2px를 유지한다. 전역 접근성 CSS가 색을 지정할 수 있다.
- 로딩·오류·빈 결과: 기존 status/Alert와 도움 흐름을 유지한다. 성공 화면 대신 숨기거나 데이터를 임의로 채우지 않는다.

## Rill 대조와 실행 증거 — 2026-10-14

로컬 Rill의 `web-common/src/components/button/Button.svelte`는 h-7/min-height28px·text-xs 기본값이다. 실제1440×900 Pivot Flat 선택 버튼은22px/12px/좌우8px로 측정됐다. VM의 일반 버튼28px는 기본 버튼 밀도를 따르며 모든 Rill 컨트롤을 같은 높이로 복제했다고 주장하지 않는다. Rill의 Pivot/Flat 선택,축 칩,12px 표,옅은 비활성 상태 및 Explore 툴바를 실제 화면과 비교했다. VM은 기존 select 기반 축 배치와 별도 계층/시간 행을 유지한다. Rill의2px 반경·별도 변화 열·더 조밀한 전체 배치와는 차이가 남는다.

- **PASS — 실제 디자인**: Aside1440×900 Explore/Pivot,필터 패널·칩 및 Codex 브라우저390×844 Explore/Flat을 캡처했다. 버튼28px/12px/좌우8px,축 입력32px/12px,필터 칩24px/12px를 측정했다. 좁은 화면의 줄바꿈·선택·비활성·키보드 포커스를 확인했고 document scrollWidth375px/innerWidth390px로 페이지 가로 넘침이 없다. 임시 viewport를 복구했다.
- **PASS — 기능**: 전체 기간634,513,000/$5.57 유지,Connected Device 필터17,000/$9.51과 칩 삭제를 확인했다. SourceExplore/ExploreExport 단위68개,FE 타입·변경 파일 린트·빌드·공백 검사. 단위의 MUI mock은 테마 API를 명시적으로 분리하며 디자인 판정은 실제 브라우저로 수행한다.
- **NOT_RUN**: 전체 E2E·BE 재검사·운영,모든 뷰포트/hover 변형/접근성,portal 전체 화면,신규 XHR 수집. 기존 수치·저장/CSV 검증은 로직 변경이 없어 재사용한다. Rill이 이동한 시점과 VM 원본 시점의 기간 버킷 수치 동등성 및 픽셀 단위 UI 동등성은 주장하지 않는다.

증빙은 저장소 밖 `/tmp/vm-analysis-ui-kit/`에 보존한다. 변경 전 기준은 직전 커밋bb0e9975의 `/tmp/vm-pivot-design/compact-1440.png`이며 Rill reference/Explore/Pivot/filter/390px 캡처와 테스트·빌드 로그를 함께 기록한다.

## AI 분석 적용 후속

생성/수정 미리보기·저장 조회에 국소 AnalysisUiProvider를 적용하고 숫자+MetricTrend 표시를 통일했다. Assistant 부모 버튼 크기 덮어쓰기는 제거했다. 설정·기간 안내·저장 보기 관리·집계 원본 확인은 native details로 접되 유지한다. 모바일 빈 질문 라벨은 shrink를 사용한다. [AIWF 설계/검증](../testing/simple-analysis-parity.md) 참조.
