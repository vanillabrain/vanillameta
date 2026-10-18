import { readProfileColumns } from '../../Explore/conditionProfile';
import type { Column } from '../../Explore/SourceConditions';
// Studio server boundary. The /studio endpoints answer with the raw payload, not the legacy SUCCESS envelope.
import { get, post } from '@/helpers/apiHelper';
import { errorMessage, validDraft } from '../dashboardPreview';
import { StudioDefinitions } from './studioAdapter';
import {
  studioAssert,
  studioConditionsKey,
  studioKeys,
  studioFilterKey,
  studioDateRangeKey,
  studioFilterValueKey,
  studioPositive,
  studioText,
  validateStudioDocument,
} from './studioDocument';
import { isStudioId, STUDIO_FILTER_LIMITS, StudioDocumentV1, StudioFilter, StudioFilterValue } from './studioTypes';

/** One aggregated preview row. Rows arrive under `datas`; a row without `datas` is never rendered. */
export type StudioPreviewRow = {
  blockId?: string;
  type: string;
  title?: string;
  description?: string;
  sql: string;
  valueField: string;
  categoryField?: string;
  fields: unknown[];
  datas: unknown[];
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  numberNotation?: string;
  trend?: Record<string, any>;
  trendUnavailable?: string;
  previousTrend?: Record<string, any>;
  [key: string]: unknown;
};
/** Existing source-wide categorical choices. Unfiltered by design, so a saved scope stays visible. */
export type StudioFilterChoice = { column: string; values: StudioFilterValue[] };
export type StudioPreview = {
  draft: Record<string, any>;
  widgets: StudioPreviewRow[];
  dimensions?: StudioFilterChoice[];
  temporalColumns?: { column: string; min?: string | null; max?: string | null }[];
  [key: string]: unknown;
};
/** Load result for one dashboard: the editable document plus its definition catalog and preview. */
export type StudioLoadResult = {
  profileColumns?: Column[];
  access?: { read: boolean; edit: boolean; publish: boolean; export: boolean };
  owned?: boolean;
  dashboardId: number;
  /** Opaque data-source version from GET. Every save pins it; a change is reported as a conflict. */
  sourceRevision: string;
  document: StudioDocumentV1;
  definitions: StudioDefinitions;
  preview: StudioPreview | null;
  /** Server-reported preview failure. The document stays editable and no sample data replaces it. */
  previewError: string | null;
};
export type StudioSaveResult = { document: StudioDocumentV1; idMap: Record<string, string> };
/** Owner-only unsaved preview: the same body shape as save, answered with {document, preview}. */
export type StudioPrepareRequest = {
  expectedRevision?: string;
  expectedSourceRevision: string;
  document: StudioDocumentV1;
};
export type StudioPrepareResult = { document: StudioDocumentV1; preview: StudioPreview };
export type StudioSaveRequest = {
  requestId: string;
  expectedRevision?: string;
  /** Source version captured from GET for this exact request. A retry reuses it verbatim. */
  expectedSourceRevision: string;
  document: StudioDocumentV1;
};
export type StudioErrorKind = 'conflict' | 'notFound' | 'auth' | 'network' | 'server' | 'invalid';

export class StudioApiError extends Error {
  readonly kind: StudioErrorKind;
  readonly status: number | null;
  constructor(message: string, kind: StudioErrorKind, status: number | null = null) {
    super(message);
    this.name = 'StudioApiError';
    this.kind = kind;
    this.status = status;
  }
}

export const isStudioApiError = (value: unknown): value is StudioApiError =>
  value instanceof StudioApiError ||
  (!!value && typeof value === 'object' && (value as { name?: unknown }).name === 'StudioApiError');

const HTTP_ERRORS: Record<number, [StudioErrorKind, string]> = {
  400: ['server', '요청한 내용을 서버가 처리하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.'],
  401: ['auth', '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.'],
  403: ['auth', '이 대시보드를 편집할 권한이 없습니다.'],
  404: ['notFound', '대시보드를 찾을 수 없거나 접근할 수 없습니다.'],
  409: ['conflict', '다른 곳에서 먼저 저장되어 서버 내용이 달라졌습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.'],
};

