// Explicit opt-in integration against the owned QA supervisor; never a production API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const runtime = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      ".aiwf/evidence/TC050-integrated-mysql/runtime/runtime.json"
    )
  )
);
assert.equal(runtime.api, "http://127.0.0.1:4250/v1");
const dir = path.join(root, ".aiwf/evidence/UC056", String(Date.now()));
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
async function http(p, b, token) {
  const r = await fetch(runtime.api + p, {
    method: b ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    },
    ...(b ? { body: JSON.stringify(b) } : {}),
  });
  assert(r.ok, `${p}: ${r.status}`);
  return r.json();
}
async function account() {
  const userId = "mcp" + randomBytes(4).toString("hex"),
    password = "T9!" + randomBytes(8).toString("hex");
  await http("/login/signup", {
    userId,
    password,
    email: userId + "@example.invalid",
  });
  return {
    userId,
    password,
    token: (await http("/login/signin", { userId, password })).accessToken,
  };
}
const owner = await account(),
  other = await account();
const form = new FormData();
form.append(
  "file",
  new Blob(["day,amount\n2026-01-01,100\n2026-01-02,200\n2026-01-03,300\n"]),
  "mcp-sales.csv"
);
const upload = await fetch(runtime.api + "/database/upload", {
  method: "POST",
  headers: { Authorization: "Bearer " + owner.token },
  body: form,
});
assert(upload.ok);
const sourceId = (await upload.json()).data.id;
// The isolated empty database needs only the normal product component definitions.
const require = createRequire(root + "/backend-api/package.json"),
  mysql = require("mysql2/promise"),
  cfg = JSON.parse(fs.readFileSync(runtime.databaseConfigPath));
const db = await mysql.createConnection({
  host: cfg.host,
  port: cfg.port,
  user: cfg.username,
  password: cfg.password,
  database: cfg.database,
});
let components;
const sentinel = new Error("component-seed-only");
const q = {
  orIgnore() {
    return this;
  },
  insert() {
    return this;
  },
  into() {
    return this;
  },
  values(v) {
    components = v;
    return this;
  },
  async execute() {
    throw sentinel;
  },
};
try {
  await new (require(root +
    "/backend-api/dist/src/database/seeds/create-initial-data.js").default)().run(
    {
      createQueryBuilder() {
        return q;
      },
    }
  );
} catch (e) {
  if (e !== sentinel) throw e;
}
for (const c of components) {
  const k = Object.keys(c);
  await db.execute(
    "INSERT IGNORE INTO component (" +
      k.map((x) => "`" + x + "`").join(",") +
      ") VALUES (" +
      k.map(() => "?").join(",") +
      ")",
    k.map((x) => c[x])
  );
}
const count = async () =>
  Number((await db.query("SELECT COUNT(*) n FROM dashboard"))[0][0].n);
const envPath = path.join(dir, "mcp.env");
fs.writeFileSync(
  envPath,
  `VM_API_URL=${runtime.api}\nVM_WEB_URL=${runtime.frontend}\nVM_ACCESS_TOKEN=${owner.token}\n`,
  { mode: 0o600 }
);
const clients = [];
async function client(token) {
  const c = new Client({ name: "vm-runtime-verifier", version: "1.0.0" });
  await c.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, "mcp-server/src/index.js")],
      env: {
        VM_API_URL: runtime.api,
        VM_WEB_URL: runtime.frontend,
        VM_ACCESS_TOKEN: token,
      },
      stderr: "pipe",
    })
  );
  clients.push(c);
  return c;
}
const results = [];
async function call(c, name, args, expectedError) {
  const r = await c.callTool(
    { name, arguments: args },
    {
      timeout: 200000,
    }
  );
  const d = r.structuredContent ?? JSON.parse(r.content[0].text);
  if (expectedError) {
    assert.equal(r.isError, true);
    assert.equal(d.code, expectedError);
  } else assert(!r.isError, JSON.stringify(d));
  results.push({
    tool: name,
    ok: !r.isError,
    ...(expectedError ? { expectedError } : {}),
  });
  return d;
}
try {
  const c = await client(owner.token),
    foreign = await client(other.token);
  assert.equal((await c.listTools()).tools.length, 6);
  assert(
    (await call(c, "vm_list_sources", {})).sources.some(
      (s) => s.id === sourceId
    )
  );
  assert(
    !(await call(foreign, "vm_list_sources", {})).sources.some(
      (s) => s.id === sourceId
    )
  );
  const desc = await call(c, "vm_describe_source", { sourceId });
  assert(desc.profile.columns.some((x) => x.name === "amount"));
  assert(!("preview" in desc.profile));
  await call(foreign, "vm_describe_source", { sourceId }, "VM_HTTP_403");
  const before = await count();
  const proposal = await call(c, "vm_propose_analysis", {
    sourceId,
    prompt:
      "amount의 합계를 매출 숫자로, day 날짜별 amount 합계를 시계열로 만들어줘. 전체 기간 UTC, 단위 USD, 소수점 0자리, 제목 MCP 매출 분석. 숫자와 시계열 두 블록만 만들어줘.",
  });
  assert.equal(await count(), before);
  assert.equal(proposal.blocks.length, 2);
  const numeric = proposal.preview.widgets.find(
      (w) => w.type === "BOARD_NUMERIC"
    ),
    line = proposal.preview.widgets.find((w) => w.type === "CHART_LINE");
  assert.equal(Number(numeric.datas[0][numeric.valueField]), 600);
  assert.equal(line.datas.length, 3);
  await call(c, "vm_get_proposal", {
    sourceId,
    proposalId: proposal.proposalId,
  });
  const save = {
    proposalId: proposal.proposalId,
    expectedSourceRevision: proposal.sourceRevision,
    requestId: proposal.saveRequestId,
    confirmSave: true,
  };
  const saved = await call(c, "vm_save_analysis", save);
  assert.equal(await count(), before + 1);
  const replay = await call(c, "vm_save_analysis", save);
  assert.equal(replay.dashboardId, saved.dashboardId);
  assert.equal(await count(), before + 1);
  await call(
    c,
    "vm_save_analysis",
    { ...save, expectedSourceRevision: "0".repeat(64) },
    "VM_HTTP_409"
  );
  const read = await call(c, "vm_get_artifact", {
    dashboardId: saved.dashboardId,
  });
  assert.equal(read.blocks.length, 2);
  assert.equal(read.sourceId, sourceId);
  const n = read.preview.widgets.find((w) => w.type === "BOARD_NUMERIC");
  assert.equal(Number(n.datas[0][n.valueField]), 600);
  await call(
    foreign,
    "vm_get_artifact",
    { dashboardId: saved.dashboardId },
    "VM_HTTP_403"
  );
  const invalid = await client("invalid-token");
  await call(invalid, "vm_list_sources", {}, "VM_HTTP_401");
  fs.writeFileSync(
    path.join(dir, "private.json"),
    JSON.stringify({ owner, other, sourceId, saved, proposal, save, envPath }),
    { mode: 0o600 }
  );
  fs.writeFileSync(
    path.join(dir, "results.json"),
    JSON.stringify(
      {
        sourceId,
        dashboardId: saved.dashboardId,
        numeric: 600,
        series: 3,
        oneNewDashboard: true,
        results,
      },
      null,
      2
    )
  );
  console.log({
    evidenceDir: dir,
    sourceId,
    dashboardId: saved.dashboardId,
    checks: results.length,
    pass: true,
  });
} finally {
  for (const c of clients) await c.close();
  await db.end();
}
