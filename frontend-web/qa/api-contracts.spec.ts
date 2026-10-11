import { expect, request, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { actor, Actor, API, body, call, dashboard, dataset, error, execute, GOLD, metric, ok, parquetBuffer, provider, RECORDS, ROOT, unique, upload, widget } from './helpers';

let owner: Actor;
let source: any;
test.beforeAll(async () => {
  owner = await actor();
  source = await upload(owner);
});
test.afterAll(async () => owner?.context.dispose());

for (const family of ['database', 'dataset', 'widget', 'dashboard', 'component', 'template', 'metric', 'user/userinfo']) {
  for (const credential of ['missing', 'malformed', 'tampered']) {
    test(`[AUTH-02] ${family} rejects ${credential} credentials`, async ({ request: anonymous }) => {
      const headers = credential === 'missing' ? {} : { Authorization: credential === 'malformed' ? 'Bearer not-a-token' : `Bearer ${owner.token.slice(0, -5)}xxxxx` };
      const response = await anonymous.get(`${API}/${family}`, { headers });
      expect(response.status()).toBe(401);
    });
  }
}

test('[AUTH-05] duplicate ID and email preserve the original actor', async () => {
  for (const data of [{ userId: owner.userId, password: owner.password, email: `${unique()}@example.test` }, { userId: unique(), password: owner.password, email: owner.email }]) {
    const response = await owner.context.post(`${API}/login/signup`, { data });
    expect(response.status()).toBe(409);
  }
  const response = await owner.context.post(`${API}/login/signin`, { data: { userId: owner.userId, password: owner.password } });
  expect(response.status()).toBe(201);
});

test('[AUTH-13] account deletion checks password and prevents later login/refresh', async () => {
  const victim = await actor();
  try {
    await call(victim, 'DELETE', '/user/delete-account', { password: 'wrong-fixture-password' });
    expect((await victim.context.post(`${API}/login/signin`, { data: { userId: victim.userId, password: victim.password } })).status()).toBe(201);
    const removal = await call(victim, 'DELETE', '/user/delete-account', { password: victim.password });
    expect(removal.ok()).toBe(true);
    expect((await victim.context.post(`${API}/login/signin`, { data: { userId: victim.userId, password: victim.password } })).status()).toBe(401);
    expect((await victim.context.post(`${API}/user/get-access-token`)).status()).toBe(401);
  } finally { await victim.context.dispose(); }
});

for (const format of ['csv', 'json', 'parquet']) {
  test(`[FILE-13] server ${format} upload preserves all three oracle records and sum 500`, async () => {
    const buffer = format === 'csv' ? Buffer.from(GOLD.salesCsv) : format === 'json' ? Buffer.from(JSON.stringify(RECORDS)) : (await parquetBuffer()).buffer;
    const result = await ok(await call(owner, 'POST', '/database/upload', undefined, { multipart: { file: { name: `${unique()}.${format}`, mimeType: 'application/octet-stream', buffer } } }));
    expect(result.rows).toBe(3);
    expect((await execute(owner, result.id)).datas).toEqual([{ total: 500 }]);
    expect((await execute(owner, result.id, GOLD.rowsSql)).datas).toEqual(RECORDS);
  });
}

for (const variant of ['missing', 'empty', 'header-only', 'invalid-json', 'array-primitives', 'invalid-parquet']) {
  test(`[FILE-14] reject ${variant} upload without adding a source`, async () => {
    const before = await ok(await call(owner, 'GET', '/database'));
    let response;
    if (variant === 'missing') response = await call(owner, 'POST', '/database/upload', {});
    else {
      const extension = variant.includes('json') || variant === 'array-primitives' ? 'json' : variant === 'invalid-parquet' ? 'parquet' : 'csv';
      const contents = variant === 'empty' ? '' : variant === 'header-only' ? 'a,b\n' : variant === 'invalid-json' ? '{broken' : variant === 'array-primitives' ? '[1,2,3]' : 'not parquet';
      response = await call(owner, 'POST', '/database/upload', undefined, { multipart: { file: { name: `${unique()}.${extension}`, mimeType: 'application/octet-stream', buffer: Buffer.from(contents) } } });
    }
    expect(response.status()).toBe(400);
    expect((await ok(await call(owner, 'GET', '/database'))).map((row: any) => row.id)).toEqual(before.map((row: any) => row.id));
  });
}

test('[FILE-15] unsupported extension is rejected rather than silently treated as CSV', async () => {
  const response = await call(owner, 'POST', '/database/upload', undefined, { multipart: { file: { name: `${unique()}.txt`, mimeType: 'text/plain', buffer: Buffer.from(GOLD.salesCsv) } } });
  expect(response.status()).toBe(400);
});

test('[FILE-16] BOM CRLF escaped quotes Unicode and embedded newline survive server import', async () => {
  const csv = '\uFEFFid,name,amount\r\n1,"서울, \"\"A\"\"",100\r\n2,"line1\nline2",250\r\n3,gamma,150\r\n';
  const saved = await upload(owner, csv);
  expect((await execute(owner, saved.id, 'SELECT id, name, amount FROM uploaded_data ORDER BY id')).datas).toEqual([
    { id: 1, name: '서울, "A"', amount: 100 }, { id: 2, name: 'line1\nline2', amount: 250 }, { id: 3, name: 'gamma', amount: 150 },
  ]);
});

for (const headers of ['a-b,a b', 'amount,amount']) {
  test(`[FILE-17] preserve both columns for headers ${headers}`, async () => {
    const response = await ok(await call(owner, 'POST', '/database/upload', undefined, { multipart: { file: { name: `${unique()}.csv`, mimeType: 'text/csv', buffer: Buffer.from(`${headers}\n1,2\n3,4\n5,6\n`) } } }));
    const result = await execute(owner, response.id, 'SELECT * FROM uploaded_data');
    expect(Object.keys(result.datas[0])).toHaveLength(2);
    expect(Object.values(result.datas[0])).toEqual([1, 2]);
  });
}

test('[FILE-18] heterogeneous JSON keys remain a union with null missing cells', async () => {
  const result = await ok(await call(owner, 'POST', '/database/upload', undefined, { multipart: { file: { name: `${unique()}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ a: 1 }, { b: 2 }, { a: 3, b: null }])) } } }));
  expect((await execute(owner, result.id, 'SELECT a, b FROM uploaded_data')).datas).toEqual([{ a: 1, b: null }, { a: null, b: 2 }, { a: 3, b: null }]);
});

for (const format of ['csv', 'json', 'parquet']) {
  test(`[FILE-19] reject 100001-row ${format} without silent truncation`, async () => {
    test.setTimeout(180000);
    const rows = Array.from({ length: 100001 }, (_, index) => ({ ...RECORDS[index % 3], id: index + 1 }));
    const buffer = format === 'json' ? Buffer.from(JSON.stringify(rows)) : format === 'parquet' ? (await parquetBuffer(rows)).buffer : Buffer.from('id,region,category,amount,qty,name\n' + rows.map(row => `${row.id},${row.region},${row.category},${row.amount},${row.qty},${row.name}`).join('\n'));
    const response = await call(owner, 'POST', '/database/upload', undefined, { timeout: 120000, multipart: { file: { name: `${unique()}.${format}`, mimeType: 'application/octet-stream', buffer } } });
    expect(response.status()).toBe(400);
    expect((await execute(owner, source.id)).datas[0].total).toBe(500);
  });
}

test('[FILE-20] 50 MiB plus one byte is rejected with 413 and server survives', async () => {
  const response = await call(owner, 'POST', '/database/upload', undefined, { timeout: 30000, multipart: { file: { name: `${unique()}.csv`, mimeType: 'text/csv', buffer: Buffer.alloc(50 * 1024 * 1024 + 1, 65) } } });
  expect(response.status()).toBe(413);
  expect((await owner.context.get(`${API}/`)).ok()).toBe(true);
});

test('[DATA-03] connection replacement after pool initialization uses the new file', async () => {
  const a = await upload(owner);
  const b = await upload(owner, GOLD.salesCsv.replace(',100,', ',200,'));
  expect((await execute(owner, a.id)).datas[0].total).toBe(500);
  const detail = await ok(await call(owner, 'GET', `/database/info/${b.id}`));
  await ok(await call(owner, 'PUT', `/database/${a.id}`, { name: unique(), connectionConfig: detail.databaseInfo.connectionConfig }));
  expect((await execute(owner, a.id)).datas[0].total).toBe(600);
});

for (const variant of [{ method: 'GET', suffix: '/database/99999999' }, { method: 'GET', suffix: '/database/info/99999999' }, { method: 'POST', suffix: '/database/execute', data: { id: 99999999, query: GOLD.aggregateSql } }, { method: 'PUT', suffix: '/database/99999999', data: { name: unique(), connectionConfig: {} } }, { method: 'DELETE', suffix: '/database/99999999' }]) {
  test(`[DATA-04] unknown resource ${variant.method} ${variant.suffix}`, async () => { await error(await call(owner, variant.method, variant.suffix, variant.data)); });
}

for (const [label, query, expected] of [['rows', GOLD.rowsSql, RECORDS], ['aggregate', GOLD.aggregateSql, [{ total: 500 }]], ['empty', GOLD.emptySql, []], ['cte', 'WITH q AS (SELECT amount FROM uploaded_data) SELECT SUM(amount) AS total FROM q', [{ total: 500 }]]] as const) {
  test(`[DATA-05] ${label} SQL returns exact expected records`, async () => { expect((await execute(owner, source.id, query)).datas).toEqual(expected); });
}

for (const query of [GOLD.nonMutatingWriteProbe, GOLD.multiStatementProbe]) {
  test(`[DATA-06] deny ${query.split(' ')[0]} unsafe statement shape`, async () => {
    expect((await call(owner, 'POST', '/database/execute', { id: source.id, query })).status()).toBe(400);
    expect((await execute(owner, source.id)).datas[0].total).toBe(500);
  });
}

for (const query of ['SELEC invalid FROM uploaded_data', 'SELECT * FROM qa_missing_table', '']) {
  test(`[DATA-07] invalid query ${query || 'empty'} is controlled and later query works`, async () => {
    await error(await call(owner, 'POST', '/database/execute', { id: source.id, query }));
    expect((await execute(owner, source.id)).datas[0].total).toBe(500);
  });
}

test('[DATA-08] datasource detail exposes uploaded table but not a password', async () => {
  const detail = await ok(await call(owner, 'GET', `/database/${source.id}`));
  expect(detail.tables.map((row: any) => row.tableName)).toContain('uploaded_data');
  expect(detail.databaseInfo.connectionConfig.password).toBeUndefined();
});

test('[SET-04] dataset CRUD persists SQL and rejects bad updates without overwriting', async () => {
  const saved = await dataset(owner, source.id);
  expect((await ok(await call(owner, 'GET', `/dataset/${saved.id}`))).query).toBe(GOLD.aggregateSql);
  await error(await call(owner, 'PUT', `/dataset/${saved.id}`, { query: 'SELEC broken', title: 'invalid change' }));
  expect((await ok(await call(owner, 'GET', `/dataset/${saved.id}`))).query).toBe(GOLD.aggregateSql);
  await ok(await call(owner, 'PUT', `/dataset/${saved.id}`, { query: GOLD.rowsSql, title: 'QA edited dataset' }));
  expect((await ok(await call(owner, 'GET', `/dataset/${saved.id}`))).title).toBe('QA edited dataset');
  expect((await call(owner, 'DELETE', `/dataset/${saved.id}`)).ok()).toBe(true);
  await error(await call(owner, 'GET', `/dataset/${saved.id}`));
});

for (const method of ['GET', 'PUT', 'DELETE']) {
  test(`[SET-05] missing dataset ${method}`, async () => { await error(await call(owner, method, '/dataset/99999999', method === 'PUT' ? { query: GOLD.rowsSql } : undefined)); });
}

test('[SET-06] removing a used dataset leaves its dashboard loadable', async () => {
  const w = await widget(owner, source.id);
  const d = await dashboard(owner, w.id);
  expect((await call(owner, 'DELETE', `/dataset/${w.datasetId}`)).ok()).toBe(true);
  await error(await call(owner, 'GET', `/widget/${w.id}`));
  const loaded = await ok(await call(owner, 'GET', `/dashboard/${d.id}`));
  expect(loaded.widgets).toEqual([]);
});

for (const [aggregation, expression, expected] of [['SUM', 'amount', 500], ['AVG', 'amount', 500 / 3], ['COUNT', 'amount', 3], ['MIN', 'amount', 100], ['MAX', 'amount', 250], ['COUNT_DISTINCT', 'region', 2]] as const) {
  test(`[METRIC-03] ${aggregation} computes independent oracle`, async () => {
    const saved = await metric(owner, source.id, { aggregation, expression });
    const value = Number((await ok(await call(owner, 'POST', `/metric/${saved.id}/evaluate`))).result[0].value);
    if (aggregation === 'AVG') expect(Math.abs(value - expected)).toBeLessThan(1e-9);
    else expect(value).toBe(expected);
  });
}

test('[METRIC-04] grouped sums are exactly Seoul 250 and Busan 250', async () => {
  const saved = await metric(owner, source.id, { groupBy: 'region' });
  const values = (await ok(await call(owner, 'POST', `/metric/${saved.id}/evaluate`))).result.sort((a: any, b: any) => a.region.localeCompare(b.region, 'ko'));
  expect(values).toEqual(GOLD.groupedSums);
});

for (const [column, op, value, expected] of [['region', '=', '서울', 250], ['qty', '>', 1, 400], ['qty', '>=', 2, 400], ['region', 'LIKE', '서%', 250], ['region', 'IN', ['서울'], 250], ['region', 'IN', ['서울', '부산'], 500], ['name', '=', "alpha' OR 'x'='x", 0]] as const) {
  test(`[METRIC-05] bound ${column} ${op} ${JSON.stringify(value)} filter`, async () => {
    const saved = await metric(owner, source.id, { aggregation: column === 'name' ? 'COUNT' : 'SUM', filters: [{ column, op, value }] });
    const evaluated = await ok(await call(owner, 'POST', `/metric/${saved.id}/evaluate`));
    expect(Number(evaluated.result[0].value)).toBe(expected);
  });
}

for (const extra of [{ name: '' }, { tableName: 'uploaded data' }, { aggregation: 'UNSUPPORTED' }, { filters: [{ column: 'region', op: 'BETWEEN', value: '서울' }] }, { filters: [{ column: 'region', op: 'IN', value: [] }] }]) {
  test(`[METRIC-06] invalid metric definition ${JSON.stringify(extra)}`, async () => {
    await error(await call(owner, 'POST', '/metric', { name: unique(), databaseId: source.id, tableName: 'uploaded_data', aggregation: 'SUM', expression: 'amount', ...extra }));
  });
}

test('[METRIC-07] update and failed update preserve correct metric definition', async () => {
  const saved = await metric(owner, source.id);
  await ok(await call(owner, 'PUT', `/metric/${saved.id}`, { aggregation: 'MAX' }));
  expect((await ok(await call(owner, 'POST', `/metric/${saved.id}/evaluate`))).result[0].value).toBe(250);
  await error(await call(owner, 'PUT', `/metric/${saved.id}`, { aggregation: 'UNKNOWN' }));
  expect((await ok(await call(owner, 'GET', `/metric/${saved.id}`))).aggregation).toBe('MAX');
});

test('[METRIC-08] soft delete and recreate same name restores one correct active metric', async () => {
  const saved = await metric(owner, source.id);
  await ok(await call(owner, 'DELETE', `/metric/${saved.id}`));
  const revived = await metric(owner, source.id, { name: saved.name, aggregation: 'MAX' });
  expect(revived.id).toBe(saved.id);
  const list = await ok(await call(owner, 'GET', '/metric'));
  expect(list.filter((row: any) => row.name === saved.name)).toHaveLength(1);
  expect((await ok(await call(owner, 'POST', `/metric/${saved.id}/evaluate`))).result[0].value).toBe(250);
});

test('[METRIC-09] a deleted metric cannot still evaluate as active', async () => {
  const saved = await metric(owner, source.id);
  await ok(await call(owner, 'DELETE', `/metric/${saved.id}`));
  await error(await call(owner, 'POST', `/metric/${saved.id}/evaluate`));
  await error(await call(owner, 'POST', '/metric/99999999/evaluate'));
});

test('[WIDGET-05] widget DATASET and TABLE linkage survives CRUD', async () => {
  const w = await widget(owner, source.id);
  await ok(await call(owner, 'PUT', `/widget/${w.id}`, { title: 'QA updated widget', option: w.option }));
  expect((await ok(await call(owner, 'GET', `/widget/${w.id}`))).title).toBe('QA updated widget');
  const tableWidget = await ok(await call(owner, 'POST', '/widget', { title: unique(), componentId: w.componentId, datasetType: 'TABLE', databaseId: source.id, tableName: 'uploaded_data', option: w.option }));
  expect(tableWidget.datasetId).toBeGreaterThan(0);
  await ok(await call(owner, 'DELETE', `/widget/${tableWidget.id}`));
  await error(await call(owner, 'GET', `/widget/${tableWidget.id}`));
});

test('[DASH-05] title-only update does not discard dashboard widgets', async () => {
  const w = await widget(owner, source.id);
  const d = await dashboard(owner, w.id);
  await ok(await call(owner, 'PUT', `/dashboard/${d.id}`, { title: 'QA title-only edit' }));
  const current = await ok(await call(owner, 'GET', `/dashboard/${d.id}`));
  expect(current.title).toBe('QA title-only edit');
  expect(current.widgets.map((row: any) => row.id)).toContain(w.id);
  expect(current.layout).toEqual(d.layout);
  await ok(await call(owner, 'DELETE', `/dashboard/${d.id}`));
  await error(await call(owner, 'GET', `/dashboard/${d.id}`));
});

for (const variant of ['read', 'update', 'delete', 'share-on', 'share-off']) {
  test(`[DASH-06] unrelated account cannot ${variant} an owner's dashboard`, async () => {
    const stranger = await actor();
    const d = await dashboard(owner);
    try {
      const response = variant === 'read' ? await call(stranger, 'GET', `/dashboard/${d.id}`) : variant === 'update' ? await call(stranger, 'PUT', `/dashboard/${d.id}`, { title: 'foreign edit' }) : variant === 'delete' ? await call(stranger, 'DELETE', `/dashboard/${d.id}`) : await call(stranger, 'POST', `/share-url/${variant}/${d.id}`, { endDate: '12/31/2030' });
      expect([403, 404]).toContain(response.status());
      expect((await ok(await call(owner, 'GET', `/dashboard/${d.id}`))).title).toBe(d.title);
    } finally { await stranger.context.dispose(); }
  });
}

for (const variant of ['disabled', 'expired', 'unknown', 'deleted']) {
  test(`[SHARE-04] anonymous ${variant} share is denied`, async ({ request: anonymous }) => {
    const d = await dashboard(owner);
    const detail = await ok(await call(owner, 'GET', `/dashboard/${d.id}`));
    let uuid = detail.uuid;
    if (variant === 'expired') await call(owner, 'POST', `/share-url/share-on/${d.id}`, { endDate: '01/01/2000' });
    if (variant === 'unknown') uuid = '00000000-0000-4000-8000-000000000000';
    if (variant === 'deleted') await call(owner, 'DELETE', `/dashboard/${d.id}`);
    const response = await anonymous.get(`${API}/share-url/share-dashboard/${uuid}`, { timeout: 5000 });
    expect([401, 403, 404]).toContain(response.status());
  });
}

test('[SHARE-05] malformed share date is rejected without changing sharing', async () => {
  const d = await dashboard(owner);
  const response = await call(owner, 'POST', `/share-url/share-on/${d.id}`, { endDate: 'not-a-date' });
  expect(response.status()).toBe(400);
  expect((await ok(await call(owner, 'GET', `/dashboard/${d.id}`))).shareYn).toBe('N');
});

test('[SHARE-06] revoked share token cannot keep reading or mutate workspace', async ({ request: anonymous }) => {
  const w = await widget(owner, source.id);
  const d = await dashboard(owner, w.id);
  const enabled = await body(await call(owner, 'POST', `/share-url/share-on/${d.id}`, { endDate: '12/31/2030' }));
  const publicData = await body(await anonymous.get(`${API}/share-url/share-dashboard/${enabled.uuid}`));
  const token = publicData.data.shareToken;
  expect(typeof token).toBe('string');
  await call(owner, 'POST', `/share-url/share-off/${d.id}`);
  const response = await anonymous.get(`${API}/database/data`, { params: { datasetType: 'DATASET', datasetId: String(w.datasetId) }, headers: { 'Authorization-url': `Bearer ${token}` } });
  expect([401, 403]).toContain(response.status());
});

test('[TEMPLATE-01] template CRUD returns bounded responses and correct layout', async () => {
  const layout = [{ x: 0, y: 0, w: 6, h: 4, category: 'SCORE' }];
  const saved = await ok(await call(owner, 'POST', '/template', { title: unique(), description: 'QA template', layout }));
  const detail = await ok(await call(owner, 'GET', `/template/${saved.id}`));
  expect(detail.layout).toHaveLength(1);
  await ok(await call(owner, 'PUT', `/template/${saved.id}`, { title: 'QA updated template', description: 'QA', layout }));
  expect((await ok(await call(owner, 'GET', `/template/${saved.id}`))).title).toBe('QA updated template');
  await ok(await call(owner, 'DELETE', `/template/${saved.id}`));
  expect((await ok(await call(owner, 'GET', '/template'))).map((row: any) => row.id)).not.toContain(saved.id);
});

test('[TEMPLATE-02] recommendations and dashboard layout map selected widget once', async () => {
  const w = await widget(owner, source.id);
  const recommended = await body(await call(owner, 'POST', '/template/recommend', { widgets: [w.id] }));
  expect(recommended.status).toBe('SUCCESS');
  const layouts = await body(await call(owner, 'POST', '/template/dashboard', { widgets: [w.id], templateId: 7 }));
  expect(layouts.status).toBe('SUCCESS');
  const entries = Array.isArray(layouts.data) ? layouts.data : layouts.data.layout;
  expect(entries.map((entry: any) => Number(entry.i)).filter((id: number) => id === w.id)).toHaveLength(1);
});

test('[TEMPLATE-03] missing template returns a controlled response rather than hanging', async () => { await error(await call(owner, 'GET', '/template/99999999')); });

for (const value of [{ databaseId: 0, prompt: 'QA' }, { databaseId: 1, prompt: '' }, { databaseId: 1, prompt: 'x'.repeat(2001) }]) {
  test(`[AI-01] invalid AI prompt/ID ${value.databaseId}:${value.prompt.length}`, async () => { await error(await call(owner, 'POST', '/ai/text-to-sql', value)); });
}

test('[AI-01] no-key process reports unavailable AI without an external call', async () => {
  const disabled = await actor('http://127.0.0.1:4110/v1');
  try { await error(await call(disabled, 'POST', '/ai/text-to-sql', { databaseId: 1, prompt: 'QA disabled provider' })); }
  finally { await disabled.context.dispose(); }
});

test('[AI-02] local provider SQL passes actual SQLite evaluation with result 500', async () => {
  await provider('normal');
  const generated = await ok(await call(owner, 'POST', '/ai/text-to-sql', { databaseId: source.id, prompt: 'QA aggregate sales' }));
  expect(generated.sql).toBe(GOLD.aggregateSql);
  expect((await execute(owner, source.id, generated.sql)).datas[0].total).toBe(500);
});

for (const mode of ['write-sql', 'multi-sql', 'http-error', 'empty', 'malformed-envelope']) {
  test(`[${mode.includes('sql') ? 'AI-03' : 'AI-04'}] local provider ${mode} is a controlled failure`, async () => {
    await provider(mode);
    try { await error(await call(owner, 'POST', '/ai/text-to-sql', { databaseId: source.id, prompt: 'QA provider failure' })); }
    finally { await provider('normal'); }
    expect((await execute(owner, source.id)).datas[0].total).toBe(500);
  });
}

for (const mode of ['normal', 'unknown-chart', 'bad-chart-json']) {
  test(`[AI-05] local chart recommendation ${mode}`, async () => {
    await provider(mode);
    try {
      const response = await call(owner, 'POST', '/ai/recommend-chart', { datasetType: 'TABLE', databaseId: source.id, tableName: 'uploaded_data' });
      if (mode === 'normal') expect((await ok(response)).component.type).toBe('CHART_BAR');
      else await error(response);
    } finally { await provider('normal'); }
  });
}

test('[AI-06] dashboard insight works for data and refuses empty/missing dashboards', async () => {
  const w = await widget(owner, source.id);
  const full = await dashboard(owner, w.id);
  const empty = await dashboard(owner);
  const result = await ok(await call(owner, 'POST', `/ai/dashboard-insight/${full.id}`));
  expect(result.insight).toContain('500');
  await error(await call(owner, 'POST', `/ai/dashboard-insight/${empty.id}`));
  await error(await call(owner, 'POST', '/ai/dashboard-insight/99999999'));
});

test('[RELIABILITY-03] rate-limit process emits 429 then recovers', async ({ request: anonymous }) => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await anonymous.get('http://127.0.0.1:4130/v1/')).status());
  expect(statuses).toContain(429);
  expect(statuses.every(value => value === 200 || value === 429)).toBe(true);
  await expect.poll(async () => (await anonymous.get('http://127.0.0.1:4130/v1/')).status(), { timeout: 10000, intervals: [500, 1000] }).toBe(200);
});

test('[COMPONENT-01] component update preserves its original ID and delete removes it', async () => {
  const type = unique('QA_TYPE');
  const created = await body(await call(owner, 'POST', '/component', { type, title: 'QA component', category: 'SCORE', option: {} }));
  expect(created.id).toBeGreaterThan(0);
  expect((await call(owner, 'PATCH', `/component/${created.id}`, { type, title: 'QA updated component', category: 'SCORE', option: {} })).ok()).toBe(true);
  expect((await body(await call(owner, 'GET', `/component/${created.id}`))).title).toBe('QA updated component');
  expect((await call(owner, 'DELETE', `/component/${created.id}`)).ok()).toBe(true);
  const list = await body(await call(owner, 'GET', '/component'));
  expect(list.filter((row: any) => row.componentType === type)).toHaveLength(0);
});

test('[COMPONENT-02] duplicate component type does not insert another record', async () => {
  const type = unique('QA_TYPE');
  const payload = { type, title: 'QA duplicate component', category: 'SCORE', option: {} };
  await call(owner, 'POST', '/component', payload);
  const before = await body(await call(owner, 'GET', '/component'));
  await call(owner, 'POST', '/component', payload);
  const after = await body(await call(owner, 'GET', '/component'));
  expect(after.filter((row: any) => row.componentType === type)).toHaveLength(1);
  expect(after.length).toBe(before.length);
});
