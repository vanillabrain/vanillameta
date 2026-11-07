import { createHash } from 'crypto';
import { z } from 'zod';

export const mcpScopeSchema = z.enum([
  'sources:read',
  'documents:read',
  'dashboards:read',
  'reports:read',
  'comments:read',
  'comments:write',
  'suggestions:write',
  'shares:write',
]);
export type McpScope = z.infer<typeof mcpScopeSchema>;
export const MCP_SCOPES: readonly McpScope[] = mcpScopeSchema.options;
/** Advertised by both authorization-server metadata responses; keep them from drifting. */
export const MCP_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
export const MCP_ACCESS_TTL_ENV = 'MCP_OAUTH_ACCESS_TTL_SECONDS';

/**
 * Access token lifetime in seconds. Production always uses 600 (production-guard also refuses the
 * override there). Elsewhere an integer override is clamped to [60, 600] so a client's proactive
 * refresh (at 300 seconds remaining) can be observed quickly. Not part of the config fingerprint.
 */
export function mcpAccessTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[MCP_ACCESS_TTL_ENV];
  if (env.NODE_ENV === 'prod' || raw === undefined || !/^\d{1,6}$/.test(raw.trim())) return 600;
  return Math.min(600, Math.max(60, Number(raw.trim())));
}

export function mcpAccessTtlProblems(env: NodeJS.ProcessEnv): string[] {
  return env.NODE_ENV === 'prod' && (env[MCP_ACCESS_TTL_ENV] ?? '').trim() !== ''
    ? [`${MCP_ACCESS_TTL_ENV} is a test-only setting and is not allowed in prod`]
    : [];
}
const clientSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: z.string().trim().min(1).max(100),
    redirectUris: z.array(z.string().max(2048)).min(1).max(8),
    scopes: z.array(mcpScopeSchema).min(1).max(MCP_SCOPES.length),
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

export function mcpAuthorizationMetadata(config: McpConfig) {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/authorize`,
    token_endpoint: `${config.issuer}/token`,
    revocation_endpoint: `${config.issuer}/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: [...MCP_GRANT_TYPES],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    code_challenge_methods_supported: ['S256'],
  };
}
