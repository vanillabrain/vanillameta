# PostgreSQL metadata migration verification

2026-10-31. Branch `develop`, based on `fcca7adb`, with the existing Artifact platform changes preserved.
Runtime evidence lives outside the repository in `phase2-evidence/postgres-metadata-20261031` and `phase2-evidence/postgres-artifact-20261031`.

## Live runtime

| Item | Value |
| --- | --- |
| Engine | PostgreSQL 17.11 (`postgres:17-alpine`) |
| API / Web | `http://127.0.0.1:4251/v1`, `http://127.0.0.1:3251` |
| Schema | fresh owned schema, development synchronize, no MySQL history "faked" |
| Accounts | isolated QA accounts created for this run |

## VERIFIED

| Check | Result | Evidence |
| --- | --- | --- |
| PostgreSQL metadata entity contract | every entity builds with the PostgreSQL driver without a server | `metadata-postgres-schema.spec.ts` |
| Production bootstrap on an empty database | `{"mode":"bootstrapped","recordedMigrations":1}`; 103 application tables plus `migrations` after the unused `users` entity was removed; seeds `template` 10 / `template_item` 46 / `user` 0 | `vm_prod_bootstrap` receipt in `live-verification.json`; 103 entities and 103 tables in `user-entity-identity.spec.ts` |
| Bootstrap idempotency | re-run against an existing schema reports `migrated` with `ranMigrations=0` | earlier schema run in this document |
| MCP OAuth tables in production bootstrap | `mcp_oauth_pending`, `mcp_oauth_grant`, `mcp_oauth_code`, `mcp_oauth_token` created by the production path | `vm_prod_bootstrap` query |
| Live Nest API on PostgreSQL | health OK, signup/signin, authenticated list and detail | `scripts/qa-postgres-artifacts.cjs` |
| Artifact API journeys (9 checks) | HTML/PDF/PPTX upload, owner list 3 vs other account 0, byte-exact download, version 2 replacement with version 1 preserved, stale 409, magic/MIME 400, anonymous share of current version, revoke 404, expiry 404, soft delete 204 | `phase2-evidence/postgres-artifact-20261031/api-result.json` |
| HTML preview sandbox | inline `<script>` never runs, external fetch never runs | browser evaluation in the same evidence folder |
| Real browser, Artifact hub | 1440 / 768 / 390, `scrollWidth === innerWidth` at all three widths | `browser/hub-final-*.png` |
| Real browser, HTML detail | version selector, share toggle, embed code, sandboxed preview | `browser/detail-*-viewport.png`, `browser/shared-1440.png` |
| Real browser, PDF detail | embedded PDF viewer, version 1, owner-only notice, no horizontal overflow at 1440 / 768 / 390 | `browser/pdf-detail-*.png` |
| Real browser, PPTX detail | metadata-only preview notice and download link, no horizontal overflow at 1440 / 768 / 390 | `browser/pptx-detail-*.png` |
| Hub report access state | resolves without a stuck "report access check" message; `GET /v1/reports/library` returns 200 `{"items":[],"nextCursor":null}` | `browser/hub-report-status-1440.png` |
| Keyboard on the grid toggle | focus visible, Enter switches the layout | `browser/hub-keyboard-390.png` |
| `pg_dump` restore rehearsal | dump from the live runtime restored into a fresh PostgreSQL 17 container: 105 tables, identical md5 for artifact_file, artifact_file_version, template, template_item and user | `live-verification.json` |
| MySQL to PostgreSQL transfer | owned MySQL 8.4.11 fixture (3 tables, 12 rows) into an empty PostgreSQL 17 target: dry run `writes:0`, apply `VERIFIED`, per-table SHA-256 match, 0 foreign-key orphans, identity sequences advanced past the max id, baseline recorded | `mysql-transfer-receipt.json` |
| Real dataset cutover | 2026-10-16 Studio MySQL dataset (29 tables, 202.7 MB datadir) copied read-only from `vm-studio-daemon-data-20261016` into a temporary datadir, then transferred into an empty PostgreSQL 17 target: dry run `writes:0` on 29 tables, apply `VERIFIED` for 28 tables and 46 rows, exact row counts for 28/28, 0 orphans across 25 foreign keys, sequences at max+1, entity reads (dashboard 1, widget 5, dataset 5, login history 11, user 1) with Date hydration, and `migration:run:prod` returning `{"mode":"migrated","ranMigrations":0}` | `mysql-real-cutover.json`, `mysql-real-cutover-receipt.json` |
| Backend regression | 81 PASS / 7 skipped (PostgreSQL-gated) across metadata, migrate-prod, source locks, Artifact API/service, report sharing and resource policy | `npm test -- --runInBand ...` |
| Entity identity | One `User` metadata bound to the `user` table, 103 entities across 103 tables, no TypeORM name-based lookup in production code | `src/common/user-entity-identity.spec.ts`; 101 PASS across 16 related suites |
| MySQL cutover value canonicalisation | 11 PASS covering microsecond padding, zero dates, bytea formats, tinyint booleans, big integers, JSON key order, row hashing and foreign-key ordering | `src/database/mysql-cutover.spec.ts` |
| Frontend regression | 21 PASS in 7 Artifact files | `npx vitest run ... --maxWorkers=2` |
| Backend type/lint/build | typecheck and production build PASS with Node 24; `eslint src --ext .ts --quiet` exit 0 | command output |
| Compose YAML syntax | root, production, backend, dev, test and multi-db files parse | Ruby YAML parser |
| Shell and Node syntax | backup, restore, schema QA, browser QA and MySQL transfer scripts parse | `bash -n`, `node --check` |

