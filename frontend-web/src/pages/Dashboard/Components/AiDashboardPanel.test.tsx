import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AiDashboardPanel from './AiDashboardPanel';
import { installRadixBrowserAPIs, selectRadixOption } from './dashboardTestUtils';
const api = vi.hoisted(() => ({ post: vi.fn(), sources: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/api/databaseService', () => ({ default: { selectDatabaseList: api.sources } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options: any) => options?.defaultValue || key }),
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: ({ title }: any) => <div data-testid="preview">{title}</div> }));
installRadixBrowserAPIs();
const widget = {
  title: 'Total',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT SUM(amount) AS total FROM sales',
  valueField: 'total',
  decimalPlaces: 2,
};
const draft = { databaseId: 7, title: 'Sales', explanation: 'All records.', widgets: [widget] };
const preview = { draft, widgets: [{ ...widget, fields: [{ name: 'total' }], datas: [{ total: 5.571 }] }], dimensions: [] };
const success = (data: any) => ({ data: { status: 'SUCCESS', data } });
const sourceTrigger = () => screen.getByRole('combobox', { name: 'Data source' }) as HTMLButtonElement;
beforeEach(() => {
  vi.clearAllMocks();
  api.sources.mockResolvedValue(success([{ id: 7, name: 'Sales', engine: 'duckdb' }]));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const mount = async (extra: any = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  // Keep legacy edit regressions explicit; creation tests opt out below.
  const view = render(<AiDashboardPanel open dashboardId={3} onClose={onClose} onSaved={onSaved} {...extra} />);
  // 실제 Data source는 Radix Select이므로 목록이 로드되어 활성화될 때까지 기다린다.
  await waitFor(() => expect(sourceTrigger().disabled).toBe(false));
  return { ...view, onClose, onSaved };
};
const start = async (label = 'Generate preview') => {
  await selectRadixOption(sourceTrigger(), 'Sales');
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Show totals' } });
  fireEvent.click(screen.getByText(label));
};
it('requires a valid preview and explicit Save, passes dashboardId and local-model timeout', async () => {
  api.post
    .mockResolvedValueOnce(success(draft))
    .mockResolvedValueOnce(success(preview))
    .mockResolvedValueOnce(success({ id: 99 }));
  const view = await mount({ dashboardId: 3 });
  await start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(
    2,
    '/ai/dashboard-preview',
    { draft, dashboardId: 3, includeTrends: true },
    { timeout: 180000 },
  );
  expect(screen.getByText('All records.')).not.toBeNull();
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledWith(99));
  expect(api.post).toHaveBeenNthCalledWith(3, '/ai/dashboard-save', { draft, dashboardId: 3 }, { timeout: 180000 });
  expect(view.onClose).toHaveBeenCalledTimes(1);
  expect(view.onClose.mock.invocationCallOrder[0]).toBeLessThan(view.onSaved.mock.invocationCallOrder[0]);
});
it('revises the current draft and preserves the old preview but disables stale Save on AI failure', async () => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(preview));
  await mount({ currentDraft: draft });
  await start('Revise preview');
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  expect(api.post.mock.calls[0][1].currentDraft).toEqual(draft);
  api.post.mockRejectedValueOnce({ response: { data: { message: 'AI API key is not configured.' } } });
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Add chart' } });
  fireEvent.click(screen.getByText('Revise preview'));
  await waitFor(() => expect(screen.getByText('AI API key is not configured.')).not.toBeNull());
  expect(screen.getByTestId('preview')).not.toBeNull();
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});
it('rejects incomplete preview data', async () => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success({ ...preview, widgets: [] }));
  await mount();
  await start();
  await waitFor(() => expect(screen.getByText('The dashboard preview is incomplete. Please try again.')).not.toBeNull());
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});
it('ignores a late generation result after cancellation and discards unsaved input on reopen', async () => {
  let resolve: (value: any) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = await mount();
  await start();
  fireEvent.click(screen.getByText('Cancel'));
  expect(view.onClose).toHaveBeenCalledTimes(1);
  await act(async () => resolve(success(draft)));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(view.onSaved).not.toHaveBeenCalled();
  view.rerender(<AiDashboardPanel open={false} onClose={view.onClose} onSaved={view.onSaved} />);
  view.rerender(<AiDashboardPanel open onClose={view.onClose} onSaved={view.onSaved} />);
  expect((screen.getByLabelText('What would you like to see?') as HTMLTextAreaElement).value).toBe('');
  expect(screen.queryByTestId('preview')).toBeNull();
});
it('preserves the prior preview and blocks stale Save after a preview request fails', async () => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(preview));
  await mount();
  await start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  api.post
    .mockResolvedValueOnce(success({ ...draft, title: 'Revised' }))
    .mockRejectedValueOnce(new Error('SQL preview failed'));
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Revise metrics' } });
  fireEvent.click(screen.getByText('Revise preview'));
  await waitFor(() => expect(screen.getByText('SQL preview failed')).not.toBeNull());
  expect(screen.getByTestId('preview')).not.toBeNull();
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});
it('reports a save rejection without notifying success or closing, and requires a fresh preview', async () => {
  api.post
    .mockResolvedValueOnce(success(draft))
    .mockResolvedValueOnce(success(preview))
    .mockResolvedValueOnce({ data: { status: 'ERROR', message: 'Save rejected' } });
  const view = await mount();
  await start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByText('Save rejected')).not.toBeNull());
  expect(view.onSaved).not.toHaveBeenCalled();
  expect(view.onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('preview')).not.toBeNull();
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});

