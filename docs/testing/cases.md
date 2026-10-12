# VanillaMeta 검증 명세

이 파일은 시나리오와 기대 결과의 기준이다. 케이스 수는 검증 완료 수가 아니다. 실행하지 않은 케이스는 NOT_RUN으로 기록한다. Aside는 이 MD에서 변경 범위에 관련된 UI 케이스만 읽어 실행한다. API/provider-contract 케이스는 API 테스트 실행 기록으로 확인하며 화면 캡처만으로 통과시키지 않는다.

## 데이터와 실행 조건

- 실행은 로컬 테스트 환경에서 수행한다. 기존 사용자 데이터와 실행 중 서버를 초기화하거나 종료하지 않는다.
- 실행별 고유 계정/제목/ID를 사용한다. 인증 없는 공유 검증에는 로그인한 브라우저 세션을 재사용하지 않는다.
- 확장 검증의 정답 데이터는 `frontend-web/e2e/fixtures/oracle.json`: 3행, SUM(amount)=500, 서울=250, 부산=250. 기대값은 앱 응답에서 만들지 않는다.
- 기본 핵심 E2E는 기존 생성 sales.csv(500행)를 사용한다: SUM(amount)=298250, 도서=60550. 두 픽스처를 섞지 않는다.
- UI 케이스의 사업 동작(업로드/저장/수정/삭제)은 실제 화면으로 실행한다. API는 사전 준비와 독립 재조회에만 사용한다. 현재 기본 공유 회귀는 공유 활성화를 API로 준비하며 공유 설정 UI 검증은 SHARE-01을 따로 실행한다.
- 파일 선택/엔진 준비/쿼리 결과는 화면의 실제 상태로 기다린다. 예기치 않은 화면에서 임의로 단계나 기대값을 변경하지 않는다.
- 저장 완료는 재조회/새로고침 후 상태로 확인한다. 차트는 표시 여부와 수치 정확성을 각각 확인한다.
- 주입 장애/로컬 provider는 확장 런타임이 준비된 경우에만 실행한다. 실제 외부 AI 품질 검증으로 보고하지 않는다.

- 대시보드는 UserMapping으로 사용자를 연결한다. 다른 계정의 비공개 대시보드를 읽기/수정/삭제/공유할 수 없다. 데이터 소스/데이터셋/위젯 등은 현재 공유 인증 워크스페이스 계약을 따르며 테스트가 새로운 소유권 모델을 가정하지 않는다.
- 꺼졌거나 만료된 공유 및 철회한 토큰은 이후 읽기를 허용하지 않아야 한다. 무단 변경이나 예기치 않은 5xx/멈춘 요청은 실패다.

## Aside 실행 방법

1. `aside-browser` 스킬의 최신 가이드를 읽고 현재 탭을 확인한다.
2. 테스트 URL/커밋/언어/픽스처/시나리오 ID를 기록한다.
3. 아래의 케이스에 있는 행동을 화면의 이름/역할을 읽어 실행한다. 고정 CSS/좌표를 명세에 추가하지 않는다.
4. 단계별 기대 결과, 새로고침 후 지속 상태, 콘솔/오류 화면을 확인한다.
5. 핵심 성공 결과와 실패 상태만 캡처한다. 증빙은 저장소 밖의 실행 폴더에 저장한다.
6. 결과를 PASS / FAIL / BLOCKED / NOT_RUN 중 하나로 기록하고, 실행한 하위 조건과 미실행 변형을 구분한다. 이 실행이 생성한 정확한 ID만 정리한다.

## 결과 기록

`케이스 ID | 커밋 | 환경/픽스처 | 수행한 행동 | 관찰 결과/실제 수치 | 상태 | 증빙 경로 | 미실행 변형/차단 원인`

스크린샷은 결과 증빙이며 테스트 통과 판정을 대신하지 않는다. 실패한 뒤 제품이나 선택자를 수정했다면 재검사 결과를 별도로 남기고 최초 실패 기록을 보존한다.

## 케이스

### AUTH-01: Anonymous deep links to dashboard, widget, datasource, dataset, metric and file analysis

- Surface: UI
- Action: Anonymous deep links to dashboard, widget, datasource, dataset, metric and file analysis
- Expected: Each protected route reaches login without rendering private content; root and unknown routes remain responsive.


