# Mock OpenAI-compatible provider (`mock-openai-provider.mjs`)

A dependency-free stand-in for the chat-completions API, used to run VanillaMeta's Studio AI flows
end to end against the production-configured stack without a real model. It answers
`POST /v1/chat/completions` in OpenAI format, recognises the feature from the system prompt, and
records each call. It is a contract fixture, not a model: its answers are fixed templates.

## Start

```sh
# plain node (the default address is 127.0.0.1:4310)
node backend-api/scripts/mock-openai-provider.mjs

# another port, or a bind address reachable from other containers
MOCK_PORT=4310 MOCK_HOST=0.0.0.0 node backend-api/scripts/mock-openai-provider.mjs
```

Environment: `MOCK_PORT` (default `4310`), `MOCK_HOST` (default `127.0.0.1`).

## Point the stack at it

```sh
AI_PROVIDER=openai
AI_API_BASE_URL=http://<mock-host>:<mock-port>/v1
AI_MODEL=mock-model
AI_API_KEY=anything
AI_GLOBAL_MONTHLY_TOKENS=1000000   # required whenever AI is configured
```

`AI_PROVIDER=openai` with a non-OpenAI `AI_API_BASE_URL` resolves to the openai-compatible adapter
(`backend-api/src/ai/providers/ai-config.ts`). `AI_PROVIDER=openai-compatible` works the same way.

## Egress guard: where the mock must run

`deploy/egress-guard.sh` runs on the VM and filters traffic leaving the api container's subnet
`172.29.40.0/24` (the compose network `vanillameta-egress`). It returns traffic inside that subnet
and drops destinations in `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16` and similar. So:

- a mock on the host loopback or any other private address is **unreachable** from the api;
- a mock on a public address works;
- the simplest option is a container on the egress network, at a fixed address inside the subnet.

Run the mock as a container on the egress network (`node:24-alpine`, script mounted read-only):

```sh
docker run --rm --name vm-mock-provider \
  --network vanillameta-egress --ip 172.29.40.50 \
  -e MOCK_HOST=0.0.0.0 -e MOCK_PORT=4310 \
  -v "$PWD/backend-api/scripts:/mock:ro" \
  node:24-alpine node /mock/mock-openai-provider.mjs
```

Then set `AI_API_BASE_URL=http://172.29.40.50:4310/v1` for the api. `MOCK_HOST=0.0.0.0` is required
inside a container: the default `127.0.0.1` is not reachable from other containers. The network exists
once the compose stack is up (`docker compose -f deploy/docker-compose.prod.yml up -d`).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/chat/completions` | The provider endpoint. Rejects `stream: true`. |
| GET | `/health` | `{status, mode, modes}` |
| POST | `/__control` | Switch behaviour. Every field optional; a bad field changes nothing. |
| GET | `/__calls` | Recorded calls, newest last (at most 1000 kept). |

`/__control` body: `mode`, `delayMs` (0..600000), `stallMs` (0..600000), `status` (400..599),
`usageTokens` (null or an integer: replaces `completion_tokens`, null means chars/4), `slowCalls`
(for `slow-then-ok`, default 1), `clearCalls: true`. Example:

```sh
curl -s -X POST http://127.0.0.1:4310/__control -H 'Content-Type: application/json' \
  -d '{"mode":"delay","delayMs":4000}'
```

Each `/__calls` entry: `timestamp`, `feature` (`studio-run`, `studio-creation`, `text-to-sql`,
`chart-recommendation`, `dashboard-insight`, or `unknown`), `model`, `mode`, `jsonMode`,
`messageSizes` (system, user, message count), `status`, `finishReason`, `delayedMs`, `aborted`,
`durationMs`. `aborted: true` means the client closed the connection before the response ended.

## Modes

| Mode | Behaviour |
| --- | --- |
| `normal` | Valid answers that pass the backend validators (see below). Usage included. |
| `delay` | Answers normally after `delayMs`. Also the way to test progress UI and client aborts. |
| `stall-silent` | Holds the request for `stallMs`, then answers 504. |
| `http-error` | Answers `status` (default 503) at once with a JSON error body. |
| `bad-json` | Content that is not JSON. |
| `truncated` | Half the answer, `finish_reason: "length"`. |
| `no-usage` | Omits `usage`. |
| `slow-then-ok` | The first `slowCalls` requests wait `delayMs`, then answers normally. |

The default mode is `normal`; the default `delayMs` is 3000, `stallMs` 120000, `status` 503.

## Normal answers

Recognised by a distinctive fragment of the backend system prompt:

- **studio-run** (`You help edit a dashboard.`, `StudioRunService.propose`). The user message is JSON
  with `prompt`, `selectedBlockId`, `preview`. A title request (`제목`, `바꿔`, `변경`, `수정`, `이름`)
  with a selected block gives `intent: "edit"` and one `updateBlock` with `patch: {title}`, the new title
  taken from a quoted string. A title request without a selection or without a title gives `clarify`.
  Persistence words (`저장`, `게시`, `공유`, `삭제`, `추가`, `생성` and similar) give `unsupported`.
  Anything else is `ask`: the answer quotes the sum of the selected block's preview values, with its
  prefix and suffix, and no operation.
- **studio-creation** (`Propose semantic dashboard blocks for the analysis requested by the user prompt.`,
  `StudioCreationService.proposeOnce`). It reads the source `columns` from the user JSON and returns
  `requiredFields`, `title` and 2 to 3 blocks: a `SUM` of the main numeric column, a `COUNT` (`건수`),
  and a `CHART_LINE` over the first date column or a `CHART_BAR` over the first category column. Every
  block declares `presentation: "visual"`. Requested columns (backtick-quoted in the prompt) that the
  source lacks give a `missingColumns` clarification, never a substitute metric. Selected catalog metrics
  become reference blocks, and `refundDenominator` gives a `RATIO_SUM` refund-rate block.
- **text-to-sql** (`You are a SQL query generator for a BI tool.`): one `SELECT ... LIMIT 1000` over the
  table in the schema text, a `SUM` of its first numeric column, or `COUNT(*)`.
- **chart-recommendation** (`You are a data visualization expert for a BI tool.`): `{"type", "reason"}`
  with a type from the registered list in the prompt (a line for a date field, a bar otherwise).
- **dashboard-insight** (`You are a BI analyst.`): 3 to 6 `- ` bullets and a closing `총평:` line.

Any other system prompt returns `{"error":"mock-provider: unrecognised feature"}`, which the backend
rejects, so an unexpected feature fails loudly.

## Verification

`backend-api/src/dashboard-studio/mock-provider-contract.spec.ts` loads this file in-process (no server,
no spawn). It runs the normal `studio-run` answers through the real `StudioRunService.propose` and
applies the operation with the real Studio document validator, runs the creation blocks through the real
`StudioCreationService` key, field and `validateBlock` checks, and checks the older features (the
text-to-sql answer through `assertReadOnlyQuery`). The spec loader rewrites the file's import and export
lines to CommonJS with a regex, so the file must keep to plain `import`/`export` statements of node
builtins; a new construct makes the spec fail to load rather than pass silently.
