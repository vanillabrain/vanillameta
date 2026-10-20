#!/usr/bin/env node
// Main legacy integration: execute ONLY against a newly provisioned owned QA runtime.
// Usage: node scripts/qa-main-legacy.cjs /absolute/runtime.json [--no-redis]
// Launch that runtime with QA_LEGACY_OPERATIONS_USER_IDS=1 and, for Redis mode,
// QA_REDIS_PORT=<owned loopback Redis port>. This script never builds/starts services.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const backendRequire = createRequire(
  path.join(root, "backend-api/package.json")
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(args) {
  const positional = args.filter((value) => !value.startsWith("--"));
  assert(
    args.every((value) => !value.startsWith("--") || value === "--no-redis"),
    "Unknown option"
  );
  assert.equal(
    positional.length,
    1,
    "Supply one explicit fresh runtime JSON path"
  );
  return {
    runtimePath: path.resolve(positional[0]),
    noRedis: args.includes("--no-redis"),
  };
}
function unwrap(value) {
  return value?.status === "SUCCESS" && Object.hasOwn(value, "data")
    ? value.data
    : value;
}
function identifier(value) {
  assert.equal(typeof value, "string", "Upload must return a table name");
  assert.match(
    value,
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "Unexpected uploaded table identifier"
  );
  return '"' + value + '"';
}

function assertOwnedUploadDirectory(runRoot, configuredUploadDir) {
  // macOS may expose the same owned temp directory as /var or /private/var.
  // Resolve only this filesystem-valued setting; all DB identity checks stay exact.
  let canonicalRoot, canonicalExpected, canonicalConfigured;
  try {
    assert.equal(typeof configuredUploadDir, "string");
    assert(path.isAbsolute(configuredUploadDir));
    canonicalRoot = fs.realpathSync(runRoot);
    canonicalExpected = fs.realpathSync(path.join(runRoot, "uploads"));
    canonicalConfigured = fs.realpathSync(configuredUploadDir);
  } catch {
    throw new Error("Owned API upload directory must exist and be absolute");
  }
  assert(
    canonicalExpected === path.join(canonicalRoot, "uploads") &&
      canonicalConfigured === canonicalExpected,
    "API upload directory must match the owned runtime uploads directory"
  );
}

