import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";
const config = {
  apiUrl: "http://127.0.0.1:4000/v1",
  webUrl: "http://127.0.0.1:3000",
  token: "user-token",
  timeoutMs: 1000,
};
const uuid = "11111111-1111-4111-8111-111111111111",
  hash = "a".repeat(64);
async function connect(t, fetcher) {
  const [c, s] = InMemoryTransport.createLinkedPair();
  const server = createServer(config, fetcher),
    client = new Client({ name: "vm-test", version: "1.0.0" });
  await server.connect(s);
  await client.connect(c);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}
const data = (r) => r.structuredContent ?? JSON.parse(r.content[0].text);
test("MCP discovery has six bounded tools with approval and correct write hints", async (t) => {
  const c = await connect(t, async () => Response.json([]));
  const { tools } = await c.listTools();
  assert.equal(tools.length, 6);
  assert(!tools.some((x) => /publish|sql|upload|login/.test(x.name)));
  const save = tools.find((x) => x.name === "vm_save_analysis");
  assert.equal(save.annotations.readOnlyHint, false);
  assert.equal(save.annotations.idempotentHint, true);
  assert.equal(
    tools.find((x) => x.name === "vm_propose_analysis").annotations
      .idempotentHint,
    false
  );
});
test("schema and metric discovery project away source samples, credentials and paths", async (t) => {
  const c = await connect(t, async (url) =>
    Response.json(
      url.includes("/profile")
        ? {
            sourceId: 1,
            supported: true,
            columns: [{ name: "day", type: "DATE" }],
            preview: [{ secret: "RAW_ROWS" }],
            connectionConfig: "PRIVATE_PATH",
          }
        : []
    )
  );
  const r = await c.callTool({
    name: "vm_describe_source",
    arguments: { sourceId: 1 },
  });
  assert.equal(data(r).profile.columns[0].name, "day");
  assert(!JSON.stringify(r).includes("RAW_ROWS"));
  assert(!JSON.stringify(r).includes("PRIVATE_PATH"));
});
test("proposal retains aggregate results and review handles but excludes SQL and raw samples", async (t) => {
  const c = await connect(t, async () =>
    Response.json({
      proposalId: uuid,
      sourceId: 1,
      sourceRevision: hash,
      title: "Sales",
      profile: { preview: [{ x: "RAW" }] },
      semanticProposal: [
        {
          title: "Revenue",
          kind: "BOARD_NUMERIC",
          metric: { label: "Revenue", aggregation: "SUM", column: "amount" },
        },
      ],
      preview: {
        queries: [{ sql: "SECRET_SQL" }],
        widgets: [
          {
            type: "BOARD_NUMERIC",
            valueField: "v",
            datas: [{ v: "600", internal: "SECRET" }],
          },
        ],
      },
    })
  );
  const r = await c.callTool({
      name: "vm_propose_analysis",
      arguments: { sourceId: 1, prompt: "sum amount" },
    }),
    d = data(r);
  assert.equal(d.persisted, false);
  assert.equal(d.preview.widgets[0].datas[0].v, "600");
  assert.match(d.saveRequestId, /^[a-f0-9-]{36}$/);
  assert(!JSON.stringify(r).includes("SECRET"));
  assert(!JSON.stringify(r).includes("RAW"));
});
test("save requires explicit confirmation, forbids extra inputs and forwards same exact retry key", async (t) => {
  const calls = [];
  const c = await connect(t, async (url, o) => {
    calls.push({ url, body: JSON.parse(o.body) });
    return Response.json({
      dashboardId: 12,
      document: {
        dashboardId: 12,
        sourceId: 1,
        title: "Sales",
        revision: hash,
        blocks: [],
      },
    });
  });
  const args = {
    proposalId: uuid,
    expectedSourceRevision: hash,
    requestId: uuid,
  };
  for (const bad of [
    args,
    { ...args, confirmSave: false },
    { ...args, confirmSave: true, sql: "DROP TABLE x" },
  ]) {
    const r = await c.callTool({ name: "vm_save_analysis", arguments: bad });
    assert.equal(r.isError, true);
  }
  assert.equal(calls.length, 0);
  for (let i = 0; i < 2; i++) {
    const r = await c.callTool({
      name: "vm_save_analysis",
      arguments: { ...args, confirmSave: true },
    });
    assert.equal(
      data(r).studioUrl,
      "http://127.0.0.1:3000/dashboard/12/studio"
    );
    assert.equal(data(r).publicationChanged, false);
  }
  assert.deepEqual(calls[0].body, args);
  assert.deepEqual(calls[0], calls[1]);
});
test("401/403/409 and server failures do not disclose raw messages or retry automatically", async (t) => {
  for (const status of [401, 403, 409, 500]) {
    let n = 0;
    const c = await connect(t, async () => {
      n++;
      return new Response("user-token SECRET_SQL", { status });
    });
    const r = await c.callTool({
      name: "vm_get_artifact",
      arguments: { dashboardId: 1 },
    });
    assert.equal(r.isError, true);
    assert.equal(data(r).code, `VM_HTTP_${status}`);
    assert(!JSON.stringify(r).includes("SECRET_SQL"));
    assert.equal(n, 1);
  }
});
test("lost save response preserves the exact retry payload without a hidden second write", async (t) => {
  let n = 0;
  const bodies = [];
  const c = await connect(t, async (_url, o) => {
    bodies.push(o.body);
    if (++n === 1) throw Error("network private diagnostic");
    return Response.json({
      dashboardId: 9,
      document: {
        dashboardId: 9,
        sourceId: 1,
        title: "Sales",
        revision: hash,
        blocks: [],
      },
    });
  });
  const args = {
    proposalId: uuid,
    requestId: uuid,
    expectedSourceRevision: hash,
    confirmSave: true,
  };
  const failed = await c.callTool({
    name: "vm_save_analysis",
    arguments: args,
  });
  assert.equal(failed.isError, true);
  assert.match(data(failed).hint, /unknown/);
  assert.equal(n, 1);
  const saved = await c.callTool({ name: "vm_save_analysis", arguments: args });
  assert.equal(data(saved).dashboardId, 9);
  assert.equal(bodies[0], bodies[1]);
});
test("cancellation from MCP propagates into the pending upstream call", async (t) => {
  let aborted = false,
    started;
  const ready = new Promise((r) => (started = r));
  const c = await connect(t, async (_url, { signal }) => {
    started();
    return new Promise((_r, j) =>
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          j(signal.reason);
        },
        { once: true }
      )
    );
  });
  const cancel = new AbortController();
  const call = c.callTool(
    { name: "vm_list_sources", arguments: {} },
    { signal: cancel.signal }
  );
  await ready;
  cancel.abort();
  await assert.rejects(call);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(aborted, true);
});
