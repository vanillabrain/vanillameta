import React, { useEffect, useRef, useState } from 'react';
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
import AiDashboardPanel from './AiDashboardPanel';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from './MetricTrend';

type FilterValue = string | number | boolean | null;
type DateRange = { column: string; start: string; end: string };
const valueKey = (value: FilterValue) => encodeURIComponent(JSON.stringify(value));
const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) &&
  new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

export default function DashboardAnalysis({ dashboardId, onSaved, children }: any) {
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, FilterValue[]>>({});
  const [dateDraft, setDateDraft] = useState<DateRange>({ column: '', start: '', end: '' });
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [dateError, setDateError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const serial = useRef(0);
  const loadedDashboard = useRef(dashboardId);
  const loadSerial = useRef(0);
  useEffect(() => {
    loadSerial.current += 1;
    const request = loadSerial.current;
    setDraft(null);
    setPreview(null);
    setFilters({});
    setDateDraft({ column: '', start: '', end: '' });
    setDateRange(null);
    setDateError('');
    setBusy(false);
    setError('');
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
      });
    return () => {
      loadSerial.current += 1;
    };
  }, [dashboardId]);
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
  }, [draft, filters, dateRange, dashboardId]);
  if (!draft) return <>{children}</>;
  const dimensions = preview?.dimensions || [];
  const temporalColumns = preview?.temporalColumns || [];
  const temporalColumn = dateDraft.column || temporalColumns[0]?.column || '';
  const active = Object.entries(filters).filter(([, values]) => values.length);
  const reset = () => {
    setFilters({});
    setDateDraft({ column: '', start: '', end: '' });
    setDateRange(null);
    setDateError('');
  };
  const applyDates = () => {
    const { start, end } = dateDraft;
    if (!start && !end) {
      setDateError('');
      setDateRange(null);
      return;
    }
    if (!temporalColumn || !validDay(start) || !validDay(end) || start > end) {
      setDateError('시작일과 종료일을 올바르게 입력해 주세요. 시작일은 종료일 이전이어야 합니다.');
      return;
    }
    setDateError('');
    setDateRange({ column: temporalColumn, start, end });
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
          disabled={busy || (!active.length && !dateRange && !dateDraft.start && !dateDraft.end && !dateDraft.column)}
        >
          필터 초기화
        </Button>
        <Button size="small" variant="outlined" onClick={() => setEditing(true)}>
          AI로 수정
        </Button>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {dimensions.slice(0, 5).map((dimension: any) => {
          const selected = filters[dimension.column] || [];
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
                disabled={busy}
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
                  setFilters(values => ({
                    ...values,
                    [dimension.column]: keys.map(key => JSON.parse(decodeURIComponent(key)) as FilterValue),
                  }));
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
                  onChange={e => setDateDraft(value => ({ ...value, column: e.target.value }))}
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
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, flex: '1 1 150px', maxWidth: '100%' }}
              onChange={e => setDateDraft(value => ({ ...value, start: e.target.value }))}
            />
            <TextField
              label="종료일 (UTC)"
              type="date"
              size="small"
              value={dateDraft.end}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, flex: '1 1 150px', maxWidth: '100%' }}
              onChange={e => setDateDraft(value => ({ ...value, end: e.target.value }))}
            />
            <Button onClick={applyDates} disabled={busy}>
              적용
            </Button>
          </>
        )}
      </Stack>
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
                minHeight: widget.type === 'BOARD_NUMERIC' ? 250 : 460,
                height: widget.type === 'BOARD_NUMERIC' ? 'auto' : 460,
                gridColumn: widget.type === 'BOARD_NUMERIC' ? 'auto' : '1 / -1',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: '0 2px 6px rgba(42,50,62,.06)',
              }}
            >
              <Box sx={{ height: widget.type === 'BOARD_NUMERIC' ? 155 : '100%' }}>
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
                  widgetOption={analysisOptions(widget)}
                  dataSet={widget.datas}
                />
              </Box>
              {widget.type === 'BOARD_NUMERIC' && (
                <MetricTrend
                  trend={widget.trend}
                  unavailable={widget.trendUnavailable}
                  title={widget.title}
                  prefix={widget.prefix}
                  decimalPlaces={widget.decimalPlaces ?? 0}
                />
              )}
            </Card>
          ))}
        </Box>
      ) : (
        children
      )}
      <AiDashboardPanel
        open={editing}
        onClose={() => setEditing(false)}
        dashboardId={Number(dashboardId)}
        currentDraft={draft}
        onSaved={id => {
          setEditing(false);
          onSaved(id);
        }}
      />
    </Box>
  );
}
