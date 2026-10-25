import AnalysisBasis, { analysisFilterBasis } from '@/components/analysis/AnalysisBasis';
import { studioDateRangeSummary } from '../Studio/studioDocument';
import {
  reusePendingSaveKey,
  readReusePendingSave,
  writeReusePendingSave,
  removeReusePendingSave,
  ReusePendingSave,
} from './reusePendingSave';
import StudioReusePreview from './StudioReusePreview';
import {
  validateStudioReusePreview,
  StudioReusePreviewV1,
  ReuseAnalysisBasis,
  validateReuseAnalysisBasis,
} from './studioReusePreviewContract';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import { AnalysisUiProvider, analysisPanelClassName } from '@/components/analysis/AnalysisUi';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import SnapshotView, { Snapshot } from '../../Publication/SnapshotView';
import { creationData, CHART_SETUP_UNAVAILABLE_MESSAGE, isChartComponentUnavailable } from '../Studio/studioCreation';
import { errorMessage as dashboardErrorMessage, responseData } from '../dashboardPreview';

function errorMessage(failure: any) {
  if (
    (!failure?.response || failure.response.status === 0) &&
    (failure?.code === 'ERR_NETWORK' || failure?.message === 'Network Error')
  )
    return '서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 미리보기해 주세요. 입력은 유지됩니다.';
  if (isChartComponentUnavailable(failure)) return CHART_SETUP_UNAVAILABLE_MESSAGE;
  return dashboardErrorMessage(failure);
}

