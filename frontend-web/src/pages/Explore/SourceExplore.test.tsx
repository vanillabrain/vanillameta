import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceExplore from './SourceExplore';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  search: 'sourceId=3',
  locationState: null as any,
  savedState: null as any,
  viewProps: null as any,
  conditionProps: null as any,
}));
vi.mock('./SourceConditions', () => ({
  default: (props: any) => {
    api.conditionProps = props;
    return <div />;
  },
}));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('@/helpers/authResponseFence', () => ({ captureAuthResponseFence: () => () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => api.navigate,
  useLocation: () => ({ state: api.locationState }),
  useSearchParams: () => [new URLSearchParams(api.search)],
}));
vi.mock('@/pages/Dashboard/Components/PersonalSavedViews', () => ({
  default: (props: any) => {
    api.viewProps = props;
    return (
      <section aria-label="탐색 저장 보기">
        <button onClick={() => props.onApply(api.savedState)}>테스트 보기 복원</button>
        <span>{props.disabledReason}</span>
      </section>
    );
  },
}));
vi.mock('@/pages/Dashboard/Components/MetricTrend', () => ({
  default: ({ title, trend, numberNotation, prefix, suffix, decimalPlaces, comparison }: any) => (
    <div
      data-testid="trend"
      data-timezone={trend?.timeZone ?? 'UTC'}
      data-points={trend?.points?.length ?? 0}
      data-notation={numberNotation}
      data-prefix={prefix}
      data-suffix={suffix}
      data-decimals={decimalPlaces}
      data-values={JSON.stringify(trend?.points)}
      data-comparison={JSON.stringify(comparison)}
    >
      {title} 추세
    </div>
  ),
}));
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const conflict = () => Object.assign(new Error('source revision mismatch'), { response: { status: 409 } });

