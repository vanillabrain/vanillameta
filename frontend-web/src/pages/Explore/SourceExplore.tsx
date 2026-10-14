import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { get, post } from '@/helpers/apiHelper';
import MetricTrend from '@/pages/Dashboard/Components/MetricTrend';
import ExploreSavedViews, { ExploreViewState } from './ExploreSavedViews';
import ExplorePivot, { DEFAULT_PIVOT_SORT, normalizePivotSort, PivotAxes } from './ExplorePivot';
import ExploreExport from './ExploreExport';
import type { MetricComparisonData } from '@/pages/Dashboard/Components/PeriodComparison';
import type { MetricTrendData } from '@/pages/Dashboard/Components/trendGeometry';

const ACCENT = '#4f46e5';
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
type ExploreValueFilter = { column: string; values: FilterValue[] };
type ExploreRange = { min?: number; max?: number };
type ExploreRangeFilter = { column: string; range: ExploreRange };
type ExploreFilter = ExploreValueFilter | ExploreRangeFilter;
type RankingSortBy = 'value' | 'delta' | 'percentChange';
type RankingSort = { by: RankingSortBy; direction: 'asc' | 'desc' };
type ExploreDateRange = { column: string; start: string; end: string; timeZone?: string };
type TrendGrain = 'day' | 'week' | 'month';
type Source = { id: number; name: string; engine?: string };
type Measure = { id: number; label: string; definitionVersion?: number; definition?: unknown };
type Dimension = { column: string; type?: string; numeric?: boolean; temporal?: boolean };
type TemporalColumn = { column: string; min?: string | null; max?: string | null };
type Catalog = {
  sourceId: number;
  name: string;
  sourceRevision: string;
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

/** Group integer digits textually so long counts keep full precision instead of going through Number(). */
const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const numericText = (value: unknown): string | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string' && /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value.trim())) return value.trim();
  return null;
};
const numberText = (value: unknown, decimalPlaces = 0, prefix = '', suffix = '') => {
  const raw = numericText(value);
  if (raw === null) return '값 없음';
  if (raw.includes('.') || /[eE]/.test(raw)) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return '값 없음';
    const formatted = numeric.toLocaleString('ko-KR', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
    return `${prefix}${formatted}${suffix}`;
  }
  const negative = raw.startsWith('-');
  return `${prefix}${negative ? '-' : ''}${groupDigits(raw.replace(/^[+-]/, ''))}${suffix}`;
};

/** Signed magnitude keeps the sign outside a currency prefix so "-$12.00" reads correctly. */
const signedText = (value: unknown, decimalPlaces: number, prefix: string, suffix: string) => {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  const magnitude = numberText(Math.abs(numeric), decimalPlaces, prefix, suffix);
  if (numeric > 0) return '+' + magnitude;
  if (numeric < 0) return '-' + magnitude;
  return magnitude;
};
/** Compact compare line for a leaderboard row; an explicit null previous value stays "no value". */
const compareText = (row: LeaderboardRow, decimalPlaces: number, prefix: string, suffix: string) => {
  if (numericText(row.previousValue) === null) return '이전 값 없음';
  const parts = ['이전 ' + numberText(row.previousValue, decimalPlaces, prefix, suffix)];
  const delta = signedText(row.delta, decimalPlaces, prefix, suffix);
  if (delta !== null) parts.push('변화 ' + delta);
  if (numericText(row.percentChange) !== null) parts.push(numberText(row.percentChange, 1) + '%');
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

const DEFAULT_RANKING_SORT: RankingSort = { by: 'value', direction: 'desc' };

const isRangeFilter = (filter: ExploreFilter): filter is ExploreRangeFilter => 'range' in filter;

/** Inclusive range keeps finite bounds only; at least one bound must survive and min must not exceed max. */
const rangeError = (min: string, max: string): string | null => {
  const hasMin = min.trim() !== '';
  const hasMax = max.trim() !== '';
  if (!hasMin && !hasMax) return '범위 값을 하나 이상 입력하세요.';
  const minValue = hasMin ? Number(min) : undefined;
  const maxValue = hasMax ? Number(max) : undefined;
  if (hasMin && !Number.isFinite(minValue)) return '최소값은 유한한 숫자여야 합니다.';
  if (hasMax && !Number.isFinite(maxValue)) return '최대값은 유한한 숫자여야 합니다.';
  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) return '최소값은 최대값보다 클 수 없습니다.';
  return null;
};

const buildRange = (min: string, max: string): ExploreRange => {
  const range: ExploreRange = {};
  if (min.trim() !== '') range.min = Number(min);
  if (max.trim() !== '') range.max = Number(max);
  return range;
};

