# Dashboard Studio MD 검증

## 현재 범위와 실행 기준

2026-10-15, 기준 `5ef232dc` + T1 미커밋 diff. 작업 브랜치 `codex/self-service-next-20261014`. 현재 T1 시안만 구현했다. 본 기록의 PASS는 합성 fixture의 선택된 디자인/상호작용에 한정하며 P1~P5·TC-005 전체 완료가 아니다.

- URL: `http://127.0.0.1:3215/_design/studio` (작업 브랜치 Vite 전용).
- 브라우저: Aside daemon 연결 실패. 허용된 대안인 Codex IAB에서 구조/콘솔을 확인하고 headed Chromium에서 실제 화면·정확한 viewport 캡처를 진행했다. IAB의 기존 확대율로 viewport가 다르게 측정돼 정해진 폭 판정에는 headed Chromium 결과를 사용했다.
- Fixture: 주문·환불 디자인용 가상 데이터. 총매출48,260,000 / 환불1,930,400 / 순매출46,329,600 KRW. 실제 commerce/Rill 검증 oracle로 사용하지 않는다.
- 데이터/API·gpt-6-luna 호출 없음. gpt-6-luna 설정과 VoiceOver BLOCKED 유지.

## MD 케이스

| ID | 조건 / 기대 | 이번 결과 |
| --- | --- | --- |
| STUDIO-D01 | 1440/768px에서 시작·결과·설정·공유 상태, 라벨·간격·숫자 가독성·가로 넘침0 | PASS_SELECTED: 실제 캡처 직접 검토, 두 폭 각각 네 상태 overflow0. 버튼32px/12px Studio 예외 기록 |
| STUDIO-D02 | 390px 네 상태, 긴 블록 제목·오류/로딩, 모바일 패널 키보드/Escape 복귀 | PASS_SELECTED: 네 상태 overflow0. 상태 버튼 간격 수정 후390px 재확인. 768/390 패널 내 Tab 이동·Escape 후 트리거 복귀. 모바일 상태 버튼88.5×44px |
| STUDIO-E01 | 블록 추가·복제·삭제·이동·resize·undo/redo·폭 변경 보존 | NOT_RUN: T2/T3 |
| STUDIO-E02 | 저장·재조회·서버 revision 경합 | NOT_RUN: T4 |
| STUDIO-A01 | 직접 이동 이후 실LLM 선택 수정/배치 보존 | NOT_RUN: T5 |
| STUDIO-A02 | 파일/샘플 생성·canonical 지표·차원 | NOT_RUN: T6 |
| STUDIO-A03 | 단일 입력 실행·부분 실패·재시도 중복0 | NOT_RUN: T7 |
| STUDIO-P01/P02 | 게시 version/시점·권한·중지·실패 재시도 | NOT_RUN: T8 |
| STUDIO-R01/R02 | 새 소스 매핑·누락 열·원본 불변 | NOT_RUN: T9 |

## 발견·수정과 검증 구분

- 모바일 결과 전환에서 AI Drawer가 캔버스를 즉시 가림 → 모바일 결과는 기본 닫힘으로 변경. 명시 AI/설정 클릭 시만 연다.
- 긴 제목/오류 상태에서 상태 selector가 네 상태 버튼을 좁혀 라벨이 붙음 → 상태 selector를 별도 grid 행으로 이동. `failure-mobile-nav-before.png`를 보존하고 같은390px 재검증.
- 기존 제품 disabled 배경이 시안에서 지나치게 진함 → Studio 국소 스타일에서 밝은 배경/경계 적용. 기존 화면 전역 테마는 변경하지 않음.
- FE 타입 검사에서 이전 SourceDetails 테스트의 타이머 callback이 Promise<VitestUtils>를 반환하는 오류3곳 발견 → await 블록으로 void 반환. 해당 기존 한 테스트만 재실행1 PASS/173 skipped. 새로운 기능 PASS로 세지 않는다.

**기능:** 시안 상태 전환·로컬 제목 입력·drawer/dialog 포커스의 선택 범위 PASS. 실제 데이터/필터·LLM/저장/공유 기능은 NOT_RUN.

**디자인:** 4상태×3폭, 긴 제목·오류·로딩 선택 범위를 실제 PNG로 확인. 모든 hover/언어/실데이터·OS·스크린리더 접근성 완료는 아니다. Rill/Claude의 같은 입력·실행 UX 비교는 NOT_RUN이며 문서 레퍼런스 적용이다.

## 증빙과 검사

