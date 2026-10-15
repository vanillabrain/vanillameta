import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchStudioDashboard,
  isStudioApiError,
  prepareStudioDashboard,
  saveStudioDashboard,
  studioSaveBody,
  StudioSaveRequest,
  toStudioApiError,
  validateStudioPreview,
} from './studioApi';
import { StudioDefinitions } from './studioAdapter';
import { StudioBlock, StudioDocumentV1 } from './studioTypes';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));

const DOC_REVISION = 'a'.repeat(64);
const SOURCE_REVISION = 'b'.repeat(64);
const NEXT_REVISION = 'c'.repeat(64);

const block: StudioBlock = {
  id: 'b1',
  kind: 'BOARD_NUMERIC',
  definitionKey: 'b1',
  title: '총매출',
  description: '원본 데이터 집계',
  measureRefs: [],
  dimensionRefs: [],
  display: { decimalPlaces: 0 },
};
const document: StudioDocumentV1 = {
  schemaVersion: 1 as const,
  dashboardId: 3,
  revision: DOC_REVISION,
  title: '매출 대시보드',
  sourceId: 4,
  blocks: [block],
  layouts: {
    lg: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
    md: [{ id: 'b1', x: 0, y: 0, w: 4, h: 2 }],
    xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 2 }],
  },
};
const definitions: StudioDefinitions = {
  dashboardId: 3,
  sourceId: 4,
  revision: DOC_REVISION,
  explanation: '매출 요약',
  entries: {
    b1: { widget: { title: '총매출', description: '', type: 'BOARD_NUMERIC', sql: 'SELECT 1', valueField: 'total' } },
  },
};
const widgetRow = {
  blockId: 'b1',
  type: 'BOARD_NUMERIC',
  title: '총매출',
  sql: 'SELECT 1',
  valueField: 'total',
  fields: ['total'],
  datas: [{ total: 500 }],
};
const envelope = (preview: any, previewError?: string) => ({
  data: { document, definitions, preview, ...(previewError ? { previewError } : {}), sourceRevision: SOURCE_REVISION },
});

beforeEach(() => vi.clearAllMocks());

describe('studio load boundary', () => {
  it('reads the raw envelope and keeps the aggregated preview rows under datas', async () => {
    api.get.mockResolvedValue(
      envelope({ draft: { databaseId: 4, title: '매출', explanation: '', widgets: [widgetRow] }, widgets: [widgetRow] }),
    );
    const loaded = await fetchStudioDashboard(3);
    expect(api.get.mock.calls[0][0]).toBe('/studio/dashboards/3');
    expect(loaded.sourceRevision).toBe(SOURCE_REVISION);
    expect(loaded.document.blocks[0].id).toBe('b1');
    expect(loaded.preview?.widgets[0].datas).toEqual([{ total: 500 }]);
    expect(loaded.previewError).toBeNull();
  });

  it('keeps the editable document and the server message when the preview fails', async () => {
    api.get.mockResolvedValue(envelope(null, '미리보기 조회에 실패했습니다.'));
    const loaded = await fetchStudioDashboard(3);
    expect(loaded.preview).toBeNull();
    expect(loaded.previewError).toBe('미리보기 조회에 실패했습니다.');
    expect(loaded.document.blocks).toHaveLength(1);
  });

  it('never treats a data keyed row as preview data', async () => {
    const wrongKey = { ...widgetRow, datas: undefined, data: [{ total: 500 }] };
    api.get.mockResolvedValue(
      envelope({ draft: { databaseId: 4, title: '매출', explanation: '', widgets: [wrongKey] }, widgets: [wrongKey] }),
    );
    const loaded = await fetchStudioDashboard(3);
    expect(loaded.preview).toBeNull();
    expect(loaded.previewError).toBeTruthy();
  });

  it('reports a missing source version as an invalid response', async () => {
    api.get.mockResolvedValue({ data: { document, definitions, preview: null } });
    await expect(fetchStudioDashboard(3)).rejects.toSatisfy(
      (error: unknown) => isStudioApiError(error) && error.kind === 'invalid',
    );
  });

  it('turns transport and status failures into user facing errors', () => {
    expect(toStudioApiError({ response: { status: 409 } }).kind).toBe('conflict');
    expect(toStudioApiError({ response: { status: 403 } }).kind).toBe('auth');
    expect(toStudioApiError(new Error('Network Error')).kind).toBe('network');
    expect(toStudioApiError({ response: null, message: 'Network Error' }).kind).toBe('network');
    expect(toStudioApiError({ response: { status: 0 }, message: 'Network Error' }).kind).toBe('network');
    expect(toStudioApiError({ response: null, message: 'Network Error' }).message).toMatch(/네트워크/);
    expect(toStudioApiError({ response: { status: 500, data: { message: '저장 중 오류' } } }).message).toBe('저장 중 오류');
  });
});

