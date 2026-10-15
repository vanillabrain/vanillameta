import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardEdit from './index';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), id: '8' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ dashboardId: api.id }), useNavigate: () => api.navigate }));
vi.mock('@/widget/modules/board/NumericBoard', () => ({ default: () => <div>숫자 미리보기</div> }));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({ default: () => <div>차트 미리보기</div> }));
vi.mock('@/components/analysis/AnalysisUi', () => ({
  AnalysisUiProvider: ({ children }: any) => <>{children}</>,
  analysisToggleSx: {},
  ANALYSIS_UI: { fontSize: 12, controlHeight: 28, radius: 4, border: '#e2e8f0', surface: '#f8fafc' },
}));
vi.mock('react-grid-layout', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  WidthProvider: (component: any) => component,
}));
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
  savedDefinition: {
    title: '기존 계산',
    description: '',
    type: 'BOARD_NUMERIC',
    sql: 'SELECT SUM(amount) AS value FROM source',
    valueField: 'value',
  },
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
  editMode: 'content',
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
it('edits independent screen layouts and restores coordinates through undo', async () => {
  api.get.mockResolvedValueOnce(
    success({
      ...editor,
      items: [
        {
          ...item,
          layouts: {
            mobile: { x: 0, y: 0, w: 4, h: 3 },
            tablet: { x: 0, y: 0, w: 4, h: 3 },
            desktop: { x: 0, y: 0, w: 6, h: 3 },
          },
        },
      ],
    }),
  );
  await mount();
  fireEvent.click(within(screen.getByRole('radiogroup', { name: '편집할 화면 폭' })).getByLabelText('모바일'));
  fireEvent.change(screen.getByLabelText('1번 차트 모바일 세로 위치'), { target: { value: '5' } });
  await requestPreview();
  expect(api.post.mock.calls[0][1].items[0].layouts).toMatchObject({ mobile: { y: 5 }, desktop: { y: 0 } });
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect((screen.getByLabelText('1번 차트 모바일 세로 위치') as HTMLInputElement).value).toBe('0');
});
it('applies AI to the unsaved draft and shares undo/redo and save transport with direct edits', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '미저장 제목' } });
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균으로 변경' } });
  api.post.mockResolvedValueOnce(success(aiResult()));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
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
  api.get.mockResolvedValueOnce(success({ ...editor, dashboardId: 9 }));
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

