import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StudioEditor, { mergeStudioDisplay, reapplyStudioChanges, resolveBlockPreview } from './StudioEditor';
import { StudioDefinitions } from './studioAdapter';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', async () => {
  return {
    useParams: () => ({ dashboardId: '3' }),
    Link: ({ children }: any) => <a>{children}</a>,
  };
});
vi.mock('react-grid-layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div data-testid="widget-viewer" /> }));
vi.mock('@mui/material/styles', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material/styles');
});
vi.mock('@mui/icons-material/DragIndicator', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TuneOutlined', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/AutoAwesomeOutlined', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/CloseOutlined', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/ArrowForwardOutlined', () => ({ default: () => <span /> }));
vi.mock('@mui/material', async () => {
  const { createRequire } = await import('node:module');
  const { Checkbox, FormControlLabel, Radio, RadioGroup } = createRequire(import.meta.url)('@mui/material');
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Checkbox,
    FormControlLabel,
    Radio,
    RadioGroup,
    Box: ({ children, className }: any) => <div className={className}>{children}</div>,
    Stack: Container,
    Drawer: Container,
    DialogTitle: Container,
    DialogContent: Container,
    DialogActions: Container,
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    Typography: ({ children, component: Tag = 'p' }: any) => <Tag>{children}</Tag>,
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    CircularProgress: () => <div>loading</div>,
    Dialog: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
    Button: ({ children, disabled, onClick, ...props }: any) => (
      <button disabled={disabled} onClick={onClick} aria-label={props['aria-label']}>
        {children}
      </button>
    ),
    TextField: ({ label, value, onChange, select, children }: any) =>
      select ? (
        <select aria-label={label} value={value} onChange={onChange}>
          {children}
        </select>
      ) : (
        <label>
          {label}
          <input aria-label={label} value={value} onChange={onChange} />
        </label>
      ),
    useMediaQuery: (query: string) => !query.includes('max-width'),
  };
});

const TEMP = 'new:11111111-1111-4111-8111-111111111111';
const DOC_REVISION = 'a'.repeat(64);
const SOURCE_REVISION = 'b'.repeat(64);
const NEXT_REVISION = 'c'.repeat(64);

const block = (id: string, over: Record<string, any> = {}) => ({
  id,
  kind: 'BOARD_NUMERIC',
  definitionKey: 'b1',
  title: '총매출',
  description: '원본 데이터 집계',
  measureRefs: [],
  dimensionRefs: [],
  display: { decimalPlaces: 0 },
  ...over,
});
const layouts = (ids: string[]) => ({
  lg: ids.map((id, index) => ({ id, x: index * 4, y: 0, w: 4, h: 2 })),
  md: ids.map((id, index) => ({ id, x: (index % 2) * 4, y: Math.floor(index / 2) * 2, w: 4, h: 2 })),
  xs: ids.map((id, index) => ({ id, x: 0, y: index * 2, w: 1, h: 2 })),
});
const doc = (over: Record<string, any> = {}) => {
  const blocks = over.blocks ?? [block('b1')];
  return {
    schemaVersion: 1 as const,
    dashboardId: 3,
    revision: DOC_REVISION,
    title: '매출 대시보드',
    sourceId: 4,
    ...over,
    blocks,
    layouts: over.layouts ?? layouts(blocks.map((item: any) => item.id)),
  };
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
const row = {
  blockId: 'b1',
  type: 'BOARD_NUMERIC',
  title: '총매출',
  sql: 'SELECT 1',
  valueField: 'total',
  fields: ['total'],
  datas: [{ total: 500 }],
};
const envelope = (over: Record<string, any> = {}) => ({
  data: {
    document: doc(),
    definitions,
    preview: { draft: { databaseId: 4, title: '매출 대시보드', explanation: '요약', widgets: [row] }, widgets: [row] },
    previewError: null,
    sourceRevision: SOURCE_REVISION,
    ...over,
  },
});
const savedEnvelope = () => ({
  data: {
    document: doc({ blocks: [block('b1'), block('srv1', { title: '복사본 · 총매출' })], revision: NEXT_REVISION }),
    idMap: { [TEMP]: 'srv1' },
  },
});

const addSelect = () => screen.getByLabelText('추가할 블록 정의');
const saveButton = () => screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
const duplicateBlock = () => fireEvent.change(addSelect(), { target: { value: 'b1' } });

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).ResizeObserver = class {
    callback: any;
    constructor(callback: any) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width: 1200 } }], this);
    }
    unobserve() {
      // The stub never observes anything.
    }
    disconnect() {
      // The stub holds no subscription.
    }
  };
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('studio editor rendering', () => {
  it('renders the aggregated server value at a saved h2 height without sample data', async () => {
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    expect(await screen.findByText('500')).toBeTruthy();
    expect(screen.queryByText('48,260,000')).toBeNull();
    expect(screen.queryByText(/가상 데이터/)).toBeNull();
  });

  it('keeps the document editable and explains a failed preview', async () => {
    api.get.mockResolvedValue(envelope({ preview: null, previewError: '미리보기 조회에 실패했습니다.' }));
    render(<StudioEditor />);
    expect(await screen.findByText('미리보기 조회에 실패했습니다.')).toBeTruthy();
    expect(screen.getAllByText('총매출').length).toBeGreaterThan(0);
    expect(saveButton().disabled).toBe(true);
  });

  it('shows local display settings before they are saved', () => {
    const merged = mergeStudioDisplay(row as any, { decimalPlaces: 2, prefix: '₩' });
    expect(merged.decimalPlaces).toBe(2);
    expect(merged.prefix).toBe('₩');
    expect(merged.sql).toBe('SELECT 1');
  });

  it('resolves a duplicated block through its shared definition and never invents a row', () => {
    const duplicated = block(TEMP) as any;
    expect(resolveBlockPreview({ block: duplicated, definitions, preview: envelope().data.preview })).toBe(row);
    const withoutDatas = { ...row, datas: undefined };
    expect(
      resolveBlockPreview({
        block: block('b1') as any,
        definitions,
        preview: { draft: {}, widgets: [withoutDatas] } as any,
      }),
    ).toBeNull();
  });
});

