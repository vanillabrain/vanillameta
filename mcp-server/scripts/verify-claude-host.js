// Opt-in real Claude Code host test; requires verify-runtime.js's owned fixture.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const dir = path.resolve(process.argv[2] ?? ".");
assert(
  dir.startsWith(path.join(root, ".aiwf/evidence/UC056/")),
  "Owned fixture required"
);
const fixture = JSON.parse(fs.readFileSync(path.join(dir, "private.json")));
const runtime = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".aiwf/evidence/TC050-integrated-mysql/runtime/runtime.json"
    )
  )
);
assert.equal(runtime.api, "http://127.0.0.1:4250/v1");
const require = createRequire(root + "/backend-api/package.json");
const cfg = JSON.parse(fs.readFileSync(runtime.databaseConfigPath));
const db = await require("mysql2/promise").createConnection({
  host: cfg.host,
  port: cfg.port,
  user: cfg.username,
  password: cfg.password,
  database: cfg.database,
});
let activeChild;
let interrupted = false;
function stopChild() {
  if (!activeChild) return;
  try {
    process.kill(-activeChild.pid, "SIGKILL");
  } catch (e) {
    if (e.code !== "ESRCH") throw e;
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    // A killed save may already have committed: retain logs and its original UUID.
    interrupted = true;
    process.exitCode = signal === "SIGINT" ? 130 : 143;
    stopChild();
  });
const count = async () =>
  Number((await db.query("SELECT COUNT(*) n FROM dashboard"))[0][0].n);
