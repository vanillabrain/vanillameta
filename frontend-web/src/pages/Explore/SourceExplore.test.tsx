import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceExplore from './SourceExplore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn(), search: 'sourceId=3' }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
// Behavioral tests mock MUI controls; real theme/layout is verified in the browser.
vi.mock('@mui/material/styles', () => ({
  useTheme: () => ({}),
  createTheme: () => ({}),
  ThemeProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
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

const pivotResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  rowColumns: body.rowColumns,
  columnColumns: body.columnColumns,
  rows: [[null], ['null'], ['Mobile/Tablet']],
  columns: body.columnColumns.length ? [['App'], ['Site']] : [[]],
  cells: [
    {
      row: 2,
      column: 0,
      measures: [
        { measureId: 1, value: '9007199254740993' },
        { measureId: 2, value: 2.5 },
      ],
    },
  ],
  rowTotals: [
    [],
    [],
    [
      { measureId: 1, value: '9007199254740993' },
      { measureId: 2, value: 2.5 },
    ],
  ],
  columnTotals: [
    [
      { measureId: 1, value: 30 },
      { measureId: 2, value: 2.4 },
    ],
    [],
  ],
  grandTotal: [
    { measureId: 1, value: 30 },
    { measureId: 2, value: 2.4 },
  ],
});
const pivots = () => api.post.mock.calls.filter(([url]) => url === '/bi/explore/pivot');
const withPivot = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot' ? success(pivotResult(body)) : original(url, body, ...options),
  );
};
const hierarchyResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  rowColumns: body.rowColumns,
  columnColumns: body.columnColumns,
  rows: [
    [null, 'Android'],
    ['null', 'iOS'],
    ['Mobile/Tablet', 'Android'],
  ],
  columns: body.columnColumns.length ? [['1'], ['2']] : [[]],
  cells: [],
  rowTotals: [
    [
      { measureId: 1, value: '20' },
      { measureId: 2, value: 2 },
    ],
    [
      { measureId: 1, value: '10' },
      { measureId: 2, value: 3 },
    ],
    [
      { measureId: 1, value: '40' },
      { measureId: 2, value: 1.1 },
    ],
  ],
  columnTotals: [
    [
      { measureId: 1, value: '70' },
      { measureId: 2, value: 2.4 },
    ],
    [],
  ],
  grandTotal: [
    { measureId: 1, value: '70' },
    { measureId: 2, value: 2.4 },
  ],
  rowSubtotals: [
    {
      tuple: [null],
      measures: [
        { measureId: 1, value: '30' },
        { measureId: 2, value: 2.75 },
      ],
      cells: [
        {
          column: 0,
          measures: [
            { measureId: 1, value: '20' },
            { measureId: 2, value: 2.5 },
          ],
        },
        {
          column: 1,
          measures: [
            { measureId: 1, value: '10' },
            { measureId: 2, value: 3 },
          ],
        },
      ],
    },
    {
      tuple: ['null'],
      measures: [
        { measureId: 1, value: '10' },
        { measureId: 2, value: 1.5 },
      ],
      cells: [
        {
          column: 0,
          measures: [
            { measureId: 1, value: '10' },
            { measureId: 2, value: 1.5 },
          ],
        },
        {
          column: 1,
          measures: [{ measureId: 1, value: '0' }],
        },
      ],
    },
    {
      tuple: ['Mobile/Tablet'],
      measures: [
        { measureId: 1, value: '40' },
        { measureId: 2, value: 1.1 },
      ],
      cells: [
        {
          column: 0,
          measures: [{ measureId: 1, value: '0' }],
        },
        {
          column: 1,
          measures: [
            { measureId: 1, value: '40' },
            { measureId: 2, value: 1.1 },
          ],
        },
      ],
    },
  ],
});
const withHierarchy = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot' ? success(hierarchyResult(body)) : original(url, body, ...options),
  );
};
const openHierarchy = async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 2'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual(['device_type', 'device_os']));
  fireEvent.click(screen.getByRole('button', { name: '행 계층 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true));
  await screen.findByRole('button', { name: '(값 없음) 펼치기' });
};
it('uses Pivot server totals and sparse null cells, preserves large integers, swaps axes and filters from rows', async () => {
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(pivots().at(-1)?.[1]).toMatchObject({
    measureIds: [1, 2, 3],
    rowColumns: ['device_type'],
    columnColumns: [],
    filters: [],
  });
  expect(screen.getAllByText('9,007,199,254,740,993').length).toBe(1);
  expect(screen.getByText('$2.40')).toBeTruthy();
  expect(screen.getByRole('button', { name: '(값 없음)', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'null', exact: true })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['device_os']));
  fireEvent.click(screen.getByRole('button', { name: '행·열 바꾸기' }));
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({ rowColumns: ['device_os'], columnColumns: ['device_type'] }),
  );
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.click(screen.getByRole('button', { name: 'Mobile/Tablet', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].filters).toEqual([{ column: 'device_os', values: ['Mobile/Tablet'] }]));
});
it('saves and restores v2 Pivot axes while retaining period, filters and comparison', async () => {
  withViews();
  withPivot();
  const original = currentPost();
  const v2 = {
    ...savedState,
    version: 2,
    pivot: { enabled: true, rowColumns: ['device_type'], columnColumns: ['device_os'] },
  };
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load' ? Promise.resolve(success({ ...savedView, state: v2 })) : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({
      rowColumns: ['device_type'],
      columnColumns: ['device_os'],
      measureIds: [2, 1],
      dateRange: savedState.dateRange,
      filters: savedState.filters,
      comparePrevious: true,
    }),
  );
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: 'Pivot 저장' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() =>
    expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state).toEqual(v2),
  );
  fireEvent.click(screen.getByRole('button', { name: '탐색', exact: true }));
  await waitFor(() => expect(lastQuery()).toMatchObject({ filters: savedState.filters, comparePrevious: true }));
});
it('clears old Pivot results on limit error and permits changing axes to recover', async () => {
  withPivot();
  const original = currentPost();
  api.post.mockImplementation((url: string, body: any, ...opts: any[]) =>
    url === '/bi/explore/pivot' && body.columnColumns.length
      ? Promise.reject({
          response: { status: 400, data: { success: false, data: 'Pivot 열 그룹은 최대 20개입니다. 필터를 좁혀 주세요.' } },
        })
      : original(url, body, ...opts),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'device_os' } });
  await screen.findByText(/Pivot 열 그룹은 최대 20개/);
  expect(screen.queryByRole('region', { name: 'Pivot 결과' })).toBeNull();
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: '' } });
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(screen.queryByText(/Pivot 열 그룹은 최대 20개/)).toBeNull();
});
it('ignores a delayed Pivot response after source changes', async () => {
  withPivot();
  const original = currentPost();
  let resolvePivot: (value: unknown) => void = () => undefined;
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/pivot'
      ? new Promise(resolve => {
          resolvePivot = resolve;
        })
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await waitFor(() => expect(pivots().length).toBe(1));
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '4' } });
  await waitFor(() => expect(lastQuery().sourceId).toBe(4));
  await act(async () =>
    resolvePivot(success(pivotResult({ sourceRevision: 'rev-3', rowColumns: ['device_type'], columnColumns: [] }))),
  );
  expect(screen.queryByRole('region', { name: 'Pivot 결과' })).toBeNull();
});
it('separates a null hierarchy parent from a literal string-null parent and starts collapsed', async () => {
  withHierarchy();
  await openHierarchy();
  expect(screen.getByRole('button', { name: '(값 없음) 펼치기' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'null 펼치기' })).not.toBeNull();
  expect(screen.getAllByText('부분합').length).toBe(3);
  expect(screen.queryByRole('button', { name: 'Android', exact: true })).toBeNull();
  expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true);
});
it('expands and collapses hierarchy groups without issuing another pivot request', async () => {
  withHierarchy();
  await openHierarchy();
  const before = pivots().length;
  fireEvent.click(screen.getByRole('button', { name: '모두 펼치기' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Android', exact: true }).length).toBe(2));
  expect(screen.getByRole('button', { name: '(값 없음) 접기' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '(값 없음) 접기' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Android', exact: true }).length).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Android', exact: true })).toBeNull());
  expect(pivots().length).toBe(before);
});
it('uses the server subtotal for a non-additive ratio instead of summing the child cells', async () => {
  withHierarchy();
  await openHierarchy();
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'bid_floor' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['bid_floor']));
  await waitFor(() => expect(screen.getByText('$2.75')).not.toBeNull());
  expect(screen.queryByText('$5.00')).toBeNull();
  expect(screen.getAllByText('부분합').length).toBe(3);
});
it('sends the row sort for the chosen measure and reverts to label sorting', async () => {
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(pivots().at(-1)?.[1].rowSort).toBeUndefined();
  const sort = screen.getByLabelText('행 정렬 기준') as HTMLSelectElement;
  expect(sort.tagName).toBe('SELECT');
  fireEvent.change(sort, { target: { value: '2' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 2 }));
  fireEvent.click(screen.getByRole('button', { name: '행 정렬 방향' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'desc', measureId: 2 }));
  fireEvent.change(screen.getByLabelText('행 정렬 기준'), { target: { value: 'label' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'label', direction: 'desc' }));
});
it('ignores a superseded Pivot response after the row sort changes', async () => {
  withPivot();
  const original = currentPost();
  let settle: (value: unknown) => void = () => undefined;
  let count = 0;
  api.post.mockImplementation((url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/pivot') {
      count += 1;
      return count === 1
        ? new Promise(resolve => {
            settle = resolve;
          })
        : original(url, body, ...options);
    }
    return original(url, body, ...options);
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await waitFor(() => expect(pivots().length).toBe(1));
  fireEvent.change(screen.getByLabelText('행 정렬 기준'), { target: { value: '2' } });
  await waitFor(() => expect(count).toBe(2));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  await act(async () =>
    settle(
      success({
        sourceRevision: 'rev-3',
        rowColumns: ['device_type'],
        columnColumns: [],
        rows: [['STALE']],
        columns: [[]],
        cells: [],
        rowTotals: [[]],
        columnTotals: [[]],
        grandTotal: [],
      }),
    ),
  );
  expect(screen.queryByText('STALE')).toBeNull();
  expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 2 });
});
it('saves and restores v3 hierarchy sort and expanded rows with period, filters and comparison', async () => {
  withViews();
  withHierarchy();
  const original = currentPost();
  const v3 = {
    ...savedState,
    version: 3,
    pivot: {
      enabled: true,
      rowColumns: ['device_type', 'device_os'],
      columnColumns: [],
      rowHierarchy: true,
      rowSort: { by: 'value', direction: 'desc', measureId: 2 },
      expandedRows: [[null], ['Mobile/Tablet']],
    },
  };
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load' ? Promise.resolve(success({ ...savedView, state: v3 })) : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({
      rowColumns: ['device_type', 'device_os'],
      rowHierarchy: true,
      rowSort: { by: 'value', direction: 'desc', measureId: 2 },
      measureIds: [2, 1],
      dateRange: savedState.dateRange,
      filters: savedState.filters,
      comparePrevious: true,
    }),
  );
  await screen.findByRole('region', { name: 'Pivot 결과' });
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Android', exact: true }).length).toBe(2));
  expect(screen.getByRole('button', { name: '(값 없음) 접기' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'null 펼치기' })).not.toBeNull();
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: 'Pivot v3' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() =>
    expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state).toEqual(v3),
  );
});
it('keeps the v2 saved shape when pivot axes carry no hierarchy or custom sort', async () => {
  withViews();
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '평면 피벗' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() => {
    const state = api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state;
    expect(state.version).toBe(2);
    expect(state.pivot).toEqual({ enabled: true, rowColumns: ['device_type'], columnColumns: [] });
  });
});
const v3HierarchyState = {
  ...savedState,
  version: 3 as const,
  pivot: {
    enabled: true,
    rowColumns: ['device_type', 'device_os'],
    columnColumns: [],
    rowHierarchy: true,
    rowSort: { by: 'value' as const, direction: 'desc' as const, measureId: 2 },
    expandedRows: [[null], ['Mobile/Tablet']],
  },
};
it('refetches and restores pivot readiness when the same v3 view is restored twice', async () => {
  withViews();
  withHierarchy();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/views/load'
      ? Promise.resolve(success({ ...savedView, state: v3HierarchyState }))
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  await waitFor(() => expect(pivots().length).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: /내보내기/ }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'CSV 다운로드' }) as HTMLButtonElement).disabled).toBe(false),
  );
  // Restoring the identical v3 state again keeps the same payload references, so the pivot must still
  // refetch; otherwise pivotReady stays false and the export action is stuck disabled.
  expect(pivots().length).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() => expect(pivots().length).toBe(2));
  expect(pivots()[1][1]).toEqual(pivots()[0][1]);
  await screen.findByRole('region', { name: 'Pivot 결과' });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'CSV 다운로드' }) as HTMLButtonElement).disabled).toBe(false),
  );
});
it('falls back to flat rows when a hierarchy response omits subtotals', async () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot' ? success({ ...hierarchyResult(body), rowSubtotals: [] }) : original(url, body, ...options),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 2'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual(['device_type', 'device_os']));
  fireEvent.click(screen.getByRole('button', { name: '행 계층 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Android', exact: true }).length).toBe(2));
  expect(screen.queryByRole('button', { name: '(값 없음) 펼치기' })).toBeNull();
  expect(screen.queryByText('부분합')).toBeNull();
});

