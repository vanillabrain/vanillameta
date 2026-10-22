#!/usr/bin/env node
// TC050: full HTTP app on a new owned MySQL only. No builds, fixtures or product overrides.
const { spawn, execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const http = require("node:http");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
// Separate ports let a new owned run verify recovery without disturbing a retained run.
const ports = Object.fromEntries(
  [
    ["api", 4250],
    ["web", 3250],
    ["control", 4450],
  ].map(([key, fallback]) => {
    const value =
      process.env["QA_" + key.toUpperCase() + "_PORT"] ?? String(fallback);
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 65535)
      throw new Error("Invalid QA " + key + " port");
    return [key, Number(value)];
  })
);
if (new Set(Object.values(ports)).size !== 3)
  throw new Error("QA ports must be distinct");
const apiUrl = "http://127.0.0.1:" + ports.api + "/v1";
const webUrl = "http://127.0.0.1:" + ports.web;
const controlUrl = "http://127.0.0.1:" + ports.control;
const backendKey = "backend-" + ports.api,
  frontendKey = "frontend-" + ports.web;

const backend = path.join(root, "backend-api");
const frontend = path.join(root, "frontend-web");
const mysql = createRequire(path.join(backend, "package.json"))(
  "mysql2/promise"
);
const owner = randomBytes(12).toString("hex");
const label = "vanillameta.enterprise.qa.owner";
const name = "vm-enterprise-qa-" + owner;
const database = "vm_enterprise_" + owner;
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vm-enterprise-qa-"));
const evidence = path.join(
  root,
  ".aiwf/evidence/TC050-integrated-mysql",
  owner
);
fs.chmodSync(runRoot, 0o700);
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
fs.chmodSync(evidence, 0o700);
fs.writeFileSync(path.join(runRoot, "owner"), owner, { mode: 0o600 });
const secret = () => randomBytes(32).toString("hex");
const password = secret(),
  controlToken = secret();
const secrets = [password, controlToken];
const makeSecret = () => {
  const value = secret();
  secrets.push(value);
  return value;
};
const baseEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG", "TZ"]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]])
);
const processes = new Map();
const logs = [];
let containerId,
  attempted = false,
  admin,
  control,
  metadata,
  backendEnv,
  stopping = false,
  cleanupPromise,
  busy = false;
const configPath = path.join(runRoot, "database-config.json");
const runtimeDirectory = path.join(
  root,
  ".aiwf/evidence/TC050-integrated-mysql",
  ports.control === 4450 ? "runtime" : "runtime-" + ports.control
);
fs.mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 });
fs.chmodSync(runtimeDirectory, 0o700);
const runtimePath = path.join(runtimeDirectory, "runtime.json");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const redact = (value) =>
  secrets
    .reduce(
      (s, value) => s.split(value).join("[REDACTED_SECRET]"),
      String(value)
    )
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[REDACTED_TOKEN]"
    )
    .replace(/s2:[0-9a-f]+:[0-9a-f]+/g, "[REDACTED_PASSWORD_HASH]");
