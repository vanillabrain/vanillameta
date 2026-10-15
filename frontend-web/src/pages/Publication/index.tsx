import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import { AnalysisUiProvider, analysisFieldClassName, analysisPanelClassName } from '@/components/analysis/AnalysisUi';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import { errorMessage, responseData } from '../Dashboard/dashboardPreview';
import SnapshotView, { Snapshot } from './SnapshotView';

type Published = {
  uuid: string;
  version: number;
  active: boolean;
  publishedAt: string;
  expiresAt: string;
  dashboardRevision: string;
  reusable?: boolean;
};
type State = { dashboardId: number; revision: string; version: number; publication: Published | null };
type Preview = { dashboardId: number; revision: string; ticket: string; snapshot: Snapshot };
const defaultExpiry = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
export function expiryInstant(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const instant = `${date}T23:59:59.999Z`;
  const time = Date.parse(instant);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return time > Date.now() && time <= Date.now() + 30 * 86400000 ? instant : null;
}
const validState = (value: State, id: string) =>
  value?.dashboardId === Number(id) &&
  /^[a-f0-9]{64}$/.test(value.revision) &&
  Number.isSafeInteger(value.version) &&
  value.version >= 0;

async function publicationPreview(base: string, value: State, signal: AbortSignal, allowReuse: boolean): Promise<Preview> {
  const result = responseData(
    await post(`${base}/preview`, { expectedRevision: value.revision, allowReuse }, { signal, timeout: 120000 }),
  );
  if (
    result?.dashboardId !== value.dashboardId ||
    result.revision !== value.revision ||
    !result.ticket ||
    !Array.isArray(result.snapshot?.widgets)
  )
    throw new Error('게시 미리보기를 확인할 수 없습니다.');
  return result;
}
const revisionMismatch =
  '질문에서 저장한 버전과 현재 저장본이 다릅니다. 저장 화면에서 내용을 확인하고 게시를 다시 요청해 주세요.';
