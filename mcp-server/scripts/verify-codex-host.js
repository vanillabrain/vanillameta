// Opt-in: uses the isolated fixture created by verify-runtime.js and the existing Codex login.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const dir = process.argv[2];
if (
  !dir ||
  !path.resolve(dir).startsWith(path.join(root, ".aiwf/evidence/UC056/"))
)
  throw Error("Owned UC056 fixture path required");
const fixture = JSON.parse(fs.readFileSync(path.join(dir, "private.json")));
const require = createRequire(root + "/backend-api/package.json");
const settings = require("dotenv").parse(
  fs.readFileSync(root + "/backend-api/.env.local")
);
const args = [
  "exec",
  "--ignore-user-config",
  "--ephemeral",
  "--skip-git-repo-check",
  "--approve-for-me",
  "--model",
  "gpt-6-luna",
  "-c",
  `mcp_servers.vanillameta.command=${JSON.stringify(process.execPath)}`,
  "-c",
  `mcp_servers.vanillameta.args=${JSON.stringify([
    "--env-file=" + fixture.envPath,
    root + "/mcp-server/src/index.js",
  ])}`,
  "-c",
  "mcp_servers.vanillameta.tool_timeout_sec=200",
];
for (const [key, name] of [
  ["AI_CODEX_BASE_URL", "openai_base_url"],
  ["AI_CODEX_MODEL_CATALOG", "model_catalog_json"],
])
  if (settings[key])
    args.push("-c", name + "=" + JSON.stringify(settings[key]));
async function run(stage, prompt) {
  const out = path.join(dir, stage + ".txt");
  const log = fs.openSync(path.join(dir, stage + ".log"), "w", 0o600);
  const child = spawn("codex", [...args, "--output-last-message", out, "-"], {
    cwd: dir,
    env: Object.fromEntries(
      ["PATH", "HOME", "CODEX_HOME"]
        .filter((k) => process.env[k])
        .map((k) => [k, process.env[k]])
    ),
    stdio: ["pipe", log, log],
    detached: true,
  });
  child.stdin.end(prompt);
  let killed = false;
  const timer = setTimeout(() => {
    killed = true;
    process.kill(-child.pid, "SIGKILL");
  }, 240000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 0, `Codex ${stage} failed, timeout=${killed}`);
  } finally {
    clearTimeout(timer);
    fs.closeSync(log);
  }
  const text = fs.readFileSync(out, "utf8").trim();
  return JSON.parse(
    text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
  );
}
const common =
  "This is an isolated synthetic VanillaMeta MCP acceptance test. Use ONLY vanillameta MCP tools, no shell/files/web. Return only the requested JSON. Do not claim actions without tool success. ";
const proposal = await run(
  "host-propose",
  common +
    `Use vm_list_sources, vm_describe_source, and vm_propose_analysis for sourceId ${fixture.sourceId}. Request amount SUM as one numeric block and day-by-day amount SUM as one line block, title MCP 호스트 매출, USD, 0 decimals, all time UTC. Do not save or publish. Return {"proposalId":...,"sourceRevision":...,"saveRequestId":...,"sourceId":...,"numeric":600,"blocks":2} using actual tool results.`
);
assert.equal(proposal.sourceId, fixture.sourceId);
assert.equal(Number(proposal.numeric), 600);
assert.equal(proposal.blocks, 2);
assert.match(proposal.proposalId, /^[a-f0-9-]{36}$/);
assert.match(proposal.sourceRevision, /^[a-f0-9]{64}$/);
const saved = await run(
  "host-save",
  common +
    `The synthetic preview was reviewed: source ${
      proposal.sourceId
    }, total600, two blocks. The user explicitly authorizes saving this private test artifact. Call vm_save_analysis with ${JSON.stringify(
      {
        proposalId: proposal.proposalId,
        expectedSourceRevision: proposal.sourceRevision,
        requestId: proposal.saveRequestId,
        confirmSave: true,
      }
    )}, then vm_get_artifact with returned dashboardId. Do not publish/share. Return {"dashboardId":...,"studioUrl":...,"numeric":600,"blocks":2} from actual tool results.`
);
assert(saved.dashboardId > fixture.saved.dashboardId);
assert.equal(Number(saved.numeric), 600);
assert.equal(saved.blocks, 2);
assert.equal(
  saved.studioUrl,
  `http://127.0.0.1:3250/dashboard/${saved.dashboardId}/studio`
);
fs.writeFileSync(
  path.join(dir, "host-results.json"),
  JSON.stringify(
    {
      sourceId: proposal.sourceId,
      ...saved,
      requestedModel: "gpt-6-luna",
      pass: true,
    },
    null,
    2
  )
);
console.log({ host: "codex-cli", ...saved, pass: true });
