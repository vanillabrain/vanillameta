import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceExplore from './SourceExplore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), search: 'sourceId=3' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => api.navigate,
  useSearchParams: () => [new URLSearchParams(api.search)],
}));
vi.mock('@/pages/Dashboard/Components/MetricTrend', () => ({
  default: ({ title, trend }: any) => (
    <div data-testid="trend" data-timezone={trend?.timeZone ?? 'UTC'} data-points={trend?.points?.length ?? 0}>
      {title} 추세
    </div>
  ),
}));
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: ({ component: Tag = 'div', children, ...props }: any) => (
      <Tag role={props.role} aria-label={props['aria-label']} id={props.id}>
        {children}
      </Tag>
    ),
    Stack: Container,
    Card: Container,
    Divider: () => <hr />,
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    Typography: ({ component: Tag = 'p', children, role }: any) => <Tag role={role}>{children}</Tag>,
    Button: ({
      children,
      disabled,
      onClick,
      'aria-label': ariaLabel,
      'aria-pressed': pressed,
      'aria-expanded': expanded,
    }: any) => (
      <button aria-label={ariaLabel} aria-pressed={pressed} aria-expanded={expanded} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Chip: ({ label, onDelete }: any) => (
      <span>
        {label}
        {onDelete && (
          <button aria-label={`삭제 ${label}`} onClick={onDelete}>
            삭제
          </button>
        )}
      </span>
    ),
    Checkbox: ({ checked, onChange, inputProps }: any) => (
      <input type="checkbox" aria-label={inputProps?.['aria-label']} checked={checked} onChange={onChange} />
    ),
    FormControlLabel: ({ control, label }: any) => (
      <label>
        {control}
        {label}
      </label>
    ),
    // Emulate MUI: a select only becomes a native <select> when the caller asks for it.
    // Raw <option> children inside a non-native MUI Select are inert, so any test that
    // drives the control by change fails unless the component passes native: true.
    TextField: ({ label, select, type, value, onChange, disabled, children, placeholder, slotProps }: any) => {
      const native = slotProps?.select?.native === true;
      return (
        <label>
          {label}
          {select ? (
            native ? (
              <select aria-label={label} data-native="true" value={value} onChange={onChange} disabled={disabled}>
                {children}
              </select>
            ) : (
              <span role="combobox" aria-label={label} data-native="false">
                {children}
              </span>
            )
          ) : (
            <input
              aria-label={label}
              type={type || 'text'}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              disabled={disabled}
            />
          )}
        </label>
      );
    },
  };
});

const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const conflict = () => Object.assign(new Error('source revision mismatch'), { response: { status: 409 } });

const catalog = {
  sourceId: 3,
  name: 'rill-auction',
  sourceRevision: 'rev-3',
  rowCount: '1391572',
  measures: [
    { id: 1, label: 'Total Requests', definitionVersion: 1, definition: { unit: '', decimalPlaces: 0 } },
    { id: 2, label: 'Avg Bid Floor', definitionVersion: 1, definition: { unit: '$', decimalPlaces: 2 } },
    { id: 3, label: 'Rows', definitionVersion: 1, definition: { unit: '', decimalPlaces: 0 } },
    { id: 4, label: 'Other', definitionVersion: 1, definition: {} },
  ],
  dimensions: [
    { column: 'device_type', type: 'VARCHAR', numeric: false, temporal: false },
    { column: 'device_os', type: 'VARCHAR', numeric: false, temporal: false },
    { column: 'bid_floor', type: 'DOUBLE', numeric: true, temporal: false },
    { column: 'bid_request_cnt', type: 'DOUBLE', numeric: true, temporal: false },
  ],
  temporalColumns: [{ column: '__time', min: '2023-09-01', max: '2023-09-30' }],
};
const queryResult = (over: Record<string, unknown> = {}) => ({
  sourceRevision: 'rev-3',
  kpis: [
    {
      id: 1,
      title: 'Total Requests',
      value: '634513000',
      trend: { points: [{ time: '2023-09-10T00:00:00Z', value: '69127400' }], timeZone: 'UTC' },
    },
    {
      id: 2,
      title: 'Avg Bid Floor',
      value: 5.5712386765268835,
      trend: { points: [{ time: '2023-09-10T00:00:00Z', value: 4.606 }] },
    },
    { id: 3, title: 'Rows', value: '1234567890123456789' },
  ],
  leaderboards: [
    {
      column: 'device_type',
      rows: [
        { category: 'Mobile/Tablet', value: '307763000' },
        { category: null, value: '1530400' },
      ],
      truncated: false,
    },
    { column: 'device_os', rows: [{ category: 'Android', value: '283985400' }], truncated: true },
  ],
  applied: { filters: [], trendGrain: 'day', comparePrevious: false },
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  api.search = 'sourceId=3';
  api.get.mockImplementation(async (url: string) =>
    success(
      url === '/bi/sources'
        ? [
            { id: 3, name: 'rill-auction' },
            { id: 4, name: 'other' },
          ]
        : [],
    ),
  );
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog')
      return success({ ...catalog, sourceId: body.sourceId, sourceRevision: `rev-${body.sourceId}` });
    if (url === '/bi/explore/values') {
      return success({
        values: ['Mobile/Tablet', 'Personal Computer'],
        truncated: false,
        sourceRevision: body.sourceRevision,
      });
    }
    if (url === '/bi/explore/query') {
      return success({
        ...queryResult(),
        sourceRevision: body.sourceRevision,
        ...(body.includeRows
          ? {
              details: {
                rows: [{ device_type: 'Mobile/Tablet', requests: '307763000' }],
                totalRows: '1391572',
                page: body.page,
                pageSize: 20,
              },
            }
          : {}),
      });
    }
    return success({});
  });
});
afterEach(cleanup);

