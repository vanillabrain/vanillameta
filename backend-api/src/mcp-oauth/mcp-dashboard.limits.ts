import { DashboardToolException } from './mcp-dashboard.errors';

type Window = { start: number; used: number };

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
    if (this.windows.size > 10_000)
      for (const [key, window] of this.windows)
        if (now - window.start >= windowMs) this.windows.delete(key);
    const key = `${actorId}\0${bucket}`;
    const current = this.windows.get(key);
    const window = current && now - current.start < windowMs ? current : { start: now, used: 0 };
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
} as const;
