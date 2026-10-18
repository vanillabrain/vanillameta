import SourceCatalogEditor from './SourceCatalogEditor';
import SourceConditions from './SourceConditions';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { get, post } from '@/helpers/apiHelper';
import PersonalSavedViews from '@/pages/Dashboard/Components/PersonalSavedViews';
import ExploreSavedViews, { ExploreViewState as VersionedExploreViewState } from './ExploreSavedViews';
import ExplorePivot, { DEFAULT_PIVOT_SORT, normalizePivotSort, PivotAxes as AdvancedPivotAxes } from './ExplorePivot';
import ExploreExport from './ExploreExport';
import { AnalysisChoice, AnalysisUiProvider, analysisPanelClassName } from '@/components/analysis/AnalysisUi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import {
  parseExploreViewState,
  ExploreViewState,
  ExploreFilter,
  ExploreDateRange,
  LeaderboardSort,
} from './exploreViewState';
import PivotTable from './PivotTable';
import PivotDashboardAdd from './PivotDashboardAdd';
import { pivotRequestKey } from './pivotCsv';
import MetricTrend, { FormattedMetricTrendData } from '@/pages/Dashboard/Components/MetricTrend';
import { formatMetric, metricNumericText, NumberNotation } from '@/utils/formatMetric';
import type { MetricComparisonData } from '@/pages/Dashboard/Components/PeriodComparison';

const PAGE_SIZE = 20;
const MAX_MEASURES = 6;
const MAX_DIMENSIONS = 4;
const DEFAULT_MEASURE_COUNT = 3;
const TIME_ZONES = ['UTC', 'Asia/Seoul', 'America/Los_Angeles'];
const GRAINS: Array<{ value: TrendGrain; label: string }> = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
];
const CURRENCY_UNITS = ['$', '€', '₩', '£', '¥'];

type FilterValue = string | number | boolean | null;
const DEFAULT_SORT: LeaderboardSort = { by: 'value', direction: 'desc' };
type TrendGrain = 'day' | 'week' | 'month';
type Source = { id: number; name: string; engine?: string };
type Measure = { id: number; label: string; definitionVersion?: number; definition?: unknown };
type Dimension = { column: string; type?: string; numeric?: boolean; temporal?: boolean };
type TemporalColumn = { column: string; min?: string | null; max?: string | null };
type Catalog = {
  access?: { read: boolean; edit: boolean; publish: boolean; export: boolean };
  owned?: boolean;
  sourceId: number;
  name: string;
  sourceRevision: string;
  viewRevision?: string;
  rowCount: number | string;
  measures: Measure[];
  dimensions: Dimension[];
  temporalColumns: TemporalColumn[];
};
type RawPoint = { time: string; value: unknown };
type KpiTrend = { points?: RawPoint[]; timeZone?: string };
type KpiComparison = { previousValue?: unknown; delta?: unknown; percentChange?: unknown; unavailable?: string };
type Kpi = {
  id: number | string;
  title: string;
  value: unknown;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  trend?: KpiTrend;
  previousTrend?: KpiTrend;
  comparison?: KpiComparison;
};
type LeaderboardRow = {
  category: unknown;
  value: unknown;
  previousValue?: unknown;
  delta?: unknown;
  percentChange?: unknown;
};
type Leaderboard = { column: string; rows: LeaderboardRow[]; truncated?: boolean };
type ExploreDetails = { rows: Record<string, unknown>[]; totalRows: number | string; page?: number; pageSize?: number };
type QueryResult = {
  sourceRevision: string;
  kpis?: Kpi[];
  leaderboards?: Leaderboard[];
  details?: ExploreDetails;
  applied?: { filters?: ExploreFilter[]; dateRange?: ExploreDateRange; trendGrain?: string; comparePrevious?: boolean };
};
const unwrap = <T,>(response: { data: { status: string; data: T } }): T => {
  if (response?.data?.status !== 'SUCCESS' || response.data.data == null) throw new Error('요청을 처리하지 못했습니다.');
  return response.data.data;
};

/** Coerce server values that arrive as numeric strings; never treat null/blank as 0. */
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const compareText = (
  row: LeaderboardRow,
  decimalPlaces: number,
  prefix: string,
  suffix: string,
  numberNotation: NumberNotation,
  exact = false,
) => {
  if (metricNumericText(row.previousValue) === null) return '이전 값 없음';
  const text = (value: unknown, signed = false) => {
    const formatted = formatMetric(value, { decimalPlaces, prefix, suffix, numberNotation, signed });
    return exact ? formatted.exactText : formatted.text;
  };
  const parts = ['이전 ' + text(row.previousValue)];
  if (metricNumericText(row.delta) !== null) parts.push('변화 ' + text(row.delta, true));
  if (metricNumericText(row.percentChange) !== null)
    parts.push(formatMetric(row.percentChange, { decimalPlaces: 1, suffix: '%' }).text);
  return parts.join(' · ');
};

/** Keep null distinct from the literal string "null" and from an empty string. */
const categoryText = (category: unknown) => {
  if (category === null || category === undefined) return '(값 없음)';
  if (category === '') return '(빈 문자열)';
  if (typeof category === 'boolean') return category ? 'true' : 'false';
  if (typeof category === 'object') return JSON.stringify(category);
  return String(category);
};

const isAborted = (error: unknown) => {
  const value = error as { name?: string; code?: string } | undefined;
  return value?.name === 'CanceledError' || value?.code === 'ERR_CANCELED' || value?.name === 'AbortError';
};

const isRevisionConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