const queries = () => api.post.mock.calls.filter(([url]) => url === '/bi/explore/query');
const lastQuery = () => queries().pop()?.[1] as any;
const lastValues = () => api.post.mock.calls.filter(([url]) => url === '/bi/explore/values').pop()?.[1] as any;
const mount = async () => {
  render(<SourceExplore />);
  await waitFor(() => expect(lastQuery()).toBeTruthy());
  await act(async () => undefined);
};
const openSettings = () => fireEvent.click(screen.getByRole('button', { name: /표시 설정/ }));

it('loads the catalog and queries with default selections over all data', async () => {
  await mount();
  expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/catalog')[1]).toEqual({ sourceId: 3 });
  expect(lastQuery()).toEqual({
    sourceId: 3,
    sourceRevision: 'rev-3',
    measureIds: [1, 2, 3],
    dimensionColumns: ['device_type', 'device_os'],
    rankingMeasureId: 1,
    rankingSort: { by: 'value', direction: 'desc' },
    filters: [],
    trendGrain: 'day',
    comparePrevious: false,
    page: 0,
    pageSize: 20,
    includeRows: false,
  });
  expect(screen.getAllByText(/지표 3 \/ 4/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/차원 2 \/ 4/).length).toBeGreaterThan(0);
  expect(screen.getByText('634,513,000')).not.toBeNull();
  expect(screen.getByText('$5.57')).not.toBeNull();
  expect(screen.getByText('1,234,567,890,123,456,789')).not.toBeNull();
  expect(screen.getAllByText('Mobile/Tablet').length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: '필터 적용: device_type = (값 없음)' })).not.toBeNull();
});

it('renders the source and filter-column selects as native selects so option choices apply', async () => {
  await mount();
  const source = screen.getByLabelText('데이터 소스') as HTMLSelectElement;
  expect(source.tagName).toBe('SELECT');
  expect(source.getAttribute('data-native')).toBe('true');
  fireEvent.change(source, { target: { value: '4' } });
  await waitFor(() => expect(lastQuery().sourceId).toBe(4));
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  const column = screen.getByLabelText('필터 열') as HTMLSelectElement;
  expect(column.tagName).toBe('SELECT');
  expect(column.getAttribute('data-native')).toBe('true');
  fireEvent.change(column, { target: { value: 'device_os' } });
  await waitFor(() =>
    expect(api.post.mock.calls.some(([url, body]) => url === '/bi/explore/values' && body.column === 'device_os')).toBe(
      true,
    ),
  );
});

it('serializes grain, compare toggle, custom dateRange and timeZone into the query payload', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '집계 단위 주' }));
  await waitFor(() => expect(lastQuery().trendGrain).toBe('week'));
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(lastQuery().comparePrevious).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  await waitFor(() =>
    expect(lastQuery().dateRange).toEqual({ column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'UTC' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '표시 시간대 Asia/Seoul' }));
  await waitFor(() => expect(lastQuery().dateRange.timeZone).toBe('Asia/Seoul'));
  expect(lastQuery().page).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
  await waitFor(() => expect(lastQuery().dateRange).toBeUndefined());
  expect(lastQuery().comparePrevious).toBe(false);
  expect((screen.getByRole('button', { name: '이전 기간 비교' }) as HTMLButtonElement).disabled).toBe(true);
});