describe('studio editor save and conflict flow', () => {
  it('saves the pinned revisions only after a real change and remaps server ids', async () => {
    api.get.mockResolvedValue(envelope());
    api.post.mockResolvedValue(savedEnvelope());
    render(<StudioEditor />);
    await screen.findByText('500');
    expect(saveButton().disabled).toBe(true);
    duplicateBlock();
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/studio/dashboards/3/save');
    expect(body.requestId).toBeTruthy();
    expect(body.expectedRevision).toBe(DOC_REVISION);
    expect(body.expectedSourceRevision).toBe(SOURCE_REVISION);
    expect(body.document.blocks).toHaveLength(2);
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect(screen.getByText('저장됨')).toBeTruthy();
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
  });

  it('prevents empty saves and can re-add an existing definition after deleting all blocks', async () => {
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    await screen.findByText('500');
    fireEvent.click(screen.getByRole('button', { name: '총매출 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '블록 삭제' }));
    expect(saveButton().disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: '추가할 블록 정의' }), { target: { value: 'b1' } });
    expect(await screen.findByText('500')).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });
  it('retries a failed save with the exact same request id and body', async () => {
    api.get.mockResolvedValue(envelope());
    api.post.mockRejectedValue(new Error('Network Error'));
    render(<StudioEditor />);
    await screen.findByText('500');
    duplicateBlock();
    fireEvent.click(saveButton());
    expect(await screen.findByText(/서버에 연결하지 못했습니다/)).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
    expect(api.post.mock.calls[1][1].requestId).toBe(api.post.mock.calls[0][1].requestId);
  });

  it('keeps local edits on a conflict and offers comparison instead of overwriting', async () => {
    api.get.mockResolvedValueOnce(envelope());
    api.get.mockResolvedValueOnce(
      envelope({
        document: doc({ title: '원격에서 바뀐 제목', revision: NEXT_REVISION }),
        sourceRevision: 'd'.repeat(64),
      }),
    );
    api.post.mockRejectedValue({ response: { status: 409, data: { message: 'revision mismatch' } } });
    render(<StudioEditor />);
    await screen.findByText('500');
    duplicateBlock();
    fireEvent.click(saveButton());
    expect(await screen.findByText('다른 곳에서 먼저 저장되었습니다')).toBeTruthy();
    expect(screen.getByText('내 화면에만 있는 블록')).toBeTruthy();
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(1);
    expect(screen.queryByText('원격에서 바뀐 제목')).toBeNull();
    expect(screen.getByText(/최신 revision cccccccc/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '최신 기준으로 내 변경 재적용' })).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '계속 편집' }));
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
  });
});