const event = (value) => {
  const line = redact(JSON.stringify(value)) + "\n";
  fs.appendFileSync(path.join(evidence, "runtime.log"), line, { mode: 0o600 });
  process.stdout.write(line);
};
const docker = (...args) =>
  execFileSync("docker", args, {
    env: baseEnv,
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const alive = (child) =>
  child && child.exitCode === null && child.signalCode === null;
const checkActive = () => {
  if (stopping) throw new Error("Runtime is stopping");
};
function capture(stream, log) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      log.write(redact(pending.slice(0, end + 1)));
      pending = pending.slice(end + 1);
    }
  });
  stream.on("end", () => {
    if (pending) log.write(redact(pending));
  });
}
const {
  observerSource,
  createBackendObserver,
} = require("./lib/qa-child-drain.cjs");
const backendObserver = createBackendObserver({ alive, requestId: secret });
const observedBackends = backendObserver.states;
const observeBackend = backendObserver.observe;
const drainBackend = backendObserver.drain;
function launch(key, args, cwd, env) {
  checkActive();
  const log = fs.createWriteStream(path.join(evidence, key + ".log"), {
    flags: "a",
    mode: 0o600,
  });
  logs.push(log);
  const observed = key.startsWith("backend-");
  const nonce = observed ? secret() : undefined;
  const preload = path.join(runRoot, key + "-observer.cjs");
  if (observed)
    fs.writeFileSync(preload, observerSource(nonce), { mode: 0o600 });
  const child = spawn(
    process.execPath,
    observed ? ["--require", preload, ...args] : args,
    {
      cwd,
      env,
      detached: true,
      stdio: observed
        ? ["ignore", "pipe", "pipe", "ipc"]
        : ["ignore", "pipe", "pipe"],
    }
  );
  if (observed) observeBackend(child, nonce);
  processes.set(key, child);
  capture(child.stdout, log);
  capture(child.stderr, log);
  child.on("error", (error) => log.write(redact(error.message) + "\n"));
  child.on("exit", (code, signal) =>
    log.write(JSON.stringify({ exit: code, signal }) + "\n")
  );
  return child;
}
async function stopProcess(key) {
  const child = processes.get(key);
  if (!child?.pid) return;
  await drainBackend(child);
  const signal = (sig) => {
    try {
      process.kill(-child.pid, sig);
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  };
  if (!alive(child)) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => signal("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    signal("SIGTERM");
  });
}
async function assertFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
async function waitReady(url, key) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    checkActive();
    if (!alive(processes.get(key)))
      throw new Error(key + " exited before readiness; inspect private log");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(key + " readiness timeout; inspect private log");
}
function ownedContainer(live) {
  if (
    !live ||
    (containerId && live.Id !== containerId) ||
    live.Name !== "/" + name ||
    live.Config?.Labels?.[label] !== owner
  )
    throw new Error("Refusing unexpected Docker owner");
  return live;
}
async function checkDatabase() {
  ownedContainer(JSON.parse(docker("inspect", containerId))[0]);
  const [[server]] = await admin.query(
    "SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS db"
  );
  const [[marker]] = await admin.query("SELECT token FROM qa_runtime_owner");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (
    server.version !== "8.4.11" ||
    server.uuid !== config.serverUuid ||
    server.db !== database ||
    marker.token !== owner
  )
    throw new Error("Owned MySQL identity changed");
}
function saveRuntime(status) {
  Object.assign(metadata, {
    status,
    processes: {
      supervisor: process.pid,
      ...Object.fromEntries(
        [...processes].map(([key, child]) => [key, child.pid])
      ),
    },
  });
  for (const file of [runtimePath, path.join(evidence, "runtime.json")])
    fs.writeFileSync(file, JSON.stringify(metadata, null, 2), { mode: 0o600 });
}
const cleanup = () =>
  (cleanupPromise ??= (async () => {
    stopping = true;
    // Refuse before stopping FE/API or touching DB/files if any API cannot prove drain.
    await Promise.all(
      [...processes.values()].map((child) => drainBackend(child))
    );
    control?.close();
    await Promise.all([...processes.keys()].map(stopProcess));
    admin?.destroy();
    admin = undefined;
    let removed = !attempted;
    if (attempted) {
      let live;
      try {
        live = JSON.parse(docker("inspect", containerId || name))[0];
      } catch (error) {
        if (!/No such (object|container)/i.test(String(error.stderr ?? "")))
          throw new Error(
            "Docker cleanup outcome unknown; private ownership files retained"
          );
        removed = true;
      }
      if (live) {
        ownedContainer(live);
        docker("rm", "-f", live.Id);
        removed = true;
      }
    }
    if (fs.readFileSync(path.join(runRoot, "owner"), "utf8") !== owner)
      throw new Error("Refusing unknown run directory cleanup");
    fs.rmSync(runRoot, { recursive: true, force: true });
    if (metadata) saveRuntime("stopped");
    event({
      phase: "cleanup",
      ownedContainerRemoved: removed,
      temporaryCredentialsRemoved: !fs.existsSync(runRoot),
      persistentVolumesCreated: 0,
    });
    await Promise.all(
      logs.map((log) => new Promise((resolve) => log.end(resolve)))
    );
  })().catch((error) => {
    cleanupPromise = undefined;
    stopping = false;
    throw error;
  }));
