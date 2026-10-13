import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardAnalysis from './DashboardAnalysis';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('./DashboardAssistant', () => ({ default: () => null }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: ({ dataSet, description }: any) => (
    <span>
      {description}
      <span>{dataSet[0].requests}</span>
    </span>
  ),
}));
// The repository's Vitest runtime cannot import the Emotion/MUI styled engine.
// Model the Select array event contract while keeping primitive menu values intact.
vi.mock('@mui/material', () => {
  const container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: container,
    Card: container,
    Stack: container,
    Typography: container,
    FormControl: container,
    InputLabel: container,
    Checkbox: ({ checked }: any) => <input type="checkbox" checked={checked} readOnly />,
    Button: ({ children, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    LinearProgress: () => <div role="progressbar" />,
    TextField: ({ label, value, onChange, type }: any) => (
      <label>
        {label}
        <input type={type} value={value} onChange={onChange} />
      </label>
    ),
    Select: ({ label, children, value, onChange, multiple, disabled, renderValue }: any) => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button role="combobox" aria-label={label} disabled={disabled} onMouseDown={() => setOpen(true)}>
            {renderValue ? renderValue(value) : value}
          </button>
          {open && (
            <div
              role="listbox"
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
              }}
            >
              {React.Children.map(children, (child: any) => (
                <div
                  role="option"
                  aria-selected={multiple ? value.includes(child.props.value) : value === child.props.value}
                  onClick={() => {
                    if (!child.props.disabled)
                      onChange({
                        target: {
                          value: multiple
                            ? value.includes(child.props.value)
                              ? value.filter((key: string) => key !== child.props.value)
                              : [...value, child.props.value]
                            : child.props.value,
                        },
                      });
                  }}
                >
                  {child.props.children}
                </div>
              ))}
            </div>
          )}
        </>
      );
    },
    MenuItem: container,
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const preview = (requests: number) => ({
  widgets: [{ type: 'BOARD_NUMERIC', title: 'Requests', valueField: 'requests', datas: [{ requests }] }],
  dimensions: [{ column: 'device_type', values: ['Mobile/Tablet', 1, '1', true, null, 'a,b'] }],
  temporalColumns: [{ column: 'created_at', min: null, max: null }],
});
const mount = async (data = preview(10)) => {
  api.get.mockResolvedValue(response({ databaseId: 3, widgets: [] }));
  api.post.mockResolvedValue(response(data));
  const view = render(
    <DashboardAnalysis dashboardId={3} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByText(String(data.widgets[0].datas[0].requests));
  return view;
};
const idle = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
const choose = async (label: string, option: string, index = 0) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option', { name: option })[index]);
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  await idle();
};
const dates = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('시작일 (UTC)'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('종료일 (UTC)'), { target: { value: end } });
};
it('preserves all primitive types, deselects values, and restores after a failed query', async () => {
  await mount();
  await choose('device_type', 'Mobile/Tablet');
  await choose('device_type', 'true');
  await choose('device_type', 'null');
  await choose('device_type', 'a,b');
  await choose('device_type', '1');
  await choose('device_type', '1', 1);
  expect(api.post.mock.lastCall?.[1].filters).toEqual([
    { column: 'device_type', values: ['Mobile/Tablet', true, null, 'a,b', 1, '1'] },
  ]);
  api.post.mockRejectedValueOnce(new Error('worker unavailable'));
  await choose('device_type', 'Mobile/Tablet');
  expect(api.post.mock.lastCall?.[1].filters[0].values).toEqual([true, null, 'a,b', 1, '1']);
  expect((await screen.findByRole('alert')).textContent).toContain('worker unavailable');
  expect(screen.getByText(/이전 조회 결과 · 현재 선택 조건 미적용/)).toBeTruthy();
  expect(screen.queryByText(/선택한 필터 적용/)).toBeNull();
  expect(screen.getByText('10')).toBeTruthy();
  fireEvent.click(screen.getByText('전체 데이터로 복구'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await idle();
  expect(screen.queryByText(/이전 조회 결과 · 현재 선택 조건 미적용/)).toBeNull();
  expect(api.post.mock.lastCall?.[1].filters).toEqual([]);
});
it('stages UTC dates, rejects partial/reversed ranges without querying, and applies all time', async () => {
  await mount();
  dates('2024-02-29', '');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('적용'));
  expect(screen.getByRole('alert').textContent).toContain('시작일과 종료일');
  expect(api.post).toHaveBeenCalledTimes(1);
  dates('2024-03-02', '2024-03-01');
  fireEvent.click(screen.getByText('적용'));
  expect(api.post).toHaveBeenCalledTimes(1);
  dates('2024-02-29', '2024-02-29');
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.lastCall?.[1].dateRange).toEqual({ column: 'created_at', start: '2024-02-29', end: '2024-02-29' });
  await idle();
  dates('', '');
  expect(api.post).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
});
it('stages multiple temporal columns and resets all applied and edited filters', async () => {
  await mount({
    ...preview(10),
    temporalColumns: [
      { column: 'created_at', min: null, max: null },
      { column: 'updated_at', min: null, max: null },
    ],
  });
  await choose('날짜 컬럼 (UTC)', 'updated_at');
  dates('2024-01-01', '2024-01-31');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post.mock.lastCall?.[1].dateRange?.column).toBe('updated_at'));
  await idle();
  await choose('device_type', 'true');
  expect(api.post.mock.lastCall?.[1].dateRange.column).toBe('updated_at');
  dates('2024-02-01', '');
  fireEvent.click(screen.getByText('적용'));
  fireEvent.click(screen.getByText('필터 초기화'));
  await waitFor(() => expect(api.post.mock.lastCall?.[1].filters).toEqual([]));
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
  expect((screen.getByLabelText('시작일 (UTC)') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('종료일 (UTC)') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('limits dimensions and offered values to five and fifty', async () => {
  await mount({
    ...preview(10),
    dimensions: Array.from({ length: 6 }, (_, i) => ({
      column: `column${i}`,
      values: Array.from({ length: 51 }, (_, j) => j),
    })),
  });
  expect(screen.getAllByRole('combobox', { name: /^column/ })).toHaveLength(5);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'column0' }));
  expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(50);
});
it.each(['error', 'success'])('ignores stale %s after switching dashboards', async outcome => {
  const view = await mount();
  let rejectOld: (reason: Error) => void = () => undefined;
  let resolveOld: (value: any) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      }),
  );
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'device_type' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'true' }));
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  api.post.mockResolvedValue(response(preview(42)));
  view.rerender(
    <DashboardAnalysis dashboardId={4} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByText('42');
  await act(async () => {
    if (outcome === 'error') rejectOld(new Error('stale error'));
    else resolveOld(response(preview(999)));
  });
  await idle();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('42')).toBeTruthy();
});

