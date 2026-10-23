import { ForbiddenException } from '@nestjs/common';

/** Engines behind the `file` (uploaded DuckDB) and `sample` (server-written SQLite) source types. */
const SOURCE_TYPE_ENGINES: Record<string, string[]> = {
  file: ['duckdb'],
  sample: ['sqlite', 'sqlite3', 'better-sqlite3'],
};
const LOCAL_FILE_ENGINES = Object.values(SOURCE_TYPE_ENGINES).flat();
const DEFAULT_PROD_SOURCE_TYPES = 'file,sample';

/**
 * Engines a user may connect to, or `null` when unrestricted.
 *
 * Network engines let a user make the server open a socket to a host of their choosing, which on a
 * shared VM reaches the internal network and the cloud metadata service. `prod` therefore defaults
 * to uploads and the sample only; other environments stay open unless `ALLOWED_SOURCE_TYPES` is set.
 * Entries are `file`, `sample`, or an engine name such as `mysql2`; `*` lifts the restriction.
 */
export function allowedSourceEngines(env: NodeJS.ProcessEnv = process.env): Set<string> | null {
  const configured = env.ALLOWED_SOURCE_TYPES?.trim();
  if (!configured && env.NODE_ENV !== 'prod') return null;
  const entries = (configured || DEFAULT_PROD_SOURCE_TYPES)
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.includes('*')) return null;
  return new Set(entries.flatMap(entry => SOURCE_TYPE_ENGINES[entry] ?? [entry]));
}

/** A user-supplied `filename` would let a connection test probe server paths; files go through upload. */
export function assertNotLocalFileEngine(engine: unknown): void {
  const normalized = String(engine ?? '')
    .trim()
    .toLowerCase();
  if (LOCAL_FILE_ENGINES.includes(normalized))
    throw new ForbiddenException('File sources require managed upload.');
}

/** Local-file engines carry no host, so they are always permitted; everything else is gated. */
export function isSourceEngineAllowed(
  engine: unknown,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const normalized = String(engine ?? '')
    .trim()
    .toLowerCase();
  if (LOCAL_FILE_ENGINES.includes(normalized)) return true;
  const allowed = allowedSourceEngines(env);
  return allowed === null || allowed.has(normalized);
}

export function assertSourceEngineAllowed(
  engine: unknown,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isSourceEngineAllowed(engine, env))
    throw new ForbiddenException('This data source type is not available in this environment.');
}
