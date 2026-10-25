import { validReceivedReference, validReceivedRemixInput } from './receivedRemixPendingStorage';
import { BusinessBasis, assertOptionalBusinessBasis } from '@/api/businessBasis';
import type { Node } from '../../Explore/SourceConditions';
import { get, post } from '@/helpers/apiHelper';
import {
  studioAssert,
  validateStudioConditions,
  validateStudioDateRange,
  validateStudioDocument,
  validateStudioFilters,
} from './studioDocument';
import { SourceProfile } from './studioCreation';
import { uploadQuotaMessage } from './studioUploadQuota';
import { PublishedBlock } from './studioPublication';
import {
  STUDIO_DATE_LIMITS,
  STUDIO_FILTER_LIMITS,
  StudioConditions,
  StudioDateRange,
  StudioDocumentV1,
  StudioFilter,
} from './studioTypes';
/** A single date column name reported by the remix contract. */
const remixDateColumn = (input: unknown, message: string): string => {
  studioAssert(typeof input === 'string' && !!input.trim() && input.length <= STUDIO_DATE_LIMITS.columnLength, message);
  return input;
};
/** Remix scope uses the same strict filter protocol as Studio: a value list is never relaxed. */
const remixFilters = (input: unknown, message: string): StudioFilter[] => {
  studioAssert(Array.isArray(input) && input.length <= STUDIO_FILTER_LIMITS.columns, message);
  return validateStudioFilters(input);
};
/** Columns the target source cannot apply. Reported as names; the saved column is never dropped. */
const remixColumns = (input: unknown, message: string): string[] => {
  studioAssert(Array.isArray(input) && input.length <= STUDIO_FILTER_LIMITS.columns, message);
  const columns = Array.from(input as unknown[]).map(column => {
    studioAssert(
      typeof column === 'string' && !!column.trim() && column.length <= STUDIO_FILTER_LIMITS.columnLength,
      message,
    );
    return column as string;
  });
  studioAssert(new Set(columns).size === columns.length, message);
  return columns;
};
const conditionFields = (conditions?: StudioConditions): string[] => {
  const names = new Set<string>();
  const visit = (node: Node | null) => {
    if (!node) return;
    if (node.kind === 'group') node.children.forEach(visit);
    else names.add(node.column);
  };
  if (conditions) {
    visit(conditions.definition.include);
    visit(conditions.definition.exclude);
  }
  return Array.from(names);
};
export type RemixBlock = { id: string; title: string; kind: string; supported: boolean; reason?: string };
export type RemixRequirements = {
  businessBasis?: BusinessBasis | null;
  lifecycleRevision: string;
  conditions?: StudioConditions;
  token: string;
  version: number;
  title: string;
  requiredFields: { name: string; type: string; blockIds: string[] }[];
  blocks: RemixBlock[];
  /** Publisher's saved common scope, shown read-only before the mapping step. */
  filters?: StudioFilter[];
  /** Publisher's saved period, read-only before the mapping step. */
  dateRange?: StudioDateRange;
};
export type RemixField = {
  sourceColumn: string;
  sourceType: string;
  targetColumn?: string;
  status: 'mapped' | 'missing' | 'incompatible' | 'ambiguous';
  candidates: string[];
};
export type RemixInput = {
  expectedLifecycleRevision: string;
  targetSourceId: number;
  mapping: Record<string, string>;
  excludedBlockIds: string[];
  expectedVersion: number;
};
export type RemixSaveInput = RemixInput & { requestId: string; expectedSourceRevision: string };
export type RemixPreview = RemixRequirements & {
  mappedBusinessBasis?: BusinessBasis | null;
  targetSourceId: number;
  sourceRevision: string;
  profile: SourceProfile;
  mapping: Record<string, string>;
  fields: RemixField[];
  unmappedBlocks: { blockId: string; title: string; reason: string; missingFields: string[] }[];
  /** Scope actually applied to this preview, and the saved columns the target source cannot apply. */
  mappedFilters?: StudioFilter[];
  unmappedFilters?: string[];
  /** Period applied to this preview, and the saved period column the target cannot apply. */
  mappedConditions?: StudioConditions;
  unmappedConditions: string[];
  mappedDateRange?: StudioDateRange;
  unmappedDateRange?: string;
  preview?: { widgets: any[] };
};
const config = { timeout: 180000, headers: { 'Cache-Control': 'no-cache' } };
/** Thrown locally for a malformed link, before any request; it has no HTTP status to map. */
export const REMIX_LINK_MESSAGE = '복제 링크를 확인해 주세요.';
const tokenPath = (token: string) => {
  if (/^(?:d-(?:[1-9][0-9]*-){4}|g-(?:[1-9][0-9]*-){6})[a-f0-9]{64}$/.test(token))
    return '/studio/received/' + encodeURIComponent(token);
  studioAssert(/^[a-f0-9]{64}$/.test(token), REMIX_LINK_MESSAGE);
  return '/studio/publications/' + encodeURIComponent(token);
};
export function validateRemixRequirements(input: any, token: string): RemixRequirements {
  studioAssert(
    !!input &&
      input.token === token &&
      typeof input.lifecycleRevision === 'string' &&
      /^[a-f0-9]{64}$/.test(input.lifecycleRevision) &&
      Number.isSafeInteger(input.version) &&
      input.version > 0 &&
      typeof input.title === 'string' &&
      input.title.length <= 300,
    '게시된 복제 정의를 확인하지 못했습니다.',
  );
  studioAssert(
    Array.isArray(input.blocks) &&
      input.blocks.length > 0 &&
      input.blocks.length <= 6 &&
      input.blocks.every(
        (b: any) =>
          typeof b.id === 'string' && b.id.length <= 128 && typeof b.title === 'string' && typeof b.supported === 'boolean',
      ),
    '복제할 블록을 확인해 주세요.',
  );
  const ids = new Set(input.blocks.map((b: any) => b.id));
  studioAssert(
    Array.isArray(input.requiredFields) &&
      input.requiredFields.length <= 128 &&
      input.requiredFields.every(
        (f: any) =>
          typeof f.name === 'string' &&
          !!f.name &&
          f.name.length <= 256 &&
          typeof f.type === 'string' &&
          Array.isArray(f.blockIds) &&
          f.blockIds.every((id: string) => ids.has(id)),
      ),
    '필수 열 정의를 확인해 주세요.',
  );
  studioAssert(
    !input.blocks?.some((b: any) => b.kind === 'SEGMENT_PIVOT'),
    '집계 Pivot은 같은 데이터의 Studio 저장본 복제만 지원합니다. 원본은 유지됩니다.',
  );
  assertOptionalBusinessBasis(input);
  if (input.filters !== undefined) input.filters = remixFilters(input.filters, '게시본의 공통 필터를 확인하지 못했습니다.');
  if (input.dateRange !== undefined) input.dateRange = validateStudioDateRange(input.dateRange);
  if (input.conditions !== undefined) {
    input.conditions = validateStudioConditions(input.conditions);
    studioAssert(
      conditionFields(input.conditions).every(name =>
        input.requiredFields.some(
          (f: any) =>
            f.name === name && input.blocks.filter((b: any) => b.supported).every((b: any) => f.blockIds.includes(b.id)),
        ),
      ),
      '포함·제외 조건의 필수 연결 열이 누락됐습니다.',
    );
  }
  return input;
}
export function validateRemixPreview(input: any, token: string, request: RemixInput): RemixPreview {
  assertOptionalBusinessBasis(input);
  assertOptionalBusinessBasis(
    input.mappedBusinessBasis === undefined ? undefined : { businessBasis: input.mappedBusinessBasis },
  );
  validateRemixRequirements(input, token);
  studioAssert(
    input.lifecycleRevision === request.expectedLifecycleRevision &&
      input.version === request.expectedVersion &&
      input.targetSourceId === request.targetSourceId &&
      /^[a-f0-9]{64}$/.test(input.sourceRevision ?? '') &&
      input.profile?.sourceId === request.targetSourceId &&
      Array.isArray(input.profile.columns),
    '데이터 또는 게시 버전이 변경되었습니다. 새로 확인해 주세요.',
  );
  studioAssert(
    !!input.mapping &&
      typeof input.mapping === 'object' &&
      !Array.isArray(input.mapping) &&
      Object.values(input.mapping).every(v => typeof v === 'string') &&
      Array.isArray(input.fields) &&
      Array.isArray(input.unmappedBlocks),
    '열 연결 결과를 확인하지 못했습니다.',
  );
  studioAssert(
    input.fields.every(
      (f: any) =>
        typeof f.sourceColumn === 'string' &&
        ['mapped', 'missing', 'incompatible', 'ambiguous'].includes(f.status) &&
        Array.isArray(f.candidates) &&
        f.candidates.every((c: any) => typeof c === 'string'),
    ),
    '열 연결 상태를 확인해 주세요.',
  );
  studioAssert(
    input.unmappedBlocks.every(
      (b: any) =>
        typeof b.blockId === 'string' &&
        typeof b.title === 'string' &&
        typeof b.reason === 'string' &&
        Array.isArray(b.missingFields),
    ),
    '미연결 블록 상태를 확인해 주세요.',
  );
  studioAssert(
    conditionFields(input.conditions).every(name => input.fields.some((f: any) => f.sourceColumn === name)),
    '포함·제외 조건의 열 연결 상태가 누락됐습니다.',
  );
  if (input.mappedConditions !== undefined) input.mappedConditions = validateStudioConditions(input.mappedConditions);
  if (input.unmappedConditions === undefined && input.conditions === undefined && input.mappedConditions === undefined)
    input.unmappedConditions = [];
  if (input.conditions !== undefined || input.mappedConditions !== undefined)
    studioAssert(Array.isArray(input.unmappedConditions), '조건 연결 결과가 누락됐습니다.');
  if (input.unmappedConditions !== undefined) {
    studioAssert(
      Array.isArray(input.unmappedConditions) &&
        input.unmappedConditions.length <= 32 &&
        input.unmappedConditions.every((c: unknown) => typeof c === 'string' && !!c && !c.includes('\0')) &&
        new Set(input.unmappedConditions).size === input.unmappedConditions.length,
      '적용하지 못한 조건 열을 확인하지 못했습니다.',
    );
  }
  studioAssert(
    !input.conditions || input.mappedConditions || input.unmappedConditions?.length,
    '조건 연결 결과가 누락됐습니다.',
  );
  if (input.mappedFilters !== undefined)
    input.mappedFilters = remixFilters(input.mappedFilters, '적용된 공통 필터를 확인하지 못했습니다.');
  if (input.unmappedFilters !== undefined)
    input.unmappedFilters = remixColumns(input.unmappedFilters, '적용하지 못한 공통 필터를 확인하지 못했습니다.');
  if (input.mappedDateRange !== undefined) input.mappedDateRange = validateStudioDateRange(input.mappedDateRange);
  if (input.unmappedDateRange !== undefined)
    input.unmappedDateRange = remixDateColumn(input.unmappedDateRange, '적용하지 못한 기간 열을 확인하지 못했습니다.');
  if (input.preview)
    studioAssert(
      Array.isArray(input.preview.widgets) &&
        input.preview.widgets.every(
          (w: any) =>
            typeof w.type === 'string' &&
            typeof w.valueField === 'string' &&
            Array.isArray(w.fields) &&
            Array.isArray(w.datas),
        ),
      '복제 미리보기 데이터를 확인하지 못했습니다.',
    );
  return input;
}
export const canCreateRemix = (p: RemixPreview | null, excluded: string[]) =>
  !!p &&
  p.unmappedBlocks.length === 0 &&
  // A saved period the target source cannot apply is refused here as well; the server blocks it too.
  !p.unmappedDateRange &&
  !p.unmappedConditions?.length &&
  (!p.conditions || !!p.mappedConditions) &&
  p.blocks.every(b => b.supported || excluded.includes(b.id)) &&
  p.blocks.some(b => b.supported && !excluded.includes(b.id)) &&
  !!p.preview?.widgets.length;
