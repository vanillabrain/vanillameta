# Keep artifacts across a restart and an upgrade

## Sub-features
Artifacts survive recreating every container. The `AddAiArtifact1793550000000` migration creates `ai_artifact` on a production database that predates it, runs once, and keeps existing rows. The Compose quickstart runs with `NODE_ENV: dev`, creates the table by entity synchronisation, and has no `migrations` table. Production runs `npm run migration:run:prod`, which records the migration.

## How to get to it (user POV)
The operator restarts or upgrades the stack. The links the AI host handed out still open the same content.

## Driving it with Docker and psql
Restart on a kept stack, then read the same ids:

```sh
skills/verify-vanillameta-mcp/restart.sh
skills/verify-vanillameta-mcp/doctor.sh
vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"
curl -s -H "Authorization: Bearer $JWT" "$VM_API_URL/ai-artifacts/<id>"
```

`restart.sh` keeps the ports and the MCP addresses. The proof is the same title and content as before and a 200 from `$VM_WEB_URL/ai-artifacts/<id>`. The e2e script does this in step 6 and prints `재기동 뒤 web 유지`, `재기동 뒤 document 유지`, `재기동 뒤 sheet 유지` and `재기동 뒤 chart 유지`.

Upgrade of a database from before the table, against a throwaway Postgres:

```sh
docker run -d --name vm-artifacts-verify-pg -e POSTGRES_PASSWORD=verify -p 55432:5432 postgres:17-alpine
until docker exec vm-artifacts-verify-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
cd backend-api && METADATA_DB_TYPE=postgres VM_MIGRATE_PROD_POSTGRES_PORT=55432 VM_MIGRATE_PROD_POSTGRES_PASSWORD=verify \
  /opt/homebrew/bin/node node_modules/jest/bin/jest.js --config package.json src/database/ai-artifact-postgres.spec.ts
docker rm -f vm-artifacts-verify-pg
```

The proof is `Tests: 2 passed, 2 total`. A line that also shows `skipped` means the spec did not run. The assertions behind it are `ranMigrations: 1` on the first run, `0` on the second, and the kept row.

## Gotchas
- Run the spec with Node 26, as in the command. The `node` on PATH may be 22, which breaks other specs in this folder.
- Without `VM_MIGRATE_PROD_POSTGRES_PORT` the spec is skipped and jest still exits 0. Read the `skipped` count.
- The spec needs its own throwaway Postgres. Never point it at the compose database.
- Recreating containers keeps volumes. `down -v` deletes the artifacts.