### AUTH-02: Missing, malformed, tampered and expired bearer credentials on every protected controller family

- Surface: API
- Action: Missing, malformed, tampered and expired bearer credentials on every protected controller family
- Expected: 401 on database, dataset, widget, dashboard, component, template, metric, AI and user info; no private data or mutation.


### AUTH-03: Signup required fields, weak password, mismatched confirmation and invalid email

- Surface: UI
- Action: Signup required fields, weak password, mismatched confirmation and invalid email
- Expected: Visible validation error and no signup request or account creation for each invalid input.


### AUTH-04: Signup success and onboarding

- Surface: UI
- Action: Signup success and onboarding
- Expected: New runtime-generated account can sign in; its starter dashboard and widgets actually load, including a numeric result, not just a title.


### AUTH-05: Duplicate user ID and duplicate email

- Surface: API
- Action: Duplicate user ID and duplicate email
- Expected: 409 for each sequential duplicate; original account remains usable and its data is unchanged.


### AUTH-06: Wrong password and unknown account

- Surface: UI
- Action: Wrong password and unknown account
- Expected: 401 response, visible failure, no token stored, and login page remains usable for a later valid login.


### AUTH-07: Login and reload

- Surface: UI
- Action: Login and reload
- Expected: Authenticated dashboard and profile survive reload; user info omits password and is the correct account.


### AUTH-08: Refresh a replaced expired access token using a valid refresh cookie

- Surface: UI
- Action: Refresh a replaced expired access token using a valid refresh cookie
- Expected: Actual API refresh succeeds, original data request is retried successfully, no infinite requests or leaked token output.


### AUTH-09: Expired access token with no refresh cookie

- Surface: UI
- Action: Expired access token with no refresh cookie
- Expected: Authentication is cleared and user reaches login with controlled error, not a blank screen or pending spinner.


### AUTH-10: Logout followed by refresh-cookie reuse and protected navigation

- Surface: UI
- Action: Logout followed by refresh-cookie reuse and protected navigation
- Expected: Real signout API succeeds, cookie is cleared, saved refresh token cannot renew, browser remains logged out after reload.


### AUTH-11: Profile update with wrong current password

- Surface: UI
- Action: Profile update with wrong current password
- Expected: Controlled visible failure; email and password remain unchanged and previous login still succeeds.


### AUTH-12: Profile password/email update

- Surface: UI
- Action: Profile password/email update
- Expected: Updated email persists on fresh profile read; old password fails and new password succeeds after a fresh login.


### AUTH-13: Account deletion with wrong and correct password

- Surface: API
- Action: Account deletion with wrong and correct password
- Expected: Wrong password leaves account intact; deleting the run-owned account makes login and refresh fail without 500.


### AUTH-14: Corrupt local access-token storage

- Surface: UI
- Action: Corrupt local access-token storage
- Expected: Malformed stored JSON cannot crash routing; recover to a controlled login state.


### FILE-01: CSV browser analysis

- Surface: UI
- Action: CSV browser analysis
- Expected: Three rows and six columns from the oracle are visible, aggregate SQL returns exactly 500 and export matches the query result.


### FILE-02: JSON browser analysis

- Surface: UI
- Action: JSON browser analysis
- Expected: Same three oracle records and aggregate 500 are visible through DuckDB.


### FILE-03: Parquet browser analysis

- Surface: UI
- Action: Parquet browser analysis
- Expected: Same three oracle records and aggregate 500 are visible, not merely a rendered empty canvas.


### FILE-04: Switch bar, line and pie previews

- Surface: UI
- Action: Switch bar, line and pie previews
- Expected: Each selected chart is visibly rendered without uncaught exceptions; data values and selected axes remain correct.


### FILE-05: SQL syntax error followed by valid query

- Surface: UI
- Action: SQL syntax error followed by valid query
- Expected: Error is visible, old result is not labeled as a successful new result, and later valid query returns 500.


### FILE-06: Empty query result

- Surface: UI
- Action: Empty query result
- Expected: No stale rows or chart from the previous query remain; user can run another valid query.


### FILE-07: CSV export with commas, quotes, Unicode and embedded newline