저장소 밖 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t1-20261015/`:

- `{start,result,settings,publish}-{1440,768,390}.png`
- `long-title-{settings,canvas}-*.png`, `error-*.png`, `loading-*.png`
- `browser-results.json`: 기본12상태 및 패널 복귀/오류/로딩, pageerror0. `browser-mobile-recheck.json`: 최종390px 영향 범위, pageerror0.
- `control-metrics.jsonl`, `lint.log`, `types.log`, `targeted-test.log`, `build.log`.

브라우저 측정의 정상 단계와 오류/로딩 표시를 전체 장애 복구 테스트로 확대하지 않는다. 신규 자동 E2E 소스는 저장소에 추가하지 않았으며 한시 검증 스크립트는 `/private/tmp/`에서 실행했다. 전역 테스트·BE build·실LLM은 UI 시안 범위에 불필요해 반복하지 않았다.

## T2 문서·변경 이력 기반 — 2026-10-15

기준: `52207a67` + T2 diff. 기존 시안 UI를 연결하거나 수정하지 않았다. 아래 결과는 순수 함수/adapter 경계이며 E01/E02 실제 UI·서버 저장의 완료가 아니다.

### 구현

- `StudioDocumentV1`: 안정적 ID, 단일 source, 지표/차원 버전 참조, 12/8/1열 배치. 종류는 기존4종, 편집 중0~6블록. 0개는 임시 편집 상태만 허용하고 저장 projection은 거부한다.
- 클라이언트와 서버에서 독립 문서 검증·불변 연산을 구현했다. 같은 fixture와8개 고정 연산 예제로 계약을 확인한다. 서버는 권위 있는 context를 전달받을 때 정의/지표 버전/차원 source schema 버전을 검사한다. 현재 controller·DB·소유권 조회에 연결하지 않았다.
- 추가·복제·삭제·내용·위치·크기·이름 변경, 중첩 display의 부분 병합. 위치 변경은 해당 breakpoint만 수정하며 겹침은 거부한다. 다른 블록·원본 입력은 보존한다.
- history100단계, undo/redo, 의미상 no-op은 이력 추가 없음, 선택/패널/폭 전환은 이력과 분리. dirty는 마지막 저장 snapshot과 비교한다.
- `saveStarted`에 요청 ID·제출 문서·baseRevision을 기록한다. 저장 응답은 그 제출 문서만 baseline으로 삼고 이후 변경은 dirty로 남긴다. 제출한 임시 ID의 완전한 map, 현재 요청/revision 일치를 요구한다. ID 변환은 present/past/future/selection/baseline/제출 snapshot에 적용한다.
- legacy analysis의 정확한 chart 방향·문구·표시 옵션·SQL·숫자 높이2를 보존한다. SQL은 history 문서에서 제외하고 별도 owner-only 정의 catalog에 보관한다. source/revision이 다른 catalog, 누락 정의/배치, 잘못된 참조는 거부한다.

### adapter 판정과 한계

`fromLegacyAnalysis({dashboardId,analysis,semanticSnapshot?})`는 `{document,definitions,unresolvedReferences}`를 반환한다. 기존 analysis GET에는 저장 당시 metric/dimension 버전이 없어 이를 이름·SQL·현재 catalog 버전으로 추측하지 않는다. 명시적인 snapshot 없이는 refs를 빈 값+unresolved로 남긴다. 이는 확정된 지표 링크가 없다는 뜻이 아니다.

`toLegacySave(document,definitions,expectedRevision?)`는 **기존 /ai/dashboard-save의 요청 body가 아니다**. SQL draft·geometry·semantic refs를 분리한 projection과 `requiresServerSnapshot:true`를 반환한다. revision은 document 또는 별도 serverRevision으로 명시해야 하고 definitions의 기준 revision과 같아야 한다. 기존 save 경로는 structured link를 지울 수 있고 공개 blockLayouts는 읽기 전용이므로 T4에서 서버 원본 snapshot과 함께 저장 adapter를 연결한다. 현재 HTTP 호출은 없다.

최초 md/xs 배치는 lg 시각적 읽기 순서에서 단일 세로 흐름으로 도출한다. 이미 저장된 md/xs가 있다고 주장하지 않으며, 이후 Studio 문서는 각 폭 배치를 독립 유지한다. legacy fallback에 geometry가 없으면 임의 배치를 복원한 척하지 않고 기존 화면 사용을 안내한다.

### 검증

- FE3파일 **30 tests PASS**: ID·배치/내용 격리, history100, redo 무효화, 저장 중 편집, 누락/잘못된 ID map, revision 유실/경합, SQL 분리·정확한 legacy 변환·최대128자 ID, 공통 연산 예제.
- BE3스펙 **99 tests PASS**: strict nested keys, source/정의/지표·차원 버전, safe integer·경계·겹침·중복 ID·sparse 배열, 불변 연산과 공통 예제.
- FE 타입, 변경 FE/BE ESLint 오류0·경고0, BE Nest build PASS.
- 독립 검토에서 발견한 저장 revision 유실·늦은 응답의 clean 처리·불완전한 임시 ID map3건은 회귀 RED→수정 GREEN 후 재검토에서 닫힘.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t2-20261015/` (`frontend-core.log`, `backend-core.log`, lint/types/build, 각 경계의 RED 로그).
- UI·디자인: T1 코드·스타일·route 미변경. T1의 해당 캡처를 재사용하고 새 캡처 PASS는 추가하지 않음. 실제 블록 편집/저장/LLM·Rill 비교는 NOT_RUN. gpt-6-luna 설정·VoiceOver BLOCKED 유지.

다음은 T3: 이 문서/연산을 실제 캔버스·설정·undo/redo 버튼과 연결하고 390/768/1440px 직접 편집을 검증한다.

## T3 실제 로컬 편집 — 2026-10-15

기준: `dde24d16` + T3 diff. 개발 전용 `/_design/studio`의 **합성 데이터**를 T2 문서·history에 연결한다. 실제 데이터 생성/저장/게시/LLM 성공과 구분한다.

### STUDIO-E01 인수 조건

1. 1440px에서 이동 핸들 drag·resize 각각1회 → history1회 증가, undo/redo로 원래 위치·크기 복원. 다른 블록의 내용·ID·배치 불변.
2. 블록 제목 입력 중 방향키는 텍스트 편집, blur/Enter로 적용. 복제는 새 ID·동일 내용, 삭제→undo/redo. 최대6개 제한, 모두 삭제 시 빈 캔버스·추가/undo 가능.
3. 모바일에서 핸들 초점으로 선택하고 순서·크기 버튼을 키보드로 조작. 순서 변경은 해당 폭의 배치만 명시적으로 세로 정렬하며 history1회에 묶는다. 빈 위치로의 방향키 이동은 선택 블록만 변경하고 충돌은 거부한다.
4. 390→768→1440→390에서 선택·제목·history·각 폭의 편집 배치 보존. 좁은 화면 전환은 패널을 닫고 기존 편집은 유지. 패널 Tab trap/Escape·보이는 포커스 확인.
5. 1440/768/390px의 버튼 높이·간격·카드 정렬·긴 제목과 큰 숫자 가시성, 페이지 가로 overflow0. 기능 PASS와 실제 캡처 기반 디자인 PASS 별도 기록.

**설계 판정:** 순서 버튼은 기존 moveBlock 연산들을 클라이언트 `applyBatch`로 묶는다. 중간 배치를 collision-free 임시 공간으로 이동한 뒤 최종 순서를 적용하고, 결과 전체가 검증될 때만 history에 반영한다. 서버 operation 계약은 추가하지 않으며 실제 저장/AI 작업의 batch 수용 여부는 후속 서버 단계에서 결정한다. drag/resize는 stop에서만 한 연산을 보낸다. 창 크기 변경으로 layout을 자동 생성하거나 저장하지 않는다.

### 실행 결과

