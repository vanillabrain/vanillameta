import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { del, get, post } from '@/helpers/apiHelper';
import { validTimeRange, validTimeZone } from './timeSelection';

export type FilterValue = string | number | boolean | null;
export type DateRange = {
  column: string;
  start: string;
  end: string;
  precision?: 'timestamp';
  timeZone?: string;
};
export type RelativePeriod = { column: string; days: 7 | 30 | 90; timeZone?: string };
export type TrendGrain = 'auto' | 'day' | 'week' | 'month';
export type SavedViewState = {
  version: 1;
  filters: { column: string; values: FilterValue[] }[];
  dateRange: DateRange | null;
  relativePeriod: RelativePeriod | null;
  numberNotation: 'auto' | 'compact' | 'full';
  trendGrain?: TrendGrain;
  comparePrevious?: boolean;
};
export type ViewPeriodState = { dateRange: DateRange | null; relativePeriod: RelativePeriod | null };
type SavedView<State extends ViewPeriodState = SavedViewState> = {
  id: number | string;
  name: string;
  state: State;
  revision: string;
  createdAt: string;
  resolvedDateRange?: DateRange | null;
};
type Props<State extends ViewPeriodState> = {
  dashboardId?: number;
  endpoint?: string;
  subject?: 'dashboard' | 'explore';
  parseState?: (value: unknown) => State;
  revision?: string;
  state: State;
  disabledReason?: string;
  sourceRevision?: string;
  onApply: (state: State, dateRange: DateRange | null) => void;
  renderViewAction?: (view: SavedView<State>) => React.ReactNode;
};

export const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
  new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

/**
 * Explicit IANA region names or UTC; never the host timezone. An omitted field keeps the legacy
 * UTC behavior, so only a supplied value is validated.
 */
export { validTimeZone } from './timeSelection';

/** Undefined keeps the legacy UTC default; any supplied field must be a real zone. */
const optionalTimeZone = (value: unknown) => value === undefined || validTimeZone(value);
const sameTimeZone = (a?: string | null, b?: string | null) => (a ?? 'UTC') === (b ?? 'UTC');