const rangeSummary = (range: ExploreRange) => {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) return `${min} ~ ${max}`;
  if (min !== undefined) return `${min} 이상`;
  if (max !== undefined) return `${max} 이하`;
  return '범위 없음';
};

const filterSummary = (filter: ExploreFilter) =>
  isRangeFilter(filter) ? rangeSummary(filter.range) : filter.values.map(categoryText).join(', ');

function Pill({
  label,
  selected,
  onClick,
  disabled,
  ariaLabel,
}: {
  label: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      size="small"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minHeight: 32,
        px: 1.5,
        borderRadius: 999,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: 13,
        color: selected ? '#ffffff' : '#334155',
        backgroundColor: selected ? ACCENT : '#ffffff',
        border: '1px solid',
        borderColor: selected ? ACCENT : '#e2e8f0',
        '&:hover': { backgroundColor: selected ? '#4338ca' : '#f8fafc' },
      }}
    >
      {label}
    </Button>
  );
}

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
    <Box role="group" aria-label="값 선택" sx={{ maxHeight: 220, overflow: 'auto' }}>
      {busy && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>값을 불러오는 중…</Typography>}
      {error && (
        <Typography role="alert" sx={{ fontSize: 13, color: 'error.main' }}>
          {error}
        </Typography>
      )}
      {!busy && !error && values.length === 0 && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>조건에 맞는 값이 없습니다.</Typography>
      )}
      {values.map((value, index) => (
        <FormControlLabel
          key={`${column}-${index}`}
          control={
            <Checkbox
              size="small"
              checked={selected.some(current => Object.is(current, value))}
              onChange={() => onToggle(value)}
              inputProps={{ 'aria-label': categoryText(value) }}
            />
          }
          label={categoryText(value)}
        />
      ))}
      {truncated && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>일부 값만 표시됩니다. 검색으로 좁혀 보세요.</Typography>
      )}
    </Box>
  );
}

