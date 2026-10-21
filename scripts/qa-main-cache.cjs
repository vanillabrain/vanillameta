#!/usr/bin/env node
// AUTHOR-ONLY artifact: Main must stabilize the owned runtime before executing.
// Usage: node scripts/qa-main-cache.cjs /absolute/active/runtime.json /absolute/TC050-main-legacy/<run>/fixture.private.json
// Reuses existing actors/source. No signup, upload, build, service provisioning or cleanup.
// Writes only two owned synthetic Dataset fixtures and a unique private evidence directory;
// signin updates the owned actors' sessions, and authenticated control restarts only the owned API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { serialize } = require("node:v8");
const {
  assertOwnedUploadDirectory,
  identifier,
} = require("./qa-main-legacy.cjs");
const root = path.resolve(__dirname, "..");
const backendRequire = createRequire(
  path.join(root, "backend-api/package.json")
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(args) {
  assert.equal(
    args.length,
    2,
    "Supply the active owned runtime and existing legacy fixture paths"
  );
  assert(
    args.every((value) => path.isAbsolute(value) && !value.startsWith("--")),
    "Require explicit absolute paths"
  );
  return {
    runtimePath: fs.realpathSync(args[0]),
    fixturePath: fs.realpathSync(args[1]),
  };
}
function readPrivate(file) {
  assert.equal(
    fs.statSync(file).mode & 0o777,
    0o600,
    "Private input must have mode 0600"
  );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function localExec(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function listener(port) {
  return [
    ...new Set(
      localExec("/usr/sbin/lsof", [
        "-nP",
        `-iTCP:${port}`,
        "-sTCP:LISTEN",
        "-t",
      ])
        .split(/\s+/)
        .map(Number)
    ),
  ];
}
function redisCacheKey(env, dataset, source, actor) {
  // Exact current DatasetService.cachedQueryBasis + Hybrid/Redis cache contract.
  // Connection config participates in the hash in memory only; never persist it.
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        actor.id,
        actor.authVersion,
        dataset.id,
        dataset.databaseId,
        dataset.query,
        source.id,
        source.ownerId,
        source.catalogVersion,
        source.engine,
        source.type,
        source.connectionConfig,
      ])
    )
    .digest("hex");
  const identity = JSON.stringify([String(source.id), revision]);
  const queryHash = createHash("sha256")
    .update(serialize([identity, dataset.query, undefined]))
    .digest("hex");
  return `${env.REDIS_KEY_PREFIX || "vanillameta:"}query:${
    source.type || "unknown"
  }:${queryHash}`;
}

