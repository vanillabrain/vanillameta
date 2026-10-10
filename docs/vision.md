# Vision — Shareable Report Artifacts

## Problem

Dashboards built inside BI tools die in two ways: they stay trapped in the
author's account, or they leak out as screenshots and PDFs that are dead on
arrival. AI assistants make it worse — an LLM can analyze data brilliantly, but
the result lives and dies inside a chat window. Nothing durable, nothing
citable, nothing an organization can reuse.

## Vision

VanillaMeta becomes an **open report commons**: a self-hosted repository where
people upload or connect data, turn it into reports, and share those reports as
**living artifacts** — each one carrying its own data, its own tools, and its
own permission rules. A shared report is not a picture of data. It is a thing
you can view, query, remix, and hand to an AI agent.

## The Two Editions

Every shared report exists in one of two modes:

- **Live edition** — the link renders fresh results from the connected data
  source every time it is opened. For trusted recipients and ongoing
  monitoring.
- **Snapshot edition** — the link renders a frozen capture taken at a moment in
  time, served entirely from stored results. The data source is never touched.
  For submissions, audits, public release, and untrusted recipients.

An author can publish both editions of the same report. Snapshots are
versioned, so a report accumulates a history of editions — each one citable,
restorable, and independently shareable.

## AI-Native Sharing

Every share link optionally exposes a **scoped tool surface** (MCP — Model
Context Protocol) so that a recipient's AI assistant can work with the report
directly: inspect its schema, query its data within the granted scope, remix it
into a new report, or — when permitted — update it. Live links grant tools
that hit the live database; snapshot links grant tools over the frozen data
only. The report carries its tools with it.

## Who It Serves

- **Report Authors** — consultants, analysts, and internal teams who publish
  analysis and keep ownership of the original.
- **Recipients** — clients, colleagues, and the public who receive links: some
  just view, some edit, some remix into their own copies.
- **AI Agents** — LLM clients (Claude, ChatGPT, IDE agents) acting on behalf of
  authors and recipients through scoped, auditable tools.

## Success Criteria

- A shared snapshot link discloses only the data captured in it — never a path
  back to the database.
- Any recipient can turn a shared report into their own editable copy in one
  action, without affecting the original.
- An AI agent connected to a report can answer questions, build a variant, and
  store the result as a durable artifact — all within its granted scope.
- The whole system runs self-hosted on SQLite with no external dependencies.
