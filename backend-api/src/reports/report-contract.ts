import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'crypto';
import { z } from 'zod';

export const REPORT_PAYLOAD_LIMIT = 2 * 1024 * 1024;
export const REPORT_OWNER_LIMIT = 20 * 1024 * 1024;
const text = z
  .string()
  .refine(
    value => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value),
    'Invalid Unicode',
  );
export const reportId = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const positive = z.number().int().positive().safe();
export const reportCapture = z
  .object({
    dashboardId: positive,
    expectedDashboardRevision: hash,
    kpiId: z.string().min(1).max(128),
    chartId: z.string().min(1).max(128),
  })
  .strict()
  .refine(value => value.kpiId !== value.chartId);
export const reportPreviewRequest = z
  .object({
    expectedOrganizationId: positive.nullable(),
    capture: reportCapture,
  })
  .strict();
const blockId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const decodedBytes = (dataUrl: string) => Math.floor((dataUrl.length * 3) / 4) - 32;
export const reportBlock = z.discriminatedUnion('kind', [
  z
    .object({
      id: blockId,
      kind: z.literal('TEXT'),
      text: text.refine(value => value.length <= 20000, 'Text block exceeds 20000 characters'),
    })
    .strict(),
  z
    .object({
      id: blockId,
      kind: z.literal('IMAGE'),
      dataUrl: z
        .string()
        .max(760000)
        .refine(value => IMAGE_PATTERN.test(value), 'Unsupported image data URL')
        .refine(value => decodedBytes(value) <= 512 * 1024, 'Image exceeds 512KiB'),
      alt: z.string().max(200),
      width: z.enum(['full', 'half']),
    })
    .strict(),
]);
export const reportBlocks = z
  .array(reportBlock)
  .max(40)
  .refine(
    value => new Set(value.map(block => block.id)).size === value.length,
    'Duplicate block id',
  )
  .refine(
    value =>
      value.reduce(
        (bytes, block) => bytes + (block.kind === 'IMAGE' ? decodedBytes(block.dataUrl) : 0),
        0,
      ) <=
      1536 * 1024,
    'Images exceed 1.5MiB',
  );
export type ReportBlock = z.infer<typeof reportBlock>;
export const reportSaveRequest = z
  .object({
    requestId: reportId,
    expectedOrganizationId: positive.nullable(),
    expectedRevision: hash.nullable(),
    title: text.refine(value => value.length <= 200 && value.trim().length > 0),
    body: text.refine(value => Buffer.byteLength(value, 'utf8') <= 65536, 'Body exceeds 64KiB'),
    blocks: reportBlocks.optional(),
    data: z.discriminatedUnion('mode', [
      z
        .object({ mode: z.literal('capture'), capture: reportCapture, previewDigest: hash })
        .strict(),
      z.object({ mode: z.literal('retain'), fromRevision: hash }).strict(),
    ]),
  })
  .strict();
export type ReportCapture = z.infer<typeof reportCapture>;
export type ReportSave = z.infer<typeof reportSaveRequest>;
export type ReportActor = { id: number; authVersion: number };
export const reportSuggestionRequest = z
  .object({
    instruction: text.refine(value => value.length <= 500).optional(),
  })
  .strict();
export function parseReport<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException('보고서 요청의 항목과 크기를 확인해 주세요.');
  return parsed.data;
}
export function canonicalReport(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new BadRequestException('Invalid report number');
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new BadRequestException('Invalid report value');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalReport).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .filter(key => value[key] !== undefined)
      .map(key => JSON.stringify(key) + ':' + canonicalReport(value[key]))
      .join(',') +
    '}'
  );
}
export const reportHash = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
export function encodeReport(value: unknown) {
  const payload = canonicalReport(value);
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (bytes > REPORT_PAYLOAD_LIMIT)
    throw new PayloadTooLargeException('보고서는 2MiB까지 저장할 수 있습니다.');
  const points = Array.from(payload);
  const chunks: string[] = [];
  for (let i = 0; i < points.length; i += 8000) chunks.push(points.slice(i, i + 8000).join(''));
  return { bytes, hash: reportHash(payload), chunks };
}
