import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StudioEditor, { mergeStudioDisplay, reapplyStudioChanges, resolveBlockPreview } from './StudioEditor';
import { StudioDefinitions } from './studioAdapter';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const route = vi.hoisted(() => ({ dashboardId: '3' }));
const questions = vi.hoisted(() => ({ key: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('./studioQuestionDraft', async importOriginal => ({
  ...(await importOriginal<typeof import('./studioQuestionDraft')>()),
  studioQuestionKey: questions.key,
}));
vi.mock('./studioDocumentDraft', async importOriginal => ({
  ...(await importOriginal<typeof import('./studioDocumentDraft')>()),
  studioDocumentDraftKey: async (id: number) => 'document-test-' + id,
}));

vi.mock('react-router-dom', async () => {
  return {
    useParams: () => route,
    Link: ({ children }: any) => <a>{children}</a>,
  };
});
vi.mock('react-grid-layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div data-testid="widget-viewer" /> }));

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
  sessionStorage.clear();
  questions.key.mockImplementation(async (id: number) => 'question-test-' + id);
  route.dashboardId = '3';
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
  it('restores blocks only after explicit server preview and clears the draft after save', async () => {
    const draft = doc({ blocks: [block('b1', { title: '복구한 제목' })] });
    sessionStorage.setItem(
      'document-test-3',
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        baseRevision: DOC_REVISION,
        sourceRevision: SOURCE_REVISION,
        document: draft,
      }),
    );
    api.get.mockResolvedValue(envelope());
    api.post.mockImplementation(async (url: string) =>
      url.endsWith('/preview')
        ? { data: { document: draft, preview: envelope().data.preview } }
        : { data: { document: doc({ blocks: draft.blocks, revision: NEXT_REVISION }), idMap: {} } },
    );
    render(<StudioEditor />);
    const restore = await screen.findByRole('button', { name: '블록 초안 복구' });
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(restore);
    await screen.findByRole('button', { name: '복구한 제목 설정' });
    expect(api.post.mock.calls.map(c => c[0])).toEqual(['/studio/dashboards/3/preview']);
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(sessionStorage.getItem('document-test-3')).toBeNull());
  });
  it.each(['revision', 'source'])('keeps a stale %s draft without applying or deleting it', async kind => {
    sessionStorage.setItem(
      'document-test-3',
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        baseRevision: kind === 'revision' ? NEXT_REVISION : DOC_REVISION,
        sourceRevision: kind === 'source' ? NEXT_REVISION : SOURCE_REVISION,
        document: doc({ revision: kind === 'revision' ? NEXT_REVISION : DOC_REVISION }),
      }),
    );
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    const restore = await screen.findByRole('button', { name: '블록 초안 복구' });
    expect((restore as HTMLButtonElement).disabled).toBe(true);
    expect(sessionStorage.getItem('document-test-3')).not.toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('preserves the stored draft after failed preview and does not overwrite new editing', async () => {
    sessionStorage.setItem(
      'document-test-3',
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        baseRevision: DOC_REVISION,
        sourceRevision: SOURCE_REVISION,
        document: doc(),
      }),
    );
    api.get.mockResolvedValue(envelope());
    api.post.mockRejectedValueOnce(new Error('preview unavailable'));
    render(<StudioEditor />);
    fireEvent.click(await screen.findByRole('button', { name: '블록 초안 복구' }));
    await screen.findByText('서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 같은 요청으로 다시 시도해 주세요.');
    expect(sessionStorage.getItem('document-test-3')).not.toBeNull();
    duplicateBlock();
    expect((screen.getByRole('button', { name: '블록 초안 복구' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '보관 블록 초안 폐기' }));
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('document-test-3') ?? '{}').document.blocks.length).toBe(2),
    );
  });

  it('keeps both drafts when editing changes while restore preview is pending', async () => {
    const draft = doc({ blocks: [block('b1', { title: '지연된 복구 제목' })] });
    const stored = JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      baseRevision: DOC_REVISION,
      sourceRevision: SOURCE_REVISION,
      document: draft,
    });
    sessionStorage.setItem('document-test-3', stored);
    let complete: (value: any) => void = () => undefined;
    api.get.mockResolvedValue(envelope());
    api.post.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );
    render(<StudioEditor />);
    fireEvent.click(await screen.findByRole('button', { name: '블록 초안 복구' }));
    duplicateBlock();
    await act(async () => complete({ data: { document: draft, preview: envelope().data.preview } }));
    await screen.findByText('확인 중 현재 편집이 바뀌었습니다. 보관 초안과 현재 편집은 유지했습니다.');
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '지연된 복구 제목 설정' })).toBeNull();
    expect(sessionStorage.getItem('document-test-3')).toBe(stored);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('never replaces new typing with a delayed storage lookup', async () => {
    let resolveKey: (key: string) => void = () => undefined;
    questions.key.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          resolveKey = resolve;
        }),
    );
    sessionStorage.setItem(
      'question-test-3',
      JSON.stringify({ version: 1, updatedAt: Date.now(), text: '늦게 조회된 질문' }),
    );
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    fireEvent.click(await screen.findByRole('button', { name: 'AI 열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }), { target: { value: '현재 작성중' } });
    await act(async () => resolveKey('question-test-3'));
    expect((screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }) as HTMLTextAreaElement).value).toBe('현재 작성중');
    expect((screen.getByRole('button', { name: '질문 복구' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('requires explicit restoration of a stored question and never submits it automatically', async () => {
    sessionStorage.setItem('question-test-3', JSON.stringify({ version: 1, updatedAt: Date.now(), text: '보관 질문' }));
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    const restore = await screen.findByRole('button', { name: '질문 복구' });
    expect(screen.queryByRole('textbox', { name: 'AI에게 요청할 내용' })).toBeNull();
    fireEvent.click(restore);
    expect((screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }) as HTMLTextAreaElement).value).toBe('보관 질문');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('keeps new input when discarding a different stored question', async () => {
    sessionStorage.setItem('question-test-3', JSON.stringify({ version: 1, updatedAt: Date.now(), text: '이전 질문' }));
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    await screen.findByRole('button', { name: '질문 복구' });
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }), { target: { value: '새 질문' } });
    expect((screen.getByRole('button', { name: '질문 복구' }) as HTMLButtonElement).disabled).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('question-test-3') ?? 'null').text).toBe('이전 질문');
    fireEvent.click(screen.getByRole('button', { name: '보관 질문 폐기' }));
    expect((screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }) as HTMLTextAreaElement).value).toBe('새 질문');
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('question-test-3') ?? 'null').text).toBe('새 질문'));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('keeps a separate list tab available without discarding the editable draft', async () => {
    api.get.mockResolvedValue(envelope());
    render(<StudioEditor />);
    const link = await screen.findByRole('link', { name: '대시보드 목록 새 탭에서 열기' });
    expect(link.getAttribute('href')).toBe('/dashboard');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    const reuse = screen.getByRole('link', { name: '저장본 복제·소스 교체 새 탭에서 열기' });
    expect(reuse.getAttribute('href')).toBe('/dashboard/3/reuse?editor=studio');
    expect(reuse.getAttribute('target')).toBe('_blank');
    expect(reuse.getAttribute('rel')).toBe('noopener noreferrer');

    duplicateBlock();
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('편집 이력 1회 변경')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }), { target: { value: '전송 전 질문' } });
    fireEvent.click(screen.getByRole('button', { name: '보조 패널 닫기' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
    expect((screen.getByRole('textbox', { name: 'AI에게 요청할 내용' }) as HTMLTextAreaElement).value).toBe('전송 전 질문');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(api.post).not.toHaveBeenCalled();
  });

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

  it('explains an empty chart without confusing a valid zero metric with no data', async () => {
    const chart = block('b2', { kind: 'CHART_BAR', definitionKey: 'b2', title: '채널별 매출' });
    const chartRow = {
      ...row,
      blockId: 'b2',
      type: 'CHART_BAR',
      title: chart.title,
      categoryField: 'channel',
      fields: ['channel', 'total'],
      datas: [],
    };
    const zero = { ...row, datas: [{ total: 0 }] };
    api.get.mockResolvedValue(
      envelope({
        document: doc({ blocks: [block('b1'), chart] }),
        definitions: { ...definitions, entries: { ...definitions.entries, b2: { widget: chartRow } } },
        preview: {
          draft: { databaseId: 4, title: '매출 대시보드', explanation: '요약', widgets: [zero, chartRow] },
          widgets: [zero, chartRow],
        },
      }),
    );
    render(<StudioEditor />);
    expect(await screen.findByText('선택한 기간·필터에 해당하는 데이터가 없습니다.')).toBeTruthy();
    expect(within(screen.getByLabelText('총매출 블록')).getByText('0')).toBeTruthy();
    expect(screen.queryByTestId('widget-viewer')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
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
    const submit = saveButton();
    submit.focus();
    fireEvent.click(submit);
    expect(await screen.findByText('다른 곳에서 먼저 저장되었습니다')).toBeTruthy();
    expect(screen.getByText('내 화면에만 있는 블록')).toBeTruthy();
    expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(1);
    expect(screen.queryByText('원격에서 바뀐 제목')).toBeNull();
    expect(screen.getByText(/최신 revision cccccccc/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '최신 기준으로 내 변경 재적용' })).toBeTruthy();
    expect(submit.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '계속 편집' }));
    await waitFor(() => expect(document.activeElement).toBe(submit));
    expect(saveButton().disabled).toBe(false);
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

it('UC037 hands a saved creation to the top-level publisher, preserving dirty original and pinning the copy revision', async () => {
  const run = {
    runId: 'saved-create',
    requestId: 'saved-create-request',
    dashboardId: 3,
    status: 'succeeded',
    steps: [{ stepId: 'createProposal', status: 'succeeded', retryable: false }],
    creationResult: { proposalId: 'parent', sourceId: 4, sourceRevision: SOURCE_REVISION },
    creationSaveResult: { dashboardId: 99, sourceId: 4, revision: NEXT_REVISION },
  };
  api.get.mockImplementation(async (url: string) =>
    url === '/studio/runs' ? { data: [run] } : url.endsWith('/publications') ? { data: null } : envelope(),
  );
  render(<StudioEditor />);
  await screen.findByText('500');
  duplicateBlock();
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'AI 열기' }));
  await screen.findByText('대상: 저장한 새 대시보드 #99');
  fireEvent.change(screen.getByLabelText('AI에게 요청할 내용'), { target: { value: '게시 준비해 줘' } });
  fireEvent.click(screen.getByRole('button', { name: '전송' }));
  await screen.findByRole('dialog', { name: '게시·공유' });
  expect(screen.queryByRole('complementary', { name: 'Studio 보조 패널' })).toBeNull();
  expect(screen.getByText('새 대시보드 #99 · 생성안 저장 버전 기준')).toBeDefined();
  expect(api.post).not.toHaveBeenCalled();
  const publish = screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement;
  await waitFor(() => expect(publish.disabled).toBe(false));
  api.post.mockRejectedValue({ response: { status: 409 } });
  fireEvent.click(publish);
  await screen.findByText(/저장본이 변경되어 이 버전의 게시를 멈췄습니다/);
  expect(screen.getByRole('link', { name: '최신 저장본 확인' }).getAttribute('href')).toBe('/dashboard/99/studio');
  expect(api.post.mock.calls[0][0]).toBe('/studio/dashboards/99/publications');
  expect(api.post.mock.calls[0][1]).toMatchObject({
    expectedRevision: NEXT_REVISION,
    visibility: 'private',
    allowRemix: false,
  });
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saveButton().disabled).toBe(false);
  expect(screen.getAllByText('복사본 · 총매출').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '게시·공유' }));
  await within(screen.getByRole('dialog', { name: '게시·공유' })).findByText(/저장되지 않은 변경이 있습니다/);
  expect(screen.queryByText('새 대시보드 #99 · 생성안 저장 버전 기준')).toBeNull();
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith('/studio/dashboards/3/publications', undefined, expect.anything()),
  );
  expect((screen.getByRole('button', { name: '게시하기' }) as HTMLButtonElement).disabled).toBe(true);
});

