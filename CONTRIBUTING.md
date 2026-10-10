# Contributing to VanillaMeta

Thanks for your interest! VanillaMeta is Apache-2.0 — contributions of all kinds are welcome: bug reports, docs, connector verification, features.

## Getting set up

```bash
# Backend (SQLite local mode — no external DB needed)
cd backend-api && npm install && npm run seed && npm run start:local

# Frontend
cd frontend-web && npm install && npm start
```

See [AGENTS.md](AGENTS.md) for test commands and project conventions.

## Before opening a PR

- `cd backend-api && npm run build && npx eslint src`
- `cd backend-api && npm test`
- `cd frontend-web && npm run build && npx eslint src`
- `cd frontend-web && npm run test`
- `cd frontend-web && npx playwright test` (full E2E — servers are started automatically)

## Connector contributions

New data sources and verification of the 🔶 community connectors (ClickHouse, Trino, Databricks) are especially valuable. If you can run a real server, a manual verification report in a PR description is enough to move a connector up the support matrix.

## Reporting bugs

Open an issue with: steps to reproduce, expected vs actual behavior, browser/environment, and screenshots or API responses where relevant.
