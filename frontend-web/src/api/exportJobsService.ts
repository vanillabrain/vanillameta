import { get, post } from '@/helpers/apiHelper';

export type ExportPayload = { mode: 'explore' | 'pivot'; query: Record<string, unknown> };
export type ExportJobStatus = 'queued' | 'running' | 'ready' | 'failed' | 'cancelled' | 'interrupted' | 'expired';
export type ExportJob = {
  id: number;
  requestId: string;
  sourceId: number;
  sourceRevision: string;
  measureVersions: Record<string, number>;
  payload: ExportPayload;
  status: ExportJobStatus;
  version: number;
  createdAt: string;
  expiresAt: string;
  rowCount: number;
  bytes: number;
  filename: string | null;
  errorCode: string | null;
};
export type ExportJobRequest = { requestId: string; payload: ExportPayload; measureVersions: Record<string, number> };
const path = '/bi/export-jobs';
const statuses: ExportJobStatus[] = ['queued', 'running', 'ready', 'failed', 'cancelled', 'interrupted', 'expired'];
// Backend canonicalizes object keys; reject substituted conditions or versions regardless of key order.
const stableJson = (value: any): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map(key => [key, item[key]]),
        )
      : item,
  );
const validJob = (job: any): job is ExportJob =>
  !!job &&
  Number.isSafeInteger(job.id) &&
  job.id > 0 &&
  typeof job.requestId === 'string' &&
  Number.isSafeInteger(job.sourceId) &&
  job.sourceId > 0 &&
  typeof job.sourceRevision === 'string' &&
  !!job.sourceRevision &&
  Number.isSafeInteger(job.version) &&
  job.version > 0 &&
  statuses.includes(job.status) &&
  !!job.payload &&
  ['explore', 'pivot'].includes(job.payload.mode) &&
  job.payload.query?.sourceId === job.sourceId &&
  job.payload.query?.sourceRevision === job.sourceRevision &&
  !!job.measureVersions &&
  !Array.isArray(job.measureVersions) &&
  typeof job.createdAt === 'string' &&
  Number.isFinite(Date.parse(job.createdAt)) &&
  typeof job.expiresAt === 'string' &&
  Number.isFinite(Date.parse(job.expiresAt)) &&
  Number.isSafeInteger(job.rowCount) &&
  job.rowCount >= 0 &&
  job.rowCount <= 10000 &&
  Number.isSafeInteger(job.bytes) &&
  job.bytes >= 0 &&
  job.bytes <= 2097152 &&
  (job.filename === null || (typeof job.filename === 'string' && /^[a-zA-Z0-9_-]+\.csv$/.test(job.filename))) &&
  Object.values(job.measureVersions).every(v => Number.isSafeInteger(v) && Number(v) > 0);
const readJob = (value: unknown): ExportJob => {
  if (!validJob(value)) throw new Error('작업 응답을 확인하지 못했습니다. 다시 읽어 주세요.');
  return value;
};
export const exportJobsService = {
  create: async (body: ExportJobRequest) => {
    const job = readJob((await post(path, body)).data);
    if (
      job.requestId !== body.requestId ||
      job.sourceId !== body.payload.query.sourceId ||
      job.sourceRevision !== body.payload.query.sourceRevision ||
      stableJson(job.measureVersions) !== stableJson(body.measureVersions) ||
      stableJson(job.payload) !== stableJson(body.payload)
    )
      throw new Error('접수 응답의 기준이 다릅니다. 같은 요청을 재확인해 주세요.');
    return job;
  },
  list: async (beforeId?: number): Promise<{ entries: ExportJob[]; nextBeforeId: number | null }> => {
    const data = (await get(path, beforeId === undefined ? undefined : { beforeId })).data;
    if (
      !Array.isArray(data?.entries) ||
      data.entries.length > 20 ||
      !data.entries.every(
        (entry: any, index: number) =>
          Number.isSafeInteger(entry.id) &&
          entry.id > 0 &&
          (beforeId === undefined || entry.id < beforeId) &&
          (index === 0 || entry.id < data.entries[index - 1].id) &&
          (data.nextBeforeId === null || entry.id >= data.nextBeforeId),
      ) ||
      !(
        data.nextBeforeId === null ||
        (Number.isSafeInteger(data.nextBeforeId) &&
          data.nextBeforeId > 0 &&
          (beforeId === undefined || data.nextBeforeId < beforeId))
      )
    )
      throw new Error('작업 목록 응답을 확인하지 못했습니다.');
    return { entries: data.entries.map(readJob), nextBeforeId: data.nextBeforeId };
  },
  read: async (id: number) => readJob((await get(`${path}/${id}`)).data),
  run: async (id: number, expectedVersion: number) => readJob((await post(`${path}/${id}/run`, { expectedVersion })).data),
  cancel: async (id: number, expectedVersion: number) =>
    readJob((await post(`${path}/${id}/cancel`, { expectedVersion })).data),
  file: async (job: ExportJob): Promise<{ blob: Blob; filename: string }> => {
    const data = (await get(`${path}/${job.id}/file`)).data;
    if (
      data?.sourceRevision !== job.sourceRevision ||
      typeof data.csv !== 'string' ||
      typeof data.filename !== 'string' ||
      !/^[a-zA-Z0-9_-]+\.csv$/.test(data.filename) ||
      data.mimeType !== 'text/csv;charset=utf-8' ||
      !Number.isInteger(data.rowCount) ||
      data.rowCount < 0 ||
      data.rowCount > 10000
    )
      throw new Error('고정 파일의 기준 또는 형식이 올바르지 않습니다. 작업을 다시 읽어 주세요.');
    const blob = new Blob([data.csv], { type: data.mimeType });
    if (blob.size > 2097152 || blob.size !== data.bytes) throw new Error('CSV 파일 크기가 올바르지 않습니다.');
    return { blob, filename: data.filename };
  },
};

export function exportJobError(error: any): string {
  const status = error?.response?.status;
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '현재 이 소스를 내보낼 권한이 없습니다.';
  if (status === 404) return '작업을 찾을 수 없거나 현재 접근할 수 없습니다.';
  if (status === 409)
    return '작업 또는 데이터 기준이 변경되었습니다. 작업을 다시 읽고, 새 기준은 새 작업으로 접수해 주세요.';
  if (status === 410) return '작업이 만료되었습니다. 현재 기준을 검토한 뒤 새 작업을 접수해 주세요.';
  if (status === 400 || status === 422) return '조건 또는 지표 버전을 확인해 주세요. 원본 행은 내보낼 수 없습니다.';
  return '요청 결과를 확인하지 못했습니다. QUERY_FAILED 작업은 조건을 확인하고 다시 실행해 주세요. 접수 중이었다면 같은 요청을 재확인해 주세요.';
}
