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
import { AnalysisUiProvider, analysisToggleSx } from '@/components/analysis/AnalysisUi';
import { validDraft, errorMessage } from '../dashboardPreview';
import BlockLayoutCanvas, { validLayout } from './BlockLayoutCanvas';
import { recoveryPlan, RECOVERY_DASHBOARD_TITLE_KEY } from './editorRecovery';
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
  savedDefinition?: Item['definition'];
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
type Preview = {
  widgets: PreviewWidget[];
  draft?: { widgets: Item['definition'][] };
  responsiveLayouts?: Record<LayoutMode, Record<string, Rect>>;
};
const unwrap = <T,>(response: { data: { status: string; data: T } }): T => {
  if (response.data.status !== 'SUCCESS' || !response.data.data) throw new Error('Invalid response');
  return response.data.data;
};
const uncertainSave = (failure: unknown) => {
  const status = (failure as { response?: { status?: number } })?.response?.status;
  return !status || status >= 500;
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
  const [targetCandidates, setTargetCandidates] = useState<string[]>([]);
  const [targetChoiceKey, setTargetChoiceKey] = useState('');
  const [batchSummary, setBatchSummary] = useState<Array<{ key: string; label: string }>>([]);
  const [aiEditMode, setAiEditMode] = useState<'auto' | 'content' | 'layout'>('auto');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    window.matchMedia?.('(max-width: 599px)').matches ? 'mobile' : 'desktop',
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<Preview | null>(null);
  const displayPreview = preview ?? layoutPreview;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [unknownSave, setUnknownSave] = useState(false);
  const [latest, setLatest] = useState<Editor | null>(null);
  const [saveAttempt, setSaveAttempt] = useState<{ title: string; items: Item[] } | null>(null);
  const recoveryRequired = conflict || unknownSave;
  const recovery =
    editor && latest
      ? recoveryPlan({ title: editor.title, items: editor.items }, saveAttempt ?? { title: title.trim(), items }, {
          title: latest.title,
          items: latest.items,
        })
      : null;
  const [reloadDialog, setReloadDialog] = useState(false);
  const [reload, setReload] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const sequence = useRef(0);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const headings = useRef<Record<string, HTMLHeadingElement | null>>({});
  const clearTarget = () => {
    if (targetChoiceKey && selectedKey === targetChoiceKey) setSelectedKey('');
    setTargetCandidates([]);
    setTargetChoiceKey('');
  };
  const invalidate = (layoutOnly = false) => {
    clearTarget();
    sequence.current += 1;
    request.current?.abort();
    setPreview(null);
    setBatchSummary([]);
    setLatest(null);
    setSaveAttempt(null);
    if (!layoutOnly) setLayoutPreview(null);
    if (!recoveryRequired) setError('');
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
    setUnknownSave(false);
    setLatest(null);
    setSaveAttempt(null);
    setNewMetricId('');
    setSelectedKey('');
    setTargetCandidates([]);
    setTargetChoiceKey('');
    setAiPrompt('');
    setBatchSummary([]);
    setAiEditMode('auto');
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
  const validItems = (values: Item[], nextTitle = title) =>
    !!nextTitle.trim() &&
    nextTitle.trim().length <= 300 &&
    values.length >= 1 &&
    values.length <= 6 &&
    values.every(
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
  const valid = validItems(items);
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
  const editorBody = (values = items) => ({
    title: title.trim(),
    expectedRevision: editor.revision,
    items: values.map(item => ({
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
  // UC-017: preserve canonical SQL when editor materialization changes kind after save.
  const freezeAttempt = (values: Item[], result: Preview | null) => ({
    title: title.trim(),
    items: values.map((item, index) => ({
      ...item,
      ...(result?.draft?.widgets?.[index] ? { savedDefinition: result.draft.widgets[index] } : {}),
    })),
  });
  const checkSavedState = async () => {
    if (pending.current || !editor || !recoveryRequired) return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy('저장 상태 확인 중…');
    setAnnouncement('');
    setLatest(null);
    try {
      const result = unwrap<Editor>(
        await get(`/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor`, undefined, { signal: abort.signal }),
      );
      if (token !== sequence.current) return;
      if (
        result.dashboardId !== editor.dashboardId ||
        result.sourceId !== editor.sourceId ||
        typeof result.revision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(result.revision) ||
        !Array.isArray(result.items) ||
        !result.items.length ||
        result.items.some(item => !item?.key) ||
        new Set(result.items.map(item => item.key)).size !== result.items.length
      )
        throw new Error('Invalid recovery state');
      setLatest(result);
      setError('');
      setAnnouncement('최신 저장 상태를 확인했습니다. 현재 초안은 유지됩니다.');
    } catch {
      if (token === sequence.current)
        setError('저장 상태를 확인하지 못했습니다. 초안과 질문은 유지됩니다. 상태 확인을 다시 시도해 주세요.');
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const applyRecovery = () => {
    if (pending.current || !latest || !recovery || recovery.structural || recovery.same) return;
    sequence.current += 1;
    request.current?.abort();
    const confirmed = recoveryPlan(
      { title: editor.title, items: editor.items },
      saveAttempt ?? { title: title.trim(), items },
      { title: latest.title, items: latest.items },
      recovery.conflicts.map(value => value.key ?? RECOVERY_DASHBOARD_TITLE_KEY),
    );
    if (
      !validItems(confirmed.merged.items, confirmed.merged.title) ||
      Object.keys(columns).some(mode => {
        const rects = confirmed.merged.items.map(item => item.layouts?.[mode]);
        return rects.every(Boolean) && !validLayout(rects, columns[mode]);
      })
    ) {
      setError('합친 초안의 표시나 배치를 확인해 주세요. 현재 초안은 유지됩니다.');
      return;
    }
    setEditor(latest);
    setTitle(confirmed.merged.title);
    setItems(confirmed.merged.items);
    setPast([]);
    setFuture([]);
    setPreview(null);
    setLayoutPreview(null);
    setBatchSummary([]);
    clearTarget();
    setSelectedKey('');
    setLatest(null);
    setSaveAttempt(null);
    setConflict(false);
    setUnknownSave(false);
    setError('');
    setAnnouncement('최신 저장본에 내 변경을 합쳤습니다. 전체 미리보기를 다시 확인한 뒤 저장해 주세요.');
  };
  const askAi = async () => {
    if (
      pending.current ||
      !editor ||
      !valid ||
      recoveryRequired ||
      !aiPrompt.trim() ||
      (aiEditMode !== 'auto' && !items.some(item => item.key === selectedKey))
    )
      return;
    pending.current = true;
    let token = sequence.current;
    let abort = new AbortController();
    request.current = abort;
    setBusy('AI로 요청 확인 중…');
    setBatchSummary([]);
    setTargetCandidates([]);
    setAnnouncement('');
    setError('');
    setPreview(null);
    let saving = false;
    try {
      const response = await post(
        `/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor/ai`,
        {
          ...editorBody(),
          selectedKey,
          ...(targetChoiceKey ? { targetChoiceKey } : {}),
          prompt: aiPrompt.trim(),
          editMode: aiEditMode,
          layoutMode,
        },
        { timeout: 180000, signal: abort.signal },
      );
      if (token !== sequence.current) return;
      const result = unwrap<{
        item?: Item;
        changes?: Array<{ targetKey: string; editMode: 'content' | 'layout'; item: Item }>;
        preview?: Preview;
        editMode?: string;
        saveRequested?: boolean;
        publicationRequested?: true;
        targetKey?: string;
        targetCandidates?: Array<{ key: string; title: string; position: number }>;
      }>(response);
      if (
        result.publicationRequested !== undefined &&
        (result.publicationRequested !== true ||
          aiEditMode !== 'auto' ||
          result.saveRequested !== true ||
          result.editMode === 'clarify')
      )
        throw new Error('Invalid publication intent');
      if (aiEditMode === 'auto' && result.editMode === 'clarify' && result.saveRequested !== true) {
        if (result.targetCandidates !== undefined) {
          const candidates = result.targetCandidates;
          if (
            result.saveRequested !== false ||
            !Array.isArray(candidates) ||
            !candidates.length ||
            candidates.length > 6 ||
            candidates.length > items.length ||
            candidates.some(value => !value || typeof value !== 'object' || typeof value.key !== 'string') ||
            new Set(candidates.map(value => value.key)).size !== candidates.length ||
            candidates.some(value => !items.some(item => item.key === value.key))
          )
            throw new Error('Invalid target candidates');
          clearTarget();
          setTargetCandidates(candidates.map(value => value.key));
          setAnnouncement(
            targetChoiceKey
              ? '선택한 대상을 확인하지 못했습니다. 후보를 다시 선택하거나 질문에 번호·제목을 명시해 주세요. 아직 변경하거나 저장하지 않았습니다.'
              : '수정할 블록을 선택한 뒤 같은 질문을 다시 실행해 주세요. 아직 변경하거나 저장하지 않았습니다.',
          );
          return;
        }
        clearTarget();
        setAnnouncement(
          '차트 내용이나 배치 중 한 가지 변경을 구체적으로 질문해 주세요. 저장하려면 현재 초안 저장을 명시해 주세요.',
        );
        return;
      }
      const appliedMode = result.editMode ?? (aiEditMode === 'auto' ? undefined : aiEditMode);
      const shouldSave = aiEditMode === 'auto' && result.saveRequested === true;
      if (
        !['content', 'layout', 'save', 'batch'].includes(appliedMode) ||
        (aiEditMode !== 'auto' && appliedMode !== aiEditMode) ||
        (appliedMode === 'save' && !shouldSave)
      )
        throw new Error('Invalid AI intent');
      if (
        !Array.isArray(result.preview?.widgets) ||
        result.preview.widgets.length !== items.length ||
        result.preview.widgets.some(widget => !Array.isArray(widget.datas))
      )
        throw new Error('Invalid AI preview');
      let nextItems = items;
      let batchChanged = true;
      if (appliedMode === 'batch') {
        // UC-016: validate every result before applying a single history entry.
        const changes = result.changes;
        if (
          aiEditMode !== 'auto' ||
          typeof result.saveRequested !== 'boolean' ||
          !Array.isArray(changes) ||
          changes.length < 2 ||
          changes.length > 6 ||
          changes.length > items.length ||
          changes.some(value => !value || typeof value.targetKey !== 'string') ||
          new Set(changes.map(value => value.targetKey)).size !== changes.length
        )
          throw new Error('Invalid batch changes');
        for (const value of changes) {
          if (
            !items.some(item => item.key === value.targetKey) ||
            !value.item ||
            value.item.key !== value.targetKey ||
            !['content', 'layout'].includes(value.editMode) ||
            (value.editMode === 'layout'
              ? !value.item.layouts?.[layoutMode] || !validLayout([value.item.layouts[layoutMode]], columns[layoutMode])
              : value.item.kind !== 'draft' ||
                !validDraft({ databaseId: editor.sourceId, title, explanation: '', widgets: [value.item.definition] }))
          )
            throw new Error('Invalid batch result');
        }
        nextItems = items.map(original => {
          const value = changes.find(change => change.targetKey === original.key);
          if (!value) return original;
          if (value.editMode === 'layout')
            return { ...original, layouts: { ...original.layouts, [layoutMode]: value.item.layouts[layoutMode] } };
          const changed = value.item;
          return {
            ...original,
            kind: 'draft',
            copyOf: undefined,
            title: changed.title,
            chart: changed.chart,
            unit: changed.unit,
            decimalPlaces: changed.decimalPlaces,
            numberNotation: changed.numberNotation,
            definition: changed.definition,
          };
        });
        if (!validItems(nextItems)) throw new Error('Invalid batch presentation');
        batchChanged = JSON.stringify(nextItems) !== JSON.stringify(items);
        pending.current = false;
        change(
          title,
          nextItems,
          changes.every(value => value.editMode === 'layout'),
        );
        setSelectedKey('');
        setBatchSummary(
          batchChanged
            ? changes.map(value => ({
                key: value.targetKey,
                label: `${items.findIndex(item => item.key === value.targetKey) + 1}번 · ${
                  nextItems.find(item => item.key === value.targetKey).title
                } · ${value.editMode === 'layout' ? '배치' : '내용'}`,
              }))
            : [],
        );
      } else if (appliedMode !== 'save') {
        const targetKey = aiEditMode === 'auto' ? result.targetKey ?? selectedKey : selectedKey;
        if (!items.some(item => item.key === targetKey)) throw new Error('Invalid target');
        if (
          !result.item ||
          result.item.key !== targetKey ||
          (appliedMode === 'layout'
            ? result.editMode !== 'layout' ||
              !result.item.layouts?.[layoutMode] ||
              !validLayout([result.item.layouts[layoutMode]], columns[layoutMode])
            : result.item.kind !== 'draft' ||
              !validDraft({ databaseId: editor.sourceId, title, explanation: '', widgets: [result.item.definition] }))
        )
          throw new Error('Invalid AI result');
        nextItems = items.map(item =>
          item.key !== targetKey
            ? item
            : appliedMode === 'layout'
            ? { ...item, layouts: { ...item.layouts, [layoutMode]: result.item.layouts[layoutMode] } }
            : result.item,
        );
        if (!validItems(nextItems)) throw new Error('Invalid AI presentation');
        // UC-014: history updates state asynchronously; persist the validated result, never stale state.
        pending.current = false;
        change(title, nextItems, appliedMode === 'layout');
        setSelectedKey(targetKey);
      }
      setPreview(result.preview);
      setLayoutPreview(result.preview);
      if (shouldSave) {
        pending.current = true;
        token = sequence.current;
        abort = new AbortController();
        request.current = abort;
        saving = true;
        setSaveAttempt(freezeAttempt(nextItems, result.preview));
        setLatest(null);
        setBusy('질문한 변경 결과 저장 중…');
        setAnnouncement('서버 미리보기를 확인했습니다. 명시한 저장 요청을 실행합니다.');
        const saved = unwrap<{ id: number; revision: string }>(
          await post(`/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/editor`, editorBody(nextItems), {
            signal: abort.signal,
          }),
        );
        if (token !== sequence.current) return;
        if (!Number.isInteger(saved.id) || saved.id !== editor.dashboardId) throw new Error('Invalid save response');
        if (result.publicationRequested === true) {
          if (typeof saved.revision !== 'string' || !/^[a-f0-9]{64}$/.test(saved.revision))
            throw new Error('Invalid saved revision');
          navigate(`/dashboard/${saved.id}/publication?savedRevision=${saved.revision}`);
        } else navigate(`/dashboard/${saved.id}`);
      } else {
        setAnnouncement(
          appliedMode === 'batch'
            ? batchChanged
              ? `${result.changes.length}개 블록의 변경을 전체 미리보기했습니다. 한 번에 되돌리거나 저장할 수 있습니다.`
              : '요청 결과가 현재 초안과 같습니다. 변경 없이 전체 미리보기했습니다.'
            : `선택 블록의 ${
                appliedMode === 'layout' ? '배치' : '내용'
              } AI 변경을 미리보기했습니다. 되돌리거나 저장할 수 있습니다.`,
        );
      }
    } catch (failure) {
      if (token !== sequence.current) return;
      setAnnouncement('');
      if (saving) setLatest(null);
      if ((failure as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true);
        setError('다른 변경이 저장되었습니다. 현재 초안은 유지됩니다. 최신 내용을 다시 불러와 주세요.');
      } else {
        if (saving && uncertainSave(failure)) setUnknownSave(true);
        const payload = (
          failure as {
            response?: {
              data?: {
                batchFailure?: { stage?: string; position?: number };
                data?: { batchFailure?: { stage?: string; position?: number } };
              };
            };
          }
        )?.response?.data;
        const detail = payload?.data?.batchFailure ?? payload?.batchFailure;
        const batchFailure = detail && ['target', 'change', 'preview'].includes(detail.stage);
        setError(
          !saving && batchFailure
            ? `${
                Number.isInteger(detail.position) && detail.position >= 1 && detail.position <= items.length
                  ? `${detail.position}번 블록의 `
                  : ''
              }${
                detail.stage === 'target'
                  ? '수정 대상을 확인하지 못했습니다'
                  : detail.stage === 'preview'
                  ? '전체 미리보기에 실패했습니다'
                  : '변경에 실패했습니다'
              }. 모든 변경을 적용하지 않았습니다. 질문을 수정한 뒤 다시 실행해 주세요.`
            : saving && !uncertainSave(failure)
            ? '저장 요청이 거절되었습니다. 초안은 유지됩니다. 입력과 미리보기를 확인해 주세요.'
            : saving
            ? '변경 결과는 미리보기했지만 저장 결과를 확인하지 못했습니다. 현재 초안은 유지됩니다. 최신 저장 상태를 확인한 뒤 다시 시도해 주세요.'
            : 'AI 변경을 적용하지 못했습니다. 현재 편집 내용은 유지됩니다. 다시 요청해 주세요.',
        );
      }
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
    clearTarget();
    setError('');
    setAnnouncement('AI 요청을 취소했습니다. 현재 편집 내용은 유지됩니다.');
  };
  const run = async (save: boolean) => {
    if (pending.current || !editor || !valid || recoveryRequired || (save && !preview)) return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy(save ? '대시보드 저장 중…' : '차트 결과 확인 중…');
    setAnnouncement('');
    setError('');
    if (save) {
      setSaveAttempt(freezeAttempt(items, preview));
      setLatest(null);
    }
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
        if (!Number.isInteger(result.id) || result.id !== editor.dashboardId) throw new Error('Invalid response');
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
      } else if (errorMessage(failure).startsWith('블록 배치')) setError(errorMessage(failure));
      else {
        if (save && uncertainSave(failure)) setUnknownSave(true);
        setError(
          save && !uncertainSave(failure)
            ? '저장 요청이 거절되었습니다. 초안은 유지됩니다. 입력과 미리보기를 확인해 주세요.'
            : save
            ? '저장 결과를 확인하지 못했습니다. 현재 초안은 유지됩니다. 저장 상태를 확인한 뒤 다시 시도해 주세요.'
            : '미리보기를 불러오지 못했습니다. 편집 내용은 유지됩니다. 미리보기를 다시 시도해 주세요.',
        );
      }
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
      {recoveryRequired && editor && (
        <Box
          component="section"
          aria-label="저장 복구"
          sx={{ my: 2, p: 1.5, border: '1px solid #e2e8f0', borderRadius: '4px', minWidth: 0 }}
        >
          <Typography sx={{ fontSize: 12, mb: 1, overflowWrap: 'anywhere' }}>
            {conflict
              ? '최신 저장본과 충돌했습니다. 내 초안과 질문을 보존했습니다.'
              : '저장 여부가 아직 확실하지 않습니다. 같은 요청을 바로 다시 저장하지 않습니다.'}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" disabled={!!busy} onClick={() => void checkSavedState()}>
              저장 상태 확인
            </Button>
            {recovery?.same && (
              <Button disabled={!!busy} onClick={() => navigate(`/dashboard/${editor.dashboardId}`)}>
                저장된 화면 보기
              </Button>
            )}
            {recovery && !recovery.same && !recovery.structural && (
              <Button variant="outlined" disabled={!!busy} onClick={applyRecovery}>
                {recovery.conflicts.length ? '충돌 항목에 내 변경 사용' : '내 변경과 최신본 합치기'}
              </Button>
            )}
          </Stack>
          {recovery && (
            <Typography sx={{ mt: 1, fontSize: 12, overflowWrap: 'anywhere' }}>
              {recovery.same
                ? '현재 초안과 같은 내용이 이미 저장되어 있습니다. 다시 저장할 필요가 없습니다.'
                : recovery.structural
                ? '블록 구성이나 순서가 달라 자동으로 합칠 수 없습니다. 초안은 유지됩니다. 최신본을 확인한 뒤 다시 편집해 주세요.'
                : recovery.conflicts.length
                ? '아래 항목은 양쪽에서 다르게 수정했습니다. 내 변경을 사용하면 해당 항목의 최신 변경을 대체합니다. 나머지 최신 변경은 유지합니다.'
                : '서로 다른 항목의 변경을 합칠 수 있습니다. 합친 뒤 전체 미리보기를 다시 확인하세요.'}
            </Typography>
          )}
          {recovery &&
            !recovery.structural &&
            recovery.conflicts.map((value, index) => (
              <Typography key={index} sx={{ mt: 0.5, fontSize: 12, overflowWrap: 'anywhere' }}>
                {value.label}
              </Typography>
            ))}
        </Box>
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
              disabled={!!busy}
              label="편집할 화면 폭"
              value={layoutMode}
              options={[
                ['mobile', '모바일'],
                ['tablet', '태블릿'],
                ['desktop', '데스크톱'],
              ]}
              onChange={value => {
                clearTarget();
                setLayoutMode(value as LayoutMode);
              }}
            />
          </Box>
          <Box component="section" aria-label="AI 블록 편집" sx={{ my: 2, minWidth: 0 }}>
            <Typography sx={{ mb: 1, fontSize: 13, overflowWrap: 'anywhere' }}>
              {items.find(item => item.key === selectedKey)?.title
                ? `선택 블록: ${items.find(item => item.key === selectedKey)?.title}`
                : '번호나 정확한 제목으로 질문하세요. 여러 블록은 각각의 대상과 변경을 적어 주세요.'}
            </Typography>
            <Box component="details" sx={{ mb: 1 }}>
              <Typography component="summary" sx={{ cursor: 'pointer', fontSize: 12 }}>
                변경 목적 직접 지정
              </Typography>
              <Choice
                id="ai-edit-mode"
                label="AI 변경 목적"
                value={aiEditMode}
                disabled={!!busy}
                options={[
                  ['auto', '자동'],
                  ['content', '차트 내용'],
                  ['layout', '배치'],
                ]}
                onChange={value => {
                  clearTarget();
                  setAiEditMode(value as 'auto' | 'content' | 'layout');
                }}
              />
            </Box>
            {aiEditMode === 'layout' && (
              <Typography color="text.secondary" sx={{ my: 1, fontSize: 12 }}>
                선택한 화면 폭에서 이 블록의 위치·크기만 변경합니다. 예: 오른쪽으로 한 칸 옮겨 줘.
              </Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                fullWidth
                label="AI 변경 요청"
                value={aiPrompt}
                disabled={!!busy}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
                onChange={event => {
                  clearTarget();
                  setAiPrompt(event.target.value);
                }}
              />
              <Button
                variant="outlined"
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                disabled={
                  !!busy ||
                  !valid ||
                  recoveryRequired ||
                  !aiPrompt.trim() ||
                  (aiEditMode !== 'auto' && !items.some(item => item.key === selectedKey))
                }
                onClick={() => void askAi()}
              >
                AI 요청 실행
              </Button>
              {busy === 'AI로 요청 확인 중…' && <Button onClick={cancelAi}>AI 요청 취소</Button>}
            </Stack>
            {targetCandidates.length > 0 && (
              <Box component="section" aria-label="수정 대상 후보" sx={{ mt: 1, minWidth: 0 }}>
                <Typography sx={{ mb: 1, fontSize: 12 }}>대상을 선택한 뒤 요청을 다시 실행하세요.</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {items.map(
                    (item, index) =>
                      targetCandidates.includes(item.key) && (
                        <Button
                          key={item.key}
                          disabled={!!busy}
                          variant="outlined"
                          aria-pressed={targetChoiceKey === item.key}
                          title={`${index + 1}번 · ${item.title}`}
                          sx={{ ...analysisToggleSx, minWidth: 0, maxWidth: '100%' }}
                          onClick={() => {
                            setTargetChoiceKey(item.key);
                            setSelectedKey(item.key);
                          }}
                        >
                          <Box
                            component="span"
                            sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {index + 1}번 · {item.title}
                          </Box>
                        </Button>
                      ),
                  )}
                </Stack>
              </Box>
            )}
            {batchSummary.length > 0 && (
              <Box component="section" aria-label="전체 변경 요약" sx={{ mt: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, mb: 0.5 }}>
                  전체 변경 {batchSummary.length}개 · 함께 저장할 수 있습니다
                </Typography>
                {batchSummary.map(value => (
                  <Typography key={value.key} title={value.label} sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
                    {value.label}
                  </Typography>
                ))}
              </Box>
            )}
            <Typography color="text.secondary" sx={{ mt: 1, fontSize: 12 }}>
              자동 모드에서 저장을 명시하면 미리보기 후 현재 분석에 저장합니다. 저장과 게시를 함께 요청하면 게시 미리보기로
              이어집니다. 링크 공개는 게시 화면에서 실행합니다. 변경만 요청하면 미리보기로 끝납니다. 저장 지표의 계산식은
              바뀌지 않습니다.
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
                        onClick={() => {
                          clearTarget();
                          setSelectedKey(item.key);
                        }}
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
            <Button variant="outlined" disabled={!!busy || !valid || recoveryRequired} onClick={() => void run(false)}>
              변경 결과 미리보기
            </Button>
            <Button
              variant="contained"
              disabled={!!busy || !preview || !valid || recoveryRequired}
              onClick={() => void run(true)}
            >
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
                disabled={!!busy || recoveryRequired}
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