### Defects the live runtime found and the fixes that landed

1. Raw SQL used camelCase identifiers unquoted. PostgreSQL folds them to lower case, so artifact, report, enterprise, group notification, delivery, user and monitoring queries failed. Each identifier is now quoted.
2. The template seed assumed ids 7 to 16 while the generated rows were 1 to 10, so `template_item` violated its foreign key. The seed now resolves the stored template row by title, unique indices back the titles and cells, and a missing row fails instead of guessing.
3. `background_job_results.backgroundJobId` was `varchar(100)` against a UUID relation; PostgreSQL rejected the relation. The column is now `uuid`.
4. `data-source.ts` globbed `*.entity.ts`, which does not match `mcp-oauth.entities.ts`. Production bootstrap synchronises exactly that list, so a fresh production database would have had no `mcp_oauth_*` tables. The MCP OAuth entities are now listed explicitly and the production bootstrap creates all four.
5. The MySQL transfer dry run crashed on `a.table_name.localeCompare` because MySQL 8 returns `TABLE_NAME`. Table names are normalised before sorting and mapping.
6. Two classes were named `User`. `entities/user.entity.ts` mapped to an unused `users` table, so TypeORM held two `User` metadata entries and `getRepository('User')` resolved to `users`. The legacy entity had no importer and was deleted, leaving one `User` bound to `user`. `JobResult` and `AnalyticsEvent` still share a class name across two live entities; no TypeORM name-based lookup exists today, so they are a latent hazard rather than an active defect.

## PARTIAL

- Native `select` value changes with a keyboard alone (ArrowDown then Enter) were not confirmed in Aside automation. Focus and Enter activation on the layout toggle were confirmed.
- The report list was verified as an authenticated empty list over HTTP and as a resolved hub state in the browser. A report with real rows on PostgreSQL has not been opened in this run.
- The real dataset carries 29 of the 103 current tables, so tables absent from the source stay empty after the target schema is created. The transfer copies same-named tables only.
- The source `migrations` table is skipped by design. The PostgreSQL baseline is recorded instead.

## NOT VERIFIED

- Customer production data. The real run used a prior Studio verification dataset, so row volume, encodings and long-tail column types of an actual customer database are still untested.
- Production deployment, real operator migration on a live database, and human acceptance.
- VoiceOver announcement checks remain blocked in this environment; DOM inspection is not reported as a substitute.

## Commands

- Schema only: `npm run qa:postgres:schema`
- Full runtime: `QA_API_PORT=... QA_WEB_PORT=... QA_CONTROL_PORT=... npm run qa:postgres`
- Production bootstrap: `NODE_ENV=prod DB_HOST=... DB_PORT=... DB_USERNAME=... DB_NAME=... npm run migration:run:prod`
- Transfer: `SOURCE_MYSQL_* DB_* node backend-api/scripts/migrate-mysql-to-postgres.cjs [--apply --receipt path]`

## Real dataset runbook

The transfer tool now normalises the value shapes that differ between the drivers:

- MySQL `DATETIME(6)` padding against PostgreSQL trimming for fractional seconds.
- MySQL zero dates, which stop the run with the table and column instead of guessing a value.
- MySQL `Buffer` against PostgreSQL `\x...` text for `bytea`.
- `tinyint(1)` against `boolean`, and big integers that must stay exact strings.
- JSON key order, plus parent-before-child ordering and a hard stop on foreign-key cycles.

Run it against a real dataset from a shell that can reach Docker:

```bash
export DOCKER_HOST=unix:///Users/moonklabs/.colima/vanillameta-verify/docker.sock
SOURCE_MYSQL_HOST=127.0.0.1 SOURCE_MYSQL_PORT=<published> SOURCE_MYSQL_USER=root \
  SOURCE_MYSQL_PASSWORD=<from container env> SOURCE_MYSQL_DATABASE=<db> \
  DB_HOST=127.0.0.1 DB_PORT=<target> DB_USERNAME=postgres DB_PASSWORD=<target> \
  DB_NAME=<empty target> node backend-api/scripts/migrate-mysql-to-postgres.cjs --apply --receipt <path>
```

The apply path refuses a target that already has tables, verifies every copied table by row count and SHA-256, advances identity sequences, and records the PostgreSQL baseline.