it('UC-017 keeps existing dimensions and locks retry until an uncertain save is checked', async () => {
  api.get.mockResolvedValueOnce(success({ ...editor, items: [{ ...item, chart: 'bar', dimension: 'category' }] }));
  await mount();
  await requestPreview();
  expect(api.post.mock.calls[0][1].items[0]).toMatchObject({ kind: 'existing', chart: 'bar', dimension: 'category' });
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('기존 계산');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
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

it('keyboard layout changes preserve results and other breakpoints but require preview again before save', async () => {
  const layouts = {
    mobile: { x: 0, y: 0, w: 4, h: 3 },
    tablet: { x: 0, y: 0, w: 8, h: 3 },
    desktop: { x: 0, y: 0, w: 6, h: 3 },
  };
  api.get.mockResolvedValueOnce(success({ ...editor, items: [{ ...item, layouts }] }));
  await mount();
  await requestPreview();
  fireEvent.keyDown(screen.getByRole('button', { name: '기존 계산 배치 이동' }), { key: 'ArrowDown' });
  expect(screen.getByRole('cell', { name: '12345678901234567890.12' })).not.toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole('button', { name: '기존 계산 배치 이동' }), { key: 'ArrowRight', shiftKey: true });
  await requestPreview();
  expect(api.post.mock.calls[1][1].items[0].layouts).toEqual({ ...layouts, desktop: { x: 0, y: 1, w: 7, h: 3 } });
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  await requestPreview();
  expect(api.post.mock.calls[2][1].items[0].layouts.desktop).toEqual({ x: 0, y: 1, w: 6, h: 3 });
  fireEvent.change(screen.getByLabelText('1번 차트 단위'), { target: { value: '달러' } });
  expect(screen.queryByRole('cell', { name: '12345678901234567890.12' })).toBeNull();
});

it('UC-011 sends layout intent and applies geometry only through common undo history', async () => {
  const layouts = { mobile: { x: 0, y: 0, w: 4, h: 3 }, desktop: { x: 0, y: 0, w: 6, h: 3 } };
  api.get.mockResolvedValueOnce(success({ ...editor, items: [{ ...item, layouts }] }));
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.click(screen.getByText('변경 목적 직접 지정'));
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'AI 변경 목적' })).getByLabelText('배치'));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '오른쪽 한 칸 옮겨 줘' } });
  api.post.mockResolvedValueOnce(
    success({
      item: { ...item, title: 'must ignore content change', layouts: { ...layouts, desktop: { x: 1, y: 0, w: 6, h: 3 } } },
      editMode: 'layout',
      preview: preview(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect(api.post.mock.calls[0][1]).toMatchObject({ editMode: 'layout', layoutMode: 'desktop', selectedKey: 'old' });
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(item.title);
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  await requestPreview();
  expect(api.post.mock.calls[1][1].items[0].layouts).toEqual(layouts);
  fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
  await requestPreview();
  expect(api.post.mock.calls[2][1].items[0].layouts).toEqual({ ...layouts, desktop: { x: 1, y: 0, w: 6, h: 3 } });
});

it('UC-011 keeps the current draft after a rejected layout proposal and leaves save disabled', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.click(screen.getByText('변경 목적 직접 지정'));
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'AI 변경 목적' })).getByLabelText('배치'));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '겹치는 위치로 이동' } });
  api.post.mockRejectedValueOnce({ response: { status: 400 } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText(/AI 변경을 적용하지 못했습니다/);
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(item.title);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

it('TC-011-07 preserves duplicate identity across direct/content/layout edits and four-step history', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 복제' }));
  document.querySelectorAll('details').forEach(element => {
    element.open = true;
  });
  fireEvent.change(screen.getByLabelText('2번 차트 제목'), { target: { value: '연속 편집' } });
  fireEvent.click(screen.getByRole('button', { name: '2번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 1자리' } });
  let copyKey = '';
  let generated: any;
  api.post.mockImplementationOnce(async (_url, body) => {
    copyKey = body.items[1].key;
    expect(body.items[1]).toMatchObject({ copyOf: 'old', title: '연속 편집' });
    generated = {
      ...body.items[1],
      kind: 'draft',
      copyOf: undefined,
      decimalPlaces: 1,
      definition: {
        title: '연속 편집',
        description: '',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM(amount) AS value FROM source',
        valueField: 'value',
        decimalPlaces: 1,
      },
    };
    return success({ item: generated, editMode: 'content', preview: preview(2) });
  });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByText('변경 목적 직접 지정'));
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'AI 변경 목적' })).getByLabelText('배치'));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '세로 위치 30' } });
  api.post.mockImplementationOnce(async (_url, body) => {
    expect(body.items[1]).toMatchObject({ key: copyKey, kind: 'draft', decimalPlaces: 1 });
    expect(body.items[1].copyOf).toBeUndefined();
    return success({
      item: { ...generated, layouts: { desktop: { x: 0, y: 30, w: 6, h: 3 } } },
      editMode: 'layout',
      preview: preview(2),
    });
  });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'AI 요청 실행' }) as HTMLButtonElement).disabled).toBe(false),
  );
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(screen.queryByRole('heading', { name: /^2번 차트 ·/ })).toBeNull();
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
  expect(screen.getByRole('heading', { name: '2번 차트 · 연속 편집' })).not.toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  await requestPreview(2);
  const body = api.post.mock.calls[2][1];
  expect(body.items[0]).toMatchObject({ key: 'old', kind: 'existing', title: item.title });
  expect(body.items[1]).toMatchObject({
    key: copyKey,
    kind: 'draft',
    decimalPlaces: 1,
    definition: generated.definition,
    layouts: { desktop: { x: 0, y: 30, w: 6, h: 3 } },
  });
  api.post.mockResolvedValueOnce(success({ id: 8 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
});

it('does not repeat an earlier AI success announcement after the next request fails', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균으로 변경' } });
  api.post.mockResolvedValueOnce(success(aiResult()));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByRole('heading', { name: '1번 차트 · AI 평균' });
  expect(screen.getByRole('status').textContent).toContain('내용 AI 변경을 미리보기했습니다');
  api.post.mockRejectedValueOnce({ response: { status: 400 } });
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '다시 변경' } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(screen.getByRole('status').textContent).not.toContain('내용 AI 변경을 미리보기했습니다');
  expect(screen.getByRole('heading', { name: '1번 차트 · AI 평균' })).not.toBeNull();
  expect((screen.getByLabelText('AI 변경 요청') as HTMLInputElement).value).toBe('다시 변경');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

it('UC-013 defaults to auto, asks to clarify without changing the draft, and applies returned layout without mode selection', async () => {
  const layouts = { desktop: { x: 0, y: 0, w: 6, h: 3 } };
  api.get.mockResolvedValueOnce(success({ ...editor, items: [{ ...item, layouts }] }));
  render(<DashboardEdit />);
  await screen.findByLabelText('대시보드 제목');
  expect(document.querySelector('details')?.open).toBe(false);
  document.querySelectorAll('details').forEach(element => {
    if (!element.querySelector('summary')?.textContent?.includes('직접 지정')) element.open = true;
  });
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '내용과 위치를 함께 바꿔 줘' } });
  api.post.mockResolvedValueOnce(success({ editMode: 'clarify' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('구체적으로 질문'));
  expect(api.post.mock.calls[0][1]).toMatchObject({ editMode: 'auto', layoutMode: 'desktop' });
  expect(api.post.mock.calls[0][2]).toMatchObject({ timeout: 180000, signal: expect.any(AbortSignal) });
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('AI 변경 요청') as HTMLInputElement).value).toBe('내용과 위치를 함께 바꿔 줘');
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '오른쪽 한 칸' } });
  api.post.mockResolvedValueOnce(
    success({ item: { ...item, layouts: { desktop: { x: 1, y: 0, w: 6, h: 3 } } }, editMode: 'layout', preview: preview() }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('배치'));
  expect((screen.getByLabelText('1번 차트 데스크톱 가로 위치') as HTMLInputElement).value).toBe('1');
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
});

