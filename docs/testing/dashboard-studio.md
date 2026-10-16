# Dashboard Studio MD 검증

## 현재 범위와 실행 기준

2026-10-16, T12~T15는 develop-v2에 통합되어 있다. 최신 UI 기준은 [Studio shadcn 검증](studio-shadcn.md)이며 공식 로고·빈 결과·모바일 패널 수정은 `d51585a4`까지 drumcap 커밋·push했다. T15 신규 생성 dispatch는 실제 gpt-6-luna/DuckDB로 확인했고, UI10에서 생성 저장 커밋 후 응답 유실→같은27 영수증 재확인·중복 생성0·reload를 추가 확인했다. UI11은 완료 링크 Enter→실제 새 탭 열림→원래 탭 복귀를 확인했다. UI12는 미저장 제안의 실제 서버 재시작→400/만료 안내→명시 재생성·새 미저장 제안/원본 불변을 확인하고 만료 뒤 남던 저장 버튼을 수정했다. 아래 과거 브랜치/미커밋/NOT_RUN은 당시 범위이며 최신 후속 결과를 우선한다. Studio TC-005/G4 전체 수용은 PARTIAL이다. 실시간TTL·대화식 생성안 재설계·실기기·운영 gate가 남고 VoiceOver BLOCKED를 유지한다.

### T1 최초 시안 실행 기록 (역사적 기준)

- URL: `http://127.0.0.1:3215/_design/studio` (작업 브랜치 Vite 전용).
- 브라우저: Aside daemon 연결 실패. 허용된 대안인 Codex IAB에서 구조/콘솔을 확인하고 headed Chromium에서 실제 화면·정확한 viewport 캡처를 진행했다. IAB의 기존 확대율로 viewport가 다르게 측정돼 정해진 폭 판정에는 headed Chromium 결과를 사용했다.
- Fixture: 주문·환불 디자인용 가상 데이터. 총매출48,260,000 / 환불1,930,400 / 순매출46,329,600 KRW. 실제 commerce/Rill 검증 oracle로 사용하지 않는다.
- 데이터/API·gpt-6-luna 호출 없음. gpt-6-luna 설정과 VoiceOver BLOCKED 유지.

## MD 케이스

| ID | 조건 / 기대 | 이번 결과 |
| --- | --- | --- |
| STUDIO-D01 | 1440/768px에서 시작·결과·설정·공유 상태, 라벨·간격·숫자 가독성·가로 넘침0 | PASS_SELECTED: 실제 캡처 직접 검토, 두 폭 각각 네 상태 overflow0. 버튼32px/12px Studio 예외 기록 |
| STUDIO-D02 | 390px 네 상태, 긴 블록 제목·오류/로딩, 모바일 패널 키보드/Escape 복귀 | PASS_SELECTED: 네 상태 overflow0. 상태 버튼 간격 수정 후390px 재확인. 768/390 패널 내 Tab 이동·Escape 후 트리거 복귀. 모바일 상태 버튼88.5×44px |
| STUDIO-E01 | 블록 추가·복제·삭제·이동·resize·undo/redo·폭 변경 보존 | PASS_SELECTED: T3 기록 재사용 |
| STUDIO-E02 | 저장·재조회·서버 revision 경합 | PASS_SELECTED: T4 기록 재사용 |
| STUDIO-A01 | 직접 이동 이후 실LLM 선택 수정/배치 보존 | PASS_SELECTED: T5 기록 재사용 |
| STUDIO-A02 | 파일/샘플 생성·canonical 지표·차원 | PASS_SELECTED: T6 기록 재사용 |
| STUDIO-A03 | 단일 입력 실행·부분 실패·재시도 중복0 | PASS_SELECTED: T7 기록 재사용 |
| STUDIO-P01/P02 | 게시 version/시점·권한·중지·실패 재시도 | PASS_SELECTED: T8 신규 조건, 아래 기록 |
| STUDIO-R01/R02 | 새 소스 매핑·누락 열·원본 불변 | PASS_SELECTED: T9 오류 변형 재사용 + T10 실제 계정 간 연결 |
| TC-005 / T10 | 실LLM 생성→편집→저장·게시→내 데이터 복제→중지 | 핵심 흐름 PASS_SELECTED, 전체 요구 PARTIAL: 아래 T10 제한 |

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


## T8 — 게시 snapshot·링크·재게시·중지 (2026-10-15)

기준: b943a10c 이후 T8 diff, Node24/npm·격리 메타데이터. 기존 통과 조건은 재실행하지 않는다.

| ID | 신규 조건 | 상태 |
| --- | --- | --- |
| STUDIO-P01 | private 소유자/익명/타 계정, link 익명·타 계정, 저장 revision 재집계, 안전한 payload·2MiB 한도 | PASS_SELECTED: 실제 API/UI, 크기 한도는 결과 주입·실제 DB 단위 |
| STUDIO-P02 | 초안 변경과 게시 분리, 같은 링크 재게시·버전 증가, 응답 유실 재시도, 중지·만료410·데이터 없음 | PASS_SELECTED: 실제 저장·재게시·중지·서버 만료, replay는 API/단위 |
| STUDIO-P03 | 게시·재게시·복사·중지 UI, 1440/768/390px·키보드·포커스·줄바꿈 | PASS_SELECTED: 실제 Chromium 캡처·직접 시각 검토 |
| STUDIO-P04 | 명시한 저장+링크 공유 실행, 실패 단계 재시도·중복 저장 없음, asOf 표시 | PASS_SELECTED: 실제 SDK 실행·reload, 부분 실패/중지는 단위·React 통합 |
| DESIGN-04/VoiceOver | 기존 OS 권한 차단 | BLOCKED 유지 |

링크는 실시간 원본 조회가 아닌 게시 시점의 집계 snapshot이다. 이미 본 화면·다운로드는 회수할 수 없다. T9 복제·운영 외부 배포는 이번 범위가 아니다.


### 구현과 게시 계약

- 소유자 Studio의 **게시·공유** → 공개 범위(초기 비공개)·내 시간대 만료 시각 → 명시 게시. 미저장 초안은 게시 버튼을 차단하고 기존 게시본 관리는 유지한다. 링크 복사/게시본 열기/확인 후 중지를 제공한다.
- `POST/GET /studio/dashboards/:id/publications`, `GET /studio/publications/:token`, `POST /studio/publications/:token/revoke`. 읽기 화면은 `/published/:token`이다. 기존 legacy share-url과 별도이며 토큰·설정을 자동 이동하지 않는다.
- 게시 시 소유권·소스·지표/차원·revision을 재검증하고 DuckDB snapshot 안에서 집계한다. 초안 저장과 별도 transaction으로 active snapshot+버전+journal을 원자적으로 저장한다. 이전 preview 값이나 클라이언트 집계는 신뢰하지 않는다. 허용된 집계 구문만 통과시키며 원본 행 projection은 거절한다.
- 공개 데이터는 제목·블록 표현·배치·집계 값·안전한 추이·전체 기간/필터 없음·asOf/dataVersion만 담는다. 공개용 블록 ID를 새로 부여한다. SQL/소스 설정·ID/인증정보/원본 상세/지표 참조/상세 탐색 토큰을 내보내지 않는다. 읽기 화면은 검증한 데이터와 기존 차트/추이 renderer만 사용한다. 임의 HTML·JS/연결 조회를 실행하지 않는다.
- 명시 재게시는 동일 토큰의 버전을 증가시킨다. 중지한 토큰은 영구 차단하고 새 게시에서 새 토큰을 만든다. 만료됐지만 중지하지 않은 토큰은 소유자의 새 명시 요청으로만 재게시할 수 있다. 공개된 과거 버전 조회 API는 제공하지 않는다.
- owner/requestId+본문 해시 journal로 응답 유실 재시도·서버 재시작에서도 중복 버전 증가를 막는다. 다른 본문 재사용은409. snapshot JSON UTF-8 상한2MiB 초과는413·rollback이며 이전 게시를 유지한다. 초과분을 잘라 성공으로 보고하지 않는다. 한도 검사는 실제 DuckDB preview 뒤 oversized 집계 결과를 주입해 rollback을 확인한 단위 조건이며 실제 대용량 원본 수집 성능 시험은 아니다.
- 게시 응답은 오류·인증·전역 guard 실패까지 `Cache-Control: no-store, private`를 적용한다. 브라우저도 캐시 재사용 없이 조회하고 새 권한 조회 시작/실패 시 이전 데이터를 지운다. 포커스 복귀·bfcache 복귀·다시 확인에서 서버 상태를 조회한다. 열린 화면은 만료 시각에 재조회해410이면 데이터를 지운다. 기기 시계가 앞선 경우 서버의 유효 응답을 유지하고 최대30초 간격으로 재확인해 즉시 반복 조회를 막는다. 다른 탭에서 중지했다고 이미 본 화면/캡처를 즉시 회수하는 기능은 아니다.

### 실제 검증과 숫자

- Node24/npm, FE3228/API4328, `/private/tmp/vm-studio-t8-20261015/metadata.db`는 T7 DB의 일관된 격리 backup. 원본 파일은 기존 T6 uploads를 읽기 전용으로 재사용했다. 사용자 메타데이터/원본 파일·전역 AI/OS 설정을 변경하지 않았다.
- 기존 검증된 공식 Rill **1,391,572행**을 게시했다. 총 요청 수 **634513000**, 평균 입찰 하한가 **5.571238676523271**, 독립 oracle5.571238676526892와 오차<1e-9. 이번 범위는 게시 집계와 화면이며 이미 통과한 수집·생성·Rill 앱 자체 검증을 반복하지 않았다. 공개 JSON29319bytes, 금지 키가 없는지 API로 대조했다.
- 비공개는 소유자만200, 익명·다른 계정403. 다른 계정의 owner metadata/게시/중지는403, 익명 owner metadata401. 링크 공개는 익명·다른 로그인 계정200. 권한/만료/중지 오류 응답에서 집계 데이터가 없고 no-store인 것을 확인했다.
- 저장된 초안 제목을 바꿔도 기존 게시 snapshot은 deep equal. 오래된 revision의 게시409. 재게시 후 같은 링크의 새 제목/버전·집계가 보인다. 실제 동일 requestId/body 반복은 같은 버전, 다른 본문409다.
- 실제 1.2초 서버 만료 fixture의410과 데이터 제거 확인. 별도 JSON700 fixture는 화면을 연 채 6초 만료를 넘겨 자동 재조회→안내·카드0을 확인했다. 실제 게시 중지 Enter→확인 Enter→이전 링크410, 다시 게시한 새 토큰은 이전 것과 다르고 버전1이다. 재차 중지도 멱등이다.
- **G3:** 실제 AI SDK 입력 `저장하고 링크로 공유해줘` 한 요청으로 inspectSource/saveDraft/publish 완료. 저장 결과와 게시 v2·링크·집계 시각을 함께 표시하고 reload 뒤 기록을 복원했으며 추가POST0. 이 명령은 공개 범위가 명확한 제한 명령으로 모델 추론 없이 실행하므로 이번 모델 호출0이다. `AI_PROVIDER=codex`, gpt-6-luna 및 기존10100 연결/카탈로그 설정은 유지했다. T5~T7의 실모델 결과는 재사용하며 새 모델 검증으로 세지 않는다.
- 저장 성공 뒤 게시 실패/재시작/응답 유실/취소 경계는 서버 단위·React 통합에서 확인했다. 게시만 재시도하며 저장/LLM을 반복하지 않는다. 취소는 저장 journal을 보존하면서 미완료 게시를 취소하고 재시도를 차단한다. 이미 게시 commit이 끝났다면 성공 결과를 유지한다. 이 장애 조건들을 모두 live 브라우저에서 재현했다고 확대하지 않는다.

### 오류 수정·재검증과 디자인

