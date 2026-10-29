import { z } from 'zod';

const pendingSchema = z.object({ requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() }).strict();
export type PendingRefresh = Required<z.infer<typeof pendingSchema>>;
export function recoveryKey(scope: string, documentId: string) {
  return `vm:document-refresh:v1:${scope}:${documentId}`;
}
export function readPending(key: string): PendingRefresh | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? 'null'));
    return parsed.success ? { requestId: parsed.data.requestId, expectedVersion: parsed.data.expectedVersion } : null;
  } catch {
    return null;
  }
}
export function storePending(key: string, pending: PendingRefresh) {
  try {
    sessionStorage.setItem(key, JSON.stringify(pending));
  } catch {
    /* In-memory recovery remains available. */
  }
}
export function clearPending(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* A retained UUID is safe to look up again. */
  }
}
