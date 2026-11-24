# Connect an AI host and choose permissions

## Sub-features
OAuth discovery at `/.well-known/oauth-protected-resource/v1/mcp`, the consent screen, approval, and the token exchange with PKCE. The consent screen preselects read permissions only. `artifacts:write` stays unticked until the person ticks it.

## How to get to it (user POV)
An AI host such as Claude Code opens the authorize URL in the browser. The person signs in to VanillaMeta, sees the permission list, and approves or cancels.

## Driving it with Playwright and curl
Consent screen, observed live:

```sh
vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"
WEB=$VM_WEB_URL API=$VM_API_URL SHOTS=$VM_EVIDENCE_DIR/consent node skills/verify-vanillameta-mcp/consent-check.mjs
```

The proof is four PASS lines. The read permission is preselected, the write permission is not, the hint `Write access is off by default` is visible, and the person can tick the write permission. Open `consent-default.png` to confirm what the person sees.

Discovery, approval and token, scripted: steps 2 and 3 of `scripts/verify/mcp-artifacts-e2e.sh`. They print `metadata 에 artifacts 스코프`, `무인증 /v1/mcp 401`, `연결 승인 → 인가 코드` and `토큰 교환`.

## Gotchas
- `consent-check.mjs` only observes. It never approves, so it leaves no grant. Approval with write permission is covered by step 3 of the e2e script and by the frontend test `sends the write scope once the user ticks it`.
- Without an organization the consent request fails. Create one first or run the e2e script once.
- Access tokens last 10 minutes. A scripted token from an earlier run is useless.
