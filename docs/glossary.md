# Glossary

| Term | Definition | Avoid |
|------|------------|-------|
| Report | A named collection of widgets (charts, tables, KPI cards) laid out on a page, bound to datasets. The shareable unit of analysis. | dashboard, document |
| Dataset | A query or file-bound source of rows that feeds one or more widgets. | datasource, table |
| Data Source | An external system (database connection or uploaded file) whose data can be queried to refresh datasets. | connection |
| Share Link | A URL that grants access to a Report outside the author's account, carrying a mode, a role, and an optional expiry. | invite, permalink |
| Live Edition | A Share Link mode that renders fresh query results from the Data Source on every open. | live dashboard, realtime |
| Snapshot | A frozen capture of a Report: the stored query results, chart options, and layout taken at one moment in time. Also the unit of Report versioning. | screenshot, export, PDF |
| Snapshot Edition | A Share Link mode that renders a specific Snapshot and never touches the Data Source. | static link |
| Role | The capability a Share Link grants its recipient: Viewer (view only) or Editor (modify the Report). | permission |
| Viewer | A Role that may only view a shared Report. | reader |
| Editor | A Role that may modify a shared Report in place. | collaborator |
| Remix | The act of copying a shared Report into the recipient's own workspace as an independent editable copy, leaving the original untouched. | fork, duplicate, clone |
| Version | One entry in a Report's snapshot history, restorable to become the current state. | revision |
| Scoped Token | A credential that grants an AI Agent access to exactly one Share Link's tools and data scope. | API key |
| AI Agent | An external LLM client (e.g. Claude, ChatGPT, IDE agent) that acts on a Report through the Scoped Token's tool surface. | bot, assistant |
| Tool Surface | The set of operations a Share Link exposes to an AI Agent — inspect, query, remix, update — bounded by mode and Role. | API |
| Workspace | The ownership boundary of a Report; remix targets the recipient's own Workspace. | project, organization |
