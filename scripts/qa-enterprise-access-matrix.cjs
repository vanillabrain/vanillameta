#!/usr/bin/env node
// TC050 M01-M08: real HTTP on a fresh, owned local MySQL runtime. No AI calls.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const evidence = path.join(
  root,
  ".aiwf/evidence/TC050-access-matrix",
  randomUUID()
);
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const journal = [],
  checks = [],
  secrets = [];
const actors = {};
let db, runtime, config;
const hash = (v) => createHash("sha256").update(v).digest("hex");
const clean = (text) =>
  secrets
    .reduce((s, v) => s.split(v).join("[REDACTED]"), String(text))
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED_TOKEN]"
    );
const write = (file, data) =>
  fs.writeFileSync(
    path.join(evidence, file),
    clean(JSON.stringify(data, null, 2)) + "\n",
    { mode: 0o600 }
  );
const dataOf = (body) => (body?.status === "SUCCESS" ? body.data : body);
async function call(
  who,
  route,
  body,
  method = body === undefined ? "GET" : "POST",
  expected
) {
  const actor = actors[who];
  const res = await fetch(runtime.api + route, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(actor?.token ? { Authorization: "Bearer " + actor.token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text;
  }
  journal.push({
    who,
    method,
    route,
    status: res.status,
    expected: expected ?? "2xx",
  });
  write("http.json", journal);
  if (expected !== undefined)
    assert.equal(
      res.status,
      expected,
      `${who} ${method} ${route}: ${clean(text).slice(0, 600)}`
    );
  else
    assert(
      res.ok,
      `${who} ${method} ${route}: ${res.status} ${clean(text).slice(0, 600)}`
    );
  return dataOf(value);
}
function check(name, value = true) {
  assert(value, name);
  checks.push(name);
  write("checks.json", checks);
}
async function initialize() {
  const supplied =
    process.argv[2] ||
    path.join(
      root,
      ".aiwf/evidence/TC050-integrated-mysql/runtime/runtime.json"
    );
  runtime = JSON.parse(fs.readFileSync(supplied));
  assert.equal(runtime.status, "ready");
  assert.equal(runtime.api, "http://127.0.0.1:4250/v1");
  const runRoot = fs.realpathSync(runtime.runRoot);
  assert(path.basename(runRoot).startsWith("vm-enterprise-qa-"));
  assert.equal(
    fs.realpathSync(runtime.databaseConfigPath),
    path.join(runRoot, "database-config.json")
  );
  config = JSON.parse(fs.readFileSync(runtime.databaseConfigPath));
  secrets.push(config.password, runtime.controlToken);
  assert.equal(config.gate, "owned-enterprise-http-mysql-v1");
  assert.match(config.owner, /^[0-9a-f]{24}$/);
  assert.equal(
    fs.readFileSync(path.join(runRoot, "owner"), "utf8"),
    config.owner
  );
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.database, "vm_enterprise_" + config.owner);
  const inspect = JSON.parse(
    execFileSync("docker", ["inspect", config.containerId], {
      encoding: "utf8",
    })
  )[0];
  assert.equal(
    inspect.Config.Labels["vanillameta.enterprise.qa.owner"],
    config.owner
  );
  assert.equal(inspect.Name, "/" + config.containerName);
  assert(
    inspect.NetworkSettings.Ports["3306/tcp"].some(
      (b) => b.HostIp === "127.0.0.1" && Number(b.HostPort) === config.port
    )
  );
  const mysql = createRequire(path.join(root, "backend-api/package.json"))(
    "mysql2/promise"
  );
  db = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
  });
  const pid = runtime.processes["backend-4250"];
  assert(Number.isSafeInteger(pid) && pid > 0);
  const listeners = execFileSync(
    "/usr/sbin/lsof",
    ["-nP", "-iTCP:4250", "-sTCP:LISTEN", "-t"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  assert.deepEqual(
    [...new Set(listeners)],
    [pid],
    "HTTP listener must be the owned API PID"
  );
  const parent = execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  assert.equal(Number(parent), runtime.processes.supervisor);
  // Read only in memory: never log the API environment or its credentials.
  const env = execFileSync(
    "/bin/ps",
    ["eww", "-p", String(pid), "-o", "command="],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  for (const [key, value] of Object.entries({
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_USERNAME: config.username,
    DB_PASSWORD: config.password,
    DB_NAME: config.database,
    FILE_UPLOAD_DIR: path.join(runtime.runRoot, "uploads"),
  })) {
    assert(
      env.split(/\s+/).includes(key + "=" + value),
      "API environment must match owned " + key
    );
  }
  const [[owner]] = await db.query("SELECT token FROM qa_runtime_owner");
  assert.equal(owner.token, config.owner);
  const [[server]] = await db.query(
    "SELECT VERSION() AS version, @@server_uuid AS uuid"
  );
  assert.equal(server.version, "8.4.11");
  assert.equal(server.uuid, config.serverUuid);
  write("environment.json", {
    engine: server.version,
    owner: config.owner,
    serverUuid: server.uuid,
    api: runtime.api,
    modelCalls: 0,
    schema: "fresh development synchronize, not production migration",
  });
}
async function account(name) {
  const userId = "m" + randomBytes(5).toString("hex"),
    password = "T1!" + randomBytes(6).toString("hex");
  secrets.push(password);
  await call("anonymous", "/login/signup", {
    userId,
    password,
    email: userId + "@example.invalid",
  });
  const session = await call("anonymous", "/login/signin", {
    userId,
    password,
  });
  const token = session.accessToken;
  assert.equal(typeof token, "string");
  secrets.push(token);
  actors[name] = { userId, password, token };
}
async function relogin(who) {
  const actor = actors[who],
    result = await call("anonymous", "/login/signin", {
      userId: actor.userId,
      password: actor.password,
    });
  actor.token = result.accessToken;
  secrets.push(actor.token);
}
async function add(who, role = "member") {
  const context = await call("owner", "/enterprise/context");
  const consent = await call(who, "/enterprise/enrollment", {
    organizationId: context.organization.id,
  });
  await call("owner", "/enterprise/members", {
    userId: actors[who].userId,
    team: "QA",
    role,
    expectedVersion: context.organization.version,
    enrollmentCode: consent.enrollmentCode,
  });
  actors[who].id = (await call(who, "/enterprise/context")).membership.userId;
}
async function upload(who, multiplier = 1) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([
      `region,amount,day\nA,${100 * multiplier},2026-01-01\nB,${
        200 * multiplier
      },2026-01-02\nA,${300 * multiplier},2026-01-03\n`,
    ]),
    "matrix.csv"
  );
  const res = await fetch(runtime.api + "/database/upload", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: "Bearer " + actors[who].token },
    body: form,
  });
  const body = await res.json();
  journal.push({
    who,
    method: "POST",
    route: "/database/upload",
    status: res.status,
  });
  write("http.json", journal);
  assert(res.ok, "upload");
  return body.data.id;
}
const rights = (read = false, edit = false, publish = false, exp = false) => ({
  read,
  edit,
  publish,
  export: exp,
});
const versions = new Map();
async function grant(kind, id, who, value) {
  const key = [kind, id, who].join(":");
  const result = await call(
    "owner",
    `/enterprise/resources/${kind}/${id}/policies`,
    {
      recipientId: actors[who].id,
      expectedVersion: versions.get(key) ?? 0,
      rights: value,
    }
  );
  versions.set(key, result.version);
  return result;
}
async function snapshotCounts() {
  const [rows] = await db.query("SHOW TABLES");
  const names = rows.map((r) => Object.values(r)[0]);
  const counts = {};
  for (const table of [
    "dashboard",
    "widget",
    "dataset",
    "metric",
    "studio_state",
    "studio_run",
    "export_job",
    "enterprise_resource_grant",
    "enterprise_dashboard_delivery",
    "database",
    "user_mapping",
    "dashboard_widget",
    "export_part",
  ]) {
    assert(names.includes(table), "expected table: " + table);
    const [rows] = await db.query("SELECT * FROM `" + table + "`");
    counts[table] = {
      count: rows.length,
      hash: hash(JSON.stringify(rows.map((row) => JSON.stringify(row)).sort())),
    };
  }
  return counts;
}
async function deny(
  who,
  route,
  body,
  method = body === undefined ? "GET" : "POST",
  code = 403
) {
  const before = await snapshotCounts();
  await call(who, route, body, method, code);
  assert.deepEqual(
    await snapshotCounts(),
    before,
    "denied request cannot create rows: " + route
  );
}
const stable = (doc) =>
  JSON.parse(
    JSON.stringify(doc, (k, v) =>
      ["queriedAt", "permissions"].includes(k) ? undefined : v
    )
  );