- Surface: UI
- Action: CSV export with commas, quotes, Unicode and embedded newline
- Expected: Downloaded CSV round-trips the literal cell values and current result rows correctly.


### FILE-08: Unsafe-integer DuckDB BIGINT result

- Surface: UI
- Action: Unsafe-integer DuckDB BIGINT result
- Expected: 9007199254740993 is preserved exactly as text in grid/export; no rounding or BigInt rendering exception.


### FILE-09: Replace uploaded file and analyze again

- Surface: UI
- Action: Replace uploaded file and analyze again
- Expected: Only the new file's rows and metadata remain; prior table rows and axis selections do not contaminate results.


### FILE-10: Filename containing apostrophe, spaces and Unicode

- Surface: UI
- Action: Filename containing apostrophe, spaces and Unicode
- Expected: Valid CSV is loaded and evaluated successfully; filename quoting cannot break SQL parsing.


### FILE-11: Unsupported file extension and malformed JSON/Parquet

- Surface: UI
- Action: Unsupported file extension and malformed JSON/Parquet
- Expected: Visible controlled error for each variant, no false success notification, later valid upload works.


### FILE-12: WASM initialization failure and navigation recovery

- Surface: UI
- Action: WASM initialization failure and navigation recovery
- Expected: Explicit browser-engine error; server save remains available while browser analysis is unavailable; navigating away/back with fault removed recovers. This is fault injection, not a live provider test.


### FILE-13: Server CSV, JSON and Parquet upload

- Surface: API
- Action: Server CSV, JSON and Parquet upload
- Expected: Each creates its own server DuckDB source (TypeORM metadata DB unchanged), reports three rows and executes rowsSql/aggregateSql with exact oracle values.


### FILE-14: Missing, empty, header-only, malformed JSON, non-object JSON array and corrupt Parquet uploads

- Surface: API
- Action: Missing, empty, header-only, malformed JSON, non-object JSON array and corrupt Parquet uploads
- Expected: Each rejected with controlled 4xx; datasource inventory unchanged.


### FILE-15: Unsupported server upload extension

- Surface: API
- Action: Unsupported server upload extension
- Expected: 400 rather than silently interpreting arbitrary extension as CSV; no datasource created.


### FILE-16: CSV BOM, CRLF, quoted comma/newline and escaped quote

- Surface: API
- Action: CSV BOM, CRLF, quoted comma/newline and escaped quote
- Expected: Exact header and cell values survive storage and rows query.


### FILE-17: Sanitized colliding headers and duplicate raw headers

- Surface: API
- Action: Sanitized colliding headers and duplicate raw headers
- Expected: Distinct safe column names preserve every original column's values; no silently overwritten cells.


### FILE-18: JSON rows with heterogeneous keys and null/missing values

- Surface: API
- Action: JSON rows with heterogeneous keys and null/missing values
- Expected: Union of columns is retained, missing values are null and nonmissing values are not dropped.


### FILE-19: Full upload beyond 100000 rows

- Surface: API
- Action: Upload a CSV with 100001 records; check row count and aggregate; verify the 1391572-row Parquet with INGEST-01.
- Expected: All 100001 rows stored, no truncation. Row-count cap replaced by upload byte, worker memory, storage and timeout limits. CSV/JSON/Parquet small variants remain FILE-13.


### FILE-20: Multipart body exceeds configured file byte limit

- Surface: API
- Action: Set FILE_UPLOAD_MAX_BYTES to a small test limit and send a larger multipart file; production default is 512 MiB.
- Expected: 413 with no metadata source creation, no server crash and subsequent health request succeeds.


### DATA-01: Create a SQLite connection through datasource form

- Surface: UI
- Action: Create a SQLite connection through datasource form
- Expected: Connection test succeeds for a run-owned uploaded SQLite file, save succeeds and source persists after reload.


### DATA-02: Invalid connection configuration then recovery

- Surface: UI
- Action: Invalid connection configuration then recovery
- Expected: Visible test-connection error without success/save claim; valid configuration then succeeds.


### DATA-03: Update source connection after a query initialized its pool

- Surface: API
- Action: Update source connection after a query initialized its pool
- Expected: Subsequent query uses the newly selected run-owned file, not the cached old Knex connection.


### DATA-04: Unknown datasource and invalid ID inputs