it('keeps ordinary previews without temporal metadata usable', async () => {
  await mount({ ...preview(10), temporalColumns: [] });
  expect(screen.queryByLabelText('시작일 (UTC)')).toBeNull();
  expect(screen.queryByText('적용')).toBeNull();
  await choose('device_type', 'true');
  expect(api.post.mock.lastCall?.[1].filters).toEqual([{ column: 'device_type', values: [true] }]);
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
});

it('keeps the three-widget preview visible when a one-widget revision awaits repreview', async () => {
  class RenderBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    render() {
      return this.state.error ? <div data-testid="render-error">{this.state.error.message}</div> : this.props.children;
    }
  }
  const oldDraft = {
    databaseId: 3,
    widgets: Array.from({ length: 3 }, () => ({ type: 'BOARD_NUMERIC' })),
    layoutSizes: [
      { width: 6, height: 3 },
      { width: 6, height: 5 },
      { width: 12, height: 7 },
    ],
  };
  const oldPreview = {
    ...preview(11),
    draft: oldDraft,
    widgets: [11, 22, 33].map(requests => ({ ...preview(requests).widgets[0] })),
  };
  const nextDraft = { ...oldDraft, widgets: oldDraft.widgets.slice(0, 1), layoutSizes: [{ width: 12, height: 3 }] };
  let resolveAnalysis: (value: any) => void = () => undefined;
  let resolvePreview: (value: any) => void = () => undefined;
  api.get.mockResolvedValueOnce(response(oldDraft)).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveAnalysis = resolve;
      }),
  );
  api.post.mockResolvedValueOnce(response(oldPreview)).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePreview = resolve;
      }),
  );
  const content = (revision: number) => (
    <RenderBoundary>
      <DashboardAnalysis dashboardId={3} revision={revision} onSaved={vi.fn()}>
        Fallback
      </DashboardAnalysis>
    </RenderBoundary>
  );
  const view = render(content(1));
  await screen.findByText('33');
  await idle();
  view.rerender(content(2));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveAnalysis(response(nextDraft));
  });
  // A render error must fail the test; catching it avoids an unhandled React error.
  expect(screen.queryByTestId('render-error')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByText('11')).toBeTruthy();
  expect(screen.getByText('22')).toBeTruthy();
  expect(screen.getByText('33')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await act(async () => {
    resolvePreview(response({ ...preview(44), draft: nextDraft }));
  });
  await idle();
  expect(screen.getByText('44')).toBeTruthy();
  expect(screen.queryByText('22')).toBeNull();
  expect(screen.queryByText('33')).toBeNull();
});