it('preselects the uploaded source and requires explicit generation', async () => {
  await mount({ initialDatabaseId: 7 });
  // Radix Select는 value 대신 선택된 항목 텍스트를 표시한다.
  await waitFor(() => expect(sourceTrigger().textContent).toBe('Sales'));
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByText('Generate preview') as HTMLButtonElement).disabled).toBe(true);
});
it('does not select a URL source absent from the authorized list', async () => {
  await mount({ initialDatabaseId: 999 });
  expect(sourceTrigger().textContent).toBe('');
  expect(api.post).not.toHaveBeenCalled();
});
it('only offers supported DuckDB sources, excluding legacy connections', async () => {
  api.sources.mockResolvedValue(
    success([
      { id: 3, name: 'Legacy', engine: 'sqlite' },
      { id: 4, name: 'Broken file', engine: 'duckdb', configError: true },
      { id: 7, name: 'Sales', engine: 'duckdb' },
    ]),
  );
  render(<AiDashboardPanel open onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(sourceTrigger().disabled).toBe(false));
  await userEvent.click(sourceTrigger());
  const options = await screen.findByRole('listbox');
  expect(within(options).getByRole('option', { name: 'Sales' })).toBeTruthy();
  expect(within(options).queryByRole('option', { name: 'Legacy' })).toBeNull();
  expect(within(options).queryByRole('option', { name: 'Broken file' })).toBeNull();
});

it.each([true, false])('UC-001 BR-001/004 pairs KPI preview with trend or unavailable (%s)', async available => {
  const result = {
    ...preview,
    widgets: [
      {
        ...preview.widgets[0],
        ...(available
          ? {
              trend: {
                grain: 'day',
                points: [
                  { time: '2023-09-09T00:00:00Z', value: 3 },
                  { time: '2023-09-10T00:00:00Z', value: 2 },
                ],
              },
            }
          : { trendUnavailable: 'No temporal column is available.' }),
      },
    ],
  };
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(result));
  await mount();
  await start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByTestId('preview').textContent).toBe('Total');
  if (available) expect(screen.getByRole('img', { name: 'Total 일별 추세' })).toBeTruthy();
  else expect(screen.getByText(/No temporal column is available/)).toBeTruthy();
  expect(api.post.mock.calls[1][1].includeTrends).toBe(true);
});