1. 최초 owner metadata의 `null`이 Nest에서 빈200 응답이 되어 UI가 실패로 인식했다. 해당 명시 응답을 ‘게시본 없음’으로 처리하고 실제 최초 비공개 게시 및 회귀 테스트 통과.
2. 일반 상세 기여 compiler가 시간 bucket을 추론하지 못하는 정상 timestamp GROUP BY를 게시에서도 거절했다. 게시 안전성 판정에서만 timestamp를 scalar 범주로 엄격 재검사한다. 원본 projection은 계속 거절하며 기존 상세 탐색 compiler는 완화하지 않았다. 같은 Rill 게시400→성공 재검증.
3. 독립 리뷰의 기기 시간 오차 반복 조회, 중지된 journal 응답의 거짓 게시 성공 안내, 저장 완료 뒤 미완료 게시 취소 누락을 수정했다. 브라우저 Date.now +2시간에도1.2초 동안 조회2회로 제한·유효 화면 유지. revoked receipt는 성공/링크를 숨기고 새 명시 게시를 안내. 관련 취소/응답 유실 회귀 통과, 후속 읽기 리뷰에서 세 건 해소 확인. 추가로 응답 유실 이후 다른 탭이 재게시한 경우 과거 영수증을 현재 공개 범위로 오인하지 않도록 게시 후 owner metadata를 새로 확인한다. 실제 commit v3 뒤 응답503만 주입→다른 요청에서 private v4→원래 요청 replay v3에서도 UI는 최신 private v4 표시→명시 link 재게시 v5까지 확인했다. 이503은 실제 장애가 아닌 전송 계층 주입이고 두 게시 commit은 실제 API다.
4. 실제 캡처의 숫자 수직 정렬·중복 데이터 버튼·모바일 브랜드 숨김·시간축 끝 잘림을 게시 화면에 한정해 정리했다. 마지막1440/768/390px PNG를 직접 검토했다. 390px는 단일 열, 큰 수치/카드/입력/현재 링크가 페이지를 넘치지 않는다. 표만 내부 스크롤하며 모바일 버튼·summary는44px 이상이다. 최소 내용 높이를 확보하는 읽기 화면이며 편집 캔버스의 drag/resize는 제공하지 않는다.
5. 라디오 방향키, Dialog Tab25회 내부 유지, 날짜 입력 방향키, Enter 게시·재게시·중지 확인, Escape 후 트리거 복귀, 집계 데이터 Enter 열기/닫기와 focus 유지, 추이 표 Enter를 실제 검증했다. 테스트 스크립트의 일반 문자열 응답 JSON 파싱·토글 후 달라진 버튼 이름·브랜드 접근성 이름 선택 오류는 제품 오류와 구분해 수정했다.

**기능 PASS_SELECTED / 디자인 PASS_SELECTED**. 실기기·실제 VoiceOver는 실행하지 않았고 VoiceOver BLOCKED를 유지한다. 라이브 Rill과 공유 UX 재비교·모든 언어/장문/고부하·운영 외부 배포·T9 remix·전체 TC-005는 NOT_RUN이다. 단일 서버 Studio queue는 게시 집계 동안도 점유하므로 운영 다중 인스턴스/공유 쓰기·고동시성 성능 보장은 이번 결과에 포함하지 않는다.

### 검사·증빙

- BE **49개/5suite PASS**: 게시 서비스(실제 DuckDB/SQLite), 권한·캐시 controller, migration up/down, 실행·저장 영향. Nest build·변경 lint PASS.
- FE **54개/6file PASS**: 실행4file46 + 게시 controls5 + 게시 boundary3. 공유 node_modules의 MUI 테스트 import 오류는 기존 MUI stub 방식으로 격리했다. 실제 MUI 디자인은 브라우저에서 검증했다. FE 타입·변경 lint·production build PASS. 전체 제품 suite·무관 MD는 재실행하지 않았다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t8-20261015/`. `browser-results.json`, `http-results.json`, `public-layout-results.json`, `remaining-results.json`, `final-design-results.json`, `live-expiry-results.json`, `receipt-concurrency-results.json`, `save-share-execution.json`, `public-snapshot.json`, 서버·FE 단위/타입/린트/빌드 로그. 인증정보·비밀번호·원본 행·요청 원문을 증빙에 저장하지 않았다. 공개 샘플 집계와 로컬 링크는 포함한다.
- PNG: `publish-private-{1440,768,390}.png`, `private-denied-390.png`, `republish-expiry-390.png`, `revoke-owner-390.png`, `revoked-390.png`, `expired-390.png`, `live-expiry-cleared-390.png`, `save-share-execution-{1440,390}.png`, `response-loss-concurrent-scope-390.png`, 최종 `final-published-{1440,768,390}.png`. 실패 JSON/PNG도 보존했다.
- 브라우저는 이전 승인된 headed Chromium fallback을 재사용했고 마지막 게시본을 Codex IAB에서 확인해 탭에 남겼다. 임시 UI 검증 코드는 /private/tmp에만 두고 상시 Playwright suite를 추가하지 않았다.

T8 선택 범위·G3 완료. 다음 T9 **내 데이터로 복제·열 매핑·필수열 누락 안내**.


## T9 — 내 데이터로 복제·열 매핑 · 2026-10-15

기준38406c17 + T9 diff. 기존 통과 케이스는 재사용하며 아래 신규 조건만 실행한다. 원본의 게시 시점 의미 정의를 이용하고 최신 초안·원본 연결·SQL을 수신자에게 복사하지 않는다.

| ID | 조건 | 상태 |
| --- | --- | --- |
| STUDIO-R01 | 복제 명시 허용·소유 데이터 선택·정확 이름/타입 자동 매핑·변경 열 확인·원본 정답·새 ID/참조·private 저장/reload | PASS_SELECTED |
| STUDIO-R02 | 미허용/타인 소스/만료·중지 거절, 필수열/타입 충돌 차단·명시 제외/배치 정리, 버전 경합·멱등성·원본 불변 | PASS_SELECTED · 경합은 하위 검사 |
| STUDIO-R03 | 1440/768/390px·긴 열 이름·빈/오류 안내·키보드·포커스·44px·가로 넘침 | PASS_SELECTED |
| DESIGN-04/VoiceOver | 이전 OS 권한 차단 | BLOCKED 유지 |

Ruling: 공개 스냅샷에 계산 의미가 없는 이전 게시본은 소유자가 복제 허용을 선택해 재게시해야 한다. 최신 초안을 몰래 이용하지 않는다. 자연어 복제/모호한 자동 매핑은 하지 않고 검토 화면에서 대상·매핑을 확정한다. gpt-6-luna 설정 유지, 확정된 의미를 옮기는 과정은 모델 호출 없이 서버 compiler를 재사용한다.


### 구현 계약

- 게시 설정의 **내 데이터로 복제 허용**은 기본 꺼짐이며 명시 재게시할 때만 의미 정의를 캡처한다. `GET /studio/publications/:token/remix-template`, `POST .../remix-preview`, `POST .../remix`는 모두 인증·게시 정책·수신자 소스 소유권을 검사한다. 캐시는 no-store다.
- 공개 시점의 구조화된 지표·분류·표현·3폭 배치만 서버에 저장한다. 실제 실행 SQL과 canonical 의미가 일치하지 않으면 해당 블록을 미지원으로 표시한다. SQL을 역추측하거나 최신 초안으로 대체하지 않는다. 원본 연결/파일/SQL·인증·원본 행·실행 이력은 수신자 응답이나 새 대시보드에 복사하지 않는다.
- 대상 데이터는 기존 Studio 파일·샘플·소스 선택기를 재사용한다. 정확한 이름과 DuckDB 타입만 자동 연결하며 후보·형 변환을 추측하지 않는다. 변경/빈 매핑은 저장 전에 명시 재검증한다. 필수 열이 없으면 저장 차단, 블록 제외는 사용자가 선택하며 모든 breakpoint 배치 참조도 제거한다. 모두 제외한 저장은 금지한다.
- 저장은 대상 dataVersion·게시 version을 pin하고 queue/snapshot/transaction 안에서 권한·상태를 재확인한다. 새 dashboard/block/metric ID를 부여하고 source·dimension 참조는 수신자 데이터로 연결한다. 같은 원본 소스에 복제해도 metric은 독립적으로 생성한다. 원본 게시 링크·공개 범위·만료·history를 상속하지 않고 새 게시본은 없는 private 대시보드로 만든다.
- actor/requestId journal과 본문 해시로 응답 유실 재시도 중복을 막는다. 재시도 동안 입력을 잠그고 같은 요청을 재전송한다. 다른 계정의 늦은 저장 응답은 화면 이동/상태 갱신에 쓰지 않으며, 같은 계정의 토큰 갱신은 매핑·진행 중 요청을 유지한다. JWT identity 해석은 UI 응답 소유자 구분용이며 서버 인가를 대체하지 않는다.

### 실행·정답·독립성

- Node24/npm, FE3229/API4329, T8 DB의 일관된 격리 복제 `/private/tmp/vm-studio-t9-20261015/metadata.db`. 기존 공개 샘플 파일은 읽기 재사용하고 새 업로드는 별도 파일로 만들었다. 원본 사용자 DB/파일·전역 AI/OS 설정은 바꾸지 않았다.
- 소유자 계정의 source10/dashboard8을 명시 동의로 v6 재게시했다. 다른 수신자 계정은 원본 소스에 접근할 수 없지만 게시 의미 정의를 조회하고 자신의 source18(정확 이름)/source19(열 이름 변경)에 연결했다. 실제 UI 파일 선택으로 Parquet를 올리고 `bid_request_cnt→request_count`, `bid_floor→floor_total`, `has_bid_floor_cnt→floor_count`, `device_type→device_label`, `__time→event_time`을 명시 확인했다.
- 동일 공식 Rill **1,391,572행**, 총 요청 수 **634513000**, 평균 입찰 하한가 **5.571238676523254**. 독립 oracle5.571238676526892와 오차<1e-9다. 미리보기와 새 private dashboard14 저장·reload에서 숫자·새 참조·전 breakpoint geometry·표현 보존을 확인했다. 원본의 수치를 복사한 것이 아니라 대상 파일을 DuckDB에서 다시 집계했다.
- 모바일 Enter 저장 후 Studio로 이동했다. 복제본 제목을 별도 API save로 바꾸고 실제 UI reload에서 `내 데이터로 복제 · Rill 광고 분석`을 확인했다. 원본 문서(ID/metric/revision 포함)와 v6 전체 게시 snapshot은 deep equal로 불변. 새 복제본 게시 metadata 없음, 원본 소유자는 새 복제본403·익명401이다. 제목 독립 편집은 API+화면 재조회 범위이며 AI 편집을 새로 실행했다고 세지 않는다.
- source16은 전체 행에서 `bid_floor`만 뺀 오류 표본이다. 평균 블록만 미연결, 저장400. UI Space로 해당 블록 제외 후 매핑 Enter 확인→3개 미리보기·해당 필수열 제거·저장 가능 상태를 확인했다. API 저장 dashboard13의 모든 배치도3개이며 같은 requestId replay는 같은 ID, 다른 본문409다.
- source17은 `bid_request_cnt`를 VARCHAR로 바꾼 **5행 형식 오류 전용** 표본이다. 동일 139만 행 정답 표본으로 취급하지 않는다. 명시 연결은 incompatible·저장 차단, 잘못 고른 열은 입력창에 유지되고 aria-invalid/설명 연결을 제공한다.
- 실제 API의 미허용403·private 수신자403·타인 targetSource403·익명401·오래된 version409·실제 만료/중지410과 no-store/data0을 확인했다. 중지 링크는 실제 모바일 화면에서 안내와 미리보기0을 확인했다. revoke-vs-commit·도중 소스 교체·transaction rollback·실행 SQL 변조·같은 source의 독립 metric은 하위 서비스 검사이며 실제 파일 교체/다중 프로세스 운영 경쟁 시험은 아니다.

### 발견 오류·재검증

1. 계정 전환 중 늦은 저장 응답을 사용하지 않도록 generation과 actor identity를 확인했다. 독립 리뷰에서 지적한 같은 계정 토큰 자동 갱신 시 busy가 풀리지 않는 문제를 수정하고, 다른 탭 refresh 이벤트도 입력을 초기화하지 않도록 했다. 응답 유실 동일 요청 재시도·로그아웃 늦은 응답·refresh 성공 React 회귀 통과.
2. 형식 불일치 응답에서 유효하지 않은 선택을 normalization이 버려 UI가 빈 열로 보였다. 사용자 선택을 유지하고 타입 안내/aria-invalid를 연결했다. 실제390px 재검증에서 VARCHAR 선택 유지·오류 설명·저장 차단 확인. 최초/수정 후 캡처를 분리했다.
3. 독립 backend 리뷰의 두 재현: 대상의 첫 시간 열과 매핑한 시간 열이 다를 때 명시 월 집계가 실패하는 문제, 비COUNT의 실제 `*` 열 매핑을 wildcard로 취급하는 문제를 수정했다. chart의 검증된 시간 차원을 사용하고 COUNT sentinel만 예외로 둔다. 각각 preview/save/reload 회귀 통과 및 리뷰 재확인. 이 특수 두 표본의 쿼리 값은 mock 기반 하위 검사이고 real Rill 재집계는 별도 확인했다.

### 디자인·키보드·제한

- 실제 **1440/768/390px**, document scrollWidth 각각1425/753/375로 페이지 가로 넘침0. 변경 버튼·native select 최소44px, 열 label14px, 두 열→한 열 재배치·수치/추이/표·긴 `video_max_duration_bucket` 선택값을 확인했다. 긴 표만 내부 스크롤한다. 저장 전 검토와 명시 제외를 별도 영역으로 표시했다. PNG 대신 실제 도구의 JPEG 캡처를 저장하고 직접 살폈다.
- 수신자 로그인 후 다른 탭 storage 이벤트로 정의/소스 갱신, 소스 메뉴 Enter 선택·native select 방향키/Enter 변경·Tab 이동·Space 제외·Enter 확인/저장·정확한 데이터 표 열기를 확인했다. IAB의 로그인 target-blank 자동 탭 열기는 확인하지 못해 같은 브라우저의 별도 로그인 탭을 명시 생성했고, 로그인 복귀 이벤트를 검증했다.
- **기능 PASS_SELECTED / 디자인 PASS_SELECTED**. 실기기·모든 언어·전체 키보드 순서/스크린리더·운영 동시 부하·실제 source 파일 교체 경쟁·live Rill의 remix UX 재비교는 NOT_RUN. 실제 VoiceOver는 BLOCKED 유지한다. 자연어 remix dispatch는 미구현이며 현재 명시 복제 화면으로만 수행한다. 전체 TC-005/T10·실제 외부 배포가 완료됐다고 주장하지 않는다.
- AI_PROVIDER=codex 및 gpt-6-luna·10100 연결/카탈로그 설정 유지. 이 단계는 결정된 구조화 의미의 재사용이므로 새 모델 호출0이다. 기존 AI 검증을 반복하거나 새 LLM 성공으로 세지 않았다. MUI/기존 renderer·worker 재사용, 신규 의존성·상시 E2E 코드 없음.

### 검사·증빙

- 최종 BE **437 tests/22suite PASS**, 변경 lint·Nest build PASS. T9 전체 backend 검사1608개는 리뷰 수정 전1회 통과했고 이후 변경 영향 Studio/시간/기여/추이 범위만437개 재검증했다. 최종 FE **14 tests/3file PASS**, 타입·변경 lint·production build PASS. 버전 경고(ts-jest/TypeScript, Vite configLoader)는 기존 경고로 유지한다.
- `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t9-20261015/`: `http-results.json`, `permission-results.json`, `clone-results.json`, `final-preview-results.json`, `layout-results.json`, `browser-results.json`, `long-column-results.json`, 원본 문서/게시 snapshot 비교 기준·fixture ID와 검사 로그. 인증값·비밀번호·원본 행·환경 secret은 증빙에 저장하지 않았다.
- 주요 캡처: `consent-publication-1440.jpg`, `remix-ready-{1440,768,390}.jpg`, `preview-exact-390.jpg`, `missing-column-390.jpg`, `exclusion-validated-390.jpg`, `type-mismatch-390.jpg`→`type-mismatch-fixed-390.jpg`, `long-column-390.jpg`, `revoked-remix-390.jpg`, `clone-final-{1440,390}.jpg`. 임시 검증 도구는 /private/tmp에만 뒀다.

T9 선택 범위 완료. 다음은 **T10 전체 흐름 수용·마지막 디자인 회귀**이며 통과 결과 재사용과 미실행 경계 구분을 우선한다.


## T10 — 전체 연결 흐름·최종 디자인 회귀 · 2026-10-15

### 인수 조건과 판정

기준 `efe3fbb337f8fa0685c3f6eec44c116d5a0115d7` + 이번 diff, Node24.21.0/npm, 격리 FE3229/API4329. `$vanillameta-verify`의 변경 범위 기준을 적용했다. 같은 조건의 기존 통과는 재사용하고 실제 연결 여정만 새 대시보드15/복제본16으로 실행했다. Aside CLI 업데이트가 `fetch failed`여서 허용된 Codex IAB 대안을 사용했다. 외부 운영 배포는 하지 않았다.

**핵심 흐름 기능 PASS_SELECTED / 디자인 PASS_SELECTED. 전체 TC-005/G4는 PARTIAL.** 아래 표의 복제는 명시 UI이며 자연어 복제 성공을 뜻하지 않는다. Studio 공통 필터 조작은 아직 미지원이므로 필터 추가 전후 검증을 통과로 표시하지 않는다. VoiceOver BLOCKED 유지, 실제 발화·실기기·모든 키보드 경로·운영 부하는 NOT_RUN이다.

| TC-005 단계 / 명세 | 실제 입력·기대 | 결과와 근거 |
| --- | --- | --- |
| 1–2 / STUDIO-A02 | 기존 지표를 선택하고 전체 기간·필터 없음, KPI2·OS·시간 차트 생성 | 실제 Codex `gpt-6-luna` 지정 호출. 원본 이름을 바꾼 source19의 canonical metric12/13 version1 재사용, 블록 참조12/13/12/12. POST proposals201/5264ms, 4블록 저장 후 dashboard15 재조회 |
| 3 / E01·A01 | 이동·크기·복제·삭제·undo/redo 후 선택한 시간 차트 제목만 변경 | 실 gpt-6-luna 수정 완료. AI 직전/직후 문서를 비교해 해당 제목만 변경, 모든 breakpoint 배치·비대상 정의·블록ID 동일. 저장/게시 false |
| 4 / D01·D02 | 1440/768/390에서 선택·이력 보존, 모바일 순서·패널 키보드 | 폭 전환 후 동일 선택·초안 확인. Enter 설정 열기, Tab 이동, Escape 후 설정 트리거 복귀. 긴 스키마 버전 넘침 수정 후 세 폭 재검증. 모바일 resize는 T3 근거를 재사용하며 이번 부모 높이 관찰로 새 PASS를 주장하지 않음 |
| 5 / A03·P01 | `저장하고 링크로 공유해줘`, 새로고침 | 실제 inspectSource→saveDraft→publish 완료, v1 snapshot·집계 시점·링크와 실행 영수증 복원. 이 정확한 명령은 결정적 실행이며 추가 LLM 호출이 아님 |
| 6–7 / P01·P02 | 초안 수정만 저장→기존 게시 불변→동일 링크 재게시→다른 계정 조회 | OS 제목을 수정한 초안은 v1에 영향0. 복제 허용에 명시 동의하고 v2 게시. 수신자4는 게시만 조회, 원본 dashboard15/source19는403 |
| 8 / R01·R02 | 다른 계정 소유 source9로 필수 열 연결 후 비공개 저장·reload | 모바일 Enter로 매핑 확인/새 private dashboard16 생성. 새 block/metric ID, 세 폭 배치·표시 유지. 복제본 제목 수정 후 원본 초안/v2 불변, 원 작성자는 복제본 접근403 |
| 9 / P02·UC-005 A5 | 방금 만든 테스트 게시본15의 v2 링크 중지·재접근 | 자동 승인 검토 보류 후 사용자가 해당 테스트 링크 중지를 명시 허용. 실제 중지2026-10-15T07:38:13.146Z. 익명/수신자410·no-store·집계 데이터0, UI 안내와 카드0. 원본 초안과 비공개 복제본16 유지 |

### 데이터·모델·정확성

- 공식 Rill auction **1,391,572행**의 같은 값. source19는 `request_count/floor_total/floor_count/device_label/event_time`으로 이름을 바꾼 파일이며, 수신자 source9는 원래 열 이름이다. 복제 매핑은 request_count→bid_request_cnt, floor_total→bid_floor, floor_count→has_bid_floor_cnt, event_time→__time, device_os→device_os다. 두 계정은 격리 테스트 계정이며 원래 사용자 DB/파일은 변경하지 않았다.
- 요청 합계 **634,513,000**, 가중 평균 **5.571238676523254** (독립 정답5.571238676526892, 허용오차1e-9), OS **28그룹**의 모든 값과 합계가 독립 DuckDB 결과와 일치. 시간169점은 원본 UTC를 유지했다. 생성·게시·복제에서 같은 정답을 확인했다. UI 평균5.571239는 표시 반올림이다.
- `AI_PROVIDER=codex`, `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, 기존 모델 카탈로그를 유지했다. 실제 Codex 호출에 gpt-6-luna를 명시했다. CLI 결과만으로 상위 라우터 내부 모델 정체까지 독립 입증하지는 않는다. 로컬 LLM/다른 모델로 대체하지 않았다.
- 기존 Rill 화면/기간 이동 차이 기록과 T6의 별도 매출·환불 oracle(37주문, 매출20994.61/환불4457.60/순매출16537.01 USD)을 재사용했다. 이번은 새 Rill 앱 UX 비교나 commerce 재실행이 아니다.

