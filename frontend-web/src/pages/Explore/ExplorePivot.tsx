import { responseMeasureVersions } from './exploreBasis';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import {
  AnalysisChoice,
  analysisFieldClassName,
  analysisModeGroupClassName,
  analysisPanelClassName,
  analysisTableCellClassName,
} from '@/components/analysis/AnalysisUi';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import type { ExploreViewState } from './ExploreSavedViews';

export type PivotValue = {
  measureId: number;
  value: number | string | null;
  comparison?: { previousValue?: unknown; delta?: unknown; percentChange?: unknown; unavailable?: string };
};
export type PivotResult = {
  sourceRevision: string;
  measureVersions?: Record<string, number>;
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
/** Nested keeps the two axes; flat joins them into one record axis with no column split. */
export type PivotTableMode = 'nest' | 'flat';
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
  tableMode?: PivotTableMode;
};
export const DEFAULT_PIVOT_SORT: PivotRowSort = { by: 'label', direction: 'asc' };
export const PIVOT_GRAINS: Array<{ value: PivotGrain; label: string }> = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
];

/** Selects that show a column or measure name take a full row on mobile so the name is not clipped. */
const NAME_FIELD_CLASS = cn(analysisFieldClassName, 'w-full sm:max-w-[220px] sm:flex-[1_1_140px]');
const SMALL_FIELD_CLASS = cn(analysisFieldClassName, 'flex-[0_1_96px] max-w-[140px]');
const PLAIN_BUTTON_CLASS = 'whitespace-nowrap';

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
  onReady: (ready: boolean, measureVersions?: Record<string, number>) => void;
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
    if (value.tableMode !== undefined) next.tableMode = value.tableMode;
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
  const flat = axes.tableMode === 'flat';
  // Flat sends one record axis, so a cell scope the nested grid allowed never reaches the request.
  const requestSort: PivotRowSort = flat ? dropCellScope(sort) ?? DEFAULT_PIVOT_SORT : sort;
  const requestSortKey = JSON.stringify(requestSort);
  const payload = useMemo(
    () => ({
      sourceId,
      sourceRevision,
      measureIds: state.measureIds,
      rowColumns: axes.rowColumns,
      columnColumns: axes.columnColumns,
      ...(axes.rowHierarchy !== undefined ? { rowHierarchy: axes.rowHierarchy } : {}),
      ...(axes.rowSort !== undefined ? { rowSort: requestSort } : {}),
      ...(axes.timeAxis ? { timeAxis: axes.timeAxis } : {}),
      filters: state.filters,
      ...(state.conditions ? { conditions: state.conditions } : {}),
      ...(state.dateRange ? { dateRange: state.dateRange } : {}),
      comparePrevious: state.comparePrevious,
      ...(flat ? { tableMode: 'flat' as const, rowHierarchy: false } : {}),
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
      requestSortKey,
      flat,
      timeAxisKey,
      state.filters,
      state.conditions,
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
        onReady(true, responseMeasureVersions(data.measureVersions, payload.measureIds));
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
  /**
   * Both modes keep the two axes. Only the nested grid can nest groups or scope an order to one
   * bounded column cell, so switching modes drops those parts and keeps the measure calculation.
   */
  const toggleTableMode = (mode: PivotTableMode) => {
    if ((axes.tableMode ?? 'nest') === mode) return;
    onAxes({ tableMode: mode, rowHierarchy: false, expandedRows: [], rowSort: dropCellScope(axes.rowSort) });
  };

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
        <div className="whitespace-nowrap">{formatValue(value)}</div>
        {state.comparePrevious && (
          <div className="mt-0.5 text-[11px] leading-[1.35] text-[#64748b] wrap-anywhere whitespace-normal">
            {formatComparison(value)}
          </div>
        )}
      </>
    );
  };
  // Flat sends both axes as one record axis, so its response has no column split and no nesting.
  const hasColumnSplits = !flat && axes.columnColumns.length > 0;
  const hierarchical = !flat && !!axes.rowHierarchy && axes.rowColumns.length === 2;
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
  /** The flat grid keeps one measure column per record, so a header sorts the whole record axis. */
  const isActiveFlatSort = (measureId: number) =>
    flat && sort.by !== 'label' && sort.measureId === measureId && sort.columnTuple === undefined;
  const toggleFlatSort = (measureId: number) => {
    const active = isActiveFlatSort(measureId);
    onAxes({
      rowSort: {
        by: sort.by === 'label' ? 'value' : sort.by,
        direction: active ? (sort.direction === 'asc' ? 'desc' : 'asc') : sort.direction,
        measureId,
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
  // Bounded columns keep the comparison summary readable instead of letting nowrap cells expand.
  const cellClass = cn(
    analysisTableCellClassName,
    'max-w-[220px] text-right align-top whitespace-normal tabular-nums',
    state.comparePrevious ? 'min-w-[180px]' : 'min-w-[145px]',
  );
  const headerClass = cn(cellClass, 'bg-[#f8fafc] font-semibold');
  const headerButtonClass =
    'h-auto w-full justify-end border-0 bg-transparent p-0 text-right leading-[1.4] whitespace-normal';
  /** One flat record takes its measures from its single column group, with the row total as a fallback. */
  const flatMeasures = (row: { total: PivotValue[]; columns: Map<number, PivotValue[]> }) => {
    const group = row.columns.get(0);
    return group && group.length ? group : row.total;
  };
  /**
   * Flat echoes its effective record axis: the original column axis first, then the original row
   * axis. Headers, record values and row filters follow that response, while the two original axes
   * stay in the saved axes state so switching back to the nested grid keeps them.
   */
  const flatDimensions = result && flat ? result.rowColumns : [];
  /** A record axis with no dimension has nothing to label, so its one grand-total row stands alone. */
  const flatRows = flatDimensions.length > 0 ? displayRows : [];
  /**
   * A flat row shows every joined dimension, so each label wraps inside a bounded left-aligned box.
   * The labels scroll with their measures instead of sticking: a frozen first dimension would cover
   * the measure cells it should sit beside once the record axis is wider than the region.
   */
  const flatLabelClass = cn(cellClass, 'min-w-[110px] max-w-[240px] bg-white text-left wrap-anywhere');
  const timeAxisInvalid = !!timeAxis && !temporalAxisColumns.includes(timeAxis.column);
  return (
    <div className="mt-5 flex min-w-0 flex-col gap-4 md:flex-row">
      <div className="max-h-[320px] min-w-0 overflow-y-auto rounded-xl border border-[#e2e8f0] p-4 md:max-h-[700px] md:basis-[210px] md:flex-none">
        <TextField
          label="Pivot 필드 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2 w-full"
        />
        <p className="mt-3 text-xs font-semibold text-muted-foreground">지표 · 열에 표시</p>
        {measures
          .filter(m => m.label.toLowerCase().includes(search.toLowerCase()))
          .map(m => (
            <AnalysisChoice
              key={m.id}
              label={
                <>
                  {state.measureIds.includes(m.id) ? '✓ ' : '+ '}
                  {m.label}
                </>
              }
              selected={state.measureIds.includes(m.id)}
              onClick={() => onMeasureToggle(m.id)}
              className="flex h-auto w-full justify-start px-2 py-1 text-left whitespace-normal"
            />
          ))}
        <p className="mt-4 text-xs font-semibold text-muted-foreground">차원</p>
        {dimensions
          .filter(d => d.column.toLowerCase().includes(search.toLowerCase()))
          .map(d => (
            <div key={d.column} className="border-b border-[#f1f5f9] py-1">
              <p className="text-xs wrap-anywhere">
                {d.column}
                {temporalSet.has(d.column) ? ' · 날짜' : ''}
              </p>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${d.column} 행에 추가`}
                disabled={axes.rowColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => addColumn('rowColumns', d.column)}
              >
                + 행
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${d.column} 열에 추가`}
                disabled={axes.columnColumns.length >= 2 || [...axes.rowColumns, ...axes.columnColumns].includes(d.column)}
                onClick={() => addColumn('columnColumns', d.column)}
              >
                + 열
              </Button>
            </div>
          ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('flex flex-wrap gap-3', analysisPanelClassName)}>
          {(['rowColumns', 'columnColumns'] as const).map(axis => (
            <div key={axis} className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-bold">{axis === 'rowColumns' ? '행' : '열'}</p>
              {[0, 1].map(index => (
                <TextField
                  key={index}
                  select
                  label={`${axis === 'rowColumns' ? '행' : '열'} 차원 ${index + 1}`}
                  value={axes[axis][index] ?? ''}
                  disabled={index > axes[axis].length}
                  onChange={event => changeAxis(axis, index, event.target.value)}
                  className={NAME_FIELD_CLASS}
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
            </div>
          ))}
          <Button variant="ghost" className={PLAIN_BUTTON_CLASS} onClick={swapAxes}>
            행·열 바꾸기
          </Button>
          <Button variant="ghost" className={PLAIN_BUTTON_CLASS} onClick={resetAxes}>
            구성 초기화
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">표시 방식</p>
            <div role="group" aria-label="Pivot 표시 방식" className={analysisModeGroupClassName}>
              <AnalysisChoice
                label="Pivot 테이블"
                selected={!flat}
                onClick={() => toggleTableMode('nest')}
                className="border-0"
              />
              <AnalysisChoice label="Flat" selected={flat} onClick={() => toggleTableMode('flat')} className="border-0" />
            </div>
          </div>
          <p role="status" className="text-xs text-muted-foreground">
            {flat ? '차원별 레코드' : '행·열 교차 집계'}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AnalysisChoice
            label={`행 계층 ${axes.rowHierarchy ? '켜짐' : '꺼짐'}`}
            selected={!!axes.rowHierarchy}
            disabled={flat}
            onClick={() => onAxes({ rowHierarchy: !axes.rowHierarchy, expandedRows: [] })}
          />
          <AnalysisChoice
            label={`시간 축 ${timeAxis ? '켜짐' : '꺼짐'}`}
            selected={!!timeAxis}
            disabled={!timeAxis && temporalAxisColumns.length === 0}
            onClick={toggleTimeAxis}
          />
          {timeAxis && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <TextField
                select
                label="시간 축 열"
                value={temporalAxisColumns.includes(timeAxis.column) ? timeAxis.column : ''}
                onChange={event => {
                  const column = event.target.value;
                  if (!column) return;
                  applyTimeAxis({ column, grain: timeAxis.grain, timeZone: state.timeZone }, true);
                }}
                className={NAME_FIELD_CLASS}
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
                label="시간 집계"
                value={timeAxis.grain}
                onChange={event =>
                  applyTimeAxis(
                    { column: timeAxis.column, grain: event.target.value as PivotGrain, timeZone: state.timeZone },
                    true,
                  )
                }
                className={SMALL_FIELD_CLASS}
              >
                {PIVOT_GRAINS.map(grain => (
                  <option key={grain.value} value={grain.value}>
                    {grain.label}
                  </option>
                ))}
              </TextField>
              <p role="status" className="text-xs text-muted-foreground">
                시간대 {state.timeZone}
              </p>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TextField
            select
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
            className={NAME_FIELD_CLASS}
          >
            <option value="label">차원 이름</option>
            {selectedMeasures.map(m => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </TextField>
          {/* Flat has one record axis, so there is no column cell to scope an order to. */}
          {!flat && (
            <TextField
              select
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
              className={NAME_FIELD_CLASS}
            >
              <option value="total">행 합계</option>
              {columnScopeOptions.map(group => (
                <option key={group.key} value={group.index}>
                  {group.label}
                </option>
              ))}
            </TextField>
          )}
          {(['value', 'delta', 'percentChange'] as const).map(by => (
            <AnalysisChoice
              key={by}
              label={by === 'value' ? '현재값' : by === 'delta' ? '변화량' : '변화율'}
              ariaLabel={`정렬 계산 ${by === 'value' ? '현재값' : by === 'delta' ? '변화량' : '변화율'}`}
              selected={sort.by === by}
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
            />
          ))}
          <Button
            variant="ghost"
            className={PLAIN_BUTTON_CLASS}
            aria-label="행 정렬 방향"
            onClick={() => onAxes({ rowSort: { ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' } })}
          >
            {sort.direction === 'asc' ? '오름차순 ↑' : '내림차순 ↓'}
          </Button>
          {hierarchical && (
            <>
              <Button
                variant="ghost"
                className={PLAIN_BUTTON_CLASS}
                disabled={!result}
                onClick={() =>
                  onAxes({ expandedRows: (result?.rowSubtotals ?? []).map(parent => parent.tuple as PivotTuple) })
                }
              >
                모두 펼치기
              </Button>
              <Button
                variant="ghost"
                className={PLAIN_BUTTON_CLASS}
                disabled={!expanded.size}
                onClick={() => onAxes({ expandedRows: [] })}
              >
                모두 접기
              </Button>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          지표 {selectedMeasures.map(m => m.label).join(' · ')} · 최대 50행 / 20열 그룹 / 6,000개 값 · 합계는 원본에서 다시
          집계 ·{' '}
          {flat
            ? 'Flat은 행·열 차원을 하나의 레코드 축으로 합쳐 각 차원을 한 열씩 나열하고, 지표 헤더를 누르면 전체 레코드를 그 지표로 정렬합니다. 계층과 열 셀 정렬은 사용하지 않습니다.'
            : '계층은 행 차원 2개에서 상위 그룹 부분합을 표시합니다. 정렬은 같은 계층 안에서 적용하고, 셀 헤더를 누르면 그 열의 지표 셀로 정렬합니다.'}
          {timeAxis ? ` · 시간 축 ${timeAxis.column}(${timeAxis.grain}, ${timeAxis.timeZone})` : ''}
        </p>
        {timeAxisInvalid && (
          <Notice severity="warning" className="mt-2">
            시간 축 열이 행·열 축에서 제외되었습니다. 날짜 열을 다시 배치하세요.
          </Notice>
        )}
        {blocked && <Notice severity="info">유효한 기간과 지표를 선택하세요.</Notice>}
        {busy && (
          <p role="status" className="mt-4">
            Pivot을 불러오는 중…
          </p>
        )}
        {error && (
          <Notice severity="error" className="mt-2 flex flex-wrap items-center gap-2">
            <span className="break-words">{error}</span>
            <Button variant="ghost" onClick={() => setReload(v => v + 1)}>
              다시 시도
            </Button>
            <Button variant="ghost" onClick={onReloadCatalog}>
              카탈로그 다시 불러오기
            </Button>
          </Notice>
        )}
        {result && flat && (
          <div
            role="region"
            aria-label="Pivot 결과"
            tabIndex={0}
            className="mt-3 max-h-[620px] overflow-auto rounded-xl border border-[#e2e8f0]"
          >
            <Table className="w-full border-separate border-spacing-0 text-xs">
              <TableCaption className="mt-0 p-3 text-left text-xs text-inherit">
                Pivot · Flat · {result.rows.length}개 레코드 · 필터 {state.filters.length}개
                {state.comparePrevious ? ' · 이전 기간 비교' : ''}
                {timeAxis ? ` · 시간 축 ${timeAxis.column}(${timeAxis.grain})` : ''}
              </TableCaption>
              <TableHeader className="sticky top-0 z-[2] [&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  {flatDimensions.map(column => (
                    <TableHead key={column} className={cn('h-auto', headerClass, 'text-left')}>
                      {column}
                    </TableHead>
                  ))}
                  {selectedMeasures.map(m => {
                    const active = isActiveFlatSort(m.id);
                    return (
                      <TableHead key={m.id} className={cn('h-auto', headerClass)}>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Flat 정렬 ${m.label}`}
                          aria-pressed={active}
                          onClick={() => toggleFlatSort(m.id)}
                          className={headerButtonClass}
                        >
                          {m.label}
                          {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </Button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow aria-label="총합" className="border-0 hover:bg-transparent">
                  {/* A record axis with no dimension keeps only the measure cells, so totals stay aligned. */}
                  {flatDimensions.length > 0 && (
                    <TableHead scope="row" className={cn('h-auto', cellClass, 'bg-[#eef2ff] text-left')}>
                      총합
                    </TableHead>
                  )}
                  {flatDimensions.slice(1).map(column => (
                    <TableCell key={column} className={cn(cellClass, 'bg-[#eef2ff]')} />
                  ))}
                  {selectedMeasures.map(m => (
                    <TableCell key={m.id} className={cn(cellClass, 'bg-[#eef2ff] font-bold')}>
                      {renderValue(result.grandTotal, m.id)}
                    </TableCell>
                  ))}
                </TableRow>
                {flatRows.map(row => (
                  <TableRow key={row.key} className="border-0 hover:bg-transparent">
                    {flatDimensions.map((column, i) => (
                      <TableHead key={column} scope="row" className={cn('h-auto', flatLabelClass)}>
                        {/* A bucket label is not a raw column member, so only raw members filter. */}
                        {column === timeAxis?.column ? (
                          category(row.values[i])
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            title={`${column} 필터 적용`}
                            onClick={() => onFilter(column, [row.values[i] as string | number | boolean | null])}
                            className="min-h-8 justify-start border-0 bg-transparent px-1 text-[#334155]"
                          >
                            {category(row.values[i])}
                          </Button>
                        )}
                      </TableHead>
                    ))}
                    {selectedMeasures.map(m => (
                      <TableCell key={m.id} className={cellClass}>
                        {renderValue(flatMeasures(row), m.id)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!result.rows.length && <p className="p-4">조건에 맞는 데이터가 없습니다.</p>}
          </div>
        )}
        {result && !flat && (
          <div
            role="region"
            aria-label="Pivot 결과"
            tabIndex={0}
            className="mt-3 max-h-[620px] overflow-auto rounded-xl border border-[#e2e8f0]"
          >
            <Table className="w-full border-separate border-spacing-0 text-xs">
              <TableCaption className="mt-0 p-3 text-left text-xs text-inherit">
                Pivot · {result.rows.length}행 × {result.columns.length}열 그룹 · 필터 {state.filters.length}개
                {state.comparePrevious ? ' · 이전 기간 비교' : ''}
                {timeAxis ? ` · 시간 축 ${timeAxis.column}(${timeAxis.grain})` : ''}
              </TableCaption>
              <TableHeader className="sticky top-0 z-[2] [&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead rowSpan={2} className={cn('h-auto', headerClass, 'text-left')}>
                    {axes.rowColumns.join(' / ') || '전체'}
                  </TableHead>
                  {columnGroups.map(group => (
                    <TableHead key={group.key} colSpan={selectedMeasures.length} className={cn('h-auto', headerClass)}>
                      {group.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="border-0 hover:bg-transparent">
                  {columnGroups.map(group =>
                    selectedMeasures.map(m => {
                      const active = isActiveCell(group, m.id);
                      return (
                        <TableHead key={`${group.key}:${m.id}`} className={cn('h-auto', headerClass)}>
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label={`정렬 ${group.label} ${m.label}`}
                            aria-pressed={active}
                            onClick={() => toggleCellSort(group, m.id)}
                            className={headerButtonClass}
                          >
                            {m.label}
                            {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                          </Button>
                        </TableHead>
                      );
                    }),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead scope="row" className={cn('h-auto', cellClass, 'bg-[#eef2ff] text-left')}>
                    총합
                  </TableHead>
                  {columnGroups.map(group =>
                    selectedMeasures.map(m => (
                      <TableCell
                        key={`${group.key}:${m.id}`}
                        className={cn(cellClass, group.index < 0 && 'bg-[#eef2ff] font-bold')}
                      >
                        {renderValue(group.index < 0 ? result.grandTotal : result.columnTotals[group.index], m.id)}
                      </TableCell>
                    )),
                  )}
                </TableRow>
                {axes.rowColumns.length > 0 &&
                  displayRows.map(row => (
                    <TableRow key={row.key} className="border-0 hover:bg-transparent">
                      <TableHead
                        scope="row"
                        className={cn(
                          'h-auto',
                          cellClass,
                          'sticky left-0 z-[1] text-left',
                          row.child ? 'pl-10' : 'pl-3',
                          row.parent ? 'bg-[#f8fafc]' : 'bg-white',
                        )}
                      >
                        {row.parent && (
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label={`${tuple(row.values)} ${
                              expanded.has(JSON.stringify(row.values)) ? '접기' : '펼치기'
                            }`}
                            aria-expanded={expanded.has(JSON.stringify(row.values))}
                            onClick={() => toggleParent(row.values)}
                            className="mr-1.5 size-8 border-0 bg-transparent p-0"
                          >
                            {expanded.has(JSON.stringify(row.values)) ? '▾' : '▸'}
                          </Button>
                        )}
                        {row.values.length
                          ? row.values.map((value, i) =>
                              row.child && i === 0 ? null : (
                                <React.Fragment key={i}>
                                  {i > 0 && !row.child && ' / '}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    title={`${axes.rowColumns[i]} 필터 적용`}
                                    onClick={() => onFilter(axes.rowColumns[i], [value as string | number | boolean | null])}
                                    className="min-h-8 justify-start border-0 bg-transparent px-1 text-[#334155]"
                                  >
                                    {category(value)}
                                  </Button>
                                </React.Fragment>
                              ),
                            )
                          : '전체'}
                        {row.parent && <span className="ml-2 text-[11px] text-[#64748b]">부분합</span>}
                      </TableHead>
                      {columnGroups.map(group =>
                        selectedMeasures.map(m => (
                          <TableCell
                            key={`${group.key}:${m.id}`}
                            className={cn(cellClass, group.index < 0 && 'font-semibold')}
                          >
                            {renderValue(group.index < 0 ? row.total : row.columns.get(group.index), m.id)}
                          </TableCell>
                        )),
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {!result.rows.length && <p className="p-4">조건에 맞는 데이터가 없습니다.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