- Surface: API
- Action: Unknown datasource and invalid ID inputs
- Expected: Controlled non-5xx error for detail/info/query/update/delete paths, no unrelated datasource mutation.


### DATA-05: Valid SELECT, CTE, aggregate and zero-row SQL

- Surface: API
- Action: Valid SELECT, CTE, aggregate and zero-row SQL
- Expected: Exact oracle rows/500 and empty array respectively; complete response envelope and column metadata.


### DATA-06: Nonmutating UPDATE probe and multiple SELECT statements

- Surface: API
- Action: Nonmutating UPDATE probe and multiple SELECT statements
- Expected: 400 from read-only/single-statement guard; later count remains three and sum remains 500.


### DATA-07: SQL syntax error, missing table and empty SQL

- Surface: API
- Action: SQL syntax error, missing table and empty SQL
- Expected: Controlled 4xx or ERROR envelope with meaningful message; no 500 or poisoned subsequent valid query.


### DATA-08: Read datasource detail and table/dataset listing

- Surface: API
- Action: Read datasource detail and table/dataset listing
- Expected: Uploaded_data table is listed; connection password is never returned and datasource is usable.


### SET-01: File analysis to persisted dataset

- Surface: UI
- Action: File analysis to persisted dataset
- Expected: Upload through browser, enter aggregateSql in dataset editor, run returns 500, save then fresh API read preserves entered title/query/source.


### SET-02: Dataset modification

- Surface: UI
- Action: Dataset modification
- Expected: Changed title/query persist after reload and widget data reflects the saved SQL, not old editor state.


### SET-03: Dataset invalid query and required-title validation

- Surface: UI
- Action: Dataset invalid query and required-title validation
- Expected: Visible errors, save does not create/update a dataset, existing persisted definition is unchanged.


### SET-04: Dataset CRUD with valid and invalid SQL

- Surface: API
- Action: Dataset CRUD with valid and invalid SQL
- Expected: Create/read/update persist correct source/query; invalid update rejected without overwriting prior query; run-owned delete removes record.


### SET-05: Missing dataset IDs

- Surface: API
- Action: Missing dataset IDs
- Expected: Controlled errors for detail/update/delete and no unrelated record mutation.


### SET-06: Delete dataset referenced by a run-owned widget/dashboard

- Surface: API
- Action: Delete dataset referenced by a run-owned widget/dashboard
- Expected: Dependent widget is removed or displayed as an explicit unavailable widget; dashboard remains loadable and no 500/stale successful chart.


### METRIC-01: Create, evaluate, reload and delete metric

- Surface: UI
- Action: Create, evaluate, reload and delete metric
- Expected: SUM(amount) value 500 is visible; API evaluate reports SUCCESS/result[0].value=500; deletion removes the active card.


### METRIC-02: Missing fields, duplicate active name and cancel creation

- Surface: UI
- Action: Missing fields, duplicate active name and cancel creation
- Expected: Visible validation/duplicate error; no extra active metric and cancel leaves inventory unchanged.


### METRIC-03: All six aggregation functions

- Surface: API
- Action: All six aggregation functions
- Expected: SUM=500, AVG=500/3, COUNT=3, MIN=100, MAX=250, COUNT_DISTINCT(region)=2 on the fixed oracle. Float comparison is limited to AVG.


### METRIC-04: Group-by aggregation

- Surface: API
- Action: Group-by aggregation
- Expected: Exactly two rows: 부산=250 and 서울=250, independent of response ordering.


### METRIC-05: Filter operators including equality, comparison, LIKE and IN

- Surface: API
- Action: Filter operators including equality, comparison, LIKE and IN
- Expected: Known filtered oracle sums/counts; quote-containing values are bound rather than interpolated.


### METRIC-06: Invalid definition, unsafe identifier, unsupported aggregation/operator and empty IN values

- Surface: API
- Action: Invalid definition, unsafe identifier, unsupported aggregation/operator and empty IN values
- Expected: ERROR with meaningful message, no unsafe execution and no invalid active definition accepted as usable.


### METRIC-07: Update metric aggregation and filters

- Surface: API
- Action: Update metric aggregation and filters
- Expected: Definition persists, changed evaluation matches oracle and failed update preserves the prior definition.


### METRIC-08: Soft delete then recreate same name

