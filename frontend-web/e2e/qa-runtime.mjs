import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.resolve(frontend, '../backend-api');
const runRoot = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'vanillameta-qa-'));
const evidence = path.resolve(process.env.QA_EVIDENCE_DIR || path.join(runRoot, 'evidence'));
const requireBackend = createRequire(path.join(backend, 'package.json'));
const sqlite3 = requireBackend('sqlite3');
const processes = new Map();
const originals = new Map();
const extendedRuntime = process.argv.includes('--extended');
const mainPort = extendedRuntime ? 4100 : 4200;
const frontendPort = extendedRuntime ? 3100 : 3200;
const controlPort = extendedRuntime ? 4300 : 4400;
const backendPorts = extendedRuntime ? [4100, 4110, 4120, 4130] : [mainPort];
const accessSecret = randomBytes(32).toString('hex');
const password = `Qa1!${randomBytes(6).toString('hex')}`;
const rootUserId = `qa${randomBytes(5).toString('hex')}`;
let runCounter = 0;
const env = {
  ...process.env,
  NODE_ENV: 'local',
  HOST: '127.0.0.1',
  CORS_ORIGIN: `http://127.0.0.1:${frontendPort}`,
  ACCESS_SECRET: accessSecret,
  REFRESH_SECRET: randomBytes(32).toString('hex'),
  URL_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  CONFIG_SECRET_KEY: randomBytes(32).toString('hex'),
  AI_API_KEY: 'local-contract-fixture-only',
  AI_API_BASE_URL: 'http://127.0.0.1:4310/v1',
  AI_MODEL: 'local-contract-fixture',
  REDIS_URL: '',
  QUERY_CACHE_TTL_MS: '0',
  QUERY_ALLOW_WRITE: 'false',
  THROTTLE_LIMIT: '120',
  THROTTLE_TTL: '60',
  SENTRY_DSN: '',
};

const redact = value =>
  String(value)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TEST_TOKEN]')
    .replace(/s2:[0-9a-f]+:[0-9a-f]+/g, '[REDACTED_PASSWORD_HASH]')
    .replaceAll(password, '[REDACTED_TEST_PASSWORD]');

function capture(stream, destination) {
  let pending = '';
  stream.on('data', chunk => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) destination.write(`${redact(line)}\n`);
  });
  stream.on('end', () => {
    if (pending) destination.write(redact(pending));
  });
}

function launch(key, command, args, cwd, childEnv) {
  const log = fs.createWriteStream(path.join(evidence, `${key}.log`), { flags: 'a', mode: 0o600 });
  const child = spawn(command, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  capture(child.stdout, log);
  capture(child.stderr, log);
  child.on('error', error => log.write(`${error.message}\n`));
  child.on('exit', code => log.write(`\n[process exit ${code}]\n`));
  processes.set(key, child);
  return child;
}

async function stop(key) {
  const child = processes.get(key);
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function assertFree(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function waitReady(url, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`QA service did not become ready: ${url}`);
}

function backendEnvironment(port, extra = {}) {
  const dir = path.join(runRoot, String(port));
  fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true, mode: 0o700 });
  return {
    ...env,
    PORT: String(port),
    SQLITE_PATH: path.join(dir, 'metadata.db'),
    FILE_UPLOAD_DIR: path.join(dir, 'uploads'),
    ...extra,
  };
}

const environments = {
  [mainPort]: backendEnvironment(mainPort),
  4110: backendEnvironment(4110, { AI_API_KEY: '' }),
  4120: backendEnvironment(4120, { QUERY_CACHE_TTL_MS: '1000' }),
  4130: backendEnvironment(4130, { THROTTLE_LIMIT: '5', THROTTLE_TTL: '2' }),
};

function databaseTask(action) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(environments[mainPort].SQLITE_PATH);
    action(db, (error, value) =>
      db.close(closeError => (error || closeError ? reject(error || closeError) : resolve(value))),
    );
  });
}

