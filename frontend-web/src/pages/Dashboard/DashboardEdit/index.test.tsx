import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardEdit from './index';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), id: '8' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ dashboardId: api.id }), useNavigate: () => api.navigate }));
vi.mock('@/widget/modules/board/NumericBoard', () => ({ default: () => <div>숫자 미리보기</div> }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div>차트 미리보기</div> }));
vi.mock('@/components/analysis/AnalysisUi', () => ({ AnalysisUiProvider: ({ children }: any) => <>{children}</> }));
vi.mock('../Components/MetricTrend', () => ({ default: () => <div>시계열 미리보기</div> }));

vi.mock('@mui/material', async () => {
  const ReactUI = await import('react');
  const Disabled = ReactUI.createContext(false);
  const Group = ReactUI.createContext<any>(null);
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: ({ component: Tag = 'div', children, disabled, ...props }: any) => (
      <Tag disabled={disabled} role={props.role} tabIndex={props.tabIndex} aria-label={props['aria-label']}>
        {children}
      </Tag>
    ),
    Stack: Container,
    Card: Container,
    Alert: Container,
    Typography: ReactUI.forwardRef(({ component: Tag = 'p', children, role, tabIndex, ...props }: any, ref: any) => (
      <Tag ref={ref} tabIndex={tabIndex} role={role} aria-live={props['aria-live']}>
        {children}
      </Tag>
    )),
    Button: ({ children, disabled, onClick, ...props }: any) => (
      <button disabled={disabled} onClick={onClick} aria-label={props['aria-label']}>
        {children}
      </button>
    ),
    TextField: ({ label, value, onChange, disabled }: any) => (
      <label>
        {label}
        <input value={value} onChange={onChange} disabled={disabled} />
      </label>
    ),
    FormControl: ({ children, disabled }: any) => (
      <Disabled.Provider value={!!disabled}>
        <fieldset disabled={disabled}>{children}</fieldset>
      </Disabled.Provider>
    ),
    FormLabel: ({ id, children }: any) => <span id={id}>{children}</span>,
    InputLabel: ({ id, children }: any) => <span id={id}>{children}</span>,
    Select: ({ children, labelId, value, onChange }: any) => {
      const disabled = ReactUI.useContext(Disabled);
      return (
        <select aria-labelledby={labelId} aria-disabled={disabled} disabled={disabled} value={value} onChange={onChange}>
          {children}
        </select>
      );
    },
    MenuItem: ({ children, value, disabled }: any) => (
      <option value={value} disabled={disabled}>
        {children}
      </option>
    ),
    Radio: () => null,
    RadioGroup: ({ children, value, onChange, ...props }: any) => (
      <Group.Provider value={{ value, onChange }}>
        <div role="radiogroup" aria-labelledby={props['aria-labelledby']}>
          {children}
        </div>
      </Group.Provider>
    ),
    FormControlLabel: ({ value, label }: any) => {
      const disabled = ReactUI.useContext(Disabled);
      const group = ReactUI.useContext(Group);
      return (
        <label>
          <input type="radio" value={value} checked={group.value === value} disabled={disabled} onChange={group.onChange} />
          {label}
        </label>
      );
    },
    Dialog: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
    DialogTitle: Container,
    DialogContent: Container,
    DialogActions: Container,
  };
});