### 발견 오류·수정·재검증

1. **기능 실패:** ‘제목만 바꿔줘 … 저장하거나 게시하지 마’가 게시 단어 포함만으로 unsupported 처리됐다. 명시적 게시 금지절을 미지원 의도 판별에서만 제외했다. 원문·저장 판정·정확한 게시 동의 명령은 유지하고, 남은 긍정/모호한 게시 의도는 여전히 차단한다. 한/영 부정 편집6개·긍정 잔여3개 회귀를 추가, 실패 후42개 관련 테스트 PASS. 같은 실제 gpt-6-luna 요청으로 제목 변경·배치 불변 재검증. 모든 언어 표현 지원을 주장하지 않는다.
2. **디자인 실패:** 모바일 설정의 긴 schemaVersion이 345px 패널에서 scrollWidth454px로 넘쳤다. `.studio-definition span`에 국소 줄바꿈을 적용해 원문 전체를 유지했다. 수정 후390 패널345/345, 768 패널360/360, 1440 패널319/319이며 가로 넘침0. Tab 포커스·Escape 복귀도 다시 확인했다. 숫자/저장 의미는 바꾸지 않았다.
3. **검사 환경 실패:** 전체 FE 검사 중 StudioEditor의 MUI mock에 게시 Dialog가 사용하는 RadioGroup/Radio/FormControlLabel/Checkbox가 빠져10개가 실패했다. 실제 컨트롤4개만 mock에 연결하고 기존 assertions/테스트 본문은 유지했다. 해당17개 재실행 PASS.

### 재사용·최종 검사

- T2~T5 문서/reducer/연산 계약, T6 파일/샘플·모호한 분모·실패 조건, T7 취소/restart/부분 복구, T8 만료/권한/게시 재시도, T9 누락열/타입/권한/멱등 변형을 관련 코드 diff 기준으로 재사용했다. 새 연결 여정이 기존 모든 실패 변형을 재실행했다는 뜻은 아니다.
- BE 전체1608개(T9 수정 전) + 이후 영향 범위437개(T9 최종) 근거를 재사용하고 이번 실행 의도 변경의 **42개/2suite**를 새로 통과했다. 변경 BE lint·Nest build PASS.
- FE 전체1회에서 다른68파일941개 PASS + mock 수정 후 해당1파일17개 PASS = **69파일958개를 합성 확인**했다. 최종 전체 suite를 다시 실행했다고 보고하지 않는다. FE 타입·변경 TSX lint·CSS 수정 후 production build PASS.
- 영향받는 기존 core **7개 PASS**(CSV→집계/차트/저장, 인증, 위젯→대시보드→legacy 공유/임베드, smoke). 기존 Pivot 등 무관한 core는 재사용했다. 새 대량 UI 테스트 코드는 추가하지 않았다.
- 루트 npm test/build는 하위 명령 wrapper다. 사용자의 통과 조건 재사용 요청에 따라 위 실행과 재사용 근거를 합성하고 wrapper로 전체를 중복 실행하지 않았다. 기존 ts-jest/TypeScript·Vite 경고는 로그에 남긴다.
- 독립 리뷰는 게시 동의 경계와 새 의도 분류 diff에서 구체적 문제를 찾지 않았다. 증빙 리뷰에서 지적한 모바일 resize 근거 한계는 T3 재사용으로 명확히 기록했다. 최종 문서·diff 검토와 로컬 커밋까지만 진행하며 push/merge는 이번 범위 밖이다.

