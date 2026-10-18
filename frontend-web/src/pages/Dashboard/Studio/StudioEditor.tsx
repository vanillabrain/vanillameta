import StudioReport from './StudioReport';
import { useTranslation } from 'react-i18next';
import StudioSaveRecovery from './StudioSaveRecovery';
import {
  StudioPendingSave,
  readStudioPendingSave,
  writeStudioPendingSave,
  removeStudioPendingSave,
} from './studioPendingSave';
import { NativeSelect } from '@/components/ui/native-select';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { mergeStudioDraft } from './studioDraftMerge';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useMinWidth } from '@/components/PageViewBox';
import { Link as RouterLink, useParams } from 'react-router-dom';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import { formatMetric, localizedMetricSuffix } from '@/utils/formatMetric';
import MetricTrend from '../Components/MetricTrend';
import StudioCanvas, { studioItemHeight } from './StudioCanvas';
import StudioConversation from './StudioConversation';
import StudioFilterPanel from './StudioFilterPanel';
import StudioDateRangePanel from './StudioDateRangePanel';
import StudioPublish from './StudioPublish';
import { StudioRunContext, StudioRunResult } from './studioRunTransport';
import StudioInspector from './StudioInspector';
import StudioEvidence from './StudioEvidence';
import StudioShell, { StudioDesignDocument, StudioProductContext } from './StudioShell';
import { applyStudioOperation, createStudioState, studioReducer } from './studioReducer';
import { studioOrderOperations } from './studioEditing';
import { StudioDefinitions } from './studioAdapter';
import {
  studioAssert,
  studioClone,
  studioFilterDraftKey,
  studioFilterKey,
  studioFilterSummary,
  studioDateRangeKey,
  studioDateRangeSummary,
  validateStudioDocument,
} from './studioDocument';
import {
  fetchStudioDashboard,
  isStudioApiError,
  prepareStudioDashboard,
  saveStudioDashboard,
  studioRequestId,
  StudioFilterChoice,
  StudioLoadResult,
  StudioPreview,
  StudioPreviewRow,
  StudioPrepareResult,
  StudioSaveRequest,
} from './studioApi';
import {
  isTemporaryStudioId,
  STUDIO_BREAKPOINTS,
  STUDIO_COLUMNS,
  StudioBlock,
  StudioBreakpoint,
  StudioDisplay,
  StudioDocumentV1,
  StudioDateRange,
  StudioFilter,
  StudioOperation,
  StudioState,
} from './studioTypes';
import './studio.css';
import { studioQuestionKey, readStudioQuestion, writeStudioQuestion, removeStudioQuestion } from './studioQuestionDraft';
import {
  StudioDocumentDraft,
  studioDocumentDraftKey,
  readStudioDocumentDraft,
  writeStudioDocumentDraft,
  removeStudioDocumentDraft,
} from './studioDocumentDraft';

const MAX_STUDIO_BLOCKS = 6;
const scopeKey = (document: Pick<StudioDocumentV1, 'filters' | 'dateRange'>) =>
  JSON.stringify([studioFilterDraftKey(document.filters), studioDateRangeKey(document.dateRange)]);
const TREND_MIN_HEIGHT = 260;
const DISPLAY_FIELDS = ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain', 'presentation'] as const;
const breakpointLabel = (breakpoint: StudioBreakpoint) =>
  breakpoint === 'xs' ? '모바일' : breakpoint === 'md' ? '태블릿' : '데스크톱';

const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, canonical(value[key])]),
      )
    : value;
/** Content comparison without server revision, so a re-applied draft stays dirty against its baseline. */
export const sameStudioDocument = (a: StudioDocumentV1, b: StudioDocumentV1) =>
  JSON.stringify(canonical(withoutRevision(a))) === JSON.stringify(canonical(withoutRevision(b)));
export const withoutRevision = (document: StudioDocumentV1): StudioDocumentV1 => {
  const copy: StudioDocumentV1 = studioClone(document);
  delete copy.revision;
  return copy;
};

/** Resolve the aggregated preview row for one block: stable blockId first, then the shared definition. */
export function resolveBlockPreview(input: {
  block: StudioBlock;
  definitions: StudioDefinitions | null;
  preview: StudioPreview | null;
}): StudioPreviewRow | null {
  const { block, definitions, preview } = input;
  const rows = preview?.widgets;
  if (!Array.isArray(rows) || !rows.length) return null;
  const usable = (row: StudioPreviewRow) =>
    !!row && row.type === block.kind && Array.isArray(row.datas) && Array.isArray(row.fields);
  const byBlock = rows.find(row => usable(row) && typeof row.blockId === 'string' && row.blockId === block.id);
  if (byBlock) return byBlock;
  const definition = definitions?.entries?.[block.definitionKey]?.widget;
  if (!definition) return null;
  return (
    rows.find(
      row =>
        usable(row) &&
        row.type === definition.type &&
        row.sql === definition.sql &&
        row.valueField === definition.valueField &&
        (row.categoryField ?? null) === (definition.categoryField ?? null),
    ) ?? null
  );
}

/** Local display settings win over the server row so the canvas reflects unsaved number changes. */
export function mergeStudioDisplay(row: StudioPreviewRow, display: StudioDisplay): Record<string, any> {
  const merged: Record<string, any> = { ...row };
  for (const key of DISPLAY_FIELDS) if (display[key] !== undefined) merged[key] = display[key];
  return merged;
}

export type StudioReapplyResult = {
  document: StudioDocumentV1;
  addedBlocks: number;
  keptLatestBreakpoints: StudioBreakpoint[];
};

/**
 * Three-way reapply: only the fields this editor actually changed against its own baseline are
 * written onto the latest server document. Untouched remote fields, geometry and definitions stay.
 */
