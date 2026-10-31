# Studio dashboards

## Sub-features
Create from a file or sample, add and resize numeric/chart/pivot blocks, save, publish, remix.

## How to get to it (user POV)
/dashboard/<id>/studio, or the add menu on /dashboard.

## Driving it with Playwright
Needs an organization and a ready DuckDB source. `POST /v1/studio/samples {"sample":"commerce"}`
creates the deterministic sales/refund source. Create a metric and dashboard through the BI
endpoints, open `/dashboard/<id>/studio`, apply a common filter, save, reload, and compare the
filter plus values. Add both a numeric and chart block when a report will capture the dashboard.

## Gotchas
Without an organization or server DuckDB source the journey cannot start. The older seeded SQLite
sources are not accepted by Studio's DuckDB path. Report missing prerequisites instead of weakening
the check. Verify 390/768/1440 widths for horizontal overflow.

