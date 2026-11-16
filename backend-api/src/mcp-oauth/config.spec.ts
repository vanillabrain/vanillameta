import { productionConfigProblems } from '../config/production-guard';
import {
  MCP_SCOPES,
  advertisedScopes,
  mcpAccessTtlSeconds,
  mcpAuthorizationMetadata,
  readMcpConfig,
} from './config';
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
  it('rejects unknown scopes, duplicate client IDs and unbounded registration', () => {
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
    expect(
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify([{ ...client, scopes: ['shares:delete'] }]),
      }),
    ).toBeNull();
  });
  it('accepts every published scope once and changes the fingerprint with the allowlist', () => {
    const client = JSON.parse(env.MCP_OAUTH_CLIENTS_JSON)[0];
    const all = readMcpConfig({
      ...env,
      MCP_OAUTH_CLIENTS_JSON: JSON.stringify([{ ...client, scopes: [...MCP_SCOPES] }]),
    });
    expect(all.clients[0].scopes).toEqual([...MCP_SCOPES]);
    expect(all.fingerprint).not.toBe(readMcpConfig(env).fingerprint);
    expect(
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify([
          { ...client, scopes: [...MCP_SCOPES, 'reports:read'] },
        ]),
      }),
    ).toBeNull();
  });
  it('advertises only the scopes some configured client may ask for, so a new scope opens only when an operator adds it', () => {
    const client = JSON.parse(env.MCP_OAUTH_CLIENTS_JSON)[0];
    const config = (...clients: Array<{ id: string; scopes: string[] }>) =>
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify(clients.map(c => ({ ...client, ...c }))),
      });
    // A client set up before the dashboard scopes existed keeps the list it was given.
    const seven = MCP_SCOPES.filter(scope => !scope.startsWith('dashboards:'));
    const old = config({ id: 'old', scopes: [...seven] });
    expect(advertisedScopes(old)).toEqual(seven);
    expect(mcpAuthorizationMetadata(old).scopes_supported).toEqual(seven);
    expect(
      advertisedScopes(
        config({ id: 'a', scopes: ['dashboards:read'] }, { id: 'b', scopes: ['sources:read'] }),
      ),
    ).toEqual(['sources:read', 'dashboards:read']);
    expect(MCP_SCOPES).toEqual(expect.arrayContaining(['dashboards:write', 'dashboards:delete']));
  });
  it('keeps the fingerprint of a configuration made before the dashboard scopes existed', () => {
    const client = JSON.parse(env.MCP_OAUTH_CLIENTS_JSON)[0];
    const seven = MCP_SCOPES.filter(scope => !scope.startsWith('dashboards:'));
    // A fixed value, taken from the code as it was with seven scopes known: a new scope that is not in
    // a client's list leaves every existing connection valid.
    expect(
      readMcpConfig({
        ...env,
        MCP_OAUTH_CLIENTS_JSON: JSON.stringify([{ ...client, scopes: [...seven] }]),
      }).fingerprint,
    ).toBe('1df350c0020100e362480778961d6c7a824bd238752e1196fbaeae12177ccb85');
  });
  it('clamps the test access TTL outside prod, ignores it in prod and keeps it out of the fingerprint', () => {
    const ttl = (NODE_ENV: string, value?: string) =>
      mcpAccessTtlSeconds({ NODE_ENV, MCP_OAUTH_ACCESS_TTL_SECONDS: value });
    expect(ttl('local')).toBe(600);
    expect(ttl('local', '360')).toBe(360);
    expect(ttl('test', '5')).toBe(60);
    expect(ttl('dev', '3600')).toBe(600);
    expect(ttl('local', '1.5')).toBe(600);
    expect(ttl('local', 'abc')).toBe(600);
    expect(ttl('prod', '120')).toBe(600);
    expect(readMcpConfig({ ...env, MCP_OAUTH_ACCESS_TTL_SECONDS: '120' }).fingerprint).toBe(
      readMcpConfig(env).fingerprint,
    );
  });
  it('makes production-guard refuse the access TTL override in prod only', () => {
    const problem = /MCP_OAUTH_ACCESS_TTL_SECONDS/;
    expect(
      productionConfigProblems({ NODE_ENV: 'prod', MCP_OAUTH_ACCESS_TTL_SECONDS: '600' }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(problem)]));
    expect(productionConfigProblems({ NODE_ENV: 'prod' }).some(item => problem.test(item))).toBe(
      false,
    );
    expect(
      productionConfigProblems({ NODE_ENV: 'local', MCP_OAUTH_ACCESS_TTL_SECONDS: '60' }),
    ).toEqual([]);
  });
});