it('applies a distinct null filter from a leaderboard category', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 적용: device_type = (값 없음)' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'device_type', values: [null] }]));
  expect(screen.getByText('device_type: (값 없음)')).not.toBeNull();
  expect(lastQuery().page).toBe(0);
});

it('formats leaderboard values with the ranking measure unit and renders an explicit compare line', async () => {
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query')
      return success(
        queryResult({
          sourceRevision: 'rev-3',
          leaderboards: [
            {
              column: 'device_type',
              rows: [
                {
                  category: 'Mobile/Tablet',
                  value: 5.5712386765268835,
                  previousValue: 4.606,
                  delta: 0.965,
                  percentChange: 20.96,
                },
                { category: 'Personal Computer', value: 3.2, previousValue: null, delta: null, percentChange: null },
                { category: 'Tablet', value: 1.5 },
              ],
              truncated: false,
            },
          ],
        }),
      );
    return success({ values: [], truncated: false, sourceRevision: body.sourceRevision });
  });
  render(<SourceExplore />);
  await waitFor(() => expect(lastQuery()).toBeTruthy());
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: '기준 지표 Avg Bid Floor' }));
  await waitFor(() => expect(lastQuery().rankingMeasureId).toBe(2));
  // The leaderboard value follows the ranking measure unit and decimals (no more 0-decimal rounding).
  await waitFor(() => expect(screen.getAllByText('$5.57').length).toBe(2));
  expect(screen.getByText('이전 $4.61 · 변화 +$0.97 · 21.0%')).not.toBeNull();
  // An explicit null previous value stays unavailable instead of being rendered as 0.
  expect(screen.getByText('이전 값 없음')).not.toBeNull();
  // Rows without a previousValue key show no compare line at all.
  expect(screen.queryByText('이전 1.50')).toBeNull();
});

it('searches filter values on the server and applies the selection to the query', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'device_os' } });
  await waitFor(() =>
    expect(api.post.mock.calls.some(([url, body]) => url === '/bi/explore/values' && body.column === 'device_os')).toBe(
      true,
    ),
  );
  expect(lastValues().search).toBe('');
  fireEvent.change(screen.getByLabelText('값 검색'), { target: { value: 'Mobile' } });
  await waitFor(() => expect(lastValues().search).toBe('Mobile'));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Mobile/Tablet' }));
  fireEvent.click(screen.getByRole('button', { name: '필터 적용' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'device_os', values: ['Mobile/Tablet'] }]));
});

it('pauses the query and warns while a custom range is incomplete or reversed', async () => {
  await mount();
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  await screen.findByText(/시작일과 종료일을 모두 입력하면/);
  await act(async () => undefined);
  expect(queries().length).toBe(before);
  expect(screen.queryByText(/적용됨/)).toBeNull();
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-11' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-10' } });
  await screen.findByText(/시작일이 종료일보다 늦습니다/);
  await act(async () => undefined);
  expect(queries().length).toBe(before);
  expect(screen.queryByText(/적용됨/)).toBeNull();
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-12' } });
  await waitFor(() =>
    expect(lastQuery().dateRange).toEqual({ column: '__time', start: '2023-09-11', end: '2023-09-12', timeZone: 'UTC' }),
  );
});

it('shows the reload action when the query reports a different source revision', async () => {
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query') return success(queryResult({ sourceRevision: 'rev-next' }));
    return success({ values: [], truncated: false, sourceRevision: body.sourceRevision });
  });
  render(<SourceExplore />);
  await screen.findByText(/데이터 버전이 변경되었습니다/);
  const before = api.post.mock.calls.filter(([url]) => url === '/bi/explore/catalog').length;
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 다시 불러오기' }));
  await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/bi/explore/catalog').length).toBe(before + 1));
});

it('treats an HTTP 409 conflict as a revision change', async () => {
  api.post.mockImplementation(async (url: string) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query') throw conflict();
    return success({ values: [], truncated: false, sourceRevision: 'rev-3' });
  });
  render(<SourceExplore />);
  await screen.findByText(/데이터 버전이 변경되었습니다/);
});

