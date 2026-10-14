import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';
import type { ExploreViewState } from './ExploreSavedViews';

export type PivotValue = {
  measureId: number;
  value: number | string | null;
  comparison?: { previousValue?: unknown; delta?: unknown; percentChange?: unknown; unavailable?: string };
};
export type PivotResult = {
  sourceRevision: string;
  rowColumns: string[];
  columnColumns: string[];
  rows: unknown[][];
  columns: unknown[][];
  cells: Array<{ row: number; column: number; measures: PivotValue[] }>;
  rowTotals: PivotValue[][];
  columnTotals: PivotValue[][];
  grandTotal: PivotValue[];
  rowSubtotals?: Array<{
    tuple: unknown[];
    measures: PivotValue[];
    cells: Array<{ column: number; measures: PivotValue[] }>;
  }>;
};
export type PivotGrain = 'day' | 'week' | 'month';
/** One temporal axis: the column must already sit on a single row or column axis. */
export type PivotTimeAxis = { column: string; grain: PivotGrain; timeZone: string };
export type PivotTuple = Array<string | number | boolean | null>;
/** Row ordering by label or by one measure; a cell scope names a bounded column tuple. */
export type PivotRowSort = {
  by: 'label' | 'value' | 'delta' | 'percentChange';
  direction: 'asc' | 'desc';
  measureId?: number;
  columnTuple?: PivotTuple;
};
export type PivotAxes = {
  rowColumns: string[];
  columnColumns: string[];
  rowHierarchy?: boolean;
  rowSort?: PivotRowSort;
  expandedRows?: PivotTuple[];
  timeAxis?: PivotTimeAxis;
};
export const DEFAULT_PIVOT_SORT: PivotRowSort = { by: 'label', direction: 'asc' };
export const PIVOT_GRAINS: Array<{ value: PivotGrain; label: string }> = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
];

/**
 * Drop any part of a requested row sort the current axes, measures or comparison can no longer
 * execute: an unknown measure falls back to the label order, a change order without a previous
 * period falls back to the current value, and a cell scope whose arity no longer fits the column
 * axis falls back to the row total. The result is idempotent so callers may re-normalize.
 */
export const normalizePivotSort = (
  sort: PivotRowSort | undefined,
  options: {
    measureIds: number[];
    comparePrevious: boolean;
    columnColumns: string[];
  },
): PivotRowSort | undefined => {
  if (!sort) return undefined;
  const direction: 'asc' | 'desc' = sort.direction === 'desc' ? 'desc' : 'asc';
  if (sort.by === 'label') return { by: 'label', direction };
  const measureId = sort.measureId;
  if (!Number.isSafeInteger(measureId) || !options.measureIds.includes(measureId as number))
    return { by: 'label', direction };
  const by: PivotRowSort['by'] =
    sort.by === 'delta' || sort.by === 'percentChange' ? (options.comparePrevious ? sort.by : 'value') : 'value';
  const columnTuple = sort.columnTuple;
  if (columnTuple === undefined) return { by, direction, measureId: measureId as number };
  if (columnTuple.length !== options.columnColumns.length) return { by, direction, measureId: measureId as number };
  return { by, direction, measureId: measureId as number, columnTuple };
};

const category = (value: unknown): string => (value == null ? '(값 없음)' : value === '' ? '(빈 문자열)' : String(value));
const tuple = (values: unknown[]) => (values.length ? values.map(category).join(' / ') : '전체');
const errorText = (error: unknown) => {
  const e = error as { response?: { status?: number; data?: { data?: unknown; message?: unknown } } };
  if (e.response?.status === 409) return '데이터 버전이 변경되었습니다. 카탈로그를 다시 불러와 주세요.';
  const body = e.response?.data;
  const detail = body?.data;
  const reason =
    typeof detail === 'string'
      ? detail
      : detail && typeof detail === 'object' && 'message' in detail
      ? detail.message
      : body?.message;
  return typeof reason === 'string' ? reason : 'Pivot을 불러오지 못했습니다. 다시 시도해 주세요.';
};
/**
 * A bucket, filter or axis change can leave a cell scope the bounded grid no longer contains. The
 * server refuses only that order with this 400, so the pivot drops the scope to the row total once
 * instead of surfacing an error the grid cannot recover from. Other failures stay visible.
 */
