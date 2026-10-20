import { expect, test } from '@playwright/test';
import { io, Socket } from 'socket.io-client';
import { actor, body, call, dashboard, dataset, execute, GOLD, ok, unique, upload, widget } from './helpers';

async function connected(url: string) {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('QA socket did not connect')), 5000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

for (const succeeds of [true, false]) {
  test(`[RELIABILITY-01] socket ${succeeds ? 'success' : 'error'} progress is isolated`, async () => {
    const owner = await actor();
    const source = await upload(owner);
    const own = await connected('http://127.0.0.1:4100/query-progress');
    const unrelated = await connected('http://127.0.0.1:4100/query-progress');
    const received: any[] = [];
    const foreign: any[] = [];
    own.on('query:progress', value => received.push(value));
    unrelated.on('query:progress', value => foreign.push(value));
    try {
      const response = await call(owner, 'POST', '/database/execute', { id: source.id, query: succeeds ? GOLD.rowsSql : 'SELECT * FROM qa_missing_table' }, { headers: { 'x-socket-id': own.id } });
      const result = await body(response);
      expect(result.status).toBe(succeeds ? 'SUCCESS' : 'ERROR');
      const terminal = succeeds ? 'success' : 'error';
      await expect.poll(() => received.some(value => value.phase === terminal)).toBe(true);
      expect(received[0].phase).toBe('running');
      if (succeeds) expect(received.find(value => value.phase === 'success').rows).toBe(3);
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(foreign).toEqual([]);
    } finally { own.disconnect(); unrelated.disconnect(); await owner.context.dispose(); }
  });
}

test('[RELIABILITY-02] cache hit is stable and expiry runs a real query again', async () => {
  const owner = await actor('http://127.0.0.1:4120/v1');
  const source = await upload(owner);
  const socket = await connected('http://127.0.0.1:4120/query-progress');
  const progress: any[] = [];
  socket.on('query:progress', value => progress.push(value));
  const query = async () => {
    const response = await call(owner, 'POST', '/database/execute', { id: source.id, query: GOLD.aggregateSql }, { headers: { 'x-socket-id': socket.id } });
    const result = await body(response);
    expect(result.status).toBe('SUCCESS');
    expect(result.datas).toEqual([{ total: 500 }]);
  };
  try {
    await query();
    await expect.poll(() => progress.some(value => value.phase === 'success')).toBe(true);
    const before = progress.length;
    await query();
    expect(progress.length).toBe(before);
    await expect.poll(async () => { await query(); return progress.length > before; }, { timeout: 10000, intervals: [300, 600] }).toBe(true);
  } finally { socket.disconnect(); await owner.context.dispose(); }
});

test('[RELIABILITY-02] cache and pool cannot return the old datasource after connection change', async () => {
  const owner = await actor('http://127.0.0.1:4120/v1');
  try {
    const a = await upload(owner);
    const b = await upload(owner, GOLD.salesCsv.replace(',100,', ',200,'));
    expect((await execute(owner, a.id)).datas[0].total).toBe(500);
    const info = await ok(await call(owner, 'GET', `/database/info/${b.id}`));
    await ok(await call(owner, 'PUT', `/database/${a.id}`, { name: unique(), connectionConfig: info.databaseInfo.connectionConfig }));
    expect((await execute(owner, a.id)).datas[0].total).toBe(600);
  } finally { await owner.context.dispose(); }
});

test('[RELIABILITY-05] compiled server restart preserves created resources and exact data', async () => {
  const owner = await actor();
  try {
    const source = await upload(owner);
    const set = await dataset(owner, source.id, GOLD.rowsSql);
    const w = await widget(owner, source.id);
    const d = await dashboard(owner, w.id);
    const before = await ok(await call(owner, 'GET', `/dashboard/${d.id}`));
    const restart = await fetch('http://127.0.0.1:4300/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(restart.ok).toBe(true);
    const after = await ok(await call(owner, 'GET', `/dashboard/${d.id}`));
    expect(after.title).toBe(before.title);
    expect(after.layout).toEqual(before.layout);
    expect(after.widgets.map((entry: any) => entry.id)).toEqual(before.widgets.map((entry: any) => entry.id));
    expect((await ok(await call(owner, 'GET', `/dataset/${set.id}`))).query).toBe(GOLD.rowsSql);
    expect((await execute(owner, source.id)).datas).toEqual([{ total: 500 }]);
    const signin = await owner.context.post(`${owner.base}/login/signin`, { data: { userId: owner.userId, password: owner.password } });
    expect(signin.status()).toBe(201);
  } finally { await owner.context.dispose(); }
});
