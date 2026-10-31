#!/usr/bin/env node
const { execFileSync, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend-api");
const { Client } = createRequire(path.join(backend, "package.json"))("pg");
const pgBin = process.env.PG_BIN || "/opt/homebrew/opt/postgresql@17/bin";
const owner = randomBytes(12).toString("hex");
const database = "vm_postgres_schema_" + owner;
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vm-postgres-schema-"));
const cluster = path.join(runRoot, "cluster");
const socketDir = path.join(runRoot, "socket");
const evidence = path.join(root, ".aiwf", "evidence", "postgres-schema", owner);
let started = false;
let admin;

fs.chmodSync(runRoot, 0o700);
fs.mkdirSync(socketDir, { mode: 0o700 });
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(runRoot, "owner"), owner, { mode: 0o600 });

const pg = (name, args, env = {}) =>
  execFileSync(path.join(pgBin, name), args, {
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

function migrate() {
  const run = spawnSync(
    process.execPath,
    [path.join(backend, "dist/src/database/migrate-prod.js")],
    {
      cwd: runRoot,
      env: {
        ...process.env,
        NODE_ENV: "prod",
        DB_HOST: socketDir,
        DB_PORT: "5432",
        DB_USERNAME: "postgres",
        DB_PASSWORD: "",
        DB_NAME: database,
        DB_CONNECTION_LIMIT: "5",
        DB_SSL: "false",
      },
      encoding: "utf8",
      timeout: 180000,
    }
  );
  fs.appendFileSync(
    path.join(evidence, "migrate.log"),
    `$ migrate\n${run.stdout}${run.stderr}\nexit=${run.status}\n`,
    { mode: 0o600 }
  );
  if (run.status !== 0)
    throw new Error(`migrate-prod failed: ${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout.trim().split("\n").at(-1));
}

async function main() {
  pg("initdb", [
    "-D",
    cluster,
    "-U",
    "postgres",
    "--auth-local=trust",
    "--auth-host=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);
  pg("pg_ctl", [
    "-D",
    cluster,
    "-l",
    path.join(runRoot, "postgres.log"),
    "-o",
    `-k ${socketDir} -c listen_addresses=''`,
    "-w",
    "start",
  ]);
  started = true;
  pg("createdb", ["-h", socketDir, "-p", "5432", "-U", "postgres", database]);

  const first = migrate();
  const second = migrate();
  admin = new Client({
    host: socketDir,
    port: 5432,
    user: "postgres",
    database,
  });
  await admin.connect();
  const scalar = async (sql) => {
    const result = await admin.query(sql);
    return result.rows[0];
  };
  const server = await scalar(
    "SELECT current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num, current_database() AS database, current_schema() AS schema"
  );
  const tables = (
    await admin.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
    )
  ).rows.map((row) => row.table_name);
  const components = Number(
    (await scalar("SELECT COUNT(*) AS count FROM component")).count
  );
  const databaseTypes = Number(
    (await scalar('SELECT COUNT(*) AS count FROM "databaseType"')).count
  );
  const users = Number(
    (await scalar('SELECT COUNT(*) AS count FROM "user"')).count
  );
  const migrations = (
    await admin.query("SELECT name FROM migrations ORDER BY id")
  ).rows.map((row) => row.name);
  const columnTypes = (
    await admin.query(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('createdAt','updatedAt','expiresAt') ORDER BY table_name, column_name"
    )
  ).rows;
  const extensions = (
    await admin.query("SELECT extname FROM pg_extension ORDER BY extname")
  ).rows.map((row) => row.extname);
  const result = {
    verdict: "VERIFIED",
    postgres: server,
    firstRun: first,
    secondRun: second,
    tables: tables.length,
    representativeTables: [
      "artifact_file",
      "artifact_file_version",
      "component",
      "databaseType",
      "private_report",
      "user",
    ].filter((name) => tables.includes(name)),
    components,
    databaseTypes,
    users,
    migrations,
    extensions,
    columnTypes,
  };
  if (!/^17\./.test(server.version))
    throw new Error("PostgreSQL 17 was not used");
  if (first.mode !== "bootstrapped" || second.mode !== "migrated") {
    throw new Error("Bootstrap was not idempotent");
  }
  if (second.ranMigrations !== 0) throw new Error("Rerun executed migrations");
  if (components < 1 || databaseTypes < 1 || users !== 0) {
    throw new Error("Reference seed or empty user invariant failed");
  }
  if (!migrations.includes("PostgresBaseline1793500000000")) {
    throw new Error("PostgreSQL baseline was not recorded");
  }
  if (!extensions.includes("pgcrypto")) throw new Error("pgcrypto is missing");
  for (const name of [
    "artifact_file",
    "artifact_file_version",
    "private_report",
    "user",
  ]) {
    if (!tables.includes(name))
      throw new Error(`Required table missing: ${name}`);
  }
  fs.writeFileSync(
    path.join(evidence, "result.json"),
    JSON.stringify(result, null, 2),
    {
      mode: 0o600,
    }
  );
  process.stdout.write(JSON.stringify(result) + "\n");
}

main()
  .catch((error) => {
    const failure = {
      verdict: "FAILED",
      message: error.message,
      stack: error.stack,
    };
    fs.writeFileSync(
      path.join(evidence, "result.json"),
      JSON.stringify(failure, null, 2),
      {
        mode: 0o600,
      }
    );
    process.stderr.write(JSON.stringify(failure) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin?.end().catch(() => undefined);
    if (started) {
      try {
        pg("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
      } catch (error) {
        process.stderr.write(`postgres stop failed: ${error.message}\n`);
      }
    }
    if (fs.existsSync(path.join(runRoot, "owner"))) {
      if (fs.readFileSync(path.join(runRoot, "owner"), "utf8") !== owner)
        throw new Error("Refusing unknown QA directory cleanup");
      fs.rmSync(runRoot, { recursive: true, force: true });
    }
  });
