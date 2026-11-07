import { DashboardToolException } from './mcp-dashboard.errors';

type Window = { expires: number; used: number };

/**
 * A fixed-window counter per account, in memory. The limit is per account and not per connection:
 * one user can hold several connections, and a limit per grant would be the number of connections
 * times larger. One server instance is assumed, as with `UserThrottle`.
 */
export class ActorWindowLimiter {
  private readonly windows = new Map<string, Window>();
  constructor(private readonly now: () => number = Date.now) {}

  take(actorId: number, bucket: string, limit: number, windowMs: number): void {
    const now = this.now();
    // Each window keeps its own end: buckets have different lengths, so one call's length must not
    // decide whether another bucket's window is over.
    if (this.windows.size > 10_000)
      for (const [key, window] of this.windows) if (window.expires <= now) this.windows.delete(key);
    const key = `${actorId}\0${bucket}`;
    const current = this.windows.get(key);
    const window =
      current && current.expires > now ? current : { expires: now + windowMs, used: 0 };
    if (window.used >= limit) throw new DashboardToolException('LIMIT', 'RATE_LIMITED');
    window.used += 1;
    this.windows.set(key, window);
  }
}

export const DASHBOARD_LIMITS = {
  /** A preview runs the source's DuckDB, the expensive call. */
  preview: { limit: 10, windowMs: 60_000 },
  write: { limit: 20, windowMs: 60_000 },
  create: { limit: 10, windowMs: 3_600_000 },
  delete: { limit: 10, windowMs: 60_000 },
} as const;
