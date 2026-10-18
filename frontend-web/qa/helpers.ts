import { APIRequestContext, APIResponse, expect, Page, request } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import oracle from '../e2e/fixtures/oracle.json';

export const API = process.env.E2E_API_URL!;
export const ROOT = process.env.QA_RUN_ROOT!;
export const GOLD = oracle;
export const BASE = process.env.E2E_BASE_URL!;
if (!ROOT || !API?.startsWith('http://127.0.0.1:4100/')) {
  throw new Error('Comprehensive scenarios require the isolated QA runtime.');
}

export type Actor = {
  userId: string;
  email: string;
  password: string;
  token: string;
  context: APIRequestContext;
  base: string;
};
export const unique = (prefix = 'qa') => `${prefix}_${randomBytes(5).toString('hex')}`;
let nextRequestAt = 0;

export async function paced() {
  const wait = Math.max(0, nextRequestAt - Date.now());
  nextRequestAt = Math.max(nextRequestAt, Date.now()) + 650;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
}

export async function body(response: APIResponse): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function call(actor: Actor, method: string, suffix: string, data?: unknown, options: any = {}) {
  await paced();
  return actor.context.fetch(actor.base + suffix, {
    method,
    timeout: 5000,
    data,
    ...options,
    headers: { Authorization: `Bearer ${actor.token}`, ...(options.headers || {}) },
  });
}

export async function actor(base = API): Promise<Actor> {
  const userId = unique().replace(/_/g, '');
  const password = `Qa1!${randomBytes(6).toString('hex')}`;
  const email = `${userId}@example.test`;
  const context = await request.newContext({ timeout: 5000 });
  await paced();
  const signup = await context.post(`${base}/login/signup`, { data: { userId, password, email } });
  expect(signup.status(), 'isolated actor signup').toBe(201);
  await paced();
  const signin = await context.post(`${base}/login/signin`, { data: { userId, password } });
  expect(signin.status(), 'isolated actor signin').toBe(201);
  const response = await body(signin);
  expect(typeof response.accessToken).toBe('string');
  return { userId, password, email, token: response.accessToken, context, base };
}

export async function ok(response: APIResponse) {
  expect(response.ok(), `HTTP ${response.status()}`).toBe(true);
  const value = await body(response);
  expect(value.status, value.message || 'expected SUCCESS envelope').toBe('SUCCESS');
  return value.data;
}

/** Delete only an owned fixture after reviewing its current non-cascading impact. */
export async function deleteDashboard(owner: Actor, id: number) {
  const impact = await ok(await call(owner, 'GET', `/dashboard/${id}/delete-impact`));
  expect(impact.canDelete, 'fixture still has configured dependencies').toBe(true);
  return call(owner, 'DELETE', `/dashboard/${id}`, {
    requestId: randomUUID(),
    expectedRevision: impact.revision,
    expectedActorId: impact.actorId,
    expectedOrganizationId: impact.organizationId,
  });
}

export async function deleteMetric(owner: Actor, id: number) {
  const impact = await ok(await call(owner, 'GET', `/metric/${id}/delete-impact`));
  expect(impact.canDelete, 'fixture still has configured metric references').toBe(true);
  return call(owner, 'DELETE', `/metric/${id}`, {
    requestId: randomUUID(),
    expectedRevision: impact.revision,
    expectedActorId: impact.actorId,
    expectedOrganizationId: impact.organizationId,
  });
}

/** Explicitly remove only a reference-free owned fixture, then finish its file receipt. */
export async function deleteSource(owner: Actor, id: number) {
  const impact = await ok(await call(owner, 'GET', `/database/${id}/delete-impact`));
  expect(impact.canDelete, 'fixture still has source references').toBe(true);
  const response = await call(owner, 'DELETE', `/database/${id}`, {
    requestId: randomUUID(),
    expectedRevision: impact.revision,
    expectedActorId: impact.actorId,
    expectedOrganizationId: impact.organizationId,
  });
  const receipt = await ok(response);
  if (receipt.cleanup.status !== 'complete') {
    const cleaned = await ok(
      await call(owner, 'POST', `/database/deletions/${receipt.receiptId}/cleanup`, {
        requestId: receipt.requestId,
      }),
    );
    expect(cleaned.cleanup.status).toBe('complete');
  }
  return response;
}

export async function error(response: APIResponse) {
  expect(response.status(), 'unexpected server failure').toBeLessThan(500);
  const value = await body(response);
  if (response.status() >= 400) {
    expect(response.status()).toBeLessThan(500);
  } else {
    expect(value.status, 'semantic failure must be explicit').toBe('ERROR');
    expect(String(value.message || '').length).toBeGreaterThan(0);
  }
  return value;
}

