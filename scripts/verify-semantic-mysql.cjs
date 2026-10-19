#!/usr/bin/env node
// A new labeled, ephemeral Docker fixture only. Never accepts an existing database.
const { execFileSync, spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend-api");
const mysql = createRequire(path.join(backend, "package.json"))(
  "mysql2/promise"
);
const staff = process.argv.includes("--staff");
const departure = process.argv.includes("--departure");
const handover = process.argv.includes("--handover");
if ([staff, departure, handover].filter(Boolean).length > 1)
  throw new Error("Select only one owned validation lane");
const lanes = handover
  ? ["handover"]
  : departure
  ? ["departure"]
  : staff
  ? ["staff"]
  : ["studio", "runtime"];
const owner = randomBytes(12).toString("hex");
const password = randomBytes(32).toString("hex");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vm-semantic-mysql-"));
const name = "vm-semantic-" + owner;
const prefix = "vm_semantic_" + owner;
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  }).trim();
const redact = (text) =>
  String(text).replaceAll(password, "[REDACTED_FIXTURE_CREDENTIAL]");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let id,
  admin,
  child,
  forcedKill,
  requestedSignal,
  attempted = false,
  cleanupPromise;
let exit = 1;
const stopChild = () => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  forcedKill ??= setTimeout(
    () => child?.exitCode === null && child.kill("SIGKILL"),
    2000
  );
  forcedKill.unref();
};
const stop = (signal) => {
  requestedSignal ??= signal === "SIGINT" ? 130 : 143;
  process.exitCode = requestedSignal;
  stopChild();
  const closing = admin;
  admin = undefined;
  closing?.destroy();
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => stop(signal));
const checkStopped = () => {
  if (requestedSignal) throw new Error("Owned validation interrupted");
};
// Buffer complete lines so a credential split between stream chunks is still masked.
const forward = (stream) => {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (data) => {
    pending += data;
    let newline;
    while ((newline = pending.indexOf("\n")) >= 0) {
      process.stdout.write(redact(pending.slice(0, newline + 1)));
      pending = pending.slice(newline + 1);
    }
  });
  stream.on("end", () => {
    if (pending) process.stdout.write(redact(pending));
  });
};
const cleanup = () =>
  (cleanupPromise ??= (async () => {
    const closing = admin;
    admin = undefined;
    closing?.destroy();
    let removed = false;
    if (attempted) {
      try {
        // Reconcile an unknown docker-run outcome using this run's random name.
        const candidates = JSON.parse(docker("inspect", id || name));
        const live = candidates[0];
        if (
          !live ||
          (id && live.Id !== id) ||
          live.Name !== "/" + name ||
          live.Config.Labels["vanillameta.semantic.owner"] !== owner
        )
          throw new Error("Refusing cleanup of unexpected Docker owner");
        docker("rm", "-f", live.Id);
        removed = true;
      } catch (error) {
        // A known absent name is harmless only when Docker actually answered that it is absent.
        const diagnostic = String(error.stderr ?? "");
        if (!id && /No such (object|container)/i.test(diagnostic))
          removed = true;
        else {
          console.error(
            redact("Owned container cleanup not confirmed: " + error.message)
          );
          exit = 1;
        }
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(
      JSON.stringify({
        phase: "cleanup",
        ownedContainerRemoved: removed,
        temporaryCredentialsRemoved: !fs.existsSync(dir),
        persistentVolumesCreated: 0,
      })
    );
  })());
(async () => {
  try {
    const envFile = path.join(dir, "mysql.env");
    fs.writeFileSync(
      envFile,
      `MYSQL_ROOT_PASSWORD=${password}\nMYSQL_ROOT_HOST=%\n`,
      { mode: 0o600 }
    );
    const args = [
      "--name",
      name,
      "--label",
      "vanillameta.semantic.owner=" + owner,
      "--env-file",
      envFile,
      "-p",
      "127.0.0.1::3306",
      "--mount",
      "type=tmpfs,destination=/var/lib/mysql",
      "mysql:8.4",
    ];
    checkStopped();
    attempted = true;
    if (process.argv.includes("--probe-partial-create")) {
      docker("create", ...args); // Deliberately leave id unknown to test reconciliation.
      throw new Error("Synthetic partial Docker creation before ID capture");
    }
    id = docker("run", "-d", ...args);
    checkStopped();
    const live = JSON.parse(docker("inspect", id))[0];
    const binding = live.NetworkSettings.Ports["3306/tcp"][0];
    if (binding.HostIp !== "127.0.0.1")
      throw new Error("Unexpected Docker binding");
    const port = Number(binding.HostPort);
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      checkStopped();
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
    checkStopped();
    if (!admin) throw new Error("Owned MySQL did not become ready");
    const [[server]] = await admin.query(
      "SELECT VERSION() AS version, @@server_uuid AS uuid"
    );
    if (!/^8\.4\./.test(server.version)) throw new Error("Expected MySQL8.4");
    for (const lane of lanes) {
      const db = prefix + "_" + lane;
      await admin.query(
        "CREATE DATABASE `" + db + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
      );
      await admin.query(
        "CREATE TABLE `" +
          db +
          "`.semantic_fixture_owner(token VARCHAR(24) NOT NULL)"
      );
      await admin.query(
        "INSERT INTO `" + db + "`.semantic_fixture_owner VALUES (?)",
        [owner]
      );
    }
    const config = path.join(dir, "config.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        gate: "owned-semantic-mysql-v1",
        owner,
        host: "127.0.0.1",
        port,
        username: "root",
        password,
        databasePrefix: prefix,
        serverUuid: server.uuid,
      }),
      { mode: 0o600 }
    );
    console.log(
      JSON.stringify({
        phase: "ready",
        engine: server.version,
        metadata: "MySQL",
        aggregation: handover
          ? "native DuckDB fixture only"
          : staff || departure
          ? "not_used"
          : "native DuckDB",
        lanes,
      })
    );
    if (process.argv.includes("--probe-interrupt")) {
      process.kill(process.pid, "SIGTERM");
      await new Promise((resolve) => setImmediate(resolve));
      checkStopped();
    }
    checkStopped();
    exit = await new Promise((resolve, reject) => {
      child = spawn(
        process.execPath,
        [
          path.join(backend, "node_modules/jest/bin/jest.js"),
          "--runInBand",
          "--verbose",
          "--runTestsByPath",
          ...(handover
            ? [
                "src/enterprise/handover-proposal.spec.ts",
                "src/enterprise/handover-transfer.spec.ts",
                "src/enterprise/source-handover.spec.ts",
                "src/enterprise/bundle-handover.spec.ts",
                "src/widget/bundle-delete-authorization.spec.ts",
              ]
            : departure
            ? ["src/enterprise/staff-departure-impact.spec.ts"]
            : staff
            ? ["src/enterprise/staff-transfer.spec.ts"]
            : [
                "src/dashboard-studio/studio-business-basis.spec.ts",
                "src/bi/semantic-business-runtime.spec.ts",
              ]),
        ],
        {
          cwd: backend,
          env: {
            ...process.env,
            VM_SEMANTIC_MYSQL_CONFIG: config,
            VM_SEMANTIC_MYSQL_OWNER: owner,
          },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      forward(child.stdout);
      forward(child.stderr);
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        exit = 1;
        stopChild();
      }, 120000);
      timeout.unref();
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        clearTimeout(forcedKill);
        resolve(timedOut ? 1 : code ?? 1);
      });
    });
    checkStopped();
    for (const lane of lanes) {
      const [[marker]] = await admin.query(
        "SELECT token FROM `" + prefix + "_" + lane + "`.semantic_fixture_owner"
      );
      if (marker.token !== owner) throw new Error("Fixture marker changed");
    }
  } catch (error) {
    console.error(redact(error.message));
    exit = requestedSignal ?? 1;
  } finally {
    await cleanup();
    process.exitCode = exit;
  }
})();