it('UC-014 saves the current draft after a save-only preview without selecting a block', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '직접 수정한 초안' } });
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '현재 편집 내용을 저장해 줘' } });
  api.post.mockResolvedValueOnce(success({ editMode: 'save', saveRequested: true, preview: preview() }));
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'next' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls[1][0]).toBe('/bi/dashboards/8/editor');
  expect(api.post.mock.calls[1][1]).toMatchObject({ title: '직접 수정한 초안', expectedRevision: editor.revision });
});

it('UC-017 freezes AI result then checks latest state before save retry', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '평균으로 바꾸고 저장해 줘' } });
  api.post.mockResolvedValueOnce(success({ ...aiResult(), saveRequested: true }));
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText(
    '변경 결과는 미리보기했지만 저장 결과를 확인하지 못했습니다. 현재 초안은 유지됩니다. 최신 저장 상태를 확인한 뒤 다시 시도해 주세요.',
  );
  expect(api.post.mock.calls[1][1].items[0]).toMatchObject({
    title: 'AI 평균',
    kind: 'draft',
    definition: aiResult().item.definition,
  });
  expect(api.navigate).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '1번 차트 · AI 평균' })).not.toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(false);
  api.get.mockResolvedValueOnce(success(editor));
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  fireEvent.click(await screen.findByRole('button', { name: '내 변경과 최신본 합치기' }));
  await requestPreview();
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'next' }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post.mock.calls[3][1].items[0]).toMatchObject({ title: 'AI 평균', definition: aiResult().item.definition });
});

it('UC-014 cancellation before preview response prevents the requested follow-up save', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '현재 초안을 저장해 줘' } });
  let resolve: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByRole('button', { name: 'AI 요청 취소' });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 취소' }));
  await act(async () => resolve(success({ editMode: 'save', saveRequested: true, preview: preview() })));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.navigate).not.toHaveBeenCalled();
});

it('UC-014 locks duplicate submission during save and reports a conflict without losing the draft', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '충돌해도 유지할 초안' } });
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '현재 초안 저장' } });
  api.post.mockResolvedValueOnce(success({ editMode: 'save', saveRequested: true, preview: preview() }));
  let reject: (reason: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('질문한 변경 결과 저장 중…'));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: 'AI 요청 취소' })).toBeNull();
  await act(async () => reject({ response: { status: 409 } }));
  await screen.findByText('다른 변경이 저장되었습니다. 현재 초안은 유지됩니다. 최신 내용을 다시 불러와 주세요.');
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('충돌해도 유지할 초안');
  expect(api.navigate).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