const config = JSON.stringify({
  mcpServers: {
    vanillameta: {
      type: "stdio",
      command: process.execPath,
      args: [
        "--env-file=" + fixture.envPath,
        root + "/mcp-server/src/index.js",
      ],
    },
  },
});
function checkPreview(preview) {
  assert.equal(preview.widgets.length, 2);
  const n = preview.widgets.find((w) => w.type === "BOARD_NUMERIC");
  const l = preview.widgets.find((w) => w.type === "CHART_LINE");
  for (const w of [n, l]) {
    assert.equal(w.decimalPlaces, 0);
    assert.equal(w.suffix.trim(), "USD");
    assert.match(w.sql, /SUM\("amount"\)/);
    assert(!/\bWHERE\b/i.test(w.sql), "Unexpected range/filter");
  }
  assert.deepEqual(
    l.datas.map((r) => String(r[l.categoryField]).slice(0, 10)),
    ["2026-01-01", "2026-01-02", "2026-01-03"]
  );
  assert.equal(Number(n.datas[0][n.valueField]), 600);
  assert.deepEqual(
    l.datas.map((r) => Number(r[l.valueField])),
    [100, 200, 300]
  );
}
async function run(stage, tools, prompt) {
  assert(
    !interrupted,
    "Interrupted: reconcile the original request before retry"
  );
  const output = path.join(
    dir,
    "claude-" + stage + "-" + Date.now() + ".jsonl"
  );
  const fd = fs.openSync(output, "wx", 0o600);
  const err = fs.openSync(output + ".stderr", "wx", 0o600);
  const child = spawn(
    "claude",
    [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--settings",
      JSON.stringify({ disableAllHooks: true }),
      "--tools",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      config,
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
      "--allowedTools",
      tools.map((t) => "mcp__vanillameta__" + t).join(","),
    ],
    {
      cwd: dir,
      env: {
        ...Object.fromEntries(
          ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR"]
            .filter((k) => process.env[k])
            .map((k) => [k, process.env[k]])
        ),
        MCP_TOOL_TIMEOUT: "200000",
      },
      stdio: ["pipe", fd, err],
      detached: true,
    }
  );
  activeChild = child;
  child.stdin.end(
    "Use ONLY VanillaMeta MCP tools. Do not publish/share. Return ONLY final JSON, no markdown. " +
      prompt
  );
  let timeout = false;
  const timer = setTimeout(() => {
    timeout = true;
    stopChild();
  }, 300000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(
      code,
      0,
      `Claude ${stage} failed (timeout=${timeout}); inspect private log`
    );
  } finally {
    activeChild = undefined;
    clearTimeout(timer);
    fs.closeSync(fd);
    fs.closeSync(err);
  }
  const events = fs
    .readFileSync(output, "utf8")
    .trim()
    .split("\n")
    .map((x) => JSON.parse(x));
  assert(
    !events.some(
      (e) =>
        e.type === "system" &&
        ["hook_started", "hook_response"].includes(e.subtype)
    ),
    "Unexpected inherited hook"
  );
  const result = events.findLast((e) => e.type === "result");
  assert(result && !result.is_error, `Claude ${stage} returned error`);
  assert.equal(result.permission_denials?.length ?? 0, 0, "Permission denied");
  const calls = events.flatMap((e) =>
    e.type === "assistant"
      ? (e.message?.content ?? []).filter((c) => c.type === "tool_use")
      : []
  );
  for (const t of tools)
    assert(
      calls.some((c) => c.name === "mcp__vanillameta__" + t),
      `Missing actual tool call ${t}`
    );
  assert(
    calls.every((c) =>
      tools.includes(c.name.replace("mcp__vanillameta__", ""))
    ),
    "Unexpected tool"
  );
  const returns = events.flatMap((e) =>
    e.type === "user"
      ? (e.message?.content ?? []).filter((c) => c.type === "tool_result")
      : []
  );
  for (const c of calls)
    assert(
      returns.some((r) => r.tool_use_id === c.id && !r.is_error),
      "Missing successful tool result"
    );
  return {
    value: JSON.parse(result.result),
    models: Object.keys(result.modelUsage ?? {}),
    calls: calls.map((c) => c.name),
    executions: calls.map((c) => ({
      name: c.name,
      input: c.input,
      result: JSON.parse(returns.find((r) => r.tool_use_id === c.id).content),
    })),
    sessionId: result.session_id,
  };
}
try {
  const before = await count();
  const proposed = await run(
    "propose",
    [
      "vm_list_sources",
      "vm_describe_source",
      "vm_propose_analysis",
      "vm_get_proposal",
    ],
    `Call vm_list_sources first (required even though the ID is known), then vm_describe_source for source ${fixture.sourceId}. Propose amount SUM numeric plus day-by-day amount SUM line, all-time UTC, USD, 0 decimals, title Claude MCP 매출. Exactly two blocks. Read it back using vm_get_proposal. DO NOT SAVE. Return {"sourceId":number,"proposalId":string,"sourceRevision":string,"saveRequestId":string,"numeric":number,"series":number,"blocks":number} from real results.`
  );
  assert.equal(await count(), before, "Proposal persisted a dashboard");
  const p = proposed.value;
  assert.equal(p.sourceId, fixture.sourceId);
  assert.equal(p.numeric, 600);
  assert.equal(p.series, 3);
  assert.equal(p.blocks, 2);
  assert.match(p.proposalId, /^[a-f0-9-]{36}$/);
  assert.match(p.sourceRevision, /^[a-f0-9]{64}$/);
  assert.match(p.saveRequestId, /^[a-f0-9-]{36}$/);
  // Independent authenticated readback validates the host's preview before approval.
  async function get(url) {
    const r = await fetch(runtime.api + url, {
      headers: { Authorization: "Bearer " + fixture.owner.token },
    });
    assert(r.ok);
    const body = await r.json();
    return body.status === "SUCCESS" ? body.data : body;
  }
  const preview = await get(
    "/studio/proposals/" + p.proposalId + "?sourceId=" + p.sourceId
  );
  fs.writeFileSync(
    path.join(dir, "claude-preview-readback.json"),
    JSON.stringify(preview),
    { mode: 0o600 }
  );
  assert.equal(preview.proposalId, p.proposalId);
  assert.equal(preview.sourceRevision, p.sourceRevision);
  checkPreview(preview.preview);
  for (const b of preview.semanticProposal) {
    assert.equal(b.metric.aggregation, "SUM");
    assert.equal(b.metric.column, "amount");
    assert.equal(b.metric.sourceId, p.sourceId);
    assert.equal(b.metric.unit, "USD");
    assert.equal(b.metric.decimalPlaces, 0);
    if (b.kind === "CHART_LINE") {
      assert.equal(b.dimension.column, "day");
      assert.equal(b.dimension.type, "DATE");
    }
  }
  const proposedResult = proposed.executions.find((e) =>
    e.name.endsWith("__vm_propose_analysis")
  ).result;
  assert.equal(proposedResult.proposalId, p.proposalId);
  assert.equal(proposedResult.sourceRevision, p.sourceRevision);
  assert.equal(proposedResult.saveRequestId, p.saveRequestId);
  const approvedSave = {
    proposalId: p.proposalId,
    expectedSourceRevision: p.sourceRevision,
    requestId: p.saveRequestId,
    confirmSave: true,
  };
  const saved = await run(
    "save",
    ["vm_save_analysis", "vm_get_artifact"],
    `This isolated synthetic preview has been reviewed: total600 USD, three days100/200/300, two blocks. The user authorizes this private test save in a separate step. Call vm_save_analysis with ${JSON.stringify(
      {
        proposalId: p.proposalId,
        expectedSourceRevision: p.sourceRevision,
        requestId: p.saveRequestId,
        confirmSave: true,
      }
    )}, then vm_get_artifact. Return {"dashboardId":number,"studioUrl":string,"numeric":number,"series":number,"blocks":number} from actual results.`
  );
  assert.equal(await count(), before + 1, "Expected exactly one new dashboard");
  const s = saved.value;
  const saveCalls = saved.executions.filter((e) =>
    e.name.endsWith("__vm_save_analysis")
  );
  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].input, approvedSave);
  assert.equal(s.dashboardId, saveCalls[0].result.dashboardId);
  assert.notEqual(s.dashboardId, fixture.saved.dashboardId);
  const artifactCalls = saved.executions.filter((e) =>
    e.name.endsWith("__vm_get_artifact")
  );
  for (const c of artifactCalls) {
    assert.deepEqual(c.input, { dashboardId: s.dashboardId });
    assert.equal(c.result.dashboardId, s.dashboardId);
    assert.equal(c.result.studioUrl, s.studioUrl);
  }
  assert.equal(s.numeric, 600);
  assert.equal(s.series, 3);
  assert.equal(s.blocks, 2);
  assert.equal(
    s.studioUrl,
    runtime.frontend + "/dashboard/" + s.dashboardId + "/studio"
  );
  const read = await get("/studio/dashboards/" + s.dashboardId);
  assert.equal(read.document.sourceId, p.sourceId);
  assert.equal(read.document.blocks.length, 2);
  checkPreview(read.preview);
  assert.equal(read.document.dashboardId, s.dashboardId);
  for (const b of read.document.blocks) {
    const original = preview.semanticProposal.find((x) => x.kind === b.kind);
    assert.deepEqual(b.measureRefs, [
      {
        id: original.metric.id,
        definitionVersion: String(original.metric.definitionVersion),
      },
    ]);
    if (b.kind === "CHART_LINE") assert.equal(b.dimensionRefs[0].key, "day");
  }
  fs.writeFileSync(
    path.join(dir, "claude-saved-readback.json"),
    JSON.stringify(read),
    { mode: 0o600 }
  );
  const result = {
    ...s,
    sourceId: p.sourceId,
    models: [...new Set([...proposed.models, ...saved.models])],
    calls: [...proposed.calls, ...saved.calls],
    proposalWrites: 0,
    saveWrites: 1,
    pass: true,
  };
  fs.writeFileSync(
    path.join(dir, "claude-results.json"),
    JSON.stringify(result, null, 2)
  );
  console.log(result);
} finally {
  await db.end();
}
