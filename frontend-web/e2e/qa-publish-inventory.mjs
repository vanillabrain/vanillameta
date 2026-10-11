import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2];
if (!root || !path.resolve(root).includes('/backend-api/.scratch/comprehensive-')) throw new Error('An owned comprehensive QA root is required.');
const api = 'http://127.0.0.1:4100/v1';
const userId = `qainv${randomBytes(4).toString('hex')}`;
const password = `Qa1!${randomBytes(6).toString('hex')}`;
const signup = await fetch(`${api}/login/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, password, email: `${userId}@example.test` }) });
if (signup.status !== 201) throw new Error(`Inventory fixture signup HTTP ${signup.status}`);
const signin = await fetch(`${api}/login/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, password }) });
if (signin.status !== 201) throw new Error(`Inventory fixture signin HTTP ${signin.status}`);
const { accessToken } = await signin.json();
const headers = { Authorization: `Bearer ${accessToken}` };
const componentResponse = await fetch(`${api}/component`, { headers });
const widgetResponse = await fetch(`${api}/widget`, { headers });
if (!componentResponse.ok || !widgetResponse.ok) throw new Error('Inventory public API read failed');
const components = await componentResponse.json();
const widgets = await widgetResponse.json();
if (!Array.isArray(components) || !Array.isArray(widgets.data)) throw new Error('Unexpected inventory response shape');
const runCreatedComponentIds = components.filter(item => /^QA_TYPE_[0-9a-f]{10}$/.test(item.componentType)).map(item => item.id);
const inventory = {
  components,
  seedWidgets: widgets.data.filter(item => Number(item.id) <= 100),
  wideRowsSql: 'SELECT * FROM uploaded_data ORDER BY id',
  runCreatedComponentIds,
  provenance: { api, root, source: 'Public API of the isolated runtime created by this session; custom QA_TYPE rows were created only by the run-owned COMPONENT scenarios.' },
};
const folder = path.join(root, 'fixtures');
await fs.mkdir(folder, { recursive: true, mode: 0o700 });
const destination = path.join(folder, 'stock-chart-inventory.json');
await fs.writeFile(destination, JSON.stringify(inventory, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ destination, enabledStockTypes: components.filter(item => !runCreatedComponentIds.includes(item.id)).map(item => item.componentType), seedWidgetIds: inventory.seedWidgets.map(item => item.id), excludedRunCreatedIds: runCreatedComponentIds }));
