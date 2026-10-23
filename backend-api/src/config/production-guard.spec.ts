import {
  assertProductionConfig,
  parseTrustProxyHops,
  productionConfigProblems,
} from './production-guard';

const SECRET = 'x'.repeat(40);
const validEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'prod',
  ACCESS_SECRET: SECRET,
  REFRESH_SECRET: SECRET + '1',
  JWT_ACCESS_SECRET: SECRET + '2',
  URL_ACCESS_SECRET: SECRET + '3',
  CONFIG_SECRET_KEY: SECRET + '4',
  CORS_ORIGIN: 'https://app.vanillameta.net',
  AI_PROVIDER: 'anthropic',
});

describe('production guard', () => {
  it('does nothing outside prod', () => {
    expect(productionConfigProblems({ NODE_ENV: 'dev' })).toEqual([]);
    expect(productionConfigProblems({})).toEqual([]);
  });

  it('accepts a complete production environment', () => {
    expect(productionConfigProblems(validEnv())).toEqual([]);
    expect(() => assertProductionConfig(validEnv())).not.toThrow();
  });

  it.each([
    'ACCESS_SECRET',
    'REFRESH_SECRET',
    'JWT_ACCESS_SECRET',
    'URL_ACCESS_SECRET',
    'CONFIG_SECRET_KEY',
  ])('rejects a missing, dev-only or short %s', name => {
    for (const value of [undefined, 'dev-only-' + 'y'.repeat(40), 'short']) {
      const env = validEnv();
      if (value === undefined) delete env[name];
      else env[name] = value;
      expect(productionConfigProblems(env).join('\n')).toContain(name);
    }
  });

  it('requires an explicit CORS origin without wildcards', () => {
    for (const value of [undefined, '', ' ', '*', 'https://a.example, *']) {
      const env = validEnv();
      if (value === undefined) delete env.CORS_ORIGIN;
      else env.CORS_ORIGIN = value;
      expect(productionConfigProblems(env).join('\n')).toContain('CORS_ORIGIN');
    }
  });

  it('rejects the local Codex CLI provider', () => {
    const env = validEnv();
    env.AI_PROVIDER = 'codex';
    expect(productionConfigProblems(env).join('\n')).toContain('AI_PROVIDER');
  });

  it('rejects disabling the read-only query guard', () => {
    const env = validEnv();
    env.QUERY_ALLOW_WRITE = 'true';
    expect(productionConfigProblems(env).join('\n')).toContain('QUERY_ALLOW_WRITE');
  });

  it('rejects an unknown signup mode but accepts the three real ones', () => {
    const env = validEnv();
    env.SIGNUP_MODE = 'everyone';
    expect(productionConfigProblems(env).join('\n')).toContain('SIGNUP_MODE');
    for (const mode of ['open', 'invite', 'closed', ' Invite ']) {
      env.SIGNUP_MODE = mode;
      expect(productionConfigProblems(env)).toEqual([]);
    }
  });

  it('reports every problem at once and never echoes secret values', () => {
    const env = validEnv();
    env.ACCESS_SECRET = 'dev-only-leaked-value';
    env.CORS_ORIGIN = '*';
    expect(() => assertProductionConfig(env)).toThrow(/ACCESS_SECRET[\s\S]*CORS_ORIGIN/);
    try {
      assertProductionConfig(env);
    } catch (error) {
      expect(String((error as Error).message)).not.toContain('leaked-value');
    }
  });

  it('refuses to boot when the seeded guest account exists', () => {
    expect(() => assertProductionConfig(validEnv(), { guestUserExists: true })).toThrow(/guest/);
    expect(() => assertProductionConfig(validEnv(), { guestUserExists: false })).not.toThrow();
  });
});

describe('environment aliases', () => {
  it('rejects NODE_ENV=production because only exactly "prod" disables synchronization', () => {
    const env = { ...validEnv(), NODE_ENV: 'production' };
    expect(productionConfigProblems(env).join('\n')).toContain('NODE_ENV=production');
    expect(() => assertProductionConfig({ NODE_ENV: 'production', DB_HOST: '127.0.0.1' })).toThrow(
      /use NODE_ENV=prod/,
    );
  });

  it('rejects an unset or unknown NODE_ENV only when the database is remote', () => {
    expect(productionConfigProblems({ DB_HOST: 'mysql' }).join('\n')).toContain('(unset)');
    expect(productionConfigProblems({ NODE_ENV: 'staging', DB_HOST: 'db.internal' })).toHaveLength(
      1,
    );
    expect(productionConfigProblems({ NODE_ENV: 'staging', DB_HOST: 'localhost' })).toEqual([]);
    expect(productionConfigProblems({ NODE_ENV: 'staging' })).toEqual([]);
  });

  it('keeps recognised non-prod environments working against remote databases', () => {
    for (const nodeEnv of ['dev', 'development', 'local', 'test'])
      expect(productionConfigProblems({ NODE_ENV: nodeEnv, DB_HOST: 'db.internal' })).toEqual([]);
  });

  it('rejects other spellings of prod, even against a local database', () => {
    for (const nodeEnv of ['Prod', 'PRODUCTION', ' prod '])
      expect(
        productionConfigProblems({ NODE_ENV: nodeEnv, DB_HOST: '127.0.0.1' }).join('\n'),
      ).toContain('use NODE_ENV=prod');
  });

  it('refuses a shipped .env.local in prod', () => {
    expect(() => assertProductionConfig(validEnv(), { localEnvFileExists: true })).toThrow(
      /\.env\.local/,
    );
    expect(() => assertProductionConfig(validEnv(), { localEnvFileExists: false })).not.toThrow();
  });
});

describe('parseTrustProxyHops', () => {
  it('defaults to one hop and accepts non-negative integers', () => {
    expect(parseTrustProxyHops(undefined)).toBe(1);
    expect(parseTrustProxyHops('2')).toBe(2);
    expect(parseTrustProxyHops(' 0 ')).toBe(0);
  });

  it.each(['', 'abc', '-1', '1.5'])('rejects %p', value => {
    expect(() => parseTrustProxyHops(value)).toThrow(/TRUST_PROXY_HOPS/);
  });
});
