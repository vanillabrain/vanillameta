import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import NumericBoard from '@/widget/modules/board/NumericBoard';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import { AnalysisUiProvider } from '@/components/analysis/AnalysisUi';
import { validDraft } from '../dashboardPreview';
import BlockLayoutCanvas from './BlockLayoutCanvas';
import MetricTrend, { FormattedMetricTrendData } from '../Components/MetricTrend';

type Column = { name: string; type: string; numeric: boolean; temporal: boolean };
type Metric = {
  id: number;
  label: string;
  definition: { unit: string; decimalPlaces: number; numberNotation: 'plain' | 'compact' };
};
type Rect = { x: number; y: number; w: number; h: number };
type LayoutMode = 'mobile' | 'tablet' | 'desktop';
const columns = { mobile: 4, tablet: 8, desktop: 12 };
type Item = {
  key: string;
  copyOf?: string;
  layouts?: Partial<Record<LayoutMode, Rect>>;
  kind: 'metric' | 'existing' | 'draft';
  definition?: {
    title: string;
    description: string;
    type: string;
    sql: string;
    valueField: string;
    categoryField?: string;
    decimalPlaces?: number;
    prefix?: string;
    suffix?: string;
    numberNotation?: 'full' | 'compact';
    blockId?: string;
  };
  title: string;
  metricId?: number;
  metricAvailable?: boolean;
  chart: 'number' | 'bar' | 'line';
  dimension?: string;
  unit: string;
  decimalPlaces: number;
  numberNotation: 'plain' | 'compact';
  width: 6 | 12;
  height: 3 | 5 | 7;
};
type Editor = {
  dashboardId: number;
  title: string;
  sourceId: number;
  revision: string;
  profile: { name: string; supported: boolean; status: string; columns?: Column[] };
  metrics: Metric[];
  items: Item[];
};
type PreviewWidget = {
  trend?: FormattedMetricTrendData;
  trendUnavailable?: string;
  title: string;
  type: string;
  valueField: string;
  categoryField?: string;
  decimalPlaces: number;
  prefix?: string;
  suffix?: string;
  numberNotation: string;
  datas: Record<string, unknown>[];
};
type Preview = { widgets: PreviewWidget[]; responsiveLayouts?: Record<LayoutMode, Record<string, Rect>> };
const unwrap = <T,>(response: { data: { status: string; data: T } }): T => {
  if (response.data.status !== 'SUCCESS' || !response.data.data) throw new Error('Invalid response');
  return response.data.data;
};
const cellText = (value: unknown) =>
  value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
