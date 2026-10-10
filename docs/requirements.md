# Requirements — Shareable Report Artifacts

Requirements for the report sharing, snapshot, remix, and scoped AI-tool
capabilities described in [vision.md](vision.md). Domain terms follow
[glossary.md](glossary.md).

## Functional Requirements

| ID     | Title                     | User Story                                                                                                                              | Priority | Status |
|--------|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------|--------|
| FR-001 | Publish Live Edition      | As a Report author, I want to publish a Live Edition share link so that recipients always see data freshly queried from the data source. | High     | Open   |
| FR-002 | Capture Snapshot          | As a Report author, I want to capture a snapshot of my report so that its data and layout are frozen at a moment in time.                | High     | Open   |
| FR-003 | Publish Snapshot Edition  | As a Report author, I want to publish a share link bound to a snapshot so that recipients see a fixed edition without touching the data source. | High | Open |
| FR-004 | Assign Share Role         | As a Report author, I want to assign a Viewer or Editor role to each share link so that I control what recipients may do with it.        | High     | Open   |
| FR-005 | Remix Shared Report       | As a recipient, I want to remix a shared report into my own workspace so that I can adapt it without affecting the original.             | High     | Open   |
| FR-006 | Edit Shared Report        | As a recipient with an Editor link, I want to modify the shared report so that I can collaborate on it in place.                         | Medium   | Open   |
| FR-007 | Restore Report Version    | As a Report author, I want to browse and restore earlier snapshot versions so that I can recover previous states of my report.           | Medium   | Open   |
| FR-008 | Revoke Share Access       | As a Report author, I want to revoke or expire any share link so that I can withdraw access at any time.                                 | High     | Open   |
| FR-009 | Query Report via Agent    | As a recipient, I want my AI agent to inspect and query a shared report within the link's scope so that I can ask questions without direct data source access. | High | Open |
| FR-010 | Modify Report via Agent   | As a recipient, I want my AI agent to remix or update a shared report through its tool surface so that analysis results become durable artifacts. | Medium | Open |
| FR-011 | Refresh Live Data         | As a recipient, I want a live edition to reflect the latest data source contents on every open so that the link stays current without republishing. | High | Open |
| FR-012 | Discover Shared Artifacts | As a workspace member, I want to search reports, datasets, and snapshots I have access to so that I can find and reuse existing artifacts. | Medium | Open   |
| FR-013 | Record Remix Lineage      | As a Report author, I want remixed copies to record their source report so that provenance of derived work stays traceable.              | Low      | Open   |
| FR-014 | Re-capture Snapshot       | As a Report author, I want to capture a new snapshot of an updated report so that its edition history grows and links can be repointed.  | Medium   | Open   |

## Non-Functional Requirements

| ID      | Title                    | Requirement                                                                                                                  | Category      | Priority | Status |
|---------|--------------------------|------------------------------------------------------------------------------------------------------------------------------|---------------|----------|--------|
| NFR-001 | Snapshot Isolation       | Serving a snapshot edition must execute zero queries against the data source; 100% of rendering comes from stored payload.   | Security      | High     | Open   |
| NFR-002 | Read-Only Scoped Queries | Every query executed through a share link or scoped token must be read-only; 100% of write statements are rejected.          | Security      | High     | Open   |
| NFR-003 | Scoped Query Bounds      | Scoped access queries must be bounded to the report's own datasets, at most 10,000 rows per query, and a 30-second timeout. | Security      | High     | Open   |
| NFR-004 | Snapshot Payload Limit   | A snapshot must store at most 10,000 rows per widget; capture beyond the limit truncates and records the truncation.         | Reliability   | Medium   | Open   |
| NFR-005 | Share Link Latency       | A shared report must render its first content within 3 seconds on a 4-core server for snapshots up to 50,000 stored rows.    | Performance   | Medium   | Open   |
| NFR-006 | Scoped Access Audit      | Every scoped token call must be logged with timestamp, tool name, and outcome; logs retained for at least 90 days.           | Auditability  | High     | Open   |
| NFR-007 | Denial Consistency       | Expired or revoked share links and scoped tokens must deny 100% of access attempts, including cached sessions.               | Security      | High     | Open   |
| NFR-008 | Edit Conflict Semantics  | Concurrent edits of a shared report must resolve by last-write-wins with every write producing a restorable version.         | Reliability   | Medium   | Open   |
| NFR-009 | Secret Non-Disclosure    | A share link or snapshot payload must never contain data source credentials or connection strings; 0 occurrences permitted.  | Security      | High     | Open   |

## Constraints

| ID    | Title                  | Constraint                                                                                                                        | Category   | Source                    | Priority | Status |
|-------|------------------------|-----------------------------------------------------------------------------------------------------------------------------------|------------|---------------------------|----------|--------|
| C-001 | Backend Stack          | Implementation must reuse the existing NestJS + TypeORM backend; no additional runtime services beyond optional Redis.              | Technical  |                           | High     | Open   |
| C-002 | SQLite Support         | All new features must work with SQLite as the metadata store (self-hosted default), not only MySQL.                                 | Technical  |                           | High     | Open   |
| C-003 | Read-Only Default      | The existing `QUERY_ALLOW_WRITE=false` default must remain unchanged; scoped access must never depend on enabling it.               | Security   | Internal security policy  | High     | Open   |
| C-004 | Public Access Boundary | Anonymous (unauthenticated) access is permitted only through snapshot edition links with a Viewer role; all other access requires a valid session or scoped token. | Security | | High | Open |
| C-005 | Share Schema Extension | The existing `dashboard_share` entity (uuid, shareToken, shareYn, endDate) must be extended, not replaced, to keep existing links valid. | Technical |                        | Medium   | Open   |
| C-006 | MCP Transport          | Scoped tool surface must be exposed via the MCP streamable HTTP transport; a stdio transport may be added for self-hosted use.      | Technical  | MCP specification         | Medium   | Open   |
| C-007 | License                | All new code must remain compatible with the repository's Apache-2.0 license.                                                       | Legal      | LICENSE                   | High     | Open   |