const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const item = {
  key: 'old',
  kind: 'existing',
  title: '기존 계산',
  chart: 'number',
  metricId: 99,
  metricAvailable: false,
  unit: '원',
  decimalPlaces: 2,
  numberNotation: 'plain',
  width: 6,
  height: 3,
};
const editor = {
  dashboardId: 8,
  title: '내 대시보드',
  sourceId: 1,
  revision: 'a'.repeat(64),
  profile: {
    name: '파일',
    supported: true,
    status: 'ready',
    columns: [
      { name: 'category', type: 'VARCHAR', numeric: false, temporal: false },
      { name: 'date', type: 'DATE', numeric: false, temporal: true },
      { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
    ],
  },
  metrics: [{ id: 10, label: '매출', definition: { unit: '원', decimalPlaces: 0, numberNotation: 'compact' } }],
  items: [item],
};
const preview = (count = 1) => ({
  draft: {},
  widgets: Array.from({ length: count }, () => ({
    title: '기존 계산',
    type: 'BOARD_NUMERIC',
    valueField: 'value',
    decimalPlaces: 2,
    numberNotation: 'full',
    datas: [{ value: '12345678901234567890.12' }],
  })),
});
beforeEach(() => {
  vi.clearAllMocks();
  api.id = '8';
  api.get.mockResolvedValue(success(editor));
});
afterEach(cleanup);
const mount = async () => {
  const view = render(<DashboardEdit />);
  await screen.findByLabelText('대시보드 제목');
  document.querySelectorAll('details').forEach(element => {
    element.open = true;
  });
  return view;
};
const choose = (label: string, option: string) => {
  const element = screen.getByRole('combobox', { name: label });
  const target = within(element).getByRole('option', { name: option }) as HTMLOptionElement;
  fireEvent.change(element, { target: { value: target.value } });
};
const requestPreview = async (count = 1) => {
  api.post.mockResolvedValueOnce(success(preview(count)));
  fireEvent.click(screen.getByRole('button', { name: '변경 결과 미리보기' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
};
it('preserves deleted-metric fallback SQL, sends revision and invalidates preview on formatting changes', async () => {
  await mount();
  expect(
    (within(screen.getByRole('radiogroup', { name: '1번 차트 종류' })).getByLabelText('막대') as HTMLInputElement).disabled,
  ).toBe(true);
  await requestPreview();
  expect(screen.getByRole('cell', { name: '12345678901234567890.12' })).not.toBeNull();
  const body = api.post.mock.calls[0][1];
  expect(body.expectedRevision).toBe(editor.revision);
  expect(body.items[0]).toMatchObject({ key: 'old', kind: 'existing', width: 6, height: 3 });
  expect(JSON.stringify(body)).not.toContain('sql');
  expect(body.items[0].metricId).toBeUndefined();
  fireEvent.change(screen.getByLabelText('1번 차트 단위'), { target: { value: '달러' } });
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('cell', { name: '12345678901234567890.12' })).toBeNull();
});

it('duplicates a SQL block, restores edits through undo/redo and invalidates preview', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 복제' }));
  await requestPreview(2);
  const copied = api.post.mock.calls[0][1].items[1];
  expect(copied).toMatchObject({ kind: 'existing', copyOf: 'old', title: '기존 계산 복사' });
  expect(copied.key).not.toBe('old');
  expect(JSON.stringify(copied)).not.toContain('sql');
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(screen.queryByRole('heading', { name: '2번 차트 · 기존 계산 복사' })).toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
  expect(screen.getByRole('heading', { name: '2번 차트 · 기존 계산 복사' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '2번 차트 삭제' }));
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  await requestPreview(2);
  expect(api.post.mock.calls[1][1].items[1].key).toBe(copied.key);
});

it('undos title and size, clears redo on new edits and resets history after explicit reload', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '새 제목' } });
  fireEvent.click(within(screen.getByRole('radiogroup', { name: '1번 차트 너비' })).getByLabelText('전체'));
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(
    (within(screen.getByRole('radiogroup', { name: '1번 차트 너비' })).getByLabelText('절반') as HTMLInputElement).checked,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe(editor.title);
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '다른 변경' } });
  expect((screen.getByRole('button', { name: '다시 실행' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: '편집 내용 버리고 다시 불러오기' }));
  await waitFor(() => expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe(editor.title));
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
});

it('starts with optional settings collapsed and keeps block actions visible', async () => {
  render(<DashboardEdit />);
  await screen.findByLabelText('대시보드 제목');
  expect(document.querySelector('details')?.open).toBe(false);
  expect(screen.getByRole('button', { name: '1번 차트 복제' })).not.toBeNull();
});

const aiResult = () => ({
  item: {
    ...item,
    kind: 'draft',
    title: 'AI 평균',
    definition: {
      title: 'AI 평균',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT AVG(amount) AS value FROM source',
      valueField: 'value',
    },
  },
  preview: preview(),
});
it('applies AI to the unsaved draft and shares undo/redo and save transport with direct edits', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '미저장 제목' } });
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균으로 변경' } });
  api.post.mockResolvedValueOnce(success(aiResult()));
  fireEvent.click(screen.getByRole('button', { name: 'AI 변경 미리보기' }));
  await screen.findByRole('heading', { name: '1번 차트 · AI 평균' });
  expect(api.post.mock.calls[0][1]).toMatchObject({
    title: '미저장 제목',
    selectedKey: 'old',
    expectedRevision: editor.revision,
  });
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('미저장 제목');
  fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
  await requestPreview();
  expect(api.post.mock.calls[1][1].items[0]).toMatchObject({ kind: 'draft', definition: aiResult().item.definition });
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
});

