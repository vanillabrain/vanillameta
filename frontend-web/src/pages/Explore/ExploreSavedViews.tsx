import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';
import type { PivotRowSort } from './ExplorePivot';

export type ExploreViewState = {
  version: 1 | 2 | 3;
  pivot?: {
    enabled: boolean;
    rowColumns: string[];
    columnColumns: string[];
    rowHierarchy?: boolean;
    rowSort?: PivotRowSort;
    expandedRows?: Array<Array<string | number | boolean | null>>;
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
/** Guard the response version and render-critical shape before applying any state. */
const restorable = (input: unknown): input is ExploreViewState => {
  if (!input || typeof input !== 'object') return false;
  const value = input as Partial<ExploreViewState>;
  return (
    (value.version === 1 || value.version === 2 || value.version === 3) &&
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
    (value.version !== 3 ||
      (!!value.pivot &&
        typeof value.pivot.rowHierarchy === 'boolean' &&
        !!value.pivot.rowSort &&
        ['label', 'value'].includes(value.pivot.rowSort.by) &&
        ['asc', 'desc'].includes(value.pivot.rowSort.direction) &&
        (value.pivot.rowSort.by === 'label'
          ? value.pivot.rowSort.measureId === undefined
          : value.measureIds?.includes(value.pivot.rowSort.measureId ?? 0)) &&
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
    <Stack spacing={1} sx={{ mt: 1.5, mb: 1.5 }}>
      <Button
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        sx={{ alignSelf: 'flex-start', borderRadius: 999, border: '1px solid #e2e8f0', color: '#334155' }}
      >
        탐색 보기
      </Button>
      {open && (
        <Stack spacing={1} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, backgroundColor: '#f8fafc' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <TextField
              select
              size="small"
              label="저장한 탐색 보기"
              value={selected}
              disabled={busy}
              onChange={event => setSelected(event.target.value)}
              sx={{ minWidth: 200 }}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="">보기를 선택하세요</option>
              {views.map(view => (
                <option key={view.id} value={view.id}>
                  {view.name}
                  {view.unreadable ? ' (조건 확인 필요)' : view.stale ? ' (버전 변경)' : ''}
                </option>
              ))}
            </TextField>
            <Button disabled={busy || !selected} onClick={() => void run('load')}>
              보기 열기
            </Button>
            <Button disabled={busy || !selected} onClick={() => void run('remove')}>
              보기 삭제
            </Button>
            <TextField
              size="small"
              label="새 보기 이름"
              value={name}
              disabled={busy}
              onChange={event => setName(event.target.value)}
              sx={{ width: 200 }}
            />
            <Button
              disabled={busy || !canSave || !name.trim() || name.trim().length > 80 || views.length >= 20}
              onClick={() => void run('create')}
            >
              현재 조건 저장
            </Button>
          </Stack>
          <Typography color="text.secondary" sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            개인 보기 {views.length}/20 · 소스 버전 {sourceRevision.slice(0, 12)} · 원본 페이지는 첫 페이지로 복원
          </Typography>
        </Stack>
      )}
      {open && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} role="status">
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
        </Typography>
      )}
      {notice && (
        <Typography role="status" sx={{ fontSize: 13 }}>
          {notice}
        </Typography>
      )}
      {error && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => setReload(value => value + 1)}>
              보기 목록 다시 불러오기
            </Button>
          }
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}
