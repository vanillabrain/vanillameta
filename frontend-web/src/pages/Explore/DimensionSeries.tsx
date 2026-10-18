import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMetric } from '@/utils/formatMetric';
import type { ExploreDateRange, ExploreFilter } from './exploreViewState';

type Scalar = string | number | boolean | null;
type Measure = { id: number; label: string; unit?: string; decimalPlaces?: number };
type Point = { time: string; values: Array<{ id: number; value: number | string | null }> };
type Series = {
  value: Scalar;
  label: string;
  kpis: Array<{ id: number; value: unknown }>;
  points: Point[];
  truncated: boolean;
};
type SeriesResult = {
  sourceRevision: string;
  dimensionColumn: string;
  time: { column: string; grain: 'day' | 'week' | 'month'; timeZone: 'UTC' };
  measures: Measure[];
  series: Series[];
};
type PivotValue = { measureId: number; value: unknown };
type PivotResult = {
  sourceRevision: string;
  rowColumns: string[];
  columnColumns: string[];
  rows: unknown[][];
  rowTotals: PivotValue[][];
  columnTotals: PivotValue[][];
  grandTotal: PivotValue[];
};
type FrozenQuery = {
  key: string;
  sourceId: number;
  sourceRevision: string;
  dimension: string;
  values: Scalar[];
  measureIds: number[];
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  grain: 'day' | 'week' | 'month';
  timeColumn: string;
};

const label = (value: unknown) => (value === null ? '(값 없음)' : value === '' ? '(빈 문자열)' : String(value));
const format = (value: unknown, measure: Measure) =>
  formatMetric(value, {
    decimalPlaces: measure.decimalPlaces ?? 0,
    prefix: ['$', '₩', '€', '£', '¥'].includes(measure.unit ?? '') ? measure.unit : '',
    suffix:
      measure.unit === '%'
        ? '%'
        : measure.unit && !['$', '₩', '€', '£', '¥'].includes(measure.unit)
        ? ` ${measure.unit}`
        : '',
  }).text;
const unwrap = <T,>(response: any): T => {
  if (response?.data?.status !== 'SUCCESS')
    throw Object.assign(new Error('request failed'), { response: response?.response });
  return response.data.data as T;
};
const bucketRange = (time: string, grain: FrozenQuery['grain'], column: string): ExploreDateRange => {
  const date = new Date(`${time}T00:00:00.000Z`);
  if (grain === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    const start = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() + 6);
    return { column, start, end: date.toISOString().slice(0, 10), timeZone: 'UTC' };
  }
  if (grain === 'month') {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    return {
      column,
      start: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
      end: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
      timeZone: 'UTC',
    };
  }
  return { column, start: time, end: time, timeZone: 'UTC' };
};
const denseTimeline = (observed: string[], grain: FrozenQuery['grain']) => {
  const sorted = Array.from(new Set(observed)).sort();
  if (!sorted.length) return { times: [] as string[], truncated: false };
  const start = bucketRange(sorted[0], grain, '').start;
  const end = sorted[sorted.length - 1];
  const times: string[] = [];
  const date = new Date(`${start}T00:00:00.000Z`);
  while (date.toISOString().slice(0, 10) <= end && times.length < 400) {
    times.push(date.toISOString().slice(0, 10));
    if (grain === 'day') date.setUTCDate(date.getUTCDate() + 1);
    else if (grain === 'week') date.setUTCDate(date.getUTCDate() + 7);
    else date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return { times, truncated: date.toISOString().slice(0, 10) <= end };
};

/** Keep the actual canvas in sync even when a resize occurs during the chart's first animation. */
function SeriesChart({ option, onEvents }: { option: any; onEvents: Record<string, (point: any) => void> }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<{ resize: () => void } | null>(null);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chart.current = null;
    };
  }, []);
  return (
    <div ref={container} className="min-w-0">
      <ReactECharts
        option={option}
        style={{ height: 320, width: '100%' }}
        onEvents={onEvents}
        onChartReady={instance => {
          chart.current = instance;
          instance.resize();
        }}
      />
    </div>
  );
}