export function remixPreviewBlocks(p: RemixPreview): PublishedBlock[] {
  const retained = p.blocks;
  return (p.preview?.widgets ?? []).map((w: any, index: number) => ({
    id: w.blockId ?? retained[index]?.id ?? String(index),
    title: w.title ?? retained[index]?.title ?? '집계 결과',
    description: w.description ?? '',
    kind: w.type,
    valueField: w.valueField,
    categoryField: w.categoryField,
    fields: w.fields,
    datas: w.datas,
    display: {
      decimalPlaces: w.decimalPlaces ?? 2,
      numberNotation: w.numberNotation === 'compact' ? 'compact' : 'full',
      prefix: w.prefix ?? '',
      suffix: w.suffix ?? '',
    },
    ...(w.trend ? { trend: w.trend } : {}),
  }));
}
export async function fetchRemixRequirements(token: string): Promise<RemixRequirements> {
  const { data } = await get(tokenPath(token) + '/remix-template', undefined, config);
  return validateRemixRequirements(data, token);
}
export async function previewRemix(token: string, request: RemixInput, signal?: AbortSignal): Promise<RemixPreview> {
  const { data } = await post(tokenPath(token) + '/remix-preview', request, { ...config, signal });
  return validateRemixPreview(data, token, request);
}
export async function saveRemix(
  token: string,
  request: RemixSaveInput,
): Promise<{ dashboardId: number; document: StudioDocumentV1 }> {
  const { data } = await post(tokenPath(token) + '/remix', request, config);
  const document = validateStudioDocument(data?.document);
  studioAssert(
    Number.isSafeInteger(data.dashboardId) &&
      data.dashboardId > 0 &&
      document.dashboardId === data.dashboardId &&
      document.sourceId === request.targetSourceId &&
      !!document.revision,
    '복제 저장 결과를 확인하지 못했습니다.',
  );
  return { dashboardId: data.dashboardId, document };
}
export function remixError(error: any, received = false): string {
  const status = error?.response?.status;
  const quota = uploadQuotaMessage(error);
  if (quota) return quota;
  if (received && status === 403) return '복제 허용이 중지됐거나 받은 분석·대상 데이터에 접근할 권한이 없습니다.';
  if (received && status === 409)
    return '공유 원본이나 복제 허용 버전이 변경되었습니다. 원본을 새로 확인하고 매핑을 검토해 주세요.';
  if (received && (status === 404 || status === 410))
    return '복제할 받은 분석을 확인할 수 없습니다. 받은 자료에서 다시 시작해 주세요.';
  if (status === 401) return '로그인이 필요합니다. 로그인한 뒤 이 화면에서 다시 확인해 주세요.';
  if (status === 403) return '복제가 허용되지 않았거나 게시본·대상 데이터에 접근할 권한이 없습니다.';
  if (status === 410) return '게시가 중지되었거나 만료되었습니다. 새 링크를 요청해 주세요.';
  if (status === 404) return '복제할 게시본을 찾을 수 없습니다.';
  if (status === 409) return '게시 버전이나 대상 데이터가 변경되었습니다. 정의를 새로 확인하고 매핑을 검토해 주세요.';
  if (status === 400)
    return '복제 정의와 필수 열·형식을 확인해 주세요. 다른 소스를 선택하거나 해당 블록을 명시적으로 제외할 수 있습니다.';
  if (!status && error?.message === REMIX_LINK_MESSAGE) return REMIX_LINK_MESSAGE;
  return '연결 또는 복제 상태를 확인하지 못했습니다. 입력을 유지했으니 다시 시도해 주세요.';
}
/**
 * What the error screen may offer after a failed remix request. A retry cannot succeed for a refusal (403,
 * unless a quota message names a fix), or for a link or copy that is gone (404, 410). `gone` also hides the
 * link back to the publication, which no longer exists.
 */
