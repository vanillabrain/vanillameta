import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import type { PublishedBlock } from '../Dashboard/Studio/studioPublication';
const positive = z.number().int().positive().safe();
const version = z.number().int().nonnegative().safe();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const value = z.union([z.string(), z.number().finite(), z.null()]);
const type = z.enum(['string', 'number', 'boolean', 'date', 'datetime']);
const labels = {
  title: z.string().max(1000),
  description: z.string().max(10000),
  display: z
    .object({
      decimalPlaces: z.number().int().min(0).max(20).optional(),
      numberNotation: z.enum(['full', 'compact']).optional(),
      prefix: z.string().max(100).optional(),
      suffix: z.string().max(100).optional(),
      presentation: z.enum(['visual', 'table', 'summary']).optional(),
      timeGrain: z.enum(['auto', 'day', 'week', 'month']).optional(),
    })
    .strict(),
};
const trend = z
  .object({
    grain: z.enum(['auto', 'hour', 'day', 'week', 'month', 'minute']),
    timeZone: z.string().max(100).optional(),
    points: z.array(z.object({ time: z.string().max(100), value }).strict()).max(10000),
  })
  .strict();
export const readerSchema = z
  .object({
    role: z.enum(['owner', 'recipient']),
    title: z.string(),
    body: z.string(),
    version: positive,
    savedAt: z.string(),
    period: z.string(),
    timeZone: z.string(),
    capturedAt: z.string(),
    blocks: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('kpi'), ...labels, valueType: type, value, trend: trend.optional() }).strict(),
          z
            .object({
              kind: z.literal('chart'),
              ...labels,
              chart: z.enum(['CHART_BAR', 'CHART_COLUMN', 'CHART_LINE']),
              valueType: type,
              categoryType: type,
              points: z.array(z.object({ category: scalar, value }).strict()),
            })
            .strict(),
        ]),
      )
      .length(2),
  })
  .strict();
export type ReportReaderData = z.infer<typeof readerSchema>;
export const reportLibraryItem = z
  .object({
    kind: z.literal('report'),
    id: z.string().uuid(),
    title: z.string(),
    version: positive,
    updatedAt: z.string(),
    ownership: z.enum(['owned', 'received']),
  })
  .strict();
export type ReportLibraryItem = z.infer<typeof reportLibraryItem>;
const librarySchema = z.object({ items: z.array(reportLibraryItem), nextCursor: z.string().uuid().nullable() }).strict();
const peerSchema = z.object({ id: positive, userId: z.string(), team: z.string() }).strict();
export type ReportPeer = z.infer<typeof peerSchema>;
const sharesSchema = z
  .object({
    organizationId: positive,
    headRevision: hash.nullable(),
    headVersion: positive.nullable(),
    canShare: z.boolean(),
    items: z.array(
      z
        .object({
          recipientId: positive,
          userId: z.string().nullable(),
          team: z.string().nullable(),
          active: z.boolean(),
          relationVersion: version,
          pinnedVersion: positive,
          status: z.enum(['active', 'suspended', 'revoked']),
        })
        .strict(),
    ),
    nextCursor: positive.nullable(),
  })
  .strict();
export type ReportShares = z.infer<typeof sharesSchema>;
export const shareCommandSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedOrganizationId: positive,
    recipientId: positive,
    expectedRelationVersion: version,
    operation: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('share'), expectedHeadRevision: hash }).strict(),
      z.object({ kind: z.literal('revoke') }).strict(),
    ]),
  })
  .strict();
export type ShareCommand = z.infer<typeof shareCommandSchema>;
const receiptSchema = z
  .object({
    requestId: z.string().uuid(),
    recipientId: positive,
    operation: z.enum(['share', 'revoke']),
    relationVersion: version,
    pinnedVersion: positive.nullable(),
    committedAt: z.string(),
  })
  .strict();
const options = (signal?: AbortSignal) => ({ signal, headers: { 'Cache-Control': 'no-cache' } });
export const reportSharingApi = {
  async reader(id: string, signal?: AbortSignal) {
    return readerSchema.parse((await get(`/reports/${id}/reader`, undefined, options(signal))).data);
  },
  async library(signal?: AbortSignal, afterId?: string) {
    return librarySchema.parse((await get('/reports/library', afterId ? { afterId } : undefined, options(signal))).data);
  },
  async peers(id: string, q: string, afterId: number, signal?: AbortSignal) {
    return z
      .object({ items: z.array(peerSchema), nextCursor: positive.nullable() })
      .strict()
      .parse((await get(`/reports/${id}/peers`, { q, afterId }, options(signal))).data);
  },
  async shares(id: string, signal?: AbortSignal, afterId?: number) {
    return sharesSchema.parse((await get(`/reports/${id}/shares`, afterId ? { afterId } : undefined, options(signal))).data);
  },
  async change(id: string, command: ShareCommand, signal?: AbortSignal) {
    return z
      .object({ receipt: receiptSchema, replayed: z.boolean() })
      .strict()
      .parse((await post(`/reports/${id}/shares`, shareCommandSchema.parse(command), options(signal))).data);
  },
  async outcome(id: string, requestId: string, signal?: AbortSignal) {
    return z
      .discriminatedUnion('status', [
        z.object({ status: z.literal('missing') }).strict(),
        z.object({ status: z.literal('committed'), receipt: receiptSchema }).strict(),
      ])
      .parse((await get(`/reports/${id}/shares/outcome/${requestId}`, undefined, options(signal))).data);
  },
};
export function readerBlocks(report: ReportReaderData): PublishedBlock[] {
  return report.blocks.map((block, index) =>
    block.kind === 'kpi'
      ? {
          id: `report-${index}`,
          kind: 'BOARD_NUMERIC',
          title: block.title,
          description: block.description,
          display: block.display,
          ...(block.trend
            ? {
                trend: {
                  grain: block.trend.grain,
                  timeZone: block.trend.timeZone,
                  points: block.trend.points.map(point => ({ time: point.time, value: point.value })),
                },
              }
            : {}),
          valueField: 'value',
          fields: [{ columnName: 'value', columnType: block.valueType }],
          datas: [{ value: block.value }],
        }
      : {
          id: `report-${index}`,
          kind: block.chart,
          title: block.title,
          description: block.description,
          display: block.display,
          valueField: 'value',
          categoryField: 'category',
          fields: [
            { columnName: 'category', columnType: block.categoryType },
            { columnName: 'value', columnType: block.valueType },
          ],
          datas: block.points.map(point => ({ category: point.category, value: point.value })),
        },
  );
}