async function main() {
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  for (const port of [frontendPort, ...backendPorts, controlPort, ...(extendedRuntime ? [4310] : [])])
    await assertFree(port);
  if (extendedRuntime)
    launch('provider', process.execPath, [path.join(frontend, 'e2e/local-provider.mjs')], frontend, {
      ...env,
      QA_PROVIDER_PORT: '4310',
    });
  for (const port of backendPorts)
    launch(`backend-${port}`, process.execPath, ['dist/src/main.js'], backend, environments[port]);
  launch(
    `frontend-${frontendPort}`,
    process.execPath,
    [
      path.join(frontend, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(frontendPort),
      '--strictPort',
    ],
    frontend,
    { ...env, REACT_APP_API_URL: `http://127.0.0.1:${mainPort}/v1` },
  );
  await Promise.all([
    ...(extendedRuntime ? [waitReady('http://127.0.0.1:4310/health')] : []),
    waitReady(`http://127.0.0.1:${frontendPort}`),
    ...backendPorts.map(port => waitReady(`http://127.0.0.1:${port}/v1/`)),
  ]);
  const metadata = {
    runRoot,
    evidence,
    api: `http://127.0.0.1:${mainPort}/v1`,
    frontend: `http://127.0.0.1:${frontendPort}`,
    processes: Object.fromEntries([...processes].map(([key, child]) => [key, child.pid])),
    databases: Object.fromEntries(Object.entries(environments).map(([port, value]) => [port, value.SQLITE_PATH])),
  };
  fs.writeFileSync(path.join(evidence, 'runtime.json'), JSON.stringify(metadata, null, 2), { mode: 0o600 });
  const launchTests = (grep, extended = false) => {
    if (extended && !extendedRuntime) throw new Error('Start with --extended for provider/cache/rate-limit scenarios');
    const previous = processes.get('playwright');
    if (previous && previous.exitCode === null) throw new Error('a QA test run is already active');
    const runId = String(++runCounter).padStart(3, '0');
    const runEvidence = path.join(evidence, `run-${runId}`);
    fs.mkdirSync(runEvidence, { recursive: true, mode: 0o700 });
    const args = [
      path.join(frontend, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      extended ? 'playwright.comprehensive.config.ts' : 'playwright.config.ts',
    ];
    if (grep) args.push('--grep', String(grep));
    const runner = launch(`playwright-${runId}`, process.execPath, args, frontend, {
      ...env,
      E2E_API_URL: metadata.api,
      E2E_BASE_URL: metadata.frontend,
      E2E_USER_ID: rootUserId,
      E2E_PASSWORD: password,
      QA_RUN_ROOT: runRoot,
      QA_EVIDENCE_DIR: runEvidence,
      QA_ACCESS_SECRET: accessSecret,
      E2E_EXTERNAL_SERVER: '1',
      E2E_EVIDENCE_DIR: path.join(runEvidence, 'artifacts'),
    });
    processes.set('playwright', runner);
    runner.once('exit', code => console.log(JSON.stringify({ runId, playwrightExit: code, evidence: runEvidence })));
    return { runId, evidence: runEvidence };
  };
  const control = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (req.url === '/health') {
        res.end(JSON.stringify({ status: 'ready' }));
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (req.method === 'POST' && req.url === '/run') {
        res.end(JSON.stringify(launchTests(body.grep, body.extended === true)));
        return;
      }
      if (req.method === 'POST' && req.url === '/restart') {
        await stop(`backend-${mainPort}`);
        launch(`backend-${mainPort}`, process.execPath, ['dist/src/main.js'], backend, environments[mainPort]);
        await waitReady(`http://127.0.0.1:${mainPort}/v1/`);
        metadata.processes[`backend-${mainPort}`] = processes.get(`backend-${mainPort}`).pid;
        fs.writeFileSync(path.join(evidence, 'runtime.json'), JSON.stringify(metadata, null, 2), { mode: 0o600 });
        res.end(JSON.stringify({ status: 'ready' }));
        return;
      }
      if (req.method === 'POST' && ['/corrupt-config', '/restore-config'].includes(req.url)) {
        const id = Number(body.id);
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid fixture id');
        if (req.url === '/corrupt-config') {
          const row = await databaseTask((db, done) =>
            db.get('SELECT name, connectionConfig FROM database WHERE id = ?', [id], done),
          );
          if (!row?.name?.startsWith('qa_')) throw new Error('only run-owned qa_ upload fixtures may be modified');
          originals.set(id, row.connectionConfig);
          await databaseTask((db, done) =>
            db.run('UPDATE database SET connectionConfig = ? WHERE id = ?', ['enc:v1:invalid:invalid:invalid', id], error =>
              done(error),
            ),
          );
        } else {
          if (!originals.has(id)) throw new Error('no owned fixture to restore');
          await databaseTask((db, done) =>
            db.run('UPDATE database SET connectionConfig = ? WHERE id = ?', [originals.get(id), id], error => done(error)),
          );
          originals.delete(id);
        }
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      res.writeHead(404).end(JSON.stringify({ error: 'unknown local QA control endpoint' }));
    } catch (error) {
      res.writeHead(400).end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise(resolve => control.listen(controlPort, '127.0.0.1', resolve));
  console.log(JSON.stringify({ status: 'ready', ...metadata }));
  if (process.argv.includes('--extended')) {
    const inventory = launch(
      'chart-inventory',
      process.execPath,
      [path.join(frontend, 'e2e/qa-publish-inventory.mjs'), runRoot],
      frontend,
      env,
    );
    await new Promise((resolve, reject) =>
      inventory.once('exit', code => (code === 0 ? resolve() : reject(new Error('Chart inventory preparation failed')))),
    );
  }
  if (process.argv.includes('--run') || process.argv.includes('--extended')) {
    const grepIndex = process.argv.indexOf('--grep');
    launchTests(grepIndex < 0 ? undefined : process.argv[grepIndex + 1], process.argv.includes('--extended'));
    const runner = processes.get('playwright');
    runner.once('exit', async code => {
      control.close();
      await Promise.all([...processes.keys()].filter(key => key !== 'playwright').map(stop));
      process.exit(code ?? 1);
    });
  }
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, async () => {
      control.close();
      await Promise.all([...processes.keys()].map(stop));
      process.exit(0);
    });
}

main().catch(async error => {
  console.error(error.message);
  await Promise.all([...processes.keys()].map(stop));
  process.exit(1);
});