describe('three-way reapply', () => {
  it('applies only the display keys this editor changed and keeps remote-only keys', () => {
    const baseline = doc({ blocks: [block('b1', { display: { decimalPlaces: 0 } })] });
    const local = doc({ blocks: [block('b1', { display: { decimalPlaces: 1 } })] });
    const latest = doc({ blocks: [block('b1', { display: { decimalPlaces: 0, suffix: '원' } })] });
    expect(reapplyStudioChanges(latest, local, baseline).document.blocks[0].display).toEqual({
      decimalPlaces: 1,
      suffix: '원',
    });
  });

  it('keeps a remote field change the local draft never touched', () => {
    const baseline = doc();
    const local = doc();
    const latest = doc({ blocks: [block('b1', { title: '원격 이름' })] });
    const result = reapplyStudioChanges(latest, local, baseline);
    expect(result.document.blocks[0].title).toBe('원격 이름');
    expect(result.addedBlocks).toBe(0);
  });

  it('re-applies a local deletion and local geometry only', () => {
    const baseline = doc({ blocks: [block('b1'), block('b2')] });
    const local = doc({ blocks: [block('b1')] });
    const latest = doc({ blocks: [block('b1'), block('b2')] });
    const removed = reapplyStudioChanges(latest, local, baseline);
    expect(removed.document.blocks.map(item => item.id)).toEqual(['b1']);
    expect(removed.document.layouts.lg.map(item => item.id)).toEqual(['b1']);

    const movedLocal = doc({
      blocks: [block('b1')],
      layouts: { ...layouts(['b1']), lg: [{ id: 'b1', x: 4, y: 2, w: 4, h: 2 }] },
    });
    const moved = reapplyStudioChanges(doc({ blocks: [block('b1')] }), movedLocal, doc({ blocks: [block('b1')] }));
    expect(moved.document.layouts.lg[0]).toEqual({ id: 'b1', x: 4, y: 2, w: 4, h: 2 });
  });

  it('refuses a duplicated block whose source definition is missing from the latest document', () => {
    const baseline = doc();
    const local = doc({ blocks: [block('b1'), block(TEMP, { definitionKey: 'ghost' })] });
    expect(() => reapplyStudioChanges(doc(), local, baseline)).toThrow(/복제한 블록의 원본 정의/);
  });

  it('re-adds a duplicated block that still matches a latest definition', () => {
    const baseline = doc();
    const local = doc({ blocks: [block('b1'), block(TEMP, { title: '복사본 · 총매출' })] });
    const result = reapplyStudioChanges(doc(), local, baseline);
    expect(result.addedBlocks).toBe(1);
    expect(result.document.blocks.map(item => item.id)).toEqual(['b1', TEMP]);
  });
});

