import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DimensionSeries from './DimensionSeries';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('echarts-for-react', () => ({
  default: ({ option, onEvents }: any) => (
    <div aria-label="chart mock">
      <button
        onClick={() => onEvents?.click({ value: option.series[0].data[option.series[0].data.length - 1] })}
        aria-label={`차트 점 선택 ${option.yAxis.name}`}
      >
        차트 점
      </button>
      <span data-testid="chart-use-utc">{String(option.useUTC)}</span>
      {option.series.map((series: any) => series.name).join(', ')}
      <output data-testid={`chart-data-${option.yAxis.name}`}>
        {JSON.stringify(option.series.map((series: any) => series.data))}
      </output>
    </div>
  ),
}));

const props = {
  sourceId: 5,
  sourceRevision: 'v1.9',
  measures: [
    { id: 1, label: '다운로드', unit: '건', decimalPlaces: 0 },
    { id: 2, label: '매출', unit: '원', decimalPlaces: 0 },
  ],
  dimensions: [{ column: 'app_version' }, { column: 'day', temporal: true }],
  filters: [{ column: 'country', values: ['KR'] }],
  dateRange: { column: 'day', start: '2026-01-08', end: '2026-01-31', timeZone: 'UTC' },
  grain: 'week' as const,
  measureIds: [1, 2],
  paused: false,
  onReloadCatalog: vi.fn(),
};
const seriesResult = {
  sourceRevision: 'v1.9',
  dimensionColumn: 'app_version',
  time: { column: 'day', grain: 'week', timeZone: 'UTC' as const },
  measures: props.measures,
  series: [
    {
      value: 'v1.9',
      label: 'v1.9',
      kpis: [
        { id: 1, value: 100 },
        { id: 2, value: 200 },
      ],
      points: [
        {
          time: '2026-01-05',
          values: [
            { id: 1, value: 40 },
            { id: 2, value: 80 },
          ],
        },
      ],
      truncated: false,
    },
    {
      value: 'v2.0',
      label: 'v2.0',
      kpis: [
        { id: 1, value: 120 },
        { id: 2, value: 240 },
      ],
      points: [
        {
          time: '2026-01-05',
          values: [
            { id: 1, value: 50 },
            { id: 2, value: 100 },
          ],
        },
      ],
      truncated: false,
    },
  ],
};
const success = (data: any) => ({ data: { status: 'SUCCESS', data } });
const values = (list: (string | number | boolean | null)[] = ['v1.9', 'v2.0', null, 'null', true, false]) =>
  success({ sourceRevision: 'v1.9', values: list, truncated: false });
const respondByRoute = (pivotData?: any) =>
  api.post.mockImplementation((url: string) => {
    if (url === '/bi/explore/series-values') return Promise.resolve(values());
    if (url === '/bi/explore/series') return Promise.resolve(success(seriesResult));
    if (url === '/bi/explore/pivot') return Promise.resolve(success(pivotData));
    throw new Error(`Unexpected endpoint ${url}`);
  });
