const DAY_MS = 86_400_000;
/** The same ceiling the BI publication already applies, so the two public link kinds agree. */
export const PUBLICATION_MAX_DAYS = 30;
/** A browser fills the expiry as "now + 30 days"; the request reaches the server a moment later. */
const CLOCK_GRACE_MS = 60 * 60 * 1000;

/**
 * Days a public link lasts when the owner sets no expiry. `PUBLICATION_DEFAULT_DAYS` may shorten it; it
 * cannot exceed the ceiling, and a malformed value fails fast instead of silently falling back.
 */
export function publicationDefaultDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PUBLICATION_DEFAULT_DAYS?.trim();
  if (!raw) return PUBLICATION_MAX_DAYS;
  const days = Number(raw);
  if (!/^\d+$/.test(raw) || days < 1 || days > PUBLICATION_MAX_DAYS)
    throw new Error(
      `PUBLICATION_DEFAULT_DAYS must be an integer from 1 to ${PUBLICATION_MAX_DAYS}`,
    );
  return days;
}

export function defaultPublicationExpiry(now: number = Date.now()): Date {
  return new Date(now + publicationDefaultDays() * DAY_MS);
}

/** Latest expiry accepted for a request made now, in epoch milliseconds. */
export function latestPublicationExpiry(now: number = Date.now()): number {
  return now + PUBLICATION_MAX_DAYS * DAY_MS + CLOCK_GRACE_MS;
}

/** Problems with the publication settings, as messages for the production boot check. */
export function publicationConfigProblems(env: NodeJS.ProcessEnv): string[] {
  try {
    publicationDefaultDays(env);
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}
