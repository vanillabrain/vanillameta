import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardAssistant from './DashboardAssistant';

// Keep the real useChat/transport pipeline; replace only network and visual surfaces.
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: ({ title, dataSet }: any) => (
    <div data-testid="preview-widget">
      {title}: {JSON.stringify(dataSet)}
    </div>
  ),
}));
vi.mock('@mui/material', () => {
  const Container = React.forwardRef<HTMLElement, any>(
    ({ children, component: Tag = 'div', role, onSubmit, ...props }, ref) => (
      <Tag ref={ref} role={role} onSubmit={onSubmit} aria-label={props['aria-label']}>
        {children}
      </Tag>
    ),
  );
  return {
    Box: Container,
    Stack: Container,
    Typography: Container,
    Drawer: ({ open, children, onClose, PaperProps }: any) =>
      open ? (
        <aside aria-label={PaperProps['aria-label']}>
          <button onClick={onClose}>Drawer close</button>
          {children}
        </aside>
      ) : null,
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    LinearProgress: () => <progress />,
    Button: ({ children, disabled, onClick, type = 'button', ...props }: any) => (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        aria-label={props['aria-label']}
        aria-pressed={props['aria-pressed']}
      >
        {children}
      </button>
    ),
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    TextField: ({ select, label, value, onChange, disabled, children, inputRef }: any) =>
      select ? (
        <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>
          {children}
        </select>
      ) : (
        <textarea ref={inputRef} aria-label={label} value={value} onChange={onChange} disabled={disabled} />
      ),
    useTheme: () => ({ breakpoints: { down: () => 'md' } }),
    useMediaQuery: () => false,
  };
});

const widget = {
  title: 'Total',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT SUM(amount) AS total FROM sales',
  valueField: 'total',
  decimalPlaces: 2,
};
const original = {
  databaseId: 7,
  title: 'Original sales',
  explanation: 'Original explanation',
  widgets: [{ ...widget, sql: 'SELECT COUNT(*) AS total FROM sales' }],
};
const revised = { databaseId: 7, title: 'Revised sales', explanation: 'Server verified revision', widgets: [widget] };
const preview = { draft: revised, widgets: [{ ...widget, fields: [{ name: 'total' }], datas: [{ total: 42 }] }] };
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const base = {
  open: true,
  dashboardId: 9,
  draft: original,
  filters: [],
  dateRange: { start: '2026-01-01', end: '2026-02-01' },
};
beforeEach(() => api.post.mockReset());
afterEach(cleanup);
const mount = () => {
  const onApplied = vi.fn();
  const onClose = vi.fn();
  return { ...render(<DashboardAssistant {...base} onApplied={onApplied} onClose={onClose} />), onApplied, onClose };
};
const requestEdit = () => {
  fireEvent.click(screen.getByRole('button', { name: '대시보드 수정', exact: true }));
  fireEvent.change(screen.getByLabelText('대시보드 수정 요청'), { target: { value: 'Use total sales' } });
  fireEvent.click(screen.getByRole('button', { name: '미리보기 요청' }));
};
const ready = async () => {
  await waitFor(() => expect(screen.getByRole('button', { name: '변경 적용' }).hasAttribute('disabled')).toBe(false));
};
const queuePreview = () => api.post.mockResolvedValueOnce(success(revised)).mockResolvedValueOnce(success(preview));

it('renders a real SDK answer and its evidence without saving anything', async () => {
  api.post.mockResolvedValueOnce(success({ answer: 'Total sales are 42.', context: { sql: widget.sql, rows: 1 } }));
  const view = mount();
  fireEvent.change(screen.getByLabelText('데이터에 질문하기'), { target: { value: 'What are total sales?' } });
  fireEvent.click(screen.getByRole('button', { name: '보내기' }));
  await screen.findByText('Total sales are 42.');
  expect(screen.getByText(/"rows": 1/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe('/ai/dashboard-assistant');
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '변경 적용' })).toBeNull();
});