/**
 * Version 4 Pivot time axis and comparison-scoped row sorting.
 *
 * The request contract is fixed by the units that already landed with this feature:
 * backend-api/src/bi/bi-explore-time.ts (timeAxis {column,grain,timeZone}, where the column must
 * already sit on an axis and the time zone must agree with the applied period) and
 * backend-api/src/bi/explore-view-state.ts (version 4, rowSort.by widened to delta|percentChange,
 * an optional columnTuple whose arity is the column axis, and a change sort that needs
 * comparePrevious).
 *
 * The controls these tests drive are the landed ones: the 시간 축 꺼짐 toggle with its 시간 축 열 and
 * 시간 집계 selects, and the 정렬 <열> <지표> cell-header buttons with the 정렬 계산 변화량 /
 * 정렬 계산 변화율 buttons.
 */
/** Column groups follow the first placed column so a cell header can be addressed by its tuple. */
const timedColumnGroups = (body: any): unknown[][] => {
  const first = body.columnColumns?.[0];
  if (first === 'device_os') return [['Android'], ['iOS']];
  if (first === 'device_type') return [['Mobile/Tablet'], ['Personal Computer']];
  return body.columnColumns?.length ? [['A'], ['B']] : [[]];
};
const timedPivotResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  rowColumns: body.rowColumns,
  columnColumns: body.columnColumns,
  rows: [['2023-09-03'], ['2023-09-10'], ['2023-09-17']],
  columns: timedColumnGroups(body),
  cells: [
    {
      row: 1,
      column: 0,
      measures: [
        {
          measureId: 1,
          value: '30',
          comparison: { previousValue: '20', delta: '10', percentChange: 50 },
        },
      ],
    },
  ],
  rowTotals: [
    [{ measureId: 1, value: '10', comparison: { previousValue: '8', delta: '2', percentChange: 25 } }],
    [{ measureId: 1, value: '30', comparison: { previousValue: '20', delta: '10', percentChange: 50 } }],
    [{ measureId: 1, value: '20', comparison: { previousValue: '25', delta: '-5', percentChange: -20 } }],
  ],
  columnTotals: [[{ measureId: 1, value: '60' }], [{ measureId: 1, value: '50' }]],
  grandTotal: [{ measureId: 1, value: '110' }],
});
const withTimedPivot = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot' ? success(timedPivotResult(body)) : original(url, body, ...options),
  );
};
/** Saved views that serve one v1-v4 state on both list and load, mirroring the withViews helper. */
const withViewsState = (state: unknown) => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/views/list') return success(body.sourceId === 3 ? [{ ...savedView, state }] : []);
    if (url === '/bi/explore/views/load') return success({ ...savedView, state });
    if (url === '/bi/explore/views/create') return success({ ...savedView, name: body.name, state: body.state });
    if (url === '/bi/explore/views/remove') return success({ id: body.viewId });
    return original(url, body, ...options);
  });
};
const openViewPanel = async () => {
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
};
const loadSelectedView = () => {
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
};
/** The live catalog lists the temporal column on the dimension list too; the shared fixture omits it. */
const withTemporalDimension = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/catalog'
      ? success({
          ...catalog,
          sourceId: body.sourceId,
          sourceRevision: `rev-${body.sourceId}`,
          dimensions: [...catalog.dimensions, { column: '__time', type: 'TIMESTAMP', numeric: false, temporal: true }],
        })
      : original(url, body, ...options),
  );
};
const setTimeAxisGrain = (grain: 'day' | 'week' | 'month') =>
  fireEvent.change(screen.getByLabelText('시간 집계'), { target: { value: grain } });
