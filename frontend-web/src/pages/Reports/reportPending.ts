import { z } from 'zod';
import { editorDraftKey } from '@/helpers/editorDraftStorage';
import { getToken } from '@/helpers/authHelper';
import { commandSchema } from './reportApi';
const LIMIT = 128 * 1024;
const TTL = 24 * 60 * 60 * 1000;
const pendingSchema = z
  .object({
    version: z.literal(1),
    reportId: z.string().uuid(),
    dashboardId: z.number().int().positive(),
    updatedAt: z.number(),
    command: commandSchema,
  })
  .strict();
export type ReportPending = z.infer<typeof pendingSchema>;
export async function reportPendingKey(dashboardId: number, organizationId: number | null, routeId: string) {
  const scope = await editorDraftKey(getToken(), dashboardId);
  return scope ? `${scope}:private-report:${organizationId ?? 'none'}:${routeId}` : null;
}
function valid(value: unknown, now: number) {
  const result = pendingSchema.safeParse(value);
  if (!result.success || result.data.updatedAt > now + 60000 || now - result.data.updatedAt >= TTL) return null;
  return result.data;
}
export function readReportPending(key: string | null, now = Date.now()): ReportPending | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || new TextEncoder().encode(raw).length > LIMIT) return null;
    return valid(JSON.parse(raw), now);
  } catch {
    return null;
  }
}
export function storeReportPending(key: string | null, value: ReportPending): boolean {
  if (!key || !valid(value, Date.now())) return false;
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > LIMIT) return false;
  try {
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export function removeReportPending(key: string | null): boolean {
  if (!key) return false;
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
