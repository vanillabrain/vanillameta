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
