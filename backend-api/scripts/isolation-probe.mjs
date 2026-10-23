#!/usr/bin/env node
// Black-box proof that one signed-in user cannot reach another user's data over HTTP.
//
// A signs up (invite codes), uploads a file, builds a dataset / widget / dashboard and publishes nothing;
// B then calls every route that takes one of A's ids, and also lists everything B may see. Nothing B does
// may return 2xx, B's lists must not contain A's rows, and a request with no token must be refused.
// A's own requests are the positive controls (so a refusal is not just "the route is broken").
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
if (wd && !dash)
  console.log(
    `dashboard creation failed: ${dashResponse.status} ${dashResponse.text.slice(0, 300)}`,
  );
const ids = { db, ds, wd, dash };
console.log(`A resources: ${JSON.stringify(ids)}  (marker ${MARK})`);
if (!db || !ds) throw new Error('A needs at least a source and a dataset to run the proof');

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
  ['POST', '/bi/explore/query', { sourceId: '{db}' }],
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
].filter(
  ([, path, body]) =>
    !(JSON.stringify([path, body]).includes('{wd}') && !wd) &&
    !(JSON.stringify([path, body]).includes('{dash}') && !dash),
);

const fill = (value, map) =>
  JSON.parse(
    JSON.stringify(value)
      .replace(/"\{(\w+)\}"/g, (_, k) => String(map[k]))
      .replace(/\{(\w+)\}/g, (_, k) => map[k]),
  );
const BOGUS = { db: 987654321, ds: 987654321, wd: 987654321, dash: 987654321 };
const DENIED = new Set([400, 401, 403, 404, 409, 422]);

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
  const leaked = asB.text.includes(MARK);
  if (asB.status < 300 || leaked)
    findings.push(`B ${method} ${realPath} -> ${asB.status}${leaked ? ' (A marker in body)' : ''}`);
  else if (!DENIED.has(asB.status))
    findings.push(`B ${method} ${realPath} -> ${asB.status} (unexpected status)`);
  if (anon.status !== 401)
    findings.push(`anonymous ${method} ${realPath} -> ${anon.status} (expected 401)`);
  const conclusive = !(asB.status === 400 && asBogus.status === 400);
  rows.push({
    route: `${method} ${path}`.slice(0, 70),
    conclusive: conclusive ? 'yes' : '400 first',
    B: asB.status,
    'B bogus id': asBogus.status,
    anonymous: anon.status,
    'same as bogus': asB.status === asBogus.status ? 'yes' : 'NO',
  });
}

// ---- B must not see A in any list ---------------------------------------------------------------------
const lists = [
  '/database',
  '/dataset',
  '/widget',
  '/dashboard',
  '/metric',
  '/bi/sources',
  '/dashboard/library',
  '/studio/runs',
];
const listRows = [];
for (const path of lists) {
  const asB = await call(B.token, 'GET', path);
  const asA = await call(A.token, 'GET', path);
  const aSees = asA.text.includes(MARK);
  const bSees = asB.text.includes(MARK);
  if (asB.status < 300 && bSees) findings.push(`B list GET ${path} contains A's data`);
  listRows.push({
    list: `GET ${path}`,
    B: asB.status,
    'B sees A': bSees ? 'LEAK' : 'no',
    A: asA.status,
    'A sees own': aSees ? 'yes' : 'n/a',
  });
}

// ---- positive controls: A can use its own data (so the refusals above mean something) ----------------------
const controls = [
  ['GET', '/database/info/{db}'],
  ['GET', '/dataset/{ds}'],
  ...(wd ? [['GET', '/widget/{wd}']] : []),
  ...(dash ? [['GET', '/dashboard/{dash}']] : []),
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
  ...(wd ? [`/widget/${wd}`] : []),
  ...(dash ? [`/dashboard/${dash}`] : []),
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
const inconclusive = rows.filter(row => row.conclusive !== 'yes').map(row => row.route);
if (inconclusive.length)
  console.log(
    `\nNOTE: validation rejected these with 400 before any ownership check, so they prove nothing about isolation: ${inconclusive.join(
      ', ',
    )}`,
  );
const differing = rows.filter(row => row['same as bogus'] === 'NO').map(row => row.route);
if (differing.length)
  console.log(
    `\nNOTE: these routes answer differently for a real foreign id than for a non-existent one (existence signal): ${differing.join(
      ', ',
    )}`,
  );
console.log(
  findings.length
    ? `\nFAIL (${findings.length})\n- ${findings.join('\n- ')}`
    : '\nPASS: no cross-user access found',
);
process.exit(findings.length ? 1 : 0);
