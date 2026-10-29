import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import { PublishedBlock } from '../Dashboard/Studio/studioPublication';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const positive = z.number().int().positive().safe();
export const captureSchema = z
  .object({
    dashboardId: positive,
    expectedDashboardRevision: hash,
    kpiId: z.string().min(1).max(128),
    chartId: z.string().min(1).max(128),
  })
  .strict();
export const commandSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedOrganizationId: positive.nullable(),
    expectedRevision: hash.nullable(),
    title: z.string().min(1).max(200),
    body: z.string().refine(value => new TextEncoder().encode(value).length <= 65536),
    data: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('capture'), capture: captureSchema, previewDigest: hash }).strict(),
      z.object({ mode: z.literal('retain'), fromRevision: hash }).strict(),
    ]),
  })
  .strict();
export type ReportCommand = z.infer<typeof commandSchema>;
export type Capture = z.infer<typeof captureSchema>;
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const blockSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    kind: z.enum(['BOARD_NUMERIC', 'CHART_BAR', 'CHART_COLUMN', 'CHART_LINE']),
    display: z
      .object({
        presentation: z.enum(['visual', 'table', 'summary']).optional(),
        timeGrain: z.enum(['auto', 'day', 'week', 'month']).optional(),
        decimalPlaces: z.number().int().optional(),
        numberNotation: z.enum(['full', 'compact']).optional(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
      })
      .strict(),
    valueField: z.string(),
    categoryField: z.string().optional(),
    fields: z.array(z.object({ columnName: z.string(), columnType: z.string() })),
    datas: z.array(z.record(scalar)),
    trend: z
      .object({
        grain: z.string(),
        timeZone: z.string().optional(),
        points: z.array(z.object({ time: z.string(), value: z.union([z.string(), z.number().finite(), z.null()]) })),
      })
      .optional(),
  })
  .strict();
const snapshotSchema = z.object({
  capturedAt: z.string(),
  rendered: z.object({ title: z.string(), periodLabel: z.string(), blocks: z.array(blockSchema).length(2) }).passthrough(),
  basis: z
    .object({
      dashboardId: positive,
      dashboardRevision: hash,
      source: z.object({ id: positive, revision: hash, schemaVersion: hash, dataVersion: hash }),
      selection: z.object({ kpiId: z.string(), chartId: z.string() }),
      timeZone: z.string(),
    })
    .passthrough(),
});
export type ReportSnapshot = z.infer<typeof snapshotSchema>;
const reportSchema = z.object({
  reportId: z.string().uuid(),
  version: positive,
  title: z.string(),
  body: z.string(),
  savedAt: z.string(),
  revision: hash,
  organizationId: positive.nullable(),
  snapshot: snapshotSchema,
});
export type Report = z.infer<typeof reportSchema>;
const rootSchema = z.object({
  dashboardId: positive,
  revision: hash,
  organizationId: positive.nullable(),
  title: z.string(),
  blocks: z.array(z.object({ id: z.string(), title: z.string(), kind: z.string() })),
});
export type ReportRoot = z.infer<typeof rootSchema>;
const previewSchema = z.object({ snapshot: snapshotSchema, previewDigest: hash });
export type ReportPreview = z.infer<typeof previewSchema>;
const options = { timeout: 180000, headers: { 'Cache-Control': 'no-cache' } };
export const reportApi = {
  async list(signal?: AbortSignal) {
    return z
      .array(z.object({ id: z.string().uuid(), title: z.string(), revision: hash, updatedAt: z.string() }))
      .parse((await get('/reports', undefined, { ...options, signal })).data);
  },
  async root(id: number) {
    return rootSchema.parse((await get('/reports/roots/' + id, undefined, options)).data);
  },
  async read(id: string) {
    return reportSchema.parse((await get('/reports/' + id, undefined, options)).data);
  },
  async preview(id: string, expectedOrganizationId: number | null, capture: Capture) {
    return previewSchema.parse(
      (await post('/reports/' + id + '/preview', { expectedOrganizationId, capture }, options)).data,
    );
  },
  async save(id: string, command: ReportCommand) {
    return z
      .object({ report: reportSchema, replayed: z.boolean() })
      .parse((await post('/reports/' + id + '/save', commandSchema.parse(command), options)).data);
  },
  async outcome(id: string, requestId: string, dashboardId: number) {
    return z
      .discriminatedUnion('status', [
        z.object({ status: z.literal('missing') }),
        z.object({ status: z.literal('committed'), report: reportSchema }),
      ])
      .parse((await get('/reports/' + id + '/outcome/' + requestId, { dashboardId }, options)).data);
  },
};
export function isReportAccessError(error: unknown): boolean {
  const parsed = z.object({ response: z.object({ status: z.number() }) }).safeParse(error);
  return parsed.success && [401, 403, 404].includes(parsed.data.response.status);
}
export function reportError(error: unknown, context: 'load' | 'action' = 'action'): string {
  const response = z.object({ response: z.object({ status: z.number() }) }).safeParse(error);
  if (response.success) {
    switch (response.data.response.status) {
      case 401:
        return '로그인이 만료됐습니다. 다시 로그인한 뒤 보고서를 열어 주세요.';
      case 403:
        return '보고서 또는 원본 소스에 접근할 수 없습니다. 현재 권한과 소스 활성 상태를 확인해 주세요.';
      case 404:
        return '보고서 또는 원본을 찾을 수 없습니다. 목록에서 확인해 주세요.';
      case 409:
        return '보고서 또는 원본의 기준이 변경됐습니다. 초안과 보관된 요청은 유지했습니다. 현재 기준을 확인해 주세요.';
    }
  }
  if (context === 'load') return '보고서를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 불러오기를 선택해 주세요.';
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = z
      .object({ data: z.object({ message: z.union([z.string(), z.array(z.string())]) }) })
      .safeParse(error.response);
    if (detail.success) return [detail.data.data.message].flat().join(' ');
  }
  return '요청을 확인하지 못했습니다. 초안을 유지했습니다. 연결과 권한을 확인해 주세요.';
}
export function reportBlocks(snapshot: ReportSnapshot): PublishedBlock[] {
  return snapshot.rendered.blocks as PublishedBlock[];
}
