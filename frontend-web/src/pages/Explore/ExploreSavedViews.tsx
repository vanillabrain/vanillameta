import { analysisPanelClassName } from '@/components/analysis/AnalysisUi';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import { post } from '@/helpers/apiHelper';
import type { PivotRowSort, PivotTableMode, PivotTimeAxis } from './ExplorePivot';

export type ExploreViewState = {
  version: 1 | 2 | 3 | 4 | 5;
  pivot?: {
    enabled: boolean;
    rowColumns: string[];
    columnColumns: string[];
    rowHierarchy?: boolean;
    rowSort?: PivotRowSort;
    expandedRows?: Array<Array<string | number | boolean | null>>;
    timeAxis?: PivotTimeAxis;
    tableMode?: PivotTableMode;
  };
  measureIds: number[];
  dimensionColumns: string[];
  rankingMeasureId: number;
  rankingSort: { by: 'value' | 'delta' | 'percentChange'; direction: 'asc' | 'desc' };
  filters: Array<
    | { column: string; values: Array<string | number | boolean | null> }
    | { column: string; range: { min?: number; max?: number } }
  >;
  dateRange?: { column: string; start: string; end: string; timeZone?: string };
  timeZone: string;
  trendGrain: 'day' | 'week' | 'month';
  comparePrevious: boolean;
  includeRows: boolean;
};
type SavedView = {
  id: number;
  name: string;
  sourceRevision: string;
  state?: ExploreViewState;
  stale?: boolean;
  unreadable?: boolean;
};
const unwrap = <T,>(response: { data: { status: string; data: T } }): T => {
  if (response?.data?.status !== 'SUCCESS' || response.data.data == null)
    throw Object.assign(new Error('저장 보기 응답을 확인할 수 없습니다.'), { response });
  return response.data.data;
};
const message = (error: unknown) => {
  const failure = error as {
    message?: string;
    response?: { status?: number; data?: { message?: unknown; data?: unknown } };
  };
  const response = failure?.response;
  const body = response?.data;
  const nested = body?.data;
  const candidate =
    typeof nested === 'string'
      ? nested
      : nested && typeof nested === 'object' && 'message' in nested
      ? nested.message
      : body?.message;
  const reason = typeof candidate === 'string' ? candidate : Array.isArray(candidate) ? candidate.join(' · ') : undefined;
  if (response?.status === 409)
    return `${
      reason ?? '데이터 또는 지표 버전이 변경되어 보기를 적용할 수 없습니다.'
    } 카탈로그를 다시 불러오고 조건을 확인해 새 보기로 저장해 주세요.`;
  return reason ?? failure?.message ?? '저장 보기를 처리하지 못했습니다. 다시 시도해 주세요.';
};

/** One expanded row key or time-axis member: a bounded scalar, never a nested value. */
const member = (item: unknown): boolean =>
  item === null ||
  typeof item === 'boolean' ||
  (typeof item === 'number' && Number.isFinite(item)) ||
  (typeof item === 'string' && item.length <= 256);
/** A cell scope must name members bounded like a filter value, with the column axis's arity. */
const columnTupleShape = (tuple: unknown, columnColumns: string[]): boolean =>
  Array.isArray(tuple) && tuple.length === columnColumns.length && tuple.every(member);
/**
 * Row ordering shape for versions 3 and later. A label order carries no measure; a value order must
 * name a selected measure. Versions 4 and 5 add the change orders, which need a compared period,
 * and the optional cell scope, which must match the column axis arity.
 */