/** A bounded multi-series comparison with an explicit, state-preserving Pivot handoff. */
export default function DimensionSeries({
  sourceId,
  sourceRevision,
  measures,
  dimensions,
  filters,
  dateRange,
  grain,
  measureIds,
  paused,
  onReloadCatalog,
}: {
  sourceId: number;
  sourceRevision: string;
  measures: Measure[];
  dimensions: Array<{ column: string; numeric?: boolean; temporal?: boolean }>;
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  grain: 'day' | 'week' | 'month';
  measureIds: number[];
  paused: boolean;
  onReloadCatalog: () => void;
}) {
  const eligible = dimensions.filter(item => !item.numeric && !item.temporal);
  const utcScope = !dateRange?.timeZone || dateRange.timeZone === 'UTC';
  const [dimension, setDimension] = useState(eligible[0]?.column ?? '');
  const [selectedValues, setSelectedValues] = useState<Scalar[]>([]);
  const [valueSearch, setValueSearch] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const [availableValues, setAvailableValues] = useState<Scalar[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [valuesTruncated, setValuesTruncated] = useState(false);
  const [result, setResult] = useState<SeriesResult | null>(null);
  const [frozen, setFrozen] = useState<FrozenQuery | null>(null);
  const [activeTime, setActiveTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadRequired, setReloadRequired] = useState(false);
  const [pivot, setPivot] = useState<PivotResult | null>(null);
  const [pivotBusy, setPivotBusy] = useState(false);
  const generation = useRef(0);
  const valuesGeneration = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const selectedMeasures = useMemo(
    () => (result?.measures ?? measures).filter(measure => measureIds.includes(measure.id)),
    [result, measures, measureIds],
  );
  const contextKey = useMemo(
    () =>
      JSON.stringify({ sourceId, sourceRevision, dimension, selectedValues, measureIds, filters, dateRange, grain, paused }),
    [sourceId, sourceRevision, dimension, selectedValues, measureIds, filters, dateRange, grain, paused],
  );
  const valueKey = useMemo(
    () => JSON.stringify({ sourceId, sourceRevision, dimension, filters, dateRange, search: valueSearch, searchNonce }),
    [sourceId, sourceRevision, dimension, filters, dateRange, valueSearch, searchNonce],
  );
  const timeline = denseTimeline(
    (result?.series ?? []).flatMap(series => series.points.map(point => point.time)),
    result?.time.grain ?? grain,
  );
  const times = timeline.times;
  const selectedTime = times.includes(activeTime) ? activeTime : times[0] ?? '';

  useEffect(() => {
    generation.current += 1;
    abort.current?.abort();
    abort.current = null;
    setResult(null);
    setFrozen(null);
    setPivot(null);
    setActiveTime('');
    setBusy(false);
    setPivotBusy(false);
    setError('');
    setReloadRequired(false);
    if (!utcScope) {
      setSelectedValues([]);
      setAvailableValues([]);
      setValuesLoading(false);
    }
    return () => {
      generation.current += 1;
      abort.current?.abort();
      abort.current = null;
    };
  }, [contextKey, utcScope]);

  useEffect(() => {
    const controller = new AbortController();
    valuesGeneration.current += 1;
    const requestGeneration = valuesGeneration.current;
    abort.current?.abort();
    abort.current = controller;
    setAvailableValues([]);
    setValuesTruncated(false);
    if (!utcScope || paused || !sourceId || !sourceRevision || !dimension) {
      setValuesLoading(false);
      return () => controller.abort();
    }
    setValuesLoading(true);
    post(
      '/bi/explore/series-values',
      { sourceId, sourceRevision, column: dimension, search: valueSearch, filters, ...(dateRange ? { dateRange } : {}) },
      { signal: controller.signal },
    )
      .then(response => {
        const data = unwrap<{ sourceRevision: string; values: Scalar[]; truncated: boolean }>(response);
        if (valuesGeneration.current === requestGeneration && data.sourceRevision === sourceRevision) {
          setAvailableValues(data.values);
          setValuesTruncated(data.truncated);
        }
      })
      .catch(failure => {
        if (controller.signal.aborted || valuesGeneration.current !== requestGeneration) return;
        setResult(null);
        setFrozen(null);
        setPivot(null);
        if (failure?.response?.status === 409 && valuesGeneration.current === requestGeneration) {
          setReloadRequired(true);
          setError('카탈로그 버전이 변경되었습니다. 명시적으로 카탈로그를 새로고침한 뒤 다시 시도해 주세요.');
        } else
          setError(
            failure?.response?.status === 403
              ? '이 소스의 비교 값을 조회할 권한이 없습니다.'
              : '비교할 값을 불러오지 못했습니다. 값 검색으로 다시 시도해 주세요.',
          );
      })
      .finally(() => {
        if (valuesGeneration.current === requestGeneration) setValuesLoading(false);
      });
    return () => controller.abort();
  }, [valueKey, paused, sourceId, sourceRevision, dimension, filters, dateRange, valueSearch, utcScope]);

  const run = async () => {
    if (busy || paused || !utcScope || !dimension || !selectedValues.length || !measureIds.length) return;
    generation.current += 1;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    const query: FrozenQuery = {
      key: contextKey,
      sourceId,
      sourceRevision,
      dimension,
      values: [...selectedValues],
      measureIds: [...measureIds],
      filters: structuredClone(filters),
      ...(dateRange ? { dateRange: { ...dateRange } } : {}),
      grain,
      timeColumn: dateRange?.column ?? dimensions.find(item => item.temporal)?.column ?? '',
    };
    setBusy(true);
    setError('');
    setReloadRequired(false);
    setResult(null);
    setFrozen(null);
    setPivot(null);
    try {
      const response = await post(
        '/bi/explore/series',
        {
          sourceId,
          sourceRevision,
          dimensionColumn: dimension,
          dimensionValues: [...selectedValues],
          measureIds: [...measureIds],
          filters,
          ...(dateRange ? { dateRange } : {}),
          grain,
        },
        { signal: controller.signal },
      );
      const next = unwrap<SeriesResult>(response);
      if (generation.current !== requestGeneration || controller.signal.aborted || next.sourceRevision !== sourceRevision)
        return;
      setResult(next);
      setFrozen({ ...query, timeColumn: next.time.column });
      setActiveTime('');
    } catch (failure: any) {
      if (generation.current !== requestGeneration || controller.signal.aborted) return;
      if (failure?.response?.status === 409) {
        setReloadRequired(true);
        setError('카탈로그 버전이 변경되었습니다. 명시적으로 카탈로그를 새로고침한 뒤 다시 시도해 주세요.');
      } else
        setError(
          failure?.response?.status === 403
            ? '이 소스의 집계 결과를 조회할 권한이 없습니다.'
            : '비교 추세를 불러오지 못했습니다. 조건을 확인해 다시 시도해 주세요.',
        );
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  };

  const openPivot = async () => {
    if (!result || !frozen || frozen.key !== contextKey || !selectedTime || pivotBusy) return;
    if (frozen.dateRange && frozen.dateRange.column !== frozen.timeColumn) {
      setError('선택 기간과 추세 버킷이 서로 다른 날짜 열이라 Pivot 기간을 함께 유지할 수 없습니다.');
      return;
    }
    generation.current += 1;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setPivotBusy(true);
    setError('');
    const period = bucketRange(selectedTime, frozen.grain, frozen.timeColumn);
    if (frozen.dateRange) {
      period.start = period.start > frozen.dateRange.start ? period.start : frozen.dateRange.start;
      period.end = period.end < frozen.dateRange.end ? period.end : frozen.dateRange.end;
    }
    const sameDimension = frozen.filters.find(filter => filter.column === frozen.dimension);
    if (sameDimension && !('values' in sameDimension)) {
      setError('선택한 차원에 범위 필터가 있어 같은 조건을 Pivot으로 유지할 수 없습니다.');
      setPivotBusy(false);
      return;
    }
    const dimensionValues =
      sameDimension && 'values' in sameDimension
        ? frozen.values.filter(value => sameDimension.values.some(candidate => Object.is(candidate, value)))
        : frozen.values;
    const pivotFilters = [
      ...frozen.filters.filter(filter => filter.column !== frozen.dimension),
      { column: frozen.dimension, values: dimensionValues },
    ];
    try {
      const response = await post(
        '/bi/explore/pivot',
        {
          sourceId: frozen.sourceId,
          sourceRevision: frozen.sourceRevision,
          measureIds: frozen.measureIds,
          rowColumns: [frozen.dimension],
          columnColumns: [],
          filters: pivotFilters,
          dateRange: period,
          comparePrevious: false,
        },
        { signal: controller.signal },
      );
      const next = unwrap<PivotResult>(response);
      if (
        generation.current !== requestGeneration ||
        controller.signal.aborted ||
        next.sourceRevision !== frozen.sourceRevision
      )
        return;
      setPivot(next);
    } catch (failure: any) {
      if (generation.current !== requestGeneration || controller.signal.aborted) return;
      if (failure?.response?.status === 409) {
        setReloadRequired(true);
        setResult(null);
        setFrozen(null);
        setPivot(null);
        setError(
          '카탈로그 버전이 변경되었습니다. 명시적으로 카탈로그를 새로고침한 뒤 다시 시도해 주세요. 추세 조건은 보존됩니다.',
        );
      } else {
        if (failure?.response?.status === 403) {
          setResult(null);
          setFrozen(null);
          setPivot(null);
        }
        setError('같은 조건의 Pivot을 불러오지 못했습니다. 추세 조건은 유지됩니다.');
      }
    } finally {
      if (generation.current === requestGeneration) setPivotBusy(false);
    }
  };

  const charts = useMemo(
    () =>
      selectedMeasures.map(measure => ({
        measure,
        option: {
          tooltip: { trigger: 'axis' },
          useUTC: true,
          legend: { type: 'scroll' },
          grid: { left: 60, right: 20, bottom: 55, containLabel: true },
          xAxis: {
            type: 'time',
            name: `${result?.time.grain ?? grain} · UTC`,
            nameLocation: 'middle',
            nameGap: 32,
            axisLabel: { hideOverlap: true, formatter: (instant: number) => new Date(instant).toISOString().slice(5, 10) },
          },
          yAxis: { type: 'value', name: measure.unit ?? measure.label },
          series: (result?.series ?? []).map(series => ({
            name: series.label,
            type: 'line',
            connectNulls: false,
            data: times.map(time => {
              const value = series.points
                .find(point => point.time === time)
                ?.values.find(item => item.id === measure.id)?.value;
              return [Date.parse(`${time}T00:00:00.000Z`), value === undefined ? null : value];
            }),
          })),
        },
      })),
    [selectedMeasures, result, times, grain],
  );

  const toggleValue = (value: Scalar) =>
    setSelectedValues(current =>
      current.some(item => Object.is(item, value))
        ? current.filter(item => !Object.is(item, value))
        : current.length < 4
        ? [...current, value]
        : current,
    );
  return (
    <section aria-label="차원 값별 추세 비교" className="mt-4 min-w-0 space-y-4">
      <Card className="min-w-0 gap-4 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">차원 값별 추세 비교</h2>
          <p className="text-sm text-muted-foreground">
            선택한 값은 같은 원본 필터와 기간으로 비교합니다. 비율은 합산하지 않고 분자와 분모를 재집계해 계산합니다.
          </p>
        </div>
        {!utcScope && (
          <Notice severity="error">
            차원 값 추세 비교는 UTC 기간만 지원합니다. 날짜 범위를 UTC로 바꾼 뒤 다시 선택해 주세요.
          </Notice>
        )}
        <label className="grid max-w-sm gap-1 text-sm">
          비교 차원
          <select
            aria-label="비교 차원"
            className="h-9 rounded-md border bg-background px-2"
            disabled={!utcScope}
            value={dimension}
            onChange={event => {
              setDimension(event.target.value);
              setSelectedValues([]);
              setValueSearch('');
            }}
          >
            {eligible.map(item => (
              <option key={item.column} value={item.column}>
                {item.column}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="min-w-0 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">비교할 값 · 최대 4개</legend>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={event => {
              event.preventDefault();
              setSearchNonce(value => value + 1);
            }}
          >
            <label className="sr-only" htmlFor="dimension-value-search">
              차원 값 검색
            </label>
            <input
              id="dimension-value-search"
              aria-label="차원 값 검색"
              className="h-9 min-w-32 rounded-md border px-2 text-sm"
              disabled={!utcScope}
              value={valueSearch}
              onChange={event => setValueSearch(event.target.value)}
              placeholder="값 검색"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!utcScope}>
              값 검색
            </Button>
          </form>
          {valuesLoading && (
            <p role="status" className="mt-2 text-xs">
              값을 불러오는 중…
            </p>
          )}
          <div role="group" aria-label="사용 가능한 차원 값" className="mt-2 flex flex-wrap gap-2">
            {utcScope &&
              availableValues.map((value, index) => {
                const checked = selectedValues.some(item => Object.is(item, value));
                return (
                  <Button
                    key={`${typeof value}:${String(value)}:${index}`}
                    type="button"
                    variant={checked ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={checked}
                    disabled={!checked && selectedValues.length >= 4}
                    onClick={() => toggleValue(value)}
                  >
                    {label(value)}
                  </Button>
                );
              })}
          </div>
          {valuesTruncated && (
            <p className="mt-2 text-xs text-muted-foreground">
              값이 일부만 표시됩니다. 검색어를 입력해 선택 범위를 좁혀 주세요.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {utcScope &&
              selectedValues.map((value, index) => (
                <Button
                  key={`${typeof value}:${String(value)}:${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleValue(value)}
                  aria-label={`${label(value)} 제거`}
                >
                  {label(value)} ×
                </Button>
              ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">문자열 “null”과 값 없음은 서로 다른 값으로 비교합니다.</p>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!utcScope || busy || paused || !selectedValues.length || !measureIds.length || reloadRequired}
            onClick={run}
          >
            {busy ? '비교 중…' : '추세 비교'}
          </Button>
          {reloadRequired && (
            <Button type="button" variant="outline" onClick={onReloadCatalog}>
              카탈로그 새로고침
            </Button>
          )}
        </div>
        {error && <Notice severity="error">{error}</Notice>}
        {result && utcScope && frozen?.key === contextKey && !pivot && (
          <>
            <div role="group" aria-label="선택 값별 합계" className="grid min-w-0 gap-3 sm:grid-cols-2">
              {result.series.map((series, index) => (
                <Card key={`${typeof series.value}:${String(series.value)}:${index}`} className="min-w-0 p-3">
                  <h3 className="break-words text-sm font-semibold">
                    {result.dimensionColumn}: {series.label}
                  </h3>
                  <dl className="mt-2 grid gap-2">
                    {result.measures.map(measure => (
                      <div key={measure.id} className="flex justify-between gap-2 text-sm">
                        <dt className="break-words">{measure.label}</dt>
                        <dd className="text-right tabular-nums">
                          {format(series.kpis.find(kpi => kpi.id === measure.id)?.value, measure)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}
            </div>
            {charts.map(({ measure, option }) => (
              <div
                key={measure.id}
                role="img"
                aria-label={`${measure.label} · ${result.series.map(item => item.label).join(', ')} 값별 ${
                  result.time.grain
                } 추세 차트`}
                className="min-w-0"
              >
                <h3 className="text-sm font-semibold">
                  {measure.label}
                  {measure.unit ? ` (${measure.unit})` : ''}
                </h3>
                <SeriesChart
                  option={option}
                  onEvents={{
                    click: (point: any) => {
                      const instant = Array.isArray(point?.value) ? point.value[0] : undefined;
                      if (typeof instant !== 'number' || !Number.isFinite(instant)) return;
                      const time = new Date(instant).toISOString().slice(0, 10);
                      if (times.includes(time)) setActiveTime(time);
                    },
                  }}
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">시계열 데이터와 선택한 시점</h3>
              <Button
                type="button"
                variant="outline"
                disabled={pivotBusy || !selectedTime || !frozen || frozen.key !== contextKey}
                onClick={openPivot}
              >
                {pivotBusy ? 'Pivot 여는 중…' : '선택 값 Pivot 열기'}
              </Button>
            </div>
            <div
              role="region"
              aria-label="시계열 데이터 표"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>시간 (UTC)</TableHead>
                    {result.series.flatMap(series =>
                      selectedMeasures.map(measure => (
                        <TableHead key={`${typeof series.value}:${String(series.value)}-${measure.id}`}>
                          {series.label} · {measure.label}
                        </TableHead>
                      )),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {times.map(time => (
                    <TableRow key={time} aria-selected={selectedTime === time}>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-pressed={selectedTime === time}
                          onClick={() => setActiveTime(time)}
                        >
                          {time}
                        </Button>
                      </TableCell>
                      {result.series.flatMap(series =>
                        selectedMeasures.map(measure => (
                          <TableCell
                            key={`${typeof series.value}:${String(series.value)}-${measure.id}`}
                            className="text-right tabular-nums"
                          >
                            {format(
                              series.points.find(point => point.time === time)?.values.find(value => value.id === measure.id)
                                ?.value ?? null,
                              measure,
                            )}
                          </TableCell>
                        )),
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            {selectedTime && (
              <section aria-label="선택 시점 상세" className="space-y-2">
                <h3 className="text-sm font-semibold">{selectedTime} · 선택한 차원 값 상세</h3>
                <div
                  role="region"
                  aria-label="선택 시점 상세 표"
                  tabIndex={0}
                  className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{result.dimensionColumn}</TableHead>
                        {selectedMeasures.map(measure => (
                          <TableHead key={measure.id}>{measure.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.series.map((series, index) => (
                        <TableRow key={`${typeof series.value}:${String(series.value)}:${index}`}>
                          <TableCell>{series.label}</TableCell>
                          {selectedMeasures.map(measure => (
                            <TableCell key={measure.id}>
                              {format(
                                series.points
                                  .find(point => point.time === selectedTime)
                                  ?.values.find(value => value.id === measure.id)?.value ?? null,
                                measure,
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </table>
                </div>
              </section>
            )}
            {result.series.some(series => series.truncated) && (
              <p className="text-xs text-muted-foreground">일부 시점만 표시했습니다.</p>
            )}
            {timeline.truncated && (
              <p className="text-xs text-muted-foreground">표시 가능한 시계열 구간은 최대 400개입니다.</p>
            )}
            {!times.length && (
              <p role="status" className="text-sm text-muted-foreground">
                선택한 값과 필터/기간에 해당하는 추세 데이터가 없습니다.
              </p>
            )}
          </>
        )}
        {pivot && utcScope && frozen?.key === contextKey && (
          <section aria-label="선택 값 Pivot" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">선택 값 Pivot · {selectedTime}</h3>
              <Button type="button" variant="outline" onClick={() => setPivot(null)}>
                추세로 돌아가기
              </Button>
            </div>
            <div
              role="region"
              aria-label="Pivot 표"
              tabIndex={0}
              className="max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>{pivot.rowColumns.join(', ')}</TableHead>
                    {frozen.measureIds
                      .map(id => result?.measures.find(measure => measure.id === id))
                      .filter((measure): measure is Measure => !!measure)
                      .map(measure => (
                        <TableHead key={measure.id}>{measure.label}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivot.rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{label(row[0])}</TableCell>
                      {frozen.measureIds
                        .map(id => result?.measures.find(measure => measure.id === id))
                        .filter((measure): measure is Measure => !!measure)
                        .map(measure => (
                          <TableCell key={measure.id}>
                            {format(pivot.rowTotals[index]?.find(total => total.measureId === measure.id)?.value, measure)}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">전체</TableCell>
                    {frozen.measureIds
                      .map(id => result?.measures.find(measure => measure.id === id))
                      .filter((measure): measure is Measure => !!measure)
                      .map(measure => (
                        <TableCell key={measure.id} className="font-semibold">
                          {format(pivot.grandTotal.find(total => total.measureId === measure.id)?.value, measure)}
                        </TableCell>
                      ))}
                  </TableRow>
                </TableBody>
              </table>
            </div>
          </section>
        )}
      </Card>
    </section>
  );
}