/** Calendar date in the given zone (default UTC), independent of the browser's local timezone. */
function calendarDate(now: Date, timeZone?: string): string {
  if (timeZone === undefined || timeZone === 'UTC') return now.toISOString().slice(0, 10);
  if (!validTimeZone(timeZone)) throw new Error('저장 보기의 기간·시간대 형식을 확인해 주세요.');
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      era: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map(part => [part.type, part.value]),
  );
  const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  return `${String(year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Inclusive calendar days resolved in the period's timezone, independent of the host. */
export function resolveRelativePeriod(period: RelativePeriod, today = new Date()): DateRange {
  const end = calendarDate(today, period.timeZone);
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - period.days + 1);
  return {
    column: period.column,
    start: start.toISOString().slice(0, 10),
    end,
    ...(period.timeZone !== undefined ? { timeZone: period.timeZone } : {}),
  };
}

const validColumn = (column: unknown) => typeof column === 'string' && !!column.trim();
const validRange = (range: DateRange) =>
  range &&
  optionalTimeZone(range.timeZone) &&
  (range.precision === 'timestamp'
    ? validTimeRange(range)
    : range.precision === undefined &&
      validColumn(range.column) &&
      validDay(range.start) &&
      validDay(range.end) &&
      range.start <= range.end);
function stateData(value: unknown): SavedViewState {
  const state = value as SavedViewState;
  if (
    !state ||
    state.version !== 1 ||
    !['auto', 'compact', 'full'].includes(state.numberNotation) ||
    (state.trendGrain !== undefined && !['auto', 'day', 'week', 'month'].includes(state.trendGrain)) ||
    (state.comparePrevious !== undefined && typeof state.comparePrevious !== 'boolean') ||
    (state.comparePrevious === true && !state.dateRange && !state.relativePeriod) ||
    !Array.isArray(state.filters) ||
    state.filters.length > 5 ||
    !state.filters.every(
      filter =>
        validColumn(filter?.column) &&
        Array.isArray(filter.values) &&
        filter.values.length <= 50 &&
        filter.values.every(
          value =>
            value === null ||
            ['string', 'boolean'].includes(typeof value) ||
            (typeof value === 'number' && Number.isFinite(value)),
        ),
    ) ||
    new Set(state.filters.map(filter => filter.column)).size !== state.filters.length ||
    (state.dateRange !== null && !validRange(state.dateRange)) ||
    (state.relativePeriod !== null &&
      (!validColumn(state.relativePeriod?.column) ||
        ![7, 30, 90].includes(state.relativePeriod?.days) ||
        !optionalTimeZone(state.relativePeriod?.timeZone))) ||
    (state.dateRange !== null && state.relativePeriod !== null)
  ) {
    throw new Error('저장 보기의 조건을 확인할 수 없습니다. 다시 불러와 주세요.');
  }
  // Only view settings cross the API boundary; no definition, SQL, rows or credentials.
  return {
    version: 1,
    filters: state.filters.map(({ column, values }) => ({ column, values: [...values] })),
    dateRange: state.dateRange
      ? {
          column: state.dateRange.column,
          start: state.dateRange.start,
          end: state.dateRange.end,
          ...(state.dateRange.precision === 'timestamp' ? { precision: 'timestamp' as const } : {}),
          ...(state.dateRange.timeZone !== undefined ? { timeZone: state.dateRange.timeZone } : {}),
        }
      : null,
    relativePeriod: state.relativePeriod
      ? {
          column: state.relativePeriod.column,
          days: state.relativePeriod.days,
          ...(state.relativePeriod.timeZone !== undefined ? { timeZone: state.relativePeriod.timeZone } : {}),
        }
      : null,
    numberNotation: state.numberNotation,
    ...(state.trendGrain !== undefined ? { trendGrain: state.trendGrain } : {}),
    ...(state.comparePrevious !== undefined ? { comparePrevious: state.comparePrevious } : {}),
  };
}

function responseData(response: { data: { status: string; data?: unknown; message?: unknown } }) {
  if (response?.data?.status !== 'SUCCESS') throw Object.assign(new Error('저장 보기 요청 실패'), { response });
  return response.data.data;
}
function viewData<State extends ViewPeriodState>(data: unknown, parseState: (value: unknown) => State): SavedView<State> {
  const view = data as SavedView<State>;
  if (
    !view ||
    !['string', 'number'].includes(typeof view.id) ||
    typeof view.name !== 'string' ||
    !view.name.trim() ||
    view.name.length > 80 ||
    typeof view.revision !== 'string' ||
    !view.revision.trim()
  )
    throw new Error('저장 보기 응답을 확인할 수 없습니다.');
  return { ...view, state: parseState(view.state) };
}
function errorText(error: unknown, subject: 'dashboard' | 'explore') {
  const e = error as { response?: { status?: number; data?: { data?: unknown; message?: unknown } }; message?: unknown };
  const body = e?.response?.data;
  const nested = body?.data as { message?: unknown };
  const server = [body?.data, nested?.message, body?.message].find(message => typeof message === 'string' && message.trim());
  if (e?.response?.status === 409 && subject === 'explore')
    return '지표·열 정의가 변경되어 이 저장 보기를 적용할 수 없습니다. 보기는 삭제되지 않았습니다. 지표 탐색 화면을 새로고침한 뒤 현재 조건을 새 보기로 저장해 주세요.';
  if (e?.response?.status === 409)
    return `대시보드 정의가 변경되어 이 저장 보기를 적용할 수 없습니다. 보기는 삭제되지 않았습니다.${
      typeof server === 'string' ? ` ${server}` : ''
    }`;
  return typeof server === 'string'
    ? server
    : typeof e?.message === 'string'
    ? e.message
    : '저장 보기 요청에 실패했습니다. 다시 시도해 주세요.';
}

export default function PersonalSavedViews<State extends ViewPeriodState = SavedViewState>({
  dashboardId,
  endpoint,
  subject = 'dashboard',
  parseState: customParser,
  revision,
  state,
  disabledReason = '',
  sourceRevision,
  onApply,
  renderViewAction,
}: Props<State>) {
  const apiPath = endpoint ?? `/dashboard/${dashboardId}/views`;
  const parseState = customParser ?? (stateData as unknown as (value: unknown) => State);
  const [views, setViews] = useState<SavedView<State>[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [deleting, setDeleting] = useState<SavedView<State> | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLElement | null>(null);
  const fallbackFocus = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const context = useRef({ dashboardId, revision, state, disabledReason, onApply });
  context.current = { dashboardId, revision, state, disabledReason, onApply };

  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    pending.current = true;
    setViews([]);
    setLoaded(false);
    setDeleting(null);
    setName('');
    setError('');
    setNotice('');
    setBusy('저장 보기 불러오는 중…');
    void (async () => {
      try {
        const data = responseData(await get(apiPath, undefined, { signal: abort.signal }));
        if (!Array.isArray(data) || data.length > 20) throw new Error('저장 보기 목록을 확인할 수 없습니다.');
        const list = data.map(value => viewData(value, parseState));
        if (token === generation.current && !abort.signal.aborted) {
          setViews(list);
          setLoaded(true);
        }
      } catch (e: unknown) {
        if (token === generation.current && !abort.signal.aborted) setError(errorText(e, subject));
      } finally {
        if (token === generation.current && !abort.signal.aborted) {
          pending.current = false;
          setBusy('');
        }
      }
    })();
    return () => {
      generation.current += 1;
      controller.current?.abort();
      pending.current = false;
    };
  }, [apiPath, revision, reload]);

  const blocked =
    disabledReason ||
    (!revision?.trim()
      ? subject === 'explore'
        ? '지표 정의를 확인한 뒤 저장 보기를 사용할 수 있습니다.'
        : '대시보드 버전을 확인한 뒤 저장 보기를 사용할 수 있습니다.'
      : '');
  const nameValid = !!name.trim() && name.trim().length <= 80;
  const actionLocked = !!busy || !loaded || !!blocked || !!error;
  const restoreFocus = () => {
    const element = trigger.current;
    if (element?.isConnected && !(element as HTMLButtonElement).disabled) element.focus();
    else fallbackFocus.current?.focus();
  };
  const run = async (action: 'save' | 'load' | 'delete', view?: SavedView<State>) => {
    if (
      pending.current ||
      !loaded ||
      (action !== 'delete' && actionLocked) ||
      (action === 'save' && (!nameValid || views.length >= 20)) ||
      (action !== 'save' && !view)
    )
      return;
    pending.current = true;
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    const initial = context.current;
    const fingerprint = JSON.stringify(initial.state);
    setBusy(action === 'save' ? '보기 저장 중…' : action === 'load' ? '보기 적용 준비 중…' : '보기 삭제 중…');
    setError('');
    setNotice('');
    try {
      if (action === 'save') {
        const saved = viewData(
          responseData(
            await post(apiPath, { name: name.trim(), state: parseState(state), revision }, { signal: abort.signal }),
          ),
          parseState,
        );
        if (token !== generation.current || abort.signal.aborted) return;
        setViews(current => [...current.filter(row => row.id !== saved.id), saved]);
        setName('');
        setNotice('현재 조건을 개인 저장 보기로 저장했습니다.');
      } else if (action === 'load') {
        const saved = viewData(
          responseData(await get(`${apiPath}/${encodeURIComponent(view.id)}`, undefined, { signal: abort.signal })),
          parseState,
        );
        if (token !== generation.current || abort.signal.aborted) return;
        const latest = context.current;
        if (latest.disabledReason || latest.revision !== initial.revision || JSON.stringify(latest.state) !== fingerprint) {
          setNotice('화면 조건이 바뀌었습니다. 저장 보기를 다시 불러와 주세요.');
          return;
        }
        if (saved.revision !== latest.revision)
          throw Object.assign(new Error('저장 보기 버전 불일치'), { response: { status: 409 } });
        const range = saved.state.relativePeriod ? saved.resolvedDateRange : saved.state.dateRange;
        if (
          saved.state.relativePeriod &&
          (!validRange(range) ||
            range.precision !== undefined ||
            range.column !== saved.state.relativePeriod.column ||
            !sameTimeZone(range.timeZone, saved.state.relativePeriod.timeZone))
        )
          throw new Error('서버에서 상대 기간을 확인하지 못했습니다. 저장 보기를 다시 불러와 주세요.');
        latest.onApply(saved.state, range ?? null);
        setNotice(`${saved.name} 보기를 적용했습니다.`);
      } else {
        responseData(await del(`${apiPath}/${encodeURIComponent(view.id)}`, { signal: abort.signal }));
        if (token !== generation.current || abort.signal.aborted) return;
        setViews(current => current.filter(row => row.id !== view.id));
        setDeleting(null);
        setNotice('개인 저장 보기를 삭제했습니다.');
      }
    } catch (e: unknown) {
      if (token === generation.current && !abort.signal.aborted) setError(errorText(e, subject));
    } finally {
      if (token === generation.current && !abort.signal.aborted) {
        pending.current = false;
        setBusy('');
      }
    }
  };

  return (
    <Box
      component="section"
      aria-label={subject === 'explore' ? '탐색 저장 보기' : '개인 저장 보기'}
      sx={{
        mb: 2,
        p: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        minWidth: 0,
        '& .MuiButton-root': { minHeight: 44 },
      }}
    >
      <Typography component="h2" variant="h6">
        {subject === 'explore' ? '탐색 저장 보기' : '개인 저장 보기'}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {subject === 'explore'
          ? '탐색 방식·Pivot 행과 열·선택한 지표·차원·적용한 필터·기간·집계·비교·정렬을 개인별로 저장합니다. 열 때 최신 정상 데이터로 조회합니다. 소스별 최대 20개입니다.'
          : '현재 적용한 필터·기간·숫자 표시·집계 단위·이전 기간 비교를 개인별로 저장합니다. 대시보드 정의는 바뀌지 않습니다. 최대 20개입니다.'}
      </Typography>
      {sourceRevision && (
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
          데이터 버전: {sourceRevision.slice(0, 12)}
        </Typography>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
        <TextField
          label="저장 보기 이름"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={!!busy}
          inputProps={{ maxLength: 80 }}
          helperText="공백 제외 1~80자"
          size="small"
          fullWidth
        />
        <Button
          variant="outlined"
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: { sm: 132 } }}
          disabled={actionLocked || !nameValid || views.length >= 20}
          onClick={() => void run('save')}
        >
          현재 보기 저장
        </Button>
      </Stack>
      {blocked && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {blocked}
        </Typography>
      )}
      {views.length >= 20 && (
        <Typography variant="body2">저장 보기가 20개입니다. 새 보기를 저장하려면 기존 보기를 삭제해 주세요.</Typography>
      )}
      <Typography role="status" aria-live="polite" sx={{ mt: 1 }}>
        {busy || notice}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ my: 1, overflowWrap: 'anywhere' }}>
          {error}
        </Alert>
      )}
      <Button ref={fallbackFocus} disabled={!!busy} onClick={() => setReload(value => value + 1)}>
        저장 보기 목록 다시 불러오기
      </Button>
      {loaded && !views.length && <Typography variant="body2">저장된 개인 보기가 없습니다.</Typography>}
      <Box component="ul" aria-label="저장된 개인 보기 목록" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {views.map(view => (
          <Box component="li" key={view.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
              <Typography sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{view.name}</Typography>
              <Button
                disabled={actionLocked}
                aria-label={`${view.name} 보기 불러오기`}
                onClick={() => void run('load', view)}
              >
                불러오기
              </Button>
              {renderViewAction?.(view)}
              <Button
                disabled={!!busy}
                aria-label={`${view.name} 보기 삭제`}
                onClick={event => {
                  trigger.current = event.currentTarget;
                  setError('');
                  setDeleting(view);
                }}
              >
                삭제
              </Button>
            </Stack>
          </Box>
        ))}
      </Box>
      <Dialog
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        fullWidth
        maxWidth="xs"
        disableRestoreFocus
        TransitionProps={{ onExited: restoreFocus }}
      >
        <DialogTitle id={titleId}>개인 저장 보기 삭제</DialogTitle>
        <DialogContent>
          <Typography id={descriptionId} sx={{ overflowWrap: 'anywhere' }}>
            {deleting?.name} 보기를 삭제할까요?{' '}
            {subject === 'explore' ? '지표와 데이터는 유지됩니다.' : '대시보드와 데이터는 유지됩니다.'}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button disabled={!!busy} onClick={() => void run('delete', deleting)}>
            삭제 확인
          </Button>
          <Button autoFocus disabled={!!busy} onClick={() => setDeleting(null)}>
            취소
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