- Surface: API
- Action: Soft delete then recreate same name
- Expected: One active metric, reused ID allowed; recreated definition and new evaluation are correct, not a duplicate-name failure.
- Recreate without optional groupBy/description/filters after deleting a definition that included them: omitted options must be cleared, not inherited from the deleted definition.


### METRIC-09: Deleted/missing metric evaluation

- Surface: API
- Action: Deleted/missing metric evaluation
- Expected: Deleted metric is not usable as an active metric; missing IDs return controlled ERROR and no data.


### WIDGET-01: Numeric widget wizard

- Surface: UI
- Action: Numeric widget wizard
- Expected: Select the actual oracle source/amount column and numeric component; save, fresh read and view display 500.


### WIDGET-02: Wizard required selection, back navigation and cancel

- Surface: UI
- Action: Wizard required selection, back navigation and cancel
- Expected: Next/save cannot falsely succeed without required choices; back preserves valid inputs; cancel creates no widget.


### WIDGET-03: Modify widget title and options

- Surface: UI
- Action: Modify widget title and options
- Expected: Saved title/options and rendered numeric result persist on reload and dashboard view.


### WIDGET-04: Widget listing and delete confirmation

- Surface: UI
- Action: Widget listing and delete confirmation
- Expected: The created card is visible in the actual list, confirmation cancellation preserves it, confirmed delete removes only its ID.


### WIDGET-05: Widget TABLE and DATASET creation/update/delete

- Surface: API
- Action: Widget TABLE and DATASET creation/update/delete
- Expected: Correct table-query/dataset linkage; persisted options remain parseable and unrelated widgets are preserved.


### WIDGET-06: Every enabled registered chart component renders through its real widget view

- Surface: UI
- Action: Every enabled registered chart component renders through its real widget view
- Expected: One variant per enabled componentType, using fresh run-owned widgets and valid explicit option/data fixtures. No fallback component-not-selected message, uncaught exception or empty failed-widget substitute; charts have a real visual surface. Numeric and table variants also assert values. Record each type/screenshot separately; unavailable WebGL is a failure/blocker, not a skip.


### WIDGET-07: Missing widget deep link and missing underlying datasource

- Surface: UI
- Action: Missing widget deep link and missing underlying datasource
- Expected: Controlled unavailable/error UI without a blank page or uncaught exception; navigation to a valid widget still works.


### DASH-01: Create dashboard with the numeric oracle widget

- Surface: UI
- Action: Create dashboard with the numeric oracle widget
- Expected: Save succeeds, fresh dashboard read preserves widget ID/layout, view displays title and 500.


### DASH-02: Edit dashboard title and add/remove widget

- Surface: UI
- Action: Edit dashboard title and add/remove widget
- Expected: Reload preserves changed title, widget membership and layout; removed widget is not still visible.


### DASH-03: Resize/drag widget and save layout

- Surface: UI
- Action: Resize/drag widget and save layout
- Expected: Layout changes persist on fresh read/reload and widget remains visible without overlap-induced disappearance.


### DASH-04: Dashboard listing, delete cancellation and confirmed deletion

- Surface: UI
- Action: Dashboard listing, delete cancellation and confirmed deletion
- Expected: The created dashboard is present in the actual list; cancellation preserves the run-owned dashboard, confirmed delete removes it from list and direct view.


### DASH-05: User-associated dashboard CRUD and partial title-only update

- Surface: API
- Action: User-associated dashboard CRUD and partial title-only update
- Expected: Owner list includes only its own dashboard; title-only update preserves widget membership/layout; delete cleans dependent mappings/sharing and no list 500.


### DASH-06: Second account accesses another user's private dashboard

- Surface: API
- Action: Second account accesses another user's private dashboard
- Expected: 403/404 for read/update/delete/share-on/share-off; owner title/layout/share state remain unchanged. Tests use only two new run-owned accounts.


### DASH-07: Unknown and deleted dashboard URLs

- Surface: UI
- Action: Unknown and deleted dashboard URLs
- Expected: Explicit unavailable state, no uncaught errors and no private content.


### DASH-08: Dashboard template-based creation

- Surface: UI
- Action: Dashboard template-based creation
- Expected: Recommended template selection yields persisted, usable layout containing the selected widget exactly once.


