#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHttpApp } from './http.js';

const MAX_BODY = 1024 * 1024;
const host = process.env.VM_MCP_HOST || '127.0.0.1';
const port = Number(process.env.VM_MCP_PORT || 8787);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('VM_MCP_PORT must be a valid port.\n');
  process.exit(1);
}
const app = createHttpApp();
const server = createServer(async (incoming, outgoing) => {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > MAX_BODY) {
        outgoing.writeHead(413, { 'content-type': 'application/json' }).end('{"error":"payload_too_large"}');
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request('http://' + (incoming.headers.host ?? host + ':' + port) + incoming.url, {
      method: incoming.method,
      headers: incoming.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const response = await app(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json' });
    outgoing.end('{"error":"internal"}');
  }
});
server.listen(port, host, () => {
  process.stdout.write('VanillaMeta MCP HTTP listening on http://' + host + ':' + port + '/mcp\n');
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => server.close(() => process.exit(0)));