it('requires explicit apply, retains a failed save proposal for retry, and undoes the exact previous draft', async () => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  expect(screen.getByTestId('preview-widget').textContent).toContain('42');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(view.onApplied).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce({ data: { status: 'ERROR', message: 'Save rejected' } });
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await screen.findByText('Save rejected');
  expect(screen.getByTestId('preview-widget')).toBeTruthy();
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(view.onClose).not.toHaveBeenCalled();
  await ready();
  api.post.mockResolvedValueOnce(success({ id: 9 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith(revised));
  expect(api.post.mock.calls.filter(call => call[0] === '/ai/dashboard-save').map(call => call[1])).toEqual([
    { dashboardId: 9, draft: revised },
    { dashboardId: 9, draft: revised },
  ]);
  view.rerender(<DashboardAssistant {...base} draft={revised} onApplied={view.onApplied} onClose={view.onClose} />);
  api.post.mockResolvedValueOnce(success({ id: 9 }));
  fireEvent.click(screen.getByRole('button', { name: '이전 변경 되돌리기' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenLastCalledWith(original));
  expect(api.post).toHaveBeenLastCalledWith('/ai/dashboard-save', { dashboardId: 9, draft: original }, { timeout: 180000 });
  expect(screen.queryByRole('button', { name: '이전 변경 되돌리기' })).toBeNull();
});

it.each([
  ['filters', { filters: [{ column: 'region', values: ['EU'] }] }],
  ['date range', { dateRange: { start: '2026-02-01', end: '2026-03-01' } }],
  ['draft', { draft: { ...original, title: 'Changed externally' } }],
  ['dashboard', { dashboardId: 10 }],
])('blocks a proposal after %s changes', async (_name, changed) => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  view.rerender(<DashboardAssistant {...base} {...changed} onApplied={view.onApplied} onClose={view.onClose} />);
  await screen.findByText('화면 조건이 바뀌었습니다. 새 미리보기를 요청해 주세요.');
  const apply = screen.getByRole('button', { name: '변경 적용' });
  expect(apply.hasAttribute('disabled')).toBe(true);
  fireEvent.click(apply);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(view.onApplied).not.toHaveBeenCalled();
});

it('blocks a proposal when the selected chart changes', async () => {
  queuePreview();
  mount();
  requestEdit();
  await ready();
  fireEvent.change(screen.getByLabelText('분석할 차트'), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: '변경 적용' }).hasAttribute('disabled')).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(2);
});

it('never offers apply for an incomplete server preview', async () => {
  api.post.mockResolvedValueOnce(success(revised)).mockResolvedValueOnce(success({ ...preview, widgets: [] }));
  const view = mount();
  requestEdit();
  await screen.findByText('미리보기를 검증하지 못했습니다.');
  expect(screen.queryByRole('button', { name: '변경 적용' })).toBeNull();
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(2);
});

it('ignores a stopped request even if its API response arrives late', async () => {
  let resolve!: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = mount();
  fireEvent.change(screen.getByLabelText('데이터에 질문하기'), { target: { value: 'Slow question' } });
  fireEvent.click(screen.getByRole('button', { name: '보내기' }));
  await screen.findByRole('button', { name: '응답 중단' });
  fireEvent.click(screen.getByRole('button', { name: '응답 중단' }));
  await act(async () => resolve(success({ answer: 'Late answer' })));
  await screen.findByRole('button', { name: '보내기' });
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
  expect(screen.queryByText('Late answer')).toBeNull();
  expect(view.onApplied).not.toHaveBeenCalled();
});

it('marks a late proposal stale when query context changes during generation', async () => {
  let resolve!: (value: unknown) => void;
  api.post.mockResolvedValueOnce(success(revised)).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const view = mount();
  requestEdit();
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  const filters = [{ column: 'region', values: ['APAC'] }];
  view.rerender(<DashboardAssistant {...base} filters={filters} onApplied={view.onApplied} onClose={view.onClose} />);
  await act(async () => resolve(success(preview)));
  await screen.findByText('화면 조건이 바뀌었습니다. 새 미리보기를 요청해 주세요.');
  expect(screen.getByRole('button', { name: '변경 적용' }).hasAttribute('disabled')).toBe(true);
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(2);
});

it('submits one save while applying, and retains undo after a failed revert', async () => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  let resolve!: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const apply = screen.getByRole('button', { name: '변경 적용' });
  fireEvent.click(apply);
  fireEvent.click(apply);
  fireEvent.click(screen.getByRole('button', { name: 'Drawer close' }));
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(view.onClose).not.toHaveBeenCalled();
  expect(view.onApplied).not.toHaveBeenCalled();
  await act(async () => resolve(success({ id: 9 })));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith(revised));
  view.rerender(<DashboardAssistant {...base} draft={revised} onApplied={view.onApplied} onClose={view.onClose} />);
  api.post.mockRejectedValueOnce(new Error('Undo failed'));
  fireEvent.click(screen.getByRole('button', { name: '이전 변경 되돌리기' }));
  await screen.findByText('Undo failed');
  expect(view.onApplied).toHaveBeenCalledTimes(1);
  const undo = screen.getByRole('button', { name: '이전 변경 되돌리기' });
  await waitFor(() => expect(undo.hasAttribute('disabled')).toBe(false));
  api.post.mockResolvedValueOnce(success({ id: 9 }));
  fireEvent.click(undo);
  await waitFor(() => expect(view.onApplied).toHaveBeenLastCalledWith(original));
  expect(api.post.mock.calls.filter(call => call[0] === '/ai/dashboard-save').map(call => call[1].draft)).toEqual([
    revised,
    original,
    original,
  ]);
});