export function remixFailure(error: any, received = false): { message: string; retry: boolean; gone: boolean } {
  const status = error?.response?.status;
  // A malformed link never reaches the server, so a retry with the same link cannot change it.
  const linkRefused = !status && error?.message === REMIX_LINK_MESSAGE;
  return {
    message: remixError(error, received),
    retry: !!uploadQuotaMessage(error) || (!linkRefused && ![403, 404, 410].includes(status)),
    gone: status === 404 || status === 410,
  };
}

export type ReceivedRemixResult =
  | { found: false }
  | { found: true; dashboardId: number; sourceId: number; revision: string };
/** Read-only receipt lookup. Never resolves the original sharing reference or creates a copy. */
export async function lookupReceivedRemixResult(
  reference: string,
  request: RemixSaveInput,
  signal?: AbortSignal,
): Promise<ReceivedRemixResult> {
  studioAssert(validReceivedReference(reference) && validReceivedRemixInput(request), '보존한 복제 요청을 확인해 주세요.');
  const { data } = await post('/studio/received/' + encodeURIComponent(reference) + '/remix-result', request, {
    ...config,
    signal,
  });
  studioAssert(!!data && typeof data === 'object' && !Array.isArray(data), '복제 결과 조회 응답을 확인하지 못했습니다.');
  const keys = data.found === false ? ['found'] : ['found', 'dashboardId', 'sourceId', 'revision'];
  studioAssert(
    Object.keys(data).length === keys.length &&
      keys.every(k => Object.prototype.hasOwnProperty.call(data, k)) &&
      (data.found === false ||
        (data.found === true &&
          Number.isSafeInteger(data.dashboardId) &&
          data.dashboardId > 0 &&
          data.dashboardId !== Number(reference.split('-')[3]) &&
          data.sourceId === request.targetSourceId &&
          typeof data.revision === 'string' &&
          /^[a-f0-9]{64}$/.test(data.revision))),
    '복제 결과 조회 응답을 확인하지 못했습니다.',
  );
  return data;
}