it('surfaces a catalog reload action when the catalog request fails', async () => {
  api.post.mockImplementation(async (url: string) => {
    if (url === '/bi/explore/catalog') throw new Error('boom');
    return success(queryResult());
  });
  render(<SourceExplore />);
  await screen.findByText(/카탈로그를 다시 불러와 주세요/);
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 다시 불러오기' }));
  await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/bi/explore/catalog').length).toBe(2));
});

it('stops querying and shows an empty state when no measure is selected', async () => {
  await mount();
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: '지표 Total Requests' }));
  fireEvent.click(screen.getByRole('button', { name: '지표 Avg Bid Floor' }));
  fireEvent.click(screen.getByRole('button', { name: '지표 Rows' }));
  await screen.findByText(/지표를 하나 이상 선택하세요/);
  await act(async () => undefined);
  expect(queries().some(([, body]) => (body as any).measureIds.length === 0)).toBe(false);
  expect(screen.queryByText('Total Requests 추세')).toBeNull();
});

it('passes the server trend timeZone through to MetricTrend', async () => {
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query') {
      return success(
        queryResult({
          sourceRevision: 'rev-3',
          kpis: [
            {
              id: 1,
              title: 'Total Requests',
              value: '1',
              trend: { points: [{ time: '2023-09-09T15:00:00Z', value: '1' }], timeZone: 'Asia/Seoul' },
            },
          ],
        }),
      );
    }
    return success({ values: [], truncated: false, sourceRevision: body.sourceRevision });
  });
  render(<SourceExplore />);
  const trend = await screen.findByTestId('trend');
  expect(trend.getAttribute('data-timezone')).toBe('Asia/Seoul');
  expect(trend.getAttribute('data-points')).toBe('1');
});

it('ignores a superseded query response and never renders stale results', async () => {
  const deferred = () => {
    let settle!: (value: unknown) => void;
    const promise = new Promise(resolve => {
      settle = resolve;
    });
    return { promise, settle };
  };
  const first = deferred();
  let count = 0;
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query') {
      count += 1;
      return count === 1 ? first.promise : success(queryResult({ sourceRevision: 'rev-3' }));
    }
    return success({ values: [], truncated: false, sourceRevision: body.sourceRevision });
  });
  render(<SourceExplore />);
  await waitFor(() => expect(count).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '집계 단위 월' }));
  await waitFor(() => expect(count).toBe(2));
  await act(async () =>
    first.settle(success(queryResult({ sourceRevision: 'rev-3', kpis: [{ id: 9, title: 'Stale KPI', value: 1 }] }))),
  );
  expect(screen.queryByText('Stale KPI')).toBeNull();
  expect((await screen.findAllByText('Total Requests')).length).toBeGreaterThan(0);
  expect(lastQuery().trendGrain).toBe('month');
});

it('resets details pagination when a filter or the source changes', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Model Data 펼치기' }));
  await waitFor(() => expect(lastQuery().includeRows).toBe(true));
  fireEvent.click(await screen.findByRole('button', { name: '다음' }));
  await waitFor(() => expect(lastQuery().page).toBe(1));
  fireEvent.click(await screen.findByRole('button', { name: '필터 적용: device_os = Android' }));
  await waitFor(() => expect(lastQuery().page).toBe(0));
  expect(lastQuery().filters).toEqual([{ column: 'device_os', values: ['Android'] }]);
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '4' } });
  await waitFor(() => expect(lastQuery().sourceId).toBe(4));
  expect(lastQuery()).toMatchObject({
    sourceRevision: 'rev-4',
    filters: [],
    page: 0,
    includeRows: false,
    measureIds: [1, 2, 3],
  });
});

it('offers value/range modes only for numeric columns and blocks an empty range', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'device_os' } });
  expect(screen.queryByRole('button', { name: '필터 모드 범위' })).toBeNull();
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'bid_floor' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 모드 범위' }));
  expect((screen.getByRole('button', { name: '필터 적용' }) as HTMLButtonElement).disabled).toBe(true);
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: '필터 적용' }));
  await act(async () => undefined);
  expect(queries().length).toBe(before);
  expect(queries().some(([, body]) => (body as any).filters.some((filter: any) => 'range' in filter))).toBe(false);
});

it('applies an inclusive single-bound range from a numeric column and resets the page', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'bid_floor' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 모드 범위' }));
  fireEvent.change(screen.getByLabelText('최소값'), { target: { value: '1.5' } });
  expect((screen.getByRole('button', { name: '필터 적용' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '필터 적용' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'bid_floor', range: { min: 1.5 } }]));
  expect(lastQuery().page).toBe(0);
  expect(screen.getByText('bid_floor: 1.5 이상')).not.toBeNull();
});

