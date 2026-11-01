# Artifact hub

## Sub-features
Unified list and grid, search, type filter, archive, shared-with-me scope, file artifacts.

## How to get to it (user POV)
/dashboard after login.

## Driving it with Playwright
GET /v1/dashboard/library?view=active and GET /v1/reports/library with a bearer token; both must return 200. UI: open /dashboard, assert the heading and the list/grid controls.

For file artifacts, upload HTML, PDF, and PPTX through the hub dialog and prove the resulting detail.
HTML must render in an iframe with `sandbox=""` and no script side effects. PDF must expose an
`application/pdf` object and downloadable bytes; PPTX intentionally shows metadata and download
only. Create a share link, open it without authentication, replace v1 with v2, verify the old and
current versions separately, then revoke and assert the share URL returns 404.

## Gotchas
An organization-less user sees empty lists with 200 responses. Empty is a valid result; a 401/403 is the failure.
Use the outer download link with `.first()` on PDF details because Chromium also exposes the
object's fallback link. A headless full-page screenshot may miss an HTML preview located below the
fold or a PDF plugin surface; scroll the iframe into view for a viewport capture and validate PDF
through MIME, object presence, downloaded bytes, and SHA-256.