function LeaderboardCard({
  board,
  onSelect,
  decimalPlaces,
  unitPrefix,
  unitSuffix,
}: {
  board: Leaderboard;
  onSelect: (column: string, values: FilterValue[]) => void;
  decimalPlaces: number;
  unitPrefix: string;
  unitSuffix: string;
}) {
  const rows = board.rows ?? [];
  const max = rows.reduce((best, row) => Math.max(best, toNumber(row.value) ?? 0), 0);
  return (
    <Card variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'anywhere' }}>
        {board.column}
      </Typography>
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>표시할 값이 없습니다.</Typography>
      ) : (
        <Stack component="ul" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((row, index) => {
            const numeric = toNumber(row.value) ?? 0;
            const width = max > 0 ? Math.max(2, Math.round((numeric / max) * 100)) : 0;
            return (
              <Box component="li" key={`${board.column}-${index}`}>
                <Button
                  type="button"
                  aria-label={`필터 적용: ${board.column} = ${categoryText(row.category)}`}
                  onClick={() => onSelect(board.column, [row.category as FilterValue])}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: 'auto',
                    minHeight: 'previousValue' in row ? 48 : 32,
                    py: 0.5,
                    px: 0.75,
                    justifyContent: 'space-between',
                    gap: 1,
                    overflow: 'hidden',
                    borderRadius: 1,
                    textTransform: 'none',
                    color: '#1e293b',
                    textAlign: 'left',
                    '&:hover': { backgroundColor: '#f8fafc' },
                  }}
                >
                  <Box
                    component="span"
                    aria-hidden={true}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${width}%`,
                      backgroundColor: '#e0e7ff',
                      pointerEvents: 'none',
                    }}
                  />
                  <Box
                    component="span"
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.25,
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {categoryText(row.category)}
                      </Box>
                      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {numberText(row.value, decimalPlaces, unitPrefix, unitSuffix)}
                      </Box>
                    </Box>
                    {'previousValue' in row && (
                      <Box
                        component="span"
                        sx={{
                          fontSize: 11,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {compareText(row, decimalPlaces, unitPrefix, unitSuffix)}
                      </Box>
                    )}
                  </Box>
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}
      {board.truncated && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>상위 20개만 표시</Typography>}
    </Card>
  );
}

export default function SourceExplore() {
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
  const [measureIds, setMeasureIds] = useState<number[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [rankingMeasureId, setRankingMeasureId] = useState<number | null>(null);
  const [rankingSort, setRankingSort] = useState<RankingSort>(DEFAULT_RANKING_SORT);
  const [filters, setFilters] = useState<ExploreFilter[]>([]);
  const [grain, setGrain] = useState<TrendGrain>('day');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [dateMode, setDateMode] = useState<'all' | 'custom'>('all');
  const [timeZone, setTimeZone] = useState('UTC');
  const [dateColumn, setDateColumn] = useState('');
  const [pivotMode, setPivotMode] = useState(false);
  const [pivotAxes, setPivotAxes] = useState<PivotAxes>({ rowColumns: [], columnColumns: [] });
  const [pivotReady, setPivotReady] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSelection, setFilterSelection] = useState<FilterValue[]>([]);
  const [filterMode, setFilterMode] = useState<'values' | 'range'>('values');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
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

  const temporalColumn = dateColumn || catalog?.temporalColumns?.[0]?.column || '';
  const dateRange = useMemo<ExploreDateRange | undefined>(() => {
    if (dateMode !== 'custom' || !temporalColumn || !startDate || !endDate) return undefined;
    return { column: temporalColumn, start: startDate, end: endDate, timeZone };
  }, [dateMode, temporalColumn, startDate, endDate, timeZone]);
  const rangeIncomplete = dateMode === 'custom' && (!startDate || !endDate);
  const rangeBackwards = dateMode === 'custom' && !!startDate && !!endDate && startDate > endDate;
  const rangePaused = rangeIncomplete || rangeBackwards;

  const resetAllState = () => {
    setMeasureIds([]);
    setDimensions([]);
    setRankingMeasureId(null);
    setRankingSort(DEFAULT_RANKING_SORT);
    setFilters([]);
    setGrain('day');
    setComparePrevious(false);
    setDateMode('all');
    setTimeZone('UTC');
    setDateColumn('');
    setPivotMode(false);
    setPivotAxes({ rowColumns: [], columnColumns: [] });
    setPivotReady(false);
    setStartDate('');
    setEndDate('');
    setFilterPanelOpen(false);
    setSettingsOpen(false);
    setFilterColumn('');
    setFilterSearch('');
    setFilterSelection([]);
    setFilterMode('values');
    setRangeMin('');
    setRangeMax('');
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
      setCatalogBusy(false);
      resetAllState();
      return undefined;
    }
    catalogRevision.current += 1;
    const token = catalogRevision.current;
    const abort = new AbortController();
    setCatalog(null);
    setCatalogError('');
    setCatalogBusy(true);
    resetAllState();
    post('/bi/explore/catalog', { sourceId: Number(sourceId) }, { signal: abort.signal })
      .then(unwrap<Catalog>)
      .then(data => {
        if (catalogRevision.current !== token) return;
        setCatalog(data);
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
        setCatalogError('데이터 소스를 분석하지 못했습니다. 카탈로그를 다시 불러와 주세요.');
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
    if (!catalog || !sourceId || measureIds.length === 0 || rangePaused || pivotMode) {
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
      rankingSort,
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
    filters,
    rankingSort,
    dateRange,
    grain,
    comparePrevious,
    page,
    includeRows,
    queryReload,
    rangePaused,
    pivotMode,
  ]);

  const applyFilter = (column: string, values: FilterValue[]) => {
    setColumnFilter(column, values.length > 0 ? { column, values } : null);
  };
  const applyRange = (column: string, range: ExploreRange) => setColumnFilter(column, { column, range });
  const setColumnFilter = (column: string, filter: ExploreFilter | null) => {
    setFilters(previous => {
      const next = previous.filter(item => item.column !== column);
      if (filter) next.push(filter);
      return next;
    });
    setPage(0);
  };
  const selectSortBy = (by: RankingSortBy) => {
    if (by !== 'value' && !comparePrevious) return;
    setRankingSort(current => (current.by === by ? current : { ...current, by }));
    setPage(0);
  };
  const selectSortDirection = (direction: 'asc' | 'desc') => {
    setRankingSort(current => (current.direction === direction ? current : { ...current, direction }));
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
  const applyFilterSelection = () => {
    applyFilter(filterColumn, filterSelection);
    closeFilterPanel();
  };
  const applyRangeSelection = () => {
    if (!filterColumn || rangeError(rangeMin, rangeMax)) return;
    applyRange(filterColumn, buildRange(rangeMin, rangeMax));
    closeFilterPanel();
  };
  const closeFilterPanel = () => {
    setFilterPanelOpen(false);
    setFilterColumn('');
    setFilterSearch('');
    setFilterSelection([]);
    setFilterMode('values');
    setRangeMin('');
    setRangeMax('');
  };
  const handleRevisionConflict = () => {
    setRevisionError('데이터 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 다시 시도해 주세요.');
  };

  const trendFor = (kpi: Kpi): MetricTrendData | undefined => {
    const points = (kpi.trend?.points ?? []).filter(point => point && typeof point.time === 'string' && point.time !== '');
    if (points.length === 0) return undefined;
    const data: MetricTrendData = {
      column: String(kpi.id),
      grain,
      points: points.map(point => ({ time: point.time, value: toNumber(point.value) })),
    };
    if (kpi.trend?.timeZone) data.timeZone = kpi.trend.timeZone;
    return data;
  };
  const definitionOf = (id: number | string | null) =>
    catalog?.measures.find(measure => String(measure.id) === String(id))?.definition as
      | { unit?: string; decimalPlaces?: number }
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
  const rankingDecimals = decimalsOf(rankingMeasureId);
  const comparisonFor = (kpi: Kpi): MetricComparisonData | undefined => {
    if (!kpi.comparison) return undefined;
    const data: MetricComparisonData = {
      previousValue: toNumber(kpi.comparison.previousValue),
      delta: toNumber(kpi.comparison.delta),
      percentChange: toNumber(kpi.comparison.percentChange),
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
  const filterColumnNumeric = !!catalog?.dimensions.find(dimension => dimension.column === filterColumn)?.numeric;
  const rangeInvalid = filterMode === 'range' && rangeError(rangeMin, rangeMax) !== null;
  const rangeMessage =
    filterMode === 'range' && (rangeMin.trim() !== '' || rangeMax.trim() !== '') ? rangeError(rangeMin, rangeMax) : null;
  const reloadCatalog = () => setCatalogReload(value => value + 1);
  const versionsKnown = measureIds.every(id => {
    const version = catalog?.measures.find(measure => measure.id === id)?.definitionVersion;
    return Number.isSafeInteger(version) && Number(version) > 0;
  });
  // A stale measure, a change order without a compared period or a cell scope the axes no longer
  // bound all fall back before the request, the saved view and the export share one order.
  const pivotSort = normalizePivotSort(pivotAxes.rowSort, {
    measureIds,
    comparePrevious,
    columnColumns: pivotAxes.columnColumns,
  });
  const effectivePivotAxes: PivotAxes = { ...pivotAxes, ...(pivotSort ? { rowSort: pivotSort } : {}) };
  const extendedPivot =
    !!pivotAxes.rowHierarchy || (!!pivotSort && (pivotSort.by !== 'label' || pivotSort.direction !== 'asc'));
  const pivotStored = pivotMode || pivotAxes.rowColumns.length > 0 || pivotAxes.columnColumns.length > 0;
  const requiresV4 =
    !!pivotAxes.timeAxis ||
    pivotSort?.columnTuple !== undefined ||
    pivotSort?.by === 'delta' ||
    pivotSort?.by === 'percentChange';
  const viewVersion: ExploreViewState['version'] = requiresV4 ? 4 : extendedPivot ? 3 : pivotStored ? 2 : 1;
  const viewState: ExploreViewState = {
    version: viewVersion,
    ...(viewVersion >= 2
      ? {
          pivot: {
            enabled: pivotMode,
            rowColumns: pivotAxes.rowColumns,
            columnColumns: pivotAxes.columnColumns,
            ...(viewVersion >= 3
              ? {
                  rowHierarchy: pivotAxes.rowHierarchy ?? false,
                  rowSort: pivotSort ?? DEFAULT_PIVOT_SORT,
                  expandedRows:
                    pivotAxes.rowHierarchy && pivotAxes.rowColumns.length === 2 ? pivotAxes.expandedRows ?? [] : [],
                }
              : {}),
            ...(viewVersion === 4 && pivotAxes.timeAxis ? { timeAxis: pivotAxes.timeAxis } : {}),
          },
        }
      : {}),
    measureIds,
    dimensionColumns: dimensions,
    rankingMeasureId: rankingMeasureId ?? measureIds[0],
    rankingSort,
    filters,
    ...(dateRange ? { dateRange } : {}),
    timeZone,
    trendGrain: grain,
    comparePrevious,
    includeRows,
  };
  const restoreView = (state: ExploreViewState) => {
    queryRevision.current += 1;
    queryAbort.current?.abort();
    setResult(null);
    setQueryError('');
    setRevisionError('');
    setPivotMode(state.pivot?.enabled ?? false);
    setPivotAxes(
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
            ...(state.version === 4 && state.pivot.timeAxis ? { timeAxis: state.pivot.timeAxis } : {}),
          }
        : { rowColumns: [], columnColumns: [] },
    );
    setPivotReady(false);
    setMeasureIds(state.measureIds);
    setDimensions(state.dimensionColumns);
    setRankingMeasureId(state.rankingMeasureId);
    setRankingSort(state.rankingSort);
    setFilters(state.filters);
    setGrain(state.trendGrain);
    setComparePrevious(state.comparePrevious);
    setTimeZone(state.timeZone);
    setDateMode(state.dateRange ? 'custom' : 'all');
    setDateColumn(state.dateRange?.column ?? '');
    setStartDate(state.dateRange?.start ?? '');
    setEndDate(state.dateRange?.end ?? '');
    setIncludeRows(state.includeRows);
    setPage(0);
    closeFilterPanel();
    setQueryReload(value => value + 1);
  };

  const exportPayload = {
    mode: pivotMode ? ('pivot' as const) : ('explore' as const),
    query: {
      sourceId: catalog?.sourceId,
      sourceRevision: catalog?.sourceRevision,
      measureIds,
      filters,
      ...(dateRange ? { dateRange } : {}),
      comparePrevious,
      ...(pivotMode
        ? {
            rowColumns: pivotAxes.rowColumns,
            columnColumns: pivotAxes.columnColumns,
            ...(pivotAxes.rowHierarchy !== undefined ? { rowHierarchy: pivotAxes.rowHierarchy } : {}),
            ...(pivotSort ? { rowSort: pivotSort } : {}),
            ...(pivotAxes.timeAxis ? { timeAxis: pivotAxes.timeAxis } : {}),
          }
        : {
            dimensionColumns: dimensions,
            rankingMeasureId: rankingMeasureId ?? measureIds[0],
            rankingSort,
            trendGrain: grain,
            includeRows: false,
          }),
    },
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        maxWidth: 1400,
        width: '100%',
        mx: 'auto',
        minWidth: 0,
        backgroundColor: '#ffffff',
        '& .MuiButton-root': { minHeight: 32 },
        '& .MuiInputBase-root': { minHeight: 36 },
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        sx={{ flexWrap: 'wrap', mb: 1.5, minWidth: 0 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', minWidth: 0 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
            지표 탐색
          </Typography>
          <TextField
            select
            size="small"
            label="데이터 소스"
            value={sourceId}
            disabled={sources.length === 0}
            onChange={event => setSourceId(event.target.value)}
            sx={{ minWidth: 220 }}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">데이터를 선택하세요</option>
            {sources.map(source => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </TextField>
          {catalog && (
            <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {catalog.name} · {numberText(catalog.rowCount)}행
            </Typography>
          )}
        </Stack>
        <Button
          onClick={() => navigate(`/explore${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`)}
          sx={{ textTransform: 'none' }}
        >
          지표 빌더
        </Button>
      </Stack>

      <Divider />
      {catalog && (
        <ExploreSavedViews
          sourceId={catalog.sourceId}
          sourceRevision={catalog.sourceRevision}
          measureVersions={Object.fromEntries(
            catalog.measures
              .filter(measure => measureIds.includes(measure.id))
              .map(measure => [String(measure.id), Number(measure.definitionVersion)]),
          )}
          state={viewState}
          canSave={
            (pivotMode ? pivotReady : !!result && !queryBusy) &&
            !rangePaused &&
            !revisionError &&
            measureIds.length > 0 &&
            versionsKnown
          }
          disabledReason={!versionsKnown ? '지표 정의 버전을 확인할 수 없습니다. 카탈로그를 다시 불러와 주세요.' : undefined}
          onRestore={restoreView}
        />
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mt: 1.5 }}>
        <Pill
          label="전체 기간"
          selected={dateMode === 'all'}
          onClick={() => {
            setDateMode('all');
            setComparePrevious(false);
            setRankingSort(DEFAULT_RANKING_SORT);
            setPage(0);
          }}
        />
        <Pill label="사용자 지정" selected={dateMode === 'custom'} onClick={() => setDateMode('custom')} />
        {dateMode === 'custom' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>기간 열: {temporalColumn}</Typography>
            <TextField
              size="small"
              type="date"
              label="시작일"
              value={startDate}
              onChange={event => {
                setStartDate(event.target.value);
                setPage(0);
              }}
              sx={{ width: 160 }}
            />
            <TextField
              size="small"
              type="date"
              label="종료일"
              value={endDate}
              onChange={event => {
                setEndDate(event.target.value);
                setPage(0);
              }}
              sx={{ width: 160 }}
            />
            <Stack direction="row" spacing={0.5} alignItems="center" role="group" aria-label="표시 시간대">
              {Array.from(new Set([...TIME_ZONES, timeZone])).map(zone => (
                <Pill
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
            </Stack>
          </Stack>
        )}
        <Divider orientation="vertical" flexItem />
        {!pivotMode && (
          <Stack direction="row" spacing={0.5} alignItems="center" role="group" aria-label="집계 단위">
            {GRAINS.map(item => (
              <Pill
                key={item.value}
                label={item.label}
                ariaLabel={`집계 단위 ${item.label}`}
                selected={grain === item.value}
                onClick={() => {
                  setGrain(item.value);
                  setPage(0);
                }}
              />
            ))}
          </Stack>
        )}
        <Pill
          label="이전 기간 비교"
          selected={comparePrevious}
          disabled={!dateRange || rangePaused}
          onClick={() => {
            const next = !comparePrevious;
            setComparePrevious(next);
            if (!next) setRankingSort(current => (current.by === 'value' ? current : DEFAULT_RANKING_SORT));
            setPage(0);
          }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mt: 1.5, minWidth: 0 }}>
        {filters.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>필터 없음</Typography>}
        {filters.map(filter => (
          <Chip
            key={filter.column}
            label={`${filter.column}: ${filterSummary(filter)}`}
            onDelete={() => setColumnFilter(filter.column, null)}
            sx={{ backgroundColor: '#eef2ff', color: '#312e81' }}
          />
        ))}
        <Pill
          label="필터 추가"
          ariaLabel="필터 추가"
          selected={filterPanelOpen}
          onClick={() => setFilterPanelOpen(value => !value)}
        />
      </Stack>

      {filterPanelOpen && catalog && (
        <Box sx={{ mt: 1, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, backgroundColor: '#f8fafc' }}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              size="small"
              label="필터 열"
              value={filterColumn}
              onChange={event => {
                setFilterColumn(event.target.value);
                setFilterSelection([]);
                setFilterMode('values');
                setRangeMin('');
                setRangeMax('');
              }}
              sx={{ minWidth: 220 }}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">열을 선택하세요</option>
              {catalog.dimensions.map(dimension => (
                <option key={dimension.column} value={dimension.column}>
                  {dimension.column}
                </option>
              ))}
            </TextField>
            {filterColumnNumeric && (
              <Stack direction="row" spacing={0.5} alignItems="center" role="group" aria-label="필터 모드">
                <Pill
                  label="값"
                  ariaLabel="필터 모드 값"
                  selected={filterMode === 'values'}
                  onClick={() => setFilterMode('values')}
                />
                <Pill
                  label="범위"
                  ariaLabel="필터 모드 범위"
                  selected={filterMode === 'range'}
                  onClick={() => setFilterMode('range')}
                />
              </Stack>
            )}
            <TextField
              size="small"
              label="값 검색"
              value={filterSearch}
              disabled={!filterColumn || filterMode === 'range'}
              onChange={event => setFilterSearch(event.target.value)}
              sx={{ minWidth: 220 }}
            />
          </Stack>
          {filterColumn ? (
            filterMode === 'range' ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    type="number"
                    label="최소값"
                    value={rangeMin}
                    onChange={event => setRangeMin(event.target.value)}
                    sx={{ width: 160 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="최대값"
                    value={rangeMax}
                    onChange={event => setRangeMax(event.target.value)}
                    sx={{ width: 160 }}
                  />
                </Stack>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  경계를 포함하며 최소값·최대값 중 하나만 지정해도 됩니다.
                </Typography>
                {rangeMessage && (
                  <Typography role="alert" sx={{ fontSize: 13, color: 'error.main' }}>
                    {rangeMessage}
                  </Typography>
                )}
              </Stack>
            ) : (
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
            )
          ) : (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>필터할 열을 선택하세요.</Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              disabled={!filterColumn || (filterMode === 'range' ? rangeInvalid : filterSelection.length === 0)}
              onClick={filterMode === 'range' ? applyRangeSelection : applyFilterSelection}
            >
              필터 적용
            </Button>
            <Button onClick={() => setFilterPanelOpen(false)}>닫기</Button>
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 1.5 }} />

      {catalog && (
        <Stack direction="row" spacing={1} role="group" aria-label="탐색 방식" sx={{ mt: 2 }}>
          <Pill label="탐색" selected={!pivotMode} onClick={() => setPivotMode(false)} />
          <Pill
            label="Pivot"
            selected={pivotMode}
            onClick={() => {
              if (!pivotAxes.rowColumns.length && !pivotAxes.columnColumns.length)
                setPivotAxes({ rowColumns: dimensions.slice(0, 1), columnColumns: [] });
              setPivotReady(false);
              setPivotMode(true);
            }}
          />
        </Stack>
      )}

      {catalog && (
        <ExploreExport
          payload={exportPayload}
          disabled={(pivotMode ? !pivotReady : !result || queryBusy) || rangePaused || !!revisionError || !measureIds.length}
        />
      )}

      {catalog && !pivotMode && (
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <Button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="display-settings"
              onClick={() => setSettingsOpen(value => !value)}
              sx={{ textTransform: 'none' }}
            >
              표시 설정 · 지표 {measureIds.length} / {catalog.measures.length} · 차원 {dimensions.length} /{' '}
              {catalog.dimensions.length}
            </Button>
            {catalog.measures
              .filter(measure => measureIds.includes(measure.id))
              .map(measure => (
                <Chip key={measure.id} label={measure.label} sx={{ backgroundColor: '#eef2ff', color: '#312e81' }} />
              ))}
            {dimensions.map(column => (
              <Chip key={column} label={column} sx={{ backgroundColor: '#f1f5f9', color: '#334155' }} />
            ))}
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            role="group"
            aria-label="차원 정렬"
            sx={{ flexWrap: 'wrap' }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>차원 정렬</Typography>
            <Pill
              label="현재값"
              ariaLabel="정렬 기준 현재값"
              selected={rankingSort.by === 'value'}
              onClick={() => selectSortBy('value')}
            />
            <Pill
              label="변화량"
              ariaLabel="정렬 기준 변화량"
              selected={rankingSort.by === 'delta'}
              disabled={!comparePrevious}
              onClick={() => selectSortBy('delta')}
            />
            <Pill
              label="변화율"
              ariaLabel="정렬 기준 변화율"
              selected={rankingSort.by === 'percentChange'}
              disabled={!comparePrevious}
              onClick={() => selectSortBy('percentChange')}
            />
            <Divider orientation="vertical" flexItem />
            <Pill
              label="내림차순"
              ariaLabel="정렬 방향 내림차순"
              selected={rankingSort.direction === 'desc'}
              onClick={() => selectSortDirection('desc')}
            />
            <Pill
              label="오름차순"
              ariaLabel="정렬 방향 오름차순"
              selected={rankingSort.direction === 'asc'}
              onClick={() => selectSortDirection('asc')}
            />
          </Stack>
          {settingsOpen && (
            <Box
              id="display-settings"
              role="group"
              aria-label="표시 설정"
              sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, backgroundColor: '#f8fafc' }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>지표 (최대 {MAX_MEASURES})</Typography>
                {catalog.measures.map(measure => (
                  <Pill
                    key={measure.id}
                    label={measure.label}
                    ariaLabel={`지표 ${measure.label}`}
                    selected={measureIds.includes(measure.id)}
                    onClick={() => toggleMeasure(measure.id)}
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>차원 (최대 {MAX_DIMENSIONS})</Typography>
                {catalog.dimensions.map(dimension => (
                  <Pill
                    key={dimension.column}
                    label={dimension.column}
                    ariaLabel={`차원 ${dimension.column}`}
                    selected={dimensions.includes(dimension.column)}
                    onClick={() => toggleDimension(dimension.column)}
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>기준 지표</Typography>
                {catalog.measures
                  .filter(measure => measureIds.includes(measure.id))
                  .map(measure => (
                    <Pill
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
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      <Typography role="status" aria-live="polite" sx={{ mt: 1, minHeight: 20, fontSize: 13, color: 'text.secondary' }}>
        {statusMessage}
      </Typography>

      {catalogError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {catalogError}
          <Button onClick={reloadCatalog}>카탈로그 다시 불러오기</Button>
        </Alert>
      )}
      {revisionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {revisionError}
          <Button onClick={reloadCatalog}>카탈로그 다시 불러오기</Button>
        </Alert>
      )}
      {queryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {queryError}
          <Button onClick={() => setQueryReload(value => value + 1)}>다시 시도</Button>
        </Alert>
      )}
      {rangeBackwards && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          시작일이 종료일보다 늦습니다. 기간을 다시 지정하면 결과가 표시됩니다.
        </Alert>
      )}
      {rangeIncomplete && (
        <Alert severity="info" sx={{ mb: 2 }}>
          사용자 지정 기간의 시작일과 종료일을 모두 입력하면 결과가 표시됩니다.
        </Alert>
      )}
      {!sourceId && !catalogBusy && !catalogError && sources.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          저장된 데이터가 없습니다. <Button onClick={() => navigate('/data/file')}>파일 저장하러 가기</Button>
        </Alert>
      )}

      {catalog && measureIds.length === 0 && (
        <Alert severity="info">지표를 하나 이상 선택하세요. 위의 지표 목록에서 선택하면 결과가 표시됩니다.</Alert>
      )}

      {catalog && pivotMode && (
        <ExplorePivot
          sourceId={catalog.sourceId}
          sourceRevision={catalog.sourceRevision}
          measures={catalog.measures}
          dimensions={catalog.dimensions}
          temporalColumns={catalog.temporalColumns?.map(column => column.column)}
          state={viewState}
          axes={effectivePivotAxes}
          onAxesChange={axes => {
            const queryKey = (query: PivotAxes) =>
              JSON.stringify({
                rowColumns: query.rowColumns,
                columnColumns: query.columnColumns,
                rowHierarchy: query.rowHierarchy,
                rowSort: query.rowSort,
                timeAxis: query.timeAxis,
              });
            if (queryKey(axes) !== queryKey(effectivePivotAxes)) setPivotReady(false);
            setPivotAxes(axes);
          }}
          onReady={setPivotReady}
          blocked={rangePaused || measureIds.length === 0}
          onFilter={applyFilter}
          onReloadCatalog={reloadCatalog}
          onMeasureToggle={toggleMeasure}
          refreshKey={queryReload}
          formatValue={value => {
            const units = unitPartsOf(value.measureId);
            return numberText(value.value, decimalsOf(value.measureId), units.prefix, units.suffix);
          }}
          formatComparison={value => {
            const units = unitPartsOf(value.measureId);
            return compareText(
              { category: '', value: value.value, ...value.comparison },
              decimalsOf(value.measureId),
              units.prefix,
              units.suffix,
            );
          }}
        />
      )}

      {result && !pivotMode && measureIds.length > 0 && (
        <>
          <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>
            적용됨 · {result.applied?.trendGrain ?? grain} ·{' '}
            {result.applied?.comparePrevious ? '이전 기간 비교' : '비교 없음'} · 필터 {result.applied?.filters?.length ?? 0}
            개 · 기준 {measureLabel(rankingMeasureId)}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start', mt: 1 }}>
            <Box sx={{ flex: { md: '0 0 44%' }, width: { xs: '100%' }, minWidth: 0 }}>
              {(result.kpis ?? []).map(kpi => {
                const trend = trendFor(kpi);
                const units = unitParts(kpi);
                const decimals = decimalsFor(kpi);
                return (
                  <Box key={String(kpi.id)} sx={{ mb: 2.5, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{kpi.title}</Typography>
                    <Typography component="p" sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, mb: 0.5 }}>
                      {numberText(kpi.value, decimals, units.prefix, units.suffix)}
                    </Typography>
                    {trend && (
                      <MetricTrend
                        trend={trend}
                        title={kpi.title}
                        prefix={units.prefix}
                        suffix={units.suffix}
                        decimalPlaces={decimals}
                        comparison={comparisonFor(kpi)}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ flex: { md: '0 0 54%' }, width: { xs: '100%' }, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>
                {dimensions.length} / {catalog.dimensions.length} 차원 · {measureLabel(rankingMeasureId)} 기준
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                {(result.leaderboards ?? []).map(board => (
                  <LeaderboardCard
                    key={board.column}
                    board={board}
                    onSelect={applyFilter}
                    decimalPlaces={rankingDecimals}
                    unitPrefix={rankingUnits.prefix}
                    unitSuffix={rankingUnits.suffix}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </>
      )}

      {!pivotMode && (
        <Box sx={{ mt: 3 }}>
          <Button
            type="button"
            aria-expanded={includeRows}
            aria-controls="model-data"
            onClick={() => {
              setIncludeRows(value => !value);
              setPage(0);
            }}
            sx={{ textTransform: 'none' }}
          >
            Model Data {includeRows ? '접기' : '펼치기'}
          </Button>
          {includeRows && (
            <Box id="model-data" role="region" aria-label="Model Data" sx={{ mt: 1, overflowX: 'auto' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
                집계 결과 행입니다. 실제 물리 요청 수와 다를 수 있습니다.
              </Typography>
              {detailRows.length > 0 && (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <caption style={{ textAlign: 'left', paddingBottom: 4, color: '#475569' }}>
                      총 {numberText(details?.totalRows)}행 중 {page * detailsSize + 1}–
                      {Math.min((page + 1) * detailsSize, totalRows)}행
                    </caption>
                    <thead>
                      <tr>
                        {detailColumns.map(column => (
                          <th
                            key={column}
                            scope="col"
                            style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: '4px 8px' }}
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {detailColumns.map(column => (
                            <td key={column} style={{ borderBottom: '1px solid #f1f5f9', padding: '4px 8px' }}>
                              {categoryText(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <Button disabled={page <= 0} onClick={() => setPage(current => Math.max(0, current - 1))}>
                      이전
                    </Button>
                    <Typography sx={{ fontSize: 13 }}>
                      {page + 1} / {totalPages} 페이지
                    </Typography>
                    <Button disabled={page + 1 >= totalPages} onClick={() => setPage(current => current + 1)}>
                      다음
                    </Button>
                  </Stack>
                </>
              )}
              {detailRows.length === 0 && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {queryBusy ? '결과를 불러오는 중…' : '표시할 행이 없습니다.'}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