it('does not accept a save response for another dashboard and allows retry', async () => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  api.post.mockResolvedValueOnce(success({ id: 99 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await screen.findByText('변경을 저장하지 못했습니다.');
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(screen.getByTestId('preview-widget')).toBeTruthy();
  await ready();
  api.post.mockResolvedValueOnce(success({ id: 9 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith(revised));
});

it('blocks undo after a subsequent dashboard revision', async () => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  api.post.mockResolvedValueOnce(success({ id: 9 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await waitFor(() => expect(view.onApplied).toHaveBeenCalledWith(revised));
  view.rerender(
    <DashboardAssistant
      {...base}
      draft={{ ...revised, title: 'Later edit' }}
      onApplied={view.onApplied}
      onClose={view.onClose}
    />,
  );
  const undo = screen.getByRole('button', { name: '이전 변경 되돌리기' });
  expect(undo.hasAttribute('disabled')).toBe(true);
  fireEvent.click(undo);
  expect(api.post).toHaveBeenCalledTimes(3);
});

it('sends the loaded revision on apply and the new revision on undo', async () => {
  queuePreview();
  const onApplied = vi.fn();
  const view = render(
    <DashboardAssistant
      {...base}
      draft={{ ...original, revision: 'a'.repeat(64) }}
      onApplied={onApplied}
      onClose={vi.fn()}
    />,
  );
  requestEdit();
  await ready();
  api.post.mockResolvedValueOnce(success({ id: 9, revision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await waitFor(() => expect(onApplied).toHaveBeenCalledWith({ ...revised, revision: 'b'.repeat(64) }));
  expect(api.post.mock.calls[2][1].expectedRevision).toBe('a'.repeat(64));
  view.rerender(
    <DashboardAssistant
      {...base}
      draft={{ ...revised, revision: 'b'.repeat(64) }}
      onApplied={onApplied}
      onClose={vi.fn()}
    />,
  );
  api.post.mockResolvedValueOnce(success({ id: 9, revision: 'c'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '이전 변경 되돌리기' }));
  await waitFor(() => expect(onApplied).toHaveBeenLastCalledWith({ ...original, revision: 'c'.repeat(64) }));
  expect(api.post.mock.calls[3][1].expectedRevision).toBe('b'.repeat(64));
});
it('shows a server conflict and blocks stale writes until the latest screen is loaded', async () => {
  queuePreview();
  const view = mount();
  requestEdit();
  await ready();
  api.post.mockRejectedValueOnce({
    response: { status: 409, data: { success: false, code: 409, data: '대시보드가 다른 화면에서 변경되었습니다.' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
  await screen.findByText('대시보드가 다른 화면에서 변경되었습니다.');
  expect(screen.getByRole('button', { name: '최신 화면 불러오기' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '변경 적용' }).hasAttribute('disabled')).toBe(true);
  expect(view.onApplied).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(3);
});

it('period context forwards grain and comparison to question transport and shows both in the toolbar', async () => {
  api.post.mockResolvedValueOnce(
    success({
      answer: '검증된 비교 답변',
      context: { comparison: { previous: { start: '2025-11-30', end: '2025-12-31' } } },
    }),
  );
  render(<DashboardAssistant {...base} trendGrain="week" comparePrevious onApplied={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText(/집계 단위: 주별 · 이전 기간 비교: 사용/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('데이터에 질문하기'), { target: { value: '이전 기간과 비교해 주세요' } });
  fireEvent.click(screen.getByRole('button', { name: '보내기' }));
  await screen.findByText('검증된 비교 답변');
  expect(api.post).toHaveBeenCalledWith(
    '/ai/dashboard-assistant',
    expect.objectContaining({ trendGrain: 'week', comparePrevious: true, dateRange: base.dateRange }),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(screen.getByText(/2025-11-30/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it.each([{ trendGrain: 'month' }, { comparePrevious: true }])(
  'period context includes %j in the proposal fingerprint and blocks stale apply',
  async changed => {
    queuePreview();
    const view = mount();
    requestEdit();
    await ready();
    expect(api.post.mock.calls[0][1]).toMatchObject({ trendGrain: 'auto', comparePrevious: false });
    expect(api.post.mock.calls[1][1]).toMatchObject({ trendGrain: 'auto', comparePrevious: false });
    view.rerender(<DashboardAssistant {...base} {...changed} onApplied={view.onApplied} onClose={view.onClose} />);
    await screen.findByText('화면 조건이 바뀌었습니다. 새 미리보기를 요청해 주세요.');
    fireEvent.click(screen.getByRole('button', { name: '변경 적용' }));
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(view.onApplied).not.toHaveBeenCalled();
  },
);

it('period context forwards selected settings to draft and preview without model settings', async () => {
  queuePreview();
  render(<DashboardAssistant {...base} trendGrain="day" comparePrevious onApplied={vi.fn()} onClose={vi.fn()} />);
  requestEdit();
  await ready();
  for (const [url, body] of api.post.mock.calls) {
    expect(['/ai/dashboard-draft', '/ai/dashboard-preview']).toContain(url);
    expect(body).toMatchObject({ trendGrain: 'day', comparePrevious: true, dateRange: base.dateRange, filters: [] });
    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('settings');
  }
});