type Column = { name: string; type: string; numeric: boolean; temporal: boolean };
type Draft = {
  studioMixed?: boolean;
  originalId: number | string;
  originalTitle: string;
  expectedRevision: string;
  originalSourceId?: number;
  currency?: string;
  title: string;
  columns: Column[];
  blocks?: Array<{
    id: string;
    title: string;
    columns: string[];
    kind?: string;
    unsupportedReason?: string;
    measures?: Array<{ label: string; unit: string }>;
    conditions?: Array<{ measureId: number; operator: string; value: number }>;
  }>;
  sources: Array<{ id: number; name: string }>;
};
type Profile = { sourceId: number; dataVersion: string; supported: boolean; columns: Column[] };
type Preview = {
  basis?: ReuseAnalysisBasis;
  ticket: string;
  originalId: number | string;
  sourceId: number;
  snapshot?: Snapshot;
  studioPreview?: StudioReusePreviewV1;
};
function compatible(from: Column, to: Column) {
  if (from.numeric || to.numeric) return !!from.numeric && !!to.numeric;
  if (from.temporal || to.temporal)
    return !!from.temporal && !!to.temporal && from.type.toUpperCase() === to.type.toUpperCase();
  const text = /^(VARCHAR|CHAR|BPCHAR|NVARCHAR|TEXT|STRING)(?:\(\d+\))?$/i;
  return (text.test(from.type) && text.test(to.type)) || from.type.toUpperCase() === to.type.toUpperCase();
}
function Content() {
  const { dashboardId, kind, uuid } = useParams();
  const shared = !!kind;
  const [params] = useSearchParams();
  const studioReturn = !shared && params.get('editor') === 'studio';
  const originPath = shared
    ? `/${kind === 'publication' ? 'published' : 'share'}/${uuid}`
    : `/dashboard/${dashboardId}${studioReturn ? '/studio' : ''}`;
  const navigate = useNavigate();
  const base = shared
    ? `/bi/reuse/${encodeURIComponent(kind)}/${encodeURIComponent(uuid ?? '')}`
    : `/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/reuse`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [title, setTitle] = useState('');
  const [unitConfirmed, setUnitConfirmed] = useState(false);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [blockIds, setBlockIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [attempt, setAttempt] = useState<{ ticket: string; requestId: string } | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [busy, setBusy] = useState('원본을 불러오는 중…');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<ReusePendingSave | null>(null);
  const [recoveryRejected, setRecoveryRejected] = useState(false);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const [initialization, setInitialization] = useState(0);
  const recoveryKey = useRef<string | null>(null);
  const pendingRecord = useRef<ReusePendingSave | null>(null);
  const sequence = useRef(0);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  const previewButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const restorePreviewFocus = useRef(false);
  useEffect(() => {
    if (busy || !restorePreviewFocus.current) return;
    restorePreviewFocus.current = false;
    // Do not interrupt a user who moved to another control while the request was pending.
    if (document.activeElement === document.body || document.activeElement === saveButton.current)
      previewButton.current?.focus();
  }, [busy]);
  const lock = unknown || busy === '복사본 저장 중…';
  const invalidate = () => {
    sequence.current += 1;
    request.current?.abort();
    pending.current = false;
    setPreview(null);
    setAttempt(null);
    setUnknown(false);
    setError('');
    setBusy('');
  };
  const applyProfile = (value: Profile, columns: Column[]) => {
    if (!value?.supported || !Array.isArray(value.columns) || !/^[a-f0-9]{64}$/.test(value.dataVersion))
      throw new Error('사용할 수 있는 서버 파일 소스를 선택해 주세요.');
    setProfile(value);
    setColumnMap(
      Object.fromEntries(
        columns.map(column => [
          column.name,
          value.columns.find(target => target.name.toLowerCase() === column.name.toLowerCase() && compatible(column, target))
            ?.name ?? '',
        ]),
      ),
    );
  };
  useEffect(() => {
    invalidate();
    setDraft(null);
    setRecovery(null);
    setRecoveryRejected(false);
    setInitializationFailed(false);
    recoveryKey.current = null;
    pendingRecord.current = null;
    setProfile(null);
    setSourceId('');
    setTitle('');
    setColumnMap({});
    setBlockIds([]);
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('원본을 불러오는 중…');
    const load = async () => {
      if (studioReturn) {
        const key = await reusePendingSaveKey(Number(dashboardId));
        if (token !== sequence.current) return;
        recoveryKey.current = key;
        const record = readReusePendingSave(key, Number(dashboardId));
        if (record) {
          pendingRecord.current = record;
          setRecovery(record);
          return;
        }
      }
      return get(base, undefined, { signal: abort.signal });
    };
    load()
      .then(async response => {
        if (token !== sequence.current || !response) return;
        const value = responseData(response) as Draft;
        if (
          value.originalId !== (shared ? uuid : Number(dashboardId)) ||
          !Array.isArray(value.columns) ||
          !Array.isArray(value.sources)
        )
          throw new Error('복제할 원본을 확인할 수 없습니다.');
        setDraft(value);
        setTitle(value.title);
        setBlockIds(value.blocks?.map(block => block.id) ?? []);
        if (shared || value.studioMixed) return;
        setSourceId(String(value.originalSourceId));
        const source = responseData(
          await get(`/bi/sources/${value.originalSourceId}/profile`, undefined, { signal: abort.signal }),
        );
        if (token !== sequence.current) return;
        if (source.sourceId !== value.originalSourceId) throw new Error('데이터 소스를 확인해 주세요.');
        applyProfile(source, value.columns);
      })
      .catch(failure => {
        if (token === sequence.current) {
          setError(errorMessage(failure));
          setInitializationFailed(true);
        }
      })
      .finally(() => {
        if (token === sequence.current) {
          setBusy('');
          pending.current = false;
        }
      });
    return () => {
      sequence.current += 1;
      abort.abort();
      request.current?.abort();
      pending.current = false;
    };
  }, [base, dashboardId, shared, uuid, studioReturn, initialization]);
  const selectSource = async (value: string) => {
    if (lock) return;
    invalidate();
    setSourceId(value);
    setProfile(null);
    setColumnMap({});
    setUnitConfirmed(false);
    if (!value || !draft) return;
    const token = sequence.current,
      abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('새 소스를 확인하는 중…');
    try {
      const result = responseData(await get(`/bi/sources/${value}/profile`, undefined, { signal: abort.signal }));
      if (token !== sequence.current) return;
      if (result.sourceId !== Number(value)) throw new Error('데이터 소스를 확인해 주세요.');
      applyProfile(result, draft.columns);
    } catch (failure) {
      if (token === sequence.current) setError(errorMessage(failure));
    } finally {
      if (token === sequence.current) {
        setBusy('');
        pending.current = false;
      }
    }
  };
  const prepareSample = async (sample: 'margin-reuse' | 'margin-missing' | 'margin-krw') => {
    if (pending.current || lock || !draft) return;
    invalidate();
    pending.current = true;
    setBusy('복제 연습 파일을 준비하는 중…');
    const token = sequence.current;
    try {
      const value = creationData(await post('/studio/samples', { sample }, { timeout: 120000 }));
      if (token !== sequence.current) return;
      if (!Number.isSafeInteger(value?.sourceId) || !value.name) throw new Error('연습 파일을 확인하지 못했습니다.');
      setDraft(
        current =>
          current && {
            ...current,
            sources: current.sources.some(s => s.id === value.sourceId)
              ? current.sources
              : [...current.sources, { id: value.sourceId, name: value.name }],
          },
      );
      pending.current = false;
      await selectSource(String(value.sourceId));
    } catch (failure) {
      if (token === sequence.current) {
        setError(errorMessage(failure));
        setBusy('');
        pending.current = false;
      }
    }
  };
  const selectedBlocks = draft?.blocks?.filter(block => blockIds.includes(block.id)) ?? [];
  const requiredColumns =
    draft?.columns.filter(column => !draft.blocks || selectedBlocks.some(block => block.columns.includes(column.name))) ??
    [];
  const missingFor = (block: NonNullable<Draft['blocks']>[number]) =>
    block.columns.filter(name => {
      const from = draft.columns.find(column => column.name === name);
      const target = profile?.columns.find(column => column.name === columnMap[name]);
      return !from || !target || !compatible(from, target);
    });
  const valid =
    draft &&
    profile &&
    (!draft.blocks || selectedBlocks.length > 0) &&
    (!draft.studioMixed ||
      (selectedBlocks.some(b => b.kind !== 'SEGMENT_PIVOT') && !selectedBlocks.some(b => b.unsupportedReason))) &&
    title.trim() &&
    title.length <= 300 &&
    requiredColumns.every(column => {
      const target = profile.columns.find(value => value.name === columnMap[column.name]);
      return target && compatible(column, target);
    });
  const makePreview = async () => {
    if (pending.current || !valid || lock) return;
    invalidate();
    pending.current = true;
    const token = sequence.current,
      abort = new AbortController();
    request.current = abort;
    setBusy('새 소스의 결과 미리보기 중…');
    try {
      const result = responseData(
        await post(
          `${base}/preview`,
          {
            expectedRevision: draft.expectedRevision,
            sourceId: profile.sourceId,
            sourceRevision: profile.dataVersion,
            title,
            ...(unitConfirmed ? { unitConfirmation: 'same-unit' } : {}),
            columnMap: Object.fromEntries(requiredColumns.map(column => [column.name, columnMap[column.name]])),
            ...(draft.blocks && selectedBlocks.length !== draft.blocks.length ? { blockIds } : {}),
          },
          { signal: abort.signal, timeout: 120000 },
        ),
      ) as Preview;
      if (token !== sequence.current) return;
      if (result.originalId !== draft.originalId || result.sourceId !== profile.sourceId || !result.ticket)
        throw new Error('미리보기를 확인할 수 없습니다.');
      if (draft.studioMixed) {
        if (result.snapshot !== undefined) throw new Error('혼합 미리보기 형식을 확인해 주세요.');
        const mixed = validateStudioReusePreview(result.studioPreview);
        if (
          mixed.title !== title.trim() ||
          mixed.blocks.length !== selectedBlocks.length ||
          mixed.blocks.some((b, i) => b.blockId !== selectedBlocks[i].id || b.kind !== selectedBlocks[i].kind)
        )
          throw new Error('선택한 블록과 미리보기가 다릅니다. 입력을 유지하고 다시 확인해 주세요.');
        result.studioPreview = mixed;
      } else if (
        result.studioPreview !== undefined ||
        result.snapshot?.title !== title ||
        !Array.isArray(result.snapshot?.widgets) ||
        !result.snapshot.widgets.length ||
        result.snapshot.widgets.some(widget => !Array.isArray(widget.datas))
      )
        throw new Error('미리보기를 확인할 수 없습니다.');
      if (result.basis !== undefined) {
        result.basis = validateReuseAnalysisBasis(result.basis);
        if (result.basis.sourceId !== profile.sourceId) throw new Error('복제 대상 기준이 다릅니다.');
      }
      if (result.studioPreview?.basis && result.studioPreview.basis.sourceId !== profile.sourceId)
        throw new Error('복제 대상 기준이 다릅니다.');
      const nextAttempt = { ticket: result.ticket, requestId: crypto.randomUUID() };
      setPreview(result);
      setAttempt(nextAttempt);
    } catch (failure) {
      if (token === sequence.current) setError(errorMessage(failure));
    } finally {
      if (token === sequence.current) {
        setBusy('');
        pending.current = false;
      }
    }
  };
  const save = async () => {
    if (pending.current || !preview || !attempt) return;
    const hadSaveFocus = document.activeElement === saveButton.current;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy('복사본 저장 중…');
    setError('');
    const durable = studioReturn && draft.studioMixed;
    let sent = false;
    try {
      if (durable) {
        const key = await reusePendingSaveKey(Number(dashboardId));
        if (token !== sequence.current) return;
        if (!key || key !== recoveryKey.current) throw Error('로그인 범위가 변경되었습니다.');
        const record = pendingRecord.current ?? {
          version: 1,
          updatedAt: Date.now(),
          originalId: Number(dashboardId),
          sourceId: profile.sourceId,
          title,
          columnMap: { ...columnMap },
          blockIds: [...blockIds],
          unitConfirmed,
          request: { ...attempt },
        };
        if (record.request.ticket !== attempt.ticket || record.request.requestId !== attempt.requestId)
          throw Error('보관된 요청과 현재 저장 요청이 다릅니다.');
        writeReusePendingSave(key, record);
        pendingRecord.current = record;
      }
      sent = true;
      const result = responseData(await post(base, attempt, { signal: abort.signal, timeout: 120000 }));
      if (token !== sequence.current) return;
      if (!Number.isSafeInteger(result?.id) || result.id <= 0 || result.id === draft.originalId)
        throw new Error('저장 응답을 확인할 수 없습니다.');
      if (durable) {
        const key = await reusePendingSaveKey(Number(dashboardId));
        if (token !== sequence.current) return;
        if (key !== recoveryKey.current) throw Error('로그인 범위가 변경되었습니다.');
        removeReusePendingSave(key);
        pendingRecord.current = null;
      }
      navigate(`/dashboard/${result.id}${studioReturn ? '/studio' : ''}`);
    } catch (failure) {
      if (token !== sequence.current) return;
      if (!sent) {
        setError(
          '저장 확인 기록을 보관할 수 없거나 로그인 범위가 바뀌었습니다. 요청을 보내지 않았습니다. 입력은 유지됩니다.',
        );
        return;
      }
      const status = (failure as any)?.response?.status;
      if (durable && status !== 400 && status !== 409) {
        setUnknown(true);
        setError('저장 결과를 확인하지 못했습니다. 확인 기록은 유지됩니다. 같은 요청을 다시 확인해 주세요.');
      } else if (!status || status >= 500) {
        setUnknown(true);
        setError('저장 결과를 확인하지 못했습니다. 초안은 유지됩니다. 같은 저장 요청을 다시 확인해 주세요.');
      } else {
        if (durable) {
          try {
            const key = await reusePendingSaveKey(Number(dashboardId));
            if (token !== sequence.current) return;
            if (!key || key !== recoveryKey.current) throw Error('로그인 범위가 변경되었습니다.');
            removeReusePendingSave(key);
            pendingRecord.current = null;
          } catch {
            setUnknown(true);
            setError('거절된 요청의 확인 기록을 정리하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');
            return;
          }
        }
        restorePreviewFocus.current = hadSaveFocus;
        setPreview(null);
        setAttempt(null);
        setUnknown(false);
        setError(errorMessage(failure));
      }
    } finally {
      if (token === sequence.current) {
        setBusy('');
        pending.current = false;
      }
    }
  };
  const confirmRecovered = async () => {
    if (pending.current || !recovery) return;
    pending.current = true;
    const token = sequence.current;
    setBusy('같은 저장 요청 확인 중…');
    setError('');
    setRecoveryRejected(false);
    try {
      const key = await reusePendingSaveKey(Number(dashboardId));
      if (token !== sequence.current) return;
      if (!key || key !== recoveryKey.current) throw Error('로그인 범위가 변경되었습니다. 기록은 유지됩니다.');
      const stored = readReusePendingSave(key, Number(dashboardId));
      if (JSON.stringify(stored) !== JSON.stringify(recovery))
        throw Error('보관 기록이 변경되거나 만료됐습니다. 다시 불러와 주세요.');
      const result = responseData(await post(base, recovery.request, { timeout: 120000 }));
      if (token !== sequence.current) return;
      if (!Number.isSafeInteger(result?.id) || result.id <= 0 || result.id === recovery.originalId)
        throw Error('저장 결과를 확인하지 못했습니다.');
      if ((await reusePendingSaveKey(Number(dashboardId))) !== key || token !== sequence.current)
        throw Error('로그인 범위가 변경되었습니다.');
      removeReusePendingSave(key);
      pendingRecord.current = null;
      navigate(`/dashboard/${result.id}/studio`);
    } catch (cause) {
      if (token === sequence.current) {
        const status = (cause as any)?.response?.status;
        setRecoveryRejected(status === 400 || status === 409);
        setError(errorMessage(cause));
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const restoreRecoveredInputs = async () => {
    if (pending.current || !recovery || !recoveryRejected) return;
    pending.current = true;
    const token = sequence.current;
    setBusy('연결 입력을 확인하는 중…');
    setError('');
    try {
      const key = await reusePendingSaveKey(Number(dashboardId));
      if (!key || key !== recoveryKey.current) throw Error('로그인 범위가 변경되었습니다.');
      const current = responseData(await get(base)) as Draft;
      if (token !== sequence.current) return;
      if (
        !current.studioMixed ||
        current.originalId !== recovery.originalId ||
        !current.sources.some(s => s.id === recovery.sourceId) ||
        !recovery.blockIds.every(id => current.blocks?.some(b => b.id === id))
      )
        throw Error('원본 블록이나 대상 소스를 확인할 수 없습니다. 보관 기록은 유지됩니다.');
      const target = responseData(await get(`/bi/sources/${recovery.sourceId}/profile`)) as Profile;
      if (token !== sequence.current) return;
      if (
        !target?.supported ||
        target.sourceId !== recovery.sourceId ||
        !Array.isArray(target.columns) ||
        !/^[a-f0-9]{64}$/.test(target.dataVersion)
      )
        throw Error('대상 소스를 다시 확인해 주세요.');
      if ((await reusePendingSaveKey(Number(dashboardId))) !== key || token !== sequence.current)
        throw Error('로그인 범위가 변경되었습니다.');
      removeReusePendingSave(key);
      restorePreviewFocus.current = true;
      setDraft(current);
      setProfile(target);
      setSourceId(String(recovery.sourceId));
      setTitle(recovery.title);
      setColumnMap({ ...recovery.columnMap });
      setBlockIds([...recovery.blockIds]);
      setUnitConfirmed(recovery.unitConfirmed);
      setPreview(null);
      setAttempt(null);
      setUnknown(false);
      setRecovery(null);
      pendingRecord.current = null;
    } catch (cause) {
      if (token === sequence.current) setError(errorMessage(cause));
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  if (recovery)
    return (
      <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
        <h1 className="text-xl font-semibold">복사본 저장 결과 확인</h1>
        <p className="break-words text-sm text-muted-foreground">{recovery.title}</p>
        <Notice role="region" aria-label="보관된 복제 요청">
          <p>이 탭에 결과를 확인하지 못한 복제 요청이 있습니다. 확인 전까지 새 복제를 시작하지 않습니다.</p>
          <p className="mt-2">
            같은 요청을 확인합니다. 이미 저장됐다면 기존 사본으로 이동하고, 미전달이었다면 저장을 완료합니다. 게시하지
            않습니다.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            대상 소스 #{recovery.sourceId} · 연결 {Object.keys(recovery.columnMap).length}개 · 선택 블록{' '}
            {recovery.blockIds.length}개
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              aria-disabled={!!busy || undefined}
              aria-busy={!!busy || undefined}
              onClick={() => void confirmRecovered()}
            >
              같은 저장 요청 확인
            </Button>
            {recoveryRejected && (
              <Button variant="outline" disabled={!!busy} onClick={() => void restoreRecoveredInputs()}>
                연결 입력으로 돌아가기
              </Button>
            )}
          </div>
          {recoveryRejected && (
            <p className="mt-3 text-sm">
              요청이 거절됐습니다. 연결 입력으로 돌아간 뒤 현재 기준의 새 미리보기를 확인하세요. 기존 사본은 삭제하지
              않습니다.
            </p>
          )}
          {busy && (
            <p role="status" className="mt-3 text-sm">
              {busy}
            </p>
          )}
        </Notice>
        {error && <Notice severity="error">{error}</Notice>}
        <Button asChild variant="ghost">
          <Link to="/dashboard">대시보드 목록</Link>
        </Button>
      </main>
    );
  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-[1600px] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">복제해서 재사용</h1>
        <Button asChild variant="ghost">
          <Link to={originPath}>원본 보기</Link>
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        원본은 유지하고 새 데이터로 복사본을 만듭니다. 결과를 확인한 뒤 저장하세요. 복사본은 비공개로 시작합니다.
        {studioReturn && ' 마지막 저장본을 복제합니다. 원본 Studio의 미저장 변경은 포함하지 않습니다.'}
        <span className="mt-1 block">
          기간·필터와 확인된 지표는 새 소스에 연결합니다. 없는 열은 직접 연결하거나 새 파일을 선택하세요.
        </span>
      </p>
      {busy && (
        <p role="status" className="mb-3 text-sm">
          {busy}
        </p>
      )}
      {error && (
        <Notice severity="error" className="mb-3">
          {error}
        </Notice>
      )}
      {initializationFailed && (
        <Button variant="outline" onClick={() => setInitialization(n => n + 1)}>
          다시 불러오기
        </Button>
      )}
      {draft && (
        <>
          <fieldset
            disabled={lock || busy === '원본을 불러오는 중…' || busy === '새 소스를 확인하는 중…'}
            className="m-0 min-w-0 border-0 p-0"
          >
            <div className={analysisPanelClassName}>
              <p className="mb-4 text-sm text-muted-foreground break-words">
                원본: {draft.originalTitle}
                {shared && !sourceId && ' · 내 소스를 선택해 주세요'}
              </p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <TextField
                  label="복사본 제목"
                  value={title}
                  maxLength={300}
                  onChange={event => {
                    invalidate();
                    setTitle(event.target.value);
                  }}
                />
                <TextField
                  label="데이터 소스"
                  select
                  value={sourceId}
                  onChange={event => void selectSource(event.target.value)}
                >
                  <option value="">소스를 선택해 주세요</option>
                  {draft.sources
                    .filter(source => !draft.studioMixed || source.id !== draft.originalSourceId)
                    .map(source => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                </TextField>
              </div>
              {draft.studioMixed && (
                <p className="mt-3 text-sm text-muted-foreground">
                  다른 파일 소스를 선택하세요. 같은 소스는 Studio의 저장본 복제를 이용할 수 있습니다.
                </p>
              )}
              {studioReturn && draft.currency === 'USD' && (
                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">샘플 파일로 복제 연습</summary>
                  <p className="my-2 text-xs text-muted-foreground">
                    VM 합성 데이터입니다. 새 비공개 파일만 준비하며 AI 실행이나 대시보드 저장은 하지 않습니다. 정상 파일은
                    매출 2배·비용 3배이며 금액 열 이름이 다릅니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void prepareSample('margin-reuse')}
                    >
                      정상 USD 파일
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void prepareSample('margin-missing')}
                    >
                      이익 열 누락 파일
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void prepareSample('margin-krw')}
                    >
                      KRW 단위 오류 파일
                    </Button>
                  </div>
                </details>
              )}
              {draft.currency && (
                <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
                  <p className="mb-2">
                    원본 금액 단위: {draft.currency}. 통화 환산 없이 복제합니다. 알려진 다른 통화는 차단합니다.
                  </p>
                  <label className="flex min-h-9 cursor-pointer items-start gap-3">
                    <Checkbox
                      className="mt-0.5 shrink-0"
                      checked={unitConfirmed}
                      onCheckedChange={checked => {
                        invalidate();
                        setUnitConfirmed(checked === true);
                      }}
                    />
                    <span className="min-w-0">
                      단위를 자동 확인할 수 없는 내 파일은 같은 {draft.currency} 금액 단위임을 확인했습니다.
                    </span>
                  </label>
                </div>
              )}
              {draft.blocks && (
                <details
                  className="mt-4"
                  open={(!!profile && selectedBlocks.some(block => missingFor(block).length > 0)) || undefined}
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    복제할 블록 · {selectedBlocks.length}/{draft.blocks.length}
                  </summary>
                  <p className="my-2 text-xs text-muted-foreground">
                    필요한 열이 없는 블록은 제외할 수 있습니다. 원본은 유지되며 선택한 블록만 복사본에 저장합니다.
                  </p>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {draft.blocks.map(block => (
                      <label
                        key={block.id}
                        className="flex min-h-9 min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border p-3"
                      >
                        <Checkbox
                          aria-label={`${block.title} 포함`}
                          className="mt-0.5 shrink-0"
                          checked={blockIds.includes(block.id)}
                          onCheckedChange={checked => {
                            invalidate();
                            setBlockIds(current =>
                              checked === true ? [...current, block.id] : current.filter(id => id !== block.id),
                            );
                          }}
                        />
                        <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
                          <span className="font-medium">{block.title}</span>
                          {block.kind && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {block.kind === 'SEGMENT_PIVOT' ? '집계 Pivot' : '차트'}
                              {block.measures?.length
                                ? ' · ' + block.measures.map(m => m.label + (m.unit ? ' (' + m.unit + ')' : '')).join(', ')
                                : ''}
                            </span>
                          )}
                          {block.unsupportedReason && (
                            <span className="mt-1 block text-xs text-destructive">{block.unsupportedReason}</span>
                          )}
                          {profile && blockIds.includes(block.id) && missingFor(block).length > 0 && (
                            <span className="mt-1 block text-xs text-destructive">
                              연결 필요: {missingFor(block).join(', ')}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  {draft.studioMixed &&
                    selectedBlocks.length > 0 &&
                    !selectedBlocks.some(b => b.kind !== 'SEGMENT_PIVOT') && (
                      <p className="mt-2 text-sm text-destructive">일반 차트가 하나 이상 포함되어야 합니다.</p>
                    )}
                  {!selectedBlocks.length && (
                    <p className="mt-2 text-sm text-destructive">복제할 블록을 하나 이상 선택해 주세요.</p>
                  )}
                </details>
              )}
              {profile && (
                <details className="mt-4" open={requiredColumns.some(column => !columnMap[column.name]) || undefined}>
                  <summary className="cursor-pointer text-sm font-medium">
                    열 연결 확인 · {requiredColumns.filter(column => columnMap[column.name]).length}/{requiredColumns.length}
                  </summary>
                  <p className="my-2 text-xs text-muted-foreground">
                    같은 이름과 호환 타입만 자동 연결했습니다. 다른 이름은 사용할 열을 선택하세요.
                  </p>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {requiredColumns.map(column => (
                      <TextField
                        key={column.name}
                        label={`${column.name} 연결`}
                        select
                        value={columnMap[column.name] ?? ''}
                        onChange={event => {
                          invalidate();
                          setColumnMap(current => ({ ...current, [column.name]: event.target.value }));
                        }}
                        helperText={`원본 타입: ${column.type}`}
                      >
                        <option value="">연결할 열을 선택해 주세요</option>
                        {profile.columns
                          .filter(target => compatible(column, target))
                          .map(target => (
                            <option key={target.name} value={target.name}>
                              {target.name} · {target.type}
                            </option>
                          ))}
                      </TextField>
                    ))}
                  </div>
                </details>
              )}
              {profile && !valid && (
                <p className="mt-3 text-sm text-destructive">제목과 필요한 열 연결을 확인한 뒤 미리보기해 주세요.</p>
              )}
            </div>
          </fieldset>
          <div className="my-4 flex flex-wrap items-center gap-2">
            <Button
              ref={previewButton}
              variant="outline"
              disabled={!valid || lock}
              aria-disabled={!!busy || undefined}
              aria-busy={!!busy || undefined}
              onClick={() => void makePreview()}
            >
              전체 미리보기
            </Button>
            <Button ref={saveButton} disabled={!preview || !attempt || !!busy || unknown} onClick={() => void save()}>
              복사본 저장
            </Button>
            {unknown && (
              <Button variant="outline" disabled={!!busy} onClick={() => void save()}>
                같은 저장 요청 다시 확인
              </Button>
            )}
          </div>
          {preview && (
            <>
              {draft.blocks && (
                <p role="status" className="mb-3 text-sm text-muted-foreground">
                  {selectedBlocks.length}개 블록 포함 · {draft.blocks.length - selectedBlocks.length}개 제외
                </p>
              )}
              {preview.studioPreview ? (
                <StudioReusePreview preview={preview.studioPreview} />
              ) : (
                <>
                  <AnalysisBasis
                    className="mb-4"
                    status="복사본 미리보기 · 저장 전"
                    data={
                      preview.basis
                        ? `${preview.basis.sourceName} · #${preview.basis.sourceId}`
                        : '연결한 내 데이터 · 상세 기준 확인 필요'
                    }
                    period={
                      preview.basis
                        ? studioDateRangeSummary(preview.basis.dateRange) + (preview.basis.dateRange ? '' : ' · UTC')
                        : '기간 상세 미제공 · 미리보기 범위 확인'
                    }
                    filters={
                      preview.basis
                        ? analysisFilterBasis(preview.basis.filters, !!preview.basis.conditionsApplied)
                        : '필터 상세 미제공 · 미리보기 범위 확인'
                    }
                    metrics={preview.snapshot.widgets.map(widget => widget.title).join(' · ')}
                    note="대상 데이터에서 다시 계산한 공통 기준입니다. 저장하면 새 비공개 사본을 만들며 원본과 게시본은 유지합니다."
                  />
                  <SnapshotView snapshot={preview.snapshot} context="reuse" />
                </>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
export default function DashboardReuse() {
  return (
    <AnalysisUiProvider>
      <Content />
    </AnalysisUiProvider>
  );
}