- **기능 PASS (STUDIO-E01, 로컬 합성 데이터):** 실제 Chromium drag/resize 각각 undo1회, 비대상 배치 불변, 복제 임시 ID·6개 제한, 삭제 undo/redo, 모두 삭제·빈 캔버스·추가/undo, 제목 Enter/blur1회 적용·입력 방향키 분리. 390→768→1440→390에서 선택·제목·history·모바일 배치 복원. Drawer Tab10회·Escape 초점 복귀. 390px 키보드 크기 확대296→358px 및 undo296px.
- **디자인 PASS (선택 상태·3폭):** 1440/768/390px 페이지 overflow0, 카드 겹침0, 기본/긴 제목·전체 숫자 카드 내부 overflowX/Y0. 데스크톱 배치 버튼32px, 모바일44px 이상. 최종 PNG를 직접 확인했다. 모든 언어·최대300자·임의 아주 작은 카드/OS/실기기 완료는 아님.
- 최초 KPI 높이 부족으로 데이터 표 버튼이 가려짐 → 최소/기본 높이5행(296px), 차트6행(358px), 신규 블록에도 같은 크기 적용 후 확인. 패널 닫기 시 위치/폭 전환 애니메이션의 순간 겹침 → Studio grid에서만 transition 제거, 실제 사각형 겹침0 재확인. 기존 제품 경로·전역 토큰은 유지.
- 독립 리뷰의 경계 순서 성공 오안내 → 경계 버튼 비활성화. 모든 UI 변경을 사전 검증·일괄 적용 helper로 통일하고 구체적 검증 오류를 표시. drag/resize 대상 선택, 모바일 접근 가능한 history status, 빈 캔버스의 중복 도움 제거도 반영.
- FE Studio33 tests, 타입·변경 lint·production build PASS. production JS에서 `/_design/studio`/`studio-edit-grid` 미포함 확인. BE/기존 제품 전체 E2E는 관련 변경 없어 재실행하지 않음.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t3-20261015/`의 `browser-results.json`(10개 결과, pageerror0), `design-results.json`, `keyboard-size.json`, `canvas-1440.png`, `switch-{768,1440,390}.png`, `settings-390.png`, `long-{settings,canvas}-*.png`, `empty-390.png`, `keyboard-resize-390.png`, unit/type/lint/build 로그. `initial-1440.png`는 높이 수정 전 기준이다. 임시 검증 스크립트는 /private/tmp에만 두고 신규 상시 E2E를 추가하지 않았다. Aside 데몬 연결 실패로 기존 승인된 headed Chromium 대체 + Codex IAB 화면 확인을 사용했다.

서버 저장/재조회·실데이터 결과·실LLM·게시·전체 TC-005는 **NOT_RUN**. 개발 모드 preview만 연결했고 production 제품 진입은 T4 이후다. gpt-6-luna 설정 유지, VoiceOver **BLOCKED** 유지.

## T4 저장·재조회 — 2026-10-15

기준: `efb64af2` + T4 diff. Studio 문서·legacy 분석/위젯/배치와 저장 요청 journal을 하나의 metadata transaction으로 저장한다. 기존 소스·지표 SQL은 서버에서 조회하며 클라이언트 SQL을 받지 않는다. gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다.

### STUDIO-E02 인수 조건

- 소유자 실제 로그인 → Studio 편집 → 저장 → reload에서 숫자·제목·블록 ID·12/8/1열 배치 복원, 기존 보기의 SQL/숫자·lg 배치 대조.
- 새 블록은 기존 정의 복제만 지원하고 임시 ID→서버 ID remap 후 undo/redo에서도 같은 블록 참조.
- 동일 requestId/body replay는 같은 결과·추가 쓰기0. 다른 body는409. 두 화면의 같은 revision 저장은 하나만 성공하고 충돌 화면의 미저장 로컬 변경을 보존한다.
- 최신 내용 비교와 명시적 재적용/버리기 경로. 네트워크 실패 재시도는 제출 당시 requestId/body를 유지하며 이후 타이핑을 덮어쓰지 않음.
- 원본 source/metric 소유권·버전·dimension schema 불일치·임의 기존 ID·정의 변경은 거부. journal 실패 시 위젯·대시보드·StudioState 전부 rollback.
- 1440/768/390px 실제 화면·키보드와 최종 캡처에서 버튼/숫자/긴 제목 가시성, overflow0. 기존 통과 T3의 무관한 시안 상태는 반복하지 않는다.

검증용 격리 API `127.0.0.1:4324`, FE `127.0.0.1:3224`, DB·uploads는 `/private/tmp/vm-studio-t4-20261015/`. 새 검증 계정·새 CSV 소스만 사용한다. 기존 개발 DB/계정과 환경 파일은 변경하지 않는다. CSV는 Site300 + Mobile200 = 합계500의2행이며 Rill/매출환불 업무 수치 동등성을 대신하는 증빙이 아니다.

### 구현·판정

- 보호된 제품 경로 `/dashboard/:dashboardId/studio`, 기존 보기의 `Studio 편집` 진입과 `기존 보기` 복귀를 연결했다. 제품 경로는 실제 소유자 데이터만 렌더링하며 DEV 시안의 합성 수치·생성/게시 미리보기는 표시하지 않는다.
- GET은 `{document,definitions,preview,previewError?,sourceRevision}`. SQL catalog/집계 rows는 소유자 응답에만 있고 문서/history/journal에는 넣지 않는다. POST는 `{requestId,expectedRevision,expectedSourceRevision,document}`이며 제출 snapshot/파일 버전/요청 ID를 그대로 재시도한다. GET/저장/집계를 같은 immutable DuckDB 파일에 pin한다.
- StudioState 문서(내부 envelope `{document,sourceRevision}`), legacy 분석/위젯/배치와 actor+request unique journal을 한 transaction에서 저장한다. 서버가 기존 SQL·지표 정의를 조회하고 신규 블록은 기존 정의 복제만 허용한다. 블록 ID remap과 lg/md/xs 배치를 보존한다. 서버 저장 snapshot에 BI와 같은 namespace의 dataVersion을 기록한다.
- 기존 metric/dimension 링크와 source/schema version을 유지하며 임의 persisted ID·정의·참조 변경/다른 소스/오래된 지표/교체 파일 저장을 거부한다. 기존 단일 structured-bi 뒤에 붙인 위젯은 index0 링크를 보존하고 추가 항목은 명시적인 미연결 marker로 변환한다. 손상되거나 다른 소스를 가리키는 snapshot은 추측해 복구하지 않는다.
- 충돌은 로컬 초안을 보존한 별도 비교이며 ‘재적용’은 마지막 baseline→로컬 delta만 최신 문서에 적용한다. 다른 화면의 제목/표시/배치 변경은 유지하고, 삭제된 정의의 복제는 거부한다. 겹치는 배치는 최신 내용을 유지한다고 알린다. 재적용 초안은 dirty이며 자동 저장하지 않는다.
- 단일 SQLite connection의 Studio 저장은 직렬 처리하며 대기 상한32를 적용한다. 운영 다중 인스턴스·MySQL 부하 검증으로 확대하지 않는다. journal 보존/정리는 후속 운영 작업이다.

### 실행 결과

**기능 PASS — STUDIO-E02 선택 범위**

1. 실제 HTTP 소유자200, 미로그인401, 타인 GET/POST403, 파일 버전 누락400. 저장·reload에서 제목·모든 폭 배치·블록 ID 복원 및 실제 DuckDB 숫자500/채널300·200 유지. 임시 ID remap 후 undo/redo에서 같은 서버 ID 참조.
2. 실제 두 탭의 오래된 revision409와 원격 숫자 블록 제목+로컬 차트 제목의 동시 보존·명시 재저장. 첫 브라우저 실행은 이 조건까지 통과한 뒤 아래 네트워크 문구에서 실패했고, 통과한 앞 조건은 반복하지 않았다.
3. 서버 commit 후 응답만 연결 중단 → 같은 requestId/body로 재시도, 이후 타이핑은 보존/dirty, 후속 저장 정상. 최초에 Axios status0이 `Network Error`로 노출되어 network 분류를 수정하고 해당 조건부터 재검증 PASS.
4. 768/390px 키보드 순서 편집→저장→reload의 전체 layout 동일. 390px 실제 충돌 dialog44px 버튼, Tab trap/Escape 및 로컬 초안 보존·재적용 저장. 마지막 `final-conflict-390.png`는 대기 애니메이션 후 레이아웃만 확인하기 위해 주입한409 화면이며 실제 경쟁 검증을 대신하지 않는다.
5. 전체 블록 삭제 시 빈 저장 버튼 비활성·요청0, 기존 baseline 정의로 블록 재추가→숫자500·저장 가능. 실제 모바일과 새 회귀1개로 확인. 저장하지 않은 이 빈 상태 검증은 서버 원본을 변경하지 않는다.

**디자인 PASS — 선택 범위**

- 1440/768/390px 페이지 overflow0, 기본 카드 내부 overflowX/Y0. legacy numeric h2(110px)는 높이를 바꾸지 않고 compact 숫자 renderer로500을 표시한다.
- 최초 numeric500 가림, WidgetViewer의 빈50px 제목 영역 때문에 차트 축/하단 버튼 잘림을 발견했다. Studio에서만 `hideHeader` 옵션을 사용하고 기본값false로 기존 보기 헤더를 유지했다. 최종 차트 데이터 표300/200·축·하단 버튼 가시성, 기존 보기 제목·500을 다시 확인했다.
- 최종 PNG를 직접 살펴보며 카드/툴바 정렬·폭·숫자·축·dialog 배경/줄바꿈을 확인했다. dialog 전환 중 캡처는 최종 판정에 사용하지 않고 effective opacity1 이후 다시 캡처했다. 전체 다국어·최대 길이·실기기·모든 hover 상태 완료는 아니다.

**검사/증빙**

- BE 저장 서비스11개·migration4개 PASS. 관련 Studio 계약/기존 AI 저장 회귀166개 통과 후 변경된 저장 서비스11개를 재실행했다. rollback, payload replay/변경409, 두 요청 경쟁, 지표/스키마/파일 version, 기존 단일 snapshot 호환을 포함한다.
- FE Studio54개와 관련 LineChart resize4개(총58) PASS 후 빈 상태 복구 회귀1개 추가, 변경된 StudioEditor13개 재실행 PASS. FE 타입/변경 lint·FE/BE build PASS. 기존 통과 MD 전체는 재실행하지 않았다.
- 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t4-20261015/`: `http-results.json`, `browser-before-network-fix.log`/`network-before.png`, `saved-reloaded-1440.png`/`conflict-1440.png`, `browser-retry-results.json`, `visual-results.json`, `dialog-final-results.json`, `empty-results.json`, `final-studio-{1440,768,390}.png`, `final-conflict-390.png`, `empty-{disabled,recovered}-390.png`, `legacy-after-header-option.png`, 테스트/타입/린트/빌드 로그와 `review-notes.md`. 임시 브라우저 스크립트는 /private/tmp에만 둔다.