describe('Studio AI SDK selected block integration', () => {
  const legacyReply = (body: any) => ({
    data: {
      runId: 'run-test',
      baseRevision: body.expectedRevision,
      sourceRevision: body.expectedSourceRevision,
      clientEditVersion: body.clientEditVersion,
      selectedBlockId: body.selectedBlockId,
      intent: 'edit',
      answer: '선택 제목을 바꿨습니다.',
      proposedOperations: [{ type: 'updateBlock', blockId: 'b1', patch: { title: 'AI 총매출' } }],
      steps: [{ name: '검증', status: 'succeeded' }],
      preview: envelope().data.preview,
    },
  });
  const runReply = (body: any) => ({
    data: {
      runId: 'run-test',
      requestId: body.requestId,
      dashboardId: 3,
      status: 'succeeded',
      steps: [
        { stepId: 'inspectSource', status: 'succeeded', retryable: false },
        { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
        { stepId: 'preview', status: 'succeeded', retryable: false },
        { stepId: 'applyDraft', status: 'succeeded', retryable: false },
      ],
      result: legacyReply(body).data,
    },
  });
  const open = async (prompt = '선택 제목을 AI 총매출로 바꿔') => {
    api.get.mockImplementation(async url => (url === '/studio/runs' ? { data: [] } : envelope()));
    render(<StudioEditor />);
    await screen.findByText('500');
    fireEvent.focus(screen.getByRole('button', { name: '총매출 이동 핸들' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }), {
      target: { value: prompt },
    });
    const form = screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }).closest('form');
    if (!form) throw new Error('AI form missing');
    fireEvent.submit(form);
  };
  it('applies through real useChat and undo without persisting', async () => {
    api.post.mockImplementation(async (_url, body) => runReply(body));
    await open();
    await screen.findByText(/선택 블록에 적용했습니다/);
    expect(screen.getByRole('heading', { name: 'AI 총매출' })).toBeTruthy();
    expect(api.post.mock.calls.map(call => call[0])).toEqual(['/studio/executions']);
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('heading', { name: '총매출' })).toBeTruthy();
  });
  it('rejects a response after a manual move and undo returned to identical content', async () => {
    let finish: (value: any) => void = () => {
      throw new Error('Pending response missing');
    };
    let submitted: any;
    api.post.mockImplementation((_url, body) => {
      submitted = body;
      return new Promise(resolve => {
        finish = resolve;
      });
    });
    await open();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const handle = screen.getByRole('button', { name: '총매출 이동 핸들' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    finish(runReply(submitted));
    await screen.findByText(/응답을 기다리는 동안 편집/);
    expect(screen.queryByRole('heading', { name: 'AI 총매출' })).toBeNull();
    expect(screen.getByRole('heading', { name: '총매출' })).toBeTruthy();
  });
  it('retains the pre-request draft when save fails and allows retrying only the failed save', async () => {
    const { webcrypto } = await import('node:crypto');
    const { documentFingerprint } = await import('./studioExecution');
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111', subtle: webcrypto.subtle });
    let failure: any;
    api.post.mockImplementation(async (url, body) => {
      if (url === '/studio/executions') {
        failure = runReply(body);
        Object.assign(failure.data, {
          status: 'failed',
          baseRevision: body.expectedRevision,
          sourceRevision: body.expectedSourceRevision,
          selectedBlockId: body.selectedBlockId,
          clientEditVersion: body.clientEditVersion,
          baseDocumentHash: await documentFingerprint(body.document),
        });
        failure.data.steps.push({ stepId: 'saveDraft', status: 'failed', retryable: true });
      }
      return failure;
    });
    await open('제목만 바꾸고 저장해줘');
    await screen.findByText(/초안에 자동 적용하지 않았습니다/);
    expect(screen.getByRole('heading', { name: '총매출' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'AI 총매출' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '대시보드 저장 다시 시도' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][0]).toBe('/studio/runs/run-test/retry');
    expect((api.post.mock.calls[1][1] as any).stepId).toBe('saveDraft');
  });
  it('blocks a recovered historical save before POST when a newer manual edit exists', async () => {
    const historical = {
      runId: 'historic',
      requestId: 'q-old',
      dashboardId: 3,
      status: 'failed',
      requiresRequest: false,
      baseRevision: DOC_REVISION,
      sourceRevision: SOURCE_REVISION,
      clientEditVersion: 0,
      selectedBlockId: 'b1',
      baseDocumentHash: 'd'.repeat(64),
      steps: [
        { stepId: 'inspectSource', status: 'succeeded', retryable: false },
        { stepId: 'saveDraft', status: 'failed', retryable: true },
      ],
    };
    api.get.mockImplementation(async url => (url === '/studio/runs' ? { data: [historical] } : envelope()));
    render(<StudioEditor />);
    await screen.findByText('500');
    const handle = screen.getByRole('button', { name: '총매출 이동 핸들' });
    fireEvent.focus(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    fireEvent.click(await screen.findByRole('button', { name: '대시보드 저장 다시 시도' }));
    await screen.findByText(/같은 블록과 원래 초안에서 재시도/);
    expect(api.post).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBe(false);
  });
});

describe('studio editor scoped preview queue', () => {
  const filtersOf = (body: any) => (body?.document?.filters ?? []) as { column: string; values: any[] }[];
  const scopedRow = (value: number) => ({ ...row, datas: [{ total: value }] });
  const scopedPreview = (value: number) => ({
    draft: { databaseId: 4, title: '매출 대시보드', explanation: '요약', widgets: [scopedRow(value)] },
    widgets: [scopedRow(value)],
    dimensions: [{ column: 'category', values: ['Site', 'Mobile'] }],
  });
  const loaded = (value: number) => envelope({ preview: scopedPreview(value) });
  const preparedReply = (filters: any[], value: number) => ({
    data: { document: doc({ ...(filters.length ? { filters } : {}) }), preview: scopedPreview(value) },
  });
  const scopeLabel = () => screen.getByText(/^화면 반영 ·/).textContent;
  const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /공통 필터/ }));
  const addFilterValue = (column: string, value: string) => {
    fireEvent.change(screen.getByLabelText('필터 열 추가'), { target: { value: column } });
    fireEvent.click(screen.getByLabelText(value));
  };
  const applyScope = () => fireEvent.click(screen.getByRole('button', { name: '적용' }));

  it('applies the first scope and renders only the server-confirmed rows', async () => {
    api.get.mockResolvedValue(loaded(500));
    api.post.mockImplementation(async (_url, body) => preparedReply(filtersOf(body), 300));
    render(<StudioEditor />);
    await screen.findByText('500');
    expect(scopeLabel()).toBe('화면 반영 · 공통 필터 없음');
    openPanel();
    addFilterValue('category', 'Site');
    applyScope();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/studio/dashboards/3/preview');
    expect(filtersOf(api.post.mock.calls[0][1])).toEqual([{ column: 'category', values: ['Site'] }]);
    expect(await screen.findByText('300')).toBeTruthy();
    expect(screen.queryByText('500')).toBeNull();
    expect(scopeLabel()).toBe('화면 반영 · category 1개 값');
    expect(await screen.findByText(/공통 필터를 모든 블록에 적용했습니다/)).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it('re-queries the confirmed scope for undo and redo of the applied filter', async () => {
    api.get.mockResolvedValue(loaded(500));
    api.post.mockImplementation(async (_url, body) => {
      const filters = filtersOf(body);
      return preparedReply(filters, filters.length ? 300 : 500);
    });
    render(<StudioEditor />);
    await screen.findByText('500');
    openPanel();
    addFilterValue('category', 'Site');
    applyScope();
    expect(await screen.findByText('300')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(filtersOf(api.post.mock.calls[1][1])).toEqual([]);
    expect(await screen.findByText('500')).toBeTruthy();
    expect(scopeLabel()).toBe('화면 반영 · 공통 필터 없음');
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
    expect(filtersOf(api.post.mock.calls[2][1])).toEqual([{ column: 'category', values: ['Site'] }]);
    expect(await screen.findByText('300')).toBeTruthy();
    expect(scopeLabel()).toBe('화면 반영 · category 1개 값');
  });

  it('ignores a superseded scope answer and keeps the confirmed label and rows', async () => {
    const deferred: Array<{ filters: any[]; resolve: (value: any) => void }> = [];
    api.get.mockResolvedValue(loaded(500));
    api.post.mockImplementation(
      (_url, body) => new Promise(resolve => deferred.push({ filters: filtersOf(body), resolve })),
    );
    render(<StudioEditor />);
    await screen.findByText('500');
    openPanel();
    addFilterValue('category', 'Site');
    applyScope();
    await waitFor(() => expect(deferred).toHaveLength(1));
    await act(async () => deferred[0].resolve(preparedReply(deferred[0].filters, 300)));
    expect(screen.getByText('300')).toBeTruthy();
    // A second scope is requested, then undone before its answer arrives.
    fireEvent.click(screen.getByLabelText('Mobile'));
    applyScope();
    await waitFor(() => expect(deferred).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(deferred).toHaveLength(3));
    await act(async () => deferred[2].resolve(preparedReply(deferred[2].filters, 500)));
    expect(await screen.findByText('500')).toBeTruthy();
    expect(scopeLabel()).toBe('화면 반영 · 공통 필터 없음');
    // The abandoned [Site, Mobile] answer must not repaint the canvas or borrow the new label.
    await act(async () => deferred[1].resolve(preparedReply(deferred[1].filters, 250)));
    expect(screen.queryByText('250')).toBeNull();
    expect(screen.getByText('500')).toBeTruthy();
    expect(scopeLabel()).toBe('화면 반영 · 공통 필터 없음');
  });

  it('keeps the last confirmed scope label and rows when a scoped query fails', async () => {
    api.get.mockResolvedValue(loaded(500));
    api.post.mockImplementation(async (_url, body) => {
      const filters = filtersOf(body);
      if (!filters.length) throw { response: { status: 400 } };
      return preparedReply(filters, 300);
    });
    render(<StudioEditor />);
    await screen.findByText('500');
    openPanel();
    addFilterValue('category', 'Site');
    applyScope();
    expect(await screen.findByText('300')).toBeTruthy();
    expect(scopeLabel()).toBe('화면 반영 · category 1개 값');
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(await screen.findByText(/서버가 처리하지 못했습니다/)).toBeTruthy();
    // The cleared scope never confirmed, so the screen keeps the old rows and says they are stale.
    expect(screen.getByText('300')).toBeTruthy();
    expect(screen.queryByText('500')).toBeNull();
    expect(scopeLabel()).toBe('화면 반영 · category 1개 값');
    expect(screen.getByText(/문서의 조건이 화면 결과에 반영되지 않았습니다/)).toBeTruthy();
  });

  it('drops AI rows once the confirmed scope changes', async () => {
    const executionReply = (body: any) => ({
      data: {
        runId: 'run-test',
        requestId: body.requestId,
        dashboardId: 3,
        status: 'succeeded',
        steps: [
          { stepId: 'inspectSource', status: 'succeeded', retryable: false },
          { stepId: 'proposeSemantics', status: 'succeeded', retryable: false },
          { stepId: 'preview', status: 'succeeded', retryable: false },
          { stepId: 'applyDraft', status: 'succeeded', retryable: false },
        ],
        result: {
          runId: 'run-test',
          baseRevision: body.expectedRevision,
          sourceRevision: body.expectedSourceRevision,
          clientEditVersion: body.clientEditVersion,
          selectedBlockId: body.selectedBlockId,
          intent: 'edit',
          answer: '선택 제목을 바꿨습니다.',
          proposedOperations: [{ type: 'updateBlock', blockId: 'b1', patch: { title: 'AI 총매출' } }],
          steps: [{ name: '검증', status: 'succeeded' }],
          preview: scopedPreview(500),
        },
      },
    });
    api.get.mockImplementation(async url => (url === '/studio/runs' ? { data: [] } : loaded(500)));
    api.post.mockImplementation(async (url, body) =>
      url === '/studio/executions' ? executionReply(body) : preparedReply(filtersOf(body), 300),
    );
    render(<StudioEditor />);
    await screen.findByText('500');
    fireEvent.focus(screen.getByRole('button', { name: '총매출 이동 핸들' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }), {
      target: { value: '선택 제목을 AI 총매출로 바꿔' },
    });
    const aiForm = screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }).closest('form');
    if (!aiForm) throw new Error('AI form missing');
    fireEvent.submit(aiForm);
    expect(await screen.findByRole('heading', { name: 'AI 총매출' })).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    openPanel();
    addFilterValue('category', 'Site');
    applyScope();
    expect(await screen.findByText('300')).toBeTruthy();
    // The AI row belonged to the previous scope: it must not survive the new confirmed query.
    expect(screen.queryByText('500')).toBeNull();
    expect(screen.getByRole('heading', { name: 'AI 총매출' })).toBeTruthy();
  });
});

