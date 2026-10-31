# Document connections

## Sub-features
Google document versions, AI summary with cost consent, Microsoft document read and private save, Google Sheets to DuckDB source, document sharing.

## How to get to it (user POV)
/documents, /documents/sheets, /documents/microsoft.

## Driving it with Playwright
GET /v1/documents and /v1/documents/integrations with a token. Live connect needs OAuth client settings; without them the integrations endpoint returns false for each provider.

## Gotchas
Google and Microsoft need client IDs, secrets, and registered callbacks. Sheets needs its own
OAuth client. Missing settings are a blocked prerequisite, not a failure of the page. A stored,
integrity-checked local document version can verify list/detail/share/read/revoke behavior; label
live OAuth as blocked rather than treating the fixture as provider success.