const clickCellHeader = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const v4State = {
  ...savedState,
  version: 4,
  pivot: {
    enabled: true,
    rowColumns: ['__time'],
    columnColumns: ['device_type'],
    rowHierarchy: false,
    rowSort: {
      by: 'delta' as const,
      direction: 'desc' as const,
      measureId: 2,
      columnTuple: ['Mobile/Tablet'],
    },
    expandedRows: [],
    timeAxis: { column: '__time', grain: 'week' as const, timeZone: 'Asia/Seoul' },
  },
};
it('sends the Pivot time grain as day, week and month with the business time zone', async () => {
  withTemporalDimension();
  withTimedPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 1'), { target: { value: '__time' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual(['__time']));
  fireEvent.click(screen.getByRole('button', { name: '시간 축 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain: 'day', timeZone: 'UTC' }));
  expect(screen.getByText('시간대 UTC')).toBeTruthy();
  for (const grain of ['week', 'month'] as const) {
    setTimeAxisGrain(grain);
    await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain, timeZone: 'UTC' }));
  }
});
it('scopes the row sort to the clicked cell header for delta and percentChange', async () => {
  withTimedPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['device_os']));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  clickCellHeader('정렬 Android Avg Bid Floor');
  await waitFor(() =>
    expect(pivots().at(-1)?.[1].rowSort).toEqual({
      by: 'value',
      direction: 'asc',
      measureId: 2,
      columnTuple: ['Android'],
    }),
  );
  clickCellHeader('정렬 계산 변화량');
  await waitFor(() =>
    expect(pivots().at(-1)?.[1].rowSort).toEqual({
      by: 'delta',
      direction: 'asc',
      measureId: 2,
      columnTuple: ['Android'],
    }),
  );
  clickCellHeader('정렬 계산 변화율');
  await waitFor(() =>
    expect(pivots().at(-1)?.[1].rowSort).toEqual({
      by: 'percentChange',
      direction: 'asc',
      measureId: 2,
      columnTuple: ['Android'],
    }),
  );
});
it('falls back to a valid row sort when the previous-period comparison is turned off', async () => {
  withViewsState(v4State);
  withTimedPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort?.by).toBe('delta'));
  const before = pivots().at(-1)?.[1].rowSort;
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].comparePrevious).toBe(false));
  const sort = pivots().at(-1)?.[1].rowSort;
  expect(['delta', 'percentChange']).not.toContain(sort?.by);
  if (sort?.by === 'value') expect([1, 2, 3]).toContain(sort.measureId);
  if (sort?.by === 'label') {
    expect(sort.measureId).toBeUndefined();
    expect(sort.columnTuple).toBeUndefined();
  }
  expect(pivots().at(-1)?.[1].rowSort).not.toEqual(before);
});
it('restores a v4 view with its time axis and cell-scoped comparison sort', async () => {
  withViewsState(v4State);
  withTimedPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({
      rowColumns: ['__time'],
      columnColumns: ['device_type'],
      rowSort: { by: 'delta', direction: 'desc', measureId: 2, columnTuple: ['Mobile/Tablet'] },
      timeAxis: { column: '__time', grain: 'week', timeZone: 'Asia/Seoul' },
      measureIds: [2, 1],
      dateRange: savedState.dateRange,
      filters: savedState.filters,
      comparePrevious: true,
    }),
  );
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(screen.getByText('“주간 입찰 분석” 조건을 복원했습니다.')).toBeTruthy();
});
it('saves a restored v4 view with the time axis and the cell tuple intact', async () => {
  withViewsState(v4State);
  withTimedPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '시간 축 v4' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() =>
    expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state).toEqual(v4State),
  );
});
it('keeps a restored v3 view free of the time axis and the cell tuple', async () => {
  withViewsState(v3HierarchyState);
  withHierarchy();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() => expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true));
  expect(pivots().at(-1)?.[1].timeAxis).toBeUndefined();
  expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'desc', measureId: 2 });
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: 'Pivot v3 유지' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() => {
    const state = api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state;
    expect(state.version).toBe(3);
    expect(state.pivot.timeAxis).toBeUndefined();
    expect(state.pivot.rowSort).toEqual({ by: 'value', direction: 'desc', measureId: 2 });
  });
});
it('ignores a superseded Pivot response after the scoped comparison sort changes', async () => {
  const v4Other = {
    ...v4State,
    pivot: {
      ...v4State.pivot,
      rowSort: { ...v4State.pivot.rowSort, columnTuple: ['Personal Computer'] },
    },
  };
  let loads = 0;
  let pivotCalls = 0;
  let settleStale: (value: unknown) => void = () => undefined;
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/views/list') return success([{ ...savedView, state: v4State }]);
    if (url === '/bi/explore/views/load') {
      loads += 1;
      return success({ ...savedView, state: loads === 1 ? v4State : v4Other });
    }
    if (url === '/bi/explore/pivot') {
      pivotCalls += 1;
      if (pivotCalls === 1)
        return new Promise(resolve => {
          settleStale = resolve;
        });
      return success({
        ...timedPivotResult(body),
        rows: [['2023-09-17']],
        rowTotals: [[{ measureId: 1, value: '20' }]],
      });
    }
    return original(url, body, ...options);
  });
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() => expect(pivotCalls).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() => expect(pivotCalls).toBe(2));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  await act(async () =>
    settleStale(
      success({
        ...timedPivotResult({ sourceRevision: 'rev-3', rowColumns: ['__time'], columnColumns: ['device_type'] }),
        rows: [['STALE']],
        cells: [],
        rowTotals: [[{ measureId: 1, value: '1' }]],
      }),
    ),
  );
  expect(screen.queryByText('STALE')).toBeNull();
  expect(pivots().at(-1)?.[1].rowSort).toEqual({
    by: 'delta',
    direction: 'desc',
    measureId: 2,
    columnTuple: ['Personal Computer'],
  });
});
it('clears the rendered cells while a same-axis refresh is in flight', async () => {
  // The same view restores the same axes, so nothing in the request identifies the second load; the
  // grid must still drop the previous aggregate instead of presenting it as the current one.
  const collapsed = {
    ...v3HierarchyState,
    pivot: { ...v3HierarchyState.pivot, expandedRows: [] },
  };
  let pivotCalls = 0;
  let settleRefresh: (value: unknown) => void = () => undefined;
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/views/list') return success([{ ...savedView, state: collapsed }]);
    if (url === '/bi/explore/views/load') return success({ ...savedView, state: collapsed });
    if (url === '/bi/explore/pivot') {
      pivotCalls += 1;
      if (pivotCalls === 1) return success(hierarchyResult(body));
      return new Promise(resolve => {
        settleRefresh = resolve;
      });
    }
    return original(url, body, ...options);
  });
  await mount();
  await openViewPanel();
  loadSelectedView();
  await screen.findByRole('button', { name: '(값 없음) 펼치기' });
  expect(screen.getAllByText('부분합').length).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() => expect(pivotCalls).toBe(2));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Pivot 결과' })).toBeNull());
  expect(screen.queryByRole('button', { name: '(값 없음) 펼치기' })).toBeNull();
  expect(screen.queryByText('부분합')).toBeNull();
  const fresh = hierarchyResult({
    sourceRevision: 'rev-3',
    rowColumns: ['device_type', 'device_os'],
    columnColumns: [],
  });
  await act(async () =>
    settleRefresh(
      success({
        ...fresh,
        rows: [['FRESH', 'Android']],
        rowTotals: [
          [
            { measureId: 1, value: '40' },
            { measureId: 2, value: 1.1 },
          ],
        ],
        rowSubtotals: [
          {
            tuple: ['FRESH'],
            measures: [
              { measureId: 1, value: '40' },
              { measureId: 2, value: 1.1 },
            ],
            cells: [{ column: 0, measures: [{ measureId: 1, value: '40' }] }],
          },
        ],
      }),
    ),
  );
  await screen.findByRole('button', { name: 'FRESH 펼치기' });
  expect(screen.queryByRole('button', { name: '(값 없음) 펼치기' })).toBeNull();
  expect(screen.getAllByText('부분합').length).toBe(1);
});
it('saves and exports a cell-scoped change sort without a time axis as version 4', async () => {
  // A change order and a cell scope only exist in the version 4 row-sort contract, so a state with
  // neither a time axis nor a stored previous-period layout must still persist as version 4 instead
  // of emitting a version 3 order the saved-view validator rejects.
  withViews();
  withTimedPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['device_os']));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  clickCellHeader('정렬 Android Avg Bid Floor');
  clickCellHeader('정렬 계산 변화율');
  const scoped = { by: 'percentChange', direction: 'asc', measureId: 2, columnTuple: ['Android'] };
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual(scoped));
  expect(pivots().at(-1)?.[1].timeAxis).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '변화 정렬' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() => {
    const state = api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state;
    expect(state.version).toBe(4);
    expect(state.pivot.timeAxis).toBeUndefined();
    expect(state.pivot.rowSort).toEqual(scoped);
  });
  fireEvent.click(screen.getByRole('button', { name: /내보내기/ }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'CSV 다운로드' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'CSV 다운로드' }));
  await waitFor(() => {
    const body = api.post.mock.calls.find(([url]) => url === '/bi/explore/export')?.[1];
    expect(body.mode).toBe('pivot');
    expect(body.query.rowSort).toEqual(scoped);
    expect(body.query.timeAxis).toBeUndefined();
  });
});
it('drops the cell sort scope when the Pivot time grain changes so the next request succeeds', async () => {
  const original = currentPost();
  const buckets = (grain: string) => (grain === 'month' ? [['2023-09'], ['2023-10']] : [['2023-09-10'], ['2023-09-11']]);
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/catalog')
      return success({
        ...catalog,
        sourceId: body.sourceId,
        sourceRevision: `rev-${body.sourceId}`,
        dimensions: [...catalog.dimensions, { column: '__time', type: 'TIMESTAMP', numeric: false, temporal: true }],
      });
    if (url === '/bi/explore/pivot') {
      const columns = buckets(body.timeAxis?.grain ?? 'day');
      // The server rejects a scoped sort whose cell tuple is absent from the requested grain.
      const staleTuple =
        body.rowSort?.columnTuple !== undefined &&
        !columns.some(values => JSON.stringify(values) === JSON.stringify(body.rowSort.columnTuple));
      if (staleTuple)
        return Promise.reject({
          response: { status: 400, data: { success: false, data: '정렬할 열 셀을 다시 선택해 주세요.' } },
        });
      return success({
        sourceRevision: body.sourceRevision,
        rowColumns: body.rowColumns,
        columnColumns: body.columnColumns,
        rows: [['Android'], ['iOS']],
        columns,
        cells: [{ row: 0, column: 0, measures: [{ measureId: 2, value: '30' }] }],
        rowTotals: [[{ measureId: 2, value: '10' }], [{ measureId: 2, value: '20' }]],
        columnTotals: columns.map(() => [{ measureId: 2, value: '30' }]),
        grandTotal: [{ measureId: 2, value: '30' }],
      });
    }
    return original(url, body, ...options);
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: '__time' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['__time']));
  fireEvent.click(screen.getByRole('button', { name: '시간 축 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain: 'day', timeZone: 'UTC' }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  clickCellHeader('정렬 2023-09-10 Avg Bid Floor');
  await waitFor(() =>
    expect(pivots().at(-1)?.[1].rowSort).toEqual({
      by: 'value',
      direction: 'asc',
      measureId: 2,
      columnTuple: ['2023-09-10'],
    }),
  );
  // A day cell scope cannot bind the month grid, so the grain change drops the tuple before the
  // request. The mock still refuses a stale scope with the server's own reason, so a regression that
  // replays the day tuple fails here instead of passing leniently.
  setTimeAxisGrain('month');
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain: 'month', timeZone: 'UTC' }));
  const monthRequests = pivots().filter(([, body]) => body.timeAxis?.grain === 'month');
  expect(monthRequests.length).toBe(1);
  expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 2 });
  await screen.findByRole('button', { name: '정렬 2023-09 Avg Bid Floor' });
  expect(screen.queryByText(/다시 선택해 주세요/)).toBeNull();
});
it('falls back to the row total when a changed date range makes the scoped Pivot cell stale', async () => {
  const original = currentPost();
  const dayBuckets = ['2023-09-10', '2023-09-11', '2023-09-12', '2023-09-13'];
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) => {
    if (url === '/bi/explore/catalog')
      return success({
        ...catalog,
        sourceId: body.sourceId,
        sourceRevision: `rev-${body.sourceId}`,
        dimensions: [...catalog.dimensions, { column: '__time', type: 'TIMESTAMP', numeric: false, temporal: true }],
      });
    if (url === '/bi/explore/pivot') {
      // Only the day buckets inside the selected range exist, so a scope kept from another range is stale.
      const range = body.dateRange as { start: string; end: string } | undefined;
      const columns = (
        range ? dayBuckets.filter(day => day >= range.start && day <= range.end) : dayBuckets.slice(0, 2)
      ).map(day => [day]);
      const staleTuple =
        body.rowSort?.columnTuple !== undefined &&
        !columns.some(values => JSON.stringify(values) === JSON.stringify(body.rowSort.columnTuple));
      if (staleTuple)
        return Promise.reject({
          response: { status: 400, data: { success: false, data: '정렬할 열 셀을 다시 선택해 주세요.' } },
        });
      return success({
        sourceRevision: body.sourceRevision,
        rowColumns: body.rowColumns,
        columnColumns: body.columnColumns,
        rows: [['Android'], ['iOS']],
        columns,
        cells: [{ row: 0, column: 0, measures: [{ measureId: 2, value: '30' }] }],
        rowTotals: [[{ measureId: 2, value: '10' }], [{ measureId: 2, value: '20' }]],
        columnTotals: columns.map(() => [{ measureId: 2, value: '30' }]),
        grandTotal: [{ measureId: 2, value: '30' }],
      });
    }
    return original(url, body, ...options);
  });
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: '__time' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['__time']));
  fireEvent.click(screen.getByRole('button', { name: '시간 축 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain: 'day', timeZone: 'UTC' }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  clickCellHeader('정렬 2023-09-10 Avg Bid Floor');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort?.columnTuple).toEqual(['2023-09-10']));
  // A range the client cannot predict drops the scoped bucket from the grid, so the server refuses the
  // kept scope once and the panel must fall back to the row total instead of staying on the error.
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-12' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-13' } });
  await waitFor(() =>
    expect(pivots().some(([, body]) => body.dateRange?.start === '2023-09-12' && !!body.rowSort?.columnTuple)).toBe(true),
  );
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort?.columnTuple).toBeUndefined());
  const refused = pivots().filter(([, body]) => body.dateRange?.start === '2023-09-12' && !!body.rowSort?.columnTuple);
  expect(refused.length).toBe(1);
  expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 2 });
  await screen.findByRole('button', { name: '정렬 2023-09-12 Avg Bid Floor' });
  expect(screen.queryByText(/다시 선택해 주세요/)).toBeNull();
});