function FilterValueSelect({
  sourceId,
  sourceRevision,
  column,
  search,
  filters,
  dateRange,
  selected,
  onToggle,
  onConflict,
}: {
  sourceId: number;
  sourceRevision: string;
  column: string;
  search: string;
  filters: ExploreFilter[];
  dateRange?: ExploreDateRange;
  selected: FilterValue[];
  onToggle: (value: FilterValue) => void;
  onConflict: () => void;
}) {
  const [values, setValues] = useState<FilterValue[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => {
    revision.current += 1;
    const token = revision.current;
    const abort = new AbortController();
    setBusy(true);
    setError('');
    post(
      '/bi/explore/values',
      { sourceId, sourceRevision, column, search, filters, ...(dateRange ? { dateRange } : {}) },
      { signal: abort.signal },
    )
      .then(response => unwrap<{ values?: FilterValue[]; truncated?: boolean; sourceRevision?: string }>(response))
      .then(data => {
        if (revision.current !== token) return;
        setValues(data.values ?? []);
        setTruncated(!!data.truncated);
      })
      .catch(err => {
        if (revision.current !== token || isAborted(err)) return;
        if (isRevisionConflict(err)) {
          onConflict();
          return;
        }
        setError('값 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
      })
      .finally(() => {
        if (revision.current === token) setBusy(false);
      });
    return () => {
      revision.current += 1;
      abort.abort();
    };
  }, [sourceId, sourceRevision, column, search, filters, dateRange, onConflict]);
  return (
    <div
      role="group"
      aria-label="값 선택"
      className="grid max-h-[220px] grid-cols-1 gap-0.5 overflow-auto rounded-md p-0.5 sm:grid-cols-2"
    >
      {busy && <p className="col-span-full text-[13px] text-muted-foreground">값을 불러오는 중…</p>}
      {error && (
        <p role="alert" className="col-span-full text-[13px] text-destructive">
          {error}
        </p>
      )}
      {!busy && !error && values.length === 0 && (
        <p className="col-span-full text-[13px] text-muted-foreground">조건에 맞는 값이 없습니다.</p>
      )}
      {values.map((value, index) => {
        const checked = selected.some(current => Object.is(current, value));
        return (
          <label
            key={`${column}-${index}`}
            className={cn(
              'flex min-h-10 min-w-0 cursor-pointer items-start gap-2 rounded-md pr-2 hover:bg-[#edf3fa]',
              checked && 'bg-[#eaf2fc]',
            )}
          >
            <Checkbox
              className="mt-2 shrink-0"
              checked={checked}
              onCheckedChange={() => onToggle(value)}
              aria-label={categoryText(value)}
            />
            <span className="min-w-0 py-2 text-[13px] leading-6 break-words text-[#334155]">{categoryText(value)}</span>
          </label>
        );
      })}
      {truncated && (
        <p className="col-span-full text-xs text-muted-foreground">일부 값만 표시됩니다. 검색으로 좁혀 보세요.</p>
      )}
    </div>
  );
}

function LeaderboardCard({
  board,
  onSelect,
  decimalPlaces,
  unitPrefix,
  unitSuffix,
  numberNotation,
}: {
  board: Leaderboard;
  onSelect: (column: string, values: FilterValue[]) => void;
  decimalPlaces: number;
  unitPrefix: string;
  unitSuffix: string;
  numberNotation: NumberNotation;
}) {
  const id = useId();
  const rows = board.rows ?? [];
  const max = rows.reduce((best, row) => Math.max(best, toNumber(row.value) ?? 0), 0);
  return (
    <Card className="min-w-0 gap-2 rounded-[10px] border border-[#e0e6ee] bg-card p-4 ring-0 sm:p-5">
      <h3 className="text-sm font-bold wrap-anywhere">{board.column}</h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">표시할 값이 없습니다.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {rows.map((row, index) => {
            const value = formatMetric(row.value, { decimalPlaces, prefix: unitPrefix, suffix: unitSuffix, numberNotation });
            const numeric = toNumber(row.value) ?? 0;
            const width = max > 0 ? Math.max(2, Math.round((numeric / max) * 100)) : 0;
            return (
              <li key={`${board.column}-${index}`}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`필터 적용: ${board.column} = ${categoryText(row.category)}`}
                  aria-describedby={`${id}-${index}-value${'previousValue' in row ? ` ${id}-${index}-comparison` : ''}`}
                  onClick={() => onSelect(board.column, [row.category as FilterValue])}
                  className="relative h-auto min-h-10 w-full items-stretch justify-start gap-1 overflow-hidden rounded px-1.5 py-1.5 text-left text-[13px] leading-5 font-normal whitespace-normal text-[#1e293b] hover:bg-[#f8fafc]"
                >
                  <span
                    aria-hidden={true}
                    style={{ width: `${width}%` }}
                    className="pointer-events-none absolute inset-y-0 left-0 bg-[#e2edfc]"
                  />
                  <span className="relative flex w-full min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 justify-between gap-2">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{categoryText(row.category)}</span>
                      <span
                        title={value.exactText}
                        id={`${id}-${index}-value`}
                        aria-label={value.exactText}
                        className="tabular-nums whitespace-nowrap"
                      >
                        {value.text}
                      </span>
                    </span>
                    {'previousValue' in row && (
                      <span
                        id={`${id}-${index}-comparison`}
                        title={compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation, true)}
                        aria-label={compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation, true)}
                        className="overflow-hidden text-[11px] leading-normal text-ellipsis whitespace-nowrap text-muted-foreground"
                      >
                        {compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation)}
                      </span>
                    )}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {board.truncated && <p className="mt-1 text-xs text-muted-foreground">상위 20개만 표시</p>}
    </Card>
  );
}

function SourceExploreContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState(() =>
    /^\d+$/.test(searchParams.get('sourceId') || '') ? searchParams.get('sourceId') || '' : '',
  );
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogReload, setCatalogReload] = useState(0);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogForbidden, setCatalogForbidden] = useState(false);
  const [measureIds, setMeasureIds] = useState<number[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [rankingMeasureId, setRankingMeasureId] = useState<number | null>(null);
  const [filters, setFilters] = useState<ExploreFilter[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>(DEFAULT_SORT);
  const [filterMode, setFilterMode] = useState<'values' | 'range'>('values');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [filterError, setFilterError] = useState('');
  const [grain, setGrain] = useState<TrendGrain>('day');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [dateMode, setDateMode] = useState<'all' | 'custom'>('all');
  const [timeZone, setTimeZone] = useState('UTC');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pivotAxes, setPivotAxes] = useState({ rowDimensions: [] as string[], columnDimensions: [] as string[] });
  const [pivotReady, setPivotReady] = useState({ key: '', reason: 'Pivot을 조회한 뒤 저장해 주세요.' });
  const [mode, setMode] = useState<'explore' | 'pivot' | 'advanced'>('explore');
  const [advancedAxes, setAdvancedAxes] = useState<AdvancedPivotAxes>({ rowColumns: [], columnColumns: [] });
  const [advancedReady, setAdvancedReady] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSelection, setFilterSelection] = useState<FilterValue[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [revisionError, setRevisionError] = useState('');
  const [queryReload, setQueryReload] = useState(0);
  const [includeRows, setIncludeRows] = useState(false);
  const [page, setPage] = useState(0);
  const queryRevision = useRef(0);
  const queryAbort = useRef<AbortController | null>(null);
  const catalogRevision = useRef(0);

  useEffect(() => {
    const abort = new AbortController();
    get('/bi/sources', undefined, { signal: abort.signal })
      .then(unwrap<Source[]>)
      .then(list => setSources(list))
      .catch(() => undefined);
    return () => abort.abort();
  }, []);

  const temporalColumn = catalog?.temporalColumns?.[0]?.column || '';
  const dateRange = useMemo<ExploreDateRange | undefined>(() => {
    if (dateMode !== 'custom' || !temporalColumn || !startDate || !endDate) return undefined;
    return { column: temporalColumn, start: startDate, end: endDate, timeZone };
  }, [dateMode, temporalColumn, startDate, endDate, timeZone]);
  const rangeIncomplete = dateMode === 'custom' && (!startDate || !endDate);
  const rangeBackwards = dateMode === 'custom' && !!startDate && !!endDate && startDate > endDate;
  const rangePaused = rangeIncomplete || rangeBackwards;

  const resetAllState = () => {
    setMode('explore');
    setPivotAxes({ rowDimensions: [], columnDimensions: [] });
    setAdvancedAxes({ rowColumns: [], columnColumns: [] });
    setAdvancedReady(false);
    setMeasureIds([]);
    setDimensions([]);
    setRankingMeasureId(null);
    setFilters([]);
    setLeaderboardSort(DEFAULT_SORT);
    setFilterMode('values');
    setRangeMin('');
    setRangeMax('');
    setFilterError('');
    setGrain('day');
    setComparePrevious(false);
    setDateMode('all');
    setTimeZone('UTC');
    setStartDate('');
    setEndDate('');
    setFilterPanelOpen(false);
    setSettingsOpen(false);
    setSavedViewsOpen(false);
    setFilterColumn('');
    setFilterSearch('');
    setFilterSelection([]);
    setResult(null);
    setQueryError('');
    setRevisionError('');
    setIncludeRows(false);
    setPage(0);
  };

  useEffect(() => {
    if (!sourceId) {
      setCatalog(null);
      setCatalogError('');
      setCatalogForbidden(false);
      setCatalogBusy(false);
      resetAllState();
      return undefined;
    }
    catalogRevision.current += 1;
    const token = catalogRevision.current;
    const abort = new AbortController();
    setCatalog(null);
    setCatalogError('');
    setCatalogForbidden(false);
    setCatalogBusy(true);
    resetAllState();
    post('/bi/explore/catalog', { sourceId: Number(sourceId) }, { signal: abort.signal })
      .then(unwrap<Catalog>)
      .then(data => {
        if (catalogRevision.current !== token) return;
        setCatalog(data);
        const pivotFields = data.dimensions.filter(d => !d.temporal);
        setPivotAxes({
          rowDimensions: [pivotFields.find(d => d.column === 'device_type')?.column ?? pivotFields[0]?.column].filter(
            Boolean,
          ),
          columnDimensions: [],
        });
        const categorical = (data.dimensions ?? [])
          .filter(dimension => !dimension.numeric && !dimension.temporal)
          .map(dimension => dimension.column);
        const preferred = ['device_type', 'device_os'].filter(column => categorical.includes(column));
        setDimensions([...preferred, ...categorical.filter(column => !preferred.includes(column))].slice(0, 2));
        const selected = (data.measures ?? []).slice(0, DEFAULT_MEASURE_COUNT).map(measure => measure.id);
        setMeasureIds(selected);
        setRankingMeasureId(selected[0] ?? null);
      })
      .catch(err => {
        if (catalogRevision.current !== token || isAborted(err)) return;
        const forbidden = err?.response?.status === 403;
        setCatalogForbidden(forbidden);
        setCatalogError(
          forbidden
            ? '이 데이터 소스에 접근할 권한이 없습니다. 본인 소유의 데이터 소스를 선택해 주세요.'
            : '데이터 소스를 분석하지 못했습니다. 카탈로그를 다시 불러와 주세요.',
        );
      })
      .finally(() => {
        if (catalogRevision.current === token) setCatalogBusy(false);
      });
    return () => {
      catalogRevision.current += 1;
      abort.abort();
    };
  }, [sourceId, catalogReload]);

  useEffect(() => {
    if (mode !== 'explore' || !catalog || !sourceId || measureIds.length === 0 || rangePaused) {
      setResult(null);
      setQueryBusy(false);
      setQueryError('');
      setRevisionError('');
      return undefined;
    }
    queryRevision.current += 1;
    const token = queryRevision.current;
    queryAbort.current?.abort();
    const abort = new AbortController();
    queryAbort.current = abort;
    setQueryBusy(true);
    setQueryError('');
    setRevisionError('');
    setResult(null);
    const payload = {
      sourceId: catalog.sourceId,
      sourceRevision: catalog.sourceRevision,
      measureIds,
      dimensionColumns: dimensions,
      rankingMeasureId: rankingMeasureId ?? measureIds[0],
      filters,
      ...(leaderboardSort.by !== 'value' || leaderboardSort.direction !== 'desc' ? { leaderboardSort } : {}),
      ...(dateRange ? { dateRange } : {}),
      trendGrain: grain,
      comparePrevious,
      page,
      pageSize: PAGE_SIZE,
      includeRows,
    };
    post('/bi/explore/query', payload, { signal: abort.signal })
      .then(unwrap<QueryResult>)
      .then(data => {
        if (queryRevision.current !== token) return;
        if (data.sourceRevision !== catalog.sourceRevision) {
          setRevisionError('데이터 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.');
          return;
        }
        setResult(data);
      })
      .catch(err => {
        if (queryRevision.current !== token || isAborted(err)) return;
        if (isRevisionConflict(err)) {
          setRevisionError('데이터 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.');
          return;
        }
        setQueryError('탐색 결과를 불러오지 못했습니다. 다시 시도해 주세요.');
      })
      .finally(() => {
        if (queryRevision.current === token) setQueryBusy(false);
      });
    return () => {
      queryRevision.current += 1;
      abort.abort();
    };
  }, [
    catalog,
    sourceId,
    measureIds,
    dimensions,
    rankingMeasureId,
    leaderboardSort,
    filters,
    dateRange,
    grain,
    comparePrevious,
    page,
    includeRows,
    queryReload,
    rangePaused,
    mode,
  ]);

  const applyFilter = (column: string, values: FilterValue[]) => {
    setFilterError('');
    if (values.length && filters.length >= 5 && !filters.some(item => item.column === column)) {
      setFilterError('필터는 최대 5개 열까지 적용할 수 있습니다. 기존 필터를 해제하세요.');
      setFilterPanelOpen(true);
      return;
    }
    setFilters(previous => {
      const next = previous.filter(item => item.column !== column);
      if (values.length > 0) next.push({ column, values });
      return next;
    });
    setPage(0);
  };
  const toggleMeasure = (id: number) => {
    setMeasureIds(previous => {
      if (previous.includes(id)) {
        const next = previous.filter(current => current !== id);
        setRankingMeasureId(ranking => (ranking !== null && next.includes(ranking) ? ranking : next[0] ?? null));
        return next;
      }
      if (previous.length >= MAX_MEASURES) return previous;
      setRankingMeasureId(ranking => ranking ?? id);
      return [...previous, id];
    });
    setPage(0);
  };
  const toggleDimension = (column: string) => {
    setDimensions(previous => {
      if (previous.includes(column)) return previous.filter(current => current !== column);
      if (previous.length >= MAX_DIMENSIONS) return previous;
      return [...previous, column];
    });
    setPage(0);
  };
  const toggleFilterValue = (value: FilterValue) =>
    setFilterSelection(previous =>
      previous.some(current => Object.is(current, value))
        ? previous.filter(current => !Object.is(current, value))
        : [...previous, value],
    );
  const numericFilter = catalog?.dimensions.find(dimension => dimension.column === filterColumn)?.numeric === true;
  const closeFilters = () => {
    setFilterPanelOpen(false);
    const launcher = document.getElementById('explore-filter-launcher');
    launcher?.focus();
  };
  const applyFilterSelection = () => {
    if (filters.length >= 5 && !filters.some(item => item.column === filterColumn)) {
      setFilterError('필터는 최대 5개 열까지 적용할 수 있습니다. 기존 필터를 해제하세요.');
      setFilterPanelOpen(true);
      return;
    }
    if (filterMode === 'range') {
      const bound = (text: string) =>
        text.trim() === '' ? undefined : metricNumericText(text) === null ? NaN : Number(text);
      const min = bound(rangeMin),
        max = bound(rangeMax);
      if (
        !numericFilter ||
        (min === undefined && max === undefined) ||
        [min, max].some(
          value => value !== undefined && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER),
        )
      ) {
        setFilterError('최솟값 또는 최댓값에 유효한 숫자를 입력하세요. 안전한 숫자 범위 내에서 입력할 수 있습니다.');
        return;
      }
      if (min !== undefined && max !== undefined && min > max) {
        setFilterError('최솟값은 최댓값보다 클 수 없습니다.');
        return;
      }
      setFilters(previous => [
        ...previous.filter(item => item.column !== filterColumn),
        {
          column: filterColumn,
          range: { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) },
        },
      ]);
      setPage(0);
    } else applyFilter(filterColumn, filterSelection);
    setFilterError('');
    closeFilters();
    setFilterColumn('');
    setFilterSearch('');
    setFilterSelection([]);
    setRangeMin('');
    setRangeMax('');
  };
  const handleRevisionConflict = () => {
    setRevisionError('데이터 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.');
  };

  const trendFor = (kpi: Kpi): FormattedMetricTrendData | undefined => {
    const points = (kpi.trend?.points ?? []).filter(point => point && typeof point.time === 'string' && point.time !== '');
    if (points.length === 0) return undefined;
    const data: FormattedMetricTrendData = {
      column: String(kpi.id),
      grain,
      points: points.map(point => ({ time: point.time, value: metricNumericText(point.value) })),
    };
    if (kpi.trend?.timeZone) data.timeZone = kpi.trend.timeZone;
    return data;
  };
  const definitionOf = (id: number | string | null) =>
    catalog?.measures.find(measure => String(measure.id) === String(id))?.definition as
      | { unit?: string; decimalPlaces?: number; numberNotation?: 'plain' | NumberNotation }
      | undefined;
  /** Currency symbols read as a prefix ($5.57); other units stay a suffix. Falls back to the saved definition unit. */
  const unitPartsOf = (id: number | string | null, overridePrefix?: string, overrideSuffix?: string) => {
    const unit = (overridePrefix || overrideSuffix || definitionOf(id)?.unit || '').trim();
    if (!unit) return { prefix: '', suffix: '' };
    if (CURRENCY_UNITS.includes(unit)) return { prefix: unit, suffix: '' };
    return { prefix: '', suffix: unit };
  };
  const decimalsOf = (id: number | string | null, overrideDecimals?: number) =>
    overrideDecimals ?? definitionOf(id)?.decimalPlaces ?? 0;
  const unitParts = (kpi: Kpi) => unitPartsOf(kpi.id, kpi.prefix, kpi.suffix);
  const decimalsFor = (kpi: Kpi) => decimalsOf(kpi.id, kpi.decimalPlaces);
  /** Leaderboard values follow the selected ranking measure's unit and decimals, not a fixed 0. */
  const rankingUnits = unitPartsOf(rankingMeasureId);
  const notationOf = (id: number | string | null): NumberNotation =>
    definitionOf(id)?.numberNotation === 'compact' ? 'compact' : 'full';
  const rankingDecimals = decimalsOf(rankingMeasureId);
  const comparisonFor = (kpi: Kpi): MetricComparisonData | undefined => {
    if (!kpi.comparison) return undefined;
    const data: MetricComparisonData = {
      previousValue: metricNumericText(kpi.comparison.previousValue),
      delta: metricNumericText(kpi.comparison.delta),
      percentChange: metricNumericText(kpi.comparison.percentChange),
    };
    if (kpi.comparison.unavailable) data.unavailable = kpi.comparison.unavailable;
    return data;
  };

  const details = result?.details;
  const detailRows = details?.rows ?? [];
  const detailColumns = detailRows.length > 0 ? Object.keys(detailRows[0]) : [];
  const detailsSize = details?.pageSize ?? PAGE_SIZE;
  const totalRows = toNumber(details?.totalRows) ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / detailsSize));
  const measureLabel = (id: number | null) =>
    catalog?.measures.find(measure => measure.id === id)?.label ?? (id === null ? '지표 없음' : String(id));
  const statusMessage = rangePaused
    ? '기간을 지정하는 동안 결과를 일시 중지했습니다.'
    : queryBusy
    ? '탐색 결과를 불러오는 중…'
    : '';
  const reloadCatalog = () => setCatalogReload(value => value + 1);

  const viewState: ExploreViewState = {
    version: 1,
    ...(mode === 'pivot' ? { mode, pivot: pivotAxes } : {}),
    measureIds,
    dimensionColumns: dimensions,
    rankingMeasureId: rankingMeasureId ?? 0,
    leaderboardSort,
    filters,
    dateRange: dateRange ?? null,
    relativePeriod: null,
    trendGrain: grain,
    comparePrevious,
    includeRows,
  };
  const applySavedView = (value: ExploreViewState) => {
    const next = parseExploreViewState(value, catalog);
    setMode(next.mode ?? 'explore');
    if (next.pivot) setPivotAxes(next.pivot);
    setMeasureIds(next.measureIds);
    setDimensions(next.dimensionColumns);
    setRankingMeasureId(next.rankingMeasureId);
    setFilters(next.filters);
    setLeaderboardSort(next.leaderboardSort);
    setGrain(next.trendGrain);
    setComparePrevious(next.comparePrevious);
    setIncludeRows(next.includeRows);
    setDateMode(next.dateRange ? 'custom' : 'all');
    setStartDate(next.dateRange?.start ?? '');
    setEndDate(next.dateRange?.end ?? '');
    setTimeZone(next.dateRange?.timeZone ?? 'UTC');
    setPage(0);
    setFilterPanelOpen(false);
    setFilterColumn('');
    setFilterSelection([]);
    setRangeMin('');
    setRangeMax('');
    setFilterError('');
    setSettingsOpen(false);
  };

  const versionsKnown = measureIds.every(id => {
    const version = catalog?.measures.find(measure => measure.id === id)?.definitionVersion;
    return Number.isSafeInteger(version) && Number(version) > 0;
  });
  // The advanced Pivot and the versioned saved views share one normalized order: a stale measure, a
  // change order without a compared period or a cell scope the axes no longer bound all fall back.
  const advancedSort = normalizePivotSort(advancedAxes.rowSort, {
    measureIds,
    comparePrevious,
    columnColumns: advancedAxes.columnColumns,
  });
  const effectiveAdvancedAxes: AdvancedPivotAxes = {
    ...advancedAxes,
    ...(advancedSort ? { rowSort: advancedSort } : {}),
  };
  const advancedExtended =
    !!advancedAxes.rowHierarchy || (!!advancedSort && (advancedSort.by !== 'label' || advancedSort.direction !== 'asc'));
  const advancedStored = advancedAxes.rowColumns.length > 0 || advancedAxes.columnColumns.length > 0;
  const advancedRequiresV4 =
    !!advancedAxes.timeAxis ||
    advancedSort?.columnTuple !== undefined ||
    advancedSort?.by === 'delta' ||
    advancedSort?.by === 'percentChange';
  // Flat joins the two axes into one record axis, which only the fifth view version can carry.
  const advancedFlat = advancedAxes.tableMode === 'flat';
  const versionedVersion: VersionedExploreViewState['version'] = advancedFlat
    ? 5
    : advancedRequiresV4
    ? 4
    : advancedExtended
    ? 3
    : advancedStored
    ? 2
    : 1;
  // The restful V1 state above stays the canonical share for PersonalSavedViews; the versioned
  // schema below carries the advanced Pivot for the POST /bi/explore/views/* compatibility API.
  const versionedViewState: VersionedExploreViewState = {
    version: versionedVersion,
    ...(versionedVersion >= 2
      ? {
          pivot: {
            enabled: mode === 'advanced',
            rowColumns: advancedAxes.rowColumns,
            columnColumns: advancedAxes.columnColumns,
            ...(versionedVersion >= 3
              ? {
                  rowHierarchy: advancedFlat ? false : advancedAxes.rowHierarchy ?? false,
                  rowSort: advancedSort ?? DEFAULT_PIVOT_SORT,
                  expandedRows:
                    !advancedFlat && advancedAxes.rowHierarchy && advancedAxes.rowColumns.length === 2
                      ? advancedAxes.expandedRows ?? []
                      : [],
                }
              : {}),
            ...(versionedVersion >= 4 && advancedAxes.timeAxis ? { timeAxis: advancedAxes.timeAxis } : {}),
            ...(advancedFlat ? { tableMode: 'flat' as const } : {}),
          },
        }
      : {}),
    measureIds,
    dimensionColumns: dimensions,
    rankingMeasureId: rankingMeasureId ?? measureIds[0],
    rankingSort: leaderboardSort,
    filters,
    ...(dateRange ? { dateRange } : {}),
    timeZone,
    trendGrain: grain,
    comparePrevious,
    includeRows,
  };
  const restoreVersionedView = (state: VersionedExploreViewState) => {
    queryRevision.current += 1;
    queryAbort.current?.abort();
    setResult(null);
    setQueryError('');
    setRevisionError('');
    setAdvancedAxes(
      state.pivot
        ? {
            rowColumns: state.pivot.rowColumns,
            columnColumns: state.pivot.columnColumns,
            ...(state.version >= 3
              ? {
                  rowHierarchy: state.pivot.rowHierarchy,
                  rowSort: state.pivot.rowSort,
                  expandedRows: state.pivot.expandedRows,
                }
              : {}),
            ...(state.version >= 4 && state.pivot.timeAxis ? { timeAxis: state.pivot.timeAxis } : {}),
            ...(state.version >= 5 && state.pivot.tableMode ? { tableMode: state.pivot.tableMode } : {}),
          }
        : { rowColumns: [], columnColumns: [] },
    );
    setAdvancedReady(false);
    setMode(state.pivot?.enabled ? 'advanced' : 'explore');
    setMeasureIds(state.measureIds);
    setDimensions(state.dimensionColumns);
    setRankingMeasureId(state.rankingMeasureId);
    setLeaderboardSort(state.rankingSort);
    setFilters(state.filters);
    setGrain(state.trendGrain);
    setComparePrevious(state.comparePrevious);
    setTimeZone(state.timeZone);
    setDateMode(state.dateRange ? 'custom' : 'all');
    setStartDate(state.dateRange?.start ?? '');
    setEndDate(state.dateRange?.end ?? '');
    setIncludeRows(state.includeRows);
    setPage(0);
    closeFilters();
    setQueryReload(value => value + 1);
  };
  const exportPayload = {
    mode: mode === 'advanced' ? ('pivot' as const) : ('explore' as const),
    query: {
      sourceId: catalog?.sourceId,
      sourceRevision: catalog?.sourceRevision,
      measureIds,
      filters,
      ...(dateRange ? { dateRange } : {}),
      comparePrevious,
      ...(mode === 'advanced'
        ? {
            rowColumns: advancedAxes.rowColumns,
            columnColumns: advancedAxes.columnColumns,
            ...(advancedFlat
              ? { tableMode: 'flat' as const, rowHierarchy: false }
              : advancedAxes.rowHierarchy !== undefined
              ? { rowHierarchy: advancedAxes.rowHierarchy }
              : {}),
            ...(advancedSort ? { rowSort: advancedSort } : {}),
            ...(advancedAxes.timeAxis ? { timeAxis: advancedAxes.timeAxis } : {}),
          }
        : {
            dimensionColumns: dimensions,
            rankingMeasureId: rankingMeasureId ?? measureIds[0],
            rankingSort: leaderboardSort,
            trendGrain: grain,
            includeRows: false,
          }),
    },
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] bg-[#f6f8fb] p-4 text-[13px] md:p-6">
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-3">
          <h1 className="text-2xl leading-tight font-bold">지표 탐색</h1>
          <TextField
            select
            label="데이터 소스"
            value={sourceId}
            disabled={sources.length === 0}
            onChange={event => setSourceId(event.target.value)}
            className="w-full min-w-0 sm:w-[220px]"
          >
            <option value="">데이터를 선택하세요</option>
            {sources.map(source => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </TextField>
          {catalog && (
            <p className="wrap-anywhere text-xs text-muted-foreground">{formatMetric(catalog.rowCount).text}행 · 연결됨</p>
          )}
        </div>
        <Button
          variant="outline"
          className="shrink-0 self-end"
          onClick={() => navigate(`/explore${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`)}
        >
          지표 빌더
        </Button>
      </div>
      <Separator />
      {catalog && (
        <SourceCatalogEditor sourceId={catalog.sourceId} canEdit={catalog.access?.edit} canInspectUsage={catalog.owned} />
      )}
      {catalog && <SourceConditions sourceId={catalog.sourceId} canEdit={catalog.access?.edit} />}
      {catalog && (
        <div className="mt-3 flex min-w-0 flex-wrap items-start gap-2">
          {/* Our restful V1 state cannot carry the advanced Pivot, so classic save/load hides there. */}
          {mode !== 'advanced' && (
            <div className="min-w-0">
              <Button variant="ghost" aria-expanded={savedViewsOpen} onClick={() => setSavedViewsOpen(open => !open)}>
                {savedViewsOpen ? '저장 보기 닫기' : '저장 보기'}
              </Button>
              {savedViewsOpen && (
                <PersonalSavedViews<ExploreViewState>
                  key={`explore-views-${catalog.sourceId}`}
                  endpoint={`/bi/explore/${catalog.sourceId}/views`}
                  subject="explore"
                  parseState={parseExploreViewState}
                  revision={catalog.viewRevision}
                  sourceRevision={catalog.sourceRevision}
                  state={viewState}
                  disabledReason={
                    rangePaused
                      ? '완성한 기간을 적용한 뒤 저장해 주세요.'
                      : !measureIds.length
                      ? '지표를 하나 이상 선택해 주세요.'
                      : mode === 'pivot'
                      ? pivotReady.key ===
                        pivotRequestKey({
                          sourceId: catalog.sourceId,
                          sourceRevision: catalog.sourceRevision,
                          measureIds,
                          ...pivotAxes,
                          filters,
                          dateRange,
                        })
                        ? pivotReady.reason
                        : '현재 Pivot 조건을 조회한 뒤 저장해 주세요.'
                      : queryBusy
                      ? '현재 조건 조회가 끝난 뒤 사용할 수 있습니다.'
                      : queryError || revisionError || (!result ? '정상 탐색 결과를 확인한 뒤 사용할 수 있습니다.' : '')
                  }
                  onApply={applySavedView}
                  renderViewAction={view =>
                    view.state.mode === 'pivot' && catalog.owned !== false ? (
                      <PivotDashboardAdd sourceId={catalog.sourceId} viewId={view.id} name={view.name} />
                    ) : null
                  }
                />
              )}
            </div>
          )}
          {/* Classic Pivot keeps its own PivotTable save/CSV, so the versioned controls stay hidden there. */}
          {mode !== 'pivot' && (
            <>
              <ExploreSavedViews
                sourceId={catalog.sourceId}
                sourceRevision={catalog.sourceRevision}
                measureVersions={Object.fromEntries(
                  catalog.measures
                    .filter(measure => measureIds.includes(measure.id))
                    .map(measure => [String(measure.id), Number(measure.definitionVersion)]),
                )}
                state={versionedViewState}
                canSave={
                  (mode === 'advanced' ? advancedReady : !!result && !queryBusy) &&
                  !rangePaused &&
                  !revisionError &&
                  measureIds.length > 0 &&
                  versionsKnown
                }
                disabledReason={
                  !versionsKnown ? '지표 정의 버전을 확인할 수 없습니다. 카탈로그를 다시 불러와 주세요.' : undefined
                }
                onRestore={restoreVersionedView}
              />
              <ExploreExport
                key={`export-${catalog.sourceId}`}
                measureVersions={Object.fromEntries(
                  catalog.measures
                    .filter(measure => measureIds.includes(measure.id))
                    .map(measure => [String(measure.id), Number(measure.definitionVersion)]),
                )}
                allowed={catalog.access?.export}
                payload={exportPayload}
                disabled={
                  rangePaused ||
                  !!revisionError ||
                  measureIds.length === 0 ||
                  (mode === 'explore' ? !result || queryBusy : !advancedReady)
                }
              />
            </>
          )}
        </div>
      )}

      <div className={cn('mt-4', analysisPanelClassName)}>
        <div role="group" aria-label="탐색 방식" className="mb-4 flex flex-wrap gap-2">
          <AnalysisChoice label="Explore" selected={mode === 'explore'} onClick={() => setMode('explore')} />
          <AnalysisChoice
            label="Pivot"
            selected={mode === 'pivot'}
            onClick={() => {
              setMode('pivot');
              setSavedViewsOpen(false);
            }}
          />
          <AnalysisChoice
            label="고급 Pivot"
            selected={mode === 'advanced'}
            onClick={() => {
              if (!advancedAxes.rowColumns.length && !advancedAxes.columnColumns.length)
                setAdvancedAxes({ rowColumns: dimensions.slice(0, 1), columnColumns: [] });
              setAdvancedReady(false);
              setMode('advanced');
              setSavedViewsOpen(false);
            }}
          />
        </div>

        <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[repeat(4,max-content)]">
          <AnalysisChoice
            label="전체 기간"
            selected={dateMode === 'all'}
            onClick={() => {
              setDateMode('all');
              setComparePrevious(false);
              setLeaderboardSort(DEFAULT_SORT);
              setPage(0);
            }}
          />
          <AnalysisChoice label="사용자 지정" selected={dateMode === 'custom'} onClick={() => setDateMode('custom')} />
          {dateMode === 'custom' && (
            <div className="col-span-full flex flex-wrap items-center gap-2">
              <TextField
                type="date"
                label="시작일"
                value={startDate}
                onChange={event => {
                  setStartDate(event.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
              <TextField
                type="date"
                label="종료일"
                value={endDate}
                onChange={event => {
                  setEndDate(event.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
              <div role="group" aria-label="표시 시간대" className="flex items-center gap-0.5">
                {TIME_ZONES.map(zone => (
                  <AnalysisChoice
                    key={zone}
                    label={zone}
                    ariaLabel={`표시 시간대 ${zone}`}
                    selected={timeZone === zone}
                    onClick={() => {
                      setTimeZone(zone);
                      setPage(0);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {mode !== 'pivot' && (
            <>
              <div role="group" aria-label="집계 단위" className="col-span-1 flex min-w-0 items-center gap-0.5 sm:col-auto">
                {GRAINS.map(item => (
                  <AnalysisChoice
                    key={item.value}
                    label={item.label}
                    ariaLabel={`집계 단위 ${item.label}`}
                    selected={grain === item.value}
                    onClick={() => {
                      setGrain(item.value);
                      setPage(0);
                    }}
                    className="min-w-0 flex-1 sm:min-w-[52px]"
                  />
                ))}
              </div>
              <AnalysisChoice
                label="이전 기간 비교"
                selected={comparePrevious}
                disabled={!dateRange || rangePaused}
                onClick={() => {
                  if (comparePrevious) setLeaderboardSort(DEFAULT_SORT);
                  setComparePrevious(value => !value);
                  setPage(0);
                }}
              />
            </>
          )}
        </div>

        <div className="mt-4 min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {filters.length ? `적용된 필터 ${filters.length}개` : '필터 없음'}
            </p>
            <Button
              id="explore-filter-launcher"
              variant="outline"
              aria-label="필터 추가"
              aria-expanded={filterPanelOpen}
              aria-controls="explore-filter-panel"
              className="shrink-0 rounded-[7px]"
              onClick={() => {
                setFilterError('');
                setFilterPanelOpen(value => !value);
              }}
            >
              필터 추가
            </Button>
          </div>
          {filters.length > 0 && (
            <div role="group" aria-label="적용된 필터" className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {filters.map(filter => {
                const label = `${filter.column}: ${
                  'range' in filter
                    ? `${filter.range.min ?? '제한 없음'} ~ ${filter.range.max ?? '제한 없음'} (양 끝 포함)`
                    : filter.values.map(categoryText).join(', ')
                }`;
                return (
                  <Badge
                    key={filter.column}
                    variant="secondary"
                    className="h-auto min-h-8 max-w-full rounded-md border border-[#d8e5f4] bg-[#f1f6fc] px-2 py-0.5 text-xs leading-normal text-[#214c80]"
                  >
                    <span className="min-w-0 wrap-anywhere">{label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`삭제 ${label}`}
                      className="h-6 shrink-0 px-1 text-xs text-[#6c83a1]"
                      onClick={() => applyFilter(filter.column, [])}
                    >
                      삭제
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {filterPanelOpen && catalog && (
          <div
            id="explore-filter-panel"
            role="group"
            aria-label="필터 설정"
            className="mt-3 min-w-0 rounded-xl border border-[#dce6f2] bg-[#f8fafd] p-4 sm:p-5"
          >
            <div className="mb-3 flex min-w-0 flex-wrap gap-3">
              <TextField
                select
                label="필터 열"
                value={filterColumn}
                onChange={event => {
                  setFilterColumn(event.target.value);
                  setFilterSelection([]);
                  setFilterMode('values');
                  setRangeMin('');
                  setRangeMax('');
                  setFilterError('');
                }}
                className="w-full min-w-0 sm:w-[220px]"
              >
                <option value="">열을 선택하세요</option>
                {catalog.dimensions.map(dimension => (
                  <option key={dimension.column} value={dimension.column}>
                    {dimension.column}
                  </option>
                ))}
              </TextField>
              {filterMode === 'values' && (
                <TextField
                  label="값 검색"
                  value={filterSearch}
                  disabled={!filterColumn}
                  onChange={event => setFilterSearch(event.target.value)}
                  className="w-full min-w-0 sm:w-[220px]"
                />
              )}
            </div>
            {numericFilter && (
              <div role="group" aria-label="숫자 필터 방식" className="mb-2 flex flex-wrap gap-2">
                <AnalysisChoice
                  label="값 선택"
                  selected={filterMode === 'values'}
                  onClick={() => {
                    setFilterMode('values');
                    setFilterError('');
                  }}
                />
                <AnalysisChoice
                  label="숫자 범위"
                  selected={filterMode === 'range'}
                  onClick={() => {
                    setFilterMode('range');
                    setFilterError('');
                  }}
                />
              </div>
            )}
            {filterMode === 'range' && numericFilter ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <TextField
                    label="최솟값 (포함)"
                    value={rangeMin}
                    onChange={event => {
                      setRangeMin(event.target.value);
                      setFilterError('');
                    }}
                    className="w-full min-w-0 flex-1"
                    inputProps={{
                      inputMode: 'decimal',
                      'aria-describedby': filterError ? 'range-filter-error' : 'range-filter-help',
                    }}
                  />
                  <TextField
                    label="최댓값 (포함)"
                    value={rangeMax}
                    onChange={event => {
                      setRangeMax(event.target.value);
                      setFilterError('');
                    }}
                    className="w-full min-w-0 flex-1"
                    inputProps={{
                      inputMode: 'decimal',
                      'aria-describedby': filterError ? 'range-filter-error' : 'range-filter-help',
                    }}
                  />
                </div>
                <p id="range-filter-help" className="mt-2 mb-2 block text-xs leading-relaxed text-muted-foreground">
                  원본 행의 숫자를 필터링합니다. 한쪽을 비우면 제한하지 않습니다. 양 끝값은 포함하고 NULL은 제외합니다.
                </p>
              </>
            ) : filterColumn ? (
              <FilterValueSelect
                sourceId={catalog.sourceId}
                sourceRevision={catalog.sourceRevision}
                column={filterColumn}
                search={filterSearch}
                filters={filters}
                dateRange={dateRange}
                selected={filterSelection}
                onToggle={toggleFilterValue}
                onConflict={handleRevisionConflict}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">필터할 열을 선택하세요.</p>
            )}
            {filterError && (
              <Notice severity="error" id="range-filter-error" className="mt-2 text-xs leading-relaxed">
                {filterError}
              </Notice>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Button
                disabled={!filterColumn || (filterMode === 'values' && filterSelection.length === 0)}
                className="flex-1 sm:flex-none"
                onClick={applyFilterSelection}
              >
                필터 적용
              </Button>
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={closeFilters}>
                닫기
              </Button>
            </div>
          </div>
        )}

        {catalog && mode === 'explore' && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(2,minmax(0,220px))]">
            <TextField
              select
              label="차원 순위 기준"
              value={leaderboardSort.by}
              onChange={event => {
                setLeaderboardSort(value => ({ ...value, by: event.target.value as LeaderboardSort['by'] }));
                setPage(0);
              }}
              className="min-w-0"
            >
              <option value="value">현재 값</option>
              <option value="delta" disabled={!comparePrevious || !dateRange || rangePaused}>
                변화량
              </option>
              <option value="percentChange" disabled={!comparePrevious || !dateRange || rangePaused}>
                증감률
              </option>
            </TextField>
            <TextField
              select
              label="차원 순위 방향"
              value={leaderboardSort.direction}
              onChange={event => {
                setLeaderboardSort(value => ({ ...value, direction: event.target.value as LeaderboardSort['direction'] }));
                setPage(0);
              }}
              className="min-w-0"
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </TextField>
            <p className="col-span-full hidden text-xs leading-normal text-muted-foreground sm:block">
              선택한 지표 기준으로 정렬합니다.
            </p>
          </div>
        )}
        <Separator className="my-4" />

        {catalog && (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                aria-expanded={settingsOpen}
                aria-controls="display-settings"
                onClick={() => setSettingsOpen(value => !value)}
              >
                표시 설정 · 지표 {measureIds.length} / {catalog.measures.length} · 차원 {dimensions.length} /{' '}
                {catalog.dimensions.length}
              </Button>
              {settingsOpen &&
                catalog.measures
                  .filter(measure => measureIds.includes(measure.id))
                  .map(measure => (
                    <Badge
                      key={measure.id}
                      variant="secondary"
                      className="h-auto min-h-7 max-w-full rounded-md bg-[#edf3fb] px-2 py-0.5 text-xs wrap-anywhere text-[#214c80]"
                    >
                      {measure.label}
                    </Badge>
                  ))}
              {settingsOpen &&
                dimensions.map(column => (
                  <Badge
                    key={column}
                    variant="secondary"
                    className="h-auto min-h-7 max-w-full rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs wrap-anywhere text-[#334155]"
                  >
                    {column}
                  </Badge>
                ))}
            </div>
            {settingsOpen && (
              <div
                id="display-settings"
                role="group"
                aria-label="표시 설정"
                className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-bold">지표 (최대 {MAX_MEASURES})</p>
                  {catalog.measures.map(measure => (
                    <AnalysisChoice
                      key={measure.id}
                      label={measure.label}
                      ariaLabel={`지표 ${measure.label}`}
                      selected={measureIds.includes(measure.id)}
                      onClick={() => toggleMeasure(measure.id)}
                    />
                  ))}
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-bold">차원 (최대 {MAX_DIMENSIONS})</p>
                  {catalog.dimensions.map(dimension => (
                    <AnalysisChoice
                      key={dimension.column}
                      label={dimension.column}
                      ariaLabel={`차원 ${dimension.column}`}
                      selected={dimensions.includes(dimension.column)}
                      onClick={() => toggleDimension(dimension.column)}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-bold">기준 지표</p>
                  {catalog.measures
                    .filter(measure => measureIds.includes(measure.id))
                    .map(measure => (
                      <AnalysisChoice
                        key={measure.id}
                        label={measure.label}
                        ariaLabel={`기준 지표 ${measure.label}`}
                        selected={rankingMeasureId === measure.id}
                        onClick={() => {
                          setRankingMeasureId(measure.id);
                          setPage(0);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn('text-xs text-muted-foreground', statusMessage ? 'mt-2 min-h-5' : 'm-0 min-h-0')}
      >
        {statusMessage}
      </p>

      {catalogError && (
        <Notice severity="error" className="mb-4">
          <span className="break-words">{catalogError}</span>
          {catalogForbidden ? (
            <Button variant="ghost" onClick={() => setSourceId('')}>
              다른 데이터 소스 선택
            </Button>
          ) : (
            <Button variant="ghost" onClick={reloadCatalog}>
              카탈로그 다시 불러오기
            </Button>
          )}
        </Notice>
      )}
      {revisionError && (
        <Notice severity="error" className="mb-4">
          <span className="break-words">{revisionError}</span>
          <Button variant="ghost" onClick={reloadCatalog}>
            카탈로그 다시 불러오기
          </Button>
        </Notice>
      )}
      {queryError && (
        <Notice severity="error" className="mb-4">
          <span className="break-words">{queryError}</span>
          <Button variant="ghost" onClick={() => setQueryReload(value => value + 1)}>
            다시 시도
          </Button>
        </Notice>
      )}
      {rangeBackwards && (
        <Notice severity="warning" className="mb-4">
          시작일이 종료일보다 늦습니다. 기간을 다시 지정하면 결과가 표시됩니다.
        </Notice>
      )}
      {rangeIncomplete && (
        <Notice severity="info" className="mb-4">
          사용자 지정 기간의 시작일과 종료일을 모두 입력하면 결과가 표시됩니다.
        </Notice>
      )}
      {!sourceId && !catalogBusy && !catalogError && sources.length === 0 && (
        <Notice severity="info" className="mb-4">
          저장된 데이터가 없습니다.{' '}
          <Button variant="ghost" onClick={() => navigate('/data/file')}>
            파일 저장하러 가기
          </Button>
        </Notice>
      )}

      {catalog && measureIds.length === 0 && (
        <Notice severity="info">지표를 하나 이상 선택하세요. 위의 지표 목록에서 선택하면 결과가 표시됩니다.</Notice>
      )}

      {catalog && mode === 'pivot' && (
        <PivotTable
          canExport={catalog.access?.export}
          key={catalog.sourceId}
          sourceId={catalog.sourceId}
          sourceRevision={catalog.sourceRevision}
          dimensions={catalog.dimensions}
          measureIds={measureIds}
          filters={filters}
          dateRange={dateRange}
          axes={pivotAxes}
          onAxesChange={setPivotAxes}
          onReady={setPivotReady}
          paused={rangePaused}
          onReloadCatalog={reloadCatalog}
          onFilter={next => {
            setFilters(next);
            setPage(0);
          }}
        />
      )}

      {catalog && mode === 'advanced' && (
        <ExplorePivot
          sourceId={catalog.sourceId}
          sourceRevision={catalog.sourceRevision}
          measures={catalog.measures}
          dimensions={catalog.dimensions}
          temporalColumns={catalog.temporalColumns?.map(column => column.column)}
          state={versionedViewState}
          axes={effectiveAdvancedAxes}
          onAxesChange={axes => {
            const queryKey = (value: AdvancedPivotAxes) =>
              JSON.stringify({
                rowColumns: value.rowColumns,
                columnColumns: value.columnColumns,
                rowHierarchy: value.rowHierarchy,
                rowSort: value.rowSort,
                timeAxis: value.timeAxis,
                tableMode: value.tableMode,
              });
            if (queryKey(axes) !== queryKey(effectiveAdvancedAxes)) setAdvancedReady(false);
            setAdvancedAxes(axes);
          }}
          onReady={setAdvancedReady}
          blocked={rangePaused || measureIds.length === 0}
          onFilter={applyFilter}
          onReloadCatalog={reloadCatalog}
          onMeasureToggle={toggleMeasure}
          refreshKey={queryReload}
          formatValue={value => {
            const units = unitPartsOf(value.measureId);
            return formatMetric(value.value, {
              decimalPlaces: decimalsOf(value.measureId),
              prefix: units.prefix,
              suffix: units.suffix,
              numberNotation: notationOf(value.measureId),
            }).text;
          }}
          formatComparison={value => {
            const units = unitPartsOf(value.measureId);
            return compareText(
              { category: '', value: value.value, ...value.comparison },
              decimalsOf(value.measureId),
              units.prefix,
              units.suffix,
              notationOf(value.measureId),
            );
          }}
        />
      )}

      {result && mode === 'explore' && measureIds.length > 0 && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            적용됨 · {result.applied?.trendGrain ?? grain} ·{' '}
            {result.applied?.comparePrevious ? '이전 기간 비교' : '비교 없음'} · 필터 {result.applied?.filters?.length ?? 0}
            개 · 기준 {measureLabel(rankingMeasureId)}
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex w-full min-w-0 flex-col gap-4 md:basis-[44%] md:flex-none">
              {(result.kpis ?? []).map(kpi => {
                const trend = trendFor(kpi);
                const units = unitParts(kpi);
                const decimals = decimalsFor(kpi);
                const numberNotation = notationOf(kpi.id);
                const value = formatMetric(kpi.value, {
                  decimalPlaces: decimals,
                  prefix: units.prefix,
                  suffix: units.suffix,
                  numberNotation,
                });
                return (
                  <div key={String(kpi.id)} className="min-w-0 rounded-[10px] border border-[#e0e6ee] bg-card p-4 sm:p-5">
                    <p className="text-[13px] text-muted-foreground">{kpi.title}</p>
                    <p
                      title={value.exactText}
                      aria-label={value.exactText}
                      className="mt-1.5 mb-2 text-[34px] leading-tight font-bold tabular-nums text-[#172b46]"
                    >
                      {value.text}
                    </p>
                    {(trend || kpi.comparison) && (
                      <MetricTrend
                        trend={trend}
                        title={kpi.title}
                        prefix={units.prefix}
                        suffix={units.suffix}
                        decimalPlaces={decimals}
                        numberNotation={numberNotation}
                        comparison={comparisonFor(kpi)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="w-full min-w-0 md:flex-1">
              <p className="mb-3 text-sm font-bold">
                {dimensions.length} / {catalog.dimensions.length} 차원 · {measureLabel(rankingMeasureId)} 기준
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                {(result.leaderboards ?? []).map(board => (
                  <LeaderboardCard
                    key={board.column}
                    board={board}
                    onSelect={applyFilter}
                    decimalPlaces={rankingDecimals}
                    numberNotation={notationOf(rankingMeasureId)}
                    unitPrefix={rankingUnits.prefix}
                    unitSuffix={rankingUnits.suffix}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {mode === 'explore' && (
        <div className="mt-6">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={includeRows}
            aria-controls="model-data"
            onClick={() => {
              setIncludeRows(value => !value);
              setPage(0);
            }}
          >
            Model Data {includeRows ? '접기' : '펼치기'}
          </Button>
          {includeRows && (
            <div id="model-data" role="region" aria-label="Model Data" className="mt-2 overflow-x-auto">
              <p className="mb-2 text-xs text-muted-foreground">집계 결과 행입니다. 실제 물리 요청 수와 다를 수 있습니다.</p>
              {detailRows.length > 0 && (
                <>
                  <Table className="w-full text-[13px]">
                    <TableCaption className="mt-0 pb-1 text-left text-[13px] text-[#475569]">
                      총 {formatMetric(details?.totalRows).text}행 중 {page * detailsSize + 1}–
                      {Math.min((page + 1) * detailsSize, totalRows)}행
                    </TableCaption>
                    <TableHeader className="[&_tr]:border-0">
                      <TableRow className="border-0 hover:bg-transparent">
                        {detailColumns.map(column => (
                          <TableHead key={column} scope="col" className="h-auto border-b p-1 text-left">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex} className="border-0 hover:bg-transparent">
                          {detailColumns.map(column => (
                            <TableCell key={column} className="border-b border-[#f1f5f9] p-1 whitespace-normal align-top">
                              {categoryText(row[column])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      disabled={page <= 0}
                      onClick={() => setPage(current => Math.max(0, current - 1))}
                    >
                      이전
                    </Button>
                    <p className="text-[13px]">
                      {page + 1} / {totalPages} 페이지
                    </p>
                    <Button
                      variant="ghost"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage(current => current + 1)}
                    >
                      다음
                    </Button>
                  </div>
                </>
              )}
              {detailRows.length === 0 && (
                <p className="text-[13px] text-muted-foreground">
                  {queryBusy ? '결과를 불러오는 중…' : '표시할 행이 없습니다.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Modes: our Explore/Pivot (PivotTable + restful saved views) stay the default design; the remote
 * advanced ExplorePivot keeps its own mode and its versioned saved views/CSV export, so neither
 * implementation is lost.
 */
export default function SourceExplore() {
  return (
    <AnalysisUiProvider>
      <SourceExploreContent />
    </AnalysisUiProvider>
  );
}