export async function upload(owner: Actor, contents = GOLD.salesCsv, extension = 'csv') {
  const response = await call(owner, 'POST', '/database/upload', undefined, {
    multipart: {
      file: {
        name: `${unique()}.${extension}`,
        mimeType: extension === 'json' ? 'application/json' : 'text/csv',
        buffer: Buffer.from(contents),
      },
    },
  });
  const saved = await ok(response);
  expect(saved.rows).toBe(3);
  return saved;
}

export async function execute(owner: Actor, id: number, query = GOLD.aggregateSql) {
  const response = await call(owner, 'POST', '/database/execute', { id, query });
  expect(response.ok(), `query HTTP ${response.status()}`).toBe(true);
  const value = await body(response);
  expect(value.status, value.message).toBe('SUCCESS');
  return value;
}

export async function dataset(owner: Actor, databaseId: number, query = GOLD.aggregateSql) {
  return ok(await call(owner, 'POST', '/dataset', { title: unique(), databaseId, query }));
}

export const numericOption = {
  header: { title: 'QA numeric total', fontSize: 20, color: '#4A4A4A' },
  content: { field: 'amount', aggregation: 'sum', fontSize: 50, color: '#4A4A4A' },
};

export async function widget(owner: Actor, databaseId: number) {
  const set = await dataset(owner, databaseId, GOLD.rowsSql);
  const components = await body(await call(owner, 'GET', '/component'));
  const numeric = components.find((item: any) => item.componentType === 'BOARD_NUMERIC');
  expect(numeric).toBeTruthy();
  return ok(
    await call(owner, 'POST', '/widget', {
      title: unique(),
      componentId: numeric.id,
      datasetType: 'DATASET',
      datasetId: set.id,
      option: numericOption,
    }),
  );
}

export async function dashboard(owner: Actor, widgetId?: number) {
  return ok(
    await call(owner, 'POST', '/dashboard', {
      title: unique(),
      layout: widgetId ? [{ i: widgetId, x: 0, y: 0, w: 6, h: 4 }] : [],
    }),
  );
}

export async function metric(owner: Actor, databaseId: number, extra: Record<string, unknown> = {}) {
  return ok(
    await call(owner, 'POST', '/metric', {
      name: unique(),
      databaseId,
      tableName: 'uploaded_data',
      aggregation: 'SUM',
      expression: 'amount',
      ...extra,
    }),
  );
}

export async function signIn(page: Page, owner: Actor) {
  await page.goto('/login');
  await page.locator('input[name="userId"]').fill(owner.userId);
  await page.locator('input[name="userPwd"]').fill(owner.password);
  const response = page.waitForResponse(item => item.url().endsWith('/login/signin') && item.request().method() === 'POST');
  await page.locator('button[type="submit"]').click();
  expect((await response).status()).toBe(201);
  await page.waitForURL(/\/dashboard$/);
}

export async function authorize(page: Page, owner: Actor) {
  await page.addInitScript(token => localStorage.setItem('accessToken', JSON.stringify(token)), owner.token);
}

export async function provider(mode: string) {
  const response = await fetch('http://127.0.0.1:4310/qa/mode', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  expect(response.ok).toBe(true);
}

export async function csvFixture(name = 'qa-oracle.csv', contents = GOLD.salesCsv) {
  const folder = path.join(ROOT, 'fixtures');
  await fs.mkdir(folder, { recursive: true });
  const filename = path.join(folder, name);
  await fs.writeFile(filename, contents);
  return filename;
}

export const RECORDS = [
  { id: 1, region: '서울', category: '전자', amount: 100, qty: 1, name: 'alpha' },
  { id: 2, region: '부산', category: '의류', amount: 250, qty: 2, name: 'beta' },
  { id: 3, region: '서울', category: '전자', amount: 150, qty: 3, name: 'gamma' },
];

export async function parquetBuffer(rows = RECORDS) {
  const requireBackend = createRequire(path.resolve(__dirname, '../../backend-api/package.json'));
  const { ParquetSchema, ParquetWriter } = requireBackend('parquetjs-lite');
  const folder = path.join(ROOT, 'fixtures');
  await fs.mkdir(folder, { recursive: true });
  const filename = path.join(folder, `${unique()}.parquet`);
  const schema = new ParquetSchema({
    id: { type: 'INT32' },
    region: { type: 'UTF8' },
    category: { type: 'UTF8' },
    amount: { type: 'INT32' },
    qty: { type: 'INT32' },
    name: { type: 'UTF8' },
  });
  const writer = await ParquetWriter.openFile(schema, filename);
  for (const row of rows) await writer.appendRow(row);
  await writer.close();
  return { filename, buffer: await fs.readFile(filename) };
}