async function run() {
  await initialize();
  for (const who of [
    "owner",
    "admin",
    "reader",
    "editor",
    "publisher",
    "exporter",
    "none",
    "ownmember",
    "outsider",
  ])
    await account(who);
  await call("owner", "/enterprise/organizations", {
    name: "Synthetic HTTP Matrix",
  });
  for (const who of [
    "admin",
    "reader",
    "editor",
    "publisher",
    "exporter",
    "none",
    "ownmember",
  ])
    await add(who, who === "admin" ? "admin" : "member");
  actors.owner.id = (
    await call("owner", "/enterprise/context")
  ).membership.userId;
  await call("outsider", "/enterprise/organizations", {
    name: "Separate Matrix",
  });
  const components = await call("owner", "/component");
  const missing = ["BOARD_NUMERIC", "CHART_LINE"].filter(
    (type) => !components.some((c) => (c.type ?? c.componentType) === type)
  );
  if (missing.length)
    await call(
      "owner",
      "/component/seed",
      missing.map((type) => ({ type, title: type, option: "{}", useYn: "Y" }))
    );
  await call("owner", "/database/execute", {
    id: await upload("owner"),
    query: "SELECT 1",
  });
  const sourceId = await upload("owner"),
    ownSourceId = await upload("ownmember", 2);
  const draft = {
    databaseId: sourceId,
    title: "Matrix Revenue",
    explanation: "Synthetic data, all time",
    widgets: [
      {
        title: "Revenue",
        description: "",
        type: "BOARD_NUMERIC",
        sql: "SELECT SUM(amount) AS value FROM source",
        valueField: "value",
        decimalPlaces: 0,
      },
    ],
  };
  const metricBody = {
    sourceId,
    label: "Matrix Revenue",
    aggregation: "SUM",
    column: "amount",
    unit: "",
    decimalPlaces: 0,
    numberNotation: "plain",
  };
  const metric = await call("owner", "/bi/metrics", metricBody);
  const saved = await call("owner", "/bi/dashboards", {
    sourceId,
    metricId: metric.id,
    chart: "number",
    title: "Matrix Revenue",
    expectedSourceRevision: (
      await call("owner", `/bi/sources/${sourceId}/profile`)
    ).dataVersion,
  });
  const dashboardId = saved.dashboardId ?? saved.id;
  assert(Number.isSafeInteger(dashboardId), JSON.stringify(saved));
  const own = await call("ownmember", "/ai/dashboard-save", {
    draft: { ...draft, databaseId: ownSourceId, title: "Independent Member" },
  });
  const ownDashboardId = own.dashboardId ?? own.id;
  let ownBefore = stable(
    (await call("ownmember", "/studio/dashboards/" + ownDashboardId)).document
  );
  const base = await call("owner", "/studio/dashboards/" + dashboardId);
  const catalog = await call("owner", "/bi/explore/catalog", { sourceId });
  const query = {
    sourceId,
    sourceRevision: catalog.sourceRevision ?? catalog.dataVersion,
    measureIds: [metric.id],
    dimensionColumns: ["region"],
    filters: [],
    includeRows: false,
    comparePrevious: false,
    rankingMeasureId: metric.id,
    trendGrain: "day",
  };
  const pivotQuery = {
    sourceId,
    sourceRevision: query.sourceRevision,
    measureIds: query.measureIds,
    rowDimensions: ["region"],
    columnDimensions: [],
    filters: [],
  };
  const preview = {
    document: base.document,
    expectedRevision: base.document.revision,
    expectedSourceRevision: base.sourceRevision,
  };
  const publication = {
    requestId: randomUUID(),
    expectedRevision: base.document.revision,
    visibility: "private",
    allowRemix: false,
  };
  const paths = [
    `/bi/sources/${sourceId}/profile`,
    `/bi/metrics?sourceId=${sourceId}`,
    `/dashboard/${dashboardId}`,
    `/studio/dashboards/${dashboardId}`,
    `/enterprise/resources/dashboard/${dashboardId}/access`,
  ];
  for (const who of ["admin", "none", "outsider", "anonymous"]) {
    for (const route of paths)
      await deny(who, route, undefined, "GET", who === "anonymous" ? 401 : 403);
    await deny(
      who,
      "/bi/explore/query",
      query,
      "POST",
      who === "anonymous" ? 401 : 403
    );
    await deny(
      who,
      "/bi/explore/pivot",
      pivotQuery,
      "POST",
      who === "anonymous" ? 401 : 403
    );
    if (who !== "anonymous")
      assert(
        !(await call(who, "/dashboard")).some((e) => e.id === dashboardId),
        "ungranted dashboard omitted"
      );
    const listed = await call(
      who === "anonymous" ? "none" : who,
      "/bi/sources"
    );
    assert(!listed.some((e) => e.id === sourceId), "ungranted source omitted");
    for (const kind of ["source", "dashboard"])
      await deny(
        who,
        `/enterprise/resources/${kind}/${
          kind === "source" ? sourceId : dashboardId
        }/policies`,
        undefined,
        "GET",
        who === "anonymous" ? 401 : 403
      );
  }
  await deny(
    "admin",
    `/enterprise/resources/dashboard/${dashboardId}/policies`,
    { recipientId: actors.none.id, expectedVersion: 0, rights: rights(true) }
  );
  await call("owner", `/database/info/${sourceId}`);
  for (const who of ["reader", "editor", "publisher", "exporter"]) {
    await grant(
      "source",
      sourceId,
      who,
      rights(true, who === "editor", false, who === "exporter")
    );
    const expected = rights(
      true,
      who === "editor",
      who === "publisher",
      who === "exporter"
    );
    await grant("dashboard", dashboardId, who, expected);
    const capability = await call(
      who,
      `/enterprise/resources/dashboard/${dashboardId}/access`
    );
    assert.deepEqual(capability.rights, expected);
    for (const route of paths) await call(who, route);
    await deny(who, `/database/info/${sourceId}`);
    await deny(who, "/database/execute", { id: sourceId, query: "SELECT 1" });
    await deny(who, `/enterprise/resources/dashboard/${dashboardId}/policies`, {
      recipientId: actors.none.id,
      expectedVersion: 0,
      rights: rights(true),
    });
    await call(who, "/bi/explore/query", query);
    await call(who, "/bi/explore/pivot", pivotQuery);
    if (who === "editor") {
      await call(who, "/bi/metrics", {
        ...metricBody,
        label: "Editor permitted metric",
      });
      await call(who, `/studio/dashboards/${dashboardId}/preview`, preview);
    } else {
      await deny(who, "/bi/metrics", { ...metricBody, label: "Denied metric" });
      await deny(who, `/studio/dashboards/${dashboardId}/preview`, preview);
      await deny(who, `/studio/dashboards/${dashboardId}/save`, {
        ...preview,
        requestId: randomUUID(),
      });
    }
    if (who === "publisher") {
      await call(
        who,
        `/studio/dashboards/${dashboardId}/publications`,
        publication
      );
      await call(who, `/studio/dashboards/${dashboardId}/publications`);
    } else
      await deny(
        who,
        `/studio/dashboards/${dashboardId}/publications`,
        publication
      );
    if (who === "exporter")
      await call(who, "/bi/explore/export", { mode: "explore", query });
    else await deny(who, "/bi/explore/export", { mode: "explore", query });
    await deny(who, "/ai/dashboard-save", { draft });
  }
  check("M01-M02: ownership/roles/actions and owner-only boundaries");
  const memberState = await call(
    "ownmember",
    "/studio/dashboards/" + ownDashboardId
  );
  const memberPreview = {
    document: memberState.document,
    expectedRevision: memberState.document.revision,
    expectedSourceRevision: memberState.sourceRevision,
  };
  await call(
    "ownmember",
    `/studio/dashboards/${ownDashboardId}/preview`,
    memberPreview
  );
  await call("ownmember", `/studio/dashboards/${ownDashboardId}/save`, {
    ...memberPreview,
    requestId: randomUUID(),
  });
  const memberAfter = await call(
    "ownmember",
    "/studio/dashboards/" + ownDashboardId
  );
  await call("ownmember", `/studio/dashboards/${ownDashboardId}/publications`, {
    requestId: randomUUID(),
    expectedRevision: memberAfter.document.revision,
    visibility: "private",
    allowRemix: false,
  });
  ownBefore = stable(memberAfter.document);
  const ownerPolicy = `/enterprise/resources/dashboard/${ownDashboardId}/policies`;
  await call("ownmember", "/studio/dashboards/" + ownDashboardId);
  await deny("ownmember", ownerPolicy);
  // A real successful editor save proves the same request body denied above is meaningful.
  const editorSaved = await call(
    "editor",
    `/studio/dashboards/${dashboardId}/save`,
    { ...preview, requestId: randomUUID() }
  );
  check("editor existing-dashboard save succeeds", !!editorSaved);
  const afterEdit = await call("owner", "/studio/dashboards/" + dashboardId);
  const preserved = stable(afterEdit.document);
  await grant("source", sourceId, "reader", rights());
  await deny("reader", `/studio/dashboards/${dashboardId}`);
  await grant("source", sourceId, "reader", rights(true));
  await grant("dashboard", dashboardId, "reader", rights());
  await call("reader", `/bi/sources/${sourceId}/profile`);
  await deny("reader", `/studio/dashboards/${dashboardId}`);
  check("M03: source and dashboard rights are independent");
  // Dynamic union: a direct revoke must retain group read, then membership loss removes it.
  const group = await call("owner", "/enterprise/groups", {
    name: "Matrix Group",
    requestId: randomUUID(),
  });
  let state = await call("owner", `/enterprise/groups/${group.id}`, {
    expectedVersion: group.version,
    name: group.name,
    active: true,
    memberIds: [actors.none.id],
  });
  const groupVersion = new Map();
  async function groupGrant(kind, id, value) {
    const key = kind + ":" + id;
    const result = await call(
      "owner",
      `/enterprise/resources/${kind}/${id}/group-policies`,
      {
        groupId: group.id,
        expectedGroupVersion: state.version,
        expectedVersion: groupVersion.get(key) ?? 0,
        rights: value,
      }
    );
    groupVersion.set(key, result.version);
  }
  for (const [kind, id] of [
    ["source", sourceId],
    ["dashboard", dashboardId],
  ]) {
    await groupGrant(kind, id, rights(true));
    await grant(kind, id, "none", rights(true));
  }
  await grant("dashboard", dashboardId, "none", rights());
  await grant("source", sourceId, "none", rights());
  await call("none", "/studio/dashboards/" + dashboardId);
  state = await call("owner", `/enterprise/groups/${group.id}`, {
    expectedVersion: state.version,
    name: group.name,
    active: true,
    memberIds: [],
  });
  await deny("none", "/studio/dashboards/" + dashboardId);
  state = await call("owner", `/enterprise/groups/${group.id}`, {
    expectedVersion: state.version,
    name: group.name,
    active: true,
    memberIds: [actors.none.id],
  });
  await call("none", "/studio/dashboards/" + dashboardId);
  state = await call("owner", `/enterprise/groups/${group.id}`, {
    expectedVersion: state.version,
    name: group.name,
    active: false,
    memberIds: [actors.none.id],
  });
  await deny("none", "/studio/dashboards/" + dashboardId);
  state = await call("owner", `/enterprise/groups/${group.id}`, {
    expectedVersion: state.version,
    name: group.name,
    active: true,
    memberIds: [actors.none.id],
  });
  await groupGrant("dashboard", dashboardId, rights());
  await deny("none", "/studio/dashboards/" + dashboardId);
  check(
    "M04: direct/group union, membership removal, inactive group, final group grant revoke"
  );
  // Delivery alone is read-only and still needs separate source read.
  await grant("source", sourceId, "none", rights(true));
  const delivered = await call(
    "owner",
    `/enterprise/deliveries/dashboard/${dashboardId}`,
    {
      requestId: randomUUID(),
      active: true,
      allowCopy: false,
      recipients: [{ recipientId: actors.none.id, expectedVersion: 0 }],
    }
  );
  const received = await call(
    "none",
    "/enterprise/deliveries/dashboard/received"
  );
  check(
    "received delivery appears",
    received.entries.some((e) => e.dashboardId === dashboardId)
  );
  await call("none", "/studio/dashboards/" + dashboardId);
  assert.deepEqual(
    (
      await call(
        "none",
        `/enterprise/resources/dashboard/${dashboardId}/access`
      )
    ).rights,
    rights(true)
  );
  const nowPreview = {
    document: afterEdit.document,
    expectedRevision: afterEdit.document.revision,
    expectedSourceRevision: afterEdit.sourceRevision,
  };
  await deny("none", `/studio/dashboards/${dashboardId}/preview`, nowPreview);
  await deny("none", `/studio/received/${dashboardId}/remix-reference`);
  await deny("none", `/studio/dashboards/${dashboardId}/publications`, {
    ...publication,
    expectedRevision: afterEdit.document.revision,
  });
  await grant("source", sourceId, "none", rights());
  await groupGrant("source", sourceId, rights());
  await deny("none", "/studio/dashboards/" + dashboardId);
  check(
    "delivery hidden without source read",
    !(
      await call("none", "/enterprise/deliveries/dashboard/received")
    ).entries.some((e) => e.dashboardId === dashboardId)
  );
  await grant("source", sourceId, "none", rights(true));
  await call("owner", `/enterprise/deliveries/dashboard/${dashboardId}`, {
    requestId: randomUUID(),
    active: false,
    recipients: [
      {
        recipientId: actors.none.id,
        expectedVersion: delivered.entries[0].version,
      },
    ],
  });
  await deny("none", "/studio/dashboards/" + dashboardId);
  check(
    "M05: delivery read-only, source revocation, final delivery revocation"
  );
  let gd = await call(
    "owner",
    `/enterprise/deliveries/dashboard/${dashboardId}/groups`,
    {
      requestId: randomUUID(),
      groupId: group.id,
      expectedGroupVersion: state.version,
      expectedVersion: 0,
      active: true,
      allowCopy: false,
    }
  );
  await call("none", "/studio/dashboards/" + dashboardId);
  await deny("none", `/studio/dashboards/${dashboardId}/preview`, nowPreview);
  gd = await call(
    "owner",
    `/enterprise/deliveries/dashboard/${dashboardId}/groups`,
    {
      requestId: randomUUID(),
      groupId: group.id,
      expectedGroupVersion: state.version,
      expectedVersion: gd.entry.version,
      active: false,
      allowCopy: false,
    }
  );
  await deny("none", "/studio/dashboards/" + dashboardId);
  check("M05 group: current group delivery read and revoke");
  // Actual ready CSV and queued jobs are actor-scoped and use current source export.
  const jobBody = {
    payload: { mode: "explore", query },
    measureVersions: { [metric.id]: metric.definitionVersion },
  };
  const job = await call("exporter", "/bi/export-jobs", {
    ...jobBody,
    requestId: randomUUID(),
  });
  const cancelJob = await call("exporter", "/bi/export-jobs", {
    ...jobBody,
    requestId: randomUUID(),
  });
  const cancelled = await call(
    "exporter",
    `/bi/export-jobs/${cancelJob.id}/cancel`,
    { expectedVersion: cancelJob.version }
  );
  assert.equal(cancelled.status, "cancelled");
  const queued = await call("exporter", "/bi/export-jobs", {
    ...jobBody,
    requestId: randomUUID(),
  });
  await call("exporter", `/bi/export-jobs/${job.id}/run`, {
    expectedVersion: job.version,
  });
  let ready;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await call("exporter", `/bi/export-jobs/${job.id}`);
    if (["ready", "failed"].includes(ready.status)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(ready.status, "ready");
  const file = await call("exporter", `/bi/export-jobs/${job.id}/file`);
  assert.equal(hash(file.csv), file.sha256);
  write("export.json", { sha256: file.sha256, csv: file.csv });
  for (const who of ["owner", "admin", "reader", "outsider"]) {
    for (const route of [
      `/bi/export-jobs/${job.id}`,
      `/bi/export-jobs/${job.id}/file`,
    ])
      await deny(who, route);
    await deny(who, `/bi/export-jobs/${queued.id}/run`, {
      expectedVersion: queued.version,
    });
    await deny(who, `/bi/export-jobs/${queued.id}/cancel`, {
      expectedVersion: queued.version,
    });
  }
  await grant("source", sourceId, "exporter", rights(true));
  assert(
    !(await call("exporter", "/bi/export-jobs")).entries.some(
      (e) => e.id === job.id
    ),
    "revoked job omitted from list"
  );
  for (const route of [
    `/bi/export-jobs/${job.id}`,
    `/bi/export-jobs/${job.id}/file`,
  ])
    await deny("exporter", route);
  await deny("exporter", "/bi/export-jobs", {
    ...jobBody,
    requestId: randomUUID(),
  });
  await deny("exporter", `/bi/export-jobs/${queued.id}/run`, {
    expectedVersion: queued.version,
  });
  await deny("exporter", `/bi/export-jobs/${queued.id}/cancel`, {
    expectedVersion: queued.version,
  });
  await grant("source", sourceId, "exporter", rights(true, false, false, true));
  const sameFile = await call("exporter", `/bi/export-jobs/${job.id}/file`);
  assert.equal(sameFile.csv, file.csv);
  await grant("source", sourceId, "exporter", rights());
  await deny("exporter", `/bi/export-jobs/${job.id}/file`);
  check(
    "M06: personal export scope, revoked create/run/cancel/get/file, stored CSV preserved"
  );
  // Deactivation bumps epoch. Re-enabling does not revive the former JWT.
  const old = { ...actors.reader };
  actors.old = old;
  let context = await call("owner", "/enterprise/context");
  await call(
    "owner",
    "/enterprise/members/" + actors.reader.id,
    {
      expectedVersion: context.organization.version,
      team: "QA",
      role: "member",
      active: false,
    },
    "PATCH"
  );
  for (const route of paths) await deny("old", route, undefined, "GET", 401);
  context = await call("owner", "/enterprise/context");
  await call(
    "owner",
    "/enterprise/members/" + actors.reader.id,
    {
      expectedVersion: context.organization.version,
      team: "QA",
      role: "member",
      active: true,
    },
    "PATCH"
  );
  await deny("old", `/bi/sources/${sourceId}/profile`, undefined, "GET", 401);
  await relogin("reader");
  await call("reader", `/bi/sources/${sourceId}/profile`);
  await deny("reader", "/studio/dashboards/" + dashboardId);
  check(
    "M07: inactive/old epoch 401, new token observes current resource permissions"
  );
  await grant("source", sourceId, "ownmember", rights(true));
  const copyDelivery = await call(
    "owner",
    `/enterprise/deliveries/dashboard/${dashboardId}`,
    {
      requestId: randomUUID(),
      active: true,
      allowCopy: true,
      recipients: [{ recipientId: actors.ownmember.id, expectedVersion: 0 }],
    }
  );
  const { reference } = await call(
    "ownmember",
    `/studio/received/${dashboardId}/remix-reference`
  );
  const template = await call(
    "ownmember",
    `/studio/received/${reference}/remix-template`
  );
  const mapping = Object.fromEntries(
    template.requiredFields.map((field) => [field.name, field.name])
  );
  const remix = {
    targetSourceId: ownSourceId,
    mapping,
    excludedBlockIds: [],
    expectedVersion: template.version,
    expectedLifecycleRevision: template.lifecycleRevision,
  };
  const remixedPreview = await call(
    "ownmember",
    `/studio/received/${reference}/remix-preview`,
    remix
  );
  write("remix-mapping.json", { template, preview: remixedPreview });
  assert.equal(
    remixedPreview.unmappedBlocks.length,
    0,
    "all copied blocks must map"
  );
  const copiedNumber = remixedPreview.preview.widgets.find(
    (widget) => widget.type === "BOARD_NUMERIC"
  );
  assert(copiedNumber);
  assert.equal(Number(copiedNumber.datas[0][copiedNumber.valueField]), 1200);
  const copied = await call(
    "ownmember",
    `/studio/received/${reference}/remix`,
    {
      ...remix,
      requestId: randomUUID(),
      expectedSourceRevision: remixedPreview.sourceRevision,
    }
  );
  assert.notEqual(copied.dashboardId, dashboardId);
  const copiedBefore = stable(
    (await call("ownmember", "/studio/dashboards/" + copied.dashboardId))
      .document
  );
  assert.equal(copiedBefore.sourceId, ownSourceId);
  await call("owner", `/enterprise/deliveries/dashboard/${dashboardId}`, {
    requestId: randomUUID(),
    active: false,
    recipients: [
      {
        recipientId: actors.ownmember.id,
        expectedVersion: copyDelivery.entries[0].version,
      },
    ],
  });
  await grant("source", sourceId, "ownmember", rights());
  await deny("ownmember", "/studio/dashboards/" + dashboardId);
  assert.deepEqual(
    stable(
      (await call("ownmember", "/studio/dashboards/" + copied.dashboardId))
        .document
    ),
    copiedBefore
  );
  check(
    "M08 copy: original delivery/source revoked, actual independent remix survives"
  );
  assert.deepEqual(
    stable((await call("owner", "/studio/dashboards/" + dashboardId)).document),
    preserved
  );
  assert.deepEqual(
    stable(
      (await call("ownmember", "/studio/dashboards/" + ownDashboardId)).document
    ),
    ownBefore
  );
  check(
    "M08: all denied operations preserve original and independent member document"
  );
  write("result.json", {
    status: "passed",
    owner: config.owner,
    httpRequests: journal.length,
    expectedDenials: journal.filter(
      (e) => typeof e.expected === "number" && e.expected >= 400
    ).length,
    checks,
    sourceId,
    dashboardId,
    independentDashboardId: copied.dashboardId,
    memberOwnedDashboardId: ownDashboardId,
    exportId: job.id,
    csvHash: file.sha256,
    modelCalls: 0,
    notRun: [
      "UI/real device",
      "legacy URL-share",
      "separate BI governance model",
      "all in-flight epoch lock races",
      "enterprise dashboard export consumer is not implemented",
      "all endpoints/production/business acceptance",
    ],
  });
  console.log(
    JSON.stringify({
      status: "passed",
      evidence,
      httpRequests: journal.length,
      checks: checks.length,
    })
  );
}
run()
  .catch((error) => {
    write("failure.json", {
      message: clean(error.message),
      stack: clean(error.stack),
      completed: checks,
    });
    console.error(clean(error.stack));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db) await db.end();
  });
