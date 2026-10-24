export interface UploadLimits {
  /** Uploaded (DuckDB) sources one user may hold. */
  maxSources: number;
  /** Bytes of managed files one user may hold, counting every kept version. */
  maxBytes: number;
}

/** Placeholders until the product owner confirms the beta limits; both can be set per environment. */
export const DEFAULT_MAX_SOURCES_PER_USER = 20;
export const DEFAULT_MAX_BYTES_PER_USER = 1024 ** 3;

function positive(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new Error(`${name} must be a positive integer`);
  return Number(raw);
}

/** Limits from the environment. Fails fast on a malformed value instead of silently using a default. */
export function uploadLimits(env: NodeJS.ProcessEnv = process.env): UploadLimits {
  return {
    maxSources: positive(env, 'UPLOAD_MAX_SOURCES_PER_USER', DEFAULT_MAX_SOURCES_PER_USER),
    maxBytes: positive(env, 'UPLOAD_MAX_BYTES_PER_USER', DEFAULT_MAX_BYTES_PER_USER),
  };
}

/** Problems with the upload limit settings, as messages for the production boot check. */
export function uploadLimitProblems(env: NodeJS.ProcessEnv): string[] {
  try {
    uploadLimits(env);
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}
