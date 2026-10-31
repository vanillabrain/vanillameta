import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServer } from './server.js';
import { configForToken } from './api.js';

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });

export function bearerToken(request) {
  const value = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([^\s]+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * Remote authoring endpoint. The access token belongs to the calling user and is
 * forwarded unchanged, so every tool call keeps the existing API permissions.
 */
export function createHttpApp({ env = process.env, fetcher } = {}) {
  return async function handle(request) {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return json(400, { error: 'bad_request' });
    }
    if (url.pathname === '/health') {
      if (request.method !== 'GET')
        return json(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      return json(200, { status: 'ok', transport: 'streamable-http' });
    }
    if (url.pathname !== '/mcp') return json(404, { error: 'not_found' });
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' }, { allow: 'POST' });
    const token = bearerToken(request);
    if (!token)
      return json(
        401,
        { error: 'unauthorized' },
        { 'www-authenticate': 'Bearer realm="vanillameta-mcp"' },
      );
    let config;
    try {
      config = configForToken(env, token);
    } catch {
      return json(503, { error: 'mcp_not_configured' });
    }
    const handler = createMcpHandler(() => createServer(config, fetcher), {
      legacy: 'stateless',
      onerror: () => {},
    });
    const response = await handler.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  };
}