실LLM 편집·한 프롬프트 생성·게시/재사용·전체 TC-005는 **NOT_RUN**, 다음 T5 이후다. Rill 동등성·실시간 파일 교체 경쟁·MySQL 운영 부하·재시작 후 미저장 브라우저 초안 복구는 이번 통과 범위가 아니다. gpt-6-luna 설정 유지, VoiceOver **BLOCKED** 유지.


## T5 선택 블록 AI 수정 — 2026-10-15

기준 `7c5aea91` + T5 diff. **STUDIO-A01 기능 PASS_SELECTED_VARIANTS / 디자인 PASS_SELECTED_VARIANTS.** 기존 T1~T4의 무관한 통과 조건은 재실행하지 않았다. gpt-6-luna 유지, VoiceOver BLOCKED 유지.

### 명세·범위

- Given 소유자 Studio 문서와 선택 블록, 현재 서버 revision·파일 sourceRevision·로컬 edit generation. When 하나의 입력으로 질문하거나 수정 요청. Then Codex gpt-6-luna 요청으로 ask/edit/clarify/unsupported를 분류하며 모드 선택 UI 없이 처리한다.
- 수정은 선택 블록 `updateBlock` 한 개의 title/description/display만 허용한다. SQL·정의 key·지표/차원 참조·블록 ID/종류·다른 블록·배치는 바꿀 수 없다. 신규 생성/게시/공유/삭제 의도는 이번 단계의 미지원이며 성공으로 취급하지 않는다.
- 시간 차트의 표시 `timeGrain:auto|day|week|month`는 서버 기존 안전 집계로 실행한다. 지원되지 않는 SQL 형태는 거부하며 SQL 계산 정의를 추측해 수정하지 않는다. 원래 SQL은 analysisDefinition/catalog에 유지하고 일반 보기의 Dataset에는 검증한 실제 집계 쿼리를 저장한다.
- 실행 API `POST /v1/studio/runs`: `{requestId,dashboardId,expectedRevision,expectedSourceRevision,document,clientEditVersion,selectedBlockId?,prompt}` → `{runId,baseRevision,sourceRevision,clientEditVersion,selectedBlockId,intent,answer,proposedOperations,preview,steps}`. dashboard/source/문서가 필수인 기존 편집 범위다. `conversationId`, 새 문서 생성, clarification의 parentRunId/answers는 후속 T6/T7 계약으로 남긴다.
- 기존 AI SDK useChat와 완성 응답 transport helper를 재사용한다. Codex CLI의 complete-response를 가짜 토큰으로 지연 스트리밍하지 않는다. 대기 중 UI 상태·중지와 완료 후 검증 단계 결과를 제공한다. 단계별 서버 이벤트 스트리밍/실행 기록 영속화는 아직 없다.
- AI 전후에 소유권·대시보드/파일 revision·활성 지표 버전·차원 schema를 확인한다. 응답 중 manual move→undo로 내용이 같아져도 generation이 다르면 적용 금지. 선택 변경/저장 기준 변경도 금지. 명확한 유효 수정은 로컬 초안에만 applyBatch 1회, undo 제공. 명시적 저장 전 서버 쓰기0.
- 같은 actor/requestId/body는 프로세스 내10분·최대64개 임시 replay. 다른 body409. 실패/취소는 결과를 저장하지 않으며 영속적인 AI journal/restart replay를 보장하지 않는다. 기존 T4의 저장 journal과 구분한다. Codex 미설정이면 다른 제공자로 대체하지 않고 연결 오류를 반환한다.
- 현재 Studio의 실행 문맥은 전체 기간·필터 없음이다. 임의 사용자 기간/필터 UI 연동·과거 대화 의미를 이어받는 multi-turn 저장은 이번 범위가 아니다.

### 실행 환경·정답

격리 API `127.0.0.1:4325`, FE `127.0.0.1:3225`, DB/uploads `/private/tmp/vm-studio-t5-20261015/`. 기존 개발 DB/환경 파일을 변경하지 않고 검증 DB 복사본에 새 QA 계정·소스7/대시보드6을 만들었다. 인증정보는 증빙에 넣지 않는다.

CSV5행: 2026-01-01 Site300,01-02 Mobile200,01-08 Site400,01-09 Mobile100,01-15 Site500. 정답 총매출1500, 일간300/200/400/100/500, UTC 주 시작12-29/01-05/01-12 각각500, 채널 Site1200/Mobile300. Rill139만행의 동등성·성능을 대신하는 자료가 아니다.

### 기능 결과

