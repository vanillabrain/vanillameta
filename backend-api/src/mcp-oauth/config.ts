import { createHash } from 'crypto';
import { z } from 'zod';

export const mcpScopeSchema = z.enum(['sources:read', 'documents:read']);
export type McpScope = z.infer<typeof mcpScopeSchema>;
const clientSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: z.string().trim().min(1).max(100),
    redirectUris: z.array(z.string().max(2048)).min(1).max(8),
    scopes: z.array(mcpScopeSchema).min(1).max(2),
  })
  .strict();
export type McpClient = z.infer<typeof clientSchema>;
export type McpConfig = {
  apiBase: string;
  webBase: string;
  issuer: string;
  resource: string;
  clients: McpClient[];
  fingerprint: string;
};

function endpoint(value: string, production: boolean, callback = false): URL {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        (!production || callback)
      ))
  )
    throw new Error('Invalid MCP endpoint');
  return url;
}

export function readMcpConfig(env: NodeJS.ProcessEnv = process.env): McpConfig | null {
  if (
    !env.MCP_PUBLIC_API_URL ||
    !env.MCP_PUBLIC_WEB_URL ||
    !env.MCP_OAUTH_CLIENTS_JSON ||
    !env.CONFIG_SECRET_KEY
  )
    return null;
  try {
    const production = env.NODE_ENV === 'prod';
    const api = endpoint(env.MCP_PUBLIC_API_URL, production);
    const web = endpoint(env.MCP_PUBLIC_WEB_URL, production);
    if (api.pathname !== '/v1' || web.pathname !== '/') return null;
    const clients = z
      .array(clientSchema)
      .min(1)
      .max(20)
      .parse(JSON.parse(env.MCP_OAUTH_CLIENTS_JSON));
    if (new Set(clients.map(c => c.id)).size !== clients.length) return null;
    for (const client of clients) {
      if (
        new Set(client.redirectUris).size !== client.redirectUris.length ||
        new Set(client.scopes).size !== client.scopes.length
      )
        return null;
      for (const uri of client.redirectUris) {
        const parsed = endpoint(uri, production, true);
        if (parsed.href !== uri || parsed.pathname === '/') return null;
      }
    }
    const apiBase = api.href.replace(/\/$/, '');
    const webBase = web.origin;
    const issuer = `${apiBase}/mcp-oauth`;
    const resource = `${apiBase}/mcp`;
    return {
      apiBase,
      webBase,
      issuer,
      resource,
      clients,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ apiBase, webBase, clients }))
        .digest('hex'),
    };
  } catch {
    return null;
  }
}