describe('studio save boundary', () => {
  const request: StudioSaveRequest = {
    requestId: '11111111-1111-4111-8111-111111111111',
    expectedRevision: DOC_REVISION,
    expectedSourceRevision: SOURCE_REVISION,
    document,
  };

  it('pins both revisions in the body and returns the server id map', async () => {
    api.post.mockResolvedValue({
      data: { document: { ...document, revision: NEXT_REVISION }, idMap: {} },
    });
    const saved = await saveStudioDashboard(3, request);
    expect(api.post.mock.calls[0][0]).toBe('/studio/dashboards/3/save');
    expect(api.post.mock.calls[0][1]).toEqual({
      requestId: request.requestId,
      expectedRevision: DOC_REVISION,
      expectedSourceRevision: SOURCE_REVISION,
      document,
    });
    expect(saved.document.revision).toBe(NEXT_REVISION);
    expect(saved.idMap).toEqual({});
  });

  it('builds the identical body for a retry of the same request', () => {
    expect(JSON.stringify(studioSaveBody(request))).toBe(JSON.stringify(studioSaveBody(request)));
    expect(studioSaveBody(request).expectedSourceRevision).toBe(SOURCE_REVISION);
  });

  it('reports a source or revision mismatch as a conflict', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { message: 'revision mismatch' } } });
    await expect(saveStudioDashboard(3, request)).rejects.toSatisfy(
      (error: unknown) => isStudioApiError(error) && error.kind === 'conflict',
    );
  });

  it('rejects a save response without a usable revision', async () => {
    const stale = { ...document } as Record<string, unknown>;
    delete stale.revision;
    api.post.mockResolvedValue({ data: { document: stale, idMap: {} } });
    await expect(saveStudioDashboard(3, { ...request, expectedRevision: undefined })).rejects.toSatisfy(
      (error: unknown) => isStudioApiError(error) && error.kind === 'invalid',
    );
  });
});

describe('studio common filter preview', () => {
  const scope = [{ column: 'device_type', values: ['Mobile/Tablet', 1, true, null] }];
  const previewPayload = (over: Record<string, unknown> = {}) => ({
    draft: { databaseId: 4, title: '매출', explanation: '', widgets: [{ ...widgetRow, blockId: undefined }] },
    widgets: [widgetRow],
    ...over,
  });
  it('posts the exact preview body and returns the validated document with the preview', async () => {
    api.post.mockResolvedValue({ data: { document: { ...document, filters: scope }, preview: previewPayload() } });
    const prepared = await prepareStudioDashboard(3, {
      expectedRevision: DOC_REVISION,
      expectedSourceRevision: SOURCE_REVISION,
      document: { ...document, filters: scope },
    });
    expect(api.post.mock.calls[0][0]).toBe('/studio/dashboards/3/preview');
    expect(api.post.mock.calls[0][1]).toEqual({
      expectedRevision: DOC_REVISION,
      expectedSourceRevision: SOURCE_REVISION,
      document: { ...document, filters: scope },
    });
    expect(prepared.document.filters).toEqual(scope);
    expect(prepared.preview.widgets[0].datas).toEqual([{ total: 500 }]);
  });
  it('refuses to label rows from another scope as the requested one', async () => {
    api.post.mockResolvedValue({ data: { document, preview: previewPayload() } });
    await expect(
      prepareStudioDashboard(3, { expectedSourceRevision: SOURCE_REVISION, document: { ...document, filters: scope } }),
    ).rejects.toThrow(/다른 미리보기/);
  });
  it('keeps existing categorical choices usable and ignores only unusable option values', () => {
    const preview = validateStudioPreview(
      previewPayload({
        dimensions: [
          { column: 'device_type', values: ['Mobile/Tablet', 1, '1', true, null, { nested: 1 }] },
          { column: 'empty_ok', values: [{ nested: 1 }] },
        ],
      }),
    );
    expect(preview.dimensions).toEqual([
      { column: 'device_type', values: ['Mobile/Tablet', 1, '1', true, null] },
      { column: 'empty_ok', values: [] },
    ]);
    expect(() =>
      validateStudioPreview(
        previewPayload({
          dimensions: [
            { column: 'a', values: [1] },
            { column: 'a', values: [2] },
          ],
        }),
      ),
    ).toThrow(/중복/);
  });
  it('rejects a filter list the server would refuse before any request is sent', async () => {
    await expect(
      prepareStudioDashboard(3, {
        expectedSourceRevision: SOURCE_REVISION,
        document: { ...document, filters: [{ column: 'device_type', values: [] }] },
      }),
    ).rejects.toThrow();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Studio date scope response boundary', () => {
  const range = { column: '__time', start: '2023-09-10', end: '2023-09-11' };
  const preview = { draft: { databaseId: 4, title: '매출', explanation: '', widgets: [widgetRow] }, widgets: [widgetRow] };
  it('rejects an all-time reply to a dated preview request', async () => {
    api.post.mockResolvedValue({ data: { document, preview } });
    await expect(
      prepareStudioDashboard(3, { expectedSourceRevision: SOURCE_REVISION, document: { ...document, dateRange: range } }),
    ).rejects.toThrow(/날짜 범위/);
  });
  it('retains the exact date range and rejects duplicated temporal choices', async () => {
    const dated = { ...document, dateRange: range };
    api.post.mockResolvedValue({ data: { document: dated, preview } });
    expect(
      (await prepareStudioDashboard(3, { expectedSourceRevision: SOURCE_REVISION, document: dated })).document.dateRange,
    ).toEqual(range);
    expect(() =>
      validateStudioPreview({ ...preview, temporalColumns: [{ column: '__time' }, { column: '__time' }] }),
    ).toThrow(/날짜 열/);
  });
});
