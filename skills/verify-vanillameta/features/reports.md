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