1. 실제 Chromium에서 숫자 블록을 키보드로 직접 이동한 뒤 시간 차트를 선택하여 실제 Codex **gpt-6-luna 지정 요청**. ‘선택한 일별 매출 차트만 주간 집계로…제목·계산·다른 블록·배치 유지’ → 검증된 timeGrain week 한 연산, 약6.5초/HTTP201. 주간500×3·총1500, 기존 배치와 비대상 유지, 저장 전 POST save0. CLI 출력만으로 실제 사용 모델 자체를 별도 증명하는 것은 아니다.
2. undo에서 일간5값(400 포함), redo에서 주간500×3을 실제 데이터 표로 확인. 같은 입력으로 실제 ‘총매출 질문’은 정확히1500·ask/operation0, ‘공개 배포·공유 링크’는 unsupported/operation0. 실제 모델 호출은 이3개이며 장애 주입을 실제 모델 검증으로 계산하지 않는다.
3. 명시적 저장→reload의 주간3개 값 복원. 일반 보기의 실제 시간 차트 데이터 표도500×3. 최초 일반 보기 검증 스크립트가 두 번째 ‘데이터 표’(채널)를 선택해 실패했으며, 실제 시간 차트의 첫 버튼으로 해당 조건만 재확인했다.
4. 지연 응답을 주입하고 도착 전 manual move 후 선택 복귀 → 적용 차단, 로컬 편집 보존. 실제 useChat 회귀는 move→undo로 같은 내용으로 돌아온 조건도 차단했다. 390px 대기 취소/409/잘못된 removeBlock 응답을 주입해 변경 없음·각 안내 확인. 서버 timeout/취소는 mock LLM 단위로 검증했으며 이번에 실제 CLI 프로세스 중단을 새로 실행하지 않았다.
5. 새 API 실제 HTTP 미로그인401, 타인403, 오래된 sourceRevision409,2001자 prompt400. 모델 호출 이전 거부. 서버 단위에서 허용 외 operation·다른 블록·계산·배치 변경, 전후409·취소·timeout·동일 요청 replay/다른 payload409·Codex 외 제공자 대체 금지를 확인했다.

### 오류 수정·디자인

- 독립 backend 리뷰 P1: 기존 보기 Dataset이 원래 일간 SQL을 실행하는 문제 → 실제 preview의 검증 쿼리로 저장하되 analysisDefinition의 원 SQL 보존. P2: AI 준비가 오래된 지표/차원 참조를 허용하는 문제 → 저장과 같은 최신 참조 검사를 전후 준비에서 재사용. 실제 DuckDB/metadata 회귀에서 재현 후 통과.
- 검증 실패를 연결 실패로 표시하지 않도록 transport의 응답 validation과 HTTP 오류 분류를 분리했다. 잘못된 operation은 검증 오류로 안내하고 문서 불변.
- 모바일 입력 라벨을 항상 축소 위치로 두어 내용과 분리했다. 현재 선택 블록·전체 기간/필터·주간/UTC·요청 모델 문맥을 표시한다. 같은 MUI 토큰/배치를 재사용하고 신규 의존성 없음.
- 1440/768/390px 페이지 overflow0, 전송 버튼36/44/44px, 라벨 하단과 입력 상단이 분리됨(각 약4.6px). 좁은 Drawer의 Tab8회 내부 유지·Escape 닫기, 포커스 표시 확인. 최종 PNG를 직접 시각 검토했다.
- 초기 실제 AI 적용 캡처의 이전 점은 ECharts 전환 중이었고, 안정화 캡처는500×3만 표시했다. 최종 수치 시각 증빙은 `final-weekly-1440.png`이며 중간 애니메이션 화면을 디자인 통과 근거로 사용하지 않는다. 포커스 ripple의 정상 무한 애니메이션은 전환 대기 검사에서 제외했다. 실제 기기/모든 언어/모든 길이는 NOT_RUN.

### 검사·증빙

