# shadcn・Tailwind 디자인 적용 점검 — 전환 전 기준

- 점검일: 2026-10-15 (Asia/Seoul)
- 기준: `develop-v2`, `e8f657fd3fee467315ff6e722c6f85004385f9ab`
- 작업: 별도 managed worktree, `codex/shadcn-design-audit`
- 요청: 모든 디자인을 shadcn 컴포넌트 + Tailwind로 구성하라는 지시의 이행 여부 확인
- 범위: frontend-web 의존성/lockfile/빌드/CSS/공통 UI/라우트와 화면 소스, 별도 landing-page

이 문서는 e8f657fd의 **전환 전 감사**다. 후속 [UI-001](../plans/UI-001-shadcn-tailwind.md) 전환은 완료했으며, 현재 판정과 실제 화면·테스트 증빙은 [최종 검증](../testing/shadcn-tailwind-migration.md)을 따른다. 아래 미적용 판정을 후속 구현의 현재 상태로 읽지 않는다.

## 판정: 미충족

현재 frontend-web은 **MUI + Emotion 기반의 테마, sx/styled, 일반 CSS와 inline style**을 사용한다. shadcn・Tailwind 기반으로 전환되었다는 구현 증거가 없다. 최근 AI Assistant와 분석 Explore/Pivot에도 MUI를 사용한다. 일부 오래된 화면만 남은 상태로 볼 수 없다.

shadcn은 컴포넌트 소스를 프로젝트에 두는 방식이므로 `shadcn` npm 의존성 유무만으로 판정하지 않았다. 컴포넌트 구현, 스타일 처리, 앱 provider와 실제 라우트의 import를 함께 확인했다.

## 기반과 공통 UI

| 점검 항목       | 현재 증거                                                                                                                                                             | 판정                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Tailwind 의존성 | frontend-web/package.json 및 package-lock.json에 tailwindcss / @tailwindcss 패키지 없음                                                                               | 미적용                         |
| Tailwind 처리   | vite.config.ts에는 React・SVGR 플러그인만 있으며 Tailwind 플러그인 없음. 추적 파일에 Tailwind/PostCSS 설정 없음. src/index.css에 Tailwind import/directive/theme 없음 | 미적용                         |
| shadcn 구성     | components.json, src/components/ui 디렉터리 없음. 생산 JS/TS 소스에 shadcn/Radix/Base UI/CVA/tailwind-merge 참조 없음                                                 | 미적용                         |
| 앱 테마         | src/index.tsx:5,36의 MUI ThemeProvider, src/App.tsx:5,69의 CssBaseline, src/theme/theme.tsx:1의 createTheme                                                           | MUI                            |
| 버튼            | src/components/button/AddButton.tsx:2의 MUI Button 및 :8의 sx                                                                                                         | MUI                            |
| 입력・폼        | src/components/form/TextFieldForm.tsx:2의 FormControl/FormLabel/OutlinedInput/Stack                                                                                   | MUI                            |
| 모달            | src/components/ModalPopup.tsx:1의 Modal/Paper/IconButton/Stack/Typography                                                                                             | MUI                            |
| 확인・알림      | src/components/alert/index.tsx:3-9의 MUI Dialog/Button/Alert/Snackbar, src/contexts/AlertContext.tsx:3의 react-alert                                                  | MUI + react-alert              |
| 날짜 선택       | src/components/form/DatePicker.tsx:5-10,21-22의 MUI X 날짜 선택                                                                                                       | MUI X                          |
| 분석 UI Kit     | src/components/analysis/AnalysisUi.tsx:2-3의 MUI Button/theme, AnalysisUiProvider 및 AnalysisChoice                                                                   | MUI                            |
| 문서와 지시     | docs/design/analysis-ui-kit.md는 MUI Button・scoped theme・sx를 공통 기준으로 명시하고 AGENTS.md는 이를 재사용하도록 안내                                             | shadcn・Tailwind 방향과 불일치 |

Emotion은 package.json 의존성 및 MUI styled 기반에서 확인했다. 생산 소스의 직접 `@emotion/*` import는 0개이며 직접 import 수와 간접 사용은 다르다. lockfile의 clsx는 MUI에서도 사용하므로 shadcn 적용 증거가 아니다.

## 소스 규모

frontend-web/src의 .ts/.tsx/.js/.jsx를 파일 단위로 검색했다. `.test.` / `.spec.` 및 setupTests.ts는 제외했다. 타입 선언・유틸리티・비라우트 소스도 포함하며, AST 분석이나 실행 시 도달 가능성 계산은 아니다. 아래 항목은 서로 중복될 수 있다.

| 검색 항목                                    | 파일 수 |
| -------------------------------------------- | ------: |
| 생산 JS/TS 소스 전체                         |     209 |
| @mui/\* import                               |     126 |
| @mui/material 및 하위 import                 |     125 |
| sx 속성/정의                                 |     116 |
| JSX inline style 속성                        |      42 |
| styled(...) 호출                             |       7 |
| shadcn/Radix/Base UI/CVA/tailwind-merge 참조 |       0 |
| Tailwind/theme directive 참조                |       0 |

MUI material 참조는 공통 components 41개, pages 49개, layouts 6개, widget 26개, 앱 진입/앱/전역 테마 3개다. 이 수치는 화면 수・UI 컴포넌트 수・전환 완료율을 의미하지 않는다. 소스별 목록은 저장소 밖 `/private/tmp/vm-shadcn-design-audit-20261015/inventory.json`에 보존했다.

## 활성 화면과 별도 랜딩 페이지

앱 라우트는 frontend-web/src/router/index.tsx:9-30,45-86에서 확인했다. 아래는 대표 구현 근거이며 화면별 컴포넌트 전체 개수는 아니다.

