import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import PersonalSavedViews from '@/pages/Dashboard/Components/PersonalSavedViews';
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

const ACCENT = '#0b5cab';
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
      variant="outlined"
      size="small"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minHeight: { xs: 40, sm: 36 },
        px: 1.5,
        borderRadius: '7px',
        boxShadow: 'none',
        textTransform: 'none',
        fontWeight: 600,
        fontSize: 13,
        color: selected ? ACCENT : '#475569',
        backgroundColor: selected ? '#eaf2fc' : '#ffffff',
        border: '1px solid',
        borderColor: selected ? '#adc8eb' : '#d8e0eb',
        '&:hover': { backgroundColor: '#f0f5fc', borderColor: ACCENT },
        '&.Mui-disabled': { bgcolor: '#f5f7fa', borderColor: '#e5eaf0', color: '#8993a2' },
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
    <Card variant="outlined" sx={{ p: 2, minWidth: 0, borderColor: '#e0e6ee', borderRadius: '10px', boxShadow: 'none' }}>
      <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700, mb: 1, overflowWrap: 'anywhere' }}>
        {board.column}
      </Typography>
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>표시할 값이 없습니다.</Typography>
      ) : (
        <Stack component="ul" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {rows.map((row, index) => {
            const value = formatMetric(row.value, { decimalPlaces, prefix: unitPrefix, suffix: unitSuffix, numberNotation });
            const numeric = toNumber(row.value) ?? 0;
            const width = max > 0 ? Math.max(2, Math.round((numeric / max) * 100)) : 0;
            return (
              <Box component="li" key={`${board.column}-${index}`}>
                <Button
                  type="button"
                  aria-label={`필터 적용: ${board.column} = ${categoryText(row.category)}`}
                  aria-describedby={`${id}-${index}-value${'previousValue' in row ? ` ${id}-${index}-comparison` : ''}`}
                  onClick={() => onSelect(board.column, [row.category as FilterValue])}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    minHeight: 32,
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
                      backgroundColor: '#e2edfc',
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
                      <Box
                        component="span"
                        title={value.exactText}
                        id={`${id}-${index}-value`}
                        aria-label={value.exactText}
                        sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {value.text}
                      </Box>
                    </Box>
                    {'previousValue' in row && (
                      <Box
                        component="span"
                        id={`${id}-${index}-comparison`}
                        title={compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation, true)}
                        aria-label={compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation, true)}
                        sx={{
                          fontSize: 11,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {compareText(row, decimalPlaces, unitPrefix, unitSuffix, numberNotation)}
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
  const filterLauncher = useRef<HTMLButtonElement>(null);
  const [grain, setGrain] = useState<TrendGrain>('day');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [dateMode, setDateMode] = useState<'all' | 'custom'>('all');
  const [timeZone, setTimeZone] = useState('UTC');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [pivotAxes, setPivotAxes] = useState({ rowDimensions: [] as string[], columnDimensions: [] as string[] });
  const [pivotReady, setPivotReady] = useState({ key: '', reason: 'Pivot을 조회한 뒤 저장해 주세요.' });
  const [mode, setMode] = useState<'explore' | 'pivot'>('explore');
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
    filterLauncher.current?.focus();
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

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        maxWidth: 1400,
        width: '100%',
        mx: 'auto',
        minWidth: 0,
        backgroundColor: '#f6f8fb',
        '& .MuiButton-root': {
          minHeight: { xs: 40, sm: 36 },
          textTransform: 'none',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: '7px',
          boxShadow: 'none',
        },
        '& .MuiButton-root:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '& .MuiInputBase-root': { minHeight: 40, fontSize: 13, borderRadius: '7px', bgcolor: 'background.paper' },
        '& .MuiInputLabel-root': { fontSize: 13 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d8e0eb' },
        '& .MuiChip-root': {
          borderRadius: '6px',
          fontSize: 12,
          bgcolor: '#edf3fb',
          color: '#214c80',
          maxWidth: '100%',
          height: 'auto',
          minHeight: 28,
        },
        '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.5 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ flexWrap: 'wrap', mb: 1.5, minWidth: 0, position: 'relative' }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ flexWrap: 'wrap', minWidth: 0 }}
        >
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
            sx={{ minWidth: 0, width: { xs: '100%', sm: 220 } }}
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
              {formatMetric(catalog.rowCount).text}행 · 연결됨
            </Typography>
          )}
        </Stack>
        <Button
          variant="outlined"
          onClick={() => navigate(`/explore${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`)}
          sx={{
            textTransform: 'none',
            alignSelf: { xs: 'flex-end', sm: 'center' },
            position: { xs: 'absolute', sm: 'static' },
            margin: { xs: '0 !important', sm: 0 },
            top: 0,
            right: 0,
            borderColor: '#d8e0eb',
            bgcolor: 'background.paper',
            color: 'text.primary',
          }}
        >
          지표 빌더
        </Button>
      </Stack>

      <Divider />
      {catalog && (
        <Box sx={{ mt: 1 }}>
          <Button aria-expanded={savedViewsOpen} onClick={() => setSavedViewsOpen(open => !open)}>
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
                view.state.mode === 'pivot' ? (
                  <PivotDashboardAdd sourceId={catalog.sourceId} viewId={view.id} name={view.name} />
                ) : null
              }
            />
          )}
        </Box>
      )}

      <Box
        sx={{
          mt: 1.5,
          p: { xs: 1.5, sm: 2 },
          bgcolor: 'background.paper',
          border: '1px solid #e0e6ee',
          borderRadius: '10px',
        }}
      >
        <Stack direction="row" spacing={1} role="group" aria-label="탐색 방식" sx={{ mb: 1.5 }}>
          <Pill label="Explore" selected={mode === 'explore'} onClick={() => setMode('explore')} />
          <Pill
            label="Pivot"
            selected={mode === 'pivot'}
            onClick={() => {
              setMode('pivot');
              setSavedViewsOpen(false);
            }}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={0}
          alignItems="center"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, max-content)' },
            gap: 1,
          }}
        >
          <Pill
            label="전체 기간"
            selected={dateMode === 'all'}
            onClick={() => {
              setDateMode('all');
              setComparePrevious(false);
              setLeaderboardSort(DEFAULT_SORT);
              setPage(0);
            }}
          />
          <Pill label="사용자 지정" selected={dateMode === 'custom'} onClick={() => setDateMode('custom')} />
          {dateMode === 'custom' && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ flexWrap: 'wrap', gridColumn: '1 / -1', rowGap: 1 }}
            >
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
                {TIME_ZONES.map(zone => (
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
          {mode === 'explore' && (
            <>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                role="group"
                aria-label="집계 단위"
                sx={{
                  gridColumn: { xs: '1', sm: 'auto' },
                  minWidth: 0,
                  '& .MuiButton-root': { flex: 1, minWidth: { xs: 0, sm: 52 } },
                }}
              >
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
              <Pill
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
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mt: 1.5, minWidth: 0 }}>
          {filters.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>필터 없음</Typography>}
          {filters.map(filter => (
            <Chip
              key={filter.column}
              label={`${filter.column}: ${
                'range' in filter
                  ? `${filter.range.min ?? '제한 없음'} ~ ${filter.range.max ?? '제한 없음'} (양 끝 포함)`
                  : filter.values.map(categoryText).join(', ')
              }`}
              sx={{
                backgroundColor: '#edf3fb',
                color: '#214c80',
                maxWidth: '100%',
                height: 'auto',
                '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.75 },
              }}
              onDelete={() => applyFilter(filter.column, [])}
            />
          ))}
          <Button
            ref={filterLauncher}
            aria-label="필터 추가"
            aria-expanded={filterPanelOpen}
            aria-controls="explore-filter-panel"
            onClick={() => {
              setFilterError('');
              setFilterPanelOpen(value => !value);
            }}
            sx={{ border: '1px solid #d8e0eb', borderRadius: '7px', textTransform: 'none', color: 'text.primary' }}
          >
            필터 추가
          </Button>
        </Stack>

        {filterPanelOpen && catalog && (
          <Box
            id="explore-filter-panel"
            role="group"
            aria-label="필터 설정"
            sx={{ mt: 1, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, backgroundColor: '#f8fafc' }}
          >
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
                  setFilterError('');
                }}
                sx={{ minWidth: 0, width: { xs: '100%', sm: 220 } }}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
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
                  size="small"
                  label="값 검색"
                  value={filterSearch}
                  disabled={!filterColumn}
                  onChange={event => setFilterSearch(event.target.value)}
                  sx={{ minWidth: 0, width: { xs: '100%', sm: 220 } }}
                />
              )}
            </Stack>
            {numericFilter && (
              <Stack direction="row" spacing={1} role="group" aria-label="숫자 필터 방식" sx={{ mb: 1 }}>
                <Pill
                  label="값 선택"
                  selected={filterMode === 'values'}
                  onClick={() => {
                    setFilterMode('values');
                    setFilterError('');
                  }}
                />
                <Pill
                  label="숫자 범위"
                  selected={filterMode === 'range'}
                  onClick={() => {
                    setFilterMode('range');
                    setFilterError('');
                  }}
                />
              </Stack>
            )}
            {filterMode === 'range' && numericFilter ? (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="최솟값 (포함)"
                    value={rangeMin}
                    onChange={event => {
                      setRangeMin(event.target.value);
                      setFilterError('');
                    }}
                    size="small"
                    slotProps={{
                      htmlInput: {
                        inputMode: 'decimal',
                        'aria-describedby': filterError ? 'range-filter-error' : 'range-filter-help',
                      },
                    }}
                  />
                  <TextField
                    label="최댓값 (포함)"
                    value={rangeMax}
                    onChange={event => {
                      setRangeMax(event.target.value);
                      setFilterError('');
                    }}
                    size="small"
                    slotProps={{
                      htmlInput: {
                        inputMode: 'decimal',
                        'aria-describedby': filterError ? 'range-filter-error' : 'range-filter-help',
                      },
                    }}
                  />
                </Stack>
                <Typography id="range-filter-help" variant="caption">
                  원본 행의 숫자를 필터링합니다. 한쪽을 비우면 제한하지 않습니다. 양 끝값은 포함하고 NULL은 제외합니다.
                </Typography>
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
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>필터할 열을 선택하세요.</Typography>
            )}
            {filterError && (
              <Alert severity="error" id="range-filter-error">
                {filterError}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                disabled={!filterColumn || (filterMode === 'values' && filterSelection.length === 0)}
                onClick={applyFilterSelection}
              >
                필터 적용
              </Button>
              <Button onClick={closeFilters}>닫기</Button>
            </Stack>
          </Box>
        )}

        {catalog && mode === 'explore' && (
          <Stack
            direction="row"
            spacing={0}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 220px))' },
              gap: 1.5,
              mt: 2,
            }}
          >
            <TextField
              select
              size="small"
              label="차원 순위 기준"
              value={leaderboardSort.by}
              onChange={event => {
                setLeaderboardSort(value => ({ ...value, by: event.target.value as LeaderboardSort['by'] }));
                setPage(0);
              }}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 0 }}
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
              size="small"
              label="차원 순위 방향"
              value={leaderboardSort.direction}
              onChange={event => {
                setLeaderboardSort(value => ({ ...value, direction: event.target.value as LeaderboardSort['direction'] }));
                setPage(0);
              }}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 0 }}
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </TextField>
            <Typography
              variant="caption"
              sx={{ gridColumn: '1 / -1', color: 'text.secondary', lineHeight: 1.5, display: { xs: 'none', sm: 'block' } }}
            >
              선택한 지표 기준으로 정렬합니다.
            </Typography>
          </Stack>
        )}
        <Divider sx={{ my: 1.5 }} />

        {catalog && (
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
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
              {settingsOpen &&
                catalog.measures
                  .filter(measure => measureIds.includes(measure.id))
                  .map(measure => (
                    <Chip key={measure.id} label={measure.label} sx={{ backgroundColor: '#edf3fb', color: '#214c80' }} />
                  ))}
              {settingsOpen &&
                dimensions.map(column => (
                  <Chip key={column} label={column} sx={{ backgroundColor: '#f1f5f9', color: '#334155' }} />
                ))}
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
      </Box>
      <Typography
        role="status"
        aria-live="polite"
        sx={{ mt: statusMessage ? 1 : 0, minHeight: statusMessage ? 20 : 0, fontSize: 12, color: 'text.secondary' }}
      >
        {statusMessage}
      </Typography>

      {catalogError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {catalogError}
          {catalogForbidden ? (
            <Button onClick={() => setSourceId('')}>다른 데이터 소스 선택</Button>
          ) : (
            <Button onClick={reloadCatalog}>카탈로그 다시 불러오기</Button>
          )}
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

      {catalog && mode === 'pivot' && (
        <PivotTable
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

      {result && mode === 'explore' && measureIds.length > 0 && (
        <>
          <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>
            적용됨 · {result.applied?.trendGrain ?? grain} ·{' '}
            {result.applied?.comparePrevious ? '이전 기간 비교' : '비교 없음'} · 필터 {result.applied?.filters?.length ?? 0}
            개 · 기준 {measureLabel(rankingMeasureId)}
          </Typography>
          <Box
            sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'flex-start', mt: 1.5 }}
          >
            <Box sx={{ flex: { md: '0 0 44%' }, width: { xs: '100%' }, minWidth: 0 }}>
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
                  <Box
                    key={String(kpi.id)}
                    sx={{
                      mb: 2,
                      p: 2,
                      minWidth: 0,
                      bgcolor: 'background.paper',
                      border: '1px solid #e0e6ee',
                      borderRadius: '10px',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{kpi.title}</Typography>
                    <Typography
                      component="p"
                      title={value.exactText}
                      aria-label={value.exactText}
                      sx={{
                        fontSize: 34,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        mt: 0.75,
                        mb: 1,
                        color: '#172b46',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {value.text}
                    </Typography>
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
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ flex: { md: '1 1 0' }, width: { xs: '100%' }, minWidth: 0 }}>
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
                    numberNotation={notationOf(rankingMeasureId)}
                    unitPrefix={rankingUnits.prefix}
                    unitSuffix={rankingUnits.suffix}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </>
      )}

      {mode === 'explore' && (
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
                      총 {formatMetric(details?.totalRows).text}행 중 {page * detailsSize + 1}–
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
