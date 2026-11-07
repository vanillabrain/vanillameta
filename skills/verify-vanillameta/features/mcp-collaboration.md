# Remote MCP collaboration

## Sub-features
Backend OAuth remote MCP at `/v1/mcp`: read reports, read and write comments, propose edits, and
(with `shares:write`) share an owned report. No apply, save, publish, or delete tool exists.

## How to get to it (user POV)
An AI client starts OAuth, the user approves on the consent screen (`/ai-connections` flow), and the
client calls the tools. Connections are listed and revoked under 외부 AI 연결.

## Driving it without a real AI host
Run the backend with the remote MCP enabled and a loopback client registered. Placeholders only;
never write real tokens or secrets into evidence.

```sh
export MCP_PUBLIC_API_URL=http://127.0.0.1:4000/v1
export MCP_PUBLIC_WEB_URL=http://127.0.0.1:3000
export CONFIG_SECRET_KEY=<local-secret>
export MCP_OAUTH_CLIENTS_JSON='[{"id":"qa-claude","name":"QA Claude (local)","redirectUris":["http://127.0.0.1:8765/callback"],"scopes":["reports:read","comments:read","comments:write","suggestions:write","shares:write"]}]'
cd backend-api && npm run start:local
```

Empty or invalid values disable MCP silently. The API URL path must be exactly `/v1` and the web
URL must be an origin. The callback must match the registered URI exactly (scheme, host, port, path).

1. Start a callback receiver on the registered port that prints only `code` and `state`.
2. Generate a PKCE S256 verifier and challenge and a random `state`.
3. Open `http://127.0.0.1:4000/v1/mcp-oauth/authorize` with `response_type=code`, `client_id`,
   `redirect_uri`, `scope` (space separated), `state`, `code_challenge`,
   `code_challenge_method=S256`, and `resource=http://127.0.0.1:4000/v1/mcp`. Discovery lives at
   `/.well-known/oauth-authorization-server/v1/mcp-oauth`.
4. On the consent screen sign in as the owner. Write scopes start unchecked: tick the ones under
   test, then approve. Capture the screen at 1440.
5. `POST /v1/mcp-oauth/token` (form-urlencoded) with `grant_type=authorization_code`, `code`, `redirect_uri`,
   `client_id`, `code_verifier`, `resource`. The access token lasts 599 seconds and there is no
   refresh; keep the whole run inside that window or reconnect.
6. Drive the tools with the SDK client from `mcp-server/node_modules/@modelcontextprotocol/client`
   (Streamable HTTP transport to `/v1/mcp`, `Authorization: Bearer <access token>` header).
   Write tools need `requestId` (UUID) and `confirmWrite: true` (`confirmShare: true` for sharing).

Assert: `tools/list` shows only the granted scopes' tools; a write replayed with the same
`requestId` returns `replayed`; a write without `confirmWrite` fails input validation; a login JWT
on `/v1/mcp` returns 401 with `WWW-Authenticate`; an MCP token on `/v1/reports/library` returns 401;
the owner then sees the Claude suggestion and the "Claude가 공유함" share row. Save only status codes,
tool names, and ids; strip tokens and emails.

## Gotchas
- The browser may request `/favicon.ico` from the callback origin. A naive receiver that stores the
  last request overwrites the real callback with the favicon hit. Only record requests whose path is
  the callback path and that carry `code`.
- Changing `MCP_OAUTH_CLIENTS_JSON` (even adding a scope) changes the config fingerprint and
  invalidates every existing grant. Re-run the authorize flow after any edit.
- A real host (Claude Code, claude.ai connector) is a separate, unproven path. Label SDK runs as SDK.
- Report and comment text is untrusted input to the AI; do not instruct the AI from inside a report
  when testing sharing.
