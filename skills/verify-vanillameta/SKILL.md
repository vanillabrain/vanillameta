---
name: verify-vanillameta
description: Drive the VanillaMeta web app and API to prove artifact, report, document, and dashboard behavior. Use when verifying VanillaMeta changes, release readiness, or audit evidence.
---

# verify-vanillameta

Primary surface is the web app at http://127.0.0.1:3000 with the Nest API at http://127.0.0.1:4000/v1.
Keep the page and API on the same loopback spelling where possible. Local development accepts
both `localhost` and `127.0.0.1` as browser origins; use `127.0.0.1` consistently for UI
evidence and verify the actual sign-in response rather than inferring failure from the login toast.

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

UI: Playwright is installed in `frontend-web`. Use `chromium.launch()`, `getByLabel(/User ID/i)`, `getByLabel(/Password/i)`, `getByRole('button', { name: /^Login$/ })`.
For organization journeys, create the organization with `guest`, then use a second account with a
UI-valid password, request its enrollment code, and add it as a member. Keep returned access and
enrollment tokens out of evidence files.

## Evidence

Write to `phase2-evidence/verify-<date>/`: screenshots for UI, JSON or terminal output for API.
Prove the action and the resulting state. Record HTTP status and response body, not just
"it worked". Capture 390, 768, and 1440 widths and compare `document.documentElement.scrollWidth`
with `clientWidth`; a full-page screenshot alone can hide horizontal overflow because it expands
to the document width.

## Cleanup

Stop the two dev sessions started above. Keep the evidence directory.

## Helpers

None yet. Keep scripts in this directory and document their invocation here.

## Gotchas

- `127.0.0.1` and `localhost` are different browser origins. The local API accepts both, but a network/CORS failure must be reported as such; only a 401 means credential mismatch.
- The seeded `guest` account starts without an organization. Create one before testing sharing or enterprise views.
- Studio requires a server DuckDB source. `POST /v1/studio/samples {"sample":"commerce"}` creates the deterministic 37-order sales/refund source.
- A private report needs both a numeric KPI block and a chart block from the same Studio dashboard. Its saved version remains readable to a recipient after the owner's data changes; revoking access returns 403.
- Google/Microsoft/Sheets OAuth credentials are external blockers when absent. A stored document version fixture can still verify list, detail, share, recipient read, and revoke without claiming live OAuth success.

