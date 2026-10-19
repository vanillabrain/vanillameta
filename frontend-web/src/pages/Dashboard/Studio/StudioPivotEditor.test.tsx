import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioEditor from './StudioEditor';
import { PublishedBlockView } from './PublishedDashboard';
import { pivotAggregate, pivotBlock, pivotRecipe, mixedPivotDocument } from './studioPivot.fixture';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => () => undefined }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dashboardId: '3' }),
  Link: ({ children }: any) => <a>{children}</a>,
}));
vi.mock('react-grid-layout', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('./studioQuestionDraft', async original => ({ ...(await original<any>()), studioQuestionKey: async () => null }));
vi.mock('./studioDocumentDraft', async original => ({
  ...(await original<any>()),
  studioDocumentDraftKey: async () => 'pivot-editor-draft',
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div>Existing chart</div> }));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: any) {}
      observe() {
        this.callback([{ contentRect: { width: 1200 } }]);
      }
      disconnect() {
        /* No observer subscription in this fixture. */
      }
      unobserve() {
        /* No observer subscription in this fixture. */
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('adds only a draft then requires whole preview before save, preserving title edits without requery', async () => {
  const initial = mixedPivotDocument();
  initial.blocks.pop();
  for (const bp of ['lg', 'md', 'xs'] as const) initial.layouts[bp].pop();
  const chart = {
    blockId: 'chart1',
    type: 'BOARD_NUMERIC',
    sql: 'SELECT sum(amount) AS value FROM source',
    valueField: 'value',
    fields: ['value'],
    datas: [{ value: 500 }],
  };
  const result = {
    data: {
      sourceRevision: 'c'.repeat(64),
      document: initial,
      definitions: {
        dashboardId: 3,
        sourceId: 4,
        revision: 'a'.repeat(64),
        explanation: '',
        entries: { chart1: { widget: chart } },
      },
      preview: null,
      previewError: '미리보기 없음',
    },
  };
  api.get.mockImplementation(async path =>
    path.endsWith('/pivot-options')
      ? { data: { options: [{ viewId: 1, name: '고객 저장 보기', block: pivotBlock() }] } }
      : result,
  );
  api.post.mockImplementation(async (path, body) => {
    if (path.endsWith('/preview'))
      return {
        data: {
          document: body.document,
          preview: {
            draft: { databaseId: 4, title: initial.title, explanation: '', widgets: [chart] },
            widgets: [
              chart,
              {
                blockId: pivotBlock().id,
                type: 'SEGMENT_PIVOT',
                title: '고객 Pivot',
                description: '',
                pivot: pivotAggregate(),
              },
            ],
          },
        },
      };
    throw new Error('save response lost');
  });
  render(<StudioEditor />);
  fireEvent.click(await screen.findByRole('button', { name: '저장 Pivot 추가' }));
  await screen.findByRole('option', { name: '고객 저장 보기' });
  fireEvent.change(screen.getByLabelText('저장한 집계 Pivot'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: '초안에 추가' }));
  await screen.findByRole('button', { name: '고객 Pivot 설정' });
  expect(screen.getByRole('link', { name: '저장본 복제·소스 교체 새 탭에서 열기' }).getAttribute('href')).toBe(
    '/dashboard/3/reuse?editor=studio',
  );
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByRole('table');
  expect(screen.getByText(/저장 보기 조건 적용/).textContent).toContain('저장 기간 전체 기간');
  expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '고객 Pivot 설정' }));
  expect(screen.queryByLabelText('블록 표현')).toBeNull();
  expect(screen.queryByLabelText('숫자 표시')).toBeNull();
  fireEvent.change(screen.getByLabelText('블록 제목'), { target: { value: '직접 수정 Pivot' } });
  fireEvent.blur(screen.getByLabelText('블록 제목'));
  await screen.findByRole('button', { name: '직접 수정 Pivot 설정' });
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '기본 크기' }));
  fireEvent.click(screen.getByRole('button', { name: '크게' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(api.post.mock.calls.some(([path]) => path.endsWith('/save'))).toBe(true));
  const body = api.post.mock.calls.find(([path]) => path.endsWith('/save'))?.[1];
  expect(body.document.layouts.lg[1]).toMatchObject({ x: 0, w: 12, h: 8 });
  expect(body.document.blocks[1].title).toBe('직접 수정 Pivot');
  expect(body.document.blocks[1].pivot).toEqual(pivotRecipe());
  expect(body.document.blocks[1].sql).toBeUndefined();
});
it('renders a public aggregate-only snapshot with no drill, CSV or API calls', () => {
  const pivot = pivotAggregate();
  delete pivot.sourceRevision;
  delete pivot.viewRevision;
  render(
    <PublishedBlockView
      block={{ id: 'block-1', title: '공개 Pivot', description: '', kind: 'SEGMENT_PIVOT', display: {}, pivot }}
    />,
  );
  expect(screen.queryByText(/저장 보기 조건 적용/)).toBeNull();
  expect(screen.queryByRole('list', { name: '이 블록의 집계 조건' })).toBeNull();
  expect(screen.queryByText('이 블록에 적용')).toBeNull();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getAllByText('5,431.25 USD').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /기여 원본|CSV/ })).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('labels a saved period/filter inside the owner block while keeping it out of public snapshots', async () => {
  const document = mixedPivotDocument(),
    saved = document.blocks[1];
  saved.pivot.state.filters = [{ column: 'component', values: ['Compute'] }];
  saved.pivot.state.dateRange = { column: 'day', start: '2025-01-01', end: '2025-01-03', timeZone: 'UTC' };
  const chart = {
    blockId: 'chart1',
    type: 'BOARD_NUMERIC',
    sql: 'SELECT sum(amount) AS value FROM source',
    valueField: 'value',
    fields: ['value'],
    datas: [{ value: 500 }],
  };
  api.get.mockResolvedValue({
    data: {
      document,
      sourceRevision: 'c'.repeat(64),
      definitions: {
        dashboardId: 3,
        sourceId: 4,
        revision: 'a'.repeat(64),
        explanation: '',
        entries: { chart1: { widget: chart }, 'pivot:1': { pivot: saved.pivot } },
      },
      preview: {
        draft: { databaseId: 4, title: document.title, explanation: '', widgets: [chart] },
        widgets: [
          chart,
          { blockId: saved.id, type: 'SEGMENT_PIVOT', title: saved.title, description: '', pivot: pivotAggregate() },
        ],
      },
      previewError: null,
    },
  });
  render(<StudioEditor />);
  await screen.findByRole('table');
  expect(screen.getByText(/저장 보기 조건 적용/).textContent).toContain('저장 필터 1개');
  expect(screen.getByText(/저장 보기 조건 적용/).textContent).toContain('2025-01-01 ~ 2025-01-03 · UTC');
  fireEvent.click(screen.getByRole('button', { name: '기존 매출 설정' }));
  fireEvent.click(screen.getByRole('button', { name: '블록 삭제' }));
  expect(screen.getByRole('button', { name: '기존 매출 설정' })).toBeTruthy();
  expect(screen.getByText(/마지막 일반 차트를 삭제하지 않았습니다/)).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});
