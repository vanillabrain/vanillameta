# VanillaMeta MCP Server

Local stdio adapter for authenticated analysis creation. Requires Node 24.11–24.x and a running VanillaMeta API with Codex AI configured. Uses official MCP SDK v2; no separate DB or server port.

```sh
npm --prefix mcp-server ci --ignore-scripts
node mcp-server/scripts/login.js --api-url http://127.0.0.1:4000/v1 --web-url http://127.0.0.1:3000 --output mcp-server/.env.local
```

The interactive setup hides the password and writes an owner-only token file without overwriting existing files. API prefix/ports must match your installation. The web URL is the app, not the documentation website. The file contains a short-lived user credential; rotate it on expiry/revocation and update/restart the client.

Register the process with your MCP host (use absolute paths to Node, the private env file and index.js):

```sh
codex mcp add vanillameta -- /absolute/path/to/node --env-file=/absolute/path/to/mcp.env /absolute/path/to/vanillameta/mcp-server/src/index.js
```

This command edits the host's MCP config when the user runs it. It does not register an HTTP endpoint. Do not run `npm start` as the MCP command: npm writes banners to stdout. Run Node directly.

| Tool                  | Effect                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `vm_list_sources`     | Discover accessible active sources                                        |
| `vm_describe_source`  | Schema and saved metrics, without raw sample rows or connection secrets   |
| `vm_propose_analysis` | Existing server AI proposal/all-block aggregate preview; no artifact save |
| `vm_get_proposal`     | Read the temporary proposal; no regeneration                              |
| `vm_save_analysis`    | Explicitly approved private save; same UUID/payload for replay            |
| `vm_get_artifact`     | Read saved summary/aggregate preview and Studio URL                       |

Creation requires a supported ready **owned** source, even if read grants permit discovery. The API enforces current JWT epoch/organization/access and existing version/transaction/idempotency rules. The adapter cannot upload files, execute arbitrary SQL, publish, share or delete. `confirmSave=true` is an explicit input requirement, not proof of human consent: the MCP host must obtain approval. Aggregate rows are capped at240 per block with `totalRows`/`truncated`; SQL and source samples are excluded.

```sh
npm --prefix mcp-server test
```

Optional integration (synthetic data on the owned local QA supervisor only): start `scripts/qa-enterprise-mysql.cjs`, then run `node mcp-server/scripts/verify-runtime.js`. The Codex host verifier accepts the resulting private evidence directory: `node mcp-server/scripts/verify-codex-host.js <owned-evidence-directory>`. For Claude Code with its existing login/default model, use `node mcp-server/scripts/verify-claude-host.js <owned-evidence-directory>`. It verifies actual tool events, separate preview/save permissions, DB counts and independent API readbacks. On macOS preserve USER/LOGNAME when spawning the host so keychain authentication resolves correctly. These commands use real AI and create private test artifacts; they are not ordinary unit tests or production maintenance scripts. Remove the owned credentials and stop the supervisor after validation.

See the [user guide](https://docs.vanillameta.net/mcp) for configuration and prompts. Remote HTTP MCP/OAuth is outside this first version; Claude Code 2.1.308 with observed default model claude-sonnet-5-5 passed the local six-tool host journey; its execution evidence is reported separately from Codex validation.