describe('Studio date scope conflict reapply', () => {
  const dateRange = { column: '__time', start: '2023-09-10', end: '2023-09-11' };
  it('reapplies my date change without overwriting the latest categorical scope or layouts', () => {
    const baseline = doc();
    const filters = [{ column: 'category', values: ['Site'] }];
    const latest = doc({ filters, title: '다른 곳의 제목' });
    const local = doc({ dateRange });
    const result = reapplyStudioChanges(latest, local, baseline).document;
    expect(result.dateRange).toEqual(dateRange);
    expect(result.filters).toEqual(filters);
    expect(result.title).toBe(latest.title);
    expect(result.layouts).toEqual(latest.layouts);
  });
  it('preserves an untouched remote date and explicitly clears a date removed locally', () => {
    const latest = doc({ dateRange });
    expect(reapplyStudioChanges(latest, doc({ title: '내 제목' }), doc()).document.dateRange).toEqual(dateRange);
    expect(reapplyStudioChanges(latest, doc(), doc({ dateRange })).document.dateRange).toBeUndefined();
  });
});

describe('Studio combined date scope preview', () => {
  const filters = [{ column: 'category', values: ['Site'] }];
  const dateRange = { column: '__time', start: '2023-09-10', end: '2023-09-11' };
  const data = (value: number) => ({
    draft: { databaseId: 4, title: '매출', explanation: '', widgets: [{ ...row, datas: [{ total: value }] }] },
    widgets: [{ ...row, datas: [{ total: value }] }],
    temporalColumns: [{ column: '__time', min: '2023-09-09', max: '2023-09-16' }],
  });
  const initial = () => envelope({ document: doc({ filters }), preview: data(300) });
  const reply = (body: any, value: number) => ({ data: { document: body.document, preview: data(value) } });
  const setDates = () => {
    fireEvent.click(screen.getByRole('button', { name: '공통 기간', exact: true }));
    fireEvent.change(screen.getByLabelText('기간 열'), { target: { value: '__time' } });
    fireEvent.change(screen.getByLabelText('시작일 (UTC)'), { target: { value: dateRange.start } });
    fireEvent.change(screen.getByLabelText('종료일 (UTC)'), { target: { value: dateRange.end } });
  };
  const dateApply = () =>
    fireEvent.click(
      within(screen.getByRole('region', { name: '공통 기간' })).getByRole('button', { name: '적용', exact: true }),
    );
  it('queries only on date apply, retains categorical scope, and re-queries date undo/redo and clear', async () => {
    api.get.mockResolvedValue(initial());
    api.post.mockImplementation(async (_url, body) => reply(body, body.document.dateRange ? 90 : 300));
    render(<StudioEditor />);
    await screen.findByText('300');
    setDates();
    expect(api.post).not.toHaveBeenCalled();
    dateApply();
    expect(await screen.findByText('90')).toBeTruthy();
    expect(api.post.mock.calls[0][1].document).toMatchObject({ dateRange, filters });
    fireEvent.click(screen.getByRole('button', { name: '되돌리기', exact: true }));
    expect(await screen.findByText('300')).toBeTruthy();
    expect(api.post.mock.lastCall?.[1].document.dateRange).toBeUndefined();
    expect(api.post.mock.lastCall?.[1].document.filters).toEqual(filters);
    fireEvent.click(screen.getByRole('button', { name: '다시 실행', exact: true }));
    expect(await screen.findByText('90')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '기간 전체 해제', exact: true }));
    expect(await screen.findByText('300')).toBeTruthy();
    expect(api.post.mock.lastCall?.[1].document.filters).toEqual(filters);
  });
  it('drops a late dated answer after undo requested a different scope', async () => {
    api.get.mockResolvedValue(initial());
    let late: (() => void) | undefined;
    api.post.mockImplementation((_url, body) =>
      body.document.dateRange?.end === '2023-09-12'
        ? new Promise(resolve => {
            late = () => resolve(reply(body, 999));
          })
        : Promise.resolve(reply(body, body.document.dateRange ? 90 : 300)),
    );
    render(<StudioEditor />);
    await screen.findByText('300');
    setDates();
    dateApply();
    await screen.findByText('90');
    fireEvent.change(screen.getByLabelText('종료일 (UTC)'), { target: { value: '2023-09-12' } });
    dateApply();
    await waitFor(() => expect(late).toBeTypeOf('function'));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기', exact: true }));
    await screen.findByText('300');
    await act(async () => {
      late?.();
    });
    expect(screen.queryByText('999')).toBeNull();
    expect(screen.getByText(/^화면 반영 ·/).textContent).toBe('화면 반영 · category 1개 값');
  });
});