const MISSING_CELL_SCOPE_MESSAGE = '정렬할 열 셀을 다시 선택해 주세요.';
const missingCellScope = (error: unknown) =>
  (error as { response?: { status?: number } }).response?.status === 400 && errorText(error) === MISSING_CELL_SCOPE_MESSAGE;

/** Bounded server aggregates, including separately aggregated non-additive totals. */
export default function ExplorePivot({
  sourceId,
  sourceRevision,
  measures,
  dimensions,
  temporalColumns,
  state,
  axes,
  onAxesChange,
  onReady,
  blocked,
  formatValue,
  formatComparison,
  onFilter,
  onReloadCatalog,
  onMeasureToggle,
  refreshKey,
}: {
  sourceId: number;
  sourceRevision: string;
  measures: Array<{ id: number; label: string }>;
  dimensions: Array<{ column: string; temporal?: boolean }>;
  temporalColumns?: string[];
  state: ExploreViewState;
  axes: PivotAxes;
  onAxesChange: (axes: PivotAxes) => void;
  onReady: (ready: boolean) => void;
  blocked: boolean;
  formatValue: (value: PivotValue) => string;
  formatComparison: (value: PivotValue) => string;
  onFilter: (column: string, values: Array<string | number | boolean | null>) => void;
  onReloadCatalog: () => void;
  onMeasureToggle: (id: number) => void;
  refreshKey: number;
}) {
  const [result, setResult] = useState<PivotResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const sequence = useRef(0);

  const selectedMeasures = state.measureIds
    .map(id => measures.find(measure => measure.id === id))
    .filter((m): m is { id: number; label: string } => !!m);
  const selectedMeasureIds = selectedMeasures.map(measure => measure.id);
  const temporalSet = useMemo(() => {
    const names = new Set<string>(temporalColumns ?? []);
    dimensions.filter(dimension => dimension.temporal).forEach(dimension => names.add(dimension.column));
    return names;
  }, [dimensions, temporalColumns]);

  /** Keep an axes object free of explicit undefined keys so payload and saved state stay canonical. */
  const compact = (value: PivotAxes): PivotAxes => {
    const next: PivotAxes = { rowColumns: value.rowColumns, columnColumns: value.columnColumns };
    if (value.rowHierarchy !== undefined) next.rowHierarchy = value.rowHierarchy;
    if (value.rowSort !== undefined) next.rowSort = value.rowSort;
    if (value.expandedRows !== undefined) next.expandedRows = value.expandedRows;
    if (value.timeAxis !== undefined) next.timeAxis = value.timeAxis;
    return next;
  };
  const onAxes = (changes: Partial<PivotAxes>) => onAxesChange(compact({ ...axes, ...changes }));
  const dropCellScope = (current: PivotRowSort | undefined): PivotRowSort | undefined => {
    if (!current) return undefined;
    return current.by === 'label'
      ? { by: 'label', direction: current.direction }
      : { by: current.by, direction: current.direction, measureId: current.measureId };
  };
  /** A temporal axis survives only while its column still sits on exactly one of the two axes. */
  const boundTimeAxis = (
    timeAxis: PivotTimeAxis | undefined,
    rowColumns: string[],
    columnColumns: string[],
  ): PivotTimeAxis | undefined => {
    if (!timeAxis) return undefined;
    if (!temporalSet.has(timeAxis.column)) return undefined;
    const onRows = rowColumns.includes(timeAxis.column);
    const onColumns = columnColumns.includes(timeAxis.column);
    return onRows !== onColumns ? timeAxis : undefined;
  };

  const sort = useMemo(
    () =>
      normalizePivotSort(axes.rowSort, {
        measureIds: selectedMeasureIds,
        comparePrevious: state.comparePrevious,
        columnColumns: axes.columnColumns,
      }) ?? DEFAULT_PIVOT_SORT,
    [axes.rowSort, axes.columnColumns, state.comparePrevious, selectedMeasureIds.join(',')],
  );
  const rawSortKey = JSON.stringify(axes.rowSort ?? null);
  const sortKey = JSON.stringify(sort);
  const timeAxisKey = JSON.stringify(axes.timeAxis ?? null);
  const payload = useMemo(
    () => ({
      sourceId,
      sourceRevision,
      measureIds: state.measureIds,
      rowColumns: axes.rowColumns,
      columnColumns: axes.columnColumns,
      ...(axes.rowHierarchy !== undefined ? { rowHierarchy: axes.rowHierarchy } : {}),
      ...(axes.rowSort !== undefined ? { rowSort: sort } : {}),
      ...(axes.timeAxis ? { timeAxis: axes.timeAxis } : {}),
      filters: state.filters,
      ...(state.dateRange ? { dateRange: state.dateRange } : {}),
      comparePrevious: state.comparePrevious,
    }),
    // Keys are JSON so an equivalent, re-derived sort never refetches on object identity alone.
    [
      sourceId,
      sourceRevision,
      state.measureIds,
      axes.rowColumns,
      axes.columnColumns,
      axes.rowHierarchy,
      rawSortKey,
      sortKey,
      timeAxisKey,
      state.filters,
      state.dateRange,
      state.comparePrevious,
    ],
  );
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    setResult(null);
    setError('');
    onReady(false);
    if (blocked || !payload.measureIds.length) {
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    post('/bi/explore/pivot', payload, { signal: abort.signal })
      .then(response => {
        if (token !== sequence.current) return;
        if (response?.data?.status !== 'SUCCESS') throw new Error('invalid pivot response');
        const data: PivotResult = response.data.data;
        if (data.sourceRevision !== sourceRevision)
          throw Object.assign(new Error('source revision changed'), { response: { status: 409 } });
        setResult(data);
        onReady(true);
      })
      .catch(err => {
        if (token !== sequence.current || abort.signal.aborted) return;
        // A refused cell scope falls back to the row total once, so the retry fits the new grid.
        if (axes.rowSort?.columnTuple !== undefined && missingCellScope(err)) {
          onAxes({ rowSort: dropCellScope(axes.rowSort) });
          return;
        }
        setError(errorText(err));
      })
      .finally(() => {
        if (token === sequence.current) setBusy(false);
      });
    return () => {
      sequence.current += 1;
      abort.abort();
    };
  }, [payload, sourceRevision, blocked, reload, refreshKey, onReady]);

  // A bounded grid can drop a column, so a cell scope that no longer exists falls back to the total.
  useEffect(() => {
    if (rawSortKey === 'null' || rawSortKey === sortKey) return;
    onAxes({ rowSort: sort });
  }, [rawSortKey, sortKey]);
  // One business timezone: keep the time axis aligned with the page when the range timezone changes.
  useEffect(() => {
    const timeAxis = axes.timeAxis;
    if (!timeAxis || timeAxis.timeZone === state.timeZone) return;
    onAxes({ timeAxis: { ...timeAxis, timeZone: state.timeZone } });
  }, [timeAxisKey, state.timeZone]);

  const changeAxis = (axis: 'rowColumns' | 'columnColumns', index: number, column: string) => {
    const next = axes[axis].filter((_, i) => i !== index);
    if (column) next.splice(index, 0, column);
    const rowColumns = axis === 'rowColumns' ? next : axes.rowColumns;
    const columnColumns = axis === 'columnColumns' ? next : axes.columnColumns;
    onAxes({
      rowColumns,
      columnColumns,
      ...(axis === 'rowColumns' ? { expandedRows: [] } : {}),
      rowSort: dropCellScope(axes.rowSort),
      timeAxis: boundTimeAxis(axes.timeAxis, rowColumns, columnColumns),
    });
  };
  const addColumn = (axis: 'rowColumns' | 'columnColumns', column: string) => {
    const rowColumns = axis === 'rowColumns' ? [...axes.rowColumns, column] : axes.rowColumns;
    const columnColumns = axis === 'columnColumns' ? [...axes.columnColumns, column] : axes.columnColumns;
    onAxes({
      rowColumns,
      columnColumns,
      ...(axis === 'rowColumns' ? { expandedRows: [] } : {}),
      rowSort: dropCellScope(axes.rowSort),
    });
  };
  const swapAxes = () =>
    onAxes({
      rowColumns: axes.columnColumns,
      columnColumns: axes.rowColumns,
      expandedRows: [],
      rowSort: dropCellScope(axes.rowSort),
      timeAxis: boundTimeAxis(axes.timeAxis, axes.columnColumns, axes.rowColumns),
    });
  const resetAxes = () =>
    onAxes({ rowColumns: [], columnColumns: [], rowSort: dropCellScope(axes.rowSort), timeAxis: undefined });

  const axisColumns = [...axes.rowColumns, ...axes.columnColumns];
  const temporalAxisColumns = axisColumns.filter(column => temporalSet.has(column));
  const timeAxis = axes.timeAxis;
  const applyTimeAxis = (next: PivotTimeAxis | undefined, clearExpanded: boolean) => {
    const target: Partial<PivotAxes> = { timeAxis: next };
    if (clearExpanded) target.expandedRows = [];
    // A bucket or column change rebases the bounded columns, so the old cell scope is dropped.
    if (axes.rowSort?.columnTuple !== undefined) target.rowSort = dropCellScope(axes.rowSort);
    onAxes(target);
  };
  const toggleTimeAxis = () => {
    if (timeAxis) return applyTimeAxis(undefined, false);
    const column = temporalAxisColumns[0];
    if (!column) return;
    applyTimeAxis({ column, grain: 'day', timeZone: state.timeZone }, false);
  };

  const cells = useMemo(
    () => new Map(result?.cells.map(cell => [`${cell.row}:${cell.column}`, cell.measures]) ?? []),
    [result],
  );
  const renderValue = (values: PivotValue[] | undefined, measureId: number) => {
    const value = values?.find(item => item.measureId === measureId) ?? { measureId, value: null };
    return (
      <>
        <div>{formatValue(value)}</div>
        {state.comparePrevious && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{formatComparison(value)}</div>
        )}
      </>
    );
  };
  const hasColumnSplits = axes.columnColumns.length > 0;
  const hierarchical = !!axes.rowHierarchy && axes.rowColumns.length === 2;
  const expanded = new Set((axes.expandedRows ?? []).map(value => JSON.stringify(value)));
  /** Header groups trace the grid: an extra row-total column when columns are split, then each column. */
  const columnGroups = useMemo(() => {
    if (!result) return [] as Array<{ key: string; index: number; tuple: PivotTuple; label: string; total: boolean }>;
    const groups = result.columns.map((values, index) => ({
      key: `c${index}`,
      index,
      tuple: values as PivotTuple,
      label: tuple(values),
      total: false,
    }));
    if (!hasColumnSplits) return groups.map(group => ({ ...group, total: true }));
    return [{ key: 'total', index: -1, tuple: [] as PivotTuple, label: '합계', total: true }, ...groups];
  }, [result, hasColumnSplits]);
  const columnScopeOptions = columnGroups.filter(group => group.tuple.length > 0);
  const scopeIndex =
    sort.columnTuple === undefined
      ? -1
      : columnGroups.findIndex(group => JSON.stringify(group.tuple) === JSON.stringify(sort.columnTuple));
  const scopeValue = sort.by === 'label' || scopeIndex < 0 ? 'total' : String(columnGroups[scopeIndex].index);
  const isActiveCell = (group: { tuple: PivotTuple }, measureId: number) =>
    sort.by !== 'label' &&
    sort.measureId === measureId &&
    JSON.stringify(sort.columnTuple ?? null) === JSON.stringify(group.tuple.length ? group.tuple : null);
  const toggleCellSort = (group: { tuple: PivotTuple }, measureId: number) => {
    const columnTuple = group.tuple.length ? group.tuple : undefined;
    const direction = isActiveCell(group, measureId) ? (sort.direction === 'asc' ? 'desc' : 'asc') : sort.direction;
    onAxes({
      rowSort: {
        by: sort.by === 'label' ? 'value' : sort.by,
        direction,
        measureId,
        ...(columnTuple ? { columnTuple } : {}),
      },
    });
  };

  const displayRows: Array<{
    key: string;
    values: unknown[];
    total: PivotValue[];
    columns: Map<number, PivotValue[]>;
    parent: boolean;
    child: boolean;
  }> = [];
  if (result) {
    const leaf = (r: number, child: boolean) => ({
      key: `leaf:${r}`,
      values: result.rows[r],
      total: result.rowTotals[r],
      columns: new Map(result.columns.map((_, c) => [c, cells.get(`${r}:${c}`) ?? []])),
      parent: false,
      child,
    });
    if (hierarchical && result.rowSubtotals?.length) {
      for (const parent of result.rowSubtotals ?? []) {
        const key = JSON.stringify(parent.tuple);
        displayRows.push({
          key: `parent:${key}`,
          values: parent.tuple,
          total: parent.measures,
          columns: new Map(parent.cells.map(cell => [cell.column, cell.measures])),
          parent: true,
          child: false,
        });
        if (expanded.has(key))
          result.rows.forEach((values, r) => {
            if (JSON.stringify(values.slice(0, 1)) === key) displayRows.push(leaf(r, true));
          });
      }
    } else result.rows.forEach((_, r) => displayRows.push(leaf(r, false)));
  }
  const toggleParent = (values: unknown[]) => {
    const key = JSON.stringify(values);
    onAxes({
      expandedRows: expanded.has(key)
        ? (axes.expandedRows ?? []).filter(value => JSON.stringify(value) !== key)
        : [...(axes.expandedRows ?? []).slice(-49), values as PivotTuple],
    });
  };
  const cellStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #f1f5f9',
    textAlign: 'right',
    minWidth: 145,
    whiteSpace: 'nowrap',
  };
  const headerStyle: React.CSSProperties = { ...cellStyle, background: '#f8fafc', fontWeight: 600 };
  const headerButtonStyle: React.CSSProperties = {
    border: 0,
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
  };
  const timeAxisInvalid = !!timeAxis && !temporalAxisColumns.includes(timeAxis.column);
  return (
    <Box sx={{ mt: 2, minWidth: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
      <Box
        sx={{
          flex: { md: '0 0 210px' },
          border: '1px solid #e2e8f0',
          borderRadius: 2,
          p: 1.5,
          maxHeight: 700,
          overflowY: 'auto',
        }}
      >
        <TextField
          label="Pivot 필드 검색"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ width: '100%', mb: 1 }}
        />
        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 1 }}>지표 · 열에 표시</Typography>
        {measures
          .filter(m => m.label.toLowerCase().includes(search.toLowerCase()))
          .map(m => (
            <Button
              key={m.id}
              aria-pressed={state.measureIds.includes(m.id)}
              onClick={() => onMeasureToggle(m.id)}
              sx={{
                display: 'block',
                textAlign: 'left',
                textTransform: 'none',
                color: state.measureIds.includes(m.id) ? '#4f46e5' : '#64748b',
              }}
            >
              {state.measureIds.includes(m.id) ? '✓ ' : '+ '}
              {m.label}
            </Button>
          ))}
        <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 2 }}>차원</Typography>
        {dimensions
          .filter(d => d.column.toLowerCase().includes(search.toLowerCase()))
          .map(d => (
            <Box key={d.column} sx={{ py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
              <Typography sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
                {d.column}
                {temporalSet.has(d.column) ? ' · 날짜' : ''}
              </Typography>
              <Button
                size="small"
                aria-label={`${d.column} 행에 추가`}
                disabled={axes.rowColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => addColumn('rowColumns', d.column)}
              >
                + 행
              </Button>
              <Button
                size="small"
                aria-label={`${d.column} 열에 추가`}
                disabled={axes.columnColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => addColumn('columnColumns', d.column)}
              >
                + 열
              </Button>
            </Box>
          ))}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ flexWrap: 'wrap', rowGap: 1, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, background: '#f8fafc' }}
        >
          {(['rowColumns', 'columnColumns'] as const).map(axis => (
            <Stack key={axis} direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{axis === 'rowColumns' ? '행' : '열'}</Typography>
              {[0, 1].map(index => (
                <TextField
                  key={index}
                  select
                  size="small"
                  label={`${axis === 'rowColumns' ? '행' : '열'} 차원 ${index + 1}`}
                  value={axes[axis][index] ?? ''}
                  disabled={index > axes[axis].length}
                  onChange={event => changeAxis(axis, index, event.target.value)}
                  sx={{ minWidth: 150 }}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="">{index ? '추가하지 않음' : '전체'}</option>
                  {dimensions
                    .filter(
                      d => ![...axes.rowColumns, ...axes.columnColumns].includes(d.column) || axes[axis][index] === d.column,
                    )
                    .map(d => (
                      <option key={d.column} value={d.column}>
                        {d.column}
                      </option>
                    ))}
                </TextField>
              ))}
            </Stack>
          ))}
          <Button onClick={swapAxes}>행·열 바꾸기</Button>
          <Button onClick={resetAxes}>구성 초기화</Button>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <Button
            aria-pressed={!!axes.rowHierarchy}
            onClick={() => onAxes({ rowHierarchy: !axes.rowHierarchy, expandedRows: [] })}
          >
            행 계층 {axes.rowHierarchy ? '켜짐' : '꺼짐'}
          </Button>
          <Button
            aria-pressed={!!timeAxis}
            disabled={!timeAxis && temporalAxisColumns.length === 0}
            onClick={toggleTimeAxis}
          >
            시간 축 {timeAxis ? '켜짐' : '꺼짐'}
          </Button>
          {timeAxis && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <TextField
                select
                size="small"
                label="시간 축 열"
                value={temporalAxisColumns.includes(timeAxis.column) ? timeAxis.column : ''}
                onChange={event => {
                  const column = event.target.value;
                  if (!column) return;
                  applyTimeAxis({ column, grain: timeAxis.grain, timeZone: state.timeZone }, true);
                }}
                sx={{ minWidth: 160 }}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              >
                {temporalAxisColumns.length === 0 && <option value="">날짜 축 열 없음</option>}
                {temporalAxisColumns.map(column => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="시간 집계"
                value={timeAxis.grain}
                onChange={event =>
                  applyTimeAxis(
                    { column: timeAxis.column, grain: event.target.value as PivotGrain, timeZone: state.timeZone },
                    true,
                  )
                }
                sx={{ minWidth: 110 }}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              >
                {PIVOT_GRAINS.map(grain => (
                  <option key={grain.value} value={grain.value}>
                    {grain.label}
                  </option>
                ))}
              </TextField>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }} role="status">
                시간대 {state.timeZone}
              </Typography>
            </Stack>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <TextField
            select
            size="small"
            label="행 정렬 기준"
            value={sort.by === 'label' ? 'label' : String(sort.measureId)}
            onChange={event => {
              const value = event.target.value;
              if (value === 'label') return onAxes({ rowSort: { by: 'label', direction: sort.direction } });
              onAxes({
                rowSort: {
                  by: sort.by === 'label' ? 'value' : sort.by,
                  direction: sort.direction,
                  measureId: Number(value),
                  ...(sort.by !== 'label' && sort.columnTuple ? { columnTuple: sort.columnTuple } : {}),
                },
              });
            }}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="label">차원 이름</option>
            {selectedMeasures.map(m => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="정렬 범위"
            value={scopeValue}
            disabled={sort.by === 'label'}
            onChange={event => {
              const value = event.target.value;
              const group = value === 'total' ? undefined : columnGroups.find(item => String(item.index) === value);
              const columnTuple = group && group.tuple.length ? group.tuple : undefined;
              // Scope is another axis of the same order, so the chosen value/change calc is preserved.
              onAxes({
                rowSort: {
                  by: sort.by === 'label' ? 'value' : sort.by,
                  direction: sort.direction,
                  measureId: sort.measureId ?? selectedMeasures[0]?.id,
                  ...(columnTuple ? { columnTuple } : {}),
                },
              });
            }}
            sx={{ minWidth: 150 }}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="total">행 합계</option>
            {columnScopeOptions.map(group => (
              <option key={group.key} value={group.index}>
                {group.label}
              </option>
            ))}
          </TextField>
          {(['value', 'delta', 'percentChange'] as const).map(by => (
            <Button
              key={by}
              aria-label={`정렬 계산 ${by === 'value' ? '현재값' : by === 'delta' ? '변화량' : '변화율'}`}
              aria-pressed={sort.by === by}
              disabled={by !== 'value' && !state.comparePrevious}
              onClick={() => {
                const measureId = sort.measureId ?? selectedMeasures[0]?.id;
                if (!measureId) return;
                onAxes({
                  rowSort: {
                    by,
                    direction: sort.direction,
                    measureId,
                    ...(sort.columnTuple ? { columnTuple: sort.columnTuple } : {}),
                  },
                });
              }}
            >
              {by === 'value' ? '현재값' : by === 'delta' ? '변화량' : '변화율'}
            </Button>
          ))}
          <Button
            aria-label="행 정렬 방향"
            onClick={() => onAxes({ rowSort: { ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' } })}
          >
            {sort.direction === 'asc' ? '오름차순 ↑' : '내림차순 ↓'}
          </Button>
          {hierarchical && (
            <>
              <Button
                disabled={!result}
                onClick={() =>
                  onAxes({ expandedRows: (result?.rowSubtotals ?? []).map(parent => parent.tuple as PivotTuple) })
                }
              >
                모두 펼치기
              </Button>
              <Button disabled={!expanded.size} onClick={() => onAxes({ expandedRows: [] })}>
                모두 접기
              </Button>
            </>
          )}
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          지표 {selectedMeasures.map(m => m.label).join(' · ')} · 최대 50행 / 20열 그룹 / 6,000개 값 · 합계는 원본에서 다시
          집계 · 계층은 행 차원 2개에서 상위 그룹 부분합을 표시합니다. 정렬은 같은 계층 안에서 적용하고, 셀 헤더를 누르면 그
          열의 지표 셀로 정렬합니다.
          {timeAxis ? ` · 시간 축 ${timeAxis.column}(${timeAxis.grain}, ${timeAxis.timeZone})` : ''}
        </Typography>
        {timeAxisInvalid && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            시간 축 열이 행·열 축에서 제외되었습니다. 날짜 열을 다시 배치하세요.
          </Alert>
        )}
        {blocked && <Alert severity="info">유효한 기간과 지표를 선택하세요.</Alert>}
        {busy && (
          <Typography role="status" sx={{ mt: 2 }}>
            Pivot을 불러오는 중…
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
            <Button onClick={() => setReload(v => v + 1)}>다시 시도</Button>
            <Button onClick={onReloadCatalog}>카탈로그 다시 불러오기</Button>
          </Alert>
        )}
        {result && (
          <Box
            role="region"
            aria-label="Pivot 결과"
            tabIndex={0}
            sx={{ mt: 1.5, overflow: 'auto', maxHeight: 620, border: '1px solid #e2e8f0', borderRadius: 2 }}
          >
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 13 }}>
              <caption style={{ textAlign: 'left', padding: 12 }}>
                Pivot · {result.rows.length}행 × {result.columns.length}열 그룹 · 필터 {state.filters.length}개
                {state.comparePrevious ? ' · 이전 기간 비교' : ''}
                {timeAxis ? ` · 시간 축 ${timeAxis.column}(${timeAxis.grain})` : ''}
              </caption>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th rowSpan={2} style={{ ...headerStyle, textAlign: 'left' }}>
                    {axes.rowColumns.join(' / ') || '전체'}
                  </th>
                  {columnGroups.map(group => (
                    <th key={group.key} colSpan={selectedMeasures.length} style={headerStyle}>
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {columnGroups.map(group =>
                    selectedMeasures.map(m => {
                      const active = isActiveCell(group, m.id);
                      return (
                        <th key={`${group.key}:${m.id}`} style={headerStyle}>
                          <button
                            type="button"
                            aria-label={`정렬 ${group.label} ${m.label}`}
                            aria-pressed={active}
                            onClick={() => toggleCellSort(group, m.id)}
                            style={headerButtonStyle}
                          >
                            {m.label}
                            {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      );
                    }),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" style={{ ...cellStyle, textAlign: 'left', background: '#eef2ff' }}>
                    총합
                  </th>
                  {columnGroups.map(group =>
                    selectedMeasures.map(m => (
                      <td
                        key={`${group.key}:${m.id}`}
                        style={{
                          ...cellStyle,
                          fontWeight: group.index < 0 ? 700 : 400,
                          background: group.index < 0 ? '#eef2ff' : undefined,
                        }}
                      >
                        {renderValue(group.index < 0 ? result.grandTotal : result.columnTotals[group.index], m.id)}
                      </td>
                    )),
                  )}
                </tr>
                {axes.rowColumns.length > 0 &&
                  displayRows.map(row => (
                    <tr key={row.key}>
                      <th
                        scope="row"
                        style={{
                          ...cellStyle,
                          textAlign: 'left',
                          position: 'sticky',
                          left: 0,
                          background: row.parent ? '#f8fafc' : '#fff',
                          paddingLeft: row.child ? 40 : 12,
                          zIndex: 1,
                        }}
                      >
                        {row.parent && (
                          <button
                            type="button"
                            aria-label={`${tuple(row.values)} ${
                              expanded.has(JSON.stringify(row.values)) ? '접기' : '펼치기'
                            }`}
                            aria-expanded={expanded.has(JSON.stringify(row.values))}
                            onClick={() => toggleParent(row.values)}
                            style={{ border: 0, background: 'none', cursor: 'pointer', marginRight: 6 }}
                          >
                            {expanded.has(JSON.stringify(row.values)) ? '▾' : '▸'}
                          </button>
                        )}
                        {row.values.length
                          ? row.values.map((value, i) =>
                              row.child && i === 0 ? null : (
                                <React.Fragment key={i}>
                                  {i > 0 && !row.child && ' / '}
                                  <button
                                    type="button"
                                    title={`${axes.rowColumns[i]} 필터 적용`}
                                    onClick={() => onFilter(axes.rowColumns[i], [value as string | number | boolean | null])}
                                    style={{
                                      border: 0,
                                      background: 'none',
                                      color: '#334155',
                                      padding: 2,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {category(value)}
                                  </button>
                                </React.Fragment>
                              ),
                            )
                          : '전체'}
                        {row.parent && <span style={{ marginLeft: 8, color: '#64748b', fontSize: 11 }}>부분합</span>}
                      </th>
                      {columnGroups.map(group =>
                        selectedMeasures.map(m => (
                          <td
                            key={`${group.key}:${m.id}`}
                            style={group.index < 0 ? { ...cellStyle, fontWeight: 600 } : cellStyle}
                          >
                            {renderValue(group.index < 0 ? row.total : row.columns.get(group.index), m.id)}
                          </td>
                        )),
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
            {!result.rows.length && <Typography sx={{ p: 2 }}>조건에 맞는 데이터가 없습니다.</Typography>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