export function reapplyStudioChanges(
  latest: StudioDocumentV1,
  local: StudioDocumentV1,
  baseline: StudioDocumentV1,
): StudioReapplyResult {
  const base = validateStudioDocument(latest);
  const mine = validateStudioDocument(local);
  const origin = validateStudioDocument(baseline);
  studioAssert(
    base.dashboardId === mine.dashboardId && base.dashboardId === origin.dashboardId,
    '다른 대시보드의 변경은 재적용할 수 없습니다.',
  );
  studioAssert(
    base.sourceId === mine.sourceId && base.sourceId === origin.sourceId,
    '다른 데이터 소스의 변경은 재적용할 수 없습니다.',
  );
  const operations: StudioOperation[] = [];
  if (mine.title !== origin.title && mine.title !== base.title)
    operations.push({ type: 'renameDashboard', title: mine.title });
  for (const block of origin.blocks)
    if (
      !mine.blocks.some(candidate => candidate.id === block.id) &&
      base.blocks.some(candidate => candidate.id === block.id)
    )
      operations.push({ type: 'removeBlock', blockId: block.id });
  const originFilterKey = studioFilterKey(origin.filters);
  const localFilterKey = studioFilterKey(mine.filters);
  // A filter edit is a document change like any other: it is re-applied only when this editor made it.
  if (localFilterKey !== originFilterKey && localFilterKey !== studioFilterKey(base.filters))
    operations.push({ type: 'setFilters', filters: studioClone(mine.filters ?? []) });
  if (
    studioDateRangeKey(mine.dateRange) !== studioDateRangeKey(origin.dateRange) &&
    studioDateRangeKey(mine.dateRange) !== studioDateRangeKey(base.dateRange)
  )
    operations.push({ type: 'setDateRange', dateRange: mine.dateRange ?? null });
  let addedBlocks = 0;
  for (const block of mine.blocks) {
    const originBlock = origin.blocks.find(candidate => candidate.id === block.id);
    const target = base.blocks.find(candidate => candidate.id === block.id);
    if (!originBlock) {
      // Blocks I created locally stay temporary IDs until a save assigns server IDs, and they must
      // still point at a definition the latest document knows.
      if (!isTemporaryStudioId(block.id) || target) continue;
      studioAssert(
        base.blocks.some(candidate => candidate.definitionKey === block.definitionKey && candidate.kind === block.kind),
        '복제한 블록의 원본 정의가 최신 내용에 없습니다. 최신 내용을 확인한 뒤 다시 복제해 주세요.',
      );
      operations.push({ type: 'addBlock', block: studioClone(block) });
      addedBlocks += 1;
      continue;
    }
    if (!target) continue;
    if (
      target.kind !== block.kind ||
      target.definitionKey !== block.definitionKey ||
      originBlock.kind !== block.kind ||
      originBlock.definitionKey !== block.definitionKey
    )
      continue;
    const patch: Record<string, any> = {};
    if (block.title !== originBlock.title && block.title !== target.title) patch.title = block.title;
    if (block.description !== originBlock.description && block.description !== target.description)
      patch.description = block.description;
    const displayPatch: Record<string, any> = {};
    for (const key of DISPLAY_FIELDS)
      if (block.display[key] !== originBlock.display[key] && block.display[key] !== target.display[key])
        displayPatch[key] = block.display[key];
    if (Object.keys(displayPatch).length) patch.display = displayPatch;
    if (Object.keys(patch).length) operations.push({ type: 'updateBlock', blockId: block.id, patch });
  }
  let document = operations.reduce(applyStudioOperation, studioClone(base));
  const keptLatestBreakpoints: StudioBreakpoint[] = [];
  for (const breakpoint of STUDIO_BREAKPOINTS) {
    const current = document.layouts[breakpoint];
    const candidate = current.map(item => {
      const mineItem = mine.layouts[breakpoint].find(candidate => candidate.id === item.id);
      const originItem = origin.layouts[breakpoint].find(candidate => candidate.id === item.id);
      if (!mineItem || !originItem) return item;
      const moved =
        mineItem.x !== originItem.x ||
        mineItem.y !== originItem.y ||
        mineItem.w !== originItem.w ||
        mineItem.h !== originItem.h;
      if (!moved) return item;
      if (item.x === mineItem.x && item.y === mineItem.y && item.w === mineItem.w && item.h === mineItem.h) return item;
      return { ...item, x: mineItem.x, y: mineItem.y, w: mineItem.w, h: mineItem.h };
    });
    const changed = candidate.some(
      (item, index) =>
        item.x !== current[index].x ||
        item.y !== current[index].y ||
        item.w !== current[index].w ||
        item.h !== current[index].h,
    );
    if (!changed) continue;
    try {
      document = validateStudioDocument({ ...document, layouts: { ...document.layouts, [breakpoint]: candidate } });
    } catch {
      keptLatestBreakpoints.push(breakpoint);
    }
  }
  return { document, addedBlocks, keptLatestBreakpoints };
}

function StudioStateScreen({
  title,
  description,
  loading,
  onRetry,
}: {
  title: string;
  description: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="vm-studio flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      {loading ? <Spinner /> : <Alert severity="warning">{description}</Alert>}
      <h1 className="text-xl font-semibold">{title}</h1>
      {loading && <p>{description}</p>}
      {onRetry && <Button onClick={onRetry}>다시 시도</Button>}
    </div>
  );
}

/** Replace payload: the server document is always the new baseline; a draft only seeds the canvas. */
type StudioReplacePayload = StudioLoadResult & { draft?: StudioDocumentV1; previewDocument?: StudioDocumentV1 };
/** The server document stays the baseline; a re-applied draft is seeded as an unsaved change. */
export const studioWorkspaceSeed = (payload: StudioReplacePayload): StudioState => {
  const created = createStudioState(payload.document);
  if (!payload.draft) return created;
  return {
    ...created,
    present: payload.draft,
    past: [],
    future: [],
    saveState: sameStudioDocument(payload.draft, created.savedBaseline) ? 'clean' : 'dirty',
  };
};

/** Protected product route: real document, real preview, explicit save with conflict recovery. */
export default function StudioEditor() {
  const { dashboardId } = useParams();
  const id = Number(dashboardId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [token, setToken] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [result, setResult] = useState<StudioReplacePayload | null>(null);
  const loadGeneration = useRef(0);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [saveRecovery, setSaveRecovery] = useState<{ record: StudioPendingSave; key: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!validId) return;
    loadGeneration.current += 1;
    const generation = loadGeneration.current;
    setStatus('loading');
    setError('');
    try {
      const next = await fetchStudioDashboard(id);
      const documentKey = await studioDocumentDraftKey(id);
      const pending = readStudioPendingSave(documentKey, id);
      if (generation !== loadGeneration.current) return;
      setStorageKey(documentKey);
      setSaveRecovery(pending ? { record: pending, key: documentKey } : null);
      setResult(next);
      setStatus('ready');
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setResult(null);
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Studio 문서를 불러오지 못했습니다.');
    }
  }, [id, validId]);

  useEffect(() => {
    load();
    return () => {
      // UC039: older routes/retries cannot replace the current saved-document view.
      loadGeneration.current += 1;
    };
  }, [load]);

  const replace = useCallback((next: StudioReplacePayload) => {
    setResult(next);
    setStatus('ready');
    setToken(current => current + 1);
  }, []);

  if (!validId)
    return <StudioStateScreen title="대시보드를 확인할 수 없습니다" description="주소의 대시보드 번호를 확인해 주세요." />;
  if (status === 'loading' || (result && result.document.dashboardId !== id))
    return (
      <StudioStateScreen
        title="Studio를 준비하는 중입니다"
        description="저장된 배치와 데이터 미리보기를 불러옵니다."
        loading
      />
    );
  if (status === 'error' || !result)
    return <StudioStateScreen title="Studio를 열지 못했습니다" description={error} onRetry={load} />;
  if (saveRecovery)
    return (
      <StudioSaveRecovery
        key={id}
        dashboardId={id}
        title={result.document.title}
        documentKey={saveRecovery.key}
        record={saveRecovery.record}
        onResolved={latest => {
          setSaveRecovery(null);
          replace(latest);
        }}
        onDraft={load}
      />
    );
  return (
    <StudioWorkspace
      key={token}
      dashboardId={id}
      initial={result}
      onReplace={replace}
      onCheckSave={load}
      storageKey={storageKey}
    />
  );
}

type WorkspaceProps = {
  dashboardId: number;
  initial: StudioReplacePayload;
  onReplace: (next: StudioReplacePayload) => void;
  onCheckSave: () => void;
  storageKey: string | null;
};