it('blocks a reversed range and warns about inclusive bounds ordering', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'bid_floor' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 모드 범위' }));
  fireEvent.change(screen.getByLabelText('최소값'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('최대값'), { target: { value: '5' } });
  await screen.findByText('최소값은 최대값보다 클 수 없습니다.');
  expect((screen.getByRole('button', { name: '필터 적용' }) as HTMLButtonElement).disabled).toBe(true);
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: '필터 적용' }));
  await act(async () => undefined);
  expect(queries().length).toBe(before);
});

it('sends both range bounds, keeps the category filter, and removes the range chip', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 적용: device_type = Mobile/Tablet' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'device_type', values: ['Mobile/Tablet'] }]));
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'bid_floor' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 모드 범위' }));
  fireEvent.change(screen.getByLabelText('최소값'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('최대값'), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 적용' }));
  await waitFor(() =>
    expect(lastQuery().filters).toEqual([
      { column: 'device_type', values: ['Mobile/Tablet'] },
      { column: 'bid_floor', range: { min: 1, max: 9 } },
    ]),
  );
  expect(screen.getByText('bid_floor: 1 ~ 9')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '삭제 bid_floor: 1 ~ 9' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'device_type', values: ['Mobile/Tablet'] }]));
  expect(screen.queryByText('bid_floor: 1 ~ 9')).toBeNull();
  expect(lastQuery().page).toBe(0);
});

it('sends the dimension sort and resets it to value desc when the comparison is disabled', async () => {
  await mount();
  expect((screen.getByRole('button', { name: '정렬 기준 변화량' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: '정렬 기준 변화율' }) as HTMLButtonElement).disabled).toBe(true);
  expect(lastQuery().rankingSort).toEqual({ by: 'value', direction: 'desc' });
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(lastQuery().comparePrevious).toBe(true));
  expect((screen.getByRole('button', { name: '정렬 기준 변화량' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '정렬 기준 변화량' }));
  await waitFor(() => expect(lastQuery().rankingSort).toEqual({ by: 'delta', direction: 'desc' }));
  fireEvent.click(screen.getByRole('button', { name: '정렬 방향 오름차순' }));
  await waitFor(() => expect(lastQuery().rankingSort).toEqual({ by: 'delta', direction: 'asc' }));
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(lastQuery().rankingSort).toEqual({ by: 'value', direction: 'desc' }));
  expect(lastQuery().comparePrevious).toBe(false);
  expect((screen.getByRole('button', { name: '정렬 기준 변화량' }) as HTMLButtonElement).disabled).toBe(true);
});

it('ignores a superseded query response when the dimension sort changes', async () => {
  const deferred = () => {
    let settle!: (value: unknown) => void;
    const promise = new Promise(resolve => {
      settle = resolve;
    });
    return { promise, settle };
  };
  const slow = deferred();
  let count = 0;
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === '/bi/explore/catalog') return success({ ...catalog, sourceRevision: 'rev-3' });
    if (url === '/bi/explore/query') {
      count += 1;
      return count === 2 ? slow.promise : success(queryResult({ sourceRevision: 'rev-3' }));
    }
    return success({ values: [], truncated: false, sourceRevision: body.sourceRevision });
  });
  render(<SourceExplore />);
  await waitFor(() => expect(lastQuery()).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '정렬 방향 오름차순' }));
  await waitFor(() => expect(count).toBe(2));
  fireEvent.click(screen.getByRole('button', { name: '정렬 방향 내림차순' }));
  await waitFor(() => expect(count).toBe(3));
  await waitFor(() => expect(lastQuery().rankingSort).toEqual({ by: 'value', direction: 'desc' }));
  await act(async () =>
    slow.settle(success(queryResult({ sourceRevision: 'rev-3', kpis: [{ id: 9, title: 'Stale Sort KPI', value: 1 }] }))),
  );
  expect(screen.queryByText('Stale Sort KPI')).toBeNull();
  expect(lastQuery().rankingSort).toEqual({ by: 'value', direction: 'desc' });
});