it('cancels AI without losing the working draft or applying a late reply', async () => {
  await mount();
  let resolveAi: (value: unknown) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveAi = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균으로 변경' } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 변경 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 취소' }));
  await act(async () => {
    resolveAi(success(aiResult()));
  });
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
  expect(screen.queryByRole('heading', { name: '1번 차트 · AI 평균' })).toBeNull();
});
it('drops obsolete AI replies on route change and prevents duplicate requests', async () => {
  const view = await mount();
  let resolveAi: (value: unknown) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveAi = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균 변경' } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 변경 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 변경 미리보기' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  api.id = '9';
  view.rerender(<DashboardEdit />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveAi(success(aiResult()));
  });
  expect(screen.queryByRole('heading', { name: '1번 차트 · AI 평균' })).toBeNull();
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
});
it('converts through saved metric and restricts line dimensions to native date columns', async () => {
  await mount();
  choose('1번 차트 저장된 지표로 전환', '매출');
  fireEvent.click(within(screen.getByRole('radiogroup', { name: '1번 차트 종류' })).getByLabelText('선'));
  expect((screen.getByRole('button', { name: '변경 결과 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  choose('1번 차트 날짜 열', 'date');
  await requestPreview();
  expect(api.post.mock.calls[0][1].items[0]).toMatchObject({
    kind: 'metric',
    metricId: 10,
    chart: 'line',
    dimension: 'date',
    unit: '원',
    decimalPlaces: 2,
    numberNotation: 'plain',
  });
});
it('retains draft on conflict and reloads only after explicit discard confirmation', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '저장할 초안' } });
  await requestPreview();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: '/server/private/path' } } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByText(/다른 변경이 저장되어/);
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('저장할 초안');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('/server/private/path')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
  fireEvent.click(screen.getByRole('button', { name: '편집 계속하기' }));
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
  api.get.mockResolvedValueOnce(success({ ...editor, title: '최신 저장 내용' }));
  fireEvent.click(screen.getByRole('button', { name: '편집 내용 버리고 다시 불러오기' }));
  await waitFor(() => expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('최신 저장 내용'));
});
it('moves stable keys, retains keyboard context, announces order and enforces 1–6 chart bounds', async () => {
  await mount();
  expect((screen.getByRole('button', { name: '1번 차트 삭제' }) as HTMLButtonElement).disabled).toBe(true);
  choose('추가할 저장된 지표', '매출');
  fireEvent.click(screen.getByRole('button', { name: '지표 차트 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '2번 차트 위로 이동' }));
  await waitFor(() => expect(document.activeElement?.textContent).toBe('1번 차트 · 매출'));
  expect(screen.getByRole('status').textContent).toContain('1번째로 이동');
  for (let count = 2; count < 6; count += 1) fireEvent.click(screen.getByRole('button', { name: '지표 차트 추가' }));
  expect((screen.getByRole('button', { name: '지표 차트 추가' }) as HTMLButtonElement).disabled).toBe(true);
  await requestPreview(6);
  expect(api.post.mock.calls[0][1].items[1].key).toBe('old');
});
it('prevents duplicate requests, drops old replies on route change and navigates after save', async () => {
  const view = await mount();
  let resolvePreview: (value: unknown) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePreview = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 결과 미리보기' }));
  expect(screen.getByRole('combobox', { name: '1번 차트 저장된 지표로 전환' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '변경 결과 미리보기' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  api.id = '9';
  view.rerender(<DashboardEdit />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => resolvePreview(success(preview())));
  expect(screen.queryByRole('cell', { name: '12345678901234567890.12' })).toBeNull();
  await requestPreview();
  api.post.mockResolvedValueOnce(success({ id: 9, revision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/9'));
});

it('drops obsolete save responses after navigation and prevents double save requests', async () => {
  const view = await mount();
  await requestPreview();
  let resolveSave: (value: unknown) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveSave = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  expect(api.post).toHaveBeenCalledTimes(2);
  api.id = '9';
  view.rerender(<DashboardEdit />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => resolveSave(success({ id: 8, revision: 'old' })));
  expect(api.navigate).not.toHaveBeenCalled();
});

it('keeps existing dimensions and draft on ordinary save failure, then allows a deliberate retry', async () => {
  api.get.mockResolvedValueOnce(success({ ...editor, items: [{ ...item, chart: 'bar', dimension: 'category' }] }));
  await mount();
  await requestPreview();
  expect(api.post.mock.calls[0][1].items[0]).toMatchObject({ kind: 'existing', chart: 'bar', dimension: 'category' });
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByText(/저장하지 못했습니다/);
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('기존 계산');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(false);
});

it.each([
  [0, '1번 차트 · 둘째'],
  [1, '2번 차트 · 셋째'],
  [2, '2번 차트 · 둘째'],
])(
  'deleting chart %i focuses the next surviving heading or previous, keeps minimum one and clears route announcements',
  async (index, expectedHeading) => {
    api.get.mockResolvedValueOnce(
      success({
        ...editor,
        items: ['첫째', '둘째', '셋째'].map((title, position) => ({ ...item, key: `chart-${position}`, title })),
      }),
    );
    const view = await mount();
    const button = screen.getByRole('button', { name: `${Number(index) + 1}번 차트 삭제` });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: String(expectedHeading) })));
    expect(screen.getByRole('status').textContent).toContain('전체 2개');
    fireEvent.click(screen.getByRole('button', { name: '2번 차트 삭제' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: /^1번 차트/ })));
    expect((screen.getByRole('button', { name: '1번 차트 삭제' }) as HTMLButtonElement).disabled).toBe(true);
    api.id = '9';
    view.rerender(<DashboardEdit />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''));
  },
);