async function main(args) {
  const options = parseArgs(args);
  const actors = {},
    jobs = {},
    sources = {},
    checks = [],
    journal = [],
    secrets = [];
  let runtime, config, db, queue, evidence;
  const clean = (value) =>
    secrets
      .filter(Boolean)
      .reduce(
        (text, secret) => text.split(secret).join("[REDACTED]"),
        String(value)
      )
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[REDACTED_TOKEN]"
      );
  const write = (name, value, privateData = false) => {
    const file = path.join(evidence, name);
    const text = JSON.stringify(value, null, 2) + "\n";
    fs.writeFileSync(file, privateData ? text : clean(text), { mode: 0o600 });
    fs.chmodSync(file, 0o600);
  };
  const fixture = () =>
    write(
      "fixture.private.json",
      {
        owner: config.owner,
        api: runtime.api,
        frontend: runtime.frontend,
        mode: options.noRedis ? "no-redis" : "redis",
        actors,
        sources,
        jobs,
      },
      true
    );
  const check = (name) => {
    checks.push(name);
    write("checks.json", checks);
  };
  const localExec = (cmd, args) =>
    execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const poll = async (name, read, done, timeout = 45000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = await read();
      if (done(value)) return value;
      await delay(100);
    }
    throw new Error("Timed out: " + name);
  };
  async function call(
    who,
    route,
    body,
    method = body === undefined ? "GET" : "POST",
    expected
  ) {
    const response = await fetch(runtime.api + route, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        ...(actors[who]?.token
          ? { Authorization: "Bearer " + actors[who].token }
          : {}),
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const text = await response.text();
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
      status: response.status,
      expected: expected ?? "2xx",
    });
    write("http.json", journal);
    if (expected === undefined)
      assert(response.ok, `${who} ${method} ${route}: HTTP ${response.status}`);
    else assert.equal(response.status, expected, `${who} ${method} ${route}`);
    return unwrap(value);
  }
  async function account(who) {
    const userId = "legacy" + randomBytes(5).toString("hex");
    const password = "T1!" + randomBytes(12).toString("hex");
    secrets.push(userId, password);
    await call("anonymous", "/login/signup", {
      userId,
      password,
      email: userId + "@example.invalid",
    });
    actors[who] = { userId, password };
    fixture();
    await signin(who);
    const [[row]] = await db.query(
      "SELECT id, authVersion, active FROM `user` WHERE userId = ?",
      [userId]
    );
    assert(
      row && row.active && Number.isSafeInteger(row.id),
      "New account must be active"
    );
    actors[who].id = row.id;
    actors[who].authVersion = row.authVersion;
    fixture();
  }
  async function signin(who) {
    const actor = actors[who];
    const session = await call("anonymous", "/login/signin", {
      userId: actor.userId,
      password: actor.password,
    });
    assert.equal(
      typeof session.accessToken,
      "string",
      "Signin must return a token"
    );
    secrets.push(session.accessToken);
    actor.token = session.accessToken;
    fixture();
  }
  async function upload(who) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([
        "region,amount,day\nA,100,2026-01-01\nB,200,2026-01-02\nA,300,2026-01-03\n",
      ]),
      "legacy-smoke.csv"
    );
    const source = await call(who, "/database/upload", form);
    assert(
      Number.isSafeInteger(source.id) && source.id > 0,
      "Upload must create a managed source"
    );
    identifier(source.tableName);
    const [[row]] = await db.query(
      "SELECT ownerId, engine FROM `database` WHERE id = ?",
      [source.id]
    );
    assert.equal(row.ownerId, actors[who].id, "Uploaded source owner");
    assert.equal(row.engine, "duckdb", "Native DuckDB source");
    sources[who] = source;
    fixture();
    return source;
  }
  const request = (source, query) => ({
    jobType: "query_execution",
    title: "Synthetic legacy smoke",
    databaseId: String(source.id),
    query,
  });
  async function row(jobId) {
    const [[job]] = await db.query(
      "SELECT id, userId, status, progress, queueJobId, metadata FROM background_jobs WHERE id = ?",
      [jobId]
    );
    assert(job, "Admitted background job must persist");
    return job;
  }
  async function admitted(who, query, label) {
    const job = await call(
      who,
      "/background-jobs",
      request(sources[who], query)
    );
    assert.equal(typeof job.id, "string", "Admitted job ID");
    jobs[label] = { id: job.id, who };
    fixture();
    const stored = await row(job.id),
      metadata = JSON.parse(stored.metadata);
    assert.equal(stored.userId, actors[who].userId, "Personal job owner");
    assert.deepEqual(
      metadata.actor,
      {
        id: actors[who].id,
        userId: actors[who].userId,
        authVersion: actors[who].authVersion,
      },
      "Immutable admitted actor epoch"
    );
    assert.equal(metadata.query, query, "Persisted admitted SQL");
    assert.equal(String(metadata.databaseId), String(sources[who].id));
    assert(stored.queueJobId, "Real Redis queue admission");
    const queued = await queue.getJob(stored.queueJobId);
    assert(queued, "Bull job must exist in configured Redis");
    assert.equal(
      queued.data.backgroundJobId,
      job.id,
      "Redis-to-metadata job identity"
    );
    return job.id;
  }
  async function finished(jobId, status) {
    const stored = await poll(
      "job terminal state",
      () => row(jobId),
      (value) => ["completed", "failed", "cancelled"].includes(value.status)
    );
    assert.equal(stored.status, status, "Expected worker terminal state");
    // Wait through Bull retry/backoff as well; metadata alone is not queue completion.
    const queued = await queue.getJob(stored.queueJobId);
    if (queued)
      await poll(
        "Bull terminal state",
        () => queued.getState(),
        (value) => ["completed", "failed"].includes(value)
      );
    return stored;
  }
  async function noResult(jobId) {
    const [[result]] = await db.query(
      "SELECT COUNT(*) AS n FROM background_job_results WHERE backgroundJobId = ?",
      [jobId]
    );
    assert.equal(
      Number(result.n),
      0,
      "Cancelled/revoked work must not store a result"
    );
  }
  async function running(jobId) {
    const observed = await poll(
      "observable active worker window",
      () => row(jobId),
      (value) =>
        (value.status === "processing" && value.progress >= 30) ||
        ["completed", "failed"].includes(value.status)
    );
    assert.equal(
      observed.status,
      "processing",
      "Work finished before cancellation/revocation; this race is unverified"
    );
  }
  async function memberActive(active) {
    const context = await call("operator", "/enterprise/context");
    await call(
      "operator",
      "/enterprise/members/" + actors.member.id,
      {
        team: "QA",
        role: "member",
        active,
        expectedVersion: context.organization.version,
      },
      "PATCH"
    );
  }
  try {
    // Same MySQL/container/API ownership gate as qa-enterprise-access-matrix.
    runtime = JSON.parse(fs.readFileSync(options.runtimePath, "utf8"));
    assert.equal(runtime.status, "ready");
    assert.equal(runtime.api, "http://127.0.0.1:4250/v1");
    const runRoot = fs.realpathSync(runtime.runRoot);
    assert(path.basename(runRoot).startsWith("vm-enterprise-qa-"));
    assert.equal(
      fs.realpathSync(runtime.databaseConfigPath),
      path.join(runRoot, "database-config.json")
    );
    config = JSON.parse(fs.readFileSync(runtime.databaseConfigPath, "utf8"));
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
      localExec("docker", ["inspect", config.containerId])
    )[0];
    assert.equal(
      inspect.Config.Labels["vanillameta.enterprise.qa.owner"],
      config.owner
    );
    assert.equal(inspect.Name, "/" + config.containerName);
    assert(
      inspect.NetworkSettings.Ports["3306/tcp"].some(
        (binding) =>
          binding.HostIp === "127.0.0.1" &&
          Number(binding.HostPort) === config.port
      )
    );
    const pid = runtime.processes["backend-4250"];
    assert(Number.isSafeInteger(pid) && pid > 0);
    const listeners = localExec("/usr/sbin/lsof", [
      "-nP",
      "-iTCP:4250",
      "-sTCP:LISTEN",
      "-t",
    ])
      .split(/\s+/)
      .map(Number);
    assert.deepEqual(
      [...new Set(listeners)],
      [pid],
      "HTTP listener must be the owned API PID"
    );
    assert.equal(
      Number(localExec("/bin/ps", ["-p", String(pid), "-o", "ppid="])),
      runtime.processes.supervisor
    );
    // Never log process environments or credentials.
    const env = localExec("/bin/ps", [
      "eww",
      "-p",
      String(pid),
      "-o",
      "command=",
    ]).split(/\s+/);
    const envValue = (key) =>
      env.find((value) => value.startsWith(key + "="))?.slice(key.length + 1) ||
      "";
    for (const [key, value] of Object.entries({
      DB_HOST: config.host,
      DB_PORT: String(config.port),
      DB_USERNAME: config.username,
      DB_PASSWORD: config.password,
      DB_NAME: config.database,
    }))
      assert(
        env.includes(key + "=" + value),
        "API environment must match owned " + key
      );
    assertOwnedUploadDirectory(runtime.runRoot, envValue("FILE_UPLOAD_DIR"));
    assert.equal(
      envValue("LEGACY_OPERATIONS_USER_IDS"),
      "1",
      "Fresh QA must explicitly allow only first account as operator"
    );
    const redisUrl = envValue("REDIS_URL");
    if (options.noRedis) {
      assert(
        !redisUrl && !envValue("REDIS_HOST") && !envValue("REDIS_PORT"),
        "No-Redis mode requires an actually unconfigured backend"
      );
    } else {
      assert(redisUrl, "Redis mode requires the owned backend REDIS_URL");
      secrets.push(redisUrl);
      const endpoint = new URL(redisUrl);
      assert.equal(endpoint.protocol, "redis:");
      assert.equal(endpoint.hostname, "127.0.0.1");
      assert(
        !endpoint.username && !endpoint.password,
        "Use the credential-free owned QA loopback Redis"
      );
      assert(Number(endpoint.port) > 0 && Number(endpoint.port) <= 65535);
      if (envValue("REDIS_PORT"))
        assert.equal(envValue("REDIS_PORT"), endpoint.port);
      if (envValue("REDIS_HOST"))
        assert.equal(envValue("REDIS_HOST"), endpoint.hostname);
    }
    db = await backendRequire("mysql2/promise").createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    const [[marker]] = await db.query("SELECT token FROM qa_runtime_owner");
    assert.equal(marker.token, config.owner);
    const [[server]] = await db.query(
      "SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db"
    );
    assert.equal(server.version, "8.4.11");
    assert.equal(server.uuid, config.serverUuid);
    assert.equal(server.db, config.database);
    const [[fresh]] = await db.query("SELECT COUNT(*) AS n FROM `user`");
    assert.equal(Number(fresh.n), 0, "Refuse nonfresh fixtures");
    const [[sequence]] = await db.query(
      "SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user'",
      [config.database]
    );
    assert.equal(
      Number(sequence.nextId),
      1,
      "First fixture account must receive operator ID 1"
    );
    evidence = path.join(
      root,
      ".aiwf/evidence/TC050-main-legacy",
      randomUUID()
    );
    const fixturePath = path.join(evidence, "fixture.private.json");
    localExec("git", ["-C", root, "check-ignore", "--", fixturePath]);
    fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
    fs.chmodSync(evidence, 0o700);
    fixture();
    write("environment.json", {
      api: runtime.api,
      owner: config.owner,
      mode: options.noRedis ? "no-redis" : "redis",
      mysql: server.version,
      modelCalls: 0,
      redis: options.noRedis
        ? "unconfigured"
        : "verified owned backend-selected loopback endpoint",
      schema: "fresh development synchronize, not production migration",
    });
    if (!options.noRedis) {
      const Queue = backendRequire("bull");
      queue = new Queue("query-execution", redisUrl, {
        redis: {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
          connectTimeout: 5000,
        },
        settings: { maxStalledCount: 0 },
      });
      queue.on("error", () => {});
      await queue.isReady();
    }
    await account("operator");
    assert.equal(
      actors.operator.id,
      1,
      "Operator must be actual first account"
    );
    await account("member");
    await call("operator", "/enterprise/organizations", {
      name: "Synthetic Legacy QA",
    });
    let context = await call("operator", "/enterprise/context");
    const consent = await call("member", "/enterprise/enrollment", {
      organizationId: context.organization.id,
    });
    await call("operator", "/enterprise/members", {
      userId: actors.member.userId,
      team: "QA",
      role: "member",
      expectedVersion: context.organization.version,
      enrollmentCode: consent.enrollmentCode,
    });
    // Organization setup can change session epochs; never carry pre-setup tokens
    // into source/job permission checks or relax their expected status codes.
    await signin("operator");
    await signin("member");
    for (const who of ["operator", "member"]) {
      const [[current]] = await db.query(
        "SELECT id, authVersion, active FROM `user` WHERE id = ? AND userId = ?",
        [actors[who].id, actors[who].userId]
      );
      assert(current && current.active, "Fixture actor must remain active");
      actors[who].authVersion = current.authVersion;
    }
    fixture();
    const stats =
      "/analytics/dashboard/stats?startDate=2026-01-01&endDate=2026-12-31";
    await call("anonymous", stats, undefined, "GET", 401);
    await call("member", stats, undefined, "GET", 403);
    await call("operator", stats, undefined, "GET", 200);
    check(
      "Global operations: anonymous 401, ordinary member 403, configured operator 200"
    );
    // Both public collectors swallow storage errors: HTTP 204 alone is not proof.
    const telemetrySession = randomUUID();
    const collectedAction = "qa-collected-" + randomUUID();
    const clientAction = "qa-client-" + randomUUID();
    await call(
      "anonymous",
      "/analytics/events",
      {
        events: [
          {
            category: "legacy-qa",
            action: collectedAction,
            metadata: { sessionId: telemetrySession },
          },
        ],
      },
      "POST",
      204
    );
    // This is the existing EventsController path used by the frontend under the v1 API base.
    await call(
      "anonymous",
      "/v1/events/track",
      {
        events: [
          {
            category: "legacy-qa",
            action: clientAction,
            value: 1.25,
            properties: {
              sessionId: telemetrySession,
              correlationId: randomUUID(),
            },
          },
        ],
        sessionInfo: {
          sessionId: telemetrySession,
          startTime: Date.now(),
          lastActivityTime: Date.now(),
          pageViews: 1,
          eventCount: 1,
        },
      },
      "POST",
      204
    );
    const [[collected]] = await db.query(
      "SELECT COUNT(*) AS n FROM analytics_collected_events WHERE action = ? AND sessionId = ?",
      [collectedAction, telemetrySession]
    );
    const [[client]] = await db.query(
      "SELECT COUNT(*) AS n, MAX(value) AS value FROM client_analytics_events WHERE action = ? AND sessionId = ?",
      [clientAction, telemetrySession]
    );
    assert.equal(
      Number(collected.n),
      1,
      "Public collector must persist without the other family's required fields"
    );
    assert.equal(
      Number(client.n),
      1,
      "Client telemetry must persist in its own session schema"
    );
    assert.equal(
      Number(client.value),
      1.25,
      "Client telemetry decimal precision must survive"
    );
    check(
      "Both public telemetry POSTs persist independently; client decimal value preserved"
    );
    await upload("operator");
    await upload("member");
    await call(
      "member",
      "/background-jobs",
      request(sources.operator, "SELECT 1"),
      "POST",
      403
    );
    await call("anonymous", "/background-jobs", undefined, "GET", 401);
    await call("operator", "/v1/background-jobs", undefined, "GET", 404);
    check("Single v1 prefix and source-owner admission boundary");
    if (options.noRedis) {
      await call(
        "operator",
        "/background-jobs",
        request(sources.operator, "SELECT 1"),
        "POST",
        503
      );
      const list = await call("operator", "/background-jobs");
      assert.equal(list.total, 0);
      const [[count]] = await db.query(
        "SELECT COUNT(*) AS n FROM background_jobs"
      );
      assert.equal(Number(count.n), 0);
      check(
        "No Redis: authorized admission 503 without persistence; personal history remains available"
      );
    } else {
      const id = await admitted(
        "operator",
        `SELECT SUM(amount) AS total, COUNT(*) AS row_count FROM ${identifier(
          sources.operator.tableName
        )}`,
        "completed"
      );
      await finished(id, "completed");
      const status = await call("operator", "/background-jobs/" + id);
      assert.equal(status.status, "completed");
      await call("operator", `/background-jobs/${id}/result`);
      let result = await call("operator", `/background-jobs/${id}/result/data`);
      if (typeof result === "string") result = JSON.parse(result);
      assert.equal(result.status, "SUCCESS");
      assert.equal(Number(result.datas?.[0]?.total), 600);
      assert.equal(Number(result.datas?.[0]?.row_count), 3);
      for (const suffix of ["", "/result", "/result/data"])
        await call(
          "member",
          `/background-jobs/${id}${suffix}`,
          undefined,
          "GET",
          404
        );
      await call("member", "/background-jobs/" + id, undefined, "DELETE", 404);
      const otherList = await call("member", "/background-jobs");
      assert(!otherList.items.some((item) => item.id === id));
      check(
        "Real HTTP + Bull Redis + native DuckDB: exact result and personal job isolation"
      );
      // Bounded CPU-only SELECT opens an observable execution window without files/network or writes.
      const slowSql =
        "SELECT SUM(sin(CAST(i AS DOUBLE))) AS value FROM range(0, 30000000) t(i)";
      const cancelled = await admitted("operator", slowSql, "cancelled");
      await running(cancelled);
      await call(
        "operator",
        "/background-jobs/" + cancelled,
        undefined,
        "DELETE",
        204
      );
      await finished(cancelled, "cancelled");
      await noResult(cancelled);
      await call(
        "operator",
        `/background-jobs/${cancelled}/result`,
        undefined,
        "GET",
        404
      );
      check(
        "Observed active worker cancellation preserves cancelled state and stores no result"
      );
      const revoked = await admitted("member", slowSql, "revoked");
      await running(revoked);
      actors.member.revokedToken = actors.member.token;
      fixture();
      await memberActive(false);
      await call(
        "member",
        "/background-jobs/" + revoked,
        undefined,
        "GET",
        401
      );
      await finished(revoked, "failed");
      await noResult(revoked);
      await memberActive(true);
      await signin("member");
      const [[renewed]] = await db.query(
        "SELECT authVersion FROM `user` WHERE id = ?",
        [actors.member.id]
      );
      assert(renewed.authVersion > actors.member.authVersion);
      actors.member.authVersion = renewed.authVersion;
      fixture();
      await call(
        "member",
        "/background-jobs/" + revoked,
        undefined,
        "GET",
        403
      );
      await call(
        "member",
        `/background-jobs/${revoked}/result/data`,
        undefined,
        "GET",
        403
      );
      await call(
        "member",
        "/background-jobs/" + revoked,
        undefined,
        "DELETE",
        403
      );
      check(
        "Active-worker actor epoch revocation: old token 401, no result, renewed token cannot upgrade admitted epoch"
      );
    }
    fixture();
    write("summary.json", {
      status: "passed",
      checks,
      requests: journal.length,
      modelCalls: 0,
      limitations: [
        "Local synthetic HTTP/Redis/MySQL/native DuckDB smoke, not enterprise acceptance or deployment.",
        "Redis is the endpoint selected by the verified owned backend; separate Redis container custody is not independently attested.",
        "Execution windows must be observed; an already-finished query fails the smoke rather than claiming a race passed.",
        "Fixtures are retained for Ego; the driver neither cleans user data nor starts/stops runtime services.",
      ],
    });
    process.stdout.write(
      JSON.stringify({
        status: "passed",
        mode: options.noRedis ? "no-redis" : "redis",
        checks: checks.length,
        evidence: path.relative(root, evidence),
      }) + "\n"
    );
  } catch (error) {
    const failure = {
      status: "failed",
      message: clean(error.message),
      completedChecks: checks.length,
    };
    if (evidence) write("failure.json", failure);
    process.stderr.write(JSON.stringify(failure) + "\n");
    process.exitCode = 1;
  } finally {
    if (queue) await queue.close().catch(() => {});
    if (db) await db.end().catch(() => {});
  }
}
module.exports = { parseArgs, unwrap, identifier, assertOwnedUploadDirectory };
if (require.main === module) main(process.argv.slice(2));