function StudioWorkspace({ dashboardId, initial, onReplace, onCheckSave, storageKey }: WorkspaceProps) {
  const { i18n } = useTranslation();
  const [conversationInput, setConversationInput] = useState('');
  const questionKey = useRef<string | null>(null);
  const [questionReady, setQuestionReady] = useState(false);
  const [questionRecovery, setQuestionRecovery] = useState<string | null>(null);
  const [questionStorageError, setQuestionStorageError] = useState(false);
  useEffect(() => {
    let current = true;
    studioQuestionKey(dashboardId)
      .then(key => {
        if (!current) return;
        questionKey.current = key;
        setQuestionRecovery(readStudioQuestion(key));
        setQuestionReady(true);
      })
      .catch(() => {
        if (current) setQuestionReady(true);
      });
    return () => {
      current = false;
    };
  }, [dashboardId]);
  useEffect(() => {
    if (!questionReady || questionRecovery !== null) return;
    const saved = writeStudioQuestion(questionKey.current, conversationInput);
    setQuestionStorageError(!!conversationInput.trim() && !saved);
  }, [conversationInput, questionReady, questionRecovery]);
  const [state, dispatch] = useReducer(studioReducer, initial, studioWorkspaceSeed);
  const [definitions, setDefinitions] = useState<StudioDefinitions>(initial.definitions);
  const [preview, setPreview] = useState<StudioPreview | null>(initial.preview);
  const [previewError, setPreviewError] = useState<string | null>(initial.previewError);
  const [message, setMessage] = useState('블록을 선택해 내용·순서·크기를 편집하고, 저장을 누르면 서버에 반영됩니다.');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<StudioLoadResult | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const conflictReturnFocus = useRef<HTMLElement | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [creationPublication, setCreationPublication] = useState<{ dashboardId: number; revision: string } | null>(null);
  const [conflictError, setConflictError] = useState('');
  /** Exact body of the in-flight save: a retry resends it verbatim, including its pinned source version. */
  const pendingRequest = useRef<StudioSaveRequest | null>(null);
  const [sourceRevision, setSourceRevision] = useState(initial.sourceRevision);

  /** AI rows keep the confirmed scope they belong to: a later filter change can never reuse them. */
  const [aiRows, setAiRows] = useState<{ scope: string; rows: Record<string, StudioPreviewRow> }>({
    scope: '',
    rows: {},
  });
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterMessage, setFilterMessage] = useState<string | null>(null);
  /** Scope the server confirmed for the rows on screen. Null means no confirmed query at all. */
  const [previewScope, setPreviewScope] = useState<{
    key: string;
    filters: StudioFilter[];
    dateRange?: StudioDateRange;
  } | null>(
    initial.preview
      ? {
          key: scopeKey(initial.previewDocument ?? initial.document),
          filters: (initial.previewDocument ?? initial.document).filters ?? [],
          dateRange: (initial.previewDocument ?? initial.document).dateRange,
        }
      : null,
  );
  const confirmedScope = useRef(previewScope);
  confirmedScope.current = previewScope;
  /** Keeps async callbacks on the latest document without re-creating them on every edit. */
  const live = useRef({ document: state.present, revision: state.serverRevision, source: sourceRevision });
  live.current = { document: state.present, revision: state.serverRevision, source: sourceRevision };
  const prepare = useRef<{
    generation: number;
    controller: AbortController | null;
    attempted: string;
    intent: 'history' | 'apply';
  }>({
    generation: 0,
    controller: null,
    attempted: scopeKey(initial.previewDocument ?? initial.document),
    intent: 'history',
  });
  const editClock = useRef({ document: state.present, generation: 0 });
  if (editClock.current.document !== state.present) {
    editClock.current = { document: state.present, generation: editClock.current.generation + 1 };
  }
  const documentDraftKey = useRef<string | null>(storageKey);
  const documentDraftLive = useRef(true);
  const [documentDraftReady, setDocumentDraftReady] = useState(false);
  const [documentRecovery, setDocumentRecovery] = useState<StudioDocumentDraft | null>(null);
  const [documentRecoveryBusy, setDocumentRecoveryBusy] = useState(false);
  const documentRecoveryPending = useRef(false);
  const [documentRecoveryError, setDocumentRecoveryError] = useState('');
  const [documentStorageError, setDocumentStorageError] = useState(false);
  const [documentRecoveryLatest, setDocumentRecoveryLatest] = useState<StudioLoadResult | null>(null);
  const [documentConflictConsent, setDocumentConflictConsent] = useState(false);
  const [documentRecoveryNeedsLatest, setDocumentRecoveryNeedsLatest] = useState(false);
  useEffect(() => {
    let current = true;
    documentDraftLive.current = true;
    studioDocumentDraftKey(dashboardId)
      .then(key => {
        if (!current) return;
        documentDraftKey.current = key;
        if (!initial.draft) setDocumentRecovery(readStudioDocumentDraft(key, dashboardId));
        setDocumentDraftReady(true);
      })
      .catch(() => {
        if (current) setDocumentDraftReady(true);
      });
    return () => {
      current = false;
      documentDraftLive.current = false;
    };
  }, [dashboardId]);
  useEffect(() => {
    if (!documentDraftReady || documentRecovery || state.pendingSave) return;
    const ok =
      state.saveState === 'clean'
        ? removeStudioDocumentDraft(documentDraftKey.current)
        : writeStudioDocumentDraft(documentDraftKey.current, {
            version: 2,
            baseline: withoutRevision(state.savedBaseline),
            updatedAt: Date.now(),
            baseRevision: state.serverRevision ?? '',
            sourceRevision,
            document: withoutRevision(state.present),
          });
    setDocumentStorageError(state.saveState !== 'clean' && !ok);
  }, [
    documentDraftReady,
    documentRecovery,
    state.present,
    state.savedBaseline,
    state.saveState,
    state.serverRevision,
    state.pendingSave,
    saving,
    sourceRevision,
  ]);
  const recoveryNeedsMerge =
    !!documentRecovery && (documentRecoveryNeedsLatest || documentRecovery.baseRevision !== state.serverRevision);
  const recoveryMerge =
    documentRecovery?.version === 2 && documentRecoveryLatest
      ? mergeStudioDraft(documentRecoveryLatest.document, documentRecovery.document, documentRecovery.baseline)
      : null;
  const recoveryContextReady =
    !!documentRecovery &&
    state.saveState === 'clean' &&
    !state.pendingSave &&
    !saving &&
    documentRecovery.sourceRevision === sourceRevision;
  const canRestoreDocument = recoveryContextReady && (!recoveryNeedsMerge || documentRecovery?.version === 2);
  const recoveryBlocked = !!recoveryMerge?.blocked.length;
  const restoreDocument = async () => {
    if (
      !canRestoreDocument ||
      !documentRecovery ||
      documentRecoveryPending.current ||
      recoveryBlocked ||
      (recoveryMerge?.conflicts.length && !documentConflictConsent)
    )
      return;
    documentRecoveryPending.current = true;
    setDocumentRecoveryBusy(true);
    setDocumentRecoveryError('');
    const generation = editClock.current.generation;
    const revision = state.serverRevision;
    const assertCurrent = () => {
      if (!documentDraftLive.current) return false;
      if (editClock.current.generation !== generation || live.current.revision !== revision)
        throw new Error('확인 중 현재 편집이 바뀌었습니다. 보관 초안과 현재 편집은 유지했습니다.');
      return true;
    };
    try {
      if (recoveryNeedsMerge && !documentRecoveryLatest) {
        const latest = await fetchStudioDashboard(dashboardId);
        if (!assertCurrent()) return;
        if (latest.sourceRevision !== documentRecovery.sourceRevision)
          throw new Error('데이터 소스 기준이 바뀌어 병합할 수 없습니다. 보관 초안은 유지했습니다.');
        setDocumentConflictConsent(false);
        setDocumentRecoveryLatest(latest);
        return;
      }
      const latest = documentRecoveryLatest ?? initial;
      const prepared = await prepareStudioDashboard(dashboardId, {
        expectedRevision: latest.document.revision,
        expectedSourceRevision: latest.sourceRevision,
        document: recoveryMerge?.document ?? documentRecovery.document,
      });
      if (!assertCurrent()) return;
      onReplace({
        ...latest,
        preview: prepared.preview,
        previewError: null,
        draft: prepared.document,
        previewDocument: prepared.document,
      });
    } catch (cause) {
      if (documentDraftLive.current) {
        if (isStudioApiError(cause) && cause.kind === 'conflict') {
          setDocumentRecoveryNeedsLatest(true);
          setDocumentRecoveryLatest(null);
          setDocumentConflictConsent(false);
        }
        setDocumentRecoveryError(
          cause instanceof Error ? cause.message : '초안을 다시 확인하지 못했습니다. 보관 내용은 유지했습니다.',
        );
      }
    } finally {
      documentRecoveryPending.current = false;
      if (documentDraftLive.current) setDocumentRecoveryBusy(false);
    }
  };

  // Breakpoints follow the window, not the canvas: an open panel must not silently change the batch.
  const desktop = useMinWidth(1200);
  const tablet = useMinWidth(600);
  const breakpoint: StudioBreakpoint = desktop ? 'lg' : tablet ? 'md' : 'xs';
  useEffect(() => {
    dispatch({ type: 'breakpoint', breakpoint });
  }, [breakpoint]);

  const applyOperations = (operations: StudioOperation[]) => {
    if (!operations.length) return false;
    try {
      operations.reduce(applyStudioOperation, state.present);
      dispatch({ type: 'applyBatch', operations });
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '편집을 적용하지 못했습니다. 기존 내용을 유지했습니다.');
      return false;
    }
  };
  const operation = (next: StudioOperation) => applyOperations([next]);
  const nextTemporaryId = () => {
    try {
      return 'new:' + studioRequestId();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '새 블록 ID를 만들지 못했습니다.');
      return null;
    }
  };
  const duplicateBlock = (sourceId: string, suffix: string) => {
    const template =
      state.present.blocks.find(block => block.id === sourceId) ??
      state.savedBaseline.blocks.find(block => block.id === sourceId);
    const id = nextTemporaryId();
    if (!template || !id) return false;
    const title = (suffix + template.title).slice(0, 300);
    return applyOperations([
      state.present.blocks.some(block => block.id === template.id)
        ? { type: 'duplicateBlock', blockId: template.id, newId: id }
        : { type: 'addBlock', block: { ...studioClone(template), id } },
      { type: 'updateBlock', blockId: id, patch: { title } },
    ]);
  };

  const refreshPreview = async () => {
    try {
      const next = await fetchStudioDashboard(dashboardId);
      setDefinitions(next.definitions);
      setPreview(next.preview);
      setPreviewError(next.previewError);
      setSourceRevision(next.sourceRevision);
      setAiRows({ scope: '', rows: {} });
      setPreviewScope(
        next.preview
          ? { key: scopeKey(next.document), filters: next.document.filters ?? [], dateRange: next.document.dateRange }
          : null,
      );
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : '저장은 완료됐지만 미리보기를 새로 불러오지 못했습니다.');
    }
  };

  const cancelPending = () => {
    if (!state.pendingSave) return;
    onCheckSave();
  };

  const loadLatest = async (reason: string) => {
    try {
      const latest = await fetchStudioDashboard(dashboardId);
      setConflictError('');
      setConflict(latest);
      setConflictOpen(true);
      setMessage(reason + ' 내 편집 내용은 그대로 보존했습니다.');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '최신 내용을 불러오지 못했습니다.');
    }
  };

  /**
   * One preview request per confirmed scope. A superseded request is aborted, its answer is dropped,
   * and the previous preview keeps its own scope label instead of borrowing the new filters.
   */
  const prepareScope = useCallback(
    async (
      filters: StudioFilter[],
      intent: 'history' | 'apply',
      dateRange: StudioDateRange | null | undefined = live.current.document.dateRange,
    ): Promise<StudioPrepareResult | null> => {
      const requested = scopeKey({ filters, dateRange: dateRange ?? undefined });
      prepare.current.attempted = requested;
      prepare.current.intent = intent;
      const generation = prepare.current.generation + 1;
      prepare.current.generation = generation;
      prepare.current.controller?.abort();
      const controller = new AbortController();
      prepare.current.controller = controller;
      setFilterBusy(true);
      setFilterError(null);
      let prepared: StudioPrepareResult;
      try {
        prepared = await prepareStudioDashboard(
          dashboardId,
          {
            expectedRevision: live.current.revision,
            expectedSourceRevision: live.current.source,
            document: applyStudioOperation(applyStudioOperation(live.current.document, { type: 'setFilters', filters }), {
              type: 'setDateRange',
              dateRange: dateRange ?? null,
            }),
          },
          { signal: controller.signal },
        );
      } catch (cause) {
        if (prepare.current.generation !== generation || controller.signal.aborted) return null;
        if (isStudioApiError(cause) && cause.kind === 'conflict') {
          setDocumentRecoveryNeedsLatest(true);
          await loadLatest(cause.message);
          return null;
        }
        setFilterError(cause instanceof Error ? cause.message : '필터 조건으로 다시 조회하지 못했습니다.');
        setFilterMessage(null);
        return null;
      } finally {
        if (prepare.current.generation === generation) setFilterBusy(false);
      }
      if (prepare.current.generation !== generation) return null;
      // A history-driven query is accepted only while the document still asks for that scope, so a
      // late answer for a superseded undo/redo step can never relabel the rows on screen.
      if (intent === 'history' && scopeKey(live.current.document) !== requested) return null;
      setPreview(prepared.preview);
      setPreviewError(null);
      // Rows rendered from an AI draft belong to the previous scope and must not survive a filter change.
      setAiRows({ scope: '', rows: {} });
      setPreviewScope({
        key: scopeKey(prepared.document),
        dateRange: prepared.document.dateRange,
        filters: studioClone(prepared.document.filters ?? []),
      });
      setFilterMessage(
        prepared.document.dateRange
          ? '날짜 범위와 공통 필터를 모든 블록에 적용했습니다. 저장하면 이 조건이 함께 저장됩니다.'
          : (prepared.document.filters ?? []).length
          ? '공통 필터를 모든 블록에 적용했습니다. 저장하면 이 조건이 함께 저장됩니다.'
          : '공통 필터를 해제하고 전체 범위를 다시 조회했습니다.',
      );
      return prepared;
    },
    [dashboardId],
  );

  /** Explicit apply: the document and its history follow the server-confirmed scope, never ahead of it. */
  const applyFilters = async (filters: StudioFilter[]) => {
    setFilterMessage(null);
    const prepared = await prepareScope(filters, 'apply');
    if (!prepared) return;
    try {
      dispatch({ type: 'apply', operation: { type: 'setFilters', filters: prepared.document.filters ?? [] } });
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : '필터 변경을 문서에 반영하지 못했습니다.');
    }
  };

  const applyDateRange = async (dateRange: StudioDateRange | null) => {
    setFilterMessage(null);
    const prepared = await prepareScope(live.current.document.filters ?? [], 'apply', dateRange);
    if (!prepared) return;
    dispatch({ type: 'apply', operation: { type: 'setDateRange', dateRange: prepared.document.dateRange ?? null } });
  };

  const documentFilters = state.present.filters ?? [];
  const documentFilterKey = scopeKey(state.present);
  /** Drops a superseded request so its answer is neither applied nor able to reorder the panel. */
  const cancelPrepare = useCallback(() => {
    prepare.current.generation += 1;
    prepare.current.controller?.abort();
    prepare.current.controller = null;
    setFilterBusy(false);
  }, []);
  // Only a document scope change schedules history work. Busy/preview renders must not cancel it.
  useEffect(() => {
    const filters = live.current.document.filters ?? [];
    if (scopeKey(live.current.document) !== documentFilterKey) return;
    if (confirmedScope.current?.key === documentFilterKey) {
      if (
        prepare.current.controller &&
        prepare.current.intent === 'history' &&
        prepare.current.attempted !== documentFilterKey
      )
        cancelPrepare();
      return;
    }
    if (prepare.current.attempted === documentFilterKey) return;
    void prepareScope(filters, 'history', live.current.document.dateRange);
  }, [documentFilterKey, prepareScope, cancelPrepare]);
  useEffect(
    () => () => {
      prepare.current.generation += 1;
      prepare.current.controller?.abort();
    },
    [],
  );

  const save = async () => {
    if (saving) return;
    const pending = state.pendingSave;
    let request: StudioSaveRequest | null = pending
      ? pendingRequest.current ?? {
          requestId: pending.requestId,
          expectedRevision: pending.baseRevision,
          expectedSourceRevision: sourceRevision,
          document: pending.document,
        }
      : null;
    if (!pending) {
      if (state.saveState === 'clean') return;
      try {
        const requestId = studioRequestId();
        request = {
          requestId,
          expectedRevision: state.serverRevision,
          expectedSourceRevision: sourceRevision,
          document: state.present,
        };
        if (readStudioPendingSave(documentDraftKey.current, dashboardId)) {
          onCheckSave();
          return;
        }
        if (
          !writeStudioDocumentDraft(documentDraftKey.current, {
            version: 2,
            updatedAt: Date.now(),
            baseline: withoutRevision(state.savedBaseline),
            baseRevision: state.serverRevision ?? '',
            sourceRevision,
            document: withoutRevision(state.present),
          }) ||
          !writeStudioPendingSave(documentDraftKey.current, { version: 1, updatedAt: Date.now(), phase: 'pending', request })
        ) {
          setSaveError('저장 확인 기록을 보관하지 못했습니다. 현재 편집을 유지했습니다. 다시 시도해 주세요.');
          return;
        }
        dispatch({ type: 'saveStarted', requestId });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : '저장을 시작하지 못했습니다.');
        return;
      }
    }
    if (!request) return;
    pendingRequest.current = request;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveStudioDashboard(dashboardId, request);
      removeStudioPendingSave(documentDraftKey.current);
      pendingRequest.current = null;
      dispatch({
        type: 'saved',
        requestId: request.requestId,
        revision: String(saved.document.revision),
        idMap: saved.idMap,
      });
      setMessage('서버에 저장했습니다. 이후 편집은 다시 저장해야 반영됩니다.');
      await refreshPreview();
    } catch (error) {
      const apiError = isStudioApiError(error) ? error : null;
      if (apiError && apiError.kind === 'conflict') {
        removeStudioPendingSave(documentDraftKey.current);
        pendingRequest.current = null;
        try {
          dispatch({ type: 'saveFailed', requestId: request.requestId });
        } catch (_ignored) {
          // A conflicting request never started on this client; local edits stay untouched either way.
        }
        await loadLatest(apiError.message);
      } else {
        setSaveError(apiError ? apiError.message : error instanceof Error ? error.message : '저장하지 못했습니다.');
        setMessage('저장하지 못했습니다. 같은 요청으로 다시 시도하면 중복 없이 반영됩니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  const discardLocal = () => {
    if (!conflict) return;
    setConflict(null);
    setConflictOpen(false);
    setMessage('최신 저장 내용을 불러왔습니다. 내 편집 내용은 버렸습니다.');
    onReplace(conflict);
  };

  const reapply = () => {
    if (!conflict) return;
    try {
      const reapplied = reapplyStudioChanges(conflict.document, state.present, state.savedBaseline);
      const draft = withoutRevision(reapplied.document);
      if (sameStudioDocument(draft, conflict.document)) {
        setConflict(null);
        setConflictOpen(false);
        setMessage('최신 내용에 이미 반영되어 있어 재적용할 변경이 없습니다. 최신 내용으로 이어서 편집할 수 있습니다.');
        onReplace(conflict);
        return;
      }
      setConflict(null);
      setConflictOpen(false);
      setMessage(
        '최신 내용 위에 내 변경만 다시 적용했습니다. 저장을 눌러 반영하세요.' +
          (reapplied.addedBlocks ? ' 복제한 블록 ' + reapplied.addedBlocks + '개도 함께 반영했습니다.' : '') +
          (reapplied.keptLatestBreakpoints.length
            ? ' 겹치는 배치는 최신 내용을 유지했습니다(' +
              reapplied.keptLatestBreakpoints.map(breakpointLabel).join(', ') +
              ').'
            : ''),
      );
      onReplace({ ...conflict, draft });
    } catch (error) {
      setConflictError(error instanceof Error ? error.message : '내 변경을 재적용할 수 없습니다.');
    }
  };

  const selected = state.present.blocks.find(block => block.id === state.selectedBlockId) ?? null;
  const ordered = [...state.present.layouts[breakpoint]].sort((a, b) => a.y - b.y || a.x - b.x);
  const geometry = ordered.find(item => item.id === state.selectedBlockId);
  const selectedOrder = ordered.findIndex(item => item.id === state.selectedBlockId);
  const reorder = (direction: -1 | 1) => {
    if (!state.selectedBlockId) return;
    const operations = studioOrderOperations(state.present, breakpoint, state.selectedBlockId, direction);
    if (!operations.length) return;
    if (applyOperations(operations)) setMessage('현재 화면 크기의 블록 순서를 변경했습니다.');
  };

  const renderBlock = (block: StudioBlock) => {
    const confirmed = previewScope?.key ?? '';
    const aiRow = aiRows.scope === confirmed ? aiRows.rows[block.id + '|' + (block.display.timeGrain ?? 'auto')] : undefined;
    const row = aiRow ?? resolveBlockPreview({ block, definitions, preview });
    if (!row)
      return (
        <div role="status" className="px-0.5 py-3 text-sm text-muted-foreground">
          {previewError
            ? '미리보기를 불러오지 못했습니다. 저장은 계속할 수 있습니다.'
            : '이 블록의 데이터를 불러오지 못했습니다.'}
        </div>
      );
    const item = state.present.layouts[breakpoint].find(candidate => candidate.id === block.id);
    const height = studioItemHeight(item ? item.h : 4);
    const compact = height < TREND_MIN_HEIGHT;
    const merged = mergeStudioDisplay(row, block.display);
    merged.suffix = localizedMetricSuffix(merged.suffix, i18n?.resolvedLanguage || i18n?.language);
    const display = {
      prefix: merged.prefix,
      suffix: merged.suffix,
      decimalPlaces: merged.decimalPlaces,
      numberNotation: merged.numberNotation === 'compact' ? ('compact' as const) : ('full' as const),
    };
    // Card padding 18px twice plus the 32px label row: the body is what is genuinely left over.
    const bodyHeight = Math.max(0, height - 68);
    if (block.display.presentation === 'summary' || block.display.presentation === 'table')
      return (
        <StudioReport
          title={block.title}
          description={block.description}
          kind={block.kind}
          presentation={block.display.presentation}
          display={display}
          rows={row.datas}
          valueField={row.valueField}
          categoryField={row.categoryField}
          height={bodyHeight}
          period={studioDateRangeSummary(previewScope?.dateRange)}
          scope={studioFilterSummary(previewScope?.filters ?? [])}
        />
      );
    if (block.kind !== 'BOARD_NUMERIC' && row.datas.length === 0)
      return (
        <div
          role="status"
          className="flex items-center justify-center overflow-auto px-4 text-center text-sm text-muted-foreground"
          style={{ height: bodyHeight }}
        >
          선택한 기간·필터에 해당하는 데이터가 없습니다.
        </div>
      );
    const numericValue = row.datas[0] ? (row.datas[0] as Record<string, any>)[row.valueField] : undefined;
    if (block.kind === 'BOARD_NUMERIC' && compact)
      return (
        <div style={{ display: 'flex', alignItems: 'center', height: bodyHeight, minHeight: 0, overflow: 'hidden' }}>
          <span className="m-0 break-words text-3xl font-semibold leading-tight tabular-nums text-foreground">
            {formatMetric(numericValue, display).text}
          </span>
        </div>
      );
    const option = analysisOptions(merged, display.numberNotation);
    const showTrend = block.kind === 'BOARD_NUMERIC' && !!merged.trend;
    const viewerHeight = Math.max(60, showTrend ? bodyHeight - 150 : bodyHeight);
    return (
      <>
        <div style={{ minWidth: 0, overflow: 'hidden', height: viewerHeight }}>
          <WidgetViewer
            hideHeader
            title=""
            description=""
            widgetType={row.type}
            widgetOption={option}
            dataSet={row.datas}
            isInvalidData={false}
          />
        </div>
        {showTrend && (
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
            <MetricTrend
              trend={merged.trend}
              unavailable={merged.trendUnavailable}
              title={block.title}
              prefix={merged.prefix}
              suffix={merged.suffix}
              decimalPlaces={merged.decimalPlaces ?? 0}
              numberNotation={display.numberNotation}
            />
          </div>
        )}
      </>
    );
  };

  const latestIds = new Set(conflict ? conflict.document.blocks.map(block => block.id) : []);
  const localOnly = state.present.blocks.filter(block => !latestIds.has(block.id)).map(block => block.title);
  const latestOnly = conflict
    ? conflict.document.blocks
        .filter(block => !state.present.blocks.some(local => local.id === block.id))
        .map(block => block.title)
    : [];

  const documentForShell: StudioDesignDocument = {
    title: state.present.title,
    source: '데이터 소스 #' + state.present.sourceId,
    period: studioDateRangeSummary(state.present.dateRange),
    blockTitle: selected ? selected.title : '블록을 선택하세요',
  };

  const banner = (
    <>
      {documentRecovery && (
        <Alert severity="info" className="studio-status-banner">
          <p>이 탭에 미저장 블록·배치 초안이 있습니다. 복구하면 다시 미리보기하며 저장·게시하지 않습니다.</p>
          {!canRestoreDocument && (
            <p>저장본·소스 기준이 다르거나 현재 편집 중입니다. 보관 초안을 자동으로 덮어쓰지 않습니다.</p>
          )}
          {recoveryNeedsMerge && <p>다른 탭에서 저장본이 변경되었습니다. 최신본과 비교한 뒤 내 변경만 합칩니다.</p>}
          {recoveryNeedsMerge && documentRecovery.version === 1 && (
            <p>이전 형식 초안에는 비교 기준이 없습니다. 버전이 다른 초안을 자동 병합할 수 없습니다.</p>
          )}
          {recoveryMerge?.blocked.map((reason, index) => (
            <p key={index}>{reason}</p>
          ))}
          {!!recoveryMerge?.conflicts.length && (
            <div className="mt-2 space-y-2">
              <p>양쪽에서 바뀐 항목입니다. 나머지 최신 변경은 유지합니다.</p>
              <ul className="space-y-2 break-words">
                {recoveryMerge.conflicts.map((item, index) => (
                  <li key={index}>
                    <strong>{item.label}</strong>
                    <br />
                    최신: {item.latest}
                    <br />내 초안: {item.mine}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={documentConflictConsent}
                  disabled={documentRecoveryBusy || !recoveryContextReady}
                  onCheckedChange={checked => setDocumentConflictConsent(checked === true)}
                />
                충돌 항목에 내 초안 사용
              </label>
            </div>
          )}
          {documentRecoveryLatest && !recoveryMerge?.conflicts.length && !recoveryBlocked && (
            <p>서로 다른 항목의 변경을 함께 반영할 수 있습니다.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={
                !canRestoreDocument ||
                documentRecoveryBusy ||
                recoveryBlocked ||
                (!!recoveryMerge?.conflicts.length && !documentConflictConsent)
              }
              onClick={restoreDocument}
            >
              {documentRecoveryBusy
                ? '초안 확인 중…'
                : recoveryNeedsMerge
                ? documentRecoveryLatest
                  ? '병합 미리보기'
                  : '최신본과 초안 비교'
                : '블록 초안 복구'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={documentRecoveryBusy}
              onClick={() => {
                if (!removeStudioDocumentDraft(documentDraftKey.current)) {
                  setDocumentRecoveryError('보관 초안을 지우지 못했습니다. 다시 시도해 주세요.');
                  return;
                }
                setDocumentRecovery(null);
                setDocumentRecoveryLatest(null);
                setDocumentRecoveryNeedsLatest(false);
                setDocumentConflictConsent(false);
                setDocumentRecoveryError('');
              }}
            >
              보관 블록 초안 폐기
            </Button>
          </div>
          {documentRecoveryError && <p role="alert">{documentRecoveryError}</p>}
        </Alert>
      )}
      {documentStorageError && (
        <Alert severity="warning" className="studio-status-banner">
          블록 초안을 이 탭에 보관하지 못했습니다. 현재 편집은 유지되지만 새로고침하면 사라질 수 있습니다.
        </Alert>
      )}
      {questionRecovery !== null && (
        <Alert severity="info" className="studio-status-banner">
          <p>이 탭에 보관한 미전송 질문이 있습니다. 최대 24시간 보관하며 블록 초안과 별도로 복구합니다.</p>
          {conversationInput.trim() && <span>현재 입력을 비우면 보관 질문을 복구할 수 있습니다.</span>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!!conversationInput.trim()}
              onClick={() => {
                setConversationInput(questionRecovery);
                setQuestionRecovery(null);
                dispatch({ type: 'panel', panel: 'ai' });
              }}
            >
              질문 복구
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!removeStudioQuestion(questionKey.current)) {
                  setQuestionStorageError(true);
                  return;
                }
                setQuestionStorageError(false);
                setQuestionRecovery(null);
              }}
            >
              보관 질문 폐기
            </Button>
          </div>
        </Alert>
      )}
      {questionStorageError && (
        <Alert severity="warning" className="studio-status-banner">
          질문 보관 상태를 갱신하지 못했습니다. 현재 입력은 유지되지만 새로고침하면 사라질 수 있습니다.
        </Alert>
      )}
      {previewError && (
        <Alert severity="warning" className="studio-status-banner">
          {previewError}
          <Button variant="ghost" size="sm" onClick={refreshPreview}>
            미리보기 다시 시도
          </Button>
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" className="studio-status-banner">
          {saveError}
          {state.pendingSave ? (
            <Button variant="ghost" size="sm" onClick={cancelPending}>
              저장 결과 확인
            </Button>
          ) : null}
        </Alert>
      )}
      {conflict && !conflictOpen && (
        <Alert severity="warning" className="studio-status-banner">
          다른 곳에서 먼저 저장되었습니다. 내 편집 내용은 보존되어 있습니다.
          <Button variant="ghost" size="sm" onClick={() => setConflictOpen(true)}>
            최신 내용 비교
          </Button>
        </Alert>
      )}
    </>
  );

  const product: StudioProductContext = {
    source: '데이터 소스 #' + state.present.sourceId,
    sourceMeta: '정의 ' + Object.keys(definitions.entries).length + '개 · Studio 문서',
    period: studioDateRangeSummary(state.present.dateRange),
    blockCount: state.present.blocks.length,
    canvasTitle: state.present.title,
    canvasDescription: '블록을 옮기고 수치를 확인한 뒤 저장하세요. 저장 전에는 서버에 반영되지 않습니다.',
    dataLabel: preview ? '실데이터 미리보기' : '미리보기 없음',
    notice:
      state.saveState === 'clean' ? 'Studio 편집 · 저장된 내용과 같습니다' : 'Studio 편집 · 저장되지 않은 변경이 있습니다',
    save: {
      label: saving ? '저장 중…' : '저장',
      // A failed-but-pending request stays retryable even when undo returned to the baseline.
      disabled: saving || (!state.pendingSave && (state.saveState === 'clean' || !state.present.blocks.length)),
      pending: saving,
      status: state.saveState === 'clean' ? '저장됨' : '저장되지 않음',
      onSave: save,
    },
    publish: {
      onOpen: () => {
        setCreationPublication(null);
        setPublishOpen(true);
      },
      disabled: saving || !!state.pendingSave || !!conflict,
    },
    banner,
    aiBlockSummary: state.present.blocks.map(block => block.title).join(' · ') || '아직 블록이 없습니다',
    aiNote: '선택 블록의 변경은 검증 후 초안에만 적용됩니다.',
  };

  const runContext: StudioRunContext = {
    dashboardId,
    document: state.present,
    expectedRevision: state.serverRevision ?? '',
    expectedSourceRevision: sourceRevision,
    clientEditVersion: editClock.current.generation,
    ...(state.selectedBlockId ? { selectedBlockId: state.selectedBlockId } : {}),
  };
  const scopeLabel = previewScope
    ? '화면 반영 · ' +
      (previewScope.dateRange ? studioDateRangeSummary(previewScope.dateRange) + ' · ' : '') +
      (previewScope.filters.length ? studioFilterSummary(previewScope.filters) : '공통 필터 없음')
    : '공통 필터 결과 미확인';
  const scopePending = (previewScope?.key ?? null) !== documentFilterKey;
  const pendingLabel = !scopePending
    ? null
    : filterBusy
    ? '새 조건을 조회하는 중입니다. 지금 보이는 값은 이전 조건의 결과입니다.'
    : '문서의 조건이 화면 결과에 반영되지 않았습니다. 지금 보이는 값은 이전 조건의 결과입니다.';
  const applyAi = (result: StudioRunResult) => {
    if (!applyOperations(result.proposedOperations)) return false;
    const next = result.proposedOperations.reduce(applyStudioOperation, state.present);
    setAiRows({
      scope: previewScope?.key ?? '',
      rows: Object.fromEntries(
        next.blocks.map((block, index) => [
          block.id + '|' + (block.display.timeGrain ?? 'auto'),
          result.preview.widgets[index],
        ]),
      ),
    });
    setMessage('AI가 선택 블록을 수정했습니다. 저장 전 초안입니다. 되돌리기로 취소할 수 있습니다.');
    return true;
  };
  const templates = [
    ...state.present.blocks,
    ...state.savedBaseline.blocks.filter(block => !state.present.blocks.some(current => current.id === block.id)),
  ];
  const editToolbar = (
    <>
      <div className="studio-edit-toolbar">
        <Button variant="outline" size="sm" asChild>
          <a href="/dashboard" target="_blank" rel="noopener noreferrer" aria-label="대시보드 목록 새 탭에서 열기">
            목록 ↗
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to={'/dashboard/' + dashboardId}>기존 보기</RouterLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/dashboard/${dashboardId}/reuse?editor=studio`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="저장본 복제·소스 교체 새 탭에서 열기"
            title="마지막 저장본을 복제합니다. 현재 미저장 변경은 제외됩니다."
          >
            저장본 복제
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/organizations?dashboardId=${dashboardId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="조직 접근 설정 새 탭에서 열기"
            title="마지막 저장본의 조직별 보기 권한을 설정합니다."
          >
            조직 접근
          </a>
        </Button>
        <label>
          블록 추가
          <NativeSelect
            aria-label="추가할 블록 정의"
            disabled={state.present.blocks.length >= MAX_STUDIO_BLOCKS}
            value=""
            onChange={event => {
              if (event.target.value) duplicateBlock(event.target.value, '복사본 · ');
            }}
          >
            <option value="">기존 정의 복제</option>
            {templates.map(block => (
              <option key={block.id} value={block.id}>
                {block.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        <span>
          {state.present.blocks.length}/{MAX_STUDIO_BLOCKS} 블록 · {breakpointLabel(breakpoint)} 배치
        </span>
        {selected && geometry && (
          <div className="studio-placement" role="group" aria-label="선택 블록 배치">
            <Button variant="ghost" disabled={selectedOrder <= 0} onClick={() => reorder(-1)}>
              앞으로
            </Button>
            <Button variant="ghost" disabled={selectedOrder >= ordered.length - 1} onClick={() => reorder(1)}>
              뒤로
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                operation({
                  type: 'resizeBlock',
                  blockId: selected.id,
                  breakpoint,
                  w:
                    breakpoint === 'xs'
                      ? 1
                      : Math.min(STUDIO_COLUMNS[breakpoint] - geometry.x, Math.ceil(STUDIO_COLUMNS[breakpoint] / 2)),
                  h: selected.kind === 'BOARD_NUMERIC' ? 5 : 6,
                })
              }
            >
              기본 크기
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                operation({
                  type: 'resizeBlock',
                  blockId: selected.id,
                  breakpoint,
                  w: STUDIO_COLUMNS[breakpoint] - geometry.x,
                  h: Math.max(geometry.h, 6),
                })
              }
            >
              크게
            </Button>
          </div>
        )}
        <span className="studio-block-limit-note">새 지표를 만들지 않고 기존 정의를 복제해서 블록을 추가합니다.</span>
      </div>
      <p role="status" className="studio-edit-message">
        {message}
      </p>
    </>
  );

  return (
    <>
      <StudioShell
        document={documentForShell}
        stage="result"
        status="ready"
        onStatusChange={() => undefined}
        panel={state.panel}
        onStageChange={() => undefined}
        onPanelChange={panel => dispatch({ type: 'panel', panel })}
        history={{
          canUndo: !!state.past.length,
          canRedo: !!state.future.length,
          count: state.past.length,
          onUndo: () => dispatch({ type: 'undo' }),
          onRedo: () => dispatch({ type: 'redo' }),
        }}
        product={product}
        conversation={
          <StudioConversation
            draft={{ text: conversationInput, onChange: setConversationInput }}
            onPrepareCreationPublication={target => {
              setCreationPublication({ dashboardId: target.dashboardId, revision: target.revision });
              dispatch({ type: 'panel', panel: null });
              setPublishOpen(true);
            }}
            context={runContext}
            selectedTitle={selected?.title}
            filterScope={{ applied: previewScope?.filters ?? [], pending: scopePending, dateRange: previewScope?.dateRange }}
            onApply={applyAi}
            onSaved={async (saved, submitted) => {
              if (editClock.current.generation !== submitted.clientEditVersion) return false;
              try {
                const latest = await fetchStudioDashboard(dashboardId);
                if (
                  editClock.current.generation !== submitted.clientEditVersion ||
                  latest.document.revision !== saved.document.revision
                ) {
                  setMessage('서버 저장은 완료됐습니다. 이후 편집은 유지했습니다. 최신 저장 내용과 비교해 주세요.');
                  return false;
                }
                onReplace(latest);
                return true;
              } catch {
                setMessage('서버 저장은 완료됐지만 최신 화면을 불러오지 못했습니다. 현재 편집은 유지했습니다.');
                return false;
              }
            }}
            locked={saving || !!state.pendingSave || !!conflict}
          />
        }
        canvas={
          <>
            <StudioEvidence
              saved={state.saveState === 'clean' && !filterBusy}
              document={{ ...state.present, revision: state.serverRevision }}
              evidence={previewError ? null : preview?.evidence}
              unverifiedAi={
                aiRows.scope === (previewScope?.key ?? '') &&
                state.present.blocks.some(block => !!aiRows.rows[block.id + '|' + (block.display.timeGrain ?? 'auto')])
              }
            />
            <StudioDateRangePanel
              dateRange={state.present.dateRange}
              columns={preview?.temporalColumns ?? []}
              busy={filterBusy}
              disabled={saving || !!state.pendingSave || !!conflict || state.present.blocks.length === 0}
              error={null}
              onApply={applyDateRange}
            />
            <StudioFilterPanel
              filters={documentFilters}
              choices={(preview?.dimensions as StudioFilterChoice[] | undefined) ?? []}
              scopeLabel={scopeLabel}
              pendingLabel={pendingLabel}
              busy={filterBusy}
              disabled={saving || !!state.pendingSave || !!conflict || state.present.blocks.length === 0}
              error={filterError}
              message={filterMessage}
              onApply={applyFilters}
              onRetry={() => void prepareScope(documentFilters, 'history')}
            />
            <StudioCanvas
              document={state.present}
              breakpoint={breakpoint}
              selectedBlockId={state.selectedBlockId}
              onOperation={operation}
              onSelect={blockId => dispatch({ type: 'select', blockId })}
              onSettings={() => dispatch({ type: 'panel', panel: 'settings' })}
              renderBlock={renderBlock}
            />
          </>
        }
        inspector={
          <StudioInspector
            key={selected ? selected.id : 'none'}
            block={selected}
            onOperation={operation}
            canDuplicate={state.present.blocks.length < MAX_STUDIO_BLOCKS}
            onDuplicate={() => {
              if (selected) duplicateBlock(selected.id, '복사본 · ');
            }}
            onRemove={() => {
              if (!selected) return;
              if (operation({ type: 'removeBlock', blockId: selected.id })) dispatch({ type: 'panel', panel: null });
            }}
          />
        }
        editToolbar={editToolbar}
      />
      <StudioPublish
        key={creationPublication ? creationPublication.dashboardId + ':' + creationPublication.revision : 'editor'}
        targetLabel={
          creationPublication ? '새 대시보드 #' + creationPublication.dashboardId + ' · 생성안 저장 버전 기준' : undefined
        }
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        dashboardId={creationPublication?.dashboardId ?? dashboardId}
        revision={creationPublication?.revision ?? state.serverRevision ?? ''}
        dirty={!creationPublication && state.saveState !== 'clean'}
      />
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent
          className="studio-conflict-dialog max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          onOpenAutoFocus={() => {
            conflictReturnFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (conflictReturnFocus.current?.isConnected) conflictReturnFocus.current.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>다른 곳에서 먼저 저장되었습니다</DialogTitle>
            <DialogDescription>
              내 편집 내용은 그대로 있습니다. 최신 내용과 비교한 뒤 처리 방법을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <Alert severity="warning">내 편집 내용은 그대로 있습니다. 자동으로 덮어쓰지 않습니다.</Alert>
          <p>
            최신 revision {conflict?.document.revision?.slice(0, 8) ?? '알 수 없음'} · 블록{' '}
            {conflict?.document.blocks.length ?? 0}개
          </p>
          <p>
            내 편집 · 블록 {state.present.blocks.length}개 · 되돌리기 {state.past.length}회
          </p>
          <p className="font-semibold">내 화면에만 있는 블록</p>
          <p className="break-all">{localOnly.join(', ') || '없음'}</p>
          <p className="font-semibold">최신 내용에만 있는 블록</p>
          <p className="break-all">{latestOnly.join(', ') || '없음'}</p>
          {conflictError && <Alert severity="error">{conflictError}</Alert>}
          <DialogFooter className="flex-wrap">
            <Button variant="outline" onClick={() => setConflictOpen(false)}>
              계속 편집
            </Button>
            <Button variant="outline" onClick={discardLocal}>
              최신 내용 불러오기 (내 변경 버리기)
            </Button>
            <Button onClick={reapply}>최신 기준으로 내 변경 재적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