function PublicationContent() {
  const { dashboardId = '' } = useParams();
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const hasHandoff = query.has('savedRevision');
  const savedRevision = query.get('savedRevision');
  const validHandoff =
    !hasHandoff || (query.getAll('savedRevision').length === 1 && /^[a-f0-9]{64}$/.test(savedRevision ?? ''));
  const base = `/bi/dashboards/${encodeURIComponent(dashboardId)}/publication`;
  const [state, setState] = useState<State | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [allowReuse, setAllowReuse] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState<any>(null);
  const [uncertain, setUncertain] = useState(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const handoffBlocked = hasHandoff && (!validHandoff || !state || state.revision !== savedRevision);

  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('게시 상태 확인 중…');
    setState(null);
    setPreview(null);
    setError('');
    setNotice('');
    setRetry(null);
    setUncertain(false);
    get(base, undefined, { signal: abort.signal })
      .then(async response => {
        if (token !== sequence.current) return;
        const value = responseData(response);
        if (!validState(value, dashboardId)) throw new Error('게시 상태를 확인할 수 없습니다.');
        setState(value);
        // Existing publication may advertise reuse; a handoff auto preview never grants it silently.
        setAllowReuse(!hasHandoff && value.publication?.reusable === true);
        if (hasHandoff) {
          if (!validHandoff || value.revision !== savedRevision) {
            setError(revisionMismatch);
            return;
          }
          setNotice('저장 완료 · 링크 공개·갱신은 게시 버튼에서 실행됩니다. 아래 범위와 미리보기를 확인해 주세요.');
          setBusy('저장한 버전의 게시 결과 확인 중…');
          const result = await publicationPreview(base, value, abort.signal, false);
          if (token === sequence.current) setPreview(result);
        }
      })
      .catch(failure => {
        if (token === sequence.current)
          setError(
            hasHandoff
              ? `저장한 분석은 유지됩니다. 게시 준비에 실패했습니다. 상태 확인 또는 미리보기를 다시 시도해 주세요. ${errorMessage(
                  failure,
                )}`
              : errorMessage(failure),
          );
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
  }, [base, dashboardId, hasHandoff, savedRevision, validHandoff]);

  const perform = async (kind: 'check' | 'preview' | 'publish' | 'retry' | 'revoke') => {
    if (pending.current || (kind !== 'check' && !state)) return;
    if (handoffBlocked && ['preview', 'publish', 'retry'].includes(kind)) return;
    if (kind === 'publish' && (!preview || !expiryInstant(expiry) || uncertain)) return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy(
      {
        check: '게시 상태 확인 중…',
        preview: '게시 결과 확인 중…',
        publish: '게시 중…',
        retry: '같은 게시 요청 확인 중…',
        revoke: '게시 중지 중…',
      }[kind],
    );
    setError('');
    setNotice('');
    let body: any;
    let dispatched = false;
    try {
      if (kind === 'check') {
        const value = responseData(await get(base, undefined, { signal: abort.signal }));
        if (token !== sequence.current) return;
        if (!validState(value, dashboardId)) throw new Error('게시 상태를 확인할 수 없습니다.');
        setState(value);
        setAllowReuse(value.publication?.reusable === true);
        setPreview(null);
        setUncertain(false);
        if (hasHandoff && (!validHandoff || value.revision !== savedRevision)) setError(revisionMismatch);
        else
          setNotice(
            hasHandoff
              ? '저장 완료 · 게시 미리보기를 다시 확인해 주세요. 링크 공개·갱신은 게시 버튼에서 실행됩니다.'
              : '게시 상태를 확인했습니다. 새 게시에는 미리보기가 필요합니다.',
          );
      } else if (kind === 'preview') {
        setPreview(null);
        setRetry(null);
        const value = await publicationPreview(base, state, abort.signal, allowReuse);
        if (token !== sequence.current) return;
        setPreview(value);
        setNotice('전체 기간의 고정 집계 결과입니다. 아래 결과와 공개 범위를 확인한 뒤 게시하세요.');
      } else {
        if (kind === 'retry' && !retry) return;
        body =
          kind === 'revoke'
            ? { expectedVersion: state.version }
            : kind === 'retry'
            ? retry
            : {
                expectedRevision: preview.revision,
                expectedVersion: state.version,
                ticket: preview.ticket,
                requestId: crypto.randomUUID(),
                expiresAt: expiryInstant(expiry),
                visibility: 'link',
              };
        if (kind !== 'revoke') setRetry(body);
        dispatched = true;
        const value = responseData(await post(kind === 'revoke' ? `${base}/revoke` : base, body, { signal: abort.signal }));
        if (token !== sequence.current) return;
        if (!validState(value, dashboardId)) throw new Error('게시 응답을 확인할 수 없습니다.');
        setState(value);
        setPreview(null);
        setRetry(null);
        setUncertain(false);
        setNotice(
          kind === 'revoke'
            ? '게시를 중지했습니다. 이후 링크 조회가 차단됩니다.'
            : `게시 버전 ${value.version}을 저장했습니다.`,
        );
      }
    } catch (failure) {
      if (token !== sequence.current) return;
      const status = (failure as any)?.response?.status;
      if (kind === 'publish' || kind === 'retry' || kind === 'revoke') {
        if (!dispatched) {
          setError(
            '게시 요청을 만들지 못했습니다. HTTPS 또는 localhost에서 다시 실행해 주세요. 저장과 게시는 변경하지 않았습니다.',
          );
        } else if (!status || status >= 500) {
          setUncertain(true);
          setError(
            '게시 결과가 확실하지 않습니다. 상태를 확인하거나 같은 게시 요청을 다시 확인하세요. 저장 분석은 유지됩니다.',
          );
        } else {
          setPreview(null);
          setRetry(null);
          setUncertain(status !== 400);
          setError(
            status === 409
              ? '저장 또는 게시 버전이 변경됐습니다. 상태 확인 후 미리보기를 다시 실행하세요.'
              : errorMessage(failure),
          );
        }
      } else setError(errorMessage(failure));
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const published = state?.publication;
  const activeLink = published?.active && Date.parse(published.expiresAt) > Date.now();
  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-[1600px] p-4 sm:p-6">
      <div className="mb-4 flex flex-row flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">게시 버전</h1>
        <Button asChild variant="ghost" className={busy ? 'pointer-events-none opacity-50' : undefined}>
          <Link to={`/dashboard/${dashboardId}`} aria-disabled={!!busy || undefined}>
            저장 화면으로
          </Link>
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => void perform('check')}>
          게시 상태 확인
        </Button>
      </div>
      <div className={analysisPanelClassName}>
        <p className="text-sm font-semibold">링크를 가진 사람이 보는 고정된 집계 결과</p>
        <p className="my-2 text-xs">
          전체 기간 · 필터 없음 · UTC. 현재 화면에서 선택한 기간·필터는 포함하지 않습니다. 원본 행은 제공하지 않습니다.
          중지·만료 후 다시 게시하면 새 링크가 발급됩니다.
        </p>
        <p className="text-xs">
          {published
            ? `${
                published.active && Date.parse(published.expiresAt) > Date.now() ? '게시 중' : '게시 중지 또는 만료'
              } · 버전 ${published.version} · 게시 ${published.publishedAt} · 만료 ${published.expiresAt}`
            : '아직 게시한 버전이 없습니다.'}
        </p>
        {activeLink && state.revision !== published.dashboardRevision && (
          <Notice severity="info" className="my-2">
            저장 분석이 게시본과 다릅니다. 재게시 전까지 기존 게시 결과가 유지됩니다.
          </Notice>
        )}
        <label className="mt-4 flex w-full items-start gap-2 text-sm">
          <Checkbox
            className="mt-1"
            checked={allowReuse}
            disabled={!!busy || uncertain}
            onCheckedChange={checked => {
              setAllowReuse(checked === true);
              setPreview(null);
              setRetry(null);
              setNotice('');
            }}
            aria-label="내 소스로 재사용 허용"
          />
          <span className="min-w-0">
            내 소스로 재사용 허용
            <span className="mt-1 block text-xs text-muted-foreground">
              받는 사람이 자신의 데이터로 재사용합니다. 계산식·필터 조건·배치가 복사본에 포함됩니다. 켜면 아래
              미리보기·게시를 다시 실행해야 합니다.
            </span>
          </span>
        </label>
        <div className="mt-4 flex flex-row flex-wrap items-end gap-2">
          <TextField
            label="만료일 (UTC)"
            type="date"
            value={expiry}
            onChange={event => {
              setExpiry(event.target.value);
              setRetry(null);
            }}
            disabled={!!busy || uncertain}
            className={cn(analysisFieldClassName, 'w-[168px]')}
          />
          <Button
            variant="outline"
            disabled={!!busy || !state || uncertain || handoffBlocked}
            onClick={() => void perform('preview')}
          >
            게시 결과 미리보기
          </Button>
          <Button
            disabled={!!busy || !preview || !expiryInstant(expiry) || uncertain || handoffBlocked}
            onClick={() => void perform('publish')}
          >
            {activeLink ? '이 결과로 재게시' : '링크 게시'}
          </Button>
          {published?.active && (
            <Button variant="outline" disabled={!!busy || uncertain} onClick={() => void perform('revoke')}>
              게시 중지
            </Button>
          )}
          {uncertain && retry && (
            <Button variant="outline" disabled={!!busy} onClick={() => void perform('retry')}>
              같은 게시 요청 다시 확인
            </Button>
          )}
        </div>
        {activeLink && (
          <TextField
            label="게시 링크"
            value={`${window.location.origin}/published/${published.uuid}`}
            readOnly
            className={cn(analysisFieldClassName, 'mt-4')}
          />
        )}
        {activeLink && (
          <Button asChild variant="ghost" className="mt-2 self-start">
            <a href={`/published/${published.uuid}`} target="_blank" rel="noopener noreferrer">
              게시된 결과 열기
            </a>
          </Button>
        )}
      </div>
      {busy && (
        <p role="status" className="my-2 text-xs">
          {busy}
        </p>
      )}
      {error && (
        <Notice severity="error" className="mt-4">
          {error}
        </Notice>
      )}
      {notice && (
        <p role="status" className="my-4 text-xs">
          {notice}
        </p>
      )}
      {preview && <SnapshotView snapshot={preview.snapshot} />}
    </main>
  );
}
export default function Publication() {
  return (
    <AnalysisUiProvider>
      <PublicationContent />
    </AnalysisUiProvider>
  );
}