### 증빙

폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t10-20261015`.

- `request.json`, `generated-baseline.json`, `os-oracle.json`, `ai-edit-invariants.json`: 원문 요청·기준/정답·AI 전후 불변식.
- `saved-and-published.json`, `draft-isolation.json`, `remix-results.json`, `revoke-results.json`: v1/초안 분리·v2 복제 독립성·중지 후 차단.
- `generation-review-1440.jpg`, `negative-publication-intent-failure-1440.jpg`, `ai-edit-fixed-1440.jpg`: 생성/최초 실패/실제 AI 수정 후.
- `recipient-published-1440.jpg`, `recipient-published-768.jpg`, `recipient-published-390.jpg`, `save-share-restored-390.jpg`, `republish-consent-390.jpg`, `remix-preview-390.jpg`: 게시·영수증·재게시·매핑.
- `clone-keyboard-390.jpg`(넘침 실패), `clone-keyboard-fixed-390.jpg`, `clone-keyboard-fixed-768.jpg`, `clone-keyboard-fixed-1440.jpg`, `clone-final-1440.jpg`, `clone-final-390.jpg`, `revoked-link-390.jpg`: 수정·재검증·최종 복제본·중지 안내. 캡처를 직접 살펴보고 판정했다.
- `intent-red.log`/`intent-green.log`, `frontend-all.log`, `t10-studio-editor-test.log`, 타입/lint/build/core 로그, `manifest.json`과 `reuse-audit.json`: 실행/재사용 경계. 별도 resize JSON은 부모 높이 관찰뿐이므로 블록 resize 증명으로 사용하지 않는다.

### 남은 범위

1. **UC-005 BR-001 자연어 복제 dispatch**: 현재 명시 ‘내 데이터로 복제’ UI만 지원한다. 생성도 `/studio/new` 진입을 사용한다. 한 대화의 모든 의도가 완료됐다는 전체 PASS는 보류한다.
2. **Studio 공통 필터 편집/저장/게시/복제 전파와 필터 추가 전후 디자인**: 현재 ‘전체/없음’ 컨텍스트·태그만 있으며 기능 검증으로 세지 않는다.
3. **VoiceOver BLOCKED**, 운영 부하/다중 서버·실기기·전체 키보드 순서는 NOT_RUN. 기존 제한을 해제하지 않았다.

다음 우선순위는 새 기능을 반복 검증하는 대신 BR-001 복제 연결 또는 Studio 공통 필터 중 한 범위를 구현하고 해당 미완료 조건만 검증하는 것이다.


## T11 — 대화에서 복제 준비·매핑 연결 · 2026-10-15

범위: UC-005 BR-001/005의 자연어 복제 진입. `내 데이터로 복제해줘`는 현재 소유 게시본, 같은 명령에 `/published/{token}` 또는 HTTP(S) 게시 링크를 붙이면 그 게시본을 현재 앱에서 검증한다. 링크 호스트로 네트워크 요청하지 않고 token만 현재 앱의 권한 경계에 전달한다. 복제 가능한 게시본이 없거나 허용/권한/만료 조건이 실패하면 링크를 만들지 않는다. 혼합 저장·게시/부정문·잘못된 링크는 미지원이며 추측하지 않는다.

| ID | 기대 | 상태 |
| --- | --- | --- |
| STUDIO-R03 | 자연어 요청→서버 게시 권한·복제 허용 확인→typed handoff, 모델/저장/게시0 | PASS_SELECTED: 한/영 bounded 명령 단위·실제 한글 대화 |
| STUDIO-R04 | 대화의 내부 매핑 링크→내 소스 선택·명시 확인→비공개 복제, 기존 초안 유지 | PASS_SELECTED: 편집16→게시8/v6→source9→새 private19 |
| STUDIO-R05 | 없음/거절/만료·중지/부정문/혼합 명령, 실행 기록 reload/replay | PASS_SELECTED: 없음/중지 실제UI·기록 복원, 403/404/410·부정/혼합/replay/cancel 단위 |
| STUDIO-D01/D02 T11 | 1440/768/390px 영수증·긴 링크, Tab/Enter·새 탭·기존 초안 유지 | PASS_SELECTED: 세 폭 overflow0·44px 링크·Enter새탭·Escape복귀 |

복제 준비 완료와 복제본 저장 완료를 구분한다. 단일 대화 안의 매핑·저장까지 구현됐다고 확대하지 않는다. 기존 T10/숫자/매핑 변형은 변경 영향이 없으면 재사용한다. gpt-6-luna 설정과 VoiceOver BLOCKED 유지.


### 구현·실제 결과

- 기준 `cd3fb390` + T11 diff, 같은 FE3229/API4329·격리 T9 DB, Node24.21.0. 기존 AI SDK `useChat`/transport/실행 기록을 재사용했다. 모델/API 의존성을 추가하지 않았다. gpt-6-luna Codex 연결 설정을 유지하며 이 결정적 복제 준비 명령의 **새 모델 호출은0**이다. T10 실제 생성·수정 검증은 재사용한다.
- 원래 편집 dashboard16에서 시간 차트 제목을 `T11 미저장 초안 유지`로 바꾸고 저장하지 않은 상태로 `내 데이터로 복제해줘 /published/{기존 활성 테스트 token}`을 전송했다. 서버는 inspectSource→remix 두 단계만 실행하고 게시본8/v6의 권한·복제 허용·만료·원 소유자의 현재 접근권을 기존 `requireRemix`로 확인했다. 편집 소스의 집계·새 지표·대시보드·게시 쓰기는 없다. 실행 기록 자체는 기존 정책대로 저장한다.
- 응답은 `{token,version}`만 포함한다. 내부 URL은 브라우저에서 생성하고 외부 href/HTML/정의/연결정보를 받지 않는다. 링크는 `target=_blank`, `noopener noreferrer`이며 새 탭에서 기존 수신자 매핑 화면을 연다. 준비 완료 문구는 ‘아직 복제본은 저장되지 않음’을 명시한다.
- Enter로 실제 새 탭을 열어 source9(공식 Rill1,391,572행)를 선택하고 기존 이름·타입 자동 매핑을 확인했다. 요청634513000/평균5.571238676523196(독립 정답5.571238676526892와 오차1e-9 이내). 마지막 만들기 버튼을 Enter로 명시 실행한 뒤 **새 비공개 dashboard19**가 생성됐다. 공개 게시0·새 block ID, 원본16 persisted hash 동일, 원래 탭의 미저장 제목·이력1·dirty 상태 유지. 새 흐름 저장은1개, 기존 studio_run/게시 수는 불변이다. 이번 source는 device_type 차원이며 T10 OS28 대조와 혼동하지 않는다.
- 링크 없는 현재16은 게시본이 없어 준비 실패·링크0. T10에서 중지한15의 링크도 복제 준비 실패·데이터 연결 링크0. 새 정상 요청 후 준비 링크로 복구했다. 오류 안내는 권한·미허용·만료·없음을 추측해 단정하지 않는다. 성공/실패 각각 실행 기록 새로고침·폭 전환 remount로 복원했다. 마지막에는 검증용 미저장 제목을 undo하고 API 재기동/페이지 reload 후 같은 영수증이 재실행 없이 복원됨을 확인했다.
- 부정문·저장/게시 혼합·잘못된 token/두 링크는 unsupported, 현재/명시 게시본의403/404/410은 failed·REMIX_UNAVAILABLE, 취소 중 확인이 끝나도 링크 미반환. 단위 테스트로 검증했다. 모든 자연어를 모델이 해석하는 기능은 아니며 문서화한 정확한 명령만 라우팅한다. 원본 게시 상태가 나중에 달라지면 기존 영수증은 역사 기록이며 매핑 화면이 다시 검증한다.

### 검증·디자인·증빙

- BE 영향81개/3suite PASS 후 취소 경합·실패 재시도 보완이 들어간 execution43개 PASS. 다른 두 suite40개는 코드 변경 없음으로 재사용해 **83개 합성**이다. BE lint·Nest build PASS.
- FE focused56개, Studio 전체157개/16파일 PASS. 타입·변경5파일 lint·production build PASS. 기존 core7/매핑 오류/소유권·필수열/전체 T10 흐름은 변경 영향 없는 결과를 재사용했다. 전체 테스트·전체 E2E를 중복 실행하지 않았다.
- 1440/768/390px 실제 화면을 직접 검토했다. 복제 연결 링크 높이44px, 패널 clientWidth/scrollWidth는 desktop319/319, tablet360/360, mobile360/360, 문서 가로 넘침0. 긴 token은 버튼에 노출하지 않고 대화 원문은 기존 줄바꿈으로 수용한다. 문구 위계·간격·이웃 단계/입력창 겹침을 확인했다. 모델 로딩 UX 전체를 새로 검증하지 않는다.
- Enter 링크 새 탭/명시 만들기·Tab 이동·Escape 후 AI 열기 트리거 복귀를 확인했다. 최초 데스크톱 버튼은 공통 CSS에 의해36px로 줄어들어 해당 연결 버튼에만44px를 적용한 뒤 desktop/mobile 재검증했다. 새 탭이 활성화된 동안 viewport 설정이 그 탭에 적용돼 초기 일부 이미지가 축소 저장됐다. 그 캡처는 최종 디자인 증빙에서 제외하고 임시 override를 모두 해제한 뒤 원래 탭에서 재촬영했다. OS/권한/VoiceOver 설정 변경 없음, VoiceOver BLOCKED 유지.
- 증빙 폴더 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t11-20261015`. `before-remix.json`/`connected-results.json`은 쓰기·독립성, `backend-red.log`→`backend-green.log`/`backend-cancel-final.log`/`backend-retry-final.log`·`backend-affected.log`, FE focused/Studio/type/lint/build 로그는 검사 근거다. `handoff-final-1440.jpg`, `handoff-fixed-768.jpg`, `handoff-fixed-390.jpg`, `revoked-handoff-fixed-390.jpg`, `linked-mapping-preview.jpg`, `linked-clone-saved.jpg`, `*-layout.json`을 사용한다. `recovered-keyboard-390.jpg`, `missing-publication-390.jpg`, `revoked-handoff-390.jpg`, `handoff-390.jpg`, `handoff-keyboard-768.jpg`는 초기 캡처 설정 오류가 있어 최종 디자인 판정에서 제외한다.

**기능·디자인 PASS_SELECTED.** 남은 큰 항목은 **Studio 공통 필터의 편집·저장·게시·복제 전파**다. 이번은 자연어→기존 매핑 화면의 연결 완료이며, 한 대화 안에서 후보 매핑을 추론해 복제 저장까지 끝내는 자동 실행은 미지원이다. TC-005/G4 전체 PARTIAL을 유지한다. 별도 운영부하·다른 언어·실기기·VoiceOver는 실행하지 않았다.


## T12 — Studio 범주 공통 필터 · 2026-10-15

범위: UC-005 BR-002/FR-007의 범주 다중 선택. 날짜 범위는 이번 단위에 포함하지 않는다. 전체 기간 안에서 같은 필터를 모든 블록의 원본 행에 적용한 뒤 집계한다. 기존 SQL·저장 지표 계산·배치는 유지한다. 수동 적용으로 요청 수를 제한한다.