it.each([
  { editMode: 'save', saveRequested: false, preview: preview() },
  { editMode: 'save', saveRequested: true, preview: { widgets: [] } },
  { editMode: 'clarify', saveRequested: true, preview: preview() },
])('UC-014 never saves an invalid plan or preview %#', async result => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '현재 초안 저장' } });
  api.post.mockResolvedValueOnce(success(result));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.navigate).not.toHaveBeenCalled();
});

it.each(['content', 'layout'])('UC-014 successfully saves a %s change through the new session token', async editMode => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '선택 블록 변경 후 저장해 줘' } });
  const layoutItem = { ...item, layouts: { desktop: { x: 1, y: 0, w: 6, h: 3 } } };
  api.post.mockResolvedValueOnce(
    success({ ...aiResult(), ...(editMode === 'layout' ? { item: layoutItem } : {}), editMode, saveRequested: true }),
  );
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'next' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.navigate).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[1][2].signal.aborted).toBe(false);
  expect(api.post.mock.calls[1][1].items[0]).toMatchObject(
    editMode === 'layout' ? { layouts: layoutItem.layouts } : { title: 'AI 평균', definition: aiResult().item.definition },
  );
});

it('UC-014 refuses an AI item that fails the manual presentation validation before saving', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '변경 후 저장' } });
  const result = aiResult();
  api.post.mockResolvedValueOnce(
    success({ ...result, item: { ...result.item, unit: '1234567890123' }, saveRequested: true }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
});

it('UC-015 applies and saves a server-resolved target without a prior block selection', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '1번 차트를 평균으로 바꾸고 저장해 줘' } });
  api.post.mockResolvedValueOnce(success({ ...aiResult(), targetKey: item.key, saveRequested: true }));
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'next' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post.mock.calls[0][1].selectedKey).toBe('');
  expect(api.post.mock.calls[1][1].items[0]).toMatchObject({ key: item.key, title: 'AI 평균' });
});

