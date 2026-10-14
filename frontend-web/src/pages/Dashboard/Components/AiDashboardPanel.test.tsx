import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AiDashboardPanel from './AiDashboardPanel';
const api = vi.hoisted(() => ({ post: vi.fn(), sources: vi.fn() }));
vi.mock('@mui/material/styles', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material/styles');
});
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/api/databaseService', () => ({ default: { selectDatabaseList: api.sources } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options: any) => options?.defaultValue || key }),
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: ({ title }: any) => <div data-testid="preview">{title}</div> }));
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: Container,
    Stack: Container,
    DialogTitle: Container,
    DialogContent: Container,
    DialogActions: Container,
    Typography: Container,
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    Alert: Container,
    Button: ({ children, disabled, onClick }: any) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    TextField: ({ select, label, value, onChange, disabled, children }: any) =>
      select ? (
        <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>
          <option value="" />
          {children}
        </select>
      ) : (
        <textarea aria-label={label} value={value} onChange={onChange} disabled={disabled} />
      ),
    useTheme: () => ({ breakpoints: { down: () => 'xs' } }),
    useMediaQuery: () => true,
  };
});
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
beforeEach(() => {
  vi.clearAllMocks();
  api.sources.mockResolvedValue(success([{ id: 7, name: 'Sales', engine: 'duckdb' }]));
});
afterEach(cleanup);
const mount = async (extra: any = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = render(<AiDashboardPanel open onClose={onClose} onSaved={onSaved} {...extra} />);
  await waitFor(() => expect(screen.getByRole('option', { name: 'Sales' })).not.toBeNull());
  return { ...view, onClose, onSaved };
};
const start = (label = 'Generate preview') => {
  fireEvent.change(screen.getByLabelText('Data source'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('What would you like to see?'), { target: { value: 'Show totals' } });
  fireEvent.click(screen.getByText(label));
};
it('requires a valid preview and explicit Save, passes dashboardId and local-model timeout', async () => {
  api.post
    .mockResolvedValueOnce(success(draft))
    .mockResolvedValueOnce(success(preview))
    .mockResolvedValueOnce(success({ id: 99 }));
  const view = await mount({ dashboardId: 3 });
  start();
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
});
it('revises the current draft and preserves the old preview but disables stale Save on AI failure', async () => {
  api.post.mockResolvedValueOnce(success(draft)).mockResolvedValueOnce(success(preview));
  await mount({ currentDraft: draft });
  start('Revise preview');
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
  start();
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
  start();
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
  start();
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
  start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByText('Save rejected')).not.toBeNull());
  expect(view.onSaved).not.toHaveBeenCalled();
  expect(view.onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('preview')).not.toBeNull();
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
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
  await screen.findByRole('option', { name: 'Sales' });
  expect(screen.queryByRole('option', { name: 'Legacy' })).toBeNull();
  expect(screen.queryByRole('option', { name: 'Broken file' })).toBeNull();
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
  start();
  await waitFor(() => expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByTestId('preview').textContent).toBe('Total');
  if (available) expect(screen.getByRole('img', { name: 'Total 일별 추세' })).toBeTruthy();
  else expect(screen.getByText(/No temporal column is available/)).toBeTruthy();
  expect(api.post.mock.calls[1][1].includeTrends).toBe(true);
});