async function restart() {
  await checkDatabase();
  const oldPid = processes.get(backendKey).pid;
  await stopProcess(backendKey);
  await assertFree(ports.api);
  launch(
    backendKey,
    [path.join(backend, "dist/src/main.js")],
    runRoot,
    backendEnv
  );
  await waitReady(apiUrl + "/", backendKey);
  await checkDatabase();
  saveRuntime("ready");
  event({
    phase: "restarted",
    oldPid,
    newPid: processes.get(backendKey).pid,
  });
}
async function probeChildDrain() {
  const descendant = "setTimeout(()=>process.exit(0), 900)";
  const leader = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(
    descendant
  )}], {stdio:'ignore'}); setTimeout(()=>process.exit(0), 200);`;
  const fixture = `
const cp = require('node:child_process');
const detached = cp.spawn(process.execPath, ['-e', ${JSON.stringify(
    leader
  )}], {detached:true, stdio:'ignore'});
detached.on('exit', () => process.send({probe:'leader-exited'}));
process.on('message', message => {
  if (message?.op === 'probe-spawn') {
    try { cp.spawn(process.execPath, ['-e','process.exit(0)'], {detached:true,stdio:'ignore'}); process.send({probe:'unexpected-spawn'}); }
    catch (e) { process.send({probe:'blocked',code:e.message}); }
  }
});
process.send({probe:'fixture-ready'});
setInterval(()=>{}, 1000);
`;
  const child = launch(
    "backend-owned-probe",
    ["-e", fixture],
    runRoot,
    baseEnv
  );
  const messages = [];
  child.on("message", (value) => {
    if (value.probe) messages.push(value);
  });
  const until = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await delay(10);
    }
    throw new Error("Isolated observer fixture timeout");
  };
  await until(() => messages.some((m) => m.probe === "fixture-ready"));
  const state = observedBackends.get(child);
  if (state.groups.size !== 1)
    throw new Error("Detached fixture spawn was not observed");
  let resolved = false;
  let refused = false;
  await drainBackend(child, 30).catch(() => {
    refused = true;
  });
  if (!refused || !alive(child) || !state.groups.size || state.drained)
    throw new Error("Bounded drain must refuse before owned child completion");
  const drained = drainBackend(child).then(() => {
    resolved = true;
  });
  child.send({ op: "probe-spawn" });
  await until(() => messages.some((m) => m.probe === "blocked"));
  if (resolved || messages.some((m) => m.probe === "unexpected-spawn"))
    throw new Error("Drain admission race");
  await until(() => messages.some((m) => m.probe === "leader-exited"));
  if (resolved || state.groups.size !== 1)
    throw new Error("Detached descendant escaped drain proof");
  await drained;
  if (state.groups.size || !state.drained)
    throw new Error("Owned groups were not confirmed absent");
  await stopProcess("backend-owned-probe");
  event({
    phase: "child-drain-probe",
    observedDetached: 1,
    admissionBlocked: true,
    groupsConfirmedAbsent: true,
    boundedRefusal: true,
    descendantOutlivesLeader: true,
    backendStopped: !alive(child),
    paidLlmCalls: 0,
  });
}
async function main() {
  if (
    process.env.QA_REDIS_PORT &&
    (!/^[1-9]\d*$/.test(process.env.QA_REDIS_PORT) ||
      Number(process.env.QA_REDIS_PORT) > 65535)
  )
    throw new Error("Invalid explicit QA Redis port");
  if (
    process.env.QA_LEGACY_OPERATIONS_USER_IDS &&
    !/^[1-9]\d*(,[1-9]\d*)*$/.test(process.env.QA_LEGACY_OPERATIONS_USER_IDS)
  )
    throw new Error("Invalid explicit QA operator ids");
  if (process.argv.includes("--probe-child-drain")) {
    await probeChildDrain();
    await cleanup();
    return;
  }
  if (
    fs.existsSync(runtimePath) &&
    JSON.parse(fs.readFileSync(runtimePath, "utf8")).status !== "stopped"
  )
    throw new Error(
      "Existing runtime metadata requires owned stop before reuse"
    );
  for (const port of Object.values(ports)) await assertFree(port);
  for (const file of ["dist/src/main.js", "dist/src/analysis/duckdb.worker.js"])
    if (!fs.existsSync(path.join(backend, file)))
      throw new Error(
        "Main must provide existing backend dist; runtime never builds"
      );
  const envFile = path.join(runRoot, "mysql.env");
  fs.writeFileSync(
    envFile,
    `MYSQL_ROOT_PASSWORD=${password}\nMYSQL_ROOT_HOST=%\n`,
    { mode: 0o600 }
  );
  const args = [
    "--name",
    name,
    "--label",
    label + "=" + owner,
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1::3306",
    "--mount",
    "type=tmpfs,destination=/var/lib/mysql",
    "mysql:8.4.11",
  ];
  checkActive();
  attempted = true;
  if (process.argv.includes("--probe-partial-create")) {
    docker("create", ...args); // Deliberately unknown ID: cleanup must reconcile exact name + owner.
    throw new Error("Synthetic partial creation probe");
  }
  containerId = docker("run", "-d", ...args);
  const live = ownedContainer(JSON.parse(docker("inspect", containerId))[0]);
  const bindings = live.NetworkSettings.Ports["3306/tcp"];
  if (
    bindings.length !== 1 ||
    bindings[0].HostIp !== "127.0.0.1" ||
    !live.HostConfig.Mounts.some(
      (m) => m.Type === "tmpfs" && m.Target === "/var/lib/mysql"
    )
  )
    throw new Error("Unexpected MySQL binding or storage");
  const port = Number(bindings[0].HostPort);
  for (let i = 0; i < 120; i++) {
    checkActive();
    try {
      admin = await mysql.createConnection({
        host: "127.0.0.1",
        port,
        user: "root",
        password,
        connectTimeout: 1000,
      });
      break;
    } catch {
      await delay(500);
    }
  }
  if (!admin) throw new Error("Owned MySQL readiness timeout");
  const [[server]] = await admin.query(
    "SELECT VERSION() AS version, @@server_uuid AS uuid"
  );
  if (server.version !== "8.4.11")
    throw new Error("Expected exact MySQL8.4.11");
  await admin.query(
    "CREATE DATABASE `" +
      database +
      "` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
  );
  await admin.changeUser({ database });
  await admin.query(
    "CREATE TABLE qa_runtime_owner(token VARCHAR(24) NOT NULL)"
  );
  await admin.query("INSERT INTO qa_runtime_owner VALUES (?)", [owner]);
  const config = {
    gate: "owned-enterprise-http-mysql-v1",
    owner,
    containerId,
    containerName: name,
    host: "127.0.0.1",
    port,
    username: "root",
    password,
    database,
    serverUuid: server.uuid,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
  fs.mkdirSync(path.join(runRoot, "uploads"), { mode: 0o700 });
  backendEnv = {
    ...baseEnv,
    NODE_ENV: "dev",
    HOST: "127.0.0.1",
    PORT: String(ports.api),
    DB_HOST: config.host,
    DB_PORT: String(port),
    DB_USERNAME: config.username,
    DB_PASSWORD: password,
    DB_NAME: database,
    FILE_UPLOAD_DIR: path.join(runRoot, "uploads"),
    CORS_ORIGIN: webUrl,
    ACCESS_SECRET: makeSecret(),
    REFRESH_SECRET: makeSecret(),
    URL_ACCESS_SECRET: makeSecret(),
    JWT_ACCESS_SECRET: makeSecret(),
    CONFIG_SECRET_KEY: makeSecret(),
    AI_PROVIDER: "codex",
    AI_API_KEY: "",
    AI_MODEL: "gpt-6-luna",
    // Optional merge QA services are explicit loopback endpoints, never inherited credentials.
    REDIS_URL: process.env.QA_REDIS_PORT
      ? `redis://127.0.0.1:${process.env.QA_REDIS_PORT}`
      : "",
    ...(process.env.QA_REDIS_PORT
      ? {
          REDIS_HOST: "127.0.0.1",
          REDIS_PORT: process.env.QA_REDIS_PORT,
          REDIS_CACHE_ENABLED: "true",
        }
      : {}),
    CLOUDWATCH_METRICS_ENABLED: "false",
    LEGACY_OPERATIONS_USER_IDS: process.env.QA_LEGACY_OPERATIONS_USER_IDS || "",
    SENTRY_DSN: "",
    QUERY_CACHE_TTL_MS: "0",
    QUERY_ALLOW_WRITE: "false",
    THROTTLE_LIMIT: "120",
    THROTTLE_TTL: "60",
  };
  await checkDatabase(); // Before synchronize=true can run, verify exact new owned schema.
  launch(
    backendKey,
    [path.join(backend, "dist/src/main.js")],
    runRoot,
    backendEnv
  );
  // Explicit envDir prevents Vite from loading repository .env files or ambient API keys.
  const vite = pathToFileURL(
    path.join(frontend, "node_modules/vite/dist/node/index.js")
  ).href;
  const launcher = `import(${JSON.stringify(
    vite
  )}).then(async ({createServer})=>{const s=await createServer({root:${JSON.stringify(
    frontend
  )},configFile:${JSON.stringify(
    path.join(frontend, "vite.config.ts")
  )},envDir:${JSON.stringify(runRoot)},server:{host:'127.0.0.1',port:${
    ports.web
  },strictPort:true}});await s.listen();}).catch(()=>process.exit(1));`;
  launch(frontendKey, ["--input-type=module", "-e", launcher], runRoot, {
    ...baseEnv,
    NODE_ENV: "development",
    REACT_APP_API_URL: apiUrl,
  });
  await Promise.all([
    waitReady(apiUrl + "/", backendKey),
    waitReady(webUrl + "/", frontendKey),
  ]);
  await checkDatabase();
  metadata = {
    api: apiUrl,
    frontend: webUrl,
    control: controlUrl,
    controlToken,
    runRoot,
    evidence,
    databaseConfigPath: configPath,
    processes: {},
    engine: server.version,
    childOwnership: {
      mode: "preload IPC admission drain",
      maxWaitMs: 180000,
      uncertainOutcome: "refuse cleanup and retain resources",
    },
    schema:
      "fresh owned schema; development synchronize=true; no migration acceptance",
    ai: {
      provider: "codex",
      requestedModel: "gpt-6-luna",
      availability: "provisional; Main owns actual generation",
    },
  };
  control = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.socket.remoteAddress !== "127.0.0.1")
      return res.writeHead(403).end("{}");
    if (req.method === "GET" && req.url === "/health") {
      const ready = !stopping && !busy && [...processes.values()].every(alive);
      return res.writeHead(ready ? 200 : 503).end(
        JSON.stringify({
          status: ready ? "ready" : "unavailable",
          processes: metadata.processes,
          childOwnership: [...processes.values()]
            .map((c) => observedBackends.get(c))
            .filter(Boolean)
            .map((s) => ({
              ready: s.ready,
              failed: s.failed,
              drained: s.drained,
              groups: s.groups.size,
              checkErrors: [...s.checkErrors.values()],
            })),
        })
      );
    }
    if (req.method !== "POST" || !["/restart", "/stop"].includes(req.url))
      return res.writeHead(404).end("{}");
    if (req.headers.origin || req.headers["x-qa-control"] !== controlToken)
      return res.writeHead(403).end("{}");
    if (busy || stopping) return res.writeHead(409).end("{}");
    busy = true;
    try {
      if (req.url === "/restart") {
        await restart();
        res.end(
          JSON.stringify({ status: "ready", processes: metadata.processes })
        );
      } else {
        await cleanup();
        res.end('{"status":"stopped"}');
      }
    } catch (error) {
      event({ phase: "control-error", message: error.message });
      res.writeHead(500).end('{"error":"inspect private runtime log"}');
    } finally {
      busy = false;
    }
  });
  await new Promise((resolve, reject) => {
    control.once("error", reject);
    control.listen(ports.control, "127.0.0.1", resolve);
  });
  saveRuntime("ready");
  event({
    phase: "ready",
    runtimePath,
    api: metadata.api,
    frontend: metadata.frontend,
    control: metadata.control,
    processes: metadata.processes,
    engine: server.version,
    aiAvailability: "provisional",
  });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopping = true;
    // Startup checks notice stopping before launching more children; main() owns startup cleanup.
    if (metadata)
      void cleanup().catch((error) => {
        event({ phase: "cleanup-error", message: error.message });
        process.exitCode = 1;
      });
  });
main().catch(async (error) => {
  event({ phase: "failed", message: error.message });
  try {
    await cleanup();
  } catch (error) {
    event({ phase: "cleanup-error", message: error.message });
  }
  process.exitCode = 1;
});
