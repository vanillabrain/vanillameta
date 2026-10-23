#!/usr/bin/env node
// Black-box proof that one signed-in user cannot reach another user's data over HTTP.
//
// A signs up (invite codes), uploads a file, builds a dataset / widget / dashboard and publishes nothing;
// B then calls every route that takes one of A's ids, and also lists everything B may see.
//   * B's answer must be 403, or a 404 that a non-existent id also gets (never 2xx, never A's marker);
//   * it must equal what B gets for a non-existent id (a different answer would reveal that the id exists);
//   * an anonymous call must be 401;
//   * B's lists must be 200 and must not contain A's rows (B's token is proven valid by those 200s);
//   * where A can safely repeat the call on its own ids, A must get something other than a refusal, so B's
//     refusal is shown to come from ownership and not from a route that refuses everyone. Calls that
//     would change A's data (PUT / DELETE / publish ...) have no such control and are reported as such.
// Any step that cannot be set up (widget, dashboard) fails the run instead of silently dropping routes.
//
//   BASE_URL=http://web/v1 INVITE_A=vm-... INVITE_B=vm-... node isolation-probe.mjs
// It is meant for a throwaway stack. It creates accounts and data; it never touches existing users.
import { randomBytes, randomUUID } from 'node:crypto';

const BASE = (process.env.BASE_URL || 'https://localhost/v1').replace(/\/$/, '');
const PACE_MS = Number(process.env.PACE_MS || 600); // stays under the default 120 requests/minute throttle
const tag = randomBytes(4).toString('hex');
const MARK = `ISOLATION-A-${tag}`;
const password = 'Abcd1234!';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let last = 0;
async function call(token, method, path, body, form) {
  const wait = last + PACE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE + path, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    if (response.status === 429) {
      await sleep(15000);
      last = Date.now();
      continue;
    } // throttled: wait and retry
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: response.status, text, json };
  }
  return { status: 429, text: '', json: undefined };
}

async function account(label, invite) {
  const userId = `iso${label}${tag}`;
  const email = `${userId}@example.test`;
  const up = await call(null, 'POST', '/login/signup', {
    userId,
    password,
    email,
    inviteCode: invite,
  });
  if (up.status !== 201)
    throw new Error(`signup ${label} failed: ${up.status} ${up.text.slice(0, 200)}`);
  const inn = await call(null, 'POST', '/login/signin', { userId, password });
  const token = inn.json?.accessToken;
  if (!token) throw new Error(`signin ${label} failed: ${inn.status} ${inn.text.slice(0, 200)}`);
  return { userId, token };
}

const unwrap = r => r.json?.data ?? r.json;
const A = await account('a', process.env.INVITE_A);
const B = await account('b', process.env.INVITE_B);

// ---- A builds its data ------------------------------------------------------------------------------
const csv = `id,name,value\n1,${MARK},10\n2,${MARK},20\n3,${MARK},30\n`;
const form = new FormData();
form.append('file', new Blob([csv], { type: 'text/csv' }), `${MARK}.csv`);
const upload = await call(A.token, 'POST', '/database/upload', undefined, form);
const db = unwrap(upload)?.id;
if (!db) throw new Error(`A upload failed: ${upload.status} ${upload.text.slice(0, 300)}`);
const ds = unwrap(
  await call(A.token, 'POST', '/dataset', {
    title: `${MARK} dataset`,
    databaseId: db,
    query: 'SELECT * FROM uploaded_data',
  }),
)?.id;
const components = unwrap(await call(A.token, 'GET', '/component')) ?? [];
const componentId = (Array.isArray(components) ? components : components.data ?? [])[0]?.id;
let wd;
if (ds && componentId)
  wd = unwrap(
    await call(A.token, 'POST', '/widget', {
      title: `${MARK} widget`,
      databaseId: db,
      componentId,
      datasetType: 'DATASET',
      datasetId: ds,
      option: '{}',
    }),
  )?.id;
let dash;
let dashResponse;
if (wd) {
  dashResponse = await call(A.token, 'POST', '/dashboard', {
    title: `${MARK} dashboard`,
    layout: [{ x: 0, y: 0, w: 6, h: 4, i: String(wd) }],
  });
  dash = unwrap(dashResponse)?.id;
}
const ids = { db, ds, wd, dash };
console.log(`A resources: ${JSON.stringify(ids)}  (marker ${MARK})`);
if (!db || !ds || !wd || !dash)
  throw new Error(
    `A could not build every resource (${JSON.stringify(
      ids,
    )}); the routes that need them cannot be probed` +
      (dashResponse
        ? `; dashboard answered ${dashResponse.status} ${dashResponse.text.slice(0, 300)}`
        : ''),
  );