| ID | 입력 / 기대 | 상태 |
| --- | --- | --- |
| STUDIO-F01 | 공식 Rill source9/1,391,572행, device_type=Mobile/Tablet → 독립 SUM 및 가중 평균과 모든 블록 일치. 두 값 선택·해제 및 빈 결과는 이전 값과 혼동하지 않음 | PASS_SELECTED: 단일/다중·해제 실제 UI/API, 빈 결과 null/[]는 실제 DuckDB 단위. 빈 결과 UI는 NOT_RUN |
| STUDIO-F02 | 필터 변경 undo/redo·응답 경합·저장·새로고침·기존 보기 기본 조건, SQL·배치 불변 | PASS_SELECTED: 실제 저장19·복제20·기존 보기, 키보드 undo/redo. 지연 응답·오류는 결정적 FE 회귀 |
| STUDIO-F03 | 필터 저장 후 게시 snapshot에 동일 범위·수치. 새 소스의 이름 변경 열에 필터 매핑 보존·누락 필수 열 차단, 원본 불변 | PASS_SELECTED: 게시19/v1→소스9→비공개20 실제 UI, 누락 device_type 차단·복구. 다른 이름 소스 매핑은 실제 DuckDB 하위 검사 |
| STUDIO-F04 | 실제 gpt-6-luna 질문/선택 제목 수정에 현재 필터·검증 숫자를 전달. 비대상·배치·조건 보존, 저장·게시 자동 실행 없음 | PASS_SELECTED: 실제 모델2회(최초 정상 + 부정문 수정 재검증), 필터·정답 응답·선택 제목만 변경·쓰기0 |
| STUDIO-D01/D02 T12 | 1440/768/390px 필터 추가 전후·긴 라벨·오류, 키보드 선택/적용/Escape·초점, 가로 넘침0 | PASS_SELECTED: Rill 라벨·누락 매핑 안내·선택/해제·Space/Enter/Escape. 최대 길이 값·모든 키보드 경로·실기기는 NOT_RUN |

UI/기능/디자인 판정은 최종 실행 결과로 갱신한다. 기존 T10/T11 통과 조건은 재사용하며 VoiceOver BLOCKED, 날짜 범위·실기기·운영 부하는 NOT_RUN이다. 새로운 라이브러리·로컬 LLM·대체 모델을 추가하지 않는다.


### T12 실제 결과·수정·제한

- 같은 격리 FE3229/API4329, Node24.21.0/npm, 기존 메타데이터 DB와 DuckDB worker를 재사용했다. 신규 의존성·상시 E2E 코드를 추가하지 않았다. Aside 업데이트 `fetch failed`로 허용된 Codex IAB를 사용했다. gpt-6-luna 연결·카탈로그와 VoiceOver BLOCKED를 유지했다.
- `StudioDocumentV1.filters?` / `setFilters`: 범주 다중 선택, 최대5개 고유 열/각50개 primitive 값. 키 입력/체크마다 조회하지 않고 적용을 누를 때만 전 블록을 서버에서 다시 집계한다. SQL과 계산 참조·각 breakpoint 배치는 유지한다. 소스 전체의 낮은 cardinality 범주 후보를 기존 preview에서 재사용하며 저장된 선택값은 후보에서 사라져도 숨기지 않는다. 날짜 범위/숫자 범위 UI는 이번 단위에 포함하지 않았다.
- **단일 조건:** `device_type=Mobile/Tablet`, 요청307763000, 평균5.655265295536226(독립 Parquet 정답). 화면307,763,000.00/5.655265, 게시 snapshot 평균5.655265295536216. **두 값:** Mobile/Tablet+Personal Computer → 요청481071000, 평균4.368461296206581(독립 정답), 실제 API4.368461296204326. 차원307763000+173308000 및 시간169행 합481071000. 오차1e-9 이내. 전체 해제634513000→undo307763000을 확인했다.
- dashboard19에 조건을 저장하고 새로고침해 복원했다. 원본 canonical SQL과 배치는 그대로다. 실제 Codex gpt-6-luna 응답은 Mobile/Tablet와307763000을 설명하고 선택 제목만 `모바일 요청 합계`로 변경했다. 실행 단계에는 save/publish가 없고 DB 문서 대조로 비대상·필터·배치 불변을 확인했다. 이후 저장 버튼은 명시적으로 눌렀다.
- 저장19를 필터 포함 v1로 게시했다. 읽기 전용 조건 칩·KPI·차원·시간 집계가 같은 범위다. 모바일에서 복제로 진입해 source9를 선택하고 device_type 매핑을 비웠을 때 집계 미리보기0/만들기 disabled/빠진 필터 안내를 확인했다. 복원 후 Enter로 새 비공개20을 만들었다. 동일 소스의 실제 연결 흐름이며, 다른 이름 열(`channel→segment`)은 실제 DuckDB 서비스 회귀로 검증했다. 139만행 새 이름 파일의 브라우저 업로드·타계정 흐름은 이번에 반복하지 않았다.
- 복제20은 새 block/metric ID, 같은 조건·배치·집계, 게시0이다. 기존 보기20에서도 저장 기본 필터 칩과307763000/5.655265가 복원됐다. 필터 전체 해제와 undo는 키보드로 실행하고 저장 상태를 복구했다. 원본19 persisted hash는 복제 및 검증 전후 동일하다.
- **발견·수정:** 미완성 빈 값 필터를 엄격 문서 key로 비교해 예외 → UI draft key 분리. 후보50개 때문에 저장된 선택값이 숨겨짐 → 선택값 우선. 적용 함수 import 누락·진행 중 명시 적용의 자기 취소 → import/intent 구분. undo 시 오래된 effect가 새 조회를 취소 → 조회 effect는 문서 필터 key 변화만 추적, 현재 문서/확정 범위 참조·세대·AbortController로 응답을 격리. 같은 실패3조건 재검증 PASS. AI가 저장·게시 금지문 `저장과 게시는 하지 마`를 미지원으로 분류 → 조사 처리 수정 후 **원래 문장 그대로** 실제 모델 재검증 완료, 쓰기0.
- **리뷰 수정:** 두 필터를 같은 대상 열로 매핑하면400과 양쪽 열 이름을 안내하고 쓰기0. UC-003/004 지표 snapshot 재작성의 fallback에서도 동일 소스의 studioFilters를 유지하며 다른 소스 범위는 옮기지 않는다. 잘못된 저장 기본 필터는 전체 데이터로 대체하지 않고 오류·재조회 버튼을 표시한다. 구조화 metadata는 한 번만 읽는다.
- **디자인 PASS_SELECTED:** 1440/768/390 실제 PNG를 직접 확인했다. 문서 scrollWidth1425/753/375로 가로 넘침0. 모바일 필터 토글·선택 라벨44px, 값 목록260px 안에서 스크롤, 버튼/입력·수치·카드의 겹침 없음. Space 선택/Enter 적용·전체 해제/Enter 복제/Tab 이동·Escape 후 토글 초점 복귀. 기존 md 배치는 그대로 유지했으며 임의로 카드를 늘려 재배치하지 않았다. 모든 상태·최대128/2000자·전체 키보드·스크린리더 완료는 아니다.
- **검사:** BE 기본 변경135개, 기존 AI/실행96개, 게시/복제/생성83개, 리뷰/부정문 최종83개를 범위별 실행했다(중복 포함, 단순 합산하지 않음). FE focused84개와 Editor/adapter/대화/복제 영향38개 PASS(로그 파일 수4), 대화 실행 기록·transport 추가13개 PASS. 타입·변경 FE/BE lint(오류·경고0)·양측 production build PASS. 기존 T10/T11 핵심 E2E·공유 만료/권한 변형 등 변경 없는 결과는 재사용했고 전체 wrapper/전체 E2E를 반복하지 않았다. ts-jest TypeScript 범위 및 Vite configLoader의 기존 도구 경고는 남으며 제품 검사 실패가 아니다.

### T12 증빙과 남은 작업

저장소 밖 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t12-20261015/`:

- `rill-oracle.json`, `rill-dual-oracle.json`, `actual-dual-preview.json`, `publication-scope.json`, `flow-invariants.json`: 정확한 집계·필터·독립 복제·비대상 불변.
- `saved-filter-1440.jpg`, `dual-filter-1440.jpg`, `filter-768.jpg`, `mobile-filter-open-390.jpg`, `clone-final-390.jpg`, `final-filter-{1440,390}.jpg`, `published-final-390.jpg`, `remix-scope-390.jpg`, `legacy-default-filter-390.jpg`, `ai-filtered-edit-1440.jpg`, `ai-negative-fixed-1440.jpg`: 실제 화면·키보드·모델 결과. `final-*-layout.json`은 실제 폭/크기다.
- `first-filter-1440.jpg`는 HMR remount로 초기화된 상태, `filter-1440.jpg`는 적용 실패 당시 상태, `published-filter-390.jpg`는 비활성 탭의 뷰포트 캡처 오류로 최종 디자인 판정에서 제외한다. 원본은 실패/제외 근거로 남긴다.
- unit/type/lint/build 최종 로그와 초기 실패→재검사 로그를 보존했다. 임시 프로브·전역 AbortController patch·무관한 명령 출력 파일은 제품/테스트에 남기지 않았다. 서버 원시 로그는 인증정보 가능성이 있어 증빙에 복사하지 않고 필요한 상태/수치만 추렸다.

**남음:** Studio 날짜 범위의 편집·저장·게시·복제 전파, 한 대화 안에서 매핑과 최종 복제까지 실행하기, 미검증 전체 키보드/VoiceOver·실기기·운영 조건. 전체 TC-005/G4는 **PARTIAL**이다. 새 Rill live UI/시간 이동 비교는 NOT_RUN이며 기존 공식 샘플·기존 계산 기준 재사용과 이번 독립 숫자 대조를 구분한다.


## T13 — Studio 날짜 범위 · 2026-10-16

Given 공식 Rill source9의1,391,572행과 T12 Mobile/Tablet 범주 조건,
When __time의 UTC 2023-09-10~2023-09-11을 적용하면,
Then 종료일을 포함한 원본 범위 [09-10 00:00,09-12 00:00)에서 모든 블록을 집계한다. SQL·배치·범주 조건을 보존한다. 날짜 입력만으로 조회하지 않고 명시 적용한다.

| ID | 기대 결과 | 상태 |
| --- | --- | --- |
| STUDIO-F05 | 날짜+범주 AND 집계, 단일 날짜·잘못된 범위·해제, undo/redo·경합에서 확인된 범위만 숫자에 표시 | PASS_SELECTED |
| STUDIO-F06 | 저장→새로고침→기존 보기→게시 snapshot→내 데이터 복제에 동일 날짜·범주·정답. 날짜 매핑 누락·비시간 열 거부 및 원본 불변 | PASS_SELECTED |
| STUDIO-A01 T13 | 날짜 조건이 AI 문맥과 서버 미리보기에 전달되며 선택 수정은 범위를 보존. 설정 gpt-6-luna 유지 | PASS_SELECTED |
| STUDIO-D01/D02 T13 | 1440/768/390px 날짜/필터 패널·긴 기간 라벨, 키보드 입력·적용·해제·undo, 가로 넘침/겹침 없음 | PASS_SELECTED |

T10~T12 관련 없는 PASS 조건은 재사용한다. 실기기·날짜 UI의 다른 시간대·VoiceOver(BLOCKED)·새 Rill live UI 대조는 이번 통과로 확대하지 않는다. 증빙 폴더 `phase2-fix-evidence/studio-t13-20261016`.


### T13 실행 결과

- Node24.21.0/npm, 같은 격리 FE3229/API4329·T9 메타데이터 DB·기존 DuckDB worker를 재사용했다. Aside 업데이트 실패의 기존 근거와 승인된 Codex IAB 대체 경로를 재사용했다. 신규 의존성·상시 E2E 코드·로컬 LLM·모델 대체는 없다.
- 문서 `dateRange?`와 `setDateRange(range|null)`을 추가했다. 기존 `validateDateRange`/`dateRangeBounds`를 재사용하며 UTC 달력 날짜는 종료일 포함, timestamp는 종료 미포함이다. sourceQuery에서 범주 필터와 AND한 뒤 모든 블록을 집계한다. UI는 UTC 날짜 입력/명시 적용/기간 해제만 제공한다. 다른 시간대·초 단위 저장 범위는 표시/엄격 검증하고, UI 적용 시 UTC 날짜로 대체됨을 안내한다.
- **독립 Parquet 정답:** Mobile/Tablet + UTC 2023-09-10~11은 실제 원본209504행, 요청90789400, 가중 평균5.922632802560112. 실제 API 요청90789400/평균5.922632802560037(절대오차7.46e-14), 차원 합과 시간48행 합90789400, 마지막2023-09-11 23:00으로 종료일 포함을 확인했다. 단일09-10은 요청43982000/평균6.062710176083509(정답6.062710176083323), 시간24행이다.
- 실제 UI에서 입력 중 preview 요청0·역전 기간 적용 disabled를 확인했다. 날짜만 해제하면 범주 조건은 남고307763000으로 돌아간다. 키보드 undo로 이틀 범위90789400을 복원했다. 지연 응답이 undo 결과를 덮어쓰지 않음과 redo/해제·혼합 scope는 FE 회귀로 확인했다. 기존 범주 단독 변형 전체를 반복하지 않았다.
- dashboard20에 저장→reload→기존 보기에서 날짜·필터·정답을 확인했다. `structuredDefinition.studioDateRange`와 Studio 문서가 일치하고 canonical SQL/3개 breakpoint 배치는 그대로다. 실제 Codex **gpt-6-luna 1회**는 적용 날짜·Mobile/Tablet·90789400을 설명하고 선택 제목만 `이틀간 모바일 요청`으로 변경했다. 자동 저장/게시0을 DB 대조로 확인한 뒤 저장 버튼을 명시 실행했다.
- dashboard20/v1을 기존 로컬 공식 샘플 링크로 게시했다. snapshot의 읽기 전용 날짜·필터와 집계가 일치한다. 복제 template은 `__time`을 네 지원 블록 모두의 필수 열로 지정한다. 모바일에서 날짜 매핑을 비우면 결과 영역0·생성 disabled·날짜 열 안내가 나타나며 네 블록 모두 차단된다. 복구 후 Enter로 새 **비공개21** 생성. 같은 날짜/필터·배치, 새 block/metric ID, publication0을 확인했다. 이전 원본19 hash는 전체 실행 전후 동일하다.
- **오류 수정:** 기간이 다른 미리보기 응답을 client에서 거부한다. 잘못된 저장 날짜/필터는 `INVALID_STUDIO_SCOPE`로 구분하고 기존 보기에서도 전체 데이터로 우회하지 않는다. 동시 범위 변경·undo는 날짜+범주의 단일 key와 요청 세대/abort로 격리한다. 캘린더 rollover/0000년/9999년 경계·지원하지 않는 정밀도·timezone을 검증한다. 테스트 및 빌드에서 발견한 메서드 위치/타입 union 세미콜론/기간 문자열 문법 오류를 수정하고 빌드를 재검증했다. lint의 포맷·미사용 type import·테스트 non-null 경고도 수정했다.
- **디자인 PASS_SELECTED:** 1440/768/390px 최종 이미지를 직접 확인했다. 날짜 열+시작/종료는 3열→날짜2열→1열로 정렬한다. document scrollWidth가 각각1440/768/390으로 가로 넘침0. 데스크톱/태블릿 입력36px, 모바일44px, 모바일 날짜 글꼴14px·도움말12px, 버튼44px이다. 모바일 긴 날짜/필터·매핑 오류/읽기 전용 게시 범위가 잘리지 않는다. 연·월·일 방향키/숫자 입력, Enter 적용/해제/undo/복제, Space 복제 허용, Escape 후 기간 토글 초점 복귀를 확인했다. native date의 `fill()` 도구 입력은 값이 반영되지 않아 실제 키보드 입력을 사용했으며 제품 성공으로 오인하지 않았다.
- **검사:** BE core5suite151 PASS, publication12 PASS, remix `-t scope`10 PASS/30 skipped(새 날짜4개 포함). FE19files241 PASS(메인 통합86/Editor26 등을 포함한 최종 선택 실행, 합산하지 않음), FE 타입 PASS, 양측 build PASS, 변경 FE/BE lint 최종 오류·경고0. 기존 T10/T11 및 미변경 T12 권한/만료/중지/core E2E 결과는 재사용했다. 전체 wrapper/전체 E2E/운영 부하는 반복하지 않았다. BE 단위 실행 결과는 agent가 캡처한 결과를 `backend-agent-verification.md`에 기록했고, 원시 로그 파일로 오인하지 않는다.

### T13 증빙·제한·다음 작업

저장소 밖 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t13-20261016/`:

