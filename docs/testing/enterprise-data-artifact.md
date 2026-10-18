# Enterprise Data Artifact implementation evidence

2026-10-18. Spec: [requirements](../strategy/enterprise-data-artifact.md); plan: [A–E](../plans/enterprise-data-artifact.md). Implementation in progress, not enterprise-ready or full acceptance. Existing Commerce changes preserved. gpt-6-luna unchanged; VoiceOver BLOCKED.

## A — owner execution evidence

Server GET/preview attaches an owner-only allowlisted evidence projection under `preview.evidence`, after a successful pinned query. It records actual query completion UTC, source/schema/data identity versions, dashboard revision, exact filter/date scope, block calculation identity, persisted metric snapshot and returned aggregate-row count. It does not claim ingestion freshness, durable execution history, source-row count, or numeric independent-oracle proof.

Canonical metric evidence comes from saved structured links, never today's possibly changed metric catalog. Unknown legacy definitions remain unproven. No new request/DB table/write/LLM call/publication. Existing owner/source guards and pinned DuckDB snapshot remain in force. Client discards unmatched/malformed provenance and does not borrow old evidence for AI result rows.

| ID | Expected | Result |
|---|---|---|
| EA-03 A subset | Server query time/versions/scope and saved metric snapshot; no SQL/secret/path leakage; no new writes | PASS_SELECTED: targeted tests + actual owner GET/reload; persistent history is not implemented |
| EA-07 A subset | Collapsible evidence keyboard Enter/Space and390/768/1440 layout, overflow0 | PASS_SELECTED: actual Ego24 widths/keyboard, overflow0 |
| A-STALE | Changed scope/AI rows do not get previous evidence; title/format-only edit retains numeric provenance | Component tests PASS |
| A-LEGACY | Missing/mismatched saved calculation does not invent formula | Server/component tests PASS |

This is read-only current execution evidence, not persistent audit history or the whole EA-03/FR015 acceptance. Stage B/C/D/E remain pending until recorded below. Existing tests outside affected scope are reused.

## A review and verification

BE evidence/service25 tests and database module57 tests PASS (overlap is not totalled with prior runs); FE evidence/editor/API/FileVersions86 tests PASS. Both builds, FE type, changed lint and diff whitespace PASS. Initial new-module RED and schema UI RED logs are retained; an overbroad label assertion was corrected (the explanatory disclaimer intentionally contains the words “last refresh success”). Full root/core tests were not repeated for read-only provenance/schema error presentation.

Read-only reviewer found a real coverage issue: preview display arrays may be cleared for unsupported grain/timezone or >240 points. Returning0 would imply an empty aggregation. Fixed to resultStatus=unavailable/count=null and explicit UI warning, with regression coverage. Available row counts describe returned aggregate display rows, not complete raw/group counts. AI-unverified warning now follows only AI rows actually eligible for rendering in the current scope.

Ego24 actual isolated source4/dashboard7 owner GET returned saved metrics5/6/7 and13000/2000/11000 KRW. Enter/Space expands/collapses evidence, nested versions remain readable;390/768/1440 stable viewport widths equal document scroll widths, body14px/source link32px. Source management link Enter opens correct source4 in a new tab and preserves the Studio tab. Initial immediate1440 resize temporarily showed1776px document width; after responsive layout stabilization it is1440. The initial sample is retained separately from final layouts; no persistent overflow was found.

## B1 schema rejection — partial stage B

FILE_SCHEMA_CHANGED returns only added/removed/typeChanged column names/types (max25 per list) and truncation flag, retaining existing CAS/version/no-op/cleanup behavior. UI renders bounded text, preserves selected file and old version, clears old schema detail on new selection. Cross-dashboard affected-block mapping and durable refresh status are NOT_RUN/not implemented.

Ego24 real keyboard-triggered replacement of source4 with `renamed_amount,currency` CSV produced the server schema rejection and existing active version stayed in place. Added renamed_amount and seven removed columns were visible.390/1440 error panel has scrollWidth=innerWidth. This is a real server response, not an injected UI error. Test helper initially waited for a hidden file input to be visible and timed out; switched to documented setInputFiles on the existing hidden input. No product failure was inferred from that wait.

Five application tables (database/metric/dashboard/studio_state/studio_publication) have identical before/after fingerprints during this rejected replacement; owner GET document/source revision/results also match. No successful replacement, new Artifact, new metric, model call or publication was performed. This data is synthetic and does not count as customer acceptance.

Evidence folder: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/enterprise-artifact-20261018/`. Owner payloads, layout measurements, fingerprints, screenshots and targeted logs are preserved there. Existing gpt-6-luna setting retained without new inference; VoiceOver BLOCKED. Changes remain uncommitted.

## Remaining execution

A is a selected owner execution-evidence slice, not all FR014/015/020/022 acceptance. Persistent execution history, publication data-mode inspection and evidence-linked AI narratives remain. B still needs durable refresh attempt state/restart reconciliation and schema-to-block impact. C requires organization/role representation, all-path server policy and LLM disclosure/audit. D needs narrative/filter block round trips; E needs the real connector selection (requested asynchronously), then scheduling. No enterprise policy is claimed enabled by the evidence panel or schema list. Actual customer and real-device gates remain open.