it('UC-015 keeps an ambiguous question intact and confirms only after a candidate click and resubmit', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 3자리로 바꾸고 저장해 줘' } });
  api.post.mockResolvedValueOnce(
    success({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: [{ key: item.key, title: item.title, position: 1 }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  const candidate = await screen.findByRole('button', { name: '1번 · 기존 계산' });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(candidate);
  expect(api.post).toHaveBeenCalledTimes(1);
  api.post.mockResolvedValueOnce(success({ ...aiResult(), targetKey: item.key, saveRequested: false }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByRole('heading', { name: '1번 차트 · AI 평균' });
  expect(api.post.mock.calls[1][1]).toMatchObject({ prompt: '소수 3자리로 바꾸고 저장해 줘', targetChoiceKey: item.key });
  expect(api.navigate).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '1번 · 기존 계산' })).toBeNull();
  expect(screen.getByText('선택 블록: AI 평균')).not.toBeNull();
  api.post.mockResolvedValueOnce(success({ editMode: 'clarify', saveRequested: false }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  expect(api.post.mock.calls[2][1]).not.toHaveProperty('targetChoiceKey');
});

it('UC-015 invalidates a confirmed candidate when the question is edited', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 3자리' } });
  api.post.mockResolvedValueOnce(
    success({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: [{ key: item.key, title: item.title, position: 1 }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  fireEvent.click(await screen.findByRole('button', { name: '1번 · 기존 계산' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '현재 초안 저장' } });
  expect(screen.queryByRole('button', { name: '1번 · 기존 계산' })).toBeNull();
  api.post.mockResolvedValueOnce(success({ editMode: 'clarify', saveRequested: false }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).not.toHaveProperty('targetChoiceKey');
});

it('UC-015 refuses a foreign server target before applying or saving', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '1번 수정 후 저장' } });
  api.post.mockResolvedValueOnce(
    success({ ...aiResult(), targetKey: 'foreign', item: { ...aiResult().item, key: 'foreign' }, saveRequested: true }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: '1번 차트 · 기존 계산' })).not.toBeNull();
});

it('UC-015 clears a confirmed candidate after a direct draft edit instead of using it as stale selection', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 3자리' } });
  api.post.mockResolvedValueOnce(
    success({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: [{ key: item.key, title: item.title, position: 1 }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  fireEvent.click(await screen.findByRole('button', { name: '1번 · 기존 계산' }));
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '직접 편집' } });
  api.post.mockResolvedValueOnce(success({ editMode: 'clarify', saveRequested: false }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).not.toHaveProperty('targetChoiceKey');
  expect(api.post.mock.calls[1][1].selectedKey).toBe('');
});

it.each([
  { targetCandidates: [{ key: 'foreign', title: '외부', position: 1 }] },
  {
    targetCandidates: [
      { key: item.key, title: item.title, position: 1 },
      { key: item.key, title: item.title, position: 1 },
    ],
  },
  { targetCandidates: [] },
  { targetCandidates: [null] },
])('UC-015 rejects malformed candidates %# without presenting an unsafe choice', async ({ targetCandidates }) => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 변경' } });
  api.post.mockResolvedValueOnce(success({ editMode: 'clarify', saveRequested: false, targetCandidates }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(screen.queryByRole('region', { name: '수정 대상 후보' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('UC-015 uses a different resolved block instead of the old selected context and preserves the old item', async () => {
  const other = { ...item, key: 'other', title: '다른 블록' };
  api.get.mockResolvedValueOnce(success({ ...editor, items: [item, other] }));
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '1번 차트 AI로 수정' }));
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '2번 차트 수정 후 저장' } });
  const changed = { ...aiResult().item, key: 'other', definition: { ...aiResult().item.definition, blockId: 'other' } };
  api.post.mockResolvedValueOnce(
    success({ item: changed, targetKey: 'other', editMode: 'content', saveRequested: true, preview: preview(2) }),
  );
  api.post.mockResolvedValueOnce(success({ id: 8, revision: 'next' }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post.mock.calls[1][1].items[0]).toMatchObject({ key: item.key, title: item.title, kind: 'existing' });
  expect(api.post.mock.calls[1][1].items[1]).toMatchObject({ key: 'other', title: 'AI 평균', kind: 'draft' });
});

it('UC-015 distinguishes a rejected confirmation from the initial target question', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 변경' } });
  const clarify = success({
    editMode: 'clarify',
    saveRequested: false,
    targetCandidates: [{ key: item.key, title: item.title, position: 1 }],
  });
  api.post.mockResolvedValueOnce(clarify);
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  fireEvent.click(await screen.findByRole('button', { name: '1번 · 기존 계산' }));
  api.post.mockResolvedValueOnce(clarify);
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('선택한 대상을 확인하지 못했습니다'));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.navigate).not.toHaveBeenCalled();
});

it('UC-015 rejects a clarify plan that claims to save despite offering candidates', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '소수 변경 후 저장' } });
  api.post.mockResolvedValueOnce(
    success({
      editMode: 'clarify',
      saveRequested: true,
      targetCandidates: [{ key: item.key, title: item.title, position: 1 }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
  await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.navigate).not.toHaveBeenCalled();
});

const batchFixture = () => {
  const originals = [item, { ...item, key: 'second', title: '두 번째' }, { ...item, key: 'third', title: '유지' }];
  const changes = originals.slice(0, 2).map((original, index) => ({
    targetKey: original.key,
    editMode: 'content' as const,
    item: {
      ...original,
      kind: 'draft' as const,
      title: `일괄 ${index + 1}`,
      decimalPlaces: index + 3,
      definition: {
        title: `일괄 ${index + 1}`,
        description: '',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM(amount) AS value FROM source',
        valueField: 'value',
        decimalPlaces: index + 3,
      },
    },
  }));
  api.get.mockResolvedValueOnce(success({ ...editor, items: originals }));
  return { originals, result: { editMode: 'batch', saveRequested: false, changes, preview: preview(3) } };
};
const askBatch = () => {
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '1번 차트와 2번 차트를 변경해 줘' } });
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 실행' }));
};
it('UC-016 applies all changes as one undo/redo entry, preserves the third block, and saves all frozen items', async () => {
  const { originals, result } = batchFixture();
  await mount();
  api.post.mockResolvedValueOnce(success(result));
  askBatch();
  await screen.findByRole('heading', { name: '2번 차트 · 일괄 2' });
  expect(screen.getByText('전체 변경 2개 · 함께 저장할 수 있습니다')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(originals[0].title);
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe(originals[1].title);
  expect(screen.queryByText('전체 변경 2개 · 함께 저장할 수 있습니다')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('일괄 1');
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe('일괄 2');
  await requestPreview(3);
  api.post.mockResolvedValueOnce(success({ id: 8 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post.mock.calls[2][1].items[2]).toMatchObject({
    key: originals[2].key,
    kind: originals[2].kind,
    title: originals[2].title,
    decimalPlaces: originals[2].decimalPlaces,
    unit: originals[2].unit,
    width: originals[2].width,
    height: originals[2].height,
  });
  expect(api.post.mock.calls[2][1].items.slice(0, 2).map(value => value.decimalPlaces)).toEqual([3, 4]);
});
it('UC-016 explicit save posts the newly validated batch once, never stale state', async () => {
  const { result } = batchFixture();
  await mount();
  api.post.mockResolvedValueOnce(success({ ...result, saveRequested: true }));
  api.post.mockResolvedValueOnce(success({ id: 8 }));
  askBatch();
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls[1][1].items.map(value => value.title)).toEqual(['일괄 1', '일괄 2', '유지']);
});
it.each(['duplicate', 'unknown', 'invalid-definition', 'invalid-preview', 'invalid-layout', 'null-change'])(
  'UC-016 rejects an entire malformed batch (%s) with no history or save',
  async variant => {
    const { originals, result } = batchFixture();
    if (variant === 'duplicate') result.changes[1] = result.changes[0];
    if (variant === 'unknown') result.changes[1].targetKey = 'unknown';
    if (variant === 'invalid-definition') result.changes[1].item.definition.sql = '';
    if (variant === 'invalid-preview') result.preview.widgets = [];
    if (variant === 'invalid-layout')
      Object.assign(result.changes[1], {
        editMode: 'layout',
        item: { ...result.changes[1].item, layouts: { desktop: { x: -1, y: 0, w: 6, h: 3 } } },
      });
    if (variant === 'null-change') result.changes[1] = null;
    await mount();
    api.post.mockResolvedValueOnce(success({ ...result, saveRequested: true }));
    askBatch();
    await screen.findByText('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
    expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(originals[0].title);
    expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe(originals[1].title);
    expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.navigate).not.toHaveBeenCalled();
  },
);
it('UC-016 reports second-block failure, preserves draft and question, then retries the entire request', async () => {
  const { originals, result } = batchFixture();
  await mount();
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { success: false, code: 400, data: { batchFailure: { stage: 'change', position: 2 } } } },
  });
  askBatch();
  await screen.findByText(
    '2번 블록의 변경에 실패했습니다. 모든 변경을 적용하지 않았습니다. 질문을 수정한 뒤 다시 실행해 주세요.',
  );
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(originals[0].title);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('AI 변경 요청') as HTMLInputElement).value).toContain('1번 차트');
  api.post.mockResolvedValueOnce(success(result));
  askBatch();
  await screen.findByRole('heading', { name: '2번 차트 · 일괄 2' });
  expect(screen.queryByText(/모든 변경을 적용하지 않았습니다/)).toBeNull();
});
it('UC-016 layout results cannot overwrite other-width layouts, content or an untargeted block', async () => {
  const { result } = batchFixture();
  const mobile = { x: 0, y: 0, w: 4, h: 3 };
  const desktop = { x: 0, y: 5, w: 6, h: 3 };
  const originals = [
    item,
    { ...item, key: 'second', title: '두 번째', layouts: { mobile, desktop } },
    { ...item, key: 'third', title: '유지' },
  ];
  api.get.mockReset().mockResolvedValueOnce(success({ ...editor, items: originals }));
  Object.assign(result.changes[1], {
    editMode: 'layout',
    item: { ...originals[1], title: 'untrusted', layouts: { mobile: { ...mobile, y: 99 }, desktop: { ...desktop, y: 6 } } },
  });
  await mount();
  api.post.mockResolvedValueOnce(success(result));
  askBatch();
  await screen.findByRole('heading', { name: '1번 차트 · 일괄 1' });
  await requestPreview(3);
  expect(api.post.mock.calls[1][1].items[1]).toMatchObject({
    title: '두 번째',
    layouts: { mobile, desktop: { ...desktop, y: 6 } },
  });
  expect(api.post.mock.calls[1][1].items[2]).toMatchObject({
    key: originals[2].key,
    kind: originals[2].kind,
    title: originals[2].title,
    decimalPlaces: originals[2].decimalPlaces,
    unit: originals[2].unit,
    width: originals[2].width,
    height: originals[2].height,
  });
});

