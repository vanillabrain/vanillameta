export interface QuotaLimits {
  dailyCalls: number;
  monthlyTokens: number;
}

/** Placeholders until the product owner confirms the beta limits; both can be set per environment. */
export const DEFAULT_DAILY_CALLS = 30;
export const DEFAULT_MONTHLY_TOKENS = 500_000;

function limit(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  // 0 is valid and means "no AI for this user"; there is deliberately no unlimited value.
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new Error(`${name} must be a non-negative integer`);
  return Number(raw);
}

/** Environment defaults for users without a `user_quota` override. Fails fast on a malformed value. */
export function quotaDefaults(env: NodeJS.ProcessEnv = process.env): QuotaLimits {
  return {
    dailyCalls: limit(env, 'QUOTA_DAILY_CALLS', DEFAULT_DAILY_CALLS),
    monthlyTokens: limit(env, 'QUOTA_MONTHLY_TOKENS', DEFAULT_MONTHLY_TOKENS),
  };
}

/** Problems with the quota settings, as messages for the production boot check. */
export function quotaConfigProblems(env: NodeJS.ProcessEnv): string[] {
  try {
    quotaDefaults(env);
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}

export interface QuotaWindows {
  dayStart: Date;
  dayEnd: Date;
  monthStart: Date;
  monthEnd: Date;
}

/**
 * Calendar day and month in UTC, so the windows do not move with the server's time zone. For a user in
 * Korea the daily count therefore resets at 09:00 local time.
 */
export function quotaWindows(now: Date = new Date()): QuotaWindows {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return {
    dayStart: new Date(Date.UTC(year, month, day)),
    dayEnd: new Date(Date.UTC(year, month, day + 1)),
    monthStart: new Date(Date.UTC(year, month, 1)),
    monthEnd: new Date(Date.UTC(year, month + 1, 1)),
  };
}