/** Flat echoes one joined record axis: the original column axis first, then the original row axis. */
const flatResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  rowColumns: [...body.columnColumns, ...body.rowColumns],
  columnColumns: [],
  rows: [
    ['App', null, 'A'],
    ['Site', 'Android', 'B'],
  ],
  columns: [[]],
  // Only the second record carries a cell, so the first must fall back to its own row total.
  cells: [{ row: 1, column: 0, measures: [{ measureId: 1, value: '111' }] }],
  rowTotals: [[{ measureId: 1, value: '300', comparison: { previousValue: '200', delta: '100', percentChange: 50 } }], []],
  columnTotals: [],
  grandTotal: [{ measureId: 1, value: '600', comparison: { previousValue: '400', delta: '200', percentChange: 50 } }],
});
const withFlatPivot = () => {
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot'
      ? success(body.tableMode === 'flat' ? flatResult(body) : pivotResult(body))
      : original(url, body, ...options),
  );
};
const flatHeaders = () => screen.getAllByRole('columnheader').map(cell => cell.textContent);
const pivotToggle = (name: string) => screen.getByRole('button', { name, exact: true }).getAttribute('aria-pressed');
const v5FlatState = {
  ...savedState,
  version: 5,
  pivot: {
    enabled: true,
    rowColumns: ['device_type'],
    columnColumns: ['device_os'],
    rowHierarchy: false,
    rowSort: { by: 'value' as const, direction: 'desc' as const, measureId: 2 },
    expandedRows: [],
    tableMode: 'flat' as const,
  },
};
it('joins both saved axes into one flat record axis and drops the cell scope that axis cannot carry', async () => {
  withViewsState(v4State);
  withFlatPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort?.columnTuple).toEqual(['Mobile/Tablet']));
  expect(pivots().at(-1)?.[1].tableMode).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({
      tableMode: 'flat',
      rowHierarchy: false,
      rowColumns: ['__time'],
      columnColumns: ['device_type'],
    }),
  );
  expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'delta', direction: 'desc', measureId: 2 });
  expect(pivotToggle('Flat')).toBe('true');
  await screen.findByRole('region', { name: 'Pivot 결과' });
  // The headers follow the joined response axis, not the two saved axes.
  expect(flatHeaders().slice(0, 2)).toEqual(['device_type', '__time']);
  expect(screen.getByRole('button', { name: 'Flat 정렬 Avg Bid Floor' }).getAttribute('aria-pressed')).toBe('true');
});
it('renders flat records from the joined tuple, keeps null labels and toggles the record order', async () => {
  withFlatPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 2'), { target: { value: 'device_os' } });
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'bid_floor' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['bid_floor']));
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBe('flat'));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(flatHeaders()).toEqual(['bid_floor', 'device_type', 'device_os', 'Total Requests', 'Avg Bid Floor', 'Rows']);
  expect(screen.getByRole('button', { name: '(값 없음)', exact: true })).toBeTruthy();
  expect(screen.getByText('111')).toBeTruthy();
  expect(screen.getByText('300')).toBeTruthy();
  expect(screen.getByText('600')).toBeTruthy();
  expect(screen.queryByLabelText('정렬 범위')).toBeNull();
  clickCellHeader('Flat 정렬 Total Requests');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 1 }));
  clickCellHeader('Flat 정렬 Total Requests');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'desc', measureId: 1 }));
});
it('keeps the flat change calculation while the record order moves between measure headers', async () => {
  withFlatPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBe('flat'));
  clickCellHeader('Flat 정렬 Total Requests');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'value', direction: 'asc', measureId: 1 }));
  clickCellHeader('정렬 계산 변화량');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'delta', direction: 'asc', measureId: 1 }));
  clickCellHeader('Flat 정렬 Avg Bid Floor');
  await waitFor(() => expect(pivots().at(-1)?.[1].rowSort).toEqual({ by: 'delta', direction: 'asc', measureId: 2 }));
  expect(pivots().at(-1)?.[1].rowSort.columnTuple).toBeUndefined();
});
it('restores a v5 flat view, keeps both original axes nested, and re-saves the flat mode', async () => {
  withViewsState(v5FlatState);
  withFlatPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() =>
    expect(pivots().at(-1)?.[1]).toMatchObject({
      tableMode: 'flat',
      rowHierarchy: false,
      rowColumns: ['device_type'],
      columnColumns: ['device_os'],
      rowSort: { by: 'value', direction: 'desc', measureId: 2 },
    }),
  );
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(pivotToggle('Flat')).toBe('true');
  expect(flatHeaders().slice(0, 2)).toEqual(['device_os', 'device_type']);
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 테이블', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBeUndefined());
  expect((screen.getByLabelText('열 차원 1') as HTMLInputElement).value).toBe('device_os');
  expect((screen.getByLabelText('행 차원 1') as HTMLInputElement).value).toBe('device_type');
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBe('flat'));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: 'Flat v5' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '현재 조건 저장' }));
  await waitFor(() => {
    const state = api.post.mock.calls.find(([url]) => url === '/bi/explore/views/create')?.[1].state;
    expect(state.version).toBe(5);
    expect(state.pivot).toMatchObject({
      tableMode: 'flat',
      rowHierarchy: false,
      expandedRows: [],
      rowColumns: ['device_type'],
      columnColumns: ['device_os'],
      rowSort: { by: 'value', direction: 'desc', measureId: 2 },
    });
  });
  fireEvent.click(screen.getByRole('button', { name: /내보내기/ }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'CSV 다운로드' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'CSV 다운로드' }));
  await waitFor(() => {
    const body = api.post.mock.calls.find(([url]) => url === '/bi/explore/export')?.[1];
    expect(body.mode).toBe('pivot');
    expect(body.query).toMatchObject({ tableMode: 'flat', rowHierarchy: false });
  });
});
it('loads a version 4 view as the nested table so the flat mode stays opt-in', async () => {
  withViewsState(v4State);
  withTimedPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis?.grain).toBe('week'));
  expect(pivots().at(-1)?.[1].tableMode).toBeUndefined();
  expect(pivotToggle('Pivot 테이블')).toBe('true');
  expect(pivotToggle('Flat')).toBe('false');
});
it('refuses a version 5 view that omits the flat table mode', async () => {
  withViewsState({ ...v5FlatState, pivot: { ...v5FlatState.pivot, tableMode: undefined } });
  withFlatPivot();
  await mount();
  await openViewPanel();
  loadSelectedView();
  await screen.findByText(/저장된 탐색 조건의 버전을 확인할 수 없습니다/);
  expect(pivots().length).toBe(0);
});
it('renders the flat time-axis bucket as plain text while categorical record labels still filter', async () => {
  withTemporalDimension();
  const original = currentPost();
  api.post.mockImplementation(async (url: string, body: any, ...options: any[]) =>
    url === '/bi/explore/pivot'
      ? success(
          body.tableMode === 'flat'
            ? {
                ...flatResult(body),
                // The joined response carries a bucket label for the temporal column and the raw
                // member for the categorical one.
                rows: [
                  ['2023-09-10', 'Mobile/Tablet'],
                  ['2023-09-11', 'Personal Computer'],
                ],
              }
            : pivotResult(body),
        )
      : original(url, body, ...options),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: '__time' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].columnColumns).toEqual(['__time']));
  fireEvent.click(screen.getByRole('button', { name: '시간 축 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].timeAxis).toEqual({ column: '__time', grain: 'day', timeZone: 'UTC' }));
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBe('flat'));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(flatHeaders().slice(0, 2)).toEqual(['__time', 'device_type']);
  // A bucket label spans a range, so it must not offer the exact raw-column filter of a member.
  expect(screen.getByText('2023-09-10')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '2023-09-10', exact: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'Personal Computer', exact: true })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mobile/Tablet', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].filters).toEqual([{ column: 'device_type', values: ['Mobile/Tablet'] }]));
});
it('renders one flat total row when the joined record axis has no dimension', async () => {
  withFlatPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.click(screen.getByRole('button', { name: '구성 초기화' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual([]));
  fireEvent.click(screen.getByRole('button', { name: 'Flat', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].tableMode).toBe('flat'));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(flatHeaders()).toEqual(['Total Requests', 'Avg Bid Floor', 'Rows']);
  // The response repeats its only record as one empty tuple, so only the total row may render.
  expect(screen.getAllByRole('row').length).toBe(2);
  expect(screen.getByText('600')).toBeTruthy();
  expect(screen.queryByText('300')).toBeNull();
  expect(screen.queryByText('111')).toBeNull();
  expect(screen.queryByText('총합')).toBeNull();
});
it('ignores a v5 flat view that keeps a hierarchy, an expansion or a cell scope', async () => {
  const contradictions = [
    {
      ...v5FlatState.pivot,
      rowColumns: ['device_type', 'device_os'],
      rowHierarchy: true,
      expandedRows: [['Mobile/Tablet']],
    },
    {
      ...v5FlatState.pivot,
      rowSort: { by: 'value' as const, direction: 'desc' as const, measureId: 2, columnTuple: ['App'] },
    },
  ];
  for (const pivot of contradictions) {
    withViewsState({ ...v5FlatState, pivot });
    withFlatPivot();
    await mount();
    await openViewPanel();
    loadSelectedView();
    await screen.findByText(/저장된 탐색 조건의 버전을 확인할 수 없습니다/);
    expect(pivots().length).toBe(0);
    cleanup();
  }
});
