import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Metadata key of its own. `@Throttle(limit, ttl)` writes THROTTLER_* keys that the global per-IP guard
 * also reads, so reusing it would quietly tighten the IP limit of the same route as well.
 */
export const USER_THROTTLE_KEY = 'vanillameta:user-throttle';

export type UserThrottlePreset = 'ai' | 'upload' | 'read';

const WINDOW_MS = 60_000;
const DEFAULT_PER_MINUTE: Record<UserThrottlePreset, number> = { ai: 20, upload: 5, read: 30 };
const ENV_NAME: Record<UserThrottlePreset, string> = {
  ai: 'USER_THROTTLE_AI_PER_MIN',
  upload: 'USER_THROTTLE_UPLOAD_PER_MIN',
  read: 'USER_THROTTLE_READ_PER_MIN',
};

/** Requests per minute for one user and one route. Fails fast on a malformed setting. */
export function userThrottleLimit(
  preset: UserThrottlePreset,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[ENV_NAME[preset]]?.trim();
  if (!raw) return DEFAULT_PER_MINUTE[preset];
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new Error(`${ENV_NAME[preset]} must be a positive integer`);
  return Number(raw);
}

/** Problems with the throttle settings, as messages for the production boot check. */
export function userThrottleConfigProblems(env: NodeJS.ProcessEnv): string[] {
  return (['ai', 'upload', 'read'] as const).flatMap(preset => {
    try {
      userThrottleLimit(preset, env);
      return [];
    } catch (error) {
      return [(error as Error).message];
    }
  });
}

/**
 * Limits how often one signed-in user may call a route, on top of the global per-IP limit. List it
 * after JwtAuthGuard in `@UseGuards`, which is what makes `req.user` available.
 */
export const UserThrottle = (preset: UserThrottlePreset) => SetMetadata(USER_THROTTLE_KEY, preset);

/**
 * Fixed one-minute windows held in memory, which is correct for the single-instance deployment (see
 * AGENTS.md). Expired windows are dropped as requests arrive, so the map does not grow without bound.
 */
@Injectable()
export class UserThrottleGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private nextSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const preset = this.reflector.getAllAndOverride<UserThrottlePreset | undefined>(
      USER_THROTTLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!preset) return true;
    const http = context.switchToHttp();
    const id = http.getRequest()?.user?.accessKeyData?.id;
    // A share-link token has no account; it cannot reach these routes, and if one ever did it would
    // be refused rather than counted under a shared key.
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new ForbiddenException('Current actor required.');
    const now = Date.now();
    this.sweep(now);
    const key = `${context.getClass().name}.${context.getHandler().name}:${id}`;
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + WINDOW_MS };
      this.windows.set(key, window);
    }
    if (window.count >= userThrottleLimit(preset)) {
      const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
      http.getResponse()?.setHeader?.('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          error: 'RATE_LIMITED',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
          retryAfterSeconds: retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    window.count += 1;
    return true;
  }

  private sweep(now: number) {
    if (now < this.nextSweep) return;
    this.nextSweep = now + WINDOW_MS;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }

  /** For tests: how many windows are being tracked. */
  size() {
    return this.windows.size;
  }
}