### SHARE-01: Enable sharing in the actual share popup

- Surface: UI
- Action: Enable sharing in the actual share popup
- Expected: Real share API succeeds; popup exposes the correct current-origin share/embed URLs and active state persists on reload.


### SHARE-02: Anonymous share and embed viewing

- Surface: UI
- Action: Anonymous share and embed viewing
- Expected: Fresh unauthenticated contexts display the correct dashboard and 500; embed omits application navigation.


### SHARE-03: Disable sharing and revisit existing share/embed URL

- Surface: UI
- Action: Disable sharing and revisit existing share/embed URL
- Expected: Both anonymous views deny content immediately after revoke, not only after expiry.


### SHARE-04: Expired, disabled, unknown and deleted-dashboard shares

- Surface: API
- Action: Expired, disabled, unknown and deleted-dashboard shares
- Expected: Controlled 401/403/404; no private data in responses and no 500.


### SHARE-05: Malformed share date and same-day expiry boundary

- Surface: API
- Action: Malformed share date and same-day expiry boundary
- Expected: Malformed input rejected with no mutation; a valid today date remains usable through the local calendar day's end, yesterday is denied.


### SHARE-06: Reuse a previously valid share token after revoke

- Surface: API
- Action: Reuse a previously valid share token after revoke
- Expected: Subsequent datasource reads through that token are denied, and token cannot authorize writes or another dashboard's data.


### SHARE-07: Copy link/embed and clipboard-denied behavior

- Surface: UI
- Action: Copy link/embed and clipboard-denied behavior
- Expected: Permitted clipboard contains exact current-origin URL/code; denied clipboard yields visible controlled feedback. Clipboard fault is labeled fault injection.


### TEMPLATE-01: Template list/detail/create/update/soft delete

- Surface: API
- Action: Template list/detail/create/update/soft delete
- Expected: All operations return within bounded timeout; detail has correct layout, update persists and deleted template leaves active list.


### TEMPLATE-02: Recommend template and obtain dashboard layout

- Surface: API
- Action: Recommend template and obtain dashboard layout
- Expected: Valid selected widget is mapped exactly once to finite nonnegative positions/sizes; no missing or duplicate widget mapping.


### TEMPLATE-03: Unknown template, empty widget selection and invalid layout input

- Surface: API
- Action: Unknown template, empty widget selection and invalid layout input
- Expected: Controlled non-5xx error/empty recommendation as appropriate; no hanging response or unwanted template creation.


### AI-01: AI disabled and invalid prompt/ID boundaries

- Surface: API
- Action: AI disabled and invalid prompt/ID boundaries
- Expected: Missing configuration, empty/2001-character prompt and nonpositive IDs yield explicit ERROR without external calls.


### AI-02: Local OpenAI-compatible SQL response

- Surface: provider-contract
- Action: Local OpenAI-compatible SQL response
- Expected: Local HTTP provider fixture returns the predefined aggregateSql; backend validates it and the real SQLite query yields 500. This does not prove real model quality.


### AI-03: Provider returns write SQL or multiple statements

- Surface: provider-contract
- Action: Provider returns write SQL or multiple statements
- Expected: Backend returns controlled ERROR, never exposes unsafe SQL as SUCCESS and oracle rows remain intact.


### AI-04: Provider HTTP error, empty output and malformed payload

- Surface: provider-contract
- Action: Provider HTTP error, empty output and malformed payload
- Expected: Controlled error for each variant and subsequent normal request recovers; no external paid calls.


### AI-05: Valid and invalid chart recommendation types

- Surface: provider-contract
- Action: Valid and invalid chart recommendation types
- Expected: Registered CHART_BAR is accepted; invented type and malformed JSON are rejected rather than silently chosen.


### AI-06: Dashboard insight with valid, missing and empty dashboards

- Surface: provider-contract
- Action: Dashboard insight with valid, missing and empty dashboards
- Expected: Valid fixture insight is displayed/returned; missing/empty context gives controlled error, not fabricated success.


### AI-07: Dataset AI SQL assistant

- Surface: UI
- Action: Dataset AI SQL assistant
- Expected: Real browser action against local provider inserts the exact SQL into editor and Run yields 500; error fixture displays feedback and leaves prior valid SQL intact.