/** Every failure becomes one user-facing sentence; an unknown state is never reported as saved. */
export const toStudioApiError = (error: unknown): StudioApiError => {
  if (isStudioApiError(error)) return error;
  const status = Number((error as { response?: { status?: unknown } })?.response?.status);
  // Axios sends null (or status 0) when the response never arrived: that is a network failure, not a server one.
  if (!Number.isSafeInteger(status) || status < 100) {
    return new StudioApiError(
      '서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 같은 요청으로 다시 시도해 주세요.',
      'network',
    );
  }
  const known = HTTP_ERRORS[status];
  if (known) return new StudioApiError(known[1], known[0], status);
  const message = errorMessage(error);
  return new StudioApiError(
    typeof message === 'string' && message.trim() ? message : '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    'server',
    status,
  );
};

const invalid = (error: unknown, fallback: string): StudioApiError =>
  isStudioApiError(error)
    ? error
    : new StudioApiError(error instanceof Error && error.message ? error.message : fallback, 'invalid');

const unwrap = (raw: unknown): unknown => {
  const envelope = raw as { status?: unknown; data?: unknown } | null;
  return envelope && typeof envelope === 'object' && envelope.status === 'SUCCESS' && envelope.data ? envelope.data : raw;
};

export const studioRequestId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  studioAssert(
    typeof uuid === 'string' && uuid.length > 0,
    '이 브라우저에서는 저장 요청 ID를 만들 수 없습니다. HTTPS 또는 localhost에서 다시 시도해 주세요.',
  );
  return uuid;
};

const previewRow = (row: unknown): StudioPreviewRow => {
  studioAssert(!!row && typeof row === 'object' && !Array.isArray(row), '미리보기 위젯 형식을 확인해 주세요.');
  const widget = row as StudioPreviewRow;
  studioAssert(typeof widget.type === 'string' && !!widget.type, '미리보기 위젯 종류를 확인해 주세요.');
  studioAssert(
    typeof widget.sql === 'string' && !!widget.sql && typeof widget.valueField === 'string' && !!widget.valueField,
    '미리보기 위젯 정의를 확인해 주세요.',
  );
  studioAssert(Array.isArray(widget.datas) && Array.isArray(widget.fields), '미리보기 위젯 데이터를 확인해 주세요.');
  if (widget.blockId !== undefined)
    studioAssert(typeof widget.blockId === 'string' && isStudioId(widget.blockId), '미리보기 블록 ID를 확인해 주세요.');
  return widget;
};

const filterValue = (value: unknown): value is StudioFilterValue =>
  value === null ||
  typeof value === 'boolean' ||
  (typeof value === 'string' && value.length <= STUDIO_FILTER_LIMITS.textLength) ||
  (typeof value === 'number' && Number.isFinite(value));
