import { publicationConfigProblems } from '../dashboard-studio/studio-publication-expiry';
import { userThrottleConfigProblems } from '../common/throttle/user-throttle.guard';
import { uploadLimitProblems } from '../database/upload-limits';
import { quotaConfigProblems } from '../usage/quota-config';

const REQUIRED_SECRETS = [
  'ACCESS_SECRET',
  'REFRESH_SECRET',
  'JWT_ACCESS_SECRET',
  'URL_ACCESS_SECRET',
  'CONFIG_SECRET_KEY',
] as const;
const MIN_SECRET_LENGTH = 32;
const DEV_ONLY_PREFIX = 'dev-only-';

const SIGNUP_MODES = ['open', 'invite', 'closed'];
const KNOWN_ENVIRONMENTS = ['local', 'dev', 'development', 'prod', 'test'];
const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1'];

export interface ProductionRuntimeFacts {
  /** True when the seeded demo account (userId `guest`) exists in the metadata database. */
  guestUserExists?: boolean;
  /** True when a `.env.local` file is present; main.ts loads it and it would fill missing values. */
  localEnvFileExists?: boolean;
}

/**
 * app.module.ts only turns schema synchronization off for exactly NODE_ENV=prod, so an alias such
 * as "production" (or an unset value) against a remote database would let TypeORM rewrite it.
 */
function environmentProblems(env: NodeJS.ProcessEnv): string[] {
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === 'prod') return [];
  const remoteDatabase = Boolean(env.DB_HOST) && !LOCAL_DB_HOSTS.includes(env.DB_HOST as string);
  const unknown = !KNOWN_ENVIRONMENTS.includes(nodeEnv ?? '');
  // Any spelling of prod other than exactly "prod" (Prod, PRODUCTION, ...) would keep synchronize on.
  const prodAlias = ['prod', 'production'].includes((nodeEnv ?? '').trim().toLowerCase());
  if (prodAlias || (unknown && remoteDatabase))
    return [
      `NODE_ENV=${nodeEnv ?? '(unset)'} is not a recognised environment; ` +
        'use NODE_ENV=prod so that schema synchronization stays off',
    ];
  return [];
}

/** Problems that make a production boot unsafe. Names only; secret values are never echoed. */
export function productionConfigProblems(
  env: NodeJS.ProcessEnv,
  facts: ProductionRuntimeFacts = {},
): string[] {
  if (env.NODE_ENV !== 'prod') return environmentProblems(env);
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

  if (env.QUERY_ALLOW_WRITE === 'true')
    problems.push('QUERY_ALLOW_WRITE=true disables the read-only query guard');

  const signup = env.SIGNUP_MODE?.trim().toLowerCase();
  if (signup && !SIGNUP_MODES.includes(signup))
    problems.push(`SIGNUP_MODE must be one of ${SIGNUP_MODES.join(', ')}`);

  problems.push(
    ...quotaConfigProblems(env),
    ...publicationConfigProblems(env),
    ...userThrottleConfigProblems(env),
    ...uploadLimitProblems(env),
  );

  if (facts.localEnvFileExists)
    problems.push('a .env.local file is present; production must not ship local settings');

  if (facts.guestUserExists)
    problems.push('the seeded demo account "guest" exists in the database');

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
  if (!/^\d+$/.test(value.trim()))
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  return Number(value.trim());
}
