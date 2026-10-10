# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **One-command quickstart** — `docker compose up` runs the full stack on embedded SQLite with no external database or env files
- **Onboarding sample package** — first signup automatically provisions a sample sales dataset, widgets, and a starter dashboard
- **File analysis** — upload CSV/JSON/Parquet and query in-browser via DuckDB-WASM, or save as a server-side dataset
- **AI assistant hooks** — text-to-SQL and chart recommendation via OpenAI-compatible API (`AI_API_KEY`)
- **Query progress over WebSocket** — `/query-progress` namespace streams running/success events to the executing client
- **Query result cache** — in-memory by default, shared Redis cache when `REDIS_URL` is set
- **Metrics** — reusable semantic metrics with create/evaluate/delete
- **i18n** — Korean & English UI
- `SQLITE_PATH`, `PORT`, `FILE_UPLOAD_DIR`, `QUERY_TIMEOUT_MS`, `QUERY_ALLOW_WRITE`, `THROTTLE_*`, `SENTRY_*` env configuration
- Playwright E2E suite (product-flow, full-flow) with auto-provisioning global setup
- Backend unit-test scaffolding (87 tests)

### Changed
- Connection configs are now encrypted at rest (AES-256-GCM, `CONFIG_SECRET_KEY`)
- Query execution enforces read-only by default (`QUERY_ALLOW_WRITE` to opt out)
- Rate limiting via `@nestjs/throttler`
- Frontend migrated to Vite

### Fixed
- Dashboard list no longer 500s when one data source's connection config fails to decrypt
- Metric re-creation after soft-delete (unique-name conflict resolved via reactivation)
- File analysis crashes on BigInt columns and early file selection before engine init

### Removed
- Unused `aws-sdk` v2 dependency