/** The choice list is advisory: an unusable option is dropped, never a reason to lose the preview. */
const previewChoice = (input: unknown): StudioFilterChoice => {
  studioAssert(!!input && typeof input === 'object' && !Array.isArray(input), '필터 선택지를 확인해 주세요.');
  const choice = input as StudioFilterChoice;
  studioText(choice.column, STUDIO_FILTER_LIMITS.columnLength);
  studioAssert(Array.isArray(choice.values), '필터 선택지를 확인해 주세요.');
  const seen = new Set<string>();
  const values: StudioFilterValue[] = [];
  for (const value of Array.from(choice.values)) {
    if (!filterValue(value) || values.length >= STUDIO_FILTER_LIMITS.values) continue;
    const key = studioFilterValueKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return { column: choice.column, values };
};
export const validateStudioPreview = (input: unknown): StudioPreview => {
  studioAssert(!!input && typeof input === 'object' && !Array.isArray(input), '미리보기 응답을 확인해 주세요.');
  const preview = input as StudioPreview;
  studioAssert(validDraft(preview.draft), '미리보기 정의를 확인해 주세요.');
  studioAssert(
    Array.isArray(preview.widgets) && preview.widgets.length === preview.draft.widgets.length,
    '미리보기 위젯 수가 정의와 다릅니다.',
  );
  preview.widgets = preview.widgets.map(previewRow);
  // Dimensions are optional: an older or unsupported source simply offers no categorical choices.
  if (preview.dimensions !== undefined) {
    studioAssert(
      Array.isArray(preview.dimensions) && preview.dimensions.length <= STUDIO_FILTER_LIMITS.columns,
      '필터 선택지를 확인해 주세요.',
    );
    const columns = new Set<string>();
    preview.dimensions = preview.dimensions.map(choice => {
      const parsed = previewChoice(choice);
      studioAssert(!columns.has(parsed.column), '필터 선택지 열이 중복됩니다.');
      columns.add(parsed.column);
      return parsed;
    });
  }
  if (preview.temporalColumns !== undefined) {
    studioAssert(
      Array.isArray(preview.temporalColumns) && preview.temporalColumns.length <= 5,
      '날짜 열 선택지를 확인해 주세요.',
    );
    const names = new Set<string>();
    for (const column of preview.temporalColumns) {
      studioAssert(
        !!column &&
          typeof column.column === 'string' &&
          !!column.column.trim() &&
          column.column.length <= 128 &&
          !names.has(column.column),
        '날짜 열 선택지를 확인해 주세요.',
      );
      names.add(column.column);
    }
  }
  return preview;
};

export const validateStudioDefinitions = (input: unknown): StudioDefinitions => {
  studioAssert(!!input && typeof input === 'object' && !Array.isArray(input), '정의 카탈로그를 확인해 주세요.');
  const definitions = input as StudioDefinitions;
  studioPositive(definitions.dashboardId);
  studioPositive(definitions.sourceId);
  studioAssert(
    typeof definitions.revision === 'string' && /^[a-f0-9]{64}$/.test(definitions.revision),
    '정의 revision을 확인해 주세요.',
  );
  studioAssert(
    typeof definitions.explanation === 'string' && definitions.explanation.length <= 4000,
    '정의 설명을 확인해 주세요.',
  );
  studioAssert(
    !!definitions.entries && typeof definitions.entries === 'object' && !Array.isArray(definitions.entries),
    '정의 항목을 확인해 주세요.',
  );
  for (const [key, rawEntry] of Object.entries(definitions.entries)) {
    studioText(key, 128);
    if (rawEntry.metricBasis !== undefined) {
      const basis = rawEntry.metricBasis;
      studioKeys(basis, ['sourceId', 'metricId', 'definitionVersion', 'definition']);
      studioPositive(basis.metricId);
      studioAssert(
        basis.sourceId === definitions.sourceId &&
          typeof basis.definitionVersion === 'string' &&
          /^[1-9][0-9]*$/.test(basis.definitionVersion) &&
          basis.definitionVersion.length <= 128,
        '저장 지표 기준을 확인해 주세요.',
      );
      studioKeys(basis.definition, ['aggregation', 'column', 'denominatorColumn', 'weightColumn', 'scale', 'unit']);
      for (const [field, value] of Object.entries(basis.definition))
        studioAssert(
          field === 'scale' ? typeof value === 'number' && Number.isFinite(value) : typeof value === 'string',
          '저장 지표 기준 필드가 올바르지 않습니다.',
        );
    }
    const widget = (rawEntry as { widget?: Record<string, any> } | undefined)?.widget;
    studioAssert(!!widget && typeof widget === 'object', '정의 위젯을 확인해 주세요.');
    studioAssert(
      typeof widget?.type === 'string' && typeof widget?.sql === 'string' && typeof widget?.valueField === 'string',
      '정의 위젯 내용을 확인해 주세요.',
    );
  }
  return definitions;
};

/** The exact preview body. It mirrors the save body so the server resolves the same scope. */
export const studioPrepareBody = (request: StudioPrepareRequest) => ({
  ...(request.expectedRevision ? { expectedRevision: request.expectedRevision } : {}),
  expectedSourceRevision: request.expectedSourceRevision,
  document: validateStudioDocument(request.document),
});

/**
 * POST /studio/dashboards/:id/preview -> {document, preview}. The caller aborts a superseded request,
 * and an answer is accepted only for the request's own filter scope.
 */
export async function prepareStudioDashboard(
  dashboardId: number,
  request: StudioPrepareRequest,
  config: Record<string, unknown> = {},
): Promise<StudioPrepareResult> {
  studioPositive(dashboardId);
  if (request.expectedRevision !== undefined)
    studioAssert(/^[a-f0-9]{64}$/.test(request.expectedRevision), '미리보기 기준 revision을 확인해 주세요.');
  studioAssert(
    typeof request.expectedSourceRevision === 'string' && /^[a-f0-9]{64}$/.test(request.expectedSourceRevision),
    '데이터 소스 버전을 확인해 주세요.',
  );
  const requested: StudioFilter[] = request.document.filters ?? [];
  const body = studioPrepareBody(request);
  let payload: any;
  try {
    const response = await post('/studio/dashboards/' + dashboardId + '/preview', body, {
      timeout: 180000,
      ...config,
    });
    payload = unwrap(response?.data);
  } catch (error) {
    throw toStudioApiError(error);
  }
  try {
    studioAssert(!!payload && typeof payload === 'object' && !Array.isArray(payload), '미리보기 응답을 확인해 주세요.');
    const document = validateStudioDocument(payload.document);
    studioAssert(
      document.dashboardId === dashboardId &&
        studioFilterKey(document.filters) === studioFilterKey(requested) &&
        studioDateRangeKey(document.dateRange) === studioDateRangeKey(request.document.dateRange) &&
        studioConditionsKey(document.conditions) === studioConditionsKey(request.document.conditions),
      '요청한 날짜 범위·공통 필터와 다른 미리보기 결과입니다.',
    );
    return { document, preview: validateStudioPreview(payload.preview) };
  } catch (error) {
    throw invalid(error, '미리보기 응답을 확인하지 못했습니다.');
  }
}

/** GET /studio/dashboards/:id -> {document, definitions, preview, previewError}: the raw payload. */
export async function fetchStudioDashboard(
  dashboardId: number,
  config: Record<string, unknown> = {},
): Promise<StudioLoadResult> {
  studioPositive(dashboardId);
  let payload: any;
  try {
    const response = await get('/studio/dashboards/' + dashboardId, undefined, { timeout: 180000, ...config });
    payload = unwrap(response?.data);
  } catch (error) {
    throw toStudioApiError(error);
  }
  try {
    studioAssert(!!payload && typeof payload === 'object' && !Array.isArray(payload), 'Studio 응답을 확인해 주세요.');
    const document = validateStudioDocument(payload.document);
    const definitions = validateStudioDefinitions(payload.definitions);
    studioAssert(
      document.dashboardId === dashboardId && definitions.dashboardId === dashboardId,
      '요청한 대시보드와 다른 문서입니다.',
    );
    studioAssert(document.sourceId === definitions.sourceId, '문서와 정의의 데이터 소스가 다릅니다.');
    studioAssert(
      typeof payload.sourceRevision === 'string' && /^[a-f0-9]{64}$/.test(payload.sourceRevision),
      '데이터 소스 버전을 확인해 주세요.',
    );
    if (payload.previewError !== undefined && payload.previewError !== null)
      studioAssert(typeof payload.previewError === 'string', '미리보기 오류 형식을 확인해 주세요.');
    let preview: StudioPreview | null = null;
    let previewError: string | null =
      typeof payload.previewError === 'string' && payload.previewError.trim() ? payload.previewError : null;
    if (payload.preview !== undefined && payload.preview !== null) {
      try {
        preview = validateStudioPreview(payload.preview);
      } catch (error) {
        preview = null;
        previewError = previewError || (error instanceof Error ? error.message : '미리보기를 확인하지 못했습니다.');
      }
    }
    if (!preview && !previewError) previewError = '미리보기 결과를 받지 못했습니다. 편집과 저장은 계속할 수 있습니다.';
    if (payload.access !== undefined) {
      studioAssert(
        payload.access &&
          typeof payload.access === 'object' &&
          ['read', 'edit', 'publish', 'export'].every(key => typeof payload.access[key] === 'boolean') &&
          payload.access.read === true,
        '자원 권한 응답을 확인해 주세요.',
      );
    }
    if (payload.owned !== undefined) studioAssert(typeof payload.owned === 'boolean', '소유권 응답을 확인해 주세요.');
    let profileColumns: Column[] = [];
    try {
      if (payload.profileColumns !== undefined) profileColumns = readProfileColumns(payload.profileColumns);
    } catch {
      /* Advisory profile choices never replace the authorized document. */
    }
    return {
      profileColumns,
      dashboardId,
      sourceRevision: payload.sourceRevision,
      document,
      definitions,
      preview,
      previewError,
      ...(payload.access !== undefined ? { access: payload.access } : {}),
      ...(payload.owned !== undefined ? { owned: payload.owned } : {}),
    };
  } catch (error) {
    throw invalid(error, 'Studio 문서를 확인하지 못했습니다.');
  }
}

/** The exact save body. A retry reuses it verbatim so a repeated requestId returns the same result. */
export const studioSaveBody = (request: StudioSaveRequest) => ({
  requestId: request.requestId,
  ...(request.expectedRevision ? { expectedRevision: request.expectedRevision } : {}),
  expectedSourceRevision: request.expectedSourceRevision,
  document: validateStudioDocument(request.document),
});

/** POST /studio/dashboards/:id/save -> {document, idMap}. A 409 is terminal for that requestId. */
export async function saveStudioDashboard(
  dashboardId: number,
  request: StudioSaveRequest,
  config: Record<string, unknown> = {},
): Promise<StudioSaveResult> {
  studioPositive(dashboardId);
  studioText(request.requestId, 128);
  if (request.expectedRevision !== undefined)
    studioAssert(/^[a-f0-9]{64}$/.test(request.expectedRevision), '저장 기준 revision을 확인해 주세요.');
  studioAssert(
    typeof request.expectedSourceRevision === 'string' && /^[a-f0-9]{64}$/.test(request.expectedSourceRevision),
    '데이터 소스 버전을 확인해 주세요.',
  );
  const body = studioSaveBody(request);
  let payload: any;
  try {
    const response = await post('/studio/dashboards/' + dashboardId + '/save', body, { timeout: 180000, ...config });
    payload = unwrap(response?.data);
  } catch (error) {
    throw toStudioApiError(error);
  }
  try {
    studioAssert(!!payload && typeof payload === 'object' && !Array.isArray(payload), '저장 응답을 확인해 주세요.');
    const document = validateStudioDocument(payload.document);
    studioAssert(document.dashboardId === dashboardId, '저장된 문서가 요청한 대시보드와 다릅니다.');
    studioAssert(
      studioConditionsKey(document.conditions) === studioConditionsKey(request.document.conditions),
      '저장 응답의 포함·제외 조건이 요청과 다릅니다.',
    );
    studioAssert(
      typeof document.revision === 'string' && /^[a-f0-9]{64}$/.test(document.revision),
      '저장 응답의 revision을 확인해 주세요.',
    );
    studioAssert(
      !!payload.idMap && typeof payload.idMap === 'object' && !Array.isArray(payload.idMap),
      '저장 응답의 ID 변환을 확인해 주세요.',
    );
    for (const [from, to] of Object.entries(payload.idMap as Record<string, unknown>)) {
      studioAssert(
        isStudioId(from) && typeof to === 'string' && !!to && !to.startsWith('new:'),
        '저장 응답의 ID 변환을 확인해 주세요.',
      );
    }
    return { document, idMap: payload.idMap as Record<string, string> };
  } catch (error) {
    throw invalid(error, '저장 응답을 확인하지 못했습니다.');
  }
}