const select = (value: string) => fireEvent.click(screen.getByRole('button', { name: value, exact: true }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('loads typed catalogue values and renders separate measure charts and exact aggregate totals', async () => {
  respondByRoute();
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  select('v2.0');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('region', { name: '시계열 데이터 표' });
  expect(screen.getByRole('img', { name: /다운로드 · v1.9, v2.0 값별 week 추세 차트/ })).toBeTruthy();
  expect(screen.getByRole('img', { name: /매출 · v1.9, v2.0 값별 week 추세 차트/ })).toBeTruthy();
  expect(screen.getAllByTestId('chart-use-utc').every(node => node.textContent === 'true')).toBe(true);
  expect(screen.getByRole('group', { name: '선택 값별 합계' }).textContent).toContain('100');
  expect(api.post).toHaveBeenCalledWith(
    '/bi/explore/series-values',
    expect.objectContaining({
      sourceId: 5,
      sourceRevision: 'v1.9',
      column: 'app_version',
      filters: props.filters,
      dateRange: props.dateRange,
    }),
    { signal: expect.any(AbortSignal) },
  );
  expect(api.post).toHaveBeenCalledWith(
    '/bi/explore/series',
    expect.objectContaining({
      sourceId: 5,
      sourceRevision: 'v1.9',
      dimensionColumn: 'app_version',
      dimensionValues: ['v1.9', 'v2.0'],
      measureIds: [1, 2],
      filters: props.filters,
      dateRange: props.dateRange,
      grain: 'week',
    }),
    { signal: expect.any(AbortSignal) },
  );
  fireEvent.click(screen.getByRole('button', { name: '2026-01-05' }));
  expect(screen.getByRole('region', { name: '선택 시점 상세' })).toBeTruthy();
});

it('hands the selected UTC bucket and frozen query to modern Pivot, then returns to the same trend selection', async () => {
  const pivotData = {
    sourceRevision: 'v1.9',
    rowColumns: ['app_version'],
    columnColumns: [],
    rows: [['v1.9'], ['v2.0']],
    columns: [],
    cells: [],
    rowTotals: [
      [
        { measureId: 1, value: 100 },
        { measureId: 2, value: 200 },
      ],
      [
        { measureId: 1, value: 120 },
        { measureId: 2, value: 240 },
      ],
    ],
    columnTotals: [],
    grandTotal: [],
  };
  respondByRoute(pivotData);
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  select('v2.0');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('button', { name: '선택 값 Pivot 열기' });
  fireEvent.click(screen.getByRole('button', { name: '2026-01-05' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 값 Pivot 열기' }));
  await screen.findByRole('region', { name: 'Pivot 표' });
  expect(api.post).toHaveBeenLastCalledWith(
    '/bi/explore/pivot',
    {
      sourceId: 5,
      sourceRevision: 'v1.9',
      measureIds: [1, 2],
      rowColumns: ['app_version'],
      columnColumns: [],
      filters: [...props.filters, { column: 'app_version', values: ['v1.9', 'v2.0'] }],
      dateRange: { column: 'day', start: '2026-01-08', end: '2026-01-11', timeZone: 'UTC' },
      comparePrevious: false,
    },
    { signal: expect.any(AbortSignal) },
  );
  fireEvent.click(screen.getByRole('button', { name: '추세로 돌아가기' }));
  expect(screen.getByRole('button', { name: '2026-01-05' }).getAttribute('aria-pressed')).toBe('true');
  expect(api.post.mock.calls.filter(([url]) => url === '/bi/explore/series')).toHaveLength(1);
});

it('keeps SQL null, literal null, and booleans as distinct typed dimension values', async () => {
  respondByRoute();
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'true', exact: true });
  expect(screen.getByRole('button', { name: '(값 없음)', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'null', exact: true })).toBeTruthy();
  select('(값 없음)');
  select('null');
  select('true');
  expect(screen.getByRole('button', { name: '(값 없음) 제거' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'null 제거' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await waitFor(() =>
    expect(api.post.mock.calls.some(([url, body]) => url === '/bi/explore/series' && body.dimensionValues[2] === true)).toBe(
      true,
    ),
  );
});

it('discards a late series response after the filter context changes', async () => {
  let resolveSeries!: (response: any) => void;
  api.post.mockImplementation((url: string) => {
    if (url === '/bi/explore/series-values') return Promise.resolve(values());
    if (url === '/bi/explore/series')
      return new Promise(resolve => {
        resolveSeries = resolve;
      });
    throw new Error(`Unexpected endpoint ${url}`);
  });
  const view = render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await waitFor(() => expect(resolveSeries).toBeTypeOf('function'));
  view.rerender(<DimensionSeries {...props} filters={[{ column: 'country', values: ['US'] }]} />);
  resolveSeries(success(seriesResult));
  await waitFor(() => expect(screen.queryByRole('group', { name: '선택 값별 합계' })).toBeNull());
  expect(screen.queryByRole('button', { name: '선택 값 Pivot 열기' })).toBeNull();
});

it('waits for the user to explicitly reload the catalogue after a version conflict', async () => {
  api.post.mockImplementation((url: string) => {
    if (url === '/bi/explore/series-values')
      return Promise.reject(Object.assign(new Error('stale'), { response: { status: 409 } }));
    return Promise.resolve(success(seriesResult));
  });
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: '카탈로그 새로고침' });
  expect(props.onReloadCatalog).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '카탈로그 새로고침' }));
  expect(props.onReloadCatalog).toHaveBeenCalledTimes(1);
});

it('keeps sparse UTC dates spaced and represents absent and explicit-null buckets as gaps', async () => {
  const sparse = {
    ...seriesResult,
    time: { ...seriesResult.time, grain: 'day' as const },
    series: [
      {
        ...seriesResult.series[0],
        points: [
          {
            time: '2026-01-14',
            values: [
              { id: 1, value: 7 },
              { id: 2, value: 70 },
            ],
          },
          {
            time: '2026-01-18',
            values: [
              { id: 1, value: null },
              { id: 2, value: 180 },
            ],
          },
        ],
      },
      {
        ...seriesResult.series[1],
        points: [
          {
            time: '2026-01-13',
            values: [
              { id: 1, value: 3 },
              { id: 2, value: 30 },
            ],
          },
          {
            time: '2026-01-18',
            values: [
              { id: 1, value: 9 },
              { id: 2, value: 90 },
            ],
          },
        ],
      },
    ],
  };
  api.post.mockImplementation((url: string) => {
    if (url === '/bi/explore/series-values') return Promise.resolve(values());
    if (url === '/bi/explore/series') return Promise.resolve(success(sparse));
    throw new Error(`Unexpected endpoint ${url}`);
  });
  render(<DimensionSeries {...props} grain="day" />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  select('v2.0');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('region', { name: '시계열 데이터 표' });
  const data = JSON.parse(screen.getByTestId('chart-data-건').textContent || '[]');
  const firstSeries: Array<[number, number | null]> = data[0];
  const firstObserved = firstSeries.findIndex(([time]) => time === Date.parse('2026-01-14T00:00:00.000Z'));
  const laterObserved = firstSeries.findIndex(([time]) => time === Date.parse('2026-01-18T00:00:00.000Z'));
  expect(laterObserved - firstObserved).toBe(4);
  expect(firstSeries.slice(firstObserved + 1, laterObserved)).toEqual([
    [Date.parse('2026-01-15T00:00:00.000Z'), null],
    [Date.parse('2026-01-16T00:00:00.000Z'), null],
    [Date.parse('2026-01-17T00:00:00.000Z'), null],
  ]);
  expect(firstSeries[laterObserved][1]).toBeNull();
});

it('disables the comparison and clears old results for a non-UTC date range', async () => {
  respondByRoute();
  const view = render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('region', { name: '시계열 데이터 표' });
  const before = api.post.mock.calls.length;
  view.rerender(<DimensionSeries {...props} dateRange={{ ...props.dateRange, timeZone: 'Asia/Seoul' }} />);
  expect(await screen.findByText(/UTC 기간만 지원합니다/)).toBeTruthy();
  expect(screen.queryByRole('region', { name: '시계열 데이터 표' })).toBeNull();
  expect((screen.getByRole('button', { name: '추세 비교' }) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(() => expect(api.post.mock.calls.length).toBe(before));
});

it('labels a successful empty selection as having no matching periods', async () => {
  const empty = {
    ...seriesResult,
    series: seriesResult.series.map(series => ({ ...series, points: [] })),
  };
  api.post.mockImplementation((url: string) => {
    if (url === '/bi/explore/series-values') return Promise.resolve(values());
    if (url === '/bi/explore/series') return Promise.resolve(success(empty));
    throw new Error(`Unexpected endpoint ${url}`);
  });
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  expect(await screen.findByText(/해당하는 추세 데이터가 없습니다/)).toBeTruthy();
});

it('selects the same detail bucket by chart point and keyboard-accessible time row', async () => {
  const next = {
    ...seriesResult,
    series: seriesResult.series.map(series => ({
      ...series,
      points: [
        ...series.points,
        {
          time: '2026-01-12',
          values: [
            { id: 1, value: 20 },
            { id: 2, value: 40 },
          ],
        },
      ],
    })),
  };
  api.post.mockImplementation((url: string) => Promise.resolve(url.endsWith('series-values') ? values() : success(next)));
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('region', { name: '시계열 데이터 표' });
  fireEvent.click(screen.getByRole('button', { name: '차트 점 선택 건' }));
  expect(screen.getByRole('button', { name: '2026-01-12' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('region', { name: '선택 시점 상세' }).textContent).toContain('2026-01-12');
});

it('keeps value lookup failure visible and retries only on an explicit search', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 503 } }).mockImplementation(() => Promise.resolve(values()));
  render(<DimensionSeries {...props} />);
  await screen.findByText('비교할 값을 불러오지 못했습니다. 값 검색으로 다시 시도해 주세요.');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '값 검색' }));
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls.every(([url]) => url === '/bi/explore/series-values')).toBe(true);
});

