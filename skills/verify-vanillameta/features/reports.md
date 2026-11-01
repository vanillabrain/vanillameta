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
`AI_CODEX_MODEL_CATALOG`; the child CLI intentionally ignores the user Codex config. Keep
`gpt-6-luna`. A provider 429 is BLOCKED, not a reason to substitute another model. UI
apply/undo may be checked with a stubbed browser response only when labeled separately from a
live model success.

