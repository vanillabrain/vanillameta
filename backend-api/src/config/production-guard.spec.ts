import { assertProductionConfig, productionConfigProblems } from './production-guard';

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

  it.each(['ACCESS_SECRET', 'REFRESH_SECRET', 'JWT_ACCESS_SECRET', 'URL_ACCESS_SECRET', 'CONFIG_SECRET_KEY'])(
    'rejects a missing, dev-only or short %s',
    name => {
      for (const value of [undefined, 'dev-only-' + 'y'.repeat(40), 'short']) {
        const env = validEnv();
        if (value === undefined) delete env[name];
        else env[name] = value;
        expect(productionConfigProblems(env).join('\n')).toContain(name);
      }
    },
  );

  it('requires an explicit CORS origin without wildcards', () => {
    for (const value of [undefined, '', '*', 'https://a.example, *']) {
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