function Choice({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormControl disabled={disabled}>
      <FormLabel id={id}>{label}</FormLabel>
      <RadioGroup aria-labelledby={id} value={value} onChange={event => onChange(event.target.value)} row>
        {options.map(([option, name]) => (
          <FormControlLabel key={option} value={option} control={<Radio />} label={name} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
function MetricSelect({
  id,
  label,
  value,
  metrics,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  metrics: Metric[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select labelId={`${id}-label`} id={id} label={label} value={value} onChange={event => onChange(event.target.value)}>
        <MenuItem value="">지표를 선택하세요</MenuItem>
        {value && !metrics.some(metric => String(metric.id) === value) && (
          <MenuItem value={value} disabled>
            사용할 수 없는 지표
          </MenuItem>
        )}
        {metrics.map(metric => (
          <MenuItem key={metric.id} value={String(metric.id)}>
            {metric.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function DashboardEditContent() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [past, setPast] = useState<Array<{ title: string; items: Item[] }>>([]);
  const [future, setFuture] = useState<Array<{ title: string; items: Item[] }>>([]);
  const [newMetricId, setNewMetricId] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    window.matchMedia?.('(max-width: 599px)').matches ? 'mobile' : 'desktop',
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<Preview | null>(null);
  const displayPreview = preview ?? layoutPreview;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [reloadDialog, setReloadDialog] = useState(false);
  const [reload, setReload] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const sequence = useRef(0);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const headings = useRef<Record<string, HTMLHeadingElement | null>>({});
  const invalidate = (layoutOnly = false) => {
    sequence.current += 1;
    request.current?.abort();
    setPreview(null);
    if (!layoutOnly) setLayoutPreview(null);
    if (!conflict) setError('');
  };
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('대시보드 불러오는 중…');
    setEditor(null);
    setPreview(null);
    setLayoutPreview(null);
    setError('');
    setConflict(false);
    setNewMetricId('');
    setSelectedKey('');
    setAiPrompt('');
    setAnnouncement('');
    setPast([]);
    setFuture([]);
    void get(`/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor`, undefined, { signal: abort.signal })
      .then(unwrap<Editor>)
      .then(result => {
        if (token !== sequence.current) return;
        setEditor(result);
        setTitle(result.title);
        setItems(result.items);
      })
      .catch(() => {
        if (token === sequence.current) setError('편집 정보를 불러오지 못했습니다. 잠시 후 다시 불러와 주세요.');
      })
      .finally(() => {
        if (token === sequence.current) {
          pending.current = false;
          setBusy('');
        }
      });
    return () => {
      sequence.current += 1;
      abort.abort();
      pending.current = false;
    };
  }, [dashboardId, reload]);
  const dimensions = (chart: Item['chart']) =>
    (editor?.profile.columns ?? []).filter(
      column => chart !== 'line' || (column.temporal && /^(DATE|TIMESTAMP)/i.test(column.type)),
    );
  const valid =
    !!title.trim() &&
    title.trim().length <= 300 &&
    items.length >= 1 &&
    items.length <= 6 &&
    items.every(
      item =>
        item.title.trim() &&
        item.title.trim().length <= 300 &&
        item.unit.length <= 12 &&
        Number.isInteger(item.decimalPlaces) &&
        item.decimalPlaces >= 0 &&
        item.decimalPlaces <= 6 &&
        (item.kind === 'existing' ||
          item.kind === 'draft' ||
          (item.metricAvailable !== false &&
            editor?.metrics.some(metric => metric.id === item.metricId) &&
            (item.chart === 'number' || dimensions(item.chart).some(column => column.name === item.dimension)))),
    );
  const change = (nextTitle: string, nextItems: Item[], layoutOnly = false) => {
    if (pending.current || (nextTitle === title && JSON.stringify(nextItems) === JSON.stringify(items))) return;
    invalidate(layoutOnly);
    setPast(current => [...current.slice(-49), { title, items }]);
    setFuture([]);
    setTitle(nextTitle);
    setItems(nextItems);
  };
  const restore = (redo: boolean) => {
    if (pending.current) return;
    const history = redo ? future : past;
    const previous = history[history.length - 1];
    if (!previous) return;
    const content = (values: Item[]) => JSON.stringify(values.map(item => ({ ...item, layouts: undefined })));
    invalidate(previous.title === title && content(previous.items) === content(items));
    if (redo) {
      setFuture(history.slice(0, -1));
      setPast(current => [...current.slice(-49), { title, items }]);
    } else {
      setPast(history.slice(0, -1));
      setFuture(current => [...current, { title, items }]);
    }
    setTitle(previous.title);
    setItems(previous.items);
    setAnnouncement(
      redo
        ? '편집을 다시 실행했습니다. 미리보기를 다시 확인해 주세요.'
        : '편집을 되돌렸습니다. 미리보기를 다시 확인해 주세요.',
    );
  };
  const duplicate = (index: number) => {
    if (pending.current || items.length >= 6) return;
    const original = items[index];
    if (!original) return;
    const key = crypto.randomUUID();
    const copy = {
      ...original,
      key,
      layouts: undefined,
      title: original.title.slice(0, 296) + ' 복사',
      ...(original.kind === 'existing' ? { copyOf: original.copyOf ?? original.key } : {}),
    };
    change(title, [...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    setAnnouncement(`${original.title} 차트를 복제했습니다.`);
    requestAnimationFrame(() => headings.current[key]?.focus());
  };
  const patch = (key: string, changes: Partial<Item>) => {
    if (pending.current) return;
    change(
      title,
      items.map(item =>
        item.key === key
          ? {
              ...item,
              ...changes,
              ...(item.layouts?.desktop && (changes.width !== undefined || changes.height !== undefined)
                ? {
                    layouts: {
                      ...item.layouts,
                      desktop: {
                        ...item.layouts.desktop,
                        x: Math.min(item.layouts.desktop.x, 12 - (changes.width ?? item.layouts.desktop.w)),
                        w: changes.width ?? item.layouts.desktop.w,
                        h: changes.height ?? item.layouts.desktop.h,
                      },
                    },
                  }
                : {}),
            }
          : item,
      ),
      Object.keys(changes).length === 1 && changes.layouts !== undefined,
    );
  };
  const selectMetric = (key: string, metricId: string) => {
    const metric = editor?.metrics.find(value => String(value.id) === metricId);
    if (!metric) return;
    patch(key, {
      copyOf: undefined,
      definition: undefined,
      kind: 'metric',
      metricId: metric.id,
      metricAvailable: true,
      chart: 'number',
      dimension: undefined,
    });
  };
  const add = () => {
    if (pending.current || items.length >= 6) return;
    const metric = editor?.metrics.find(value => String(value.id) === newMetricId);
    if (!metric) return;
    const key = crypto.randomUUID();
    change(title, [
      ...items,
      {
        key,
        kind: 'metric',
        metricId: metric.id,
        metricAvailable: true,
        title: metric.label,
        chart: 'number',
        unit: metric.definition.unit ?? '',
        decimalPlaces: metric.definition.decimalPlaces ?? 0,
        numberNotation: metric.definition.numberNotation ?? 'plain',
        width: 6,
        height: 3,
      },
    ]);
    setAnnouncement(`${metric.label} 차트를 ${items.length + 1}번째에 추가했습니다.`);
    requestAnimationFrame(() => headings.current[key]?.focus());
  };
  const move = (index: number, direction: number) => {
    if (pending.current) return;
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    change(title, reordered);
    setAnnouncement(`${items[index].title} 차트를 ${next + 1}번째로 이동했습니다. 전체 ${items.length}개입니다.`);
    requestAnimationFrame(() => headings.current[items[index].key]?.focus());
  };
  const remove = (index: number) => {
    if (pending.current || items.length <= 1) return;
    const removed = items[index];
    if (!removed) return;
    const focusTarget = items[index + 1] ?? items[index - 1];
    change(
      title,
      items.filter(item => item.key !== removed.key),
    );
    const token = sequence.current;
    setAnnouncement(`${removed.title} 차트를 삭제했습니다. 전체 ${items.length - 1}개입니다.`);
    requestAnimationFrame(() => {
      if (token === sequence.current) headings.current[focusTarget.key]?.focus();
    });
  };
  const editorBody = () => ({
    title: title.trim(),
    expectedRevision: editor.revision,
    items: items.map(item => ({
      key: item.key,
      kind: item.kind,
      ...(item.layouts ? { layouts: item.layouts } : {}),
      ...(item.kind === 'draft' ? { definition: item.definition } : {}),
      ...(item.copyOf ? { copyOf: item.copyOf } : {}),
      title: item.title.trim(),
      ...(item.kind === 'metric' ? { metricId: item.metricId } : {}),
      chart: item.chart,
      ...(item.kind === 'existing' && item.dimension !== undefined
        ? { dimension: item.dimension }
        : item.chart !== 'number' && item.dimension
        ? { dimension: item.dimension }
        : {}),
      unit: item.unit,
      decimalPlaces: item.decimalPlaces,
      numberNotation: item.numberNotation,
      width: item.width,
      height: item.height,
    })),
  });
  const askAi = async () => {
    if (
      pending.current ||
      !editor ||
      !valid ||
      conflict ||
      !aiPrompt.trim() ||
      !items.some(item => item.key === selectedKey)
    )
      return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy('AI로 선택 블록 수정 중…');
    setError('');
    setPreview(null);
    try {
      const response = await post(
        `/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor/ai`,
        { ...editorBody(), selectedKey, prompt: aiPrompt.trim() },
        { signal: abort.signal },
      );
      if (token !== sequence.current) return;
      const result = unwrap<{ item: Item; preview: Preview }>(response);
      if (
        result.item.key !== selectedKey ||
        result.item.kind !== 'draft' ||
        !validDraft({ databaseId: editor.sourceId, title, explanation: '', widgets: [result.item.definition] }) ||
        result.preview.widgets?.length !== items.length ||
        result.preview.widgets.some(widget => !Array.isArray(widget.datas))
      )
        throw new Error('Invalid AI result');
      // Apply AI through the same history path as a direct edit.
      pending.current = false;
      change(
        title,
        items.map(item => (item.key === selectedKey ? result.item : item)),
      );
      setPreview(result.preview);
      setLayoutPreview(result.preview);
      setAnnouncement('선택 블록의 AI 변경을 미리보기했습니다. 되돌리거나 저장할 수 있습니다.');
    } catch (failure) {
      if (token !== sequence.current) return;
      if ((failure as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true);
        setError('다른 변경이 저장되었습니다. 현재 초안은 유지됩니다. 최신 내용을 다시 불러와 주세요.');
      } else setError('AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.');
    } finally {
      if (token === sequence.current || request.current === abort) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const cancelAi = () => {
    sequence.current += 1;
    request.current?.abort();
    pending.current = false;
    setBusy('');
    setAnnouncement('AI 요청을 취소했습니다. 현재 편집 내용은 유지됩니다.');
  };
  const run = async (save: boolean) => {
    if (pending.current || !editor || !valid || conflict || (save && !preview)) return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy(save ? '대시보드 저장 중…' : '차트 결과 확인 중…');
    setError('');
    if (!save) setPreview(null);
    const body = editorBody();
    try {
      const response = await post(
        `/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor${save ? '' : '/preview'}`,
        body,
        { signal: abort.signal },
      );
      if (token !== sequence.current) return;
      if (save) {
        const result = unwrap<{ id: number; revision: string }>(response);
        if (!Number.isInteger(result.id) || result.id <= 0) throw new Error('Invalid response');
        navigate(`/dashboard/${result.id}`);
      } else {
        const result = unwrap<Preview>(response);
        if (
          !Array.isArray(result.widgets) ||
          result.widgets.length !== items.length ||
          result.widgets.some(widget => !Array.isArray(widget.datas))
        )
          throw new Error('Invalid preview');
        setPreview(result);
        setLayoutPreview(result);
      }
    } catch (failure) {
      if (token !== sequence.current) return;
      if ((failure as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true);
        setError(
          '다른 변경이 저장되어 최신 상태와 충돌했습니다.' +
            ' 현재 편집 내용은 유지됩니다. 최신 내용을 다시 불러온 뒤 편집해 주세요.',
        );
      } else if (
        typeof (failure as any)?.response?.data?.message === 'string' &&
        (failure as any).response.data.message.startsWith('블록 배치')
      )
        setError((failure as any).response.data.message);
      else
        setError(
          save
            ? '저장하지 못했습니다. 편집 내용은 유지됩니다. 연결 상태를 확인하고 저장을 다시 시도해 주세요.'
            : '미리보기를 불러오지 못했습니다. 편집 내용은 유지됩니다. 미리보기를 다시 시도해 주세요.',
        );
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        p: { xs: 2, md: 4 },
        pb: 10,
        minWidth: 0,
      }}
    >
      <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
        차트·배치 편집
      </Typography>
      <Typography sx={{ mb: 2 }} color="text.secondary">
        지표와 차트의 표시·순서·크기를 조정하세요. 결과를 미리 확인한 뒤 저장합니다.
      </Typography>
      <Typography role="status" aria-live="polite">
        {busy || announcement}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      <Button disabled={!!busy} onClick={() => (editor ? setReloadDialog(true) : setReload(value => value + 1))}>
        최신 내용 다시 불러오기
      </Button>
      {editor && (
        <>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ my: 2 }}>
            <Button disabled={!!busy || past.length === 0} onClick={() => restore(false)}>
              되돌리기
            </Button>
            <Button disabled={!!busy || future.length === 0} onClick={() => restore(true)}>
              다시 실행
            </Button>
          </Stack>
          <Alert severity="info" sx={{ my: 2 }}>
            데이터 소스: {editor.profile.name} · 이 대시보드의 데이터 소스는 변경할 수 없습니다.
          </Alert>
          <Box sx={{ my: 2 }}>
            <Choice
              id="layout-mode"
              label="편집할 화면 폭"
              value={layoutMode}
              options={[
                ['mobile', '모바일'],
                ['tablet', '태블릿'],
                ['desktop', '데스크톱'],
              ]}
              onChange={value => setLayoutMode(value as LayoutMode)}
            />
          </Box>
          <Box component="section" aria-label="AI 블록 편집" sx={{ my: 2, minWidth: 0 }}>
            <Typography sx={{ mb: 1, fontSize: 13, overflowWrap: 'anywhere' }}>
              {items.find(item => item.key === selectedKey)?.title
                ? `선택 블록: ${items.find(item => item.key === selectedKey)?.title}`
                : '블록의 AI로 수정 버튼을 눌러 대상을 선택하세요.'}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                fullWidth
                label="AI 변경 요청"
                value={aiPrompt}
                disabled={!!busy}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
                onChange={event => setAiPrompt(event.target.value)}
              />
              <Button
                variant="outlined"
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                disabled={!!busy || !valid || conflict || !aiPrompt.trim() || !items.some(item => item.key === selectedKey)}
                onClick={() => void askAi()}
              >
                AI 변경 미리보기
              </Button>
              {busy === 'AI로 선택 블록 수정 중…' && <Button onClick={cancelAi}>AI 요청 취소</Button>}
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1, fontSize: 12 }}>
              AI 변경은 현재 분석에만 적용됩니다. 저장 지표의 계산식은 바뀌지 않습니다.
            </Typography>
          </Box>
          <Box component="fieldset" disabled={!!busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <TextField
              disabled={!!busy}
              slotProps={{ htmlInput: { maxLength: 300 } }}
              label="대시보드 제목"
              fullWidth
              value={title}
              onChange={event => {
                change(event.target.value, items);
              }}
              sx={{ mb: 3 }}
            />
            <Stack spacing={3}>
              {items.map((item, index) => {
                const label = `${index + 1}번 차트`;
                const choices = dimensions(item.chart);
                return (
                  <Card key={item.key} variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
                    <Typography
                      component="h2"
                      variant="h6"
                      tabIndex={-1}
                      ref={(element: HTMLHeadingElement | null) => {
                        headings.current[item.key] = element;
                      }}
                      sx={{ mb: 2 }}
                    >
                      {label} · {item.title || '제목 없음'}
                    </Typography>
                    <Box component="details" sx={{ mb: 2 }}>
                      <Typography component="summary" sx={{ cursor: 'pointer', fontSize: 13 }}>
                        {' '}
                        {label} 설정{' '}
                      </Typography>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        {item.kind === 'existing' && (
                          <Alert severity="info">
                            기존 차트의 계산과 SQL은 서버에서 그대로 보존합니다. 제목·숫자 표시·크기·순서는 바꿀 수 있습니다.
                            저장된 지표를 선택하면 지표 차트로 전환하여 차트 종류도 바꿀 수 있습니다.
                          </Alert>
                        )}
                        {item.kind === 'metric' && item.metricAvailable === false && (
                          <Alert severity="warning">기존 지표를 사용할 수 없습니다. 다른 저장된 지표를 선택해 주세요.</Alert>
                        )}
                        <MetricSelect
                          disabled={!!busy}
                          id={`metric-${item.key}`}
                          label={`${label} 저장된 지표${item.kind === 'existing' ? '로 전환' : ''}`}
                          value={item.metricId ? String(item.metricId) : ''}
                          metrics={editor.metrics}
                          onChange={value => selectMetric(item.key, value)}
                        />
                        <TextField
                          disabled={!!busy}
                          fullWidth
                          slotProps={{ htmlInput: { maxLength: 300 } }}
                          label={`${label} 제목`}
                          value={item.title}
                          onChange={event => patch(item.key, { title: event.target.value })}
                        />
                        <Choice
                          id={`chart-${item.key}`}
                          label={`${label} 종류`}
                          value={item.chart}
                          options={[
                            ['number', '숫자'],
                            ['bar', '막대'],
                            ['line', '선'],
                          ]}
                          disabled={!!busy || item.kind !== 'metric'}
                          onChange={value => patch(item.key, { chart: value as Item['chart'], dimension: undefined })}
                        />
                        {item.kind === 'metric' && item.chart !== 'number' && (
                          <FormControl fullWidth disabled={!!busy}>
                            <InputLabel id={`dimension-${item.key}-label`}>
                              {label} {item.chart === 'line' ? '날짜 열' : '범주 열'}
                            </InputLabel>
                            <Select
                              labelId={`dimension-${item.key}-label`}
                              label={`${label} ${item.chart === 'line' ? '날짜 열' : '범주 열'}`}
                              value={item.dimension ?? ''}
                              onChange={event => patch(item.key, { dimension: event.target.value })}
                            >
                              <MenuItem value="">열을 선택하세요</MenuItem>
                              {choices.map(column => (
                                <MenuItem key={column.name} value={column.name}>
                                  {column.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        {item.kind === 'metric' && item.chart !== 'number' && choices.length === 0 && (
                          <Alert severity="warning">
                            이 종류에 사용할 열이 없습니다.{' '}
                            {item.chart === 'line' ? 'DATE/TIMESTAMP 날짜 열이 필요합니다.' : '범주 열이 필요합니다.'} 다른
                            차트 종류를 선택하세요.
                          </Alert>
                        )}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <TextField
                            disabled={!!busy}
                            fullWidth
                            slotProps={{ htmlInput: { maxLength: 12 } }}
                            helperText="최대 12자"
                            label={`${label} 단위`}
                            value={item.unit}
                            onChange={event => patch(item.key, { unit: event.target.value })}
                          />
                          <FormControl fullWidth disabled={!!busy}>
                            <InputLabel id={`decimals-${item.key}-label`}>{label} 소수 자릿수</InputLabel>
                            <Select
                              labelId={`decimals-${item.key}-label`}
                              label={`${label} 소수 자릿수`}
                              value={item.decimalPlaces}
                              onChange={event => patch(item.key, { decimalPlaces: Number(event.target.value) })}
                            >
                              {Array.from({ length: 7 }, (_, number) => (
                                <MenuItem key={number} value={number}>
                                  {number}자리
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Stack>
                        <Choice
                          disabled={!!busy}
                          id={`notation-${item.key}`}
                          label={`${label} 숫자 표시`}
                          value={item.numberNotation}
                          options={[
                            ['plain', '일반 숫자'],
                            ['compact', '축약 숫자'],
                          ]}
                          onChange={value => patch(item.key, { numberNotation: value as Item['numberNotation'] })}
                        />
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {(['x', 'y', 'w', 'h'] as const).map(field => (
                            <TextField
                              key={field}
                              type="number"
                              label={`${label} ${{ mobile: '모바일', tablet: '태블릿', desktop: '데스크톱' }[layoutMode]} ${
                                { x: '가로 위치', y: '세로 위치', w: '너비', h: '높이' }[field]
                              }`}
                              value={
                                Number.isNaN(item.layouts?.[layoutMode]?.[field])
                                  ? ''
                                  : item.layouts?.[layoutMode]?.[field] ?? ''
                              }
                              disabled={!!busy}
                              sx={{ width: 100 }}
                              slotProps={{
                                htmlInput: {
                                  min: field === 'w' || field === 'h' ? 1 : 0,
                                  max: field === 'x' || field === 'w' ? columns[layoutMode] : field === 'h' ? 50 : 1000,
                                },
                              }}
                              onChange={event => {
                                const defaults = item.layouts?.[layoutMode] ?? {
                                  x: 0,
                                  y: 0,
                                  w: columns[layoutMode],
                                  h: item.height,
                                };
                                patch(item.key, {
                                  layouts: {
                                    ...item.layouts,
                                    [layoutMode]: {
                                      ...defaults,
                                      [field]: event.target.value === '' ? NaN : Number(event.target.value),
                                    },
                                  },
                                });
                              }}
                            />
                          ))}
                        </Stack>
                        {!item.layouts && (
                          <>
                            <Choice
                              disabled={!!busy}
                              id={`width-${item.key}`}
                              label={`${label} 너비`}
                              value={String(item.width)}
                              options={[
                                ['6', '절반'],
                                ['12', '전체'],
                              ]}
                              onChange={value => patch(item.key, { width: Number(value) as Item['width'] })}
                            />
                            <Choice
                              disabled={!!busy}
                              id={`height-${item.key}`}
                              label={`${label} 높이`}
                              value={String(item.height)}
                              options={[
                                ['3', '작게'],
                                ['5', '보통'],
                                ['7', '크게'],
                              ]}
                              onChange={value => patch(item.key, { height: Number(value) as Item['height'] })}
                            />
                          </>
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Button disabled={index === 0} aria-label={`${label} 위로 이동`} onClick={() => move(index, -1)}>
                        위로 이동
                      </Button>
                      <Button
                        disabled={index === items.length - 1}
                        aria-label={`${label} 아래로 이동`}
                        onClick={() => move(index, 1)}
                      >
                        아래로 이동
                      </Button>
                      <Button
                        disabled={!!busy}
                        aria-pressed={selectedKey === item.key}
                        aria-label={`${label} AI로 수정`}
                        onClick={() => setSelectedKey(item.key)}
                      >
                        AI로 수정
                      </Button>
                      <Button
                        disabled={!!busy || items.length >= 6}
                        aria-label={`${label} 복제`}
                        onClick={() => duplicate(index)}
                      >
                        복제
                      </Button>
                      <Button disabled={items.length <= 1} aria-label={`${label} 삭제`} onClick={() => remove(index)}>
                        삭제
                      </Button>
                    </Stack>
                  </Card>
                );
              })}
              <Card variant="outlined" sx={{ p: 2, minWidth: 0 }}>
                <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                  차트 추가 · {items.length}/6개
                </Typography>
                <Stack spacing={2}>
                  <MetricSelect
                    disabled={!!busy}
                    id="new-metric"
                    label="추가할 저장된 지표"
                    value={newMetricId}
                    metrics={editor.metrics}
                    onChange={setNewMetricId}
                  />
                  <Button variant="outlined" disabled={!newMetricId || items.length >= 6} onClick={add}>
                    지표 차트 추가
                  </Button>
                  {editor.metrics.length === 0 && (
                    <Typography>
                      이 데이터 소스에 저장된 지표가 없습니다. 기존 차트의 표시와 배치는 편집할 수 있습니다.
                    </Typography>
                  )}
                </Stack>
              </Card>
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 3 }}>
            <Button variant="outlined" disabled={!!busy || !valid || conflict} onClick={() => void run(false)}>
              변경 결과 미리보기
            </Button>
            <Button variant="contained" disabled={!!busy || !preview || !valid || conflict} onClick={() => void run(true)}>
              변경 내용 저장
            </Button>
          </Stack>
          {!preview && (
            <Typography color="text.secondary">변경 후 미리보기를 성공적으로 확인해야 저장할 수 있습니다.</Typography>
          )}
          {displayPreview && (
            <Box component="section" aria-label="변경 결과 미리보기">
              <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
                미리보기 · {title}
              </Typography>
              {!preview && (
                <Typography color="text.secondary">
                  배치 변경 후 미리보기를 다시 확인해 주세요. 표시 값은 직전 서버 결과입니다.
                </Typography>
              )}
              <BlockLayoutCanvas
                items={items}
                mode={layoutMode}
                saved={displayPreview.responsiveLayouts}
                disabled={!!busy || conflict}
                onCommit={rects =>
                  change(
                    title,
                    items.map(item => ({ ...item, layouts: { ...item.layouts, [layoutMode]: rects[item.key] } })),
                    true,
                  )
                }
              >
                {displayPreview.widgets.map((widget, index) => (
                  <Card
                    key={items[index].key}
                    variant="outlined"
                    sx={{
                      p: 2,
                      minWidth: 0,
                    }}
                  >
                    <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                      {widget.title}
                    </Typography>
                    <Box sx={{ height: widget.type === 'BOARD_NUMERIC' ? 64 : items[index].height * 60, minWidth: 0 }}>
                      {widget.type === 'BOARD_NUMERIC' ? (
                        <NumericBoard option={analysisOptions(widget)} dataSet={widget.datas} />
                      ) : (
                        <WidgetViewer
                          title=""
                          widgetType={widget.type}
                          widgetOption={analysisOptions(widget)}
                          dataSet={widget.datas}
                          isInvalidData={false}
                        />
                      )}
                    </Box>
                    {widget.type === 'BOARD_NUMERIC' && (
                      <MetricTrend
                        trend={widget.trend}
                        unavailable={widget.trendUnavailable}
                        title={widget.title}
                        prefix={widget.prefix}
                        suffix={widget.suffix}
                        decimalPlaces={widget.decimalPlaces ?? 0}
                      />
                    )}
                    <Box
                      tabIndex={0}
                      role="region"
                      aria-label={`${index + 1}번 차트 정확한 결과 표`}
                      sx={{
                        overflowX: 'auto',
                        '& th, & td': {
                          p: 1,
                          textAlign: 'left',
                          borderBottom: 1,
                          borderColor: 'divider',
                          overflowWrap: 'anywhere',
                        },
                      }}
                    >
                      <table style={{ width: '100%' }}>
                        <caption>서버 계산 결과 · 원래 값 {widget.datas.length}행</caption>
                        <thead>
                          <tr>
                            {widget.categoryField && <th scope="col">{widget.categoryField}</th>}
                            <th scope="col">{widget.valueField}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {widget.datas.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {widget.categoryField && <td>{cellText(row[widget.categoryField])}</td>}
                              <td>{cellText(row[widget.valueField])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {widget.datas.length === 0 && <Typography>결과가 없습니다.</Typography>}
                    </Box>
                  </Card>
                ))}
              </BlockLayoutCanvas>
            </Box>
          )}
        </>
      )}
      <Dialog open={reloadDialog} onClose={() => setReloadDialog(false)} aria-labelledby="reload-title">
        <DialogTitle id="reload-title">최신 내용을 다시 불러올까요?</DialogTitle>
        <DialogContent>
          저장하지 않은 현재 편집 내용과 미리보기를 버리고 최신 저장 내용을 불러옵니다. 이 작업은 현재 초안을 되돌릴 수
          없습니다.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReloadDialog(false)}>편집 계속하기</Button>
          <Button
            onClick={() => {
              setReloadDialog(false);
              setReload(value => value + 1);
            }}
          >
            편집 내용 버리고 다시 불러오기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function DashboardEdit() {
  return (
    <AnalysisUiProvider>
      <DashboardEditContent />
    </AnalysisUiProvider>
  );
}