// ---- the routes B (and an anonymous caller) must not be able to use against A's ids ----------------------
const q = 'SELECT * FROM uploaded_data';
const HEX = 'a'.repeat(64); // well-formed revision stamps: the request must get past validation to reach the owner check
const actorId = token =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).accessKeyData.id;
const BID = actorId(B.token);
// A fetches its own deletion receipts; B then replays them with B's own identity in the "expected actor" field.
const receipt = async path => unwrap(await call(A.token, 'GET', path));
const dbReceipt = await receipt(`/database/${db}/delete-impact`);
const dashReceipt = dash ? await receipt(`/dashboard/${dash}/delete-impact`) : undefined;
// B replays these with its own identity; without a receipt the DELETE would not test the replay.
if (!dbReceipt?.revision || !dashReceipt?.revision)
  throw new Error('A could not fetch its delete-impact receipts; the replay probes cannot run');
const deleteBody = r => ({
  requestId: randomUUID(),
  expectedRevision: r.revision,
  expectedActorId: BID,
  expectedOrganizationId: r.organizationId ?? null,
});
const probes = [
  ['GET', '/database/info/{db}'],
  ['GET', '/database/{db}'],
  ['PUT', '/database/{db}', { name: 'hijacked' }],
  ['GET', '/database/{db}/file-versions'],
  ['POST', '/database/{db}/file-restore', { versionId: 1 }],
  ['GET', '/database/{db}/delete-impact'],
  ['GET', '/database/{db}/file-refreshes/latest'],
  ['POST', '/database/execute', { id: '{db}', query: q }],
  ['POST', '/database/execute/stream', { id: '{db}', query: q }],
  ['GET', '/database/data?datasetType=table&databaseId={db}&tableName=uploaded_data'],
  ['GET', '/dataset/{ds}'],
  ['PUT', '/dataset/{ds}', { title: 'x' }],
  ['GET', '/dataset/{ds}/cached'],
  ['GET', '/dataset/{ds}/stream'],
  ['GET', '/dataset/{ds}/cache/stats'],
  ['DELETE', '/dataset/{ds}/cache'],
  ['POST', '/dataset', { title: 'steal', databaseId: '{db}', query: q }],
  ['GET', '/widget/{wd}'],
  ['PUT', '/widget/{wd}', { title: 'x' }],
  ['GET', '/dashboard/{dash}'],
  ['PUT', '/dashboard/{dash}', { title: 'x' }],
  ['GET', '/dashboard/{dash}/views'],
  ['POST', '/share-url/share-on/{dash}'],
  ['POST', '/share-url/share-off/{dash}'],
  ['GET', '/bi/sources/{db}/profile'],
  ['GET', '/bi/metrics?sourceId={db}'],
  ['POST', '/bi/explore/catalog', { sourceId: '{db}' }],
  // Well-formed enough to pass request validation, so the answer comes from the ownership check.
  [
    'POST',
    '/bi/explore/query',
    { sourceId: '{db}', sourceRevision: HEX, measureIds: [1], rankingMeasureId: 1 },
  ],
  ['GET', '/bi/dashboards/{dash}/publication'],
  ['POST', '/bi/dashboards/{dash}/publication', {}],
  ['GET', '/studio/dashboards/{dash}'],
  [
    'GET',
    `/studio/dashboards/{dash}/explore?blockId=x&expectedRevision=${HEX}&expectedSourceRevision=${HEX}`,
  ],
  [
    'POST',
    '/studio/dashboards/{dash}/copy',
    { requestId: 'iso-copy', expectedRevision: HEX, expectedSourceRevision: HEX },
  ],
  ['GET', '/studio/runs?dashboardId={dash}'],
  ['GET', '/studio/dashboards/{dash}/publications'],
  [
    'POST',
    '/studio/dashboards/{dash}/publications',
    { requestId: 'iso-publish', expectedRevision: HEX, visibility: 'link', allowRemix: true },
  ],
  ['GET', '/ai/dashboard-analysis/{dash}'],
  ['POST', '/ai/text-to-sql', { databaseId: '{db}', question: 'show everything' }],
  ['GET', '/ai/dashboard-metrics/{db}'],
  // destructive last
  ['DELETE', '/widget/{wd}'],
  ['DELETE', '/dashboard/{dash}', dashReceipt && deleteBody(dashReceipt)],
  ['DELETE', '/dataset/{ds}'],
  ['DELETE', '/database/{db}', dbReceipt && deleteBody(dbReceipt)],
];

// Calls A may repeat on its own ids without changing or spending anything. Everything else has no control.
const SAFE_FOR_A = ([method, path]) =>
  (method === 'GET' ||
    [
      '/database/execute',
      '/database/execute/stream',
      '/bi/explore/catalog',
      '/bi/explore/query',
    ].includes(path)) &&
  !path.startsWith('/ai/');

const fill = (value, map) =>
  JSON.parse(
    JSON.stringify(value)
      .replace(/"\{(\w+)\}"/g, (_, k) => String(map[k]))
      .replace(/\{(\w+)\}/g, (_, k) => map[k]),
  );
const BOGUS = { db: 987654321, ds: 987654321, wd: 987654321, dash: 987654321 };