- BE 관련 Studio/기존 AI 저장·시간 차트·이전 기간 원본 회귀 **252개 PASS**. 마지막 제공자 가드 추가 후 변경된 run service **12개 PASS**, BE lint/build PASS.
- FE Studio·기존 assistant transport/useChat **97개 PASS**, 타입/변경 lint/build PASS. 전체 제품 E2E·무관한 기존 MD는 반복하지 않았다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t5-20261015/`의 `real-ai-result.json`, `browser-partial.json`(실제 AI3개·undo/저장·폭별 조건, 끝의 잘못된 표 선택 실패 명시), `remaining-partial.json`(정정한 기존 보기·stale guard 통과 뒤 무한 ripple 대기 실패), `remaining-results.json`(최종3폭·중지/409/invalid), `http-results.json`, `final-weekly-1440.png`, `legacy-weekly-1440.png`, `stale-guard-1440.png`, `final-panel-{1440,768,390}.png`, `cancel-390.png`, `conflict-ai-390.png`, `invalid-operation-390.png`, 단위 red/green·리뷰·타입/lint/build 로그. 브라우저 스크립트는 /private/tmp에만 두고 신규 상시 E2E는 추가하지 않았다.
- Aside 데몬이 실행되지 않아 기존 승인된 headed Chromium을 사용했고 Codex IAB에도 같은 실제 Studio/선택 AI 패널을 남겼다. VoiceOver BLOCKED 유지.

다음 **T6 내 파일/샘플→같은 Studio 생성**. 한 프롬프트 신규 생성·게시/재사용·작업 복구·전체 TC-005와 Rill 수치/UX 비교는 해당 단계까지 NOT_RUN이다.

## T6 내 파일·샘플 → Studio — 2026-10-15 (선택 조건 완료)

기준 `7b0fe5fb` + T6 diff. 기존 T1~T5의 무관한 MD 조건은 재실행하지 않는다. AI Codex/gpt-6-luna 지정 유지, VoiceOver BLOCKED 유지.

### STUDIO-A02 인수 조건

| 조건 | 입력/기대 | 현재 상태 |
| --- | --- | --- |
| A02-RILL | 공식 auction1391572행, 요청634513000·평균5.571238676526892±1e-9, 기기별·시간 차트. 실제 생성→Studio→이동→선택AI수정→저장/reload | PASS_SELECTED_VARIANTS |
| A02-COMMERCE | bundled AE37주문/40결제/8환불. 매출20994.61/환불4457.60/순매출16537.01 USD, 금액환불률21.232116243169088%. 주문일 코호트 | PASS_SELECTED_VARIANTS |
| A02-FILE | Studio의 실제 Parquet 선택 및 기존 `/data/file`의 CSV→새 Studio 진입. 기존 서버 DuckDB worker, CSV2행/합계500·JSON2행/합계700 생성·저장/reload. preview metadata 쓰기0는 서버 단위 | PASS_SELECTED_VARIANTS |
| A02-SEMANTIC | 저장 지표 선택의 실제 모델 ID/version/634513000 보존. 원자 저장·중복 정의·차원 schema는 서버 단위. 환불 분모 질문 전에 preview/save 없음 | PASS_SELECTED_VARIANTS |
| A02-GUARD | 실제 손상 Parquet/명시한 없는 열 차단. 취소·503는 브라우저 응답 주입. stale·권한·동시 저장·rollback/replay·취소 전후는 서버 단위/FE 경합 테스트 | PASS_SELECTED_VARIANTS |
| A02-DESIGN | 생성 review1440/768/390px, 모바일44px 버튼, 페이지 가로 넘침 없음. Enter/Space 파일 선택·샘플·지표·분모·생성/저장, 표 End, Studio 핸들 방향키. 최종 PNG 직접 확인 | PASS_SELECTED_VARIANTS |

### 구현·실행 근거

- `/studio/new`에서 소유 DuckDB 소스·내 CSV/JSON/Parquet·Rill/commerce 샘플→profile→지표 정의 검토→계산 preview→명시 저장→동일 Studio. 기존 GettingStarted/파일 화면에 진입 버튼을 추가했다. 한 소스·1~6개 기존 검증 renderer, MUI 유지·신규 의존성 없음.
- `POST /studio/proposals`는 불변 actor-bound 제안(10분, 미소비 최대64개)을 만들고 지표/dashboard를 쓰지 않는다. `sourceRevision`은 profile.dataVersion의 불투명 복합 해시다. `POST /studio/dashboards`는 `{requestId,proposalId,expectedSourceRevision}`로 생성하며, source/metric/schema 재검증 후 지표·dashboard·StudioState·지속 replay journal을 같은 transaction/공유 SQLite 쓰기 큐에서 저장한다. 소비한 제안은 commit 후 해제하며 replay는 journal에서 복원한다. dimension은 원본 열/type/schema 참조, 별도 전역 catalog 없음.
- 런타임은 이 워크트리 Node24/npm, 격리 SQLite·uploads, API4326/FE3226. AI_PROVIDER=codex, gpt-6-luna 지정 및 기존10100 연결/카탈로그 유지. CLI 출력만으로 실제 사용 모델을 별도 증명하지는 않는다. 인증정보는 증빙에 저장하지 않았다.
- **Rill 실모델**: Parquet1391572행에서 KPI634513000, 평균5.571238676523254(고정 정답 오차<1e-9), 기기별9그룹·시간 추이. 시간 차트는 원본 시간별 집계이며 일간 집계로 보고하지 않는다. 원본 SHA/정답은 `samples/rill/manifest.json` 기준. review→생성→reload, 마지막 차트 lg y7→8 방향키 이동 후 제목만 실모델로 수정→명시 저장/reload. 숫자/다른 블록/배치 보존. 기존 지표 선택의 별도 실모델 제안은 canonical ID/version1/634513000 보존.
- **Commerce 실모델**: 기존37주문 bundled fixture를 재사용(99827행 전체 fixture/Rill과 구분). 환불률 모호함→분모 선택 전 preview/save 없음→성공 결제액 선택→4 KPI 원본값20994.61/4457.6/16537.01/21.232116243169088→저장/reload. 모바일 표시20,994.61 USD/4,457.60 USD/16,537.01 USD/21.23%. 공개 합성 데이터 출처·CC BY4.0 표시.
- **CSV 진입 실모델**: `/data/file`에서 네이티브 파일 선택 Enter→Studio에서 만들기→2행 프로파일→amount 합계500 제안→명시 저장/reload500. 브라우저 WASM 분석은 실행하지 않았다. Studio 자체의 Parquet 파일 선택도 네이티브 Enter로 실제 원본을 업로드했다. 최종 응답 경계 변경 후 아직 미검증이던 JSON2행도 같은 Studio 파일 선택→실제 gpt-6-luna 지정 생성→명시 저장/reload700을 통과했다. CSV/JSON/Parquet 모두 기존 서버 업로드를 재사용한다.

### 발견 오류·재검증

1. 독립 FE 리뷰: 늦은 초기 소스 목록이 최신 선택/생성을 무효화하는 경합, clarification 재시도 실패/중지에서 질문과 답이 숨겨지는 문제, label 파일 버튼의 네이티브 키보드 활성화 누락을 수정. 신규 경합·복구 회귀를 red→green 확인했다.
2. 실제 commerce에서 환불률 scale1 응답을 거절하던400: 확인한 분모와 유효한 비율 계산은 유지하면서 %표시에 맞게100배로 정규화. AVG/SUM을 환불률로 제안하는 우회는 거절하고 정상 환불액 SUM은 허용. 실제 같은 조건 재실행→정답·저장/reload 통과.
3. 실제 없는 revenue 요청을 Rill 기본 지표로 대체한 문제: 명시 원본 열의 부재는 모델 전에 질문으로 전환, 모델의 requiredFields 선언을 원본과 대조, missingColumns 이외 모델 질문 ID 거절. 기본 샘플 지표로 대체하지 않도록 프롬프트 보완. 성공 의미 응답에 requiredFields 선언이 없거나 null이면 거절하도록 마지막 리뷰 경계도 고정했다. 같은 실패 요청 재검증은 모델 호출 전 missingColumns/preview 없음/저장 없음. 모든 자연어 업무 의미를 결정적으로 이해한다고 주장하지 않으며 정의 검토 단계를 유지한다.
4. 독립 BE 리뷰: 저장 완료 제안이 슬롯을 계속 차지하던 문제를 commit 후 해제로 수정, durable replay 유지 회귀 통과.
5. 실제 손상 Parquet400에 지표 정의 안내가 나오던 문제를 파일 형식·손상 확인/재선택 안내로 수정→실제 재검증 통과. 관대한 CSV 파서가 문자열로 읽는 표본은 실패 증빙으로 계산하지 않았다.
6. 원본 시간 문자열 눈금 잘림을 짧은 월일/시분·양끝 정렬로 수정; 실제 category 값/데이터 표는 변경하지 않음. 모바일 프로파일의 빈 값 헤더/원본 열 이름 줄바꿈을 정리하고 표 내부 가로 스크롤을 제공했다. 저장 지표 선택 행도 최소44px로 맞췄다. 긴 표는 키보드 포커스/End로 탐색.

### 디자인·검사·증빙

- 생성 1440/768px 카드·390px 단일 열의 패딩·정렬·입력 라벨·44px 모바일 버튼 확인. 페이지 scrollWidth≤innerWidth(스크롤바로 -15px인 경우를 실패로 잘못 판정한 검증 스크립트를 정정). 데이터 표 내부 스크롤은 의도한 동작이다. End 직후 동기 판정 실패는 스크롤 완료 대기 후 같은 조건만 재확인했다.
- 첫 Rill sample 프로파일 검증 스크립트의 18열 기대는 실제21열로 정정했다. 통과한 모델 호출은 반복하지 않고 받은 실제 제안을 화면 응답으로 재사용하여 미실행 review/저장 조건만 이어 실행했다. 실제 서버 제안을 저장한 것이며 주입을 새 실모델 호출로 계산하지 않는다.
- 큰 차트의 초기 paint/전환 PNG는 최종 근거에서 제외. 안정된 grid 이미지 비교 후 `final-stable-1440.png`에서 실제 chart/canvas 너비1299px·전체 데이터가 그려진 상태를 확인했다. 390px 최종 차트·commerce 숫자·오류/clarification PNG도 직접 확인했다. 실기기/모든 번역/모든 데이터 길이는 NOT_RUN.
- BE 최초 관련51개 PASS 후 변경 creation service38개 재실행 PASS, lint/Nest build PASS. FE 생성·시간축17개 및 신규 진입1개 PASS, 타입/변경 lint/build PASS. 전체 제품 테스트/무관 MD는 반복하지 않았다.
- 증빙 폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t6-20261015/`: `rill-real-ai.json`, `commerce-real-ai.json`, `g2-real-ai.json`, `g2-saved.json`, `reuse-real-ai.json`, `csv-entry-real-ai.json`, `json-entry-real-ai.json`, `missing-columns-real-ai.json`(수정 전 잘못된 대체), `missing-columns-fixed.json`(수정 후 모델 전 차단), `browser-results.json`, `commerce-results.json`, `csv-entry-results.json`, `json-entry-results.json`, `guard-results.json`(필수열 PASS 후 스크롤 대기 판정 실패 포함), `file-keyboard-results.json`, `profile-keyboard-result.log`, `g2-result.log`, 단위 red/green·type/lint/build 로그. 초기 취소/503 주입 PASS는 `guard-initial-results.json`에 별도 보존했다.
- 화면: `rill-review-{1440,768,390}.png`, `final-stable-1440.png`, `final-studio-390.png`, `commerce-clarification-390.png`, `commerce-studio-390.png`, `reuse-768.png`, `csv-entry-studio-390.png`, `json-entry-studio-390.png`, `file-error-390.png`, `missing-columns-390.png`, `profile-keyboard-390.png`, `cancel-390.png`, `provider-error-390.png`. 임시 브라우저 스크립트는 /private/tmp에만 저장.
- Aside가 준비되지 않아 이전 승인된 headed Chromium fallback 및 실제 Codex IAB 결과 확인을 사용했다. 별도 Rill 앱의 최신 live UX 재실행은 NOT_RUN, 이번 수치 대조는 같은 공식 데이터·기존 고정 정답 기준. **VoiceOver BLOCKED 유지.** 공개 게시/재사용/단계 복구와 전체 TC-005는 T7~T10이며 완료로 소급하지 않는다.

