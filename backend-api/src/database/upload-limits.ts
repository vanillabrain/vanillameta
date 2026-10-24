export interface UploadLimits {
  /** Uploaded (DuckDB) sources one user may hold. */
  maxSources: number;
  /** Bytes of managed files one user may hold, counting every kept version. */
  maxBytes: number;
}

/** Placeholders until the product owner confirms the beta limits; both can be set per environment. */
export const DEFAULT_MAX_SOURCES_PER_USER = 20;
// Above the 2 GiB one import may take (ANALYSIS_MAX_STORAGE_BYTES), so a single legal upload fits.
export const DEFAULT_MAX_BYTES_PER_USER = 5 * 1024 ** 3;

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
    const { maxBytes } = uploadLimits(env);
    // One import may legitimately take this much; a smaller per-user cap would refuse a lone upload.
    const analysis = Number(env.ANALYSIS_MAX_STORAGE_BYTES);
    const oneImport = Number.isSafeInteger(analysis) && analysis > 0 ? analysis : 2 * 1024 ** 3;
    return maxBytes < oneImport
      ? [
          `UPLOAD_MAX_BYTES_PER_USER (${maxBytes}) must be at least ANALYSIS_MAX_STORAGE_BYTES (${oneImport}), ` +
            'or a single allowed upload could be refused',
        ]
      : [];
  } catch (error) {
    return [(error as Error).message];
  }
}