it('uses server result units and precision when catalogue definitions are nested', async () => {
  const catalogue = props.measures.map(({ unit, decimalPlaces, ...measure }) => ({
    ...measure,
    definition: { unit, decimalPlaces },
  }));
  const next = {
    ...seriesResult,
    measures: [{ id: 2, label: '전환율', unit: '%', decimalPlaces: 2 }],
    series: seriesResult.series.map(series => ({
      ...series,
      kpis: [{ id: 2, value: 23.92156862745 }],
      points: [{ time: '2026-01-05', values: [{ id: 2, value: 23.92156862745 }] }],
    })),
  };
  api.post.mockImplementation((url: string) => Promise.resolve(url.endsWith('series-values') ? values() : success(next)));
  render(<DimensionSeries {...props} measures={catalogue} measureIds={[2]} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  const table = await screen.findByRole('region', { name: '시계열 데이터 표' });
  expect(table.textContent).toContain('23.92%');
  expect(table.textContent).not.toContain('24');
});

it('removes a previous successful result after a revision conflict while preserving selected inputs', async () => {
  respondByRoute();
  render(<DimensionSeries {...props} />);
  await screen.findByRole('button', { name: 'v1.9', exact: true });
  select('v1.9');
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('region', { name: '시계열 데이터 표' });
  api.post.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: '추세 비교' }));
  await screen.findByRole('button', { name: '카탈로그 새로고침' });
  expect(screen.queryByRole('region', { name: '시계열 데이터 표' })).toBeNull();
  expect(screen.getByRole('button', { name: 'v1.9 제거' })).toBeTruthy();
  expect((screen.getByRole('button', { name: '추세 비교' }) as HTMLButtonElement).disabled).toBe(true);
});
