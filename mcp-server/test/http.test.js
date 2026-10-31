import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApp } from '../src/http.js';

const env = { VM_API_URL: 'http://127.0.0.1:4000/v1', VM_WEB_URL: 'http://127.0.0.1:3000' };
const request = (body, token = 'private.jwt.token') =>
  new Request('http://127.0.0.1:8787/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
async function rpc(app, body, token) {
  const response = await app(request(body, token));
  const text = await response.text();
  const data = text.startsWith('event:')
    ? JSON.parse(text.split('\n').find(line => line.startsWith('data: ')).slice(6))
    : JSON.parse(text);
  return { status: response.status, data, headers: response.headers, text };
}
const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'http-test', version: '1' },
  },
};
const apiResponse = data => new Response(JSON.stringify({ status: 'SUCCESS', data }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('health is public and the MCP path requires a bearer token', async () => {
  const app = createHttpApp({ env });
  const health = await app(new Request('http://127.0.0.1:8787/health'));
  assert.equal(health.status, 200);
  assert.equal((await app(new Request('http://127.0.0.1:8787/other'))).status, 404);
  const missing = await app(request(initialize, ''));
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate'), /^Bearer /);
  assert.equal((await app(new Request('http://127.0.0.1:8787/mcp'))).status, 405);
});

test('initialize and tools/list work over HTTP without a session', async () => {
  const app = createHttpApp({ env });
  const init = await rpc(app, initialize);
  assert.equal(init.status, 200);
  assert.equal(init.data.result.serverInfo.name, 'vanillameta');
  const list = await rpc(app, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = list.data.result.tools.map(tool => tool.name).sort();
  assert.deepEqual(names, [
    'vm_describe_source',
    'vm_get_artifact',
    'vm_get_proposal',
    'vm_list_sources',
    'vm_propose_analysis',
    'vm_save_analysis',
  ]);
});

test('the remote endpoint keeps the per-user token on every API call', async () => {
  const calls = [];
  const app = createHttpApp({
    env,
    fetcher: async (url, init) => {
      calls.push({ url, authorization: init.headers.Authorization });
      return apiResponse([{ id: 1, name: 'Sales', engine: 'duckdb' }]);
    },
  });
  const result = await rpc(app, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'vm_list_sources', arguments: {} },
  });
  assert.equal(result.data.result.isError, undefined);
  assert.deepEqual(result.data.result.structuredContent.sources, [
    { id: 1, name: 'Sales', engine: 'duckdb' },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authorization, 'Bearer private.jwt.token');
});

test('save still requires the explicit confirmSave approval over HTTP', async () => {
  const calls = [];
  const app = createHttpApp({
    env,
    fetcher: async url => {
      calls.push(url);
      return apiResponse({ dashboardId: 9 });
    },
  });
  const denied = await rpc(app, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'vm_save_analysis',
      arguments: {
        proposalId: '00000000-0000-4000-8000-000000000001',
        expectedSourceRevision: 'a'.repeat(64),
        requestId: '00000000-0000-4000-8000-000000000002',
      },
    },
  });
  assert.equal(denied.data.error !== undefined || denied.data.result.isError === true, true);
  assert.equal(calls.length, 0);
});

test('invalid provider configuration fails closed without leaking the token', async () => {
  const app = createHttpApp({ env: { VM_API_URL: 'https://user:SECRET@example.com', VM_WEB_URL: 'http://127.0.0.1' } });
  const response = await app(request(initialize));
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.equal(body.includes('private.jwt.token'), false);
});