const findings = [];
const rows = [];
for (const [method, path, body] of probes) {
  const realPath = fill(path, ids);
  const realBody = body === undefined ? undefined : fill(body, ids);
  const asB = await call(B.token, method, realPath, realBody);
  const asBogus = await call(
    B.token,
    method,
    fill(path, BOGUS),
    body === undefined ? undefined : fill(body, BOGUS),
  );
  const anon = await call(null, method, realPath, realBody);
  const asA = SAFE_FOR_A([method, path])
    ? await call(A.token, method, realPath, realBody)
    : undefined;
  const where = `${method} ${realPath}`;
  const leaked = asB.text.includes(MARK);
  if (asB.status < 300 || leaked)
    findings.push(`B ${where} -> ${asB.status}${leaked ? ' (A marker in body)' : ''}`);
  else if (asB.status !== 403 && !(asB.status === 404 && asBogus.status === 404))
    findings.push(`B ${where} -> ${asB.status} (not an ownership refusal)`);
  if (asB.status !== asBogus.status)
    findings.push(
      `B ${where} -> ${asB.status} but a non-existent id -> ${asBogus.status} (existence signal)`,
    );
  if (anon.status !== 401) findings.push(`anonymous ${where} -> ${anon.status} (expected 401)`);
  // A's answer shows the route works for an owner: not 401/403/404/5xx, and not the same as B's. A
  // route the owner cannot use proves nothing about ownership, so it fails the run instead of quietly
  // shrinking the number of controlled routes.
  const control = !asA
    ? 'none (changes data)'
    : asA.status >= 500 || [401, 403, 404].includes(asA.status) || asA.status === asB.status
    ? 'FAILED'
    : 'yes';
  if (control === 'FAILED')
    findings.push(`no usable control: A ${where} -> ${asA.status}, B -> ${asB.status}`);
  rows.push({
    route: `${method} ${path}`.slice(0, 70),
    B: asB.status,
    'B bogus id': asBogus.status,
    anonymous: anon.status,
    'A (control)': asA ? asA.status : '-',
    control,
  });
}

// ---- B must not see A in any list ---------------------------------------------------------------------
// 'owns' lists must show A its own row; the others only prove B gets a 200 (valid token) without A's data.
const lists = [
  ['/database', true],
  ['/dataset', true],
  ['/widget', true],
  ['/dashboard', true],
  ['/metric', false],
  ['/bi/sources', false],
  ['/dashboard/library', false],
];
const listRows = [];
for (const [path, owns] of lists) {
  const asB = await call(B.token, 'GET', path);
  const asA = await call(A.token, 'GET', path);
  const aSees = asA.text.includes(MARK);
  const bSees = asB.text.includes(MARK);
  if (bSees) findings.push(`B list GET ${path} contains A's data`);
  if (asB.status !== 200) findings.push(`B list GET ${path} -> ${asB.status} (expected 200)`);
  if (asA.status !== 200) findings.push(`A list GET ${path} -> ${asA.status} (expected 200)`);
  if (owns && !aSees) findings.push(`A list GET ${path} does not show A's own row`);
  listRows.push({
    list: `GET ${path}`,
    B: asB.status,
    'B sees A': bSees ? 'LEAK' : 'no',
    A: asA.status,
    'A sees own': owns ? (aSees ? 'yes' : 'NO') : 'not expected',
  });
}

// ---- positive controls: A can use its own data (so the refusals above mean something) ----------------------
const controls = [
  ['GET', '/database/info/{db}'],
  ['GET', '/dataset/{ds}'],
  ['GET', '/widget/{wd}'],
  ['GET', '/dashboard/{dash}'],
  ['POST', '/database/execute', { id: '{db}', query: q }],
];
const controlRows = [];
for (const [method, path, body] of controls) {
  const asA = await call(
    A.token,
    method,
    fill(path, ids),
    body === undefined ? undefined : fill(body, ids),
  );
  if (asA.status >= 300)
    findings.push(`CONTROL failed: A ${method} ${fill(path, ids)} -> ${asA.status}`);
  controlRows.push({
    control: `${method} ${path}`,
    A: asA.status,
    'has A data': asA.text.includes(MARK) ? 'yes' : 'n/a',
  });
}
// After B's attempts, A's data must still be intact (nothing was deleted or renamed).
for (const path of [
  `/database/info/${db}`,
  `/dataset/${ds}`,
  `/widget/${wd}`,
  `/dashboard/${dash}`,
]) {
  const intact = await call(A.token, 'GET', path);
  if (intact.status >= 300 || !intact.text.includes(MARK))
    findings.push(`A's ${path} changed or vanished after B's attempts: ${intact.status}`);
}

console.log('\nB and anonymous against A ids');
console.table(rows);
console.log('\nLists');
console.table(listRows);
console.log('\nControls');
console.table(controlRows);
const controlled = rows.filter(row => row.control === 'yes').length;
console.log(
  `\n${rows.length} routes probed as B; ${controlled} have an owner control, ${
    rows.length - controlled
  } have none (they change data or call AI).`,
);
console.log(
  findings.length
    ? `\nFAIL (${findings.length})\n- ${findings.join('\n- ')}`
    : '\nPASS: no cross-user access found',
);
process.exit(findings.length ? 1 : 0);
