import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, post } from '@/helpers/apiHelper';
import { AnalysisUiProvider, analysisPanelClassName } from '@/components/analysis/AnalysisUi';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import SnapshotView, { Snapshot } from '../../Publication/SnapshotView';
import { errorMessage, responseData } from '../dashboardPreview';

type Column = { name: string; type: string; numeric: boolean; temporal: boolean };
type Draft = {
  originalId: number | string;
  originalTitle: string;
  expectedRevision: string;
  originalSourceId?: number;
  title: string;
  columns: Column[];
  sources: Array<{ id: number; name: string }>;
};
type Profile = { sourceId: number; dataVersion: string; supported: boolean; columns: Column[] };
type Preview = { ticket: string; originalId: number | string; sourceId: number; snapshot: Snapshot };
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
  const originPath = shared ? `/${kind === 'publication' ? 'published' : 'share'}/${uuid}` : `/dashboard/${dashboardId}`;
  const navigate = useNavigate();
  const base = shared
    ? `/bi/reuse/${encodeURIComponent(kind)}/${encodeURIComponent(uuid ?? '')}`
    : `/bi/dashboards/${encodeURIComponent(dashboardId ?? '')}/reuse`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [title, setTitle] = useState('');
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [attempt, setAttempt] = useState<{ ticket: string; requestId: string } | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [busy, setBusy] = useState('원본을 불러오는 중…');
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const request = useRef<AbortController>();
  const pending = useRef(false);
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
    setProfile(null);
    setSourceId('');
    setTitle('');
    setColumnMap({});
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('원본을 불러오는 중…');
    get(base, undefined, { signal: abort.signal })
      .then(async response => {
        if (token !== sequence.current) return;
        const value = responseData(response) as Draft;
        if (
          value.originalId !== (shared ? uuid : Number(dashboardId)) ||
          !Array.isArray(value.columns) ||
          !Array.isArray(value.sources)
        )
          throw new Error('복제할 원본을 확인할 수 없습니다.');
        setDraft(value);
        setTitle(value.title);
        if (shared) return;
        setSourceId(String(value.originalSourceId));
        const source = responseData(
          await get(`/bi/sources/${value.originalSourceId}/profile`, undefined, { signal: abort.signal }),
        );
        if (token !== sequence.current) return;
        if (source.sourceId !== value.originalSourceId) throw new Error('데이터 소스를 확인해 주세요.');
        applyProfile(source, value.columns);
      })
      .catch(failure => {
        if (token === sequence.current) setError(errorMessage(failure));
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
  }, [base, dashboardId, shared, uuid]);
  const selectSource = async (value: string) => {
    if (lock) return;
    invalidate();
    setSourceId(value);
    setProfile(null);
    setColumnMap({});
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
  const valid =
    draft &&
    profile &&
    title.trim() &&
    title.length <= 300 &&
    draft.columns.every(column => {
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
            columnMap,
          },
          { signal: abort.signal, timeout: 120000 },
        ),
      ) as Preview;
      if (token !== sequence.current) return;
      if (
        result.originalId !== draft.originalId ||
        result.sourceId !== profile.sourceId ||
        !result.ticket ||
        result.snapshot?.title !== title ||
        !Array.isArray(result.snapshot?.widgets) ||
        !result.snapshot.widgets.length ||
        result.snapshot.widgets.some(widget => !Array.isArray(widget.datas))
      )
        throw new Error('미리보기를 확인할 수 없습니다.');
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
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy('복사본 저장 중…');
    setError('');
    try {
      const result = responseData(await post(base, attempt, { signal: abort.signal, timeout: 120000 }));
      if (token !== sequence.current) return;
      if (!Number.isSafeInteger(result?.id) || result.id <= 0 || result.id === draft.originalId)
        throw new Error('저장 응답을 확인할 수 없습니다.');
      navigate(`/dashboard/${result.id}`);
    } catch (failure) {
      if (token !== sequence.current) return;
      const status = (failure as any)?.response?.status;
      if (!status || status >= 500) {
        setUnknown(true);
        setError('저장 결과를 확인하지 못했습니다. 초안은 유지됩니다. 같은 저장 요청을 다시 확인해 주세요.');
      } else {
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
      {draft && (
        <>
          <fieldset
            disabled={lock || busy === '원본을 불러오는 중…' || busy === '새 소스를 확인하는 중…'}
            className="m-0 min-w-0 border-0 p-0"
          >
            <div className={analysisPanelClassName}>
              <p className="mb-4 text-sm text-muted-foreground break-words">
                원본: {draft.originalTitle}
                {shared && ' · 내 소스를 선택해 주세요'}
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
                  {draft.sources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </TextField>
              </div>
              {profile && (
                <details className="mt-4" open={draft.columns.some(column => !columnMap[column.name]) || undefined}>
                  <summary className="cursor-pointer text-sm font-medium">
                    열 연결 확인 · {draft.columns.filter(column => columnMap[column.name]).length}/{draft.columns.length}
                  </summary>
                  <p className="my-2 text-xs text-muted-foreground">
                    같은 이름과 호환 타입만 자동 연결했습니다. 다른 이름은 사용할 열을 선택하세요.
                  </p>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {draft.columns.map(column => (
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
            <Button variant="outline" disabled={!valid || !!busy || lock} onClick={() => void makePreview()}>
              전체 미리보기
            </Button>
            <Button disabled={!preview || !attempt || !!busy || unknown} onClick={() => void save()}>
              복사본 저장
            </Button>
            {unknown && (
              <Button variant="outline" disabled={!!busy} onClick={() => void save()}>
                같은 저장 요청 다시 확인
              </Button>
            )}
          </div>
          {preview && <SnapshotView snapshot={preview.snapshot} context="reuse" />}
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