### AI-08: Dashboard AI insight action

- Surface: UI
- Action: Dashboard AI insight action
- Expected: Real action displays the known local provider fixture text; unavailable provider error is visible. No claim about model reasoning correctness.


### RELIABILITY-01: WebSocket query progress success and error

- Surface: API
- Action: WebSocket query progress success and error
- Expected: Own socket receives running then success/error for real SQLite requests; successful row count is three; a second unrelated socket receives no event.


### RELIABILITY-02: Optional in-memory cache enabled and TTL expiration

- Surface: API
- Action: Optional in-memory cache enabled and TTL expiration
- Expected: Repeated identical queries are stable; after changing a run-owned datasource connection and expiry, results use new data. Cache configuration belongs only to a dedicated local process.


### RELIABILITY-03: Rate limit and recovery

- Surface: API
- Action: Rate limit and recovery
- Expected: Actual configured limit produces 429, not 500; after its window the same local server returns normally. Do not raise/disable the limit to pass other tests.


### RELIABILITY-04: Transient API network error and later recovery

- Surface: UI
- Action: Transient API network error and later recovery
- Expected: Visible feedback, loading overlay clears, no uncaught exception and retry/navigation reaches working state. Fault injection is explicitly labeled.


### RELIABILITY-05: Fresh local bootstrap and restart persistence

- Surface: API
- Action: Fresh local bootstrap and restart persistence
- Expected: Automatic seed and new CRUD resources are usable through public API; restarting same isolated DB preserves exact fixture values, resource IDs and account access without duplicate seed rows.


### RELIABILITY-06: Corrupt encrypted connection config does not take down source/dashboard listing

- Surface: UI
- Action: Corrupt encrypted connection config does not take down source/dashboard listing
- Expected: A deliberately corrupted run-owned config produces explicit item error, healthy sources/dashboard remain loadable; repair restores usability. This fixture is never inserted into user data.


### NAV-01: Korean/English language switch and reload

- Surface: UI
- Action: Korean/English language switch and reload
- Expected: Visible navigation/page text actually switches and persisted language survives reload; test cannot silently pass when selector is absent.


### NAV-02: Phone and tablet viewport navigation

- Surface: UI
- Action: Phone and tablet viewport navigation
- Expected: Login, datasource/metric page and dashboard are operable at 390x844 and 768x1024 with reachable controls and no uncaught exceptions.


### NAV-03: Missing route, browser back/forward and deep-link reload

- Surface: UI
- Action: Missing route, browser back/forward and deep-link reload
- Expected: Correct page/not-found state, no blank application or unintended loss of authenticated navigation.


### NAV-04: Create/edit cancellation and unsaved navigation

- Surface: UI
- Action: Create/edit cancellation and unsaved navigation
- Expected: No unwanted resource creation or persisted changes from cancellation; user can return to a valid page.


### COMPONENT-01: Component create/read/update/delete on a new run-owned type

- Surface: API
- Action: Component create/read/update/delete on a new run-owned type
- Expected: Update changes the original ID rather than inserting a new record; delete removes only the created type; options remain parseable.


### COMPONENT-02: Duplicate component type and missing component ID

- Surface: API
- Action: Duplicate component type and missing component ID
- Expected: Controlled conflict/error without new duplicate rows, server error or unrelated mutations.

## 2026-10-12 메트릭 후속 결과

- METRIC-05 필터7변형, METRIC-06 정의거절5변형, METRIC-07 집계+필터수정/실패보존 PASS.
- METRIC-08 재생성의 groupBy 잔존 오류 발견 → 재생성 optional필드 null초기화 → 동일ID/활성1개/단일250 API·Aside화면 재검증 PASS.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-metric/RESULTS.md`. 기존 통과 케이스 재사용. 전체 카탈로그 완료 아님.

## Server DuckDB MVP

Additional MD scenarios and fixed Rill oracle: [server-duckdb.md](server-duckdb.md). Browser-analysis cases now require explicit **Analyze in browser** after file selection. Server upload uses **Save as dataset** directly.

시각화 디자인/LLM/경쟁 UX 비교 명세: [design-rill-parity.md](design-rill-parity.md). 숫자 집계 성공과 디자인·LLM 동등성은 별도 판정한다.
