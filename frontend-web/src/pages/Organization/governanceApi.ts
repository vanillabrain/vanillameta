import { captureAuthResponseFence as organizationSessionFence } from '@/helpers/authResponseFence';
export { captureAuthResponseFence as organizationSessionFence } from '@/helpers/authResponseFence';
import { get, post } from '@/helpers/apiHelper';
import { PublishedBlock } from '@/pages/Dashboard/Studio/studioPublication';
export type Organization = { id: number; name: string; role: 'admin' | 'viewer' };
export type ViewCatalog = {
  dashboardId: number;
  organization: string;
  title: string;
  viewRevision: string;
  scope: string;
  columns: { name: string; type: string }[];
  blocks: { id: string; title: string; kind: string; display: PublishedBlock['display'] }[];
  capabilities: { ai: boolean; export: boolean; edit: false };
};
export type ViewFilter = { column: string; values: (string | number | boolean | null)[] };
export type ViewResult = { viewRevision: string; filters: ViewFilter[]; queriedAt: string; blocks: PublishedBlock[] };
export const unwrap = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error('응답을 확인하지 못했습니다.');
  return response.data.data;
};
const identityByRequest = new WeakMap<AbortSignal, () => void>();
export const organizationAuthEvent = (e: StorageEvent) =>
  e.key === null || e.key === 'accessToken' || e.key === 'vm:editor-draft-auth:v1';
function identityFence(signal?: AbortSignal) {
  const existing = signal && identityByRequest.get(signal);
  if (existing) return existing;
  const session = organizationSessionFence();
  const assert = () => {
    if (signal?.aborted) throw { response: { status: 403 } };
    session();
  };
  if (signal) identityByRequest.set(signal, assert);
  return assert;
}
export function assertOrganizationRequest(signal?: AbortSignal) {
  identityFence(signal)();
}
export const orgGet = async (path: string, signal?: AbortSignal) => {
  const check = identityFence(signal);
  check();
  const response = await get('/bi/organizations' + path, undefined, { signal, headers: { 'Cache-Control': 'no-cache' } });
  check();
  return unwrap(response);
};
export const orgPost = async (path: string, body: unknown, signal?: AbortSignal) => {
  const check = identityFence(signal);
  check();
  const response = await post('/bi/organizations' + path, body, {
    signal,
    timeout: 180000,
    headers: { 'Cache-Control': 'no-cache' },
  });
  check();
  return unwrap(response);
};
export const organizationError = (error: any) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403)
    return '이 조직 분석에 접근할 권한이 없거나 권한이 회수되었습니다. 관리자에게 확인해 주세요.';
  if (status === 409) return '분석·데이터 또는 접근 범위가 바뀌었습니다. 다시 확인해 주세요.';
  if (status === 400) return '허용된 지표·열·조건과 입력을 확인해 주세요.';
  return '처리 상태를 확인하지 못했습니다. 이전 결과를 지웠습니다. 다시 시도해 주세요.';
};
export const governedScalar = (x: unknown) =>
  x === null ||
  (typeof x === 'string' && x.length <= 65536) ||
  typeof x === 'boolean' ||
  (typeof x === 'number' && Number.isFinite(x));
const text = (v: unknown, max = 300) => typeof v === 'string' && v.length <= max;
export function validateViewCatalog(v: any, dashboardId: number): ViewCatalog {
  if (
    v?.dashboardId !== dashboardId ||
    !text(v.title) ||
    !text(v.organization) ||
    !text(v.scope) ||
    !/^[a-f0-9]{64}$/.test(v.viewRevision) ||
    !Array.isArray(v.columns) ||
    !v.columns.length ||
    v.columns.length > 32 ||
    !v.columns.every(c => text(c.name, 128) && text(c.type, 128)) ||
    !Array.isArray(v.blocks) ||
    !v.blocks.length ||
    v.blocks.length > 6 ||
    !v.blocks.every(
      b => text(b.id, 100) && text(b.title) && ['BOARD_NUMERIC', 'CHART_LINE', 'CHART_COLUMN', 'CHART_BAR'].includes(b.kind),
    ) ||
    typeof v.capabilities?.ai !== 'boolean' ||
    typeof v.capabilities?.export !== 'boolean' ||
    v.capabilities?.edit !== false
  )
    throw new Error('조직 보기 응답을 확인하지 못했습니다.');
  return v;
}
export function validateViewResult(v: any, catalog: ViewCatalog): ViewResult {
  if (
    v?.viewRevision !== catalog.viewRevision ||
    !Number.isFinite(Date.parse(v.queriedAt)) ||
    !Array.isArray(v.blocks) ||
    !v.blocks.length ||
    v.blocks.length > 6 ||
    !v.blocks.every(
      b =>
        catalog.blocks.some(c => c.id === b.id && c.kind === b.kind) &&
        text(b.title) &&
        b.valueField === 'value' &&
        (b.categoryField === undefined || b.categoryField === 'dimension') &&
        Array.isArray(b.datas) &&
        b.datas.length <= 200 &&
        b.datas.every(
          r => r && Object.keys(r).every(k => ['value', 'dimension'].includes(k)) && Object.values(r).every(governedScalar),
        ),
    ) ||
    !Array.isArray(v.filters) ||
    v.filters.length > 4 ||
    !v.filters.every(
      f =>
        catalog.columns.some(c => c.name === f.column) &&
        Array.isArray(f.values) &&
        f.values.length <= 20 &&
        f.values.every(governedScalar),
    )
  )
    throw new Error('현재 접근 범위의 집계 결과를 확인하지 못했습니다.');
  return { ...v, blocks: v.blocks.map(b => ({ ...b, description: '', fields: [] })) };
}

export function validateScopedRows(v: any, catalog: ViewCatalog, candidates = false): Record<string, unknown>[] {
  const names = candidates ? ['value'] : catalog.columns.map(c => c.name);
  if (
    v?.viewRevision !== catalog.viewRevision ||
    !Array.isArray(v.rows) ||
    v.rows.length > 50 ||
    !v.rows.every(
      r =>
        r &&
        typeof r === 'object' &&
        !Array.isArray(r) &&
        Object.keys(r).length === names.length &&
        names.every(k => Object.hasOwn(r, k)) &&
        Object.values(r).every(governedScalar),
    )
  )
    throw new Error('허용된 행 결과를 확인하지 못했습니다.');
  return v.rows;
}
export function validateScopedCsv(v: any, catalog: ViewCatalog): string {
  if (
    v?.viewRevision !== catalog.viewRevision ||
    typeof v.csv !== 'string' ||
    !Number.isSafeInteger(v.bytes) ||
    v.bytes < 0 ||
    v.bytes > 2097152 ||
    new TextEncoder().encode(v.csv).byteLength !== v.bytes
  )
    throw new Error('허용된 CSV 응답을 확인하지 못했습니다.');
  return v.csv;
}