다음 **T7 한 요청 실행·부분 실패 복구**. T6는 새 생성의 선택 범위와 G2 일부까지 완료했다.

## T7 실행 단계·부분 실패 복구 — 2026-10-15 (선택 조건 완료)

기준 `19af6b3a` + T7 diff. T6의 파일/샘플 생성·무관한 수치 케이스는 재실행하지 않았다. Codex/gpt-6-luna 지정과 VoiceOver BLOCKED 유지.

| STUDIO-A03 조건 | 기대/실행 근거 | 상태 |
| --- | --- | --- |
| A03-INTENT | 실제 단일 입력의 질문·선택 수정·명시 저장 및 수정+저장. edit-only 저장0, 공개/복제는 미지원/설정 쓰기0 | PASS_SELECTED_VARIANTS |
| A03-RETRY | preview 실패 뒤 모델 재호출0, commit한 저장 뒤 후속 adapter 실패의 저장 재실행0는 BE. 실제 동일 request 재생 journal1·다른 본문409. 실패 저장 재시도 UI·수동 변경 차단은 응답 주입 | PASS_SELECTED_VARIANTS |
| A03-RECOVER | 실제 reload 후 기록 복원/추가 POST0, 실제 Node 재시작 중단 기록·저장0·자동 실행0. commit journal 복구는 BE | PASS_SELECTED_VARIANTS |
| A03-CANCEL | 실제 AI 수정+저장 대기 중 중지→journal0/기존 제목 보존. 실제 저장 완료 후 cancel→완료·저장 결과 유지. disconnect/commit 경합·revoked ownership/stale는 BE | PASS_SELECTED_VARIANTS |
| A03-PRIVACY | 실제 고유 원문 marker를 보낸 수정+저장 뒤 DB state에 marker/prompt/datas/sql/authorization 없음. 답변 본문은 bounded process memory만 사용 | PASS_SELECTED_VARIANTS |
| A03-DESIGN | 실제 활동1440/768/390px·요약 Enter·Drawer Escape/복귀, 모바일 버튼 모두44px. 부분 완료/재시도는 주입 UI, 중지/중단/저장은 실제 상태 | PASS_SELECTED_VARIANTS |

### 구현 계약·운영 범위

- T5 `POST /studio/runs`는 호환 유지. Studio AI SDK transport는 새 `POST /studio/executions`를 사용하며, `GET /studio/runs?dashboardId=…`, `GET /studio/runs/:id`, `POST /studio/runs/:id/retry {stepId,request?}`, `POST /studio/runs/:id/cancel`을 제공한다. 시작 응답은 실제 완료/실패까지 기다리고 대기 중에는 가벼운 목록 조회를 2초 간격으로 수행한다. 모델 토큰 스트리밍으로 위장하지 않는다.
- `studio_execution`에 actor/request unique·payload hash·단계/상태·원본 문서의 지표/레이아웃 메타데이터·검증된 제안을 저장한다. prompt·원본 데이터 행·SQL·인증정보·provider 오류·모델 자유 답변은 저장하지 않는다. 원본 요청/답변은 서버 프로세스에서 최대64개/10분, 프런트 원래 본문은 컴포넌트 메모리에만 유지한다. 채팅 영속 저장/세션 스토리지에 원문을 쓰지 않는다.
- source inspect→model proposal→preview→draft ready→명시 save의 완료 checkpoint를 재사용한다. completed step은 retry에서 실행하지 않고, 저장은 기존 StudioRun의 같은 request journal과 동일 transaction/쓰기 큐를 이용한다. 이 구조를 분산 환경의 정확히 한 번 실행 보장으로 확대하지 않는다. 단일 상시 Node·SQLite 메타데이터 전제 유지.
- 시작 시 pending/running은 interrupted로 복원한다. 이미 commit한 save는 journal로 완료 복원하며 자동 LLM/외부 작업을 하지 않는다. 재시작/TTL 뒤 모델 단계 재시도에는 원래 요청 재입력이 필요하고, 전체 요청 해시가 달라지면409. 완료한 모델의 연산이 보관된 preview/save 재시도에는 원문이 필요 없다. 이전 모델 답변 본문은 재시작 뒤 복원하지 않고 재질문을 안내한다.
- GET/list는 revision을 제외한 원래 문서 SHA256 `baseDocumentHash`만 추가 반환한다. 클라이언트가 현재 문서·source/revision·선택을 대조하고 최근 수동 변경/undo 세대가 다르면 POST 전 재시도를 차단한다. 복원 요청의 원래 서버 세대와 현재 화면 세대는 분리해, 정상 재시도 결과를 적용하면서 그 이후 수동 편집은 보존한다.
- ‘현재 초안을 저장해 줘’, `save`/`save draft` 및 명시적 한국어 후행 ‘…하고 저장해 줘’가 저장 의도다. 저장 부정문은 쓰지 않고, 불명확/미지원 제안은 저장하지 않는다. 모든 언어·모든 자연어 표현을 지원한다고 주장하지 않는다. T6 새 생성은 `/studio/new`의 정의 검토/preview/명시 저장 흐름을 유지한다. 기존 Studio에서 새 대시보드 생성·게시·복제는 미지원으로 표시하고 실제 공유/게시 설정을 변경하지 않는다. 해당 후속 기능은 T8/T9이다.

### 실제 실행

