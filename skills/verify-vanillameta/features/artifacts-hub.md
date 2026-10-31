# Artifact hub

## Sub-features
Unified list and grid, search, type filter, archive, shared-with-me scope, file artifacts.

## How to get to it (user POV)
/dashboard after login.

## Driving it with Playwright
GET /v1/dashboard/library?view=active and GET /v1/reports/library with a bearer token; both must return 200. UI: open /dashboard, assert the heading and the list/grid controls.

## Gotchas
An organization-less user sees empty lists with 200 responses. Empty is a valid result; a 401/403 is the failure.

