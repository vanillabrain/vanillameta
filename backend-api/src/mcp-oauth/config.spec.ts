import { readMcpConfig } from './config';
describe('MCP canonical configuration', () => {
  const env = {
    NODE_ENV: 'local',
    CONFIG_SECRET_KEY: 'synthetic',
    MCP_PUBLIC_API_URL: 'http://127.0.0.1:4265/v1',
    MCP_PUBLIC_WEB_URL: 'http://127.0.0.1:3265',
    MCP_OAUTH_CLIENTS_JSON: JSON.stringify([
      {
        id: 'qa',
        name: 'QA Client',
        redirectUris: ['http://127.0.0.1:4466/callback'],
        scopes: ['sources:read', 'documents:read'],
      },
    ]),
  };
  it('builds fixed issuer and resource without request Host inference', () => {
    expect(readMcpConfig(env)).toMatchObject({
      issuer: 'http://127.0.0.1:4265/v1/mcp-oauth',
      resource: 'http://127.0.0.1:4265/v1/mcp',
    });
  });
  it('requires complete settings and HTTPS in production', () => {
    expect(readMcpConfig({})).toBeNull();
    expect(readMcpConfig({ ...env, NODE_ENV: 'prod' })).toBeNull();
    expect(
      readMcpConfig({
        ...env,
        NODE_ENV: 'prod',
        MCP_PUBLIC_API_URL: 'https://vm.example/v1',
        MCP_PUBLIC_WEB_URL: 'https://vm.example',
      }),
    ).not.toBeNull();
  });
  it.each([
    'https://evil.test/?redirect=one',
    'http://192.168.1.5/v1',
    'https://user@vm.example/v1',
    'https://vm.example/other',
  ])('rejects invalid public base %s', value => {
    expect(readMcpConfig({ ...env, MCP_PUBLIC_API_URL: value })).toBeNull();
  });
  it.each([
    'https://evil.test/#callback',
    'javascript:alert(1)',
    'http://intranet/callback',
    'https://user@vm.example/callback',
    'https://vm.example/',
  ])('rejects unsafe or ambiguous callbacks %s', value => {
    expect(
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify([
          { id: 'qa', name: 'QA', redirectUris: [value], scopes: ['sources:read'] },
        ]),
      }),
    ).toBeNull();
  });
  it('rejects write scope, duplicate client IDs and unbounded registration', () => {
    const client = JSON.parse(env.MCP_OAUTH_CLIENTS_JSON)[0];
    expect(
      readMcpConfig({ ...env, MCP_OAUTH_CLIENTS_JSON: JSON.stringify([client, client]) }),
    ).toBeNull();
    expect(
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify([{ ...client, scopes: ['publish'] }]),
      }),
    ).toBeNull();
  });
});
