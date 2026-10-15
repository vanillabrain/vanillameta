import { createHash } from 'crypto';
/** Same metadata + immutable file version used by profile and transactional save checks. */
export function sourceRevision(source: any, selectedVersion: string) {
  return createHash('sha256')
    .update(JSON.stringify([source.id, source.createdAt, source.updatedAt, selectedVersion]))
    .digest('hex');
}