| 영역                    | 대표 소스와 근거                                                                  | 현재 구성                                                                        |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 앱 레이아웃/헤더        | src/layouts/Layout/index.tsx:2, src/layouts/Header/index.tsx:2                    | MUI Box/Stack/AppBar/Toolbar                                                     |
| Assistant 생성/미리보기 | src/pages/Dashboard/Components/DashboardAssistant.tsx:15,24                       | MUI + AnalysisUiProvider                                                         |
| 대시보드 블록 편집      | src/pages/Dashboard/DashboardEdit/index.tsx:22,28                                 | MUI + AnalysisUiProvider, 배치 canvas는 react-grid-layout                        |
| Explore/Pivot           | src/pages/Explore/SourceExplore.tsx:14,22 및 ExplorePivot.tsx:2, PivotTable.tsx:2 | MUI + 분석 UI Kit/직접 스타일                                                    |
| 데이터/지표/파일 분석   | src/pages/Data/FileAnalysis/index.tsx:2, src/pages/Data/Metric/index.tsx:18       | MUI 입력/Select/버튼 등                                                          |
| 위젯 생성               | src/pages/Widget/WidgetCreate/index.tsx:2                                         | MUI Stepper/버튼/Stack 등                                                        |
| 인증/공유               | src/pages/Login/index.tsx:3, src/pages/Share/index.tsx:4                          | MUI 폼/Card/레이아웃                                                             |
| Commerce                | src/pages/Commerce/index.tsx:22, router/index.tsx:64-65                           | MUI. 실제 등록된 라우트이며 단순 미사용 데모로 제외하지 않음                     |
| 별도 landing-page       | landing-page/index.html:37,43,48-50 및 package.json                               | 정적 HTML + Bootstrap CSS 5.2.3/JS 5.2.2 CDN + 일반 CSS. shadcn・Tailwind 미적용 |

Rill 참조 저장소의 Tailwind 사용이나 차트용 샘플 파일은 VanillaMeta 앱에 shadcn・Tailwind가 적용되었다는 근거가 아니다. 랜딩 페이지는 앱과 별도 배포 영역이며 로컬 소스만 점검했다. 실제 운영 사이트와 이 소스의 일치는 확인하지 않았다. 전체 디자인 개편 범위에 랜딩을 포함하면 정적 HTML 영역도 별도 전환이 필요하다.

## 전환 계획과 종료 조건

이번 작업은 적용 여부 점검이다. 런타임 코드・의존성・기존 테마는 변경하지 않았다. 디자인 전환 구현은 미실행이다.

1. **기반과 기준 정렬**: Tailwind 빌드/CSS 및 shadcn 설정, 의미 기반 색・폰트・radius・간격 토큰을 마련하고 현재 MUI 기반 UI Kit/AGENTS 안내를 새 기준과 맞춘다. 현재 제품 목표의 P1~P5 화면 여정을 지원한다.
2. **공통 UI 교체**: 버튼・입력・Select・Checkbox・Switch・Dialog/AlertDialog・알림・Card・Tabs・Table・메뉴・날짜 선택을 공통 shadcn 컴포넌트로 구성한다. 기존 wrapper가 새 공통 UI를 사용하도록 바꾸고 호출부의 sx/테마 의존도도 함께 제거한다.
3. **제품 여정 순서로 화면 이동**: 앱 shell/인증 → Assistant/생성・미리보기 → 블록 직접/AI 편집 → 저장・복제 → 게시/공유 → 데이터/지표/Explore/Pivot 순으로 전환한다. 한 화면의 버튼만 바꾸고 화면 전체가 전환되었다고 판정하지 않는다.
4. **전문 도구 검토**: ECharts, Ace, react-grid-layout, Toast UI Grid, react-color는 각각 렌더링/편집/배치/표/색 선택을 담당한다. shadcn의 일반 UI 대체와 별도로 화면별 처리 범위를 기록한다. 제품 숫자・SQL・저장・게시・undo/redo・반응형 배치 계약을 유지해야 하며, 시각 영역도 공통 토큰과 제어 UI에 맞추어 검증한다. 특히 Toast UI Grid/react-color의 독립 디자인을 남긴 상태는 엄격한 전체 디자인 통일 완료로 보고하지 않는다.
5. **완료 검증**: 대상 production UI의 MUI/MUI X・MUI theme/sx/styled 의존을 제거하고 Tailwind 처리 및 shadcn 실제 사용을 소스와 빌드로 확인한다. 불가피한 전문 도구 예외는 명시적으로 합의된 범위만 기록한다. 주요 화면을 390/768/1440 대표 폭과 정상/로딩/빈 결과/오류/포커스 상태에서 실제 캡처로 확인한다. 로그인・분석 생성/미리보기・블록 편집/undo/redo・저장/새로고침・복제・게시/공유 회귀를 검증하고 기능과 디자인 결과를 나누어 보고한다.

## 이번 점검의 검증 범위

- **확인 완료**: 기준 SHA/워크트리, 패키지와 lockfile, 빌드/CSS 설정, 소스 파일별 참조, 공통 UI와 문서의 구현 근거.
- **FAIL — 요구사항 이행**: 모든 디자인이 shadcn・Tailwind로 구성되었다는 조건을 충족하지 않는다.
- **NOT_RUN**: 실제 브라우저/모바일 디자인 평가, 기능 단위/E2E, 타입/린트/빌드, 운영 배포 확인. 구현 변경 없는 소스 기술 스택 감사이므로 해당 검사를 실행하지 않았다. 실행 화면의 시각적 품질이나 기존 기능 성공/실패를 이 점검으로 판정하지 않는다.