- Node24/npm, FE3227/API4327, `/private/tmp/vm-studio-t7-20261015/metadata.db` 격리 메타데이터. Rill 파일은 기존 T6 업로드 경로를 SELECT 전용으로 재사용하며 이번에 수집·원본 파일 쓰기를 하지 않았다. 복사된 소스의 관리 경로가 원래 절대 경로를 보존해 최초 잘못 지정한 T7 uploads가400이었고 파일 루트만 정정했다. 사용자 데이터/기존 메타데이터는 변경하지 않았다.
- 실제 gpt-6-luna 지정 요청: Rill dashboard8의 선택 숫자 제목만 변경→데이터/AI/검증/초안4단계 완료·save 단계 없음. 별도 ‘현재 초안을 저장해 줘’는 모델 없이 save 완료→reload에서 제목/저장 기록 복원·추가 POST 없음. 질문은 실제634513000 답변·operation0. 공개 링크 요청은 unsupported·실제 publish 성공0.
- 추가 신규 조합: ‘선택한 숫자 블록 제목만 T7 통합 요청 합계로 바꾸고 저장해 줘’ 한 요청으로 inspect/propose/preview/apply/save5단계 완료, 저장 revision/화면 일치. 634513000·평균5.571239 표시/나머지 차트는 유지했다. CLI 출력만으로 실제 사용 모델 자체를 별도 증명하지는 않는다.
- 실제 수정+저장 요청이 model 단계 실행 중일 때 중지→기존 제목 보존, 해당 save journal0. commit된 API 요청을 동일 본문으로 재생→동일run/journal1, 다른 본문409·익명GET401·commit후cancel은succeeded/saveResult 유지. HTTP 테스트의 fetch.ok 속성을 함수로 쓴 스크립트 오류 후 이미 commit한 요청을 원래 메타데이터+알고 있는 고정 문장으로 복원해 재생했으며 새 실행으로 대체하지 않았다.
- 실제 Node 프로세스를 model 단계 중 종료·같은 DB로 재시작→interrupted/추가 POST0/save journal0. 원문 재입력 안내 확인. 단위에는 server restart 후 model 완료/preview 실패 복구, journal commit 뒤 상태 응답 유실 복구, 취소와 commit의 앞뒤 경계, 현재/원래 source 소유권 회수도 포함했다.
- STUDIO-A03의 ‘저장 완료 후 후속 실패/재시도’는 계획대로 backend 주입 adapter에서 save 중복0·미지원 publish 성공0을 확인했다. 브라우저의 실패 save·재시도/partial 표시는 명시한 응답 주입이며 live publish 성공으로 계산하지 않는다. 실제 게시/복제·전체 TC-005는 NOT_RUN이다.

### 오류 수정·리뷰

1. 실제 UI의 revision 없는 초안을 새 API가400으로 거절: optional 문서 revision과 필수 expectedRevision을 분리, supplied revision만 일치 검사. 서버의 실제 최신 revision 대조는 유지. 회귀 red→green 및 실제 요청 성공.
2. 독립 리뷰 P2 두 건: 실패한 save의 AI 변경을 로컬에 먼저 적용해 재시도를 막던 문제, reload 후 기억된 요청 없이 과거 save를 재개하며 현재 편집과 대조하지 않던 문제. save 미완료 시 제안 적용을 보류하고 canonical 해시·revision/source·선택·편집 세대 대조를 추가했다. hash 회귀 red→green, 실제 useChat/Editor 통합 회귀와 주입 브라우저에서 실패 단계 save POST만1회·수동 변경 뒤 두 번째 POST0 확인.
3. HTTP disconnect가 run ID를 받기 전에 발생해도 실행 AbortSignal로 전달하고 commit 전 쓰기0, commit 뒤 완료 상태를 유지하도록 경계를 연결했다. 직접 T5 경로의 동작/답변도 유지했다.
4. 질문의 실제 수치 답변이 일반 완료 문구로 사라지지 않도록 live 답변을 bounded memory에 보존하면서 durable history에서는 제외했다. 실제 수치 답변과 단위 모두 확인했다.
5. 늦은 목록 응답이 최신 완료 상태를 덮지 않도록 조회 세대를 구분했다. 저장 응답의 dashboard/source/revision 형식, 재시도 결과의 원래 문맥/현재 표시 문맥을 각각 검증한다.

### 디자인·검사·증빙

- MUI/기존 Studio 색·폰트·간격을 재사용하고 신규 의존성 없음. 실행 상태를 색과 텍스트로 함께 표시, 실패 단계만 재시도 제공. 정상/실패/부분 완료/중지/서버 중단의 핵심 PNG를 실제 검토했다.
- 실제 모바일 검사에서 상단 탭/닫기 버튼이 작은 점을44px로 수정했다. 마지막 시각 검토에서 sticky 입력창이 긴 실행 기록을 덮던 문제를 패널 본문 내부 스크롤+별도 입력 영역으로 수정했다. desktop shell108px와 아래16px 여백을 기준으로 AI 패널 높이를 제한하고 Drawer는100dvh를 사용한다. settings 패널이나 전역 UI는 변경하지 않았다.
- 최종1440/768/390px 페이지 가로 넘침 없음, 모바일 visible 버튼44px 이상. 요약 Enter 열기/닫기·Escape 후 AI 열기 버튼 복귀. 폭 변경 때 Drawer DOM이 교체되는 검증 스크립트의 detached 판정은 전환 대기로 정정하고 해당768/390 조건만 재확인했다. 실기기·VoiceOver·모든 번역·장문 전체 조합은 NOT_RUN/BLOCKED이며 DOM 결과로 VoiceOver를 통과시키지 않았다.
- BE 변경된 Studio 경계 **194개/12suite PASS**, migration up/down·legacy/direct T5/save 취소 영향 포함, lint/Nest build PASS. FE 실행·기존 SDK/Editor 영향 **30개/4file PASS**, 타입·변경 lint·build PASS. 전체 제품 E2E·무관 MD·기존 Rill 앱 live UX 재실행은 하지 않았다.
- 증빙 폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t7-20261015/`: `edit-real-ai.json`, `save-execution.json`, `ask-real-ai.json`, `combined-real-ai.json`, `combined-result.json`, `browser-results.json`(실제 4개 흐름·1440 PASS 후 옛 모바일 터치 크기 실패 포함), `remaining-results.json`(최종768/390/키보드), `http-results.json`, `cancel-result.json`, `restart-result.json`, `retry-ui-results.json`(주입 명시), 단위 red/green·review·type/lint/build 로그. 인증정보/원문 데이터는 증빙에서 제외했다.
- 최종 화면: `final-saved-1440.png`, `final-saved-390.png`, `activity-768.png`, `cancel-390.png`, `restart-interrupted-390.png`, `ui-injected-save-retry-1440.png`, `ui-injected-stale-retry-1440.png`, `ui-injected-partial-390.png`. 임시 Playwright 검증 코드는 /private/tmp에만 두고 상시 UI suite를 늘리지 않았다. 기존 승인된 headed Chromium fallback을 사용했고 Codex IAB에도 같은 실제 저장 결과와 실행 패널을 남겼다.

T7 선택 범위·G2 완료. 다음 **T8 게시 snapshot·링크·재게시·중지**. 실제 공개 게시/복제와 전체 TC-005는 해당 단계까지 미검증 상태로 유지한다.
