# Private reports

## Sub-features
Freeze a KPI and chart, text and image blocks, AI body suggestion with explicit apply and undo, version history, organization sharing.

## How to get to it (user POV)
/reports and /reports/<id>; sharing panel on the detail screen.

## Driving it with Playwright
Save a report from a dashboard with a KPI and chart, reload it, open a past version, then invite a recipient by user ID and revoke.

## Gotchas
Sharing requires both users in the same organization. A report root needs a numeric KPI and a
chart block from the same Studio dashboard. Capture it, save version 1, verify the recipient's
reader/library response while shared, then revoke and assert 403. At 390 and 768 widths the
report columns must stack without horizontal overflow. AI suggestion makes a paid model call
and requires explicit consent.

Image-bearing report saves must pass both browser pending-ticket storage and the API JSON body
limit. Use a real image larger than 100 KiB to catch the former 128 KiB/100 KiB boundary, then
reload and reopen the previous text-only revision. `이미지 추가` must receive Tab focus and open
the file chooser with Enter.

When the local Codex provider is used, pass `AI_PROVIDER=codex`,
`AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, and the existing
`AI_CODEX_MODEL_CATALOG`; the child CLI intentionally ignores the user Codex config. The
connection must also configure `model_provider=opencodex` with the base URL,
`AI_CODEX_API_KEY=local`, and `wire_api=responses`. Without that provider block Codex can
fall back to the ChatGPT backend and report `model_not_found` for gpt-6-luna. Verify the AI
ledger records provider codex, model gpt-6-luna, and status ok. Keep `gpt-6-luna`; do not
substitute another model. UI apply/undo without a save call is a separate assertion.

## Comments and suggestions

Region-anchored comments (whole report, text range, image) and suggestions. Design:
`docs/architecture/artifact-comments-collaboration.md`; last run: `docs/testing/report-comments-collaboration.md`.

- Use two browser origins so owner and recipient stay signed in at once: owner at
  `http://127.0.0.1:3000`, recipient at `http://localhost:3000`. Local storage is per origin.
  Both need the API CORS allowance; a failure there is a network error, not a credential error.
- Set up the recipient with the Gotchas above (second account, enrollment code, owner adds it to
  the organization), then share the report to its user ID at the version under test.
- API (`Authorization: Bearer`, all `no-store`): `GET /v1/reports/:id/comments`,
  `POST /v1/reports/:id/comments {requestId, version, anchor, body}`,
  `POST .../comments/:threadId/replies`, `POST .../comments/:threadId/status`,
  `POST /v1/reports/:id/suggestions`, `POST .../suggestions/:suggestionId/dismiss`, and
  `POST /v1/reports/:id/save` with optional `appliedSuggestionIds`. Every write needs a UUID
  `requestId`; resend the same one to prove idempotence.
- Assert: the recipient lists only threads they started; the owner sees all; apply in the editor
  changes only the draft; save marks the suggestion `applied` with `appliedVersion` equal to the
  new version and resolves the thread when no open suggestion remains; the owner's location goes
  `detached` at head while the recipient's pinned version stays `exact`.
- Gotcha (Ego Lite): the browser toggles page visibility between actions. Report protection then
  conceals the body and clears selection and the open composer. This is intended. Drive
  selection to comment inside one in-page script (build a `Range`, dispatch `mouseup`, click the
  comment button) and state in the evidence that it was not a real pointer drag.
- Check 390, 768, and 1440: the comment panel is a 360px right column at 1440 and stacks below the
  body at 768 and 390, with `scrollWidth == clientWidth`.
- Claude over MCP is a separate flow: see [mcp-collaboration.md](mcp-collaboration.md).

