import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MetricCalculationEditor from './MetricCalculationEditor';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@mui/material/styles', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material/styles');
});
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: Container,
    Stack: Container,
    Typography: Container,
    DialogContent: Container,
    DialogActions: Container,
    DialogTitle: Container,
    Dialog: ({ open, children }: any) => (open ? <section role="dialog">{children}</section> : null),
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    Button: ({ children, disabled, onClick }: any) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    TextField: ({ label, value, onChange, disabled, children }: any) => (
      <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
    ),
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    useMediaQuery: () => false,
    useTheme: () => ({ breakpoints: { down: () => 'sm' } }),
  };
});
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: ({ dataSet }: any) => <div>{JSON.stringify(dataSet)}</div> }));
vi.mock('./MetricTrend', () => ({ default: ({ trend }: any) => <div>Trend {JSON.stringify(trend)}</div> }));
const success = (data: any) => ({ data: { status: 'SUCCESS', data } });
const widget = {
  title: 'Revenue',
  description: '',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT AVG(amount) AS value FROM source',
  valueField: 'value',
};
const draft = { databaseId: 7, title: 'Analysis', explanation: '', widgets: [widget], revision: 'a'.repeat(64) };
const metric = { id: 3, label: 'Saved revenue', definitionVersion: 1, definition: { aggregation: 'SUM', column: 'amount' } };
const preview = {
  draft,
  widgets: [{ ...widget, datas: [{ value: 15 }], fields: [{ name: 'value' }], trend: { datas: [{ value: 10 }] } }],
  metric: { id: 3, definitionVersion: 1, nextVersion: 2, previousExpression: 'SUM("amount")', expression: 'AVG("amount")' },
};
beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset().mockResolvedValue(success({ columns: [{ name: 'amount', numeric: true }] }));
});
afterEach(cleanup);
function mount() {
  const onApplied = vi.fn();
  const onClose = vi.fn();
  return {
    ...render(
      <MetricCalculationEditor
        open
        metric={metric}
        selectedWidget={0}
        draft={draft}
        dashboardId={9}
        filters={[]}
        trendGrain="auto"
        comparePrevious={false}
        onApplied={onApplied}
        onClose={onClose}
      />,
    ),
    onApplied,
    onClose,
  };
}
async function showPreview() {
  await waitFor(() => expect(screen.getByRole('button', { name: '계산식 미리보기' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '계산식 미리보기' }));
  await screen.findByText('v1 → v2');
}
it('UC-003 previews calculation and trend without saving; saves both with optimistic versions', async () => {
  api.post.mockResolvedValueOnce(success(preview)).mockResolvedValueOnce(success({ id: 9, revision: 'b'.repeat(64) }));
  const view = mount();
  await showPreview();
  expect(api.post.mock.calls[0][0]).toBe('/ai/metric-change/preview');
  expect(api.post.mock.calls[0][1]).toMatchObject({
    expectedRevision: draft.revision,
    expectedDefinitionVersion: 1,
    metricId: 3,
    selectedWidget: 0,
  });
  expect(screen.getByText(/Trend/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '지표·분석 저장' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith({ ...draft, revision: 'b'.repeat(64) }));
  expect(api.post.mock.calls[1][0]).toBe('/ai/metric-change/save');
});
it('invalidates a preview after a calculation change', async () => {
  api.post.mockResolvedValue(success(preview));
  mount();
  await showPreview();
  fireEvent.change(screen.getByRole('combobox', { name: '집계 방식' }), { target: { value: 'AVG' } });
  expect(screen.getByRole('button', { name: '지표·분석 저장' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText(/조건이 바뀌었습니다/)).toBeTruthy();
});
it('does not apply a conflicting save and clears its preview', async () => {
  api.post
    .mockResolvedValueOnce(success(preview))
    .mockRejectedValueOnce({ response: { status: 409, data: { message: '지표 계산식이 변경되었습니다.' } } });
  const view = mount();
  await showPreview();
  fireEvent.click(screen.getByRole('button', { name: '지표·분석 저장' }));
  await screen.findByText('지표 계산식이 변경되었습니다.');
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '지표·분석 저장' }).hasAttribute('disabled')).toBe(true);
});
