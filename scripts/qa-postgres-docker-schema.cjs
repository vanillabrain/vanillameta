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
const docker = process.env.DOCKER_BIN || "docker";
const owner = randomBytes(12).toString("hex");
const name = "vm-postgres-schema-" + owner;
const password = randomBytes(24).toString("hex");
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vm-postgres-docker-"));
const evidence = path.join(
  root,
  ".aiwf",
  "evidence",
  "postgres-schema-docker",
  owner
);
let container;
let client;

fs.chmodSync(runRoot, 0o700);
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(runRoot, "owner"), owner, { mode: 0o600 });

const run = (args, options = {}) =>
  execFileSync(docker, args, {
    encoding: "utf8",
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();

function migrate(database, port) {
  const result = spawnSync(
    process.execPath,
    [path.join(backend, "dist/src/database/migrate-prod.js")],
    {
      cwd: runRoot,
      env: {
        ...process.env,
        NODE_ENV: "prod",
        DB_HOST: "127.0.0.1",
        DB_PORT: String(port),
        DB_USERNAME: "postgres",
        DB_PASSWORD: password,
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
    `$ migrate\n${result.stdout}${result.stderr}\nexit=${result.status}\n`,
    { mode: 0o600 }
  );
  if (result.status !== 0)
    throw new Error(`migrate-prod failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

async function main() {
  const envFile = path.join(runRoot, "postgres.env");
  fs.writeFileSync(
    envFile,
    `POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=postgres\nPOSTGRES_USER=postgres\n`,
    {
      mode: 0o600,
    }
  );
  container = run([
    "run",
    "-d",
    "--name",
    name,
    "--label",
    `vanillameta.qa.owner=${owner}`,
    "--env-file",
    envFile,
    "-p",
    "127.0.0.1::5432",
    "--mount",
    "type=tmpfs,destination=/var/lib/postgresql/data",
    "postgres:17-alpine",
  ]);
  fs.writeFileSync(path.join(evidence, "container"), container, {
    mode: 0o600,
  });
  const live = JSON.parse(run(["inspect", container]))[0];
  if (
    live.Name !== "/" + name ||
    live.Config.Labels["vanillameta.qa.owner"] !== owner ||
    !live.HostConfig.Mounts.some(
      (mount) =>
        mount.Type === "tmpfs" && mount.Target === "/var/lib/postgresql/data"
    )
  )
    throw new Error("Unexpected PostgreSQL container ownership or storage");
  const binding = live.NetworkSettings.Ports["5432/tcp"];
  if (binding?.length !== 1 || binding[0].HostIp !== "127.0.0.1")
    throw new Error("Unexpected PostgreSQL port binding");
  const port = Number(binding[0].HostPort);

  for (let attempt = 0; attempt < 120; attempt++) {
    client = new Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      break;
    } catch {
      await client.end().catch(() => undefined);
      client = undefined;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!client) throw new Error("PostgreSQL readiness timeout");
  const database = "vm_postgres_" + owner;
  await client.query(
    `CREATE DATABASE "${database}" ENCODING 'UTF8' TEMPLATE template0`
  );
  await client.end();
  client = undefined;

  const first = migrate(database, port);
  const second = migrate(database, port);
  client = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database,
  });
  await client.connect();
  const scalar = async (sql) => (await client.query(sql)).rows[0];
  const server = await scalar(
    "SELECT current_setting('server_version') AS version, current_setting('server_version_num')::int AS version_num, current_database() AS database, current_schema() AS schema"
  );
  const tables = (
    await client.query(
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
    await client.query("SELECT name FROM migrations ORDER BY id")
  ).rows.map((row) => row.name);
  const extensions = (
    await client.query("SELECT extname FROM pg_extension ORDER BY extname")
  ).rows.map((row) => row.extname);
  const columnTypes = (
    await client.query(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('createdAt','updatedAt','expiresAt') ORDER BY table_name, column_name"
    )
  ).rows;
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
    ].filter((table) => tables.includes(table)),
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
  for (const table of [
    "artifact_file",
    "artifact_file_version",
    "private_report",
    "user",
  ]) {
    if (!tables.includes(table))
      throw new Error(`Required table missing: ${table}`);
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
    await client?.end().catch(() => undefined);
    if (container) {
      try {
        const live = JSON.parse(run(["inspect", container]))[0];
        if (
          live.Name === "/" + name &&
          live.Config.Labels["vanillameta.qa.owner"] === owner
        ) {
          run(["rm", "-f", container]);
        } else {
          throw new Error("Refusing unexpected container cleanup");
        }
      } catch (error) {
        if (
          !/No such (object|container)/i.test(
            String(error.stderr || error.message)
          )
        ) {
          process.stderr.write(`container cleanup failed: ${error.message}\n`);
          process.exitCode = 1;
        }
      }
    }
    if (fs.readFileSync(path.join(runRoot, "owner"), "utf8") !== owner)
      throw new Error("Refusing unknown run directory cleanup");
    fs.rmSync(runRoot, { recursive: true, force: true });
  });