const catalog = {
  sourceId: 3,
  name: 'rill-auction',
  sourceRevision: 'rev-3',
  viewRevision: 'a'.repeat(64),
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
  measureVersions: { '1': 7, '2': 8, '3': 9 },
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
  api.locationState = null;
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
        measureVersions: Object.fromEntries(body.measureIds.map((id: number) => [String(id), id + 6])),
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

it('continues a report with its exact initial conditions instead of first querying default measures', async () => {
  api.locationState = {
    initialExplore: {
      sourceId: 3,
      state: {
        version: 1,
        mode: 'explore',
        measureIds: [2],
        dimensionColumns: ['device_os'],
        rankingMeasureId: 2,
        leaderboardSort: { by: 'value', direction: 'desc' },
        filters: [{ column: 'device_type', values: ['Mobile/Tablet'] }],
        dateRange: null,
        relativePeriod: null,
        trendGrain: 'day',
        comparePrevious: false,
        includeRows: false,
      },
    },
  };
  render(<SourceExplore />);
  await waitFor(() => expect(api.post.mock.calls.some(([url]) => url === '/bi/explore/query')).toBe(true));
  const requests = api.post.mock.calls.filter(([url]) => url === '/bi/explore/query');
  expect(requests).toHaveLength(1);
  expect(requests[0][1]).toMatchObject({
    measureIds: [2],
    dimensionColumns: ['device_os'],
    filters: [{ column: 'device_type', values: ['Mobile/Tablet'] }],
  });
});

it('loads the catalog and queries with default selections over all data', async () => {
  await mount();
  expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/catalog')[1]).toEqual({ sourceId: 3 });
  expect(lastQuery()).toEqual({
    sourceId: 3,
    sourceRevision: 'rev-3',
    measureIds: [1, 2, 3],
    dimensionColumns: ['device_type', 'device_os'],
    rankingMeasureId: 1,
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
  fireEvent.change(source, { target: { value: '4' } });
  await waitFor(() => expect(lastQuery().sourceId).toBe(4));
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  const column = screen.getByLabelText('필터 열') as HTMLSelectElement;
  expect(column.tagName).toBe('SELECT');
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
  expect((screen.getByRole('button', { name: '이전 기간 비교' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  await waitFor(() =>
    expect(lastQuery().dateRange).toEqual({ column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'UTC' }),
  );
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(lastQuery().comparePrevious).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: '표시 시간대 Asia/Seoul' }));
  await waitFor(() => expect(lastQuery().dateRange.timeZone).toBe('Asia/Seoul'));
  expect(lastQuery().page).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
  await waitFor(() => expect(lastQuery().dateRange).toBeUndefined());
  expect(screen.getAllByText('전체 기간 · UTC').length).toBeGreaterThan(0);
  expect(screen.queryByText('전체 기간 · Asia/Seoul')).toBeNull();
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

it('applies saved compact notation to KPI and ranking and passes unrounded strings to trend/comparison without payload changes', async () => {
  api.post.mockImplementation(async (url: string) => {
    if (url === '/bi/explore/catalog')
      return success({
        ...catalog,
        measures: catalog.measures.map(measure => ({
          ...measure,
          definition: { ...measure.definition, numberNotation: measure.id === 1 ? 'compact' : 'plain' },
        })),
      });
    if (url === '/bi/explore/query')
      return success(
        queryResult({
          kpis: [
            {
              id: 1,
              title: 'Total Requests',
              value: '9007199254740993',
              trend: { points: [{ time: '2023-09-10T00:00:00Z', value: '9007199254740993' }] },
              comparison: { previousValue: '9007199254740991', delta: '2', percentChange: '0.01' },
            },
          ],
          leaderboards: [
            {
              column: 'device_type',
              rows: [
                {
                  category: 'Mobile/Tablet',
                  value: '999999',
                  previousValue: '9007199254740993',
                  delta: '-999999',
                  percentChange: '-10',
                },
              ],
            },
          ],
        }),
      );
    return success({});
  });
  await mount();
  expect(screen.getByText('9,007T').getAttribute('title')).toBe('9007199254740993');
  expect(screen.getByText('1M').getAttribute('title')).toBe('999999');
  expect(
    screen.getByRole('button', {
      name: '필터 적용: device_type = Mobile/Tablet',
      description: /999999.*9007199254740993/,
    }),
  ).toBeTruthy();
  expect(screen.getByText('이전 9,007T · 변화 -1M · -10.0%').getAttribute('aria-label')).toContain('9007199254740993');
  const trend = screen.getByTestId('trend');
  expect(trend.getAttribute('data-notation')).toBe('compact');
  expect(JSON.parse(trend.getAttribute('data-values'))[0].value).toBe('9007199254740993');
  expect(JSON.parse(trend.getAttribute('data-comparison')).previousValue).toBe('9007199254740991');
  expect(lastQuery()).not.toHaveProperty('numberNotation');
  expect(lastQuery().measureIds).toEqual([1, 2, 3]);
});

it('uses plain notation as full with fixed currency decimals in KPI and ranking', async () => {
  api.post.mockImplementation(async (url: string) => {
    if (url === '/bi/explore/catalog')
      return success({
        ...catalog,
        measures: catalog.measures.map(measure => ({
          ...measure,
          definition: { ...measure.definition, numberNotation: 'plain' },
        })),
      });
    if (url === '/bi/explore/query')
      return success(
        queryResult({
          kpis: [{ id: 2, title: 'Avg Bid Floor', value: '5', trend: { points: [{ time: '2023-09-10', value: '5' }] } }],
          leaderboards: [{ column: 'device_type', rows: [{ category: 'Mobile/Tablet', value: '5' }] }],
        }),
      );
    return success({});
  });
  await mount();
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: '기준 지표 Avg Bid Floor' }));
  await waitFor(() => expect(lastQuery().rankingMeasureId).toBe(2));
  await waitFor(() => expect(screen.getAllByText('$5.00')).toHaveLength(2));
  const trend = screen.getByTestId('trend');
  expect(trend.getAttribute('data-notation')).toBe('full');
  expect(trend.getAttribute('data-prefix')).toBe('$');
  expect(trend.getAttribute('data-decimals')).toBe('2');
});

const selectNumericRange = () => {
  fireEvent.click(screen.getByRole('button', { name: '필터 추가' }));
  fireEvent.change(screen.getByRole('combobox', { name: '필터 열' }), { target: { value: 'bid_floor' } });
  fireEvent.click(screen.getByRole('button', { name: '숫자 범위' }));
};
it('applies inclusive numeric bounds and removes a range without losing other selected conditions', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '필터 적용: device_type = Mobile/Tablet' }));
  await waitFor(() => expect(lastQuery().filters).toHaveLength(1));
  selectNumericRange();
  const before = api.post.mock.calls.filter(([url]) => url === '/bi/explore/query').length;
  fireEvent.change(screen.getByLabelText('최솟값 (포함)'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('최댓값 (포함)'), { target: { value: '10' } });
  expect(api.post.mock.calls.filter(([url]) => url === '/bi/explore/query')).toHaveLength(before);
  fireEvent.click(screen.getByRole('button', { name: '필터 적용', exact: true }));
  await waitFor(() =>
    expect(lastQuery().filters).toEqual([
      { column: 'device_type', values: ['Mobile/Tablet'] },
      { column: 'bid_floor', range: { min: 0, max: 10 } },
    ]),
  );
  expect(lastQuery().page).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: '삭제 bid_floor: 0 ~ 10 (양 끝 포함)' }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'device_type', values: ['Mobile/Tablet'] }]));
});
it('blocks empty, reversed, invalid and unsafe bounds and allows one-sided ranges', async () => {
  await mount();
  selectNumericRange();
  const before = api.post.mock.calls.filter(([url]) => url === '/bi/explore/query').length;
  for (const [min, max] of [
    ['', ''],
    ['10', '0'],
    ['1e999', ''],
    ['9007199254740993', ''],
    ['abc', '1'],
  ]) {
    fireEvent.change(screen.getByLabelText('최솟값 (포함)'), { target: { value: min } });
    fireEvent.change(screen.getByLabelText('최댓값 (포함)'), { target: { value: max } });
    fireEvent.click(screen.getByRole('button', { name: '필터 적용', exact: true }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(api.post.mock.calls.filter(([url]) => url === '/bi/explore/query')).toHaveLength(before);
  }
  fireEvent.change(screen.getByLabelText('최솟값 (포함)'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('최댓값 (포함)'), { target: { value: '-0.5' } });
  fireEvent.click(screen.getByRole('button', { name: '필터 적용', exact: true }));
  await waitFor(() => expect(lastQuery().filters).toEqual([{ column: 'bid_floor', range: { max: -0.5 } }]));
});
it('sends server sort criteria and resets comparison-only ordering when comparison is cleared', async () => {
  await mount();
  const changeSort = (by: string) =>
    fireEvent.change(screen.getByRole('combobox', { name: '차원 순위 기준' }), { target: { value: by } });
  expect((screen.getByRole('option', { name: '변화량' }) as HTMLOptionElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정' }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  changeSort('delta');
  fireEvent.change(screen.getByRole('combobox', { name: '차원 순위 방향' }), { target: { value: 'asc' } });
  await waitFor(() => expect(lastQuery().leaderboardSort).toEqual({ by: 'delta', direction: 'asc' }));
  changeSort('percentChange');
  await waitFor(() => expect(lastQuery().leaderboardSort).toEqual({ by: 'percentChange', direction: 'asc' }));
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교' }));
  await waitFor(() => expect(lastQuery().leaderboardSort).toBeUndefined());
  expect(lastQuery().comparePrevious).toBe(false);
});

it('saved view restoration applies all selections in one query and resets detail pagination', async () => {
  render(<SourceExplore />);
  await waitFor(() => expect(queries().length).toBe(1));
  api.savedState = {
    version: 1,
    measureIds: [2, 1],
    dimensionColumns: ['device_type'],
    rankingMeasureId: 2,
    leaderboardSort: { by: 'percentChange', direction: 'asc' },
    filters: [{ column: 'bid_floor', range: { min: 0, max: 10 } }],
    dateRange: { column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'Asia/Seoul' },
    relativePeriod: null,
    trendGrain: 'week',
    comparePrevious: true,
    includeRows: true,
  };
  fireEvent.click(screen.getByRole('button', { name: '저장 보기', exact: true }));
  expect(api.viewProps.endpoint).toBe('/bi/explore/3/views');
  expect(api.viewProps.revision).toBe(catalog.viewRevision);
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: '테스트 보기 복원' }));
  await waitFor(() => expect(queries().length).toBe(before + 1));
  expect(lastQuery()).toMatchObject({
    sourceId: 3,
    sourceRevision: 'rev-3',
    measureIds: [2, 1],
    dimensionColumns: ['device_type'],
    rankingMeasureId: 2,
    leaderboardSort: { by: 'percentChange', direction: 'asc' },
    filters: api.savedState.filters,
    dateRange: api.savedState.dateRange,
    trendGrain: 'week',
    comparePrevious: true,
    includeRows: true,
    page: 0,
  });
});

it('saved view controls block saving unapplied/incomplete dates and pass settings without query rows', async () => {
  render(<SourceExplore />);
  await waitFor(() => expect(queries().length).toBe(1));
  fireEvent.click(screen.getByRole('button', { name: '저장 보기', exact: true }));
  expect(api.viewProps.state).toEqual({
    version: 1,
    measureIds: [1, 2, 3],
    dimensionColumns: ['device_type', 'device_os'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: false,
  });
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정', exact: true }));
  expect(api.viewProps.disabledReason).toBe('완성한 기간을 적용한 뒤 저장해 주세요.');
});

it('pivot mode reuses current period/filters and stops Explore requests until returning', async () => {
  await mount();
  const base = api.post.getMockImplementation();
  api.post.mockImplementation(async (url, body, ...rest) =>
    url === '/bi/explore/pivot'
      ? success({
          sourceRevision: body.sourceRevision,
          metrics: [],
          rows: [],
          columns: [],
          grandTotals: [],
          limits: { truncatedRows: false, truncatedColumns: false },
        })
      : base(url, body, ...rest),
  );
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await waitFor(() => expect(api.post.mock.calls.some(([url]) => url === '/bi/explore/pivot')).toBe(true));
  expect(queries().length).toBe(before);
  expect(screen.queryByRole('button', { name: '이전 기간 비교', exact: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Explore', exact: true }));
  await waitFor(() => expect(queries().length).toBe(before + 1));
});

it('explains forbidden source access without offering an ineffective catalog retry', async () => {
  api.post.mockRejectedValue(Object.assign(new Error('denied'), { response: { status: 403 } }));
  render(<SourceExplore />);
  await screen.findByText(/이 데이터 소스에 접근할 권한이 없습니다/);
  expect(screen.queryByRole('button', { name: '카탈로그 다시 불러오기' })).toBeNull();
  expect(screen.queryByRole('region', { name: '탐색 저장 보기' })).toBeNull();
  const requests = api.post.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: '다른 데이터 소스 선택' }));
  await waitFor(() => expect(screen.queryByText(/이 데이터 소스에 접근할 권한이 없습니다/)).toBeNull());
  expect(api.post.mock.calls.length).toBe(requests);
});

/**
 * Remote (develop-v2) surfaces kept by the merge: the versioned POST /bi/explore/views/* saved views,
 * the CSV export and the advanced ExplorePivot, which now lives behind the 고급 Pivot mode so the
 * classic PivotTable and its restful saved views stay untouched.
 */
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
const pivotResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  measureVersions: Object.fromEntries((body.measureIds ?? [1, 2]).map((id: number) => [String(id), id + 6])),
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
  measureVersions: Object.fromEntries((body.measureIds ?? [1, 2]).map((id: number) => [String(id), id + 6])),
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
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 2'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual(['device_type', 'device_os']));
  fireEvent.click(screen.getByRole('button', { name: '행 계층 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true));
  await screen.findByRole('button', { name: '(값 없음) 펼치기' });
};
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
const timedColumnGroups = (body: any): unknown[][] => {
  const first = body.columnColumns?.[0];
  if (first === 'device_os') return [['Android'], ['iOS']];
  if (first === 'device_type') return [['Mobile/Tablet'], ['Personal Computer']];
  return body.columnColumns?.length ? [['A'], ['B']] : [[]];
};
const timedPivotResult = (body: any) => ({
  sourceRevision: body.sourceRevision,
  measureVersions: Object.fromEntries((body.measureIds ?? [1, 2]).map((id: number) => [String(id), id + 6])),
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
it('restores persisted versioned exploration conditions after remount and resets raw pagination', async () => {
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
      // The merged page keeps the HEAD query contract for the ranking order.
      leaderboardSort: savedState.rankingSort,
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
      measureVersions: { '1': 7, '2': 8 },
      state: savedState,
    }),
  );
});

it('keeps current query on stale versioned saved-view conflict and permits removing the stale view', async () => {
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

it('ignores a delayed versioned saved-view restore after changing source', async () => {
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

it('blocks saving a versioned view when the actual query response has no measure versions', async () => {
  withViews();
  const original = currentPost();
  api.post.mockImplementation((url: string, ...args: any[]) =>
    url === '/bi/explore/query'
      ? Promise.resolve(success(queryResult({ measureVersions: undefined })))
      : original(url, ...args),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  fireEvent.change(screen.getByLabelText('새 보기 이름'), { target: { value: '새 보기' } });
  expect((screen.getByRole('button', { name: '현재 조건 저장' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/지표 정의 버전을 확인할 수 없습니다/)).toBeTruthy();
  expect(api.post.mock.calls.some(([url]) => url === '/bi/explore/views/create')).toBe(false);
});

it('uses advanced Pivot server totals and sparse null cells, preserves large integers, swaps axes and filters from rows', async () => {
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Explore', exact: true }));
  await waitFor(() => expect(lastQuery()).toMatchObject({ filters: savedState.filters, comparePrevious: true }));
});

it('clears old advanced Pivot results on limit error and permits changing axes to recover', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: 'device_os' } });
  await screen.findByText(/Pivot 열 그룹은 최대 20개/);
  expect(screen.queryByRole('region', { name: 'Pivot 결과' })).toBeNull();
  fireEvent.change(screen.getByLabelText('열 차원 1'), { target: { value: '' } });
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(screen.queryByText(/Pivot 열 그룹은 최대 20개/)).toBeNull();
});

it('ignores a delayed advanced Pivot response after source changes', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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

it('sends the advanced Pivot row sort for the chosen measure and reverts to label sorting', async () => {
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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

it('ignores a superseded advanced Pivot response after the row sort changes', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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

it('keeps the v2 saved shape when advanced Pivot axes carry no hierarchy or custom sort', async () => {
  withViews();
  withPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.change(screen.getByLabelText('행 차원 2'), { target: { value: 'device_os' } });
  await waitFor(() => expect(pivots().at(-1)?.[1].rowColumns).toEqual(['device_type', 'device_os']));
  fireEvent.click(screen.getByRole('button', { name: '행 계층 꺼짐' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].rowHierarchy).toBe(true));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Android', exact: true }).length).toBe(2));
  expect(screen.queryByRole('button', { name: '(값 없음) 펼치기' })).toBeNull();
  expect(screen.queryByText('부분합')).toBeNull();
});

it('sends the advanced Pivot time grain as day, week and month with the business time zone', async () => {
  withTemporalDimension();
  withTimedPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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

it('scopes the advanced Pivot row sort to the clicked cell header for delta and percentChange', async () => {
  withTimedPivot();
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
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

it('keeps aggregate segment scope separate from Explore saved views and exports', async () => {
  render(<SourceExplore />);
  await screen.findByRole('button', { name: '집계 조건' });
  fireEvent.click(screen.getByRole('button', { name: '집계 조건' }));
  await screen.findByRole('region', { name: '집계 조건 탐색' });
  expect(screen.queryByRole('button', { name: '저장 보기' })).toBeNull();
  expect(screen.queryByRole('button', { name: '이전 기간 비교' })).toBeNull();
  expect(screen.queryByRole('button', { name: /표시 설정/ })).toBeNull();
  expect(api.post.mock.calls.filter(([url]: any[]) => url === '/bi/explore/segments')).toHaveLength(0);
});

it('does not reuse a segment restoration after leaving the segment flow', async () => {
  api.savedState = {
    version: 1,
    mode: 'segment',
    segment: { dimensionColumn: 'device_type', conditions: [{ measureId: 1, operator: 'gte', value: 1000 }] },
    measureIds: [1],
    dimensionColumns: ['device_type'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: false,
  };
  render(<SourceExplore />);
  await screen.findByRole('button', { name: '저장 보기' });
  fireEvent.click(screen.getByRole('button', { name: '저장 보기' }));
  fireEvent.click(screen.getByRole('button', { name: '테스트 보기 복원' }));
  await screen.findByText(/저장한 집계 조건을 복원/);
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('1000');
  fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
  fireEvent.click(screen.getByRole('button', { name: '집계 조건' }));
  expect((screen.getByLabelText('조건 1 기준값') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText(/저장한 집계 조건을 복원/)).toBeNull();
});

const conditionSnapshot = () => ({
  sourceRevision: 'a'.repeat(64),
  definition: {
    include: { kind: 'predicate', column: 'device_type', operator: 'eq', values: ['App'] },
    exclude: null,
  },
});
const withConditionCatalog = () => {
  const original = currentPost();
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) =>
    url === '/bi/explore/catalog'
      ? Promise.resolve(success({ ...catalog, sourceRevision: 'a'.repeat(64) }))
      : original(url, body, ...rest),
  );
};
it('explicitly applies the same immutable snapshot to query, values, classic/advanced Pivot, saved states and exports', async () => {
  withPivot();
  withConditionCatalog();
  const original = currentPost();
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) =>
    url === '/bi/explore/export' ? Promise.reject(new Error('stop after request')) : original(url, body, ...rest),
  );
  await mount();
  const snapshot = conditionSnapshot();
  act(() => api.conditionProps.onApply(snapshot));
  await waitFor(() => expect(lastQuery().conditions).toEqual(snapshot));
  snapshot.definition.include.values[0] = 'mutated';
  expect(lastQuery().conditions).toEqual(conditionSnapshot());
  expect(screen.getByRole('region', { name: '적용한 분석 조건' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '저장 보기', exact: true }));
  expect(api.viewProps.state.conditions).toEqual(conditionSnapshot());
  // Existing value picker issues the same scoped request.
  fireEvent.click(screen.getByRole('button', { name: /필터 추가/ }));
  fireEvent.change(screen.getByLabelText('필터 열'), { target: { value: 'device_os' } });
  await waitFor(() => expect(lastValues()?.conditions).toEqual(conditionSnapshot()));
  fireEvent.click(screen.getByRole('button', { name: 'Pivot', exact: true }));
  await waitFor(() => expect(pivots().at(-1)?.[1].conditions).toEqual(conditionSnapshot()));
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  expect(pivots().at(-1)?.[1].conditions).toEqual(conditionSnapshot());
  fireEvent.click(screen.getByRole('button', { name: '내보내기 ▾' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'CSV 다운로드' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'CSV 다운로드' }));
  await waitFor(() =>
    expect(api.post.mock.calls.find(([url]) => url === '/bi/explore/export')?.[1].query).toMatchObject({
      conditions: conditionSnapshot(),
      expectedMeasureVersions: { '1': 7, '2': 8, '3': 9 },
    }),
  );
  expect(api.post.mock.calls.some(([url]) => url === '/bi/source-conditions/save')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '분석 조건 제거' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].conditions).toBeUndefined());
});

it('preserves conditions and draft period on catalog reload, blocks a changed file and allows explicit removal', async () => {
  withConditionCatalog();
  await mount();
  act(() => api.conditionProps.onApply(conditionSnapshot()));
  await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  fireEvent.click(screen.getByRole('button', { name: '사용자 지정', exact: true }));
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2023-09-10' } });
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2023-09-11' } });
  const original = currentPost();
  let revision = 'a'.repeat(64);
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) => {
    if (url === '/bi/explore/catalog') return Promise.resolve(success({ ...catalog, sourceRevision: revision }));
    if (url === '/bi/explore/query') return Promise.reject(conflict());
    return original(url, body, ...rest);
  });
  fireEvent.click(screen.getByRole('button', { name: '이전 기간 비교', exact: true }));
  await screen.findByRole('button', { name: '카탈로그 다시 불러오기' });
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 다시 불러오기' }));
  await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  await screen.findByRole('button', { name: '카탈로그 다시 불러오기' });
  expect((screen.getByLabelText('시작일') as HTMLInputElement).value).toBe('2023-09-10');
  revision = 'b'.repeat(64);
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 다시 불러오기' }));
  await screen.findByText(/적용 조건의 파일 버전이 다릅니다/);
  const before = queries().length;
  fireEvent.click(screen.getByRole('button', { name: 'Explore', exact: true }));
  await act(async () => undefined);
  expect(queries()).toHaveLength(before);
  expect((screen.getByLabelText('시작일') as HTMLInputElement).value).toBe('2023-09-10');
  fireEvent.click(screen.getByRole('button', { name: '분석 조건 제거' }));
  await waitFor(() => expect(queries().length).toBeGreaterThan(before));
  expect(lastQuery().conditions).toBeUndefined();
});

it('rejects a mismatched applied snapshot without dropping the current scoped draft', async () => {
  withConditionCatalog();
  await mount();
  act(() => api.conditionProps.onApply(conditionSnapshot()));
  await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  const before = queries().length;
  act(() => api.conditionProps.onApply({ ...conditionSnapshot(), sourceRevision: 'b'.repeat(64) }));
  await screen.findByText(/적용 조건의 파일 버전이 다릅니다/);
  expect(queries()).toHaveLength(before);
  expect(lastQuery().conditions).toEqual(conditionSnapshot());
});

it.each([1, 2, 3, 4, 5])('restores optional conditions from saved view v%i using the same file snapshot', async version => {
  withViews();
  withPivot();
  withConditionCatalog();
  const original = currentPost();
  const state = {
    ...savedState,
    version,
    conditions: conditionSnapshot(),
    ...(version >= 2
      ? {
          pivot: {
            enabled: true,
            rowColumns: ['device_type'],
            columnColumns: [],
            ...(version >= 3 ? { rowHierarchy: false, rowSort: { by: 'label', direction: 'asc' }, expandedRows: [] } : {}),
            ...(version >= 5 ? { tableMode: 'flat' } : {}),
          },
        }
      : {}),
  };
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) =>
    url === '/bi/explore/views/load'
      ? Promise.resolve(success({ ...savedView, sourceRevision: 'a'.repeat(64), state }))
      : original(url, body, ...rest),
  );
  await mount();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await waitFor(() =>
    expect(version === 1 ? lastQuery().conditions : pivots().at(-1)?.[1].conditions).toEqual(conditionSnapshot()),
  );
  expect(screen.getByRole('region', { name: '적용한 분석 조건' })).toBeTruthy();
});

it('rejects a saved condition file mismatch before any current draft changes', async () => {
  withViews();
  withConditionCatalog();
  const original = currentPost();
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) =>
    url === '/bi/explore/views/load'
      ? Promise.resolve(
          success({
            ...savedView,
            sourceRevision: 'a'.repeat(64),
            state: {
              ...savedState,
              conditions: { ...conditionSnapshot(), sourceRevision: 'b'.repeat(64) },
            },
          }),
        )
      : original(url, body, ...rest),
  );
  await mount();
  act(() => api.conditionProps.onApply(conditionSnapshot()));
  await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  const before = lastQuery();
  fireEvent.click(screen.getByRole('button', { name: '탐색 보기', exact: true }));
  await screen.findByRole('option', { name: savedView.name });
  fireEvent.change(screen.getByLabelText('저장한 탐색 보기'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: '보기 열기' }));
  await screen.findByText(/적용 조건의 파일 버전이 다릅니다/);
  expect(lastQuery()).toEqual(before);
});

it('freezes actual Pivot basis and conditions in a durable request while later scoped edits preserve ambiguous confirmation', async () => {
  withPivot();
  withConditionCatalog();
  const original = currentPost();
  api.post.mockImplementation((url: string, body: any, ...rest: any[]) =>
    url === '/bi/export-jobs' ? Promise.reject(new Error('transport lost')) : original(url, body, ...rest),
  );
  await mount();
  act(() => api.conditionProps.onApply(conditionSnapshot()));
  await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  fireEvent.click(screen.getByRole('button', { name: '고급 Pivot', exact: true }));
  await screen.findByRole('region', { name: 'Pivot 결과' });
  fireEvent.click(screen.getByRole('button', { name: '파일 작업 펼치기' }));
  const create = screen.getByRole('button', { name: '현재 조건으로 작업 접수' });
  await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(create);
  await screen.findByRole('button', { name: '같은 접수 재확인' });
  const requests = () => api.post.mock.calls.filter(([url]) => url === '/bi/export-jobs');
  const frozen = JSON.parse(JSON.stringify(requests()[0][1]));
  expect(frozen).toMatchObject({
    measureVersions: { '1': 7, '2': 8, '3': 9 },
    payload: {
      mode: 'pivot',
      query: { conditions: conditionSnapshot() },
    },
  });
  expect(frozen.payload.query.expectedMeasureVersions).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: '분석 조건 제거' }));
  await waitFor(() => expect(pivots().at(-1)?.[1].conditions).toBeUndefined());
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '같은 접수 재확인' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '같은 접수 재확인' }));
  await waitFor(() => expect(requests()).toHaveLength(2));
  expect(requests()[1][1]).toEqual(frozen);
});

it.each(['집계 조건', '차원 추세 비교'])(
  'preserves applied conditions and blocks unsupported %s without an unscoped request',
  async label => {
    withConditionCatalog();
    await mount();
    act(() => api.conditionProps.onApply(conditionSnapshot()));
    await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
    api.post.mockClear();
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    await screen.findByText(/이 탐색 방식은 적용한 분석 조건을 아직 지원하지 않습니다/);
    expect(screen.getByRole('region', { name: '적용한 분석 조건' })).toBeTruthy();
    expect(
      api.post.mock.calls.some(([url]) => url === '/bi/explore/segments' || url === '/bi/explore/dimension-series'),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Explore', exact: true }));
    await waitFor(() => expect(lastQuery().conditions).toEqual(conditionSnapshot()));
  },
);
