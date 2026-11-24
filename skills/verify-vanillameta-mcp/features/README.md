# VanillaMeta MCP artifacts verification map

This directory is the maintained source for verifying how an AI host creates artifacts through MCP and how a person opens them. Read this index, then the matching feature file.

## Baseline preconditions

- A Compose stack started by this run with `launch.sh` (`SKILL.md`, Launch). Recipes restore its variables with `vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"`.
- `doctor.sh` prints no FAIL line.
- The seeded user `guest` with password `Admin!@12` belongs to an organization. `scripts/verify/mcp-artifacts-e2e.sh` creates one named `Verification`.
- Chromium is installed for Playwright (`cd frontend-web && npx playwright install chromium`).
- Never drive a stack this run did not start.

## Driving conventions

- Prefer ARIA roles and accessible names over CSS selectors. Run the browser with `locale: 'en-US'` so labels match the English strings.
- Treat HTTP status and response bodies as supporting evidence only. The proof is what the browser shows and what the database holds.
- Start each recipe from the baseline state. Restore nothing by hand. Recreate the stack instead.

## Proof and skip reporting

- Capture the action and the resulting state.
- Browser proof is a screenshot with the artifact title visible.
- Write proof adds a second read of the stored value through `GET $VM_API_URL/ai-artifacts/<id>`.
- Report an unreachable path with the attempted command and the unmet precondition.

| Feature | File | Prerequisite |
| --- | --- | --- |
| Connect an AI host and choose permissions | [connect-and-consent.md](connect-and-consent.md) | organization membership |
| Create, update and delete artifacts over MCP | [write-artifacts.md](write-artifacts.md) | an approved grant with `artifacts:write` |
| Open an artifact in the browser | [view-artifacts.md](view-artifacts.md) | at least one artifact of the kind |
| Keep artifacts across a restart and an upgrade | [survive-restart.md](survive-restart.md) | a kept stack with artifacts |
| Refuse a write while the connection is being revoked | [revoke-while-writing.md](revoke-while-writing.md) | an approved grant |