- `oracle.json`, `actual-dated-preview.json`, `single-date-preview.json`, `cleared-date-preview.json`, `date-input-proof.json`, `publication-date-scope.json`, `flow-invariants.json`: 원본 집계·적용/해제·scope 전파·ID 독립성·원본 불변.
- `reversed-date-1440.jpg`, `final-period-{1440,768,390}.jpg`, `final-layout-*.json`: 오류·최종 입력 크기/배치. `published-date-{1440,390}.jpg`, `remix-missing-date-390.jpg`, `cloned-date-390.jpg`, `legacy-dated-default-1440.jpg`: 저장·게시·복제·기존 보기.
- `ai-date-context-1440.jpg`, `ai-date-answer-1440.jpg`, `ai-date-answer.txt`, `after-ai.json`: 실제 모델과 저장 전 초안. 초기 `date-input-initial-1440.jpg`와 `baseline-768.jpg`는 개발 HMR 후 적용 전 상태라 날짜 적용/오류 판정 근거로 쓰지 않는다. 최종 이미지와 실제 수치 증빙을 우선한다.

**NOT_RUN:** 새 Rill live UI와 같은 날짜의 직접 UX 대조(공식 샘플·기존 계산 의미와 독립 oracle만 대조), 새 계정/이름 변경139만행 소스의 브라우저 업로드(다른 이름 날짜 열은 실제 DuckDB 서비스 회귀), 날짜 선택 팝업 전체 키보드 경로·모든 언어·실기기·다른 시간대 UI·운영 동시 부하. 빈 날짜 결과의 null/[]는 하위 회귀이며 UI 전체 상태 통과로 확대하지 않는다. **VoiceOver BLOCKED** 유지. 전체 TC-005/G4는 **PARTIAL**, 다음 제품 단위는 대화 안에서 매핑 확인과 최종 비공개 복제까지 완료하는 흐름이다. 이번 변경은 현재 워크트리에 미커밋 상태로 남겼다.


## T14 — 대화 안 열 매핑·비공개 복제 완료 · 2026-10-16

T12·T13은 58a1a39f로 현재 브랜치에 drumcap push 완료. 기존 PASS_SELECTED 변형은 재사용한다.

| ID | 새 조건 / 기대 결과 | 상태 |
|---|---|---|
| STUDIO-R07 | 대화의 복제 준비에서 내 소스 선택 → 열 매핑 확인 → 필터·기간 적용 미리보기 → 명시적 비공개 생성. 새 탭 이동 없이 완료 기록과 복제본 링크 표시. | PASS_SELECTED |
| STUDIO-R08 | 누락/변경한 매핑은 저장 차단, 매핑 재확인 후 복구. 게시 버전·소스 변경/권한 거절 시 현재 초안 유지. 요청 재전송·응답 유실 후 중복 생성 방지, 새로고침 시 서버 완료 기록 복원. | PASS_SELECTED · 실제 API/UI + 하위 장애 주입 범위 |
| STUDIO-D03 | 대화 복제 카드 1440/768/390px: 한 열 배치, 열 이름·숫자·오류 줄바꿈, 가로 overflow 없음, 입력·버튼 44px, 키보드 선택·확인·생성·완료 링크 접근. | PASS_SELECTED · 아래 키보드 제한 참조 |

고정 정답: source9 공식 Rill 데이터, Mobile/Tablet + UTC 2023-09-10~11: 요청 90,789,400 / 평균 입찰 하한가 5.922632802560112. 원본 대시보드21의 저장 내용·게시 상태를 변경하지 않고 별도 비공개 복제본을 만든다. gpt-6-luna 설정 및 VoiceOver BLOCKED 유지. 실제 VoiceOver·실기기는 이번 범위에서 실행하지 않는다.

### T14 실행 결과와 오류 수정

- 기존 Remix 소스 선택·프로파일·열 매핑·범위 미리보기를 `StudioRemixFlow`로 재사용한다. 별도 SQL 생성기·워커·라이브러리를 추가하지 않았다. 명시적인 비공개 생성 전에는 저장하지 않으며, 생성 결과를 현재 캔버스에 적용하지 않는다.
- 실제 actor4/dashboard21 대화에서 게시본20v1→owned source9 선택→날짜 열 매핑 해제/차단→복구→미리보기→모바일 Enter 생성으로 private22를 만들었다. 조건은 Mobile/Tablet AND UTC 2023-09-10~11. 최초 생성 POST 1회, 복제 대시보드 증가1, 영수증1, 복제본 게시0. GET 재조회 값은 요청 **90,789,400**, 평균 **5.922632802560037**로 독립 정답과 허용 오차 내 일치한다. 새로 열어 본 22도 필터·기간·4블록을 복원했다.
- 원본21에는 임시 미저장 제목을 넣고 생성까지 보존됨을 확인했다. DB의 원본21·게시20·게시21 상태 SHA-256은 전후 일치. 증빙 후 본 검증의 임시 제목 변경 1회만 undo하고 새로고침했다. 대화 완료 링크 `/dashboard/22/studio`가 서버 이력에서 복원되며 추가 생성은 없다.
- 새 endpoint `POST /studio/runs/:id/remix`는 소유 실행의 token/version에 바인딩한다. 클라이언트 requestId가 바뀌어도 실행별 고정 ID로 같은 복제본을 반환한다. 실제 동시 재전송2회는 모두22, 다른 매핑409, 타계정403. 서버 회귀는 최초 안전 거절 후 교정·응답 유실/재시작 영수증 복구·접근 회수·비동의 거절을 주입해 확인했다. 복제 완료 후 접근 재검증 실패는 성공 이력으로 반환하지 않는다.
- **발견/수정:** 데스크톱 rail↔모바일 Drawer 전환에서 대화와 매핑이 unmount되어 초기화됐다. 고정 portal 대상에 같은 하위 트리를 유지하도록 수정하고, 단위 mount1회/상태 보존과 실제390→768→1440에서 선택·미리보기·현재 초안 유지로 재검증했다. 최초 관찰은 DOM 스냅샷이며 별도 실패 스크린샷은 확보하지 못했다.
- **기능 PASS_SELECTED / 디자인 PASS_SELECTED:** 1440/768/390 캡처를 직접 확인했다. 폼·완료 카드 한 열, 전역 및 대상 가로 overflow0. 매핑 select 44px/14px, 생성 버튼·완료 링크44px, 포커스 외곽선2px. 키보드는 소스 메뉴 ArrowDown/Enter, 열→매핑 확인 Tab, 체크박스/데이터 표 순서 이동, 매핑 확인 Enter, 생성 Shift+Tab/Tab/Enter, 완료 카드 자동 포커스→링크 Tab, 모바일 Escape 닫기를 확인했다. native select의 Home/ArrowUp만으로 값 변경은 도구에서 반영되지 않아 해당 부분은 `selectOption`으로 수행했고 전체 OS 선택창 키보드 통과로 확대하지 않는다.
- 브라우저는 기존 Codex IAB 탭/로그인/서버를 재사용했다. Aside CLI의 새 버전 안내·대화형 업데이트는 적용하지 않았다. 링크의 새 탭 열기 동작은 IAB 탭 목록에서 확인되지 않아, 관찰된 URL을 별도 임시 탭에 열어 저장 결과를 확인하고 임시 탭은 닫았다. 링크 키보드 포커스와 href/target은 확인했지만 호스트의 새 창 전달 전체는 NOT_RUN이다.

### T14 검사·증빙·잔여 경계