it('UC039 retries a failed latest read explicitly and never saves or publishes while loading', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue(envelope());
  render(<StudioEditor />);
  await screen.findByText('Studio를 열지 못했습니다');
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  expect(screen.queryByRole('button', { name: '게시·공유' })).toBeNull();
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('500');
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.post).not.toHaveBeenCalled();
});
it('UC039 denies data, editing and publication when latest read is forbidden', async () => {
  api.get.mockRejectedValue({ response: { status: 403 } });
  render(<StudioEditor />);
  await screen.findByText('이 대시보드를 편집할 권한이 없습니다.');
  expect(screen.queryByText('500')).toBeNull();
  expect(screen.queryByRole('button', { name: '게시·공유' })).toBeNull();
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it.each(['success', 'failure'])('UC039 ignores an earlier target read %s after the current target loads', async outcome => {
  let resolveOld: (value: any) => void, rejectOld: (cause: any) => void;
  const old = new Promise((resolve, reject) => {
    resolveOld = resolve;
    rejectOld = reject;
  });
  api.get.mockImplementation((url: string) =>
    url === '/studio/dashboards/3'
      ? old
      : Promise.resolve(
          envelope({
            document: doc({ dashboardId: 4, title: 'Current target 4' }),
            definitions: { ...definitions, dashboardId: 4 },
          }),
        ),
  );
  const view = render(<StudioEditor />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  route.dashboardId = '4';
  view.rerender(<StudioEditor />);
  await screen.findAllByText('Current target 4');
  await act(async () => {
    if (outcome === 'success') resolveOld(envelope());
    else rejectOld({ response: { status: 403 } });
    await old.catch(() => undefined);
  });
  expect(screen.getAllByText('Current target 4').length).toBeGreaterThan(0);
  expect(screen.queryByText('Studio를 열지 못했습니다')).toBeNull();
  expect(screen.queryAllByText('매출 대시보드')).toHaveLength(0);
  expect(api.post).not.toHaveBeenCalled();
});
