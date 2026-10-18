import { validateStudioPivotResult, StudioPivotResult } from './studioPivot';
import { get, post } from '@/helpers/apiHelper';
import { studioKeys, validateStudioDateRange, validateStudioFilters } from './studioDocument';
import { StudioDateRange, StudioDisplay, StudioDocumentV1, StudioFilter } from './studioTypes';
export type Publication = {
  token: string;
  version: number;
  visibility: 'private' | 'link';
  allowRemix: boolean;
  expiresAt: string | null;
  asOf: string;
  dataVersion?: string;
  revokedAt?: string | null;
};
export type PublicationRequest = {
  requestId: string;
  expectedRevision: string;
  visibility: 'private' | 'link';
  allowRemix: boolean;
  expiresAt?: string;
};
export type PublishedBlock = {
  id: string;
  title: string;
  description: string;
  kind: string;
  pivot?: StudioPivotResult;
  display: StudioDisplay;
  trend?: { grain: string; timeZone?: string; points: { time: string; value: string | number | null }[] };
  valueField?: string;
  categoryField?: string;
  fields?: unknown[];
  datas?: Record<string, unknown>[];
};
export type PublishedSnapshot = Publication & {
  snapshot: {
    title: string;
    periodLabel: string;
    /** Same protocol type as the editable document: the scope the snapshot was aggregated with. */
    filters?: StudioFilter[];
    /** Published period, read-only on this screen. Absent means the whole period was in scope. */
    dateRange?: StudioDateRange;
    conditionsApplied?: true;
    blocks: PublishedBlock[];
    layouts: StudioDocumentV1['layouts'];
  };
};
const noCache = { headers: { 'Cache-Control': 'no-cache' }, timeout: 180000 };
export function publicationError(error: any): string {
  const status = error?.response?.status;
  if (status === 410) return '게시가 중지되었거나 링크가 만료되었습니다. 소유자에게 새 링크를 요청해 주세요.';
  if (status === 401 || status === 403)
    return '이 게시물에 접근할 권한이 없습니다. 비공개 게시물은 소유자로 로그인해야 합니다.';
  if (status === 404) return '게시 링크를 찾을 수 없습니다. 주소를 확인해 주세요.';
  if (status === 409) return '저장 내용이 변경되었습니다. 최신 내용을 불러온 뒤 다시 게시해 주세요.';
  if (status === 400) return '게시 설정과 저장된 차트 정의를 확인해 주세요. 기존 게시본은 유지됩니다.';
  if (status === 413)
    return '게시 결과가 크기 한도를 초과했습니다. 기존 게시본은 유지됩니다. 블록이나 집계 범위를 줄여 주세요.';
  return '게시 상태를 확인하지 못했습니다. 연결을 확인한 뒤 같은 요청으로 다시 시도해 주세요.';
}
export function validatePublication(input: any): Publication {
  if (
    !input ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(input.token) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !['private', 'link'].includes(input.visibility) ||
    typeof input.allowRemix !== 'boolean' ||
    !Number.isFinite(Date.parse(input.asOf)) ||
    (input.expiresAt !== null && !Number.isFinite(Date.parse(input.expiresAt)))
  )
    throw new Error('게시 응답 형식을 확인하지 못했습니다.');
  if (input.revokedAt !== undefined && input.revokedAt !== null && !Number.isFinite(Date.parse(input.revokedAt)))
    throw new Error('게시 중지 시각을 확인하지 못했습니다.');
  return input;
}
export async function fetchOwnerPublication(id: number): Promise<Publication | null> {
  const { data } = await get('/studio/dashboards/' + id + '/publications', undefined, noCache);
  // Nest sends an empty 200 body for an owner with no publication yet.
  return data === null || data === '' ? null : validatePublication(data);
}
export async function publishDashboard(id: number, body: PublicationRequest): Promise<Publication> {
  const { data } = await post('/studio/dashboards/' + id + '/publications', body, noCache);
  return validatePublication(data);
}
export async function revokePublication(token: string): Promise<void> {
  await post('/studio/publications/' + encodeURIComponent(token) + '/revoke', {}, noCache);
}
export async function fetchPublished(token: string): Promise<PublishedSnapshot> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new Error('잘못된 게시 링크입니다.');
  const { data } = await get('/studio/publications/' + encodeURIComponent(token), undefined, noCache);
  validatePublication(data);
  const snapshot = data.snapshot;
  if (
    !snapshot ||
    typeof snapshot.title !== 'string' ||
    !Array.isArray(snapshot.blocks) ||
    snapshot.blocks.length > 6 ||
    !snapshot.blocks.every((block: any) => {
      if (block?.kind === 'SEGMENT_PIVOT') {
        studioKeys(block, ['id', 'title', 'description', 'kind', 'display', 'pivot']);
        if (
          typeof block.id !== 'string' ||
          typeof block.title !== 'string' ||
          typeof block.description !== 'string' ||
          !block.display ||
          Object.keys(block.display).length
        )
          return false;
        block.pivot = validateStudioPivotResult(block.pivot, true);
        return true;
      }
      return (
        typeof block.id === 'string' &&
        typeof block.title === 'string' &&
        ['BOARD_NUMERIC', 'CHART_LINE', 'CHART_BAR', 'CHART_COLUMN'].includes(block.kind) &&
        (block.display?.presentation === undefined ||
          block.display.presentation === 'visual' ||
          (block.display.presentation === 'summary' && block.kind === 'BOARD_NUMERIC') ||
          (block.display.presentation === 'table' && block.kind !== 'BOARD_NUMERIC')) &&
        typeof block.valueField === 'string' &&
        Array.isArray(block.datas) &&
        block.datas.every((row: any) => row && typeof row === 'object' && !Array.isArray(row))
      );
    })
  )
    throw new Error('게시된 데이터 형식을 확인하지 못했습니다.');
  let filters: StudioFilter[] = [];
  let dateRange: StudioDateRange | undefined;
  try {
    // Absent means the publisher had no common scope; a malformed list is never silently ignored.
    if (snapshot.conditionsApplied !== undefined && snapshot.conditionsApplied !== true)
      throw new Error('Invalid conditions flag');
    if (Object.prototype.hasOwnProperty.call(snapshot, 'conditions')) throw new Error('Raw conditions are private');
    filters = snapshot.filters === undefined ? [] : validateStudioFilters(snapshot.filters);
    dateRange = snapshot.dateRange === undefined ? undefined : validateStudioDateRange(snapshot.dateRange);
  } catch {
    throw new Error('게시된 공통 범위(필터·기간) 형식을 확인하지 못했습니다.');
  }
  return { ...data, snapshot: { ...snapshot, filters, ...(dateRange ? { dateRange } : {}) } };
}
export const publicationUrl = (token: string) => window.location.origin + '/published/' + encodeURIComponent(token);
export const publicationTime = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZoneName: 'short' });
