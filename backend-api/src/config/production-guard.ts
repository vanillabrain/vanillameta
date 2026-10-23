const REQUIRED_SECRETS = [
  'ACCESS_SECRET',
  'REFRESH_SECRET',
  'JWT_ACCESS_SECRET',
  'URL_ACCESS_SECRET',
  'CONFIG_SECRET_KEY',
] as const;
const MIN_SECRET_LENGTH = 32;
const DEV_ONLY_PREFIX = 'dev-only-';

export interface ProductionRuntimeFacts {
  /** True when the seeded demo account (userId `guest`) exists in the metadata database. */
  guestUserExists?: boolean;
}

/** Problems that make a production boot unsafe. Names only; secret values are never echoed. */
export function productionConfigProblems(
  env: NodeJS.ProcessEnv,
  facts: ProductionRuntimeFacts = {},
): string[] {
  if (env.NODE_ENV !== 'prod') return [];
  const problems: string[] = [];

  for (const name of REQUIRED_SECRETS) {
    const value = env[name];
    if (!value) problems.push(`${name} is not set`);
    else if (value.startsWith(DEV_ONLY_PREFIX)) problems.push(`${name} uses a dev-only default`);
    else if (value.length < MIN_SECRET_LENGTH)
      problems.push(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`);
  }

  const origins = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  if (!origins.length) problems.push('CORS_ORIGIN is not set');
  else if (origins.includes('*')) problems.push('CORS_ORIGIN must not contain a wildcard');

  if (env.AI_PROVIDER === 'codex')
    problems.push('AI_PROVIDER=codex is a local development provider and is not allowed in prod');

  if (facts.guestUserExists) problems.push('the seeded demo account "guest" exists in the database');

  return problems;
}

export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
  facts: ProductionRuntimeFacts = {},
): void {
  const problems = productionConfigProblems(env, facts);
  if (problems.length)
    throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
}

/** Number of trusted reverse-proxy hops. Fails fast on anything but a non-negative integer. */
export function parseTrustProxyHops(value: string | undefined, fallback = 1): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value.trim())) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  return Number(value.trim());
}
