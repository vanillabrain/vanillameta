import { z } from 'zod';
import { reportId } from './report-contract';
const positive = z.number().int().positive().safe();
export const reportShareCommand = z
  .object({
    requestId: reportId,
    expectedOrganizationId: positive,
    recipientId: positive,
    expectedRelationVersion: z.number().int().nonnegative().safe(),
    operation: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('share'),
          expectedHeadRevision: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
      z.object({ kind: z.literal('revoke') }).strict(),
    ]),
  })
  .strict();
export const reportShareReceipt = z
  .object({
    requestId: reportId,
    recipientId: positive,
    operation: z.enum(['share', 'revoke']),
    relationVersion: z.number().int().nonnegative().safe(),
    pinnedVersion: positive.nullable(),
    committedAt: z.string(),
  })
  .strict();
export const reportPeerQuery = z
  .object({
    q: z.string().trim().max(100).default(''),
    afterId: z.coerce.number().int().nonnegative().safe().default(0),
  })
  .strict();
export type ShareReceipt = z.infer<typeof reportShareReceipt>;