const rowSortShape = (
  sort: PivotRowSort | undefined,
  measureIds: number[] | undefined,
  comparePrevious: unknown,
  columnColumns: string[] | undefined,
  version: number,
): boolean => {
  if (!sort || typeof sort !== 'object') return false;
  if (!['asc', 'desc'].includes(sort.direction)) return false;
  if (sort.by === 'label') {
    if (sort.measureId !== undefined) return false;
    if (version >= 4 && sort.columnTuple !== undefined) return false;
    return true;
  }
  if (!['value', 'delta', 'percentChange'].includes(sort.by)) return false;
  if (version < 4 && sort.by !== 'value') return false;
  if (!measureIds?.includes(sort.measureId ?? 0)) return false;
  if (version >= 4) {
    if (sort.by !== 'value' && comparePrevious !== true) return false;
    if (sort.columnTuple !== undefined && !columnTupleShape(sort.columnTuple, columnColumns ?? [])) return false;
  }
  return true;
};
/** A time axis names one column on exactly one axis and shares the range's business timezone. */
const timeAxisShape = (
  axis: PivotTimeAxis | undefined,
  rowColumns: string[] | undefined,
  columnColumns: string[] | undefined,
  dateRange: ExploreViewState['dateRange'],
): boolean => {
  if (!axis || typeof axis !== 'object' || Array.isArray(axis)) return false;
  if (Object.keys(axis).some(key => !['column', 'grain', 'timeZone'].includes(key))) return false;
  if (typeof axis.column !== 'string' || !axis.column) return false;
  if (!['day', 'week', 'month'].includes(axis.grain)) return false;
  if (typeof axis.timeZone !== 'string' || !axis.timeZone) return false;
  const inRows = (rowColumns ?? []).includes(axis.column);
  const inColumns = (columnColumns ?? []).includes(axis.column);
  if (inRows === inColumns) return false;
  if (dateRange && axis.timeZone !== (dateRange.timeZone ?? 'UTC')) return false;
  return true;
};
/** Guard the response version and render-critical shape before applying any state. */
const restorable = (input: unknown): input is ExploreViewState => {
  if (!input || typeof input !== 'object') return false;
  const value = input as Partial<ExploreViewState>;
  return (
    (value.version === 1 || value.version === 2 || value.version === 3 || value.version === 4 || value.version === 5) &&
    (value.version === 1
      ? value.pivot === undefined
      : !!value.pivot &&
        typeof value.pivot.enabled === 'boolean' &&
        Array.isArray(value.pivot.rowColumns) &&
        Array.isArray(value.pivot.columnColumns) &&
        value.pivot.rowColumns.length <= 2 &&
        value.pivot.columnColumns.length <= 2 &&
        [...value.pivot.rowColumns, ...value.pivot.columnColumns].every(column => typeof column === 'string') &&
        new Set([...value.pivot.rowColumns, ...value.pivot.columnColumns]).size ===
          value.pivot.rowColumns.length + value.pivot.columnColumns.length) &&
    (value.version < 3 ||
      (!!value.pivot &&
        typeof value.pivot.rowHierarchy === 'boolean' &&
        rowSortShape(
          value.pivot.rowSort,
          value.measureIds,
          value.comparePrevious,
          value.pivot.columnColumns,
          value.version,
        ) &&
        Array.isArray(value.pivot.expandedRows) &&
        value.pivot.expandedRows.length <= 50 &&
        ((value.pivot.rowHierarchy && value.pivot.rowColumns.length === 2) || value.pivot.expandedRows.length === 0) &&
        new Set(value.pivot.expandedRows.map(tuple => JSON.stringify(tuple))).size === value.pivot.expandedRows.length &&
        value.pivot.expandedRows.every(
          tuple =>
            Array.isArray(tuple) &&
            tuple.length === 1 &&
            tuple.every(
              item =>
                item === null ||
                typeof item === 'boolean' ||
                (typeof item === 'number' && Number.isFinite(item)) ||
                (typeof item === 'string' && item.length <= 256),
            ),
        ))) &&
    (value.version < 4 ||
      (!!value.pivot &&
        (value.pivot.timeAxis === undefined ||
          timeAxisShape(value.pivot.timeAxis, value.pivot.rowColumns, value.pivot.columnColumns, value.dateRange)))) &&
    (value.version !== 5 ||
      (!!value.pivot &&
        (value.pivot.tableMode === 'nest' || value.pivot.tableMode === 'flat') &&
        // Flat has one record axis, so a stored hierarchy, expansion or cell scope contradicts it.
        (value.pivot.tableMode !== 'flat' ||
          (value.pivot.rowHierarchy === false &&
            value.pivot.expandedRows?.length === 0 &&
            value.pivot.rowSort?.columnTuple === undefined)))) &&
    Array.isArray(value.measureIds) &&
    value.measureIds.length > 0 &&
    value.measureIds.every(id => Number.isSafeInteger(id) && id > 0) &&
    Array.isArray(value.dimensionColumns) &&
    value.dimensionColumns.every(column => typeof column === 'string') &&
    Array.isArray(value.filters) &&
    value.filters.every(
      filter =>
        filter &&
        typeof filter.column === 'string' &&
        ('values' in filter ? Array.isArray(filter.values) : filter.range && typeof filter.range === 'object'),
    ) &&
    typeof value.timeZone === 'string' &&
    value.timeZone.length > 0 &&
    !!value.rankingSort &&
    ['value', 'delta', 'percentChange'].includes(value.rankingSort.by) &&
    ['asc', 'desc'].includes(value.rankingSort.direction) &&
    value.measureIds.includes(value.rankingMeasureId ?? 0) &&
    ['day', 'week', 'month'].includes(value.trendGrain ?? '') &&
    typeof value.comparePrevious === 'boolean' &&
    typeof value.includeRows === 'boolean' &&
    (!value.dateRange ||
      (typeof value.dateRange.column === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.dateRange.start) &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.dateRange.end)))
  );
};