async function main(args) {
  let stage = "arguments",
    evidence,
    db,
    redis,
    runtime,
    config,
    fixture;
  const checks = [],
    journal = [],
    observations = [],
    tokens = {};
  const runId = randomUUID();
  const write = (name, value) => {
    // Only hand-picked nonsecret metadata reaches this function, including failures.
    fs.writeFileSync(
      path.join(evidence, name),
      JSON.stringify(value, null, 2) + "\n",
      {
        flag: "w",
        mode: 0o600,
      }
    );
    fs.chmodSync(path.join(evidence, name), 0o600);
  };
  const check = (name) => {
    checks.push(name);
    write("checks.json", checks);
  };
  const sameRuntime = (candidate) => {
    assert.equal(candidate.status, "ready");
    for (const field of [
      "api",
      "control",
      "controlToken",
      "runRoot",
      "databaseConfigPath",
    ])
      assert.equal(
        candidate[field],
        runtime[field],
        "Runtime identity changed"
      );
    assert.equal(
      candidate.processes.supervisor,
      runtime.processes.supervisor,
      "Supervisor identity changed"
    );
  };
  async function verifyDatabase() {
    const [[marker]] = await db.query("SELECT token FROM qa_runtime_owner");
    assert.equal(marker.token, config.owner, "Owned MySQL marker");
    const [[server]] = await db.query(
      "SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db"
    );
    assert.equal(server.version, "8.4.11");
    assert.equal(server.uuid, config.serverUuid);
    assert.equal(server.db, config.database);
    return server.version;
  }
  function verifyApi(candidate) {
    sameRuntime(candidate);
    const pid = candidate.processes["backend-4250"];
    assert(Number.isSafeInteger(pid) && pid > 0);
    assert.deepEqual(listener(4250), [pid], "API must be the owned listener");
    assert.deepEqual(
      listener(4450),
      [candidate.processes.supervisor],
      "Control must be the owned supervisor"
    );
    assert.equal(
      Number(localExec("/bin/ps", ["-p", String(pid), "-o", "ppid="])),
      candidate.processes.supervisor
    );
    // Never print/save ps output, environment values, credentials or private tokens.
    const words = localExec("/bin/ps", [
      "eww",
      "-p",
      String(pid),
      "-o",
      "command=",
    ]).split(/\s+/);
    const env = Object.fromEntries(
      words
        .filter((word) => word.includes("="))
        .map((word) => [
          word.slice(0, word.indexOf("=")),
          word.slice(word.indexOf("=") + 1),
        ])
    );
    for (const [key, value] of Object.entries({
      DB_HOST: config.host,
      DB_PORT: String(config.port),
      DB_USERNAME: config.username,
      DB_PASSWORD: config.password,
      DB_NAME: config.database,
    }))
      assert.equal(
        env[key],
        value,
        "API must use the owned database configuration"
      );
    assertOwnedUploadDirectory(candidate.runRoot, env.FILE_UPLOAD_DIR);
    assert.equal(
      env.LEGACY_OPERATIONS_USER_IDS,
      String(fixture.actors.operator.id)
    );
    assert.equal(
      env.REDIS_CACHE_ENABLED,
      "true",
      "Real persistent cache must be enabled"
    );
    const endpoint = new URL(env.REDIS_URL);
    assert.equal(endpoint.protocol, "redis:");
    assert.equal(endpoint.hostname, "127.0.0.1");
    assert(
      !endpoint.username && !endpoint.password,
      "Use only the credential-free owned loopback Redis"
    );
    assert(Number(endpoint.port) > 0 && Number(endpoint.port) <= 65535);
    assert.equal(env.REDIS_HOST, endpoint.hostname);
    assert.equal(env.REDIS_PORT, endpoint.port);
    assert(
      !env.REDIS_CLUSTER_ENABLED || env.REDIS_CLUSTER_ENABLED === "false",
      "Require owned standalone Redis"
    );
    assert(!env.REDIS_PASSWORD, "Do not use external Redis credentials");
    assert.equal(
      endpoint.pathname.replace(/^\//, "") || "0",
      env.REDIS_DB || "0"
    );
    return { pid, env, redisPort: Number(endpoint.port) };
  }
  async function call(who, route, body, expected = 200) {
    const response = await fetch(runtime.api + route, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        ...(tokens[who] ? { Authorization: `Bearer ${tokens[who]}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Do not persist response bodies: error payloads may carry SQL/config/credentials.
    journal.push({
      actor: who,
      operation: stage,
      method: body === undefined ? "GET" : "POST",
      status: response.status,
      expected,
    });
    write("http.json", journal);
    assert.equal(response.status, expected, "Unexpected fixture HTTP status");
    const result = await response.json();
    if (expected < 300)
      assert.notEqual(
        result?.status,
        "ERROR",
        "Fixture API returned a semantic error"
      );
    return result;
  }
  async function currentActor(who) {
    const actor = fixture.actors[who];
    const [[row]] = await db.query(
      "SELECT id, userId, active, authVersion FROM `user` WHERE id = ? AND userId = ?",
      [actor.id, actor.userId]
    );
    assert(
      row && row.active && Number.isSafeInteger(row.authVersion),
      "Existing actor must be active"
    );
    return row;
  }
  async function cached(id, literal, expectedHit, label) {
    stage = label;
    const result = await call("operator", `/dataset/${id}/cached`);
    assert.equal(result.status, "SUCCESS");
    assert.equal(
      result.cache?.hit,
      expectedHit,
      "Require an explicit cache outcome, not just matching SQL totals"
    );
    assert(
      Array.isArray(result.data) && result.data.length === 1,
      "Exactly one aggregate row"
    );
    assert.equal(
      result.data[0].literal,
      literal,
      "SQL literal must remain case-sensitive"
    );
    assert.equal(
      Number(result.data[0].total),
      600,
      "Synthetic legacy source total must be 600"
    );
    observations.push({
      operation: label,
      datasetId: id,
      literal,
      total: Number(result.data[0].total),
      cacheHit: result.cache.hit,
    });
    write("observations.json", observations);
    return result;
  }
  try {
    const options = parseArgs(args);
    stage = "owned-runtime-gates";
    runtime = readPrivate(options.runtimePath);
    assert.equal(runtime.status, "ready");
    assert.equal(runtime.api, "http://127.0.0.1:4250/v1");
    assert.equal(runtime.control, "http://127.0.0.1:4450");
    assert.equal(typeof runtime.controlToken, "string");
    assert(runtime.controlToken.length >= 32);
    const runRoot = fs.realpathSync(runtime.runRoot);
    assert(path.basename(runRoot).startsWith("vm-enterprise-qa-"));
    assert.equal(
      fs.realpathSync(runtime.databaseConfigPath),
      path.join(runRoot, "database-config.json")
    );
    config = readPrivate(runtime.databaseConfigPath);
    assert.equal(config.gate, "owned-enterprise-http-mysql-v1");
    assert.match(config.owner, /^[0-9a-f]{24}$/);
    assert.equal(
      fs.readFileSync(path.join(runRoot, "owner"), "utf8"),
      config.owner
    );
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.database, "vm_enterprise_" + config.owner);
    // Must reuse this owner's existing legacy fixture; no user-count/sequence freshness gate.
    const legacyRoot = fs.realpathSync(
      path.join(root, ".aiwf/evidence/TC050-main-legacy")
    );
    assert(
      options.fixturePath.startsWith(legacyRoot + path.sep),
      "Require the existing legacy QA evidence fixture"
    );
    fixture = readPrivate(options.fixturePath);
    assert.equal(path.basename(options.fixturePath), "fixture.private.json");
    assert.equal(fixture.owner, config.owner);
    assert.equal(fixture.api, runtime.api);
    assert.equal(fixture.mode, "redis");
    assert.equal(fixture.actors.operator.id, 1);
    assert.notEqual(fixture.actors.operator.id, fixture.actors.member.id);
    for (const who of ["operator", "member"]) {
      assert(
        Number.isSafeInteger(fixture.actors[who].id) &&
          fixture.actors[who].id > 0
      );
      assert.equal(typeof fixture.actors[who].userId, "string");
      assert.equal(typeof fixture.actors[who].password, "string");
      assert(
        fixture.actors[who].userId.length > 0 &&
          fixture.actors[who].password.length > 0
      );
    }
    localExec("git", ["-C", root, "check-ignore", "--", options.fixturePath]);
    const container = JSON.parse(
      localExec("docker", ["inspect", config.containerId])
    )[0];
    assert.equal(
      container.Config.Labels["vanillameta.enterprise.qa.owner"],
      config.owner
    );
    assert.equal(container.Name, "/" + config.containerName);
    assert(
      container.NetworkSettings.Ports["3306/tcp"].some(
        (binding) =>
          binding.HostIp === "127.0.0.1" &&
          Number(binding.HostPort) === config.port
      )
    );
    const before = verifyApi(runtime);
    const initialEnv = before.env;
    db = await backendRequire("mysql2/promise").createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    const mysqlVersion = await verifyDatabase();
    const Redis = backendRequire("ioredis");
    redis = new Redis({
      host: "127.0.0.1",
      port: before.redisPort,
      db: Number(initialEnv.REDIS_DB || "0"),
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    redis.on("error", () => {});
    await redis.connect();
    assert.equal(await redis.ping(), "PONG");
    const sourceId = fixture.sources.operator.id;
    assert(Number.isSafeInteger(sourceId) && sourceId > 0);
    const table = identifier(fixture.sources.operator.tableName);
    const [[source]] = await db.query(
      "SELECT id, ownerId, catalogActive, catalogVersion, engine, type, connectionConfig FROM `database` WHERE id = ?",
      [sourceId]
    );
    assert(
      source &&
        source.ownerId === fixture.actors.operator.id &&
        source.catalogActive,
      "Owned active native source"
    );
    assert.equal(source.engine, "duckdb");
    evidence = path.join(root, ".aiwf/evidence/TC050-main-cache", runId);
    localExec("git", [
      "-C",
      root,
      "check-ignore",
      "--",
      path.join(evidence, "summary.json"),
    ]);
    fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
    fs.chmodSync(evidence, 0o700);
    write("environment.json", {
      mysql: mysqlVersion,
      ownedRuntime: true,
      redis: "owned backend-selected loopback endpoint",
      oldApiPid: before.pid,
      modelCalls: 0,
    });
    check(
      "Existing same-owner fixture and owned MySQL/API/supervisor/Redis gates passed; no fresh-runtime requirement"
    );
    for (const who of ["operator", "member"]) {
      stage = `signin-${who}`;
      await currentActor(who);
      const session = await call(
        "anonymous",
        "/login/signin",
        {
          userId: fixture.actors[who].userId,
          password: fixture.actors[who].password,
        },
        201
      );
      const token = session.data?.accessToken || session.accessToken;
      assert.equal(typeof token, "string");
      tokens[who] = token;
    }
    const operator = await currentActor("operator");
    const datasets = [];
    for (const literal of [`A-${runId}`, `a-${runId}`]) {
      stage = "create-owned-synthetic-dataset";
      const query = `SELECT '${literal}' AS literal, SUM(amount) AS total FROM ${table}`;
      const created = await call(
        "operator",
        "/dataset",
        { title: `Synthetic cache ${literal}`, databaseId: sourceId, query },
        201
      );
      const dataset = created.status === "SUCCESS" ? created.data : created;
      assert(Number.isSafeInteger(dataset.id) && dataset.id > 0);
      const [[stored]] = await db.query(
        "SELECT id, databaseId, query FROM dataset WHERE id = ?",
        [dataset.id]
      );
      assert(
        stored && stored.databaseId === sourceId && stored.query === query,
        "New fixture definition must match exactly"
      );
      datasets.push({ ...stored, literal });
      write("fixtures.json", {
        sourceId,
        datasetIds: datasets.map((item) => item.id),
      });
      await cached(stored.id, literal, false, "owner-first-miss");
      await cached(stored.id, literal, true, "owner-second-hit");
      stage = "cross-member-denied";
      await call("member", `/dataset/${stored.id}/cached`, undefined, 403);
    }
    assert.notEqual(datasets[0].literal, datasets[1].literal);
    check(
      "Two owned datasets: miss then hit, distinct literal results and sum 600, cross-member HTTP 403"
    );
    const target = datasets[0];
    const key = redisCacheKey(initialEnv, target, source, operator);
    const beforeEntry = JSON.parse(await redis.get(key));
    assert(
      beforeEntry && Number.isSafeInteger(beforeEntry.hits),
      "Exact scoped L2 entry must exist before restart"
    );
    stage = "owned-api-restart";
    sameRuntime(readPrivate(options.runtimePath));
    verifyApi(runtime);
    await verifyDatabase();
    const restarted = await fetch(runtime.control + "/restart", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(90000),
      headers: { "x-qa-control": runtime.controlToken },
    });
    assert.equal(
      restarted.status,
      200,
      "Authenticated owned supervisor restart"
    );
    const reply = await restarted.json();
    assert.equal(reply.status, "ready");
    const end = Date.now() + 45000;
    let after;
    while (Date.now() < end) {
      try {
        const health = await fetch(runtime.control + "/health", {
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        const value = await health.json();
        const candidate = readPrivate(options.runtimePath);
        sameRuntime(candidate);
        if (
          health.ok &&
          value.status === "ready" &&
          candidate.processes["backend-4250"] !== before.pid
        ) {
          assert.equal(
            value.processes["backend-4250"],
            candidate.processes["backend-4250"]
          );
          assert.equal(
            reply.processes["backend-4250"],
            candidate.processes["backend-4250"]
          );
          after = verifyApi(candidate);
          break;
        }
      } catch {
        /* Readiness race: retry reads only; never repeat the restart POST. */
      }
      await delay(200);
    }
    assert(
      after && after.pid !== before.pid,
      "Must observe a new owned API PID"
    );
    for (const field of [
      "REDIS_URL",
      "REDIS_HOST",
      "REDIS_PORT",
      "REDIS_DB",
      "REDIS_KEY_PREFIX",
    ])
      assert.equal(
        after.env[field],
        initialEnv[field],
        "Redis context must survive restart unchanged"
      );
    await verifyDatabase();
    const current = await currentActor("operator");
    assert.equal(
      current.authVersion,
      operator.authVersion,
      "Do not refresh or upgrade the admitted actor epoch"
    );
    const [[currentSource]] = await db.query(
      "SELECT id, ownerId, catalogVersion, engine, type, connectionConfig FROM `database` WHERE id = ?",
      [sourceId]
    );
    for (const field of [
      "id",
      "ownerId",
      "catalogVersion",
      "engine",
      "type",
      "connectionConfig",
    ])
      assert.equal(
        currentSource[field],
        source[field],
        "Source revision must remain unchanged"
      );
    const readyEntry = JSON.parse(await redis.get(key));
    assert.equal(
      readyEntry?.hits,
      beforeEntry.hits,
      "Refuse background cache reads before the first post-restart owner request"
    );
    // No dataset GET, signin or warmup occurs between PID change and this first owner request.
    await cached(
      target.id,
      target.literal,
      true,
      "first-owner-request-after-new-pid"
    );
    const afterEntry = JSON.parse(await redis.get(key));
    assert.equal(
      afterEntry?.hits,
      beforeEntry.hits + 1,
      "A real L2 read must increment the scoped Redis entry hit count"
    );
    write("restart.json", {
      oldApiPid: before.pid,
      newApiPid: after.pid,
      firstOwnerRequestHit: true,
      redisEntryHitsBefore: beforeEntry.hits,
      redisEntryHitsAfter: afterEntry.hits,
    });
    check(
      "New owned API PID lost L1; first owner request hit persisted scoped L2 with exact synthetic result and Redis hit increment"
    );
    stage = "post-restart-cross-member-denied";
    await call("member", `/dataset/${target.id}/cached`, undefined, 403);
    check("Cross-member denial remains HTTP 403 after restart");
    write("summary.json", {
      status: "passed",
      checks,
      requests: journal.length,
      modelCalls: 0,
      limitations: [
        "Owned synthetic local HTTP/MySQL/Redis/native source smoke only; not enterprise acceptance or deployment.",
        "Redis custody follows the verified owned backend-selected loopback endpoint, as in qa-main-legacy; separate Redis container custody is not independently attested.",
        "Epoch/revocation races are covered by separate review tests; this script does not change epochs.",
        "Synthetic Dataset fixtures and evidence remain; no cache flush, row deletion, source mutation or service stop.",
        "Signin renews only existing fixture sessions; other simultaneous QA using their prior tokens may need coordination.",
      ],
    });
    process.stdout.write(
      JSON.stringify({
        status: "passed",
        checks: checks.length,
        evidence: path.relative(root, evidence),
      }) + "\n"
    );
  } catch (error) {
    // Never echo assertion operands, response bodies, environment output or raw errors containing secrets.
    const failure = {
      status: "failed",
      stage,
      errorType: error.name,
      completedChecks: checks.length,
    };
    if (evidence) write("failure.json", failure);
    process.stderr.write(JSON.stringify(failure) + "\n");
    process.exitCode = 1;
  } finally {
    if (redis) redis.disconnect();
    if (db) await db.end().catch(() => {});
  }
}
module.exports = { parseArgs, redisCacheKey };
if (require.main === module) main(process.argv.slice(2));
