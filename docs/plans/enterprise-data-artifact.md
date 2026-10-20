# Enterprise Data Artifact implementation plan

Status: In Progress — 2026-10-18. User approved sequential A–E implementation. Spec: [requirements design](../strategy/enterprise-data-artifact.md). Existing uncommitted Commerce changes are preserved. This plan does not claim all enterprise capabilities implemented.

## Constraints

Existing Studio/Dashboard IDs, structured compiler, shadcn UI, metadata DB and DuckDB worker are reused. No arbitrary code execution, dependency installation, automatic external publication, model fallback or OS permission changes. AI stays gpt-6-luna; VoiceOver stays BLOCKED. Existing PASS tests are reused unless affected. Real customer acceptance cannot be fabricated.

## Execution

- [x] A1: Add owner-only execution evidence to existing GET/preview results: source/data/schema revision, query time, exact scope, saved metric snapshot calculation and coverage. Whitelist fields; no SQL/credentials/paths. Failed preview has no successful evidence.
- [x] A2: Connect collapsible evidence panel in Studio with stale/unsaved/AI-result distinctions, keyboard access and390/768/1440 layouts. Existing calculations/requests remain unchanged.
- [x] A3: Targeted tests, builds/type/lint and actual browser/API screenshots; MD EA-03/07 selected conditions. Evidence of historical executions must never be fabricated from current metric catalog.
- [x] B1: Structured schema-change rejection and owner UI details; actual invalid replacement preserves active source and saved results. This is not durable refresh status.
- [ ] B: Existing file-version status/retry/schema-impact flow, preserving previous active data and distinguishing publication. Map existing APIs before changing persistence.
- [ ] C: Server-side organization/data/LLM policies and audit, deny by default for unapproved enterprise disclosure. Cover each entry point; no client-only protection. Detailed UC/security tests before enabling tenant use.
- [ ] D: Narrative/filter blocks and safe reuse, aggregate conditions/source relationships only with explicit semantic contracts and independent oracles.
- [ ] E: A concrete read-only connector, durable scheduled refresh and recovery. Connector source/auth/rate policy require actual deployment input; external connection is not invented.

## Rill scenarios delivery — approved 2026-10-18

The user explicitly requested completion of all24 researched scenarios as runnable VM sample demos. [Execution plan](rill-scenarios.md) and [acceptance tracker](../testing/rill-scenarios.md) is the execution source; [research/source inventory](../strategy/2026-10-18-rill-examples-scenarios.md) remains provenance. This expands the current delivery objective, not completed acceptance. Begin by connecting deterministic VM margin/funnel samples to existing Studio generation; then aggregate conditions/metric composition, Artifact handoff, durable refresh, all-path enterprise policies and authenticated embedding/reporting. A sample button or mock does not satisfy server-side semantics/security. Existing A/B1 and uncommitted changes are preserved.

## Review focus

Late/mismatched evidence after filter/AI edits; old saved metric vs current definition; preview failure described as fresh; source change during snapshot; forbidden metadata disclosure; mobile overflow/focus. Each stage remains incomplete until its verification is recorded. New requirements remain Open until their linking use cases and acceptance evidence justify a status change.