const semantic = (p = preview) => ({
  proposal: {
    schemaVersion: 1,
    sourceId: 7,
    sourceRevision: 'source-v1',
    title: draft.title,
    measures: [],
    dimensions: [],
    blocks: [{ key: 'total', chart: 'number', measureKey: 'requests' }],
  },
  previewDigest: 'a'.repeat(64),
  draft: p.draft,
  plan: {
    measures: [
      {
        key: 'requests',
        identity: 'b'.repeat(64),
        action: 'reuse',
        metricId: 3,
        definition: { label: '요청 수', aggregation: 'SUM', column: 'amount' },
      },
    ],
    dimensions: [],
  },
  preview: p,
});
const creation = async () => {
  let sequence = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    },
  });
  return mount({ dashboardId: undefined });
};
const createPreview = async () => {
  api.post.mockResolvedValueOnce(success(semantic())).mockResolvedValueOnce(success(semantic()));
  await start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
};
it('UC012 connects creation proposal → preview → receipt save, retains prompt, and navigates after save', async () => {
  const view = await creation();
  await createPreview();
  expect(api.post.mock.calls[0][0]).toBe('/bi/analysis-proposals');
  expect(api.post.mock.calls[0][1]).toEqual({ sourceId: 7, prompt: 'Show totals' });
  expect(api.post.mock.calls[1][0]).toBe('/bi/analysis-proposals/preview');
  expect(api.post.mock.calls[1][1]).toEqual({ proposal: semantic().proposal });
  expect((screen.getByLabelText('What would you like to see?') as HTMLTextAreaElement).value).toBe('Show totals');
  expect(screen.getByText('지표 1개 · 분류 0개 · 기존 지표 1개 재사용')).toBeTruthy();
  api.post.mockResolvedValueOnce(success({ id: 21 }));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledWith(21));
  expect(api.post.mock.calls[2][0]).toBe('/bi/analysis-proposals/save');
  expect(api.post.mock.calls[2][1]).toEqual({
    proposal: semantic().proposal,
    previewDigest: semantic().previewDigest,
    requestId: expect.any(String),
  });
});
it('UC012 retries a lost save response with exactly the same requestId and payload', async () => {
  const view = await creation();
  await createPreview();
  api.post.mockRejectedValueOnce(new Error('Network response lost'));
  fireEvent.click(screen.getByText('Save'));
  await screen.findByText('Network response lost');
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false);
  const first = api.post.mock.calls[2][1];
  api.post.mockResolvedValueOnce(success({ id: 21, replayed: true }));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledWith(21));
  expect(api.post.mock.calls[3][1]).toEqual(first);
});
it('UC012 invalidates save on 409 and issues a new request ID only after a fresh preview', async () => {
  await creation();
  await createPreview();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'PLAN_CHANGED' } } });
  fireEvent.click(screen.getByText('Save'));
  await screen.findByText('PLAN_CHANGED');
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  const prior = api.post.mock.calls[2][1].requestId;
  api.post.mockResolvedValueOnce(success(semantic())).mockResolvedValueOnce(success(semantic()));
  fireEvent.click(screen.getByText('Generate preview'));
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  api.post.mockResolvedValueOnce(success({ id: 22 }));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(6));
  expect(api.post.mock.calls[5][1].requestId).not.toBe(prior);
});
it('UC012 preserves the last preview and new question when a new proposal fails', async () => {
  await creation();
  await createPreview();
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Another question' } });
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  api.post.mockRejectedValueOnce(new Error('Provider failed'));
  fireEvent.click(screen.getByText('Generate preview'));
  await screen.findByText('Provider failed');
  expect(screen.getByTestId('preview')).toBeTruthy();
  expect((screen.getByLabelText('What would you like to see?') as HTMLTextAreaElement).value).toBe('Another question');
});
it('UC012 aborts cancellation and ignores late proposal completion', async () => {
  const view = await creation();
  let done: any;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        done = resolve;
      }),
  );
  await start();
  const signal = api.post.mock.calls[0][2].signal;
  fireEvent.click(screen.getByText('생성 중지'));
  expect(signal.aborted).toBe(true);
  expect(view.onClose).not.toHaveBeenCalled();
  expect((screen.getByLabelText('What would you like to see?') as HTMLTextAreaElement).value).toBe('Show totals');
  await act(async () => done(success(semantic())));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(view.onSaved).not.toHaveBeenCalled();
  expect(screen.queryByTestId('preview')).toBeNull();
});
it('UC012 rejects a preview whose server-compiled SQL differs from its displayed widgets', async () => {
  await creation();
  const result = semantic();
  result.draft = { ...draft, widgets: [{ ...widget, sql: 'SELECT 999 AS total FROM source' }] };
  api.post.mockResolvedValueOnce(success(semantic())).mockResolvedValueOnce(success(result));
  await start();
  await screen.findByText('The dashboard preview is incomplete. Please try again.');
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});

it('UC012 preserves the last valid preview when generation is stopped during preview loading', async () => {
  const view = await creation();
  await createPreview();
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Another question' } });
  let finish: any;
  api.post.mockResolvedValueOnce(success(semantic())).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByText('Generate preview'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(4));
  fireEvent.click(screen.getByText('생성 중지'));
  await act(async () => finish(success(semantic())));
  expect(view.onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('preview')).toBeTruthy();
  expect((screen.getByLabelText('What would you like to see?') as HTMLTextAreaElement).value).toBe('Another question');
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
});
it('UC012 invalidates the preview on source changes and rejects a proposal for another source', async () => {
  api.sources.mockResolvedValue(
    success([
      { id: 7, name: 'Sales', engine: 'duckdb' },
      { id: 8, name: 'Other', engine: 'duckdb' },
    ]),
  );
  await creation();
  await createPreview();
  await selectRadixOption(sourceTrigger(), 'Other');
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  api.post.mockResolvedValueOnce(success(semantic()));
  fireEvent.click(screen.getByText('Generate preview'));
  await screen.findByText('The generated dashboard is incomplete. Please try again.');
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(screen.getByTestId('preview')).toBeTruthy();
});
