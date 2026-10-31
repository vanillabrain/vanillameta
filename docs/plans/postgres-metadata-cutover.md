# PostgreSQL 17 metadata cutover

## Decision

VanillaMeta metadata uses PostgreSQL 17 outside `NODE_ENV=local`. SQLite remains only for fast unit tests. Customer data connectors keep their independent MySQL, PostgreSQL, and other engine support.

The cutover is one-way. MySQL is not a second production metadata mode.

## Runtime contract

- `DB_HOST`, `DB_PORT=5432`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` select PostgreSQL.
- `DB_SSL=true` enables TLS; certificate verification is on unless `DB_SSL_REJECT_UNAUTHORIZED=false`.
- The application refuses a non-PostgreSQL metadata connection and PostgreSQL versions older than 17 after connection.
- `pgcrypto` supplies UUID defaults. A managed PostgreSQL account must be allowed to create that extension, or the extension must be provisioned by the operator.
- Date columns use PostgreSQL `timestamp` outside tests and SQLite `datetime` in unit tests. MySQL `DATETIME` values are interpreted as UTC during transfer. Deployments that stored local-time `DATETIME` must adjust the source session or value conversion before cutover.

## Schema history

The PostgreSQL migration catalog is `backend-api/src/migrations/postgres/` and currently contains `PostgresBaseline1793500000000`. A blank production database is created from the canonical entities, reference data is seeded, and the baseline is recorded. The MySQL migration files remain historical SQLite/MySQL evidence and are not represented as successful PostgreSQL DDL.

Every later PostgreSQL schema change adds a forward migration in that folder and a matching update to the entity model. `migrate-prod` serializes runs with a PostgreSQL advisory lock.

## Initial empty database

```bash
NODE_ENV=prod \
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=vanillameta DB_PASSWORD=... DB_NAME=vanillameta \
node backend-api/dist/src/database/migrate-prod.js
```

The first run prints `bootstrapped`; the second prints `migrated` with `ranMigrations: 0`. A schema with tables but no baseline record is rejected.

## Existing MySQL data

1. Stop writes and take a restorable MySQL backup.
2. Create an empty PostgreSQL 17 database and the `pgcrypto` extension with the target account.
3. Run a dry run:

```bash
SOURCE_MYSQL_HOST=127.0.0.1 SOURCE_MYSQL_PORT=3306 \
SOURCE_MYSQL_USER=... SOURCE_MYSQL_PASSWORD=... SOURCE_MYSQL_DATABASE=vanillameta \
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=... DB_PASSWORD=... DB_NAME=vanillameta_new \
node backend-api/scripts/migrate-mysql-to-postgres.cjs
```

4. Repeat with `--apply --receipt /secure/path/receipt.json` against the empty target.
5. The transfer materializes the PostgreSQL schema, copies tables in foreign-key order, compares row counts and normalized SHA-256 per table, advances identity sequences, records the PostgreSQL baseline, and writes a receipt.
6. Start the application against PostgreSQL and run the verification set before switching DNS or the deployment tag.

The transfer intentionally refuses a target that already contains tables. A failed apply leaves the new target for inspection rather than deleting it automatically.

## Deployment

`deploy/docker-compose.prod.yml` uses `postgres:17-alpine`, keeps PostgreSQL on the internal app network, waits for `pg_isready`, runs `migrate`, and then starts the API. `backup.sh` uses `pg_dump`; `restore-drill.sh` restores into an isolated PostgreSQL 17 container before checking tables and DuckDB files.

The operator supplies `POSTGRES_PASSWORD`, optionally `POSTGRES_DB`, and `POSTGRES_USER` in `.env.prod`. Secrets and database contents stay out of the repository.

## Verification gates

- Entity metadata validates with the PostgreSQL driver without a server.
- PostgreSQL 17 bootstrap, second-run idempotence, half-schema rejection, concurrency, and advisory-lock timeout pass in CI.
- Current API and browser journeys pass on 390, 768, and 1440 widths with keyboard operation.
- A source backup restores into a fresh PostgreSQL 17 container with matching schema, migration, table counts, and representative row fingerprints.
- The one-time MySQL-to-PostgreSQL transfer reports all row counts and checksums.

## Rollback

Before cutover, the old MySQL stack and final backup remain available. After PostgreSQL accepts writes, image rollback alone is not a database rollback. Recovery uses a verified PostgreSQL backup, or an explicitly reviewed reverse-transfer plan. Do not point the application back at MySQL while both databases contain divergent writes.
