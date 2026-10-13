import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { get, post } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import DashboardAssistant from './DashboardAssistant';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from './MetricTrend';
import PersonalSavedViews, {
  DateRange,
  FilterValue,
  RelativePeriod,
  SavedViewState,
  TrendGrain,
  resolveRelativePeriod,
  validDay,
} from './PersonalSavedViews';
import { PreviousPeriodData } from './PeriodComparison';
import SourceDetails from './SourceDetails';

const valueKey = (value: FilterValue) => encodeURIComponent(JSON.stringify(value));

export default function DashboardAnalysis({ dashboardId, revision, onSaved, onAssistantOpenChange, children }: any) {
  const { t } = useTranslation();
  const [numberNotation, setNumberNotation] = useState<SavedViewState['numberNotation']>('auto');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`dashboard-number-notation:${dashboardId}`);
      setNumberNotation(stored === 'full' || stored === 'compact' ? stored : 'auto');
    } catch {
      setNumberNotation('auto');
    }
  }, [dashboardId]);
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>({});
  const [dateDraft, setDateDraft] = useState<DateRange>({ column: '', start: '', end: '' });
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [trendGrain, setTrendGrain] = useState<TrendGrain>('auto');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [relativePeriod, setRelativePeriod] = useState<RelativePeriod | null>(null);
  const [recentDays, setRecentDays] = useState<7 | 30 | 90>(7);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [categoryNotice, setCategoryNotice] = useState('');
  const detailsButton = useRef<HTMLButtonElement>(null);
  const assistantButton = useRef<HTMLButtonElement>(null);
  const serial = useRef(0);
  const completedPreview = useRef(0);
  const pendingFocusIntent = useRef<{
    dashboardId: unknown;
    filters: string;
    afterRequest: number;
    button: HTMLButtonElement;
    cancel: () => void;
  } | null>(null);
  const loadedDashboard = useRef(null);
  const loadSerial = useRef(0);
  useEffect(() => {
    loadSerial.current += 1;
    const request = loadSerial.current;
    setAnalysisLoading(true);
    if (loadedDashboard.current !== dashboardId) {
      setDraft(null);
      setPreview(null);
      setFilters({});
      setDateDraft({ column: '', start: '', end: '' });
      setDateRange(null);
      setTrendGrain('auto');
      setComparePrevious(false);
      setRelativePeriod(null);
      setRecentDays(7);
      setDateError('');
      setBusy(false);
      setError('');
      setEditing(false);
      setDetailsOpen(false);
      setCategoryNotice('');
    }
    get(`/ai/dashboard-analysis/${dashboardId}`)
      .then(response => {
        if (request !== loadSerial.current) return;
        if (response.data.status === 'SUCCESS') {
          loadedDashboard.current = dashboardId;
          setDraft(response.data.data);
        }
        // Ordinary dashboards remain usable if their sources cannot support common filters.
      })
      .catch(() => {
        // Unsupported dashboards keep their standard viewer.
      })
      .finally(() => {
        if (request === loadSerial.current) setAnalysisLoading(false);
      });
    return () => {
      loadSerial.current += 1;
    };
  }, [dashboardId, revision]);
  useEffect(() => {
    onAssistantOpenChange?.(editing);
  }, [editing, onAssistantOpenChange]);
  useEffect(() => {
    if (!draft || loadedDashboard.current !== dashboardId) return;
    serial.current += 1;
    const request = serial.current;
    setBusy(true);
    setError('');
    post(
      '/ai/dashboard-preview',
      {
        draft,
        dashboardId: Number(dashboardId),
        includeTrends: true,
        trendGrain,
        comparePrevious: comparePrevious && !!dateRange,
        filters: Object.entries(filters)
          .filter(([, values]) => values.length)
          .slice(0, 5)
          .map(([column, values]) => ({ column, values: values.slice(0, 50) })),
        ...(dateRange ? { dateRange } : {}),
      },
      { timeout: 60000 },
    )
      .then(response => {
        if (request !== serial.current) return;
        if (response.data.status !== 'SUCCESS') throw new Error(response.data.message || '필터 조회 실패');
        completedPreview.current = request;
        setPreview(response.data.data);
      })
      .catch(e => {
        if (request !== serial.current) return;
        setError(e.response?.data?.message || e.message || '필터 조회 실패');
      })
      .finally(() => {
        if (request === serial.current) setBusy(false);
      });
    return () => {
      serial.current += 1;
    };
  }, [draft, filters, dateRange, dashboardId, trendGrain, comparePrevious, previewRefresh]);
  useEffect(() => () => pendingFocusIntent.current?.cancel(), []);
  useEffect(() => {
    const intent = pendingFocusIntent.current;
    if (!intent) return;
    if (
      intent.dashboardId !== dashboardId ||
      intent.filters !== JSON.stringify(filters) ||
      detailsOpen ||
      editing ||
      error
    ) {
      intent.cancel();
      return;
    }
    if (
      busy ||
      analysisLoading ||
      completedPreview.current !== serial.current ||
      completedPreview.current <= intent.afterRequest
    )
      return;
    const target = detailsButton.current;
    const abandoned = document.activeElement === document.body || document.activeElement === intent.button;
    intent.cancel();
    if (abandoned && target && !target.disabled && !document.querySelector('[role="dialog"]')) target.focus();
  }, [busy, analysisLoading, error, preview, filters, dashboardId, detailsOpen, editing]);
  if (!draft) return <>{children}</>;
  const dimensions = preview?.dimensions || [];
  const temporalColumns = preview?.temporalColumns || [];
  const temporalColumn = dateDraft.column || temporalColumns[0]?.column || '';
  const active = Object.entries(filters).filter(([, values]) => values.length);
  const unappliedDates =
    dateDraft.start !== (dateRange?.start ?? '') ||
    dateDraft.end !== (dateRange?.end ?? '') ||
    (!!dateDraft.column && dateDraft.column !== (dateRange?.column ?? ''));
  const viewDisabledReason =
    analysisLoading || busy
      ? '현재 조회가 완료된 뒤 저장 보기를 사용할 수 있습니다.'
      : error || dateError
      ? '조회 또는 날짜 오류를 해결한 뒤 저장 보기를 사용할 수 있습니다.'
      : unappliedDates
      ? '입력한 날짜를 적용하거나 초기화한 뒤 저장 보기를 사용할 수 있습니다.'
      : '';
  const detailsDisabledReason = viewDisabledReason.replace('저장 보기', '원본 상세');
  const selectionDisabled = busy || analysisLoading || !!error || !!dateError;
  const selectedValues = (column: string): FilterValue[] =>
    Object.prototype.hasOwnProperty.call(filters, column) && Array.isArray(filters[column]) ? filters[column] : [];
  const categoryLabel = (value: FilterValue) =>
    value === null
      ? '값 없음 (NULL)'
      : `${String(value)} (${typeof value === 'number' ? '숫자' : typeof value === 'boolean' ? '불리언' : '문자열'})`;
  const applyColumnValues = (column: string, values: FilterValue[], notice: string) => {
    if (selectionDisabled) return;
    if (values.length > 50) {
      setCategoryNotice('한 컬럼에서 최대 50개 값까지 선택할 수 있습니다. 기존 값을 해제해 주세요.');
      return;
    }
    if (values.length && !selectedValues(column).length && active.length >= 5) {
      setCategoryNotice('공통 필터는 최대 5개 컬럼까지 선택할 수 있습니다. 기존 필터를 해제해 주세요.');
      return;
    }
    setFilters(current => ({ ...current, [column]: values }));
    setCategoryNotice(notice);
  };
  const toggleCategory = (column: string, value: unknown) => {
    if (
      selectionDisabled ||
      !(
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      )
    )
      return;
    const category = value as FilterValue;
    const selected = selectedValues(column);
    const exists = selected.some(item => valueKey(item) === valueKey(category));
    applyColumnValues(
      column,
      exists ? selected.filter(item => valueKey(item) !== valueKey(category)) : [...selected, category],
      `공통 필터 변경: ${column} · ${categoryLabel(category)} ${exists ? '해제' : '선택'}`,
    );
  };
  const rememberFocusAfterPreview = (button: HTMLButtonElement, nextFilters = filters) => {
    if (document.activeElement === button) {
      pendingFocusIntent.current?.cancel();
      const cancel = () => {
        document.removeEventListener('focusin', movedFocus, true);
        document.removeEventListener('keydown', cancel, true);
        document.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('blur', cancel);
        if (pendingFocusIntent.current?.cancel === cancel) pendingFocusIntent.current = null;
      };
      const movedFocus = (event: FocusEvent) => {
        if (event.target !== button && event.target !== document.body && event.target !== detailsButton.current) cancel();
      };
      pendingFocusIntent.current = {
        dashboardId,
        filters: JSON.stringify(nextFilters),
        afterRequest: serial.current,
        button,
        cancel,
      };
      document.addEventListener('focusin', movedFocus, true);
      document.addEventListener('keydown', cancel, true);
      document.addEventListener('pointerdown', cancel, true);
      window.addEventListener('blur', cancel);
    }
  };
  const clearCategoryChip = (button: HTMLButtonElement, column: string, value: FilterValue) => {
    if (selectionDisabled) return;
    const remaining = selectedValues(column).filter(item => valueKey(item) !== valueKey(value));
    rememberFocusAfterPreview(button, { ...filters, [column]: remaining });
    applyColumnValues(column, remaining, `공통 필터 변경: ${column} · ${categoryLabel(value)} 해제`);
  };
  const setNotation = (value: SavedViewState['numberNotation']) => {
    setNumberNotation(value);
    try {
      localStorage.setItem(`dashboard-number-notation:${dashboardId}`, value);
    } catch {
      /* Display remains usable without browser storage. */
    }
  };
  const viewState: SavedViewState = {
    version: 1,
    filters: active.map(([column, values]) => ({ column, values })),
    dateRange: relativePeriod ? null : dateRange,
    relativePeriod,
    numberNotation,
    trendGrain,
    comparePrevious: comparePrevious && !!dateRange,
  };
  const reset = () => {
    setFilters({});
    setCategoryNotice('공통 필터를 초기화했습니다.');
    setDateDraft({ column: '', start: '', end: '' });
    setDateRange(null);
    setRelativePeriod(null);
    setTrendGrain('auto');
    setComparePrevious(false);
    setDateError('');
  };
  const applyDates = () => {
    const { start, end } = dateDraft;
    setRelativePeriod(null);
    if (!start && !end) {
      setDateError('');
      setDateRange(null);
      setComparePrevious(false);
      setTrendGrain('auto');
      setDateDraft({ column: '', start: '', end: '' });
      return;
    }
    if (!temporalColumn || !validDay(start) || !validDay(end) || start > end) {
      setDateError('시작일과 종료일을 올바르게 입력해 주세요. 시작일은 종료일 이전이어야 합니다.');
      return;
    }
    setDateError('');
    setDateRange({ column: temporalColumn, start, end });
  };
  const applyRecent = () => {
    if (busy || analysisLoading || error || !temporalColumn) return;
    const relative = { column: temporalColumn, days: recentDays };
    const range = resolveRelativePeriod(relative);
    setRelativePeriod(relative);
    setDateRange(range);
    setDateDraft(range);
    setDateError('');
  };
  const period = dateRange ? `${dateRange.column}: ${dateRange.start} ~ ${dateRange.end} (UTC)` : '전체 기간';
  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 13, mr: 'auto', minWidth: 0, overflowWrap: 'anywhere' }}>
          {period} ·{' '}
          {active.length
            ? active.map(([column, values]) => `${column}: ${values.map(String).join(', ')}`).join(' · ')
            : '필터 없음'}
        </Typography>
        <Button
          size="small"
          onClick={reset}
          disabled={
            busy ||
            (!active.length &&
              !dateRange &&
              !dateDraft.start &&
              !dateDraft.end &&
              !dateDraft.column &&
              trendGrain === 'auto' &&
              !comparePrevious)
          }
        >
          필터 초기화
        </Button>
        <Button
          ref={detailsButton}
          size="small"
          variant="outlined"
          disabled={typeof preview?.sourceRevision !== 'string' || !preview.sourceRevision}
          aria-disabled={!!viewDisabledReason}
          onClick={() => {
            if (viewDisabledReason) return;
            setDetailsOpen(true);
          }}
        >
          원본 상세 보기
        </Button>
        <Button
          ref={assistantButton}
          size="small"
          variant="outlined"
          aria-expanded={editing}
          onClick={() => setEditing(value => !value)}
        >
          Assistant
        </Button>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="number-notation">{t('settings.numberNotation')}</InputLabel>
          <Select
            labelId="number-notation"
            label={t('settings.numberNotation')}
            value={numberNotation}
            onChange={event => {
              setNotation(event.target.value as SavedViewState['numberNotation']);
            }}
          >
            <MenuItem value="auto">위젯 설정</MenuItem>
            <MenuItem value="compact">{t('settings.numberCompact')}</MenuItem>
            <MenuItem value="full">{t('settings.numberFull')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Stack direction="row" aria-label="적용된 공통 필터" sx={{ flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {active.flatMap(([column, values]) =>
          values.map(value => (
            <Button
              key={`${column}:${valueKey(value)}`}
              size="small"
              variant="outlined"
              aria-disabled={selectionDisabled}
              aria-label={`${column}: ${categoryLabel(value)} 공통 필터 해제`}
              sx={{ maxWidth: '100%', textAlign: 'left', overflowWrap: 'anywhere', borderRadius: 4 }}
              onClick={event => clearCategoryChip(event.currentTarget, column, value)}
            >
              {column}: {categoryLabel(value)} ×
            </Button>
          )),
        )}
      </Stack>
      <Typography role="status" aria-live="polite" sx={{ fontSize: 13, mb: 1, overflowWrap: 'anywhere' }}>
        {categoryNotice}
        {categoryNotice && (busy ? ' · 조회 중' : error ? ' · 조건 적용 실패' : ' · 조회 완료')}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {dimensions.slice(0, 5).map((dimension: any) => {
          const selected = selectedValues(dimension.column);
          const options: FilterValue[] = Array.from(
            new Map<string, FilterValue>(
              [...selected, ...dimension.values.slice(0, 50)].map((value: FilterValue) => [valueKey(value), value]),
            ).values(),
          ).slice(0, 50);
          return (
            <FormControl
              key={dimension.column}
              size="small"
              sx={{ minWidth: 0, width: '100%', flex: '1 1 150px', maxWidth: { xs: '100%', sm: 250 } }}
            >
              <InputLabel shrink id={`filter-${dimension.column}`}>
                {dimension.column}
              </InputLabel>
              <Select
                multiple
                labelId={`filter-${dimension.column}`}
                label={dimension.column}
                notched
                value={selected.map(valueKey)}
                disabled={selectionDisabled}
                displayEmpty
                renderValue={() => (
                  <Box
                    component="span"
                    sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {selected.length ? selected.map(String).join(', ') : '전체'}
                  </Box>
                )}
                onChange={e => {
                  const keys = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                  if (keys.length > 50) return;
                  applyColumnValues(
                    dimension.column,
                    keys.map(key => JSON.parse(decodeURIComponent(key)) as FilterValue),
                    `공통 필터 변경: ${dimension.column}`,
                  );
                }}
              >
                {options.map(value => (
                  <MenuItem
                    key={valueKey(value)}
                    value={valueKey(value)}
                    disabled={selected.length >= 50 && !selected.includes(value)}
                    onKeyUp={event => {
                      // MUI Select suppresses Space activation on its option elements.
                      if (event.key === ' ' && event.target === event.currentTarget) event.currentTarget.click();
                    }}
                  >
                    <Checkbox checked={selected.includes(value)} />
                    {String(value)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        })}
        {temporalColumns.length > 0 && (
          <>
            {temporalColumns.length > 1 ? (
              <FormControl size="small" sx={{ minWidth: 0, flex: '1 1 150px', maxWidth: '100%' }}>
                <InputLabel id="date-column">날짜 컬럼 (UTC)</InputLabel>
                <Select
                  labelId="date-column"
                  label="날짜 컬럼 (UTC)"
                  value={temporalColumn}
                  disabled={busy}
                  onChange={e => {
                    setRelativePeriod(null);
                    setDateDraft(value => ({ ...value, column: e.target.value }));
                  }}
                >
                  {temporalColumns.map((column: any) => (
                    <MenuItem key={column.column} value={column.column}>
                      {column.column}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Typography>{temporalColumn} (UTC)</Typography>
            )}
            <TextField
              label="시작일 (UTC)"
              type="date"
              size="small"
              value={dateDraft.start}
              disabled={busy}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, flex: '1 1 150px', maxWidth: '100%' }}
              onChange={e => {
                setRelativePeriod(null);
                setDateDraft(value => ({ ...value, start: e.target.value }));
              }}
            />
            <TextField
              label="종료일 (UTC)"
              type="date"
              size="small"
              value={dateDraft.end}
              disabled={busy}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, flex: '1 1 150px', maxWidth: '100%' }}
              onChange={e => {
                setRelativePeriod(null);
                setDateDraft(value => ({ ...value, end: e.target.value }));
              }}
            />
            <Button onClick={applyDates} disabled={busy}>
              적용
            </Button>
            <TextField
              select
              label="최근 기간 (UTC)"
              value={recentDays}
              disabled={busy}
              size="small"
              sx={{ minWidth: 0, flex: '1 1 150px' }}
              onChange={event => setRecentDays(Number(event.target.value) as 7 | 30 | 90)}
            >
              <MenuItem value={7}>최근 7일</MenuItem>
              <MenuItem value={30}>최근 30일</MenuItem>
              <MenuItem value={90}>최근 90일</MenuItem>
            </TextField>
            <Button disabled={busy || analysisLoading || !!error} onClick={applyRecent}>
              최근 기간 적용
            </Button>
          </>
        )}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
        <TextField
          select
          label="시계열 집계 단위"
          value={trendGrain}
          disabled={analysisLoading}
          size="small"
          sx={{ minWidth: 160, maxWidth: '100%' }}
          onChange={event => setTrendGrain(event.target.value as TrendGrain)}
        >
          <MenuItem value="auto">자동</MenuItem>
          <MenuItem value="day">일별</MenuItem>
          <MenuItem value="week">주별</MenuItem>
          <MenuItem value="month">월별</MenuItem>
        </TextField>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}>
          <input
            type="checkbox"
            checked={comparePrevious}
            disabled={analysisLoading || !dateRange || unappliedDates || !!dateError}
            onChange={event => setComparePrevious(event.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          이전 기간 비교
        </Box>
      </Stack>
      <Typography variant="body2" sx={{ mb: 2 }}>
        주별은 UTC 월요일 시작, 월별은 UTC 달력의 월 기준입니다. 선택 범위에 걸친 주·월은 범위 안의 데이터만 집계합니다. 이전
        기간은 적용된 기간 바로 앞의 같은 일수이며 동일한 필터로 조회합니다.
        {!dateRange && ' 이전 기간 비교는 날짜를 적용한 뒤 사용할 수 있습니다.'}
      </Typography>
      {preview?.comparison && (
        <Typography role="status" sx={{ mb: 2, overflowWrap: 'anywhere' }}>
          {busy || error ? '이전 조회 결과의 비교 기간' : '이전 기간'}: {preview.comparison.previous.column} ·{' '}
          {preview.comparison.previous.start} ~ {preview.comparison.previous.end} (UTC)
        </Typography>
      )}
      {dateError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {dateError}
        </Alert>
      )}
      {busy && <LinearProgress aria-label="공통 필터 집계 중" sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Typography sx={{ fontSize: 13 }}>아래는 이전 조회 결과입니다. 현재 선택 조건은 적용되지 않았습니다.</Typography>
          <Button onClick={reset}>전체 데이터로 복구</Button>
        </Alert>
      )}
      <PersonalSavedViews
        key={`personal-views-${dashboardId}`}
        dashboardId={Number(dashboardId)}
        revision={draft.revision}
        state={viewState}
        disabledReason={viewDisabledReason}
        sourceRevision={preview?.sourceRevision}
        onApply={(state, range) => {
          if (!draft.revision || viewDisabledReason) return;
          serial.current += 1;
          setBusy(true);
          setError('');
          setDateError('');
          setFilters(Object.fromEntries(state.filters.map(filter => [filter.column, filter.values])));
          setDateRange(range);
          setDateDraft(range ?? { column: '', start: '', end: '' });
          setRelativePeriod(state.relativePeriod);
          setTrendGrain(state.trendGrain ?? 'auto');
          setComparePrevious(state.comparePrevious === true && !!range);
          if (state.relativePeriod) setRecentDays(state.relativePeriod.days);
          setNotation(state.numberNotation);
        }}
      />
      {preview ? (
        <Box
          aria-busy={busy}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
            opacity: busy || error ? 0.4 : 1,
            pointerEvents: busy || error ? 'none' : 'auto',
          }}
        >
          {preview.widgets.map((widget: any, i: number) => (
            <Card
              key={i}
              sx={{
                minHeight: preview.draft?.layoutSizes?.[i]
                  ? preview.draft.layoutSizes[i].height * 80 + 60
                  : widget.type === 'BOARD_NUMERIC'
                  ? 250
                  : 460,
                height: 'auto',
                gridColumn: preview.draft?.layoutSizes?.[i]
                  ? preview.draft.layoutSizes[i].width === 12
                    ? '1 / -1'
                    : 'auto'
                  : widget.type === 'BOARD_NUMERIC'
                  ? 'auto'
                  : '1 / -1',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: '0 2px 6px rgba(42,50,62,.06)',
              }}
            >
              <Box
                sx={{
                  height:
                    widget.type === 'BOARD_NUMERIC'
                      ? 155
                      : preview.draft?.layoutSizes?.[i]
                      ? preview.draft.layoutSizes[i].height * 80 + 60
                      : 460,
                  minWidth: 0,
                }}
              >
                <WidgetViewer
                  title={widget.title}
                  description={`${
                    busy || error
                      ? '이전 조회 결과 · 현재 선택 조건 미적용'
                      : active.length || dateRange
                      ? `${period} · 선택한 필터 적용`
                      : '전체 기간 · 필터 없음'
                  } · ${
                    widget.type === 'BOARD_NUMERIC'
                      ? widget.description?.replace(/전체 기간[^·]*· 필터 없음 · [\d,]+행/g, '원본 데이터 집계') || ''
                      : `${widget.datas.length}개 항목`
                  }`}
                  widgetType={widget.type}
                  widgetOption={analysisOptions(widget, numberNotation)}
                  dataSet={widget.datas}
                  onCategorySelect={
                    typeof widget.dimensionColumn === 'string' &&
                    widget.dimensionColumn &&
                    !temporalColumns.some((column: any) => column.column === widget.dimensionColumn)
                      ? value => toggleCategory(widget.dimensionColumn, value)
                      : undefined
                  }
                  selectedCategoryValues={
                    typeof widget.dimensionColumn === 'string' ? selectedValues(widget.dimensionColumn) : []
                  }
                  categorySelectionDisabled={selectionDisabled}
                />
              </Box>
              {widget.trendGrain && (
                <Typography variant="caption" sx={{ px: 2.5 }}>
                  적용된 집계 단위:{' '}
                  {({ day: '일별', week: '주별', month: '월별' } as Record<string, string>)[widget.trendGrain] ??
                    widget.trendGrain}{' '}
                  · UTC
                </Typography>
              )}
              {widget.grainUnavailable && (
                <Alert severity="warning" sx={{ m: 2 }}>
                  선택한 집계 단위를 적용하지 못했습니다. {widget.grainUnavailable}
                </Alert>
              )}
              {widget.type === 'BOARD_NUMERIC' && (
                <MetricTrend
                  trend={widget.trend}
                  unavailable={widget.trendUnavailable}
                  title={widget.title}
                  prefix={widget.prefix}
                  decimalPlaces={widget.decimalPlaces ?? 0}
                  comparison={widget.comparison}
                  suffix={widget.suffix}
                />
              )}
              {widget.type !== 'BOARD_NUMERIC' && (Array.isArray(widget.previousDatas) || widget.previousUnavailable) && (
                <PreviousPeriodData
                  title={widget.title}
                  data={widget.previousDatas}
                  categoryField={widget.categoryField}
                  valueField={widget.valueField}
                  unavailable={widget.previousUnavailable}
                  period={
                    preview.comparison
                      ? `${preview.comparison.previous.start} ~ ${preview.comparison.previous.end}`
                      : undefined
                  }
                />
              )}
            </Card>
          ))}
        </Box>
      ) : (
        children
      )}
      {preview?.sourceRevision && (
        <SourceDetails
          key={`source-details-${dashboardId}`}
          open={detailsOpen}
          dashboardId={Number(dashboardId)}
          draft={draft}
          filters={active.map(([column, values]) => ({ column, values }))}
          dateRange={dateRange}
          sourceRevision={preview?.sourceRevision}
          disabledReason={detailsDisabledReason}
          onClose={() => setDetailsOpen(false)}
          onExited={() => {
            if (document.activeElement === document.body) detailsButton.current?.focus();
          }}
          onRefresh={() => {
            setDetailsOpen(false);
            setPreviewRefresh(value => value + 1);
          }}
        />
      )}
      <DashboardAssistant
        key={dashboardId}
        open={editing}
        onClose={() => {
          setEditing(false);
          assistantButton.current?.focus();
        }}
        dashboardId={Number(dashboardId)}
        draft={draft}
        filters={active.map(([column, values]) => ({ column, values }))}
        dateRange={dateRange}
        trendGrain={trendGrain}
        comparePrevious={comparePrevious && !!dateRange}
        disabled={busy || !!error}
        onApplied={next => {
          setNumberNotation('auto');
          try {
            localStorage.removeItem(`dashboard-number-notation:${dashboardId}`);
          } catch {
            /* Display remains usable without browser storage. */
          }
          setDraft(next);
          onSaved(Number(dashboardId));
        }}
      />
    </Box>
  );
}