- BE 실행 서비스50 PASS + 실제 DuckDB 영수증1 PASS(나머지40 변형 skip). FE 선택 **109 PASS / 7파일**: Remix/실행 계약62, Activity8, Conversation6, 반응형 패널1, 생성·Editor32. 초기 Activity/Conversation 테스트 import 오류는 폼 경계를 mock해 수정하고 해당14개만 재실행했다. 추가된 Conversation 테스트의 context 픽스처 누락도 수정하고 해당6개를 재검증했다. 이미 통과한 다른 테스트는 반복하지 않았다. 타입·FE/BE 빌드·변경 파일 lint(오류/경고0)·diff check PASS.
- 모델 호출·SQL/워커·T12/T13 범위 엔진은 변경하지 않았다. `gpt-6-luna` 고정 설정 및 T13 실제 AI 응답 근거를 재사용했고 이번 고정 복제 intent에는 추가 모델 호출0. VoiceOver **BLOCKED**, OS 설정 변경0. 독립 검토 에이전트는 provider400으로 완료하지 못해 검토 완료로 집계하지 않았다.
- 새 live Rill UI 비교, 다른 계정의 renamed 소스를 이번 대화 카드에서 매핑, 실제 파일 업로드 재실행, 네트워크 차단/서버 kill을 동반한 브라우저 장애 주입, 전체 언어·최대 길이 이름·실기기·VoiceOver·운영 부하는 **NOT_RUN/BLOCKED**다. 기존 T9/T12/T13 하위 수치·매핑·권한 결과는 변경 없는 범위에서 재사용한다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t14-20261016` — `confirmation-request.json`, `confirmation-response.json`, `api-verification.json`, `clone-reloaded.json`, `before.json`/`after.json`, `layout-checks.json`, `keyboard-path.json`, `verification-manifest.json`. 대표 캡처 `mapping-1440.jpg`, `missing-date-mapping-390.jpg`, `preview-768.jpg`, `preview-kpi-390.jpg`, `confirm-focus-390.jpg`, `completed-390.jpg`, `restored-receipt-{1440,768,390}.jpg`, `clone-reloaded-1440.jpg`.

대화 안의 **확인 후 비공개 복제 완료**는 더 이상 미지원이 아니다. 신규 생성의 대화 dispatch·확장 장애 흐름과 VoiceOver 등 별도 조건은 그대로 남기므로 TC-005/G4 전체 완료로 보고하지 않는다. T14 변경은 검토 가능한 미커밋 상태다.


## T14 후속 — 실제 응답 유실·서버 재시작 복구 · 2026-10-16

P5/BR-006의 기존 미검증 경로만 추가한다. 기존 정상 생성·매핑·수치·3폭 테스트는 재사용하며 정상 단계의 재진입은 장애 주입의 전제 준비로만 사용한다. 저장 API 응답을 브라우저에 전달하지 않은 상태에서 서버 커밋을 확인하고, 동일 요청 재시도·실제 API 프로세스 재기동·완료 이력 복원을 확인한다. 원본·게시본은 유지하고 격리된 새 검증 복제본 하나만 만든다.

| ID | 입력과 기대 결과 | 상태 |
|---|---|---|
| STUDIO-R09 | 서버 저장 성공 응답만 유실: UI가 성공을 단정하지 않고 매핑을 유지, 같은 요청 재시도로 단일 private ID 반환. 신규 대시보드/저장 영수증은 각각1개. | PASS_SELECTED · 실제 모바일 XHR 실패 주입 |
| STUDIO-R10 | 실제 로컬 API 종료·동일 DB/업로드/AI 설정 재기동 후 브라우저 새로고침: 완료 이력·동일 private ID 복원, 모델/복제 POST 자동 실행0. | PASS_SELECTED · SIGTERM 후 실제 재기동 |

정답은 T14와 동일한 source9/필터/날짜 범위다. 단위로 이미 확인한 커밋 직전 중단·권한/매핑 경계는 반복하지 않는다. VoiceOver BLOCKED·gpt-6-luna 유지. 네트워크 장애 주입은 종료 시 해제하며 서버는 기존 포트와 설정으로 복구한다.

### 실제 실행·발견 오류·재검증

- 최초 재현: 새 실행 `46767b3d-07db-40fc-a317-bcf0434fd42a`의 POST 201 응답을 브라우저에 전달하기 전에 실패시켰다. 서버에는 private23이 커밋됐으나 UI에 이전의 “아직 저장되지 않았습니다”가 남는 **결과 오안내**를 발견했다. 실패 화면 `lost-response-390.jpg`, 서버 기록 `committed-while-ui-uncertain.json`을 남겼다. 정상 저장 전체를 새 통과로 재집계하지 않는다.
- 수정: 저장 요청 시작 시 이전 미리보기 안내를 지운다. 네트워크 오류/5xx처럼 결과가 불확실하면 “저장 완료 여부를 확인하지 못했습니다. 같은 요청으로 재시도…”로 표시하고 기존 요청·매핑을 유지한다. 복제 준비 요약에서도 저장되지 않았다고 단정하지 않는다. 실행 이력 재조회로 완료 영수증이 확인되면 대화 안내도 완료로 갱신한다. 하위 권한·멱등성·SQL/워커는 변경하지 않았다.
- 재검증: 새 실행 `84307418-3689-485e-8123-84dac3611510`의 서버 201 응답만 XHR 단계에서 유실시켰다. 오류 상태에서 __time 등5개 선택 값은 유지·잠금, 재시도 버튼은44px/활성, 폼 가로 넘침0, 오래된 “아직 저장되지 않았습니다” 문구0을 확인했다. 모바일 키보드 Enter로 재시도한 두 POST 본문은 정확히 같고 결과는 private24 하나·영수증1개다. 최초 재현23과 수정 재검증24는 **서로 다른 검증 실행의 산출물**이며 동일 요청의 중복 생성이 아니다.
- 실제 재시작: 현재 워크트리 API PID26702만 SIGTERM 종료 후 동일 Node24/DB/영속 업로드/4329/CORS/gpt-6-luna 연결 환경으로 PID47005를 기동했다. 브라우저 새로고침→AI 패널에서 기존 private24 완료 기록과 링크를 복원했다. 수집된 API는 dashboard21 GET·userinfo GET·runs GET 및 OPTIONS이고 POST0, DB 대시보드/영수증 추가0이다. 모듈 재로딩 초기 Network buffer 일부는 truncated라 과거 구간 전체로 확대하지 않으며, retained API 구간과 DB 개수·영수증의 전후 동일성을 함께 근거로 쓴다.
- 복제본24 별도 재조회에서도 source9·공통 날짜 2023-09-10~11·Mobile/Tablet과 요청90,789,400/평균5.922633을 확인했다. T13 독립 oracle와 T14 범위 엔진 검증은 재사용했다. 원본21·게시20의 전후 SHA-256 일치, 복제23/24의 게시 수0이다.
- 디자인/키보드 **PASS_SELECTED:** 이번 변경은390px의 긴 오류·불확실 안내·재시도·완료/복원 상태를 실제 캡처로 확인했다. 기능과 디자인 판정은 해당 상태에 한정한다. 데스크톱/768px 배치·다른 키보드 경로는 T14의 미변경 결과를 재사용했고 전체 VoiceOver·실기기를 새로 통과시켰다고 보고하지 않는다.

### 검사·증빙·미실행 경계

- 영향받은 FE4파일의 최종 선택 결과 **77 PASS**: 실행 계약/Activity63 PASS, Remix/Conversation14 PASS. 최초 수정 검사의 비동기 안내 대기 시점 실패는 `findByText`로 보완하고 해당2파일만 재검증했다. 타입·변경 파일 lint(오류/경고0)·FE build·diff check PASS. 서버 코드·저장 엔진은 이번 후속에서 변경하지 않아 T14 BE51 PASS를 재사용했고 전체 빌드/테스트/E2E는 반복하지 않았다.
- 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t14-recovery-20261016`. `before.json`, `committed-while-ui-uncertain.json`, `before-restart.json`, `after-restart.json`, `retry-request-bodies.json`, `lost-response-fixed-state.json`, `restart-browser-requests.json`, `restart-all-api-requests.json`, `verification-manifest.json` 및 최초 오류/수정 후/재시도/실제 재시작 캡처를 따른다.
- 장애 주입은 CORS 사전 응답을 정상 통과시키고 해당 실행의 POST XHR 응답에만 적용했다. 도구의 비지원 Fetch.disable 대신 명시 지원된 `Fetch.enable {patterns:[]}`로 모든 raw interception을 해제했고 이후 재시도·GET이 정상 응답한다. 임시 복제본 확인 탭과390px 화면 폭 override도 정리했다.
- **NOT_RUN:** SIGKILL/호스트 재부팅, DB 커밋과 실행 영수증 사이의 실제 프로세스 중단, 장시간 전체 오프라인·운영 동시 부하·새 live Rill UI 대조·모든 OS 선택창 키보드. 커밋 간극 회복은 기존 T14 하위 주입 검증을 재사용한다. **VoiceOver BLOCKED**, **gpt-6-luna 유지/새 모델 호출0**. T14와 이번 안내 수정·기록은 현재 워크트리 미커밋이며 전체 TC-005/G4 PARTIAL은 유지한다.

다음 제품 기능 우선순위는 **대화에서 새 대시보드 생성 요청→지표/차원 제안→미리보기·비공개 저장 연결**이다. 이번 후속에서 이를 구현했다고 보고하지 않는다.

## T15 — 대화에서 신규 생성·검토·비공개 저장 · 2026-10-16

현재 Studio에서 새 대시보드를 요청하면 현재 소스의 **전체 기간·필터 없음**을 기준으로 기존 생성 컴파일러가 지표·차원과 계산 결과를 제안한다. 현재 문서의 필터·배치를 자동 복사하지 않는다. 확인 버튼 전에는 대시보드/지표/게시본을 저장하지 않고, 확인 후 별도 비공개 대시보드로 저장한다. 요청 원문·원본 행·미리보기 SQL은 실행 이력에 추가 저장하지 않는다.

| ID | 입력·기대 결과 | 상태 |
|---|---|---|
| STUDIO-N01 | source9 공식 Rill 1,391,572행에서 새 대시보드 요청 → gpt-6-luna 지표·차원 제안 → 실제 DuckDB 미리보기. 전체 요청 SUM(bid_request_cnt)=634,513,000; 디바이스별 합도 동일. 확인 전 dashboard/metric/publication 추가0, 현재21·게시20 불변. | PASS_SELECTED · 실제 AI/DuckDB/독립 Parquet |
| STUDIO-N02 | 제안 확인 후 비공개 저장 → 신규 ID·동일 숫자 재조회. 같은 실행의 저장 재시도는 동일 ID/저장 영수증1개, 현재21 유지·게시0. 새로고침은 완료 영수증 복원, AI 자동 재호출0. | PASS_SELECTED · 모바일 저장·동일 ID·reload |
| STUDIO-N03 | 다른 계정/다른 제안 바인딩·만료/소스 버전 변경은 거절. 생성/저장 실패 시 현재 초안 유지, 불확실 저장은 같은 요청으로 재확인. 캐시 만료·재시작 전 미저장 제안은 재생성 필요를 안내. | PASS_SELECTED · 실제 API 권한/바인딩 + 단위 만료·버전/응답 유실 |
| STUDIO-N04 | 1440/768/390에서 생성 카드·긴 정의·수치·오류·완료 상태 넘침/겹침 없음. Tab/Shift+Tab/Enter로 요청→검토→저장, 완료 상태 포커스→새 대시보드 링크. 모바일 패널 전환에도 입력·미리보기 유지. | PASS_SELECTED · 3폭·선택 키보드·디자인 |

기존 생성 컴파일러·SQL·소스 업로드·복제·게시 PASS는 관련 변경 없는 범위에서 재사용한다. VoiceOver BLOCKED 유지. 이번 기능은 기존 Studio의 소스로 시작하며, 빈 홈의 새 대화 진입 및 생성안의 대화식 재설계는 별도 범위다.


### 실제 결과·수정·재검증