it('UC-017 retains the batch after uncertain save and requires state check before retry', async () => {
  const { result } = batchFixture();
  await mount();
  api.post.mockResolvedValueOnce(success({ ...result, saveRequested: true }));
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  askBatch();
  await screen.findByText(
    '변경 결과는 미리보기했지만 저장 결과를 확인하지 못했습니다. 현재 초안은 유지됩니다. 최신 저장 상태를 확인한 뒤 다시 시도해 주세요.',
  );
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('일괄 1');
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe('일괄 2');
  expect(api.navigate).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(
    success({
      ...editor,
      items: [item, { ...item, key: 'second', title: '두 번째' }, { ...item, key: 'third', title: '유지' }],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  await screen.findByRole('button', { name: '내 변경과 최신본 합치기' });
  fireEvent.click(screen.getByRole('button', { name: '내 변경과 최신본 합치기' }));
  await requestPreview(3);
  api.post.mockResolvedValueOnce(success({ id: 8 }));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/8'));
  expect(api.post.mock.calls[3][1].items.map(value => value.title)).toEqual(['일괄 1', '일괄 2', '유지']);
});
it('UC-016 discards all late batch results after cancellation without history or save', async () => {
  const { originals, result } = batchFixture();
  await mount();
  let complete: (value: unknown) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  askBatch();
  fireEvent.click(screen.getByRole('button', { name: 'AI 요청 취소' }));
  await act(async () => {
    complete(success({ ...result, saveRequested: true }));
  });
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe(originals[0].title);
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe(originals[1].title);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.navigate).not.toHaveBeenCalled();
});
it('UC-016 batch save conflict retains both edits and requires latest-state recovery', async () => {
  const { result } = batchFixture();
  await mount();
  api.post.mockResolvedValueOnce(success({ ...result, saveRequested: true }));
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  askBatch();
  await screen.findByText('다른 변경이 저장되었습니다. 현재 초안은 유지됩니다. 최신 내용을 다시 불러와 주세요.');
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('일괄 1');
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe('일괄 2');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.navigate).not.toHaveBeenCalled();
});
it('UC-016 manual save reads layout guidance through the real HTTP error envelope and preserves all changes', async () => {
  const { result } = batchFixture();
  await mount();
  api.post.mockResolvedValueOnce(success(result));
  askBatch();
  await screen.findByRole('heading', { name: '2번 차트 · 일괄 2' });
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { success: false, code: 400, data: '블록 배치가 겹칩니다.' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByText('블록 배치가 겹칩니다.');
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('일괄 1');
  expect((screen.getByLabelText('2번 차트 제목') as HTMLInputElement).value).toBe('일괄 2');
  expect(api.navigate).not.toHaveBeenCalled();
});
it('UC-016 an identical batch does not claim changes or add an undo entry', async () => {
  const { originals, result } = batchFixture();
  const current = [...result.changes.map(value => value.item), originals[2]];
  api.get.mockReset().mockResolvedValueOnce(success({ ...editor, items: current }));
  await mount();
  api.post.mockResolvedValueOnce(success(result));
  askBatch();
  await screen.findByText('요청 결과가 현재 초안과 같습니다. 변경 없이 전체 미리보기했습니다.');
  expect(screen.queryByText('전체 변경 2개 · 함께 저장할 수 있습니다')).toBeNull();
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
});

it('UC-017 merges local title with remote non-target change after a real-shaped 409 without clearing the question', async () => {
  const second = { ...item, key: 'second', title: '두 번째' };
  api.get.mockResolvedValueOnce(success({ ...editor, items: [item, second] }));
  await mount();
  fireEvent.change(screen.getByLabelText('AI 변경 요청'), { target: { value: '초안 질문 유지' } });
  fireEvent.change(screen.getByLabelText('1번 차트 제목'), { target: { value: '내 제목' } });
  await requestPreview(2);
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('내 제목');
  api.get.mockResolvedValueOnce(
    success({ ...editor, revision: 'b'.repeat(64), items: [item, { ...second, unit: '달러' }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  fireEvent.click(await screen.findByRole('button', { name: '내 변경과 최신본 합치기' }));
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('내 제목');
  expect((screen.getByLabelText('2번 차트 단위') as HTMLInputElement).value).toBe('달러');
  expect((screen.getByLabelText('AI 변경 요청') as HTMLInputElement).value).toBe('초안 질문 유지');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '되돌리기' }) as HTMLButtonElement).disabled).toBe(true);
  await requestPreview(2);
  expect(api.post.mock.calls[2][1].expectedRevision).toBe('b'.repeat(64));
});
it('UC-017 same-field conflict requires explicit local choice and retains other server fields', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('1번 차트 제목'), { target: { value: '내 제목' } });
  await requestPreview();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  api.get.mockResolvedValueOnce(
    success({ ...editor, revision: 'b'.repeat(64), items: [{ ...item, title: '최신 제목', unit: 'USD' }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  await screen.findByRole('button', { name: '충돌 항목에 내 변경 사용' });
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('내 제목');
  expect(screen.queryByRole('button', { name: '내 변경과 최신본 합치기' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '충돌 항목에 내 변경 사용' }));
  expect((screen.getByLabelText('1번 차트 제목') as HTMLInputElement).value).toBe('내 제목');
  expect((screen.getByLabelText('1번 차트 단위') as HTMLInputElement).value).toBe('USD');
});
it('UC-017 lost committed response is resolved by GET and never repeats a write', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '저장된 제목' } });
  await requestPreview();
  api.post.mockRejectedValueOnce({ code: 'ECONNABORTED' });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  expect((screen.getByRole('button', { name: 'AI 요청 실행' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(success({ ...editor, title: '저장된 제목', revision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  fireEvent.click(await screen.findByRole('button', { name: '저장된 화면 보기' }));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.navigate).toHaveBeenCalledWith('/dashboard/8');
});
it('UC-017 failed check preserves draft and lock; a subsequent edit invalidates its comparison', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '보존할 제목' } });
  await requestPreview();
  api.post.mockRejectedValueOnce(new Error('lost'));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  api.get.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  await screen.findByText('저장 상태를 확인하지 못했습니다. 초안과 질문은 유지됩니다. 상태 확인을 다시 시도해 주세요.');
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('보존할 제목');
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(success({ ...editor, title: '보존할 제목', revision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  await screen.findByRole('button', { name: '저장된 화면 보기' });
  fireEvent.change(screen.getByLabelText('대시보드 제목'), { target: { value: '다시 편집' } });
  expect(screen.queryByRole('button', { name: '저장된 화면 보기' })).toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it('UC-017 structural conflict never offers automatic merge and keeps local blocks', async () => {
  await mount();
  await requestPreview();
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  api.get.mockResolvedValueOnce(
    success({ ...editor, revision: 'b'.repeat(64), items: [item, { ...item, key: 'new', title: '새 블록' }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  await screen.findByText(
    '블록 구성이나 순서가 달라 자동으로 합칠 수 없습니다. 초안은 유지됩니다. 최신본을 확인한 뒤 다시 편집해 주세요.',
  );
  expect(screen.queryByRole('button', { name: '내 변경과 최신본 합치기' })).toBeNull();
  expect(screen.queryByRole('heading', { name: /^2번 차트/ })).toBeNull();
});
it('UC-017 definite validation rejection is distinct from unknown save and keeps draft editable', async () => {
  await mount();
  await requestPreview();
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { success: false, code: 400, data: 'valueField must be numeric' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByText('저장 요청이 거절되었습니다. 초안은 유지됩니다. 입력과 미리보기를 확인해 주세요.');
  expect(screen.queryByRole('button', { name: '저장 상태 확인' })).toBeNull();
  expect((screen.getByRole('button', { name: '변경 내용 저장' }) as HTMLButtonElement).disabled).toBe(false);
});
it('UC-017 ignores a state-check response from the previous dashboard route', async () => {
  const view = await mount();
  await requestPreview();
  api.post.mockRejectedValueOnce(new Error('lost'));
  fireEvent.click(screen.getByRole('button', { name: '변경 내용 저장' }));
  await screen.findByRole('button', { name: '저장 상태 확인' });
  let complete: (value: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '저장 상태 확인' }));
  api.id = '9';
  api.get.mockResolvedValueOnce(success({ ...editor, dashboardId: 9, title: '새 화면' }));
  view.rerender(<DashboardEdit />);
  await waitFor(() => expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('새 화면'));
  await act(async () => {
    complete(success({ ...editor, title: '묵은 응답' }));
  });
  expect((screen.getByLabelText('대시보드 제목') as HTMLInputElement).value).toBe('새 화면');
  expect(screen.queryByRole('button', { name: '저장된 화면 보기' })).toBeNull();
});