/** Private server-persisted views. Every load rechecks ownership and source/metric revisions. */
export default function ExploreSavedViews({
  sourceId,
  sourceRevision,
  measureVersions,
  state,
  canSave,
  disabledReason,
  onRestore,
}: {
  sourceId: number;
  sourceRevision: string;
  measureVersions: Record<string, number>;
  state: ExploreViewState;
  canSave: boolean;
  disabledReason?: string;
  onRestore: (state: ExploreViewState) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    setViews([]);
    setSelected('');
    setName('');
    setError('');
    setNotice('');
    setBusy(true);
    pending.current = true;
    post('/bi/explore/views/list', { sourceId }, { signal: abort.signal })
      .then(unwrap<SavedView[]>)
      .then(data => {
        if (token === generation.current) setViews(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        if (token === generation.current && !abort.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (token === generation.current) {
          setBusy(false);
          pending.current = false;
        }
      });
    return () => {
      generation.current += 1;
      abort.abort();
      pending.current = false;
    };
  }, [sourceId, sourceRevision, reload]);

  const run = async (action: 'create' | 'load' | 'remove') => {
    if (pending.current) return;
    pending.current = true;
    const token = generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body =
        action === 'create'
          ? { sourceId, sourceRevision, measureVersions, name: name.trim(), state }
          : { sourceId, viewId: Number(selected) };
      const response = await post(`/bi/explore/views/${action}`, body);
      if (token !== generation.current) return;
      if (action === 'create') {
        const view = unwrap<SavedView>(response);
        setViews(current => [view, ...current.filter(existing => existing.id !== view.id)]);
        setSelected(String(view.id));
        setName('');
        setNotice('탐색 보기를 저장했습니다.');
      } else if (action === 'load') {
        const view = unwrap<SavedView>(response);
        if (view.sourceRevision !== sourceRevision)
          throw Object.assign(new Error('source revision changed'), { response: { status: 409 } });
        if (!restorable(view.state))
          throw new Error('저장된 탐색 조건의 버전을 확인할 수 없습니다. 다른 보기를 선택하거나 삭제해 주세요.');
        onRestore(view.state);
        setNotice(`“${view.name}” 조건을 복원했습니다.`);
      } else {
        unwrap<{ id: number }>(response);
        setViews(current => current.filter(view => String(view.id) !== selected));
        setSelected('');
        setNotice('저장 보기를 삭제했습니다.');
      }
    } catch (err) {
      if (token === generation.current) setError(message(err));
    } finally {
      if (token === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="my-1.5 flex flex-col gap-2">
      <Button variant="outline" aria-expanded={open} className="self-start" onClick={() => setOpen(value => !value)}>
        탐색 보기
      </Button>
      {open && (
        <div className={cn('flex flex-col gap-2', analysisPanelClassName)}>
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              select
              label="저장한 탐색 보기"
              value={selected}
              disabled={busy}
              onChange={event => setSelected(event.target.value)}
              className="min-w-[200px]"
            >
              <option value="">보기를 선택하세요</option>
              {views.map(view => (
                <option key={view.id} value={view.id}>
                  {view.name}
                  {view.unreadable ? ' (조건 확인 필요)' : view.stale ? ' (버전 변경)' : ''}
                </option>
              ))}
            </TextField>
            <Button variant="ghost" disabled={busy || !selected} onClick={() => void run('load')}>
              보기 열기
            </Button>
            <Button variant="ghost" disabled={busy || !selected} onClick={() => void run('remove')}>
              보기 삭제
            </Button>
            <TextField
              label="새 보기 이름"
              value={name}
              disabled={busy}
              onChange={event => setName(event.target.value)}
              className="w-[200px]"
            />
            <Button
              variant="ghost"
              disabled={busy || !canSave || !name.trim() || name.trim().length > 80 || views.length >= 20}
              onClick={() => void run('create')}
            >
              현재 조건 저장
            </Button>
          </div>
          <p className="text-xs wrap-anywhere text-muted-foreground">
            개인 보기 {views.length}/20 · 소스 버전 {sourceRevision.slice(0, 12)} · 원본 페이지는 첫 페이지로 복원
          </p>
        </div>
      )}
      {open && (
        <p role="status" className="text-xs text-muted-foreground">
          {busy
            ? '저장 보기를 처리하는 중…'
            : views.length >= 20
            ? '최대 20개입니다. 기존 보기를 삭제한 뒤 저장하세요.'
            : disabledReason ||
              (!canSave
                ? '유효한 탐색 결과를 불러온 뒤 저장하세요.'
                : name.trim().length > 80
                ? '보기 이름은 80자 이내로 입력하세요.'
                : !name.trim()
                ? '현재 조건을 저장하려면 보기 이름을 입력하세요.'
                : '')}
        </p>
      )}
      {notice && (
        <p role="status" className="text-[13px]">
          {notice}
        </p>
      )}
      {error && (
        <Notice severity="error" className="flex flex-wrap items-center gap-2">
          <span className="break-words">{error}</span>
          <Button variant="ghost" disabled={busy} onClick={() => setReload(value => value + 1)}>
            보기 목록 다시 불러오기
          </Button>
        </Notice>
      )}
    </div>
  );
}