- 실행 환경: 워크트리 `codex/self-service-next-20261014`, HEAD `58a1a39f81cc41cc06bbc1cb67d95f04fe8cc265` + 현재 T14/T15 미커밋 diff. Node24.21.0, FE3229/API4329, 기존 격리 DB/업로드와 Codex `gpt-6-luna` 연결을 유지했다. 새 의존성/모델 fallback/OS 설정 변경0.
- 실행 `ad0f0e5b-6235-491f-a119-40e4fba056cf`: 현재 source9에서 “전체 기간 총 요청 수 SUM(bid_request_cnt) 숫자 + device_type별 막대 2개, 정확한 정수, 제목 전체 광고 요청 분석”을 같은 AI SDK 대화 입력으로 요청했다. 처음에는 편집의 물리 파일 버전과 생성의 메타데이터 포함 버전을 잘못 비교해409가 발생했다. 실패 화면을 남기고 `expectedFileRevision`을 별도로 확인하도록 수정했다. 버전 검사는 snapshot 안에서 실행하며 기존 생성 API의 `expectedSourceRevision` 의미는 유지한다. 두 번의 버전 차단은 모델 호출 전이고, 수정 뒤 같은 실행의 실패 단계만 재시도해 실제 gpt-6-luna 생성1회를 완료했다.
- 제안 `1e8f9834-a0cc-4837-a618-32fe1948418c`: 새 SUM(bid_request_cnt) 정의와 device_type/VARCHAR 차원을 제안하고 실계산했다. 원본 Parquet을 별도 DuckDB 연결로 읽은 독립 oracle는 **1,391,572행·634,513,000·9개 차원**이다. 총계뿐 아니라 Mobile307,763,000/PC173,308,000 등 9개 값 전체가 일치했다. 저장 전 dashboard23/metric34/publication8/journal30의 개수는 모두 동일했다.
- 모바일에서 Tab→확인 버튼(44px)→Enter로 **private25** 생성. 같은 실행의 확인을 API로2회 더 재호출해도25이며 journal1개, 게시0개다. 실제 저장 후 dashboard24/metric35/publication8/journal31: 새 지표는 두 블록에서 하나로 재사용한다. 별도 탭의 Studio25 및 API 재조회에서도 전체 기간/필터 없음·정수634,513,000을 확인했다. 기존21과 게시20의 전후 SHA-256은 동일하다.
- 브라우저 reload→AI 패널에서25 완료 기록을 GET으로 복원했다. 수집 API 이벤트12개(요청/응답 합산)에서 POST0, DB 추가0. 신규 실행 기록에는 제안 참조와 완료 영수증만 추가하고, 요청 원문·미리보기 행/SQL·모델 답변은 추가 저장하지 않는다. 완료 기록 복원 시 과거 카드로 포커스를 강제로 옮기지 않도록 수정했고 실제 새 저장 완료 시에는 완료 상태→Tab→링크로 이동한다.
- 실제 다른 계정 접근403·다른 생성안 확인409를 확인했다. 실제 DuckDB 단위 검사는 물리 버전 불일치의 모델 호출 전 차단, 메타 버전과의 구분, 실캐시 TTL 만료, 확인 질문의 저장 차단, 동일 저널 replay를 검증했다. 실행 단위는 저장 커밋 뒤 응답 유실/GET 복구를 검증했다. 생성 금지 요청은 실행하지 않고, “새 대시보드를 만들어줘, 저장하지 마”는 읽기 전용 제안으로 구분한다. 네트워크 오류 UI는 미저장으로 단정하지 않고 같은 요청 재확인을 안내한다.

### 디자인·키보드와 검사

- 최초 좁은 카드에서 정수634,513,000이36px/높이108px로 두 줄로 갈라지고, 차트 내부에 불필요한 스크롤이 겹쳤다. 대화에 한정해 중복 카드 padding/테두리를 줄이고 숫자28px/한 줄40px, 차트240px·내부 padding0으로 수정했다. 긴 정의는 줄바꿈하고 정확한 차원 값은 키보드 데이터 표에서 읽는다. 기존 생성 페이지와 다른 차트 스타일은 변경하지 않는다.
- 기능/디자인 **PASS_SELECTED**: 1440×1000,768×1000,390×844의 미리보기·확인·완료/복원 상태를 실제 IAB로 검사·캡처했다. 문서 가로 넘침0, 확인/완료 링크44px, 링크 폰트12px/숫자28px, 포커스 및 고정 composer에 가리지 않음을 측정했다. 키보드는 요청 입력→Tab/Enter 전송, 실패 단계 Enter, 표 Enter 열기/닫기, Shift+Tab/Tab 확인 이동·Enter 저장, 완료 자동 포커스→Tab 링크, 모바일 Escape 닫기/AI Enter 재진입이다. 폭 전환은 같은 제안을 유지했고 닫았다 열기는 캐시 GET으로 복원하며 모델을 재호출하지 않았다.
- 전역 DOM 검사에서 기존 라이브러리 포털 ID `__react-alert__`의 중복1종도 관측했다. 이번 생성 카드의 heading은 useId를 사용한다. 이 관측을 전체 페이지 ID/스크린리더 접근성 통과로 확대하지 않는다.
- 선택 최종 고유 검사 **BE95/FE78 PASS**(분할 실행, 재실행 중복 합산 제외), FE 타입·변경 FE/BE lint(오류/경고0), FE/BE build·diff check PASS. 초기 기존 “생성 미지원” 기대값, 새 테스트의 공유 metric fixture 충돌, UI mock의 무거운 WidgetViewer import 오류는 수정 후 해당 파일을 재검증했다. Vitest/Vite·ts-jest의 기존 버전 경고는 빌드를 막지 않았다. 전체 core E2E·기존 완료 MD를 추가 반복하지 않았다.
- **NOT_RUN/남은 범위:** 홈/빈 대화의 소스 선택부터 생성, 같은 생성안에 대화로 지표·차원을 재설계, 의미 선택 답변의 자동 이어받기(현재 기준을 포함한 새 요청으로 안내), 실제 브라우저의 새 생성 저장 응답 장애 주입·10분 실시간 대기/미저장 제안 서버 재시작·운영 부하·새 live Rill UX 비교·실기기. 이 중 버전/TTL/응답 유실 복구는 하위 선택 테스트의 근거와 구분한다. 다른 계정 차단은 API 검증이며 실제 브라우저 계정 전환으로 확대하지 않는다. 새 탭은 관찰된 href를 별도 임시 탭에서 재조회했고 닫았으며, 호스트 창 전달 전체는 NOT_RUN이다. **VoiceOver BLOCKED**, gpt-6-luna 유지. TC-005 전체/G4는 확장 조건이 남아 PARTIAL이다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-t15-20261016`의 `verification-manifest.json`, `proposal-verified.json`, `independent-parquet-oracle.json`, `saved-reloaded.json`, `boundaries.json`, `before*.json`/`after*.json`, `reload-api-requests.json`, `layout-keyboard.json`, 최종 검사 로그. 대표 캡처는 `preview-390.jpg`, `preview-768.jpg`, `save-focus-390.jpg`, `completed-390.jpg`, `new-private-{1440,390}.jpg`, `final-receipt-{1440,768,390}.jpg`다.

## T16 — 생성안 후속 질문·첫 화면 연결 · 2026-10-16

[명세/실행 증빙](studio-proposal-refinement.md): `/studio/new`에서 서버 부모 제안을 기준으로 선택 블록 수정/1개 추가→전체 미리보기→명시 비공개28 저장을 구현·실제 gpt-6-luna로 확인했다. 편집기 대화 생성안은 같은 제안을 이어받는 새 탭 링크로 연결한다. 부모/비대상 정의·ID·제목 유지, 첫 화면 Enter 진입 POST0, 최신 제안 저장/reload/동일 requestId 재확인·실시간10분 초과 TTL400을 확인했다. 네이티브 선택창·전체 run 링크 실제 여정·운영/실기기·VoiceOver 경계는 위 문서대로 남긴다. T15의 이전 NOT_RUN은 역사적 상태이며 이번 선택 검증 범위를 전체 제품 수용으로 확대하지 않는다.


T16 후속 실제 run 링크 여정은 [CONV-REFINE-01~04](studio-proposal-refinement.md#편집기-대화-이어받기-후속--2026-10-16)에서 완료했다. T15의 새 생성 저장 장애 중 `/studio/new`의 실제 commit 후 응답 숨김·같은 요청 확인은 [CREATE-RECOVERY-01~03](studio-proposal-refinement.md#신규-생성-저장-응답-유실-후속--2026-10-16)에서 선택 검증했다. 역사적 NOT_RUN을 전체 수용 PASS로 소급하지 않는다.

- 2026-10-16: [수정 대상 선택창 키보드 후속](studio-proposal-refinement.md#수정-대상-네이티브-선택창-키보드-후속--2026-10-16) REFINE-KEY-01·02 PASS_SELECTED. native 방향키/Enter/Escape·페이지 Tab 및390px 포커스/넘침0 확인. 전체 접근성·VoiceOver BLOCKED는 별도이며 미커밋.

- 2026-10-16: [UI13 날짜 키보드 후속](studio-shadcn.md#studio-ui13-날짜-네이티브-키보드-후속--2026-10-16) 실제 세그먼트 입력·Tab/Space popup·방향키/Enter·Escape·390px 포커스/넘침0 PASS_SELECTED. 저장/게시/AI0, 제품 변경0. 모바일 popup 전체 시각·실기기·VoiceOver/운영은 별도이며 미커밋.

- 2026-10-16: [UI14 파일 선택 취소 후속](studio-shadcn.md#studio-ui14-파일-선택-취소-키보드-후속--2026-10-16): 실제 OS Escape 취소·버튼 초점/질문/소스 보존·페이지 Tab·390px 넘침0 PASS_SELECTED. Enter chooser event는 확인했으나 도구 자동 취소로 OS 표시 PARTIAL. 업로드/AI/저장0·제품 변경0·미커밋, VoiceOver BLOCKED 유지.

- 2026-10-16: [UI15 분모 확인 재시도](studio-shadcn.md#studio-ui15-분모-확인-실패재시도-후속--2026-10-16) 전송 전503 주입→질문/amount/소스 revision 보존→동일 body Enter→실제 gpt-6-luna 제안/21.23% 복구 PASS_SELECTED. 원본 CSV Decimal 일치·390px 넘침0·저장/게시0. 제품 변경0·기록 미커밋, VoiceOver BLOCKED 유지.


- 2026-10-16: [UI16 게시 실패·상태 조회 복구](studio-shadcn.md#studio-ui16-게시-실패상태-조회-복구--2026-10-16) PASS_SELECTED. 비공개32의 전송 전503→동일 requestId/body Enter 재시도→실제 v1 생성→owner GET 전송 전503→Enter GET만 복구. 실제 게시1회/복구 추가POST0·저장본 해시/634,513,000 보존·390px 넘침0/버튼36px 캡처. 제품 변경0·AI 호출0/gpt-6-luna·VoiceOver BLOCKED 유지. 이전 미커밋 수정/기록은 `2fb2edb4`로 develop-v2/drumcap push 완료. 실행기 저장 후 게시 실패·취소/재시작·운영/실기기는 별도 미완료.


- 2026-10-16: [UI17 대화 실행기 게시 장애·중지·재시작](studio-shadcn.md#studio-ui17-대화-실행기의-게시-장애중지재시작--2026-10-16) PASS_SELECTED. 실제 저장 뒤 게시 단계 예외→같은 run 게시만 재시도, 게시 대기 중 Enter 중지→저장 보존/공유 cancelled, 실제 Node TERM/같은 DB 재기동→publish interrupted→명시 게시만 재시도 완료. 세 run 각각 save journal1, 게시 journal1/0/1·정의 불변·634,513,000 유지.390px/1440px 캡처·넘침0, 제품 변경0·모델 호출0/gpt-6-luna·VoiceOver BLOCKED 유지. 로컬 게시본 비공개v4/정상 서버 복구. 기록 미커밋; commit 직후 장애·다중 탭 경쟁·운영/실기기는 별도 gate.


- 2026-10-16: [UI18 실행기 게시 commit 이후 장애·응답 유실](studio-shadcn.md#studio-ui18-게시-commit-직후-장애응답-유실--2026-10-16) PASS_SELECTED. 실제 게시v5/journal commit 후 실행기 완료 전 Node TERM→정상 재시작→동일 run/버전 복원, 별도 실제 완료v6 응답1회 숨김→Enter GET만 복구. 두 run 각각 save/publication journal1·복구 추가POST0·정의/634,513,000 유지·390px 오류/복구 캡처/넘침0. 정상 서버·비공개v7 정리, 제품 수정/AI호출0·gpt-6-luna/VoiceOver BLOCKED 유지. UI17 기록은 `722b6fbc`로 develop-v2/drumcap push 완료; UI18 기록 미커밋. 다른 탭 경합·운영/실기기는 별도 gate.


- 2026-10-16: [UI19 두 탭 게시 재시도 경합](studio-shadcn.md#studio-ui19-두-탭-게시-재시도-경합--2026-10-16) 최초 FAIL→수정 후 PASS_SELECTED. 오래된 실행 재시도가 B의 비공개v8을 공개v9로 덮던 오류를 게시 token/version 영속 기준과 내부 직렬 쓰기 비교로 수정. 실제 scope/revision 각각409·B 최신 제목/정의/배치·비공개v11/634,513,000 유지·각 save journal1/pub0·390px 캡처. BE73/build/변경lint/diff PASS, 정상 서버 복구·모델0/gpt-6-luna·VoiceOver BLOCKED 유지. UI18은 `74c5bf67`로 drumcap push 완료; 이번 코드/기록 미커밋. 다중 프로세스/MySQL·실기기/전체 수용은 별도.