const savedState = {
  version: 1,
  measureIds: [2, 1],
  dimensionColumns: ['device_os'],
  rankingMeasureId: 2,
  rankingSort: { by: 'percentChange', direction: 'asc' },
  filters: [
    { column: 'bid_floor', range: { min: 1, max: 9 } },
    { column: 'device_type', values: [null, 'Mobile/Tablet'] },
  ],
  dateRange: { column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'Asia/Seoul' },
  timeZone: 'Asia/Seoul',
  trendGrain: 'week',
  comparePrevious: true,
  includeRows: true,
};
const savedView = { id: 11, name: '주간 입찰 분석', sourceRevision: 'rev-3', state: savedState };
const currentPost = () => {
  const original = api.post.getMockImplementation();
  if (!original) throw new Error('Missing API mock');
  return original;
};
const withViews = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/views/list') return success(body.sourceId === 3 ? [savedView] : []);
    if (url === '/bi/explore/views/load') return success(savedView);
    if (url === '/bi/explore/views/create') return success({ ...savedView, name: body.name, state: body.state });
    if (url === '/bi/explore/views/remove') return success({ id: body.viewId });
    return original(url, body, ...options);
  });
};

it('restores persisted exploration conditions after remount and resets raw pagination', async () => {
  withViews();
  const mounted = render(<SourceExplore />);
  fireEvent.click(await screen.findByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  mounted.unmount();
  render(<SourceExplore />);
  fireEvent.click(await screen.findByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() =>
    expect(lastQuery()).toMatchObject({
      measureIds: [2, 1],
      dimensionColumns: ['device_os'],
      rankingMeasureId: 2,
      rankingSort: savedState.rankingSort,
      filters: savedState.filters,
      dateRange: savedState.dateRange,
      trendGrain: 'week',
      comparePrevious: true,
      includeRows: true,
      page: 0,
    }),
  );
  expect((screen.getByLabelText('시작일') as HTMLInputElement).value).toBe('2023-09-10');
  expect(screen.getByText('“주간 입찰 분석” 조건을 복원했습니다.')).toBeTruthy();
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(true),
  );
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: ' 복원한 보기 ' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() =>
    expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1]).toEqual({
      sourceId: 3,
      sourceRevision: 'rev-3',
      name: '복원한 보기',
      measureVersions: { '1': 1, '2': 1 },
      state: savedState,
    }),
  );
});

it('keeps current query on stale saved-view conflict and permits removing the stale view', async () => {
  withViews();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load' ? Promise.reject(conflict()) : original(url, ...args),
  );
  await mount();
  fireEvent.click(await screen.findByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  const before = lastQuery();
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await screen.findByText(/데이터 또는 지표 버전이 변경되어/);
  expect(lastQuery()).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: '보기 삭제' }));
  await waitFor(() => expect(screen.queryByRole('option', { name: savedView.name })).toBeNull());
});

it('ignores a delayed saved-view restore after changing source', async () => {
  withViews();
  let resolveLoad: (value: unknown) => void = () => undefined;
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load'
      ? new Promise(resolve => {
          resolveLoad = resolve;
        })
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(await screen.findByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '4' } });
  await waitFor(() => expect(lastQuery().sourceId).toBe(4));
  await act(async () => {
    resolveLoad(success(savedView));
  });
  expect(lastQuery()).toMatchObject({ sourceId: 4, filters: [], comparePrevious: false, page: 0 });
  expect(screen.queryByText(/조건을 복원했습니다/)).toBeNull();
});

it('shows the server rejection reason from the actual HTTP exception envelope', async () => {
  withViews();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/create'
      ? Promise.reject({
          response: {
            status: 400,
            data: { success: false, code: 400, data: '탐색 보기는 소스별 최대 20개까지 저장할 수 있습니다.' },
          },
        })
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '새 보기' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  expect(await screen.findByText('탐색 보기는 소스별 최대 20개까지 저장할 수 있습니다.')).toBeTruthy();
});

it('rejects an unsupported loaded state version without changing current conditions', async () => {
  withViews();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load'
      ? Promise.resolve(success({ ...savedView, state: { version: 2 } }))
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  const before = lastQuery();
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await screen.findByText(/저장된 탐색 조건의 버전을 확인할 수 없습니다/);
  expect(lastQuery()).toEqual(before);
});

it('blocks saving when a selected catalog measure has no definition version', async () => {
  withViews();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/catalog'
      ? Promise.resolve(
          success({ ...catalog, measures: catalog.measures.map(measure => ({ ...measure, definitionVersion: undefined })) }),
        )
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '새 보기' } });
  expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/지표 정의 버전을 확인할 수 없습니다/)).toBeTruthy();
  expect(api.post.mock.calls.some(([url]) => url === '/bi/explore/views/create')).toBe(false);
});
