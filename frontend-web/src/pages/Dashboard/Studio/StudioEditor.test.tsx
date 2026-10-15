import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
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
