---
name: verify-vanillameta
description: Drive the VanillaMeta web app and API to prove artifact, report, document, and dashboard behavior. Use when verifying VanillaMeta changes, release readiness, or audit evidence.
---

# verify-vanillameta

Primary surface is the web app at http://127.0.0.1:3000 with the Nest API at http://127.0.0.1:4000/v1.

## Launch

```sh
cd backend-api && npm run start:local        # SQLite metadata, seeds demo data
cd frontend-web && npm run dev -- --host 127.0.0.1 --port 3000
```

Ready when `curl -sf http://127.0.0.1:4000/v1/health` returns `{"status":"ok"}` and `curl -s http://127.0.0.1:3000/` returns the app HTML. Launch takes about 60 seconds on a cold start.

Teardown: stop only the processes this run started (the two dev sessions). Evidence survives.

## Doctor

```sh
curl -sf http://127.0.0.1:4000/v1/health
curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/
```

Both must succeed. A UI wedged on the login screen with a healthy API is not ready: check `/v1/documents` with a fresh token before driving.

## Drive

API:

```sh
TOKEN=$(curl -s -X POST http://127.0.0.1:4000/v1/login/signin -H 'content-type: application/json' \
  -d '{"userId":"guest","password":"Admin!@12"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessToken"])')
curl -s http://127.0.0.1:4000/v1/documents/integrations -H "authorization: Bearer $TOKEN"
```

UI: Playwright is installed in `frontend-web`. Use `chromium.launch()`, `getByLabel(/User ID/i)`, `getByLabel(/Password/i)`, `getByRole('button', { name: /^Login$/ })`. Note the local seed user `guest` has no organization, so organization-scoped pages can be unreachable; record that as a Gotcha instead of weakening the check.

## Evidence

Write to `phase2-evidence/verify-<date>/`: screenshots for UI, JSON or terminal output for API. Prove the action and the resulting state. Record HTTP status and response body, not just "it worked".

## Cleanup

Stop the two dev sessions started above. Keep the evidence directory.

## Helpers

None yet. Keep scripts in this directory and document their invocation here.

