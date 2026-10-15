import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MetricCalculationEditor from './MetricCalculationEditor';
import { installRadixBrowserAPIs, selectRadixOption } from './dashboardTestUtils';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: ({ dataSet }: any) => <div>{JSON.stringify(dataSet)}</div> }));
vi.mock('./MetricTrend', () => ({ default: ({ trend }: any) => <div>Trend {JSON.stringify(trend)}</div> }));
installRadixBrowserAPIs();
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
  // 실제 Radix Select는 네이티브 change 이벤트가 아니라 트리거를 열고 옵션을 골라야 값이 바뀐다.
  await selectRadixOption(screen.getByRole('combobox', { name: '집계 방식' }), '평균');
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

const impact = {
  analyses: [
    { dashboardId: 9, title: 'Analysis', revision: draft.revision, widgetIndices: [0] },
    { dashboardId: 10, title: 'Other analysis', revision: 'b'.repeat(64), widgetIndices: [0] },
  ],
  unlinked: 2,
  limit: 10,
};
const batchPreview = {
  ...preview,
  analyses: [
    { dashboardId: 9, title: 'Analysis', widgetIndices: [0], preview },
    { dashboardId: 10, title: 'Other analysis', widgetIndices: [0], preview },
  ],
};
it('UC-004 reveals linked analysis scope, previews selected targets and saves the batch', async () => {
  api.post.mockImplementation(url =>
    Promise.resolve(
      success(
        url.endsWith('/impact')
          ? impact
          : url.endsWith('/batch-preview')
          ? batchPreview
          : { id: 9, revision: 'c'.repeat(64), updatedAnalyses: [9, 10] },
      ),
    ),
  );
  const view = mount();
  fireEvent.click(screen.getByRole('button', { name: '같은 지표를 쓰는 분석 확인' }));
  await screen.findByText('영향받는 분석 · 2개');
  expect(screen.getByRole('checkbox', { name: /현재 분석/ }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('선택 2개 · 미연결 분석 2개 제외')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '계산식 미리보기' }));
  await screen.findByText('v1 → v2');
  expect(api.post.mock.calls[1][0]).toBe('/ai/metric-change/batch-preview');
  expect(api.post.mock.calls[1][1].targets).toEqual([
    { dashboardId: 9, expectedRevision: draft.revision },
    { dashboardId: 10, expectedRevision: 'b'.repeat(64) },
  ]);
  expect(screen.getByText('분석 미리보기: Other analysis · 1개 차트')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '지표·분석 일괄 저장' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith({ ...draft, revision: 'c'.repeat(64) }, 2));
});
it('UC-004 invalidates a batch preview when the target selection changes', async () => {
  api.post.mockImplementation(url => Promise.resolve(success(url.endsWith('/impact') ? impact : batchPreview)));
  mount();
  fireEvent.click(screen.getByRole('button', { name: '같은 지표를 쓰는 분석 확인' }));
  await screen.findByText('영향받는 분석 · 2개');
  fireEvent.click(screen.getByRole('button', { name: '계산식 미리보기' }));
  await screen.findByText('v1 → v2');
  fireEvent.click(screen.getByRole('checkbox', { name: /Other analysis/ }));
  expect(screen.getByRole('button', { name: '지표·분석 일괄 저장' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('선택 1개 · 미연결 분석 2개 제외')).toBeTruthy();
});

it('UC-004 refuses an incomplete batch preview rather than exposing a partial save', async () => {
  api.post.mockImplementation(url =>
    Promise.resolve(
      success(url.endsWith('/impact') ? impact : { ...batchPreview, analyses: batchPreview.analyses.slice(0, 1) }),
    ),
  );
  mount();
  fireEvent.click(screen.getByRole('button', { name: '같은 지표를 쓰는 분석 확인' }));
  await screen.findByText('영향받는 분석 · 2개');
  fireEvent.click(screen.getByRole('button', { name: '계산식 미리보기' }));
  await screen.findByText('일괄 미리보기를 모두 확인하지 못했습니다.');
  expect(screen.getByRole('button', { name: '지표·분석 일괄 저장' }).hasAttribute('disabled')).toBe(true);
});
