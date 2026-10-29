import { z } from 'zod';
import { shareCommandSchema, ShareCommand } from './reportSharingApi';
const pendingSchema = z
  .object({ version: z.literal(1), updatedAt: z.number().finite(), command: shareCommandSchema })
  .strict();
const TTL = 24 * 60 * 60 * 1000;
export function sharePendingKey(scope: string, organizationId: number, reportId: string) {
  return `vm:report-share:v1:${scope}:${organizationId}:${reportId}`;
}
export function readSharePending(key: string, now = Date.now()): ShareCommand | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || new TextEncoder().encode(raw).length > 8192) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.updatedAt > now + 60000 || now - parsed.data.updatedAt >= TTL) return null;
    return parsed.data.command;
  } catch {
    return null;
  }
}
export function storeSharePending(key: string, command: ShareCommand): boolean {
  try {
    const raw = JSON.stringify(pendingSchema.parse({ version: 1, updatedAt: Date.now(), command }));
    if (new TextEncoder().encode(raw).length > 8192) return false;
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}
export function removeSharePending(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
