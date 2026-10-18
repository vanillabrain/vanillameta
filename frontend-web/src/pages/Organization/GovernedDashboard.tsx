import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import IconLogo from '@/assets/images/logo.svg?react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { PublishedBlockView } from '@/pages/Dashboard/Studio/PublishedDashboard';
import {
  orgGet,
  organizationSessionFence,
  organizationAuthEvent,
  assertOrganizationRequest,
  orgPost,
  organizationError,
  validateViewCatalog,
  validateViewResult,
  validateScopedRows,
  validateScopedCsv,
  ViewCatalog,
  ViewFilter,
  ViewResult,
} from './governanceApi';
import '@/pages/Dashboard/Studio/studio.css';
import ConditionReports from './ConditionReports';
import { fixedFilters, frameFilters, readFrameState, trustedFrameParent } from './portalState';

export default function GovernedDashboard() {
  const params = useParams(),
    location = useLocation();
  const frame = useMemo(() => {
    try {
      return { state: readFrameState(location.search), error: '' };
    } catch {
      return { state: null, error: '임베드 상태·허용 필터를 확인해 주세요.' };
    }
  }, [location.search]);
  const orgId = Number(params.orgId),
    dashboardId = Number(params.dashboardId);
  const root = `/${orgId}/dashboards/${dashboardId}/view`;
  const [catalog, setCatalog] = useState<ViewCatalog | null>(null),
    [data, setData] = useState<ViewResult | null>(null),
    [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [filters, setFilters] = useState<ViewFilter[]>([]),
    [column, setColumn] = useState(''),
    [values, setValues] = useState<unknown[]>([]),
    [chosen, setChosen] = useState('');
  const [question, setQuestion] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0),
    lastChecked = useRef(0),
    pending = useRef(false),
    acceptedScope = useRef<string | null>(null);
  const begin = useCallback((kind: string) => {
    request.current?.abort();
    sequence.current += 1;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setData(null);
    setRows(null);
    setError('');
    setNotice('');
    setBusy(kind);
    return { abort, token: sequence.current };
  }, []);
  const load = useCallback(async () => {
    const { abort, token } = begin('load');
    setCatalog(null);
    setFilters([]);
    setValues([]);
    setColumn('');
    setChosen('');
    try {
      if (frame.error || !frame.state || !trustedFrameParent()) throw new Error('untrusted embed state');
      const c = validateViewCatalog(await orgGet(root, abort.signal), dashboardId);
      if (abort.signal.aborted || sequence.current !== token) return;
      assertOrganizationRequest(abort.signal);
      if (acceptedScope.current && acceptedScope.current !== c.viewRevision) setQuestion('');
      const result = validateViewResult(
        await orgPost(
          root + '/query',
          { viewRevision: c.viewRevision, filters: frameFilters(frame.state.filters, c) },
          abort.signal,
        ),
        c,
      );
      if (abort.signal.aborted || sequence.current !== token) return;
      assertOrganizationRequest(abort.signal);
      acceptedScope.current = c.viewRevision;
      setCatalog(c);
      setFilters(result.filters);
      setData(result);
      lastChecked.current = Date.now();
    } catch (failure) {
      if (!abort.signal.aborted && sequence.current === token) setError(organizationError(failure));
    } finally {
      if (sequence.current === token) {
        pending.current = false;
        setBusy('');
      }
    }
  }, [root, dashboardId, begin, frame]);
  useEffect(() => {
    setQuestion('');
    void load();
    const onFocus = () => {
      if (Date.now() - lastChecked.current > 30000) void load();
    };
    let sessionCheck = organizationSessionFence();
    const onStorage = (e: StorageEvent) => {
      if (organizationAuthEvent(e)) {
        try {
          sessionCheck();
          return;
        } catch {
          sessionCheck = organizationSessionFence();
        }
        setQuestion('');
        void load();
      }
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void load();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onShow);
    return () => {
      sequence.current += 1;
      request.current?.abort();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onShow);
    };
  }, [load]);
  useEffect(() => {
    if (!frame.state?.embedded) return;
    const prior = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', frame.state.theme === 'dark');
    return () => {
      document.documentElement.classList.toggle('dark', prior);
    };
  }, [frame]);
  const action = async (kind: string, fn: (c: ViewCatalog, signal: AbortSignal) => Promise<void>) => {
    if (!catalog || pending.current) return;
    const c = catalog,
      previous = data,
      { abort, token } = begin(kind);
    try {
      await fn(c, abort.signal);
      if (!abort.signal.aborted && token === sequence.current) {
        lastChecked.current = Date.now();
        if (['values', 'rows', 'export'].includes(kind)) setData(previous);
      }
    } catch (failure) {
      if (!abort.signal.aborted && token === sequence.current) {
        setCatalog(null);
        setValues([]);
        setError(organizationError(failure));
      }
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const query = (next: ViewFilter[]) =>
    action('query', async (c, signal) => {
      if (fixedFilters(next) !== fixedFilters(filters)) setQuestion('');
      const r = validateViewResult(
        await orgPost(root + '/query', { viewRevision: c.viewRevision, filters: next }, signal),
        c,
      );
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setFilters(r.filters);
      setData(r);
    });
  const candidates = () =>
    action('values', async (c, signal) => {
      const result = await orgPost(root + '/values', { viewRevision: c.viewRevision, column, filters }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setValues(validateScopedRows(result, c, true).map(r => r.value));
      setChosen('');
      setNotice('선택한 열의 허용된 후보값입니다. 값을 고른 뒤 필터를 적용하세요.');
    });
  const details = () =>
    action('rows', async (c, signal) => {
      const result = await orgPost(root + '/rows', { viewRevision: c.viewRevision, filters }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setRows(validateScopedRows(result, c));
      setNotice('허용된 열 · 처음 최대 50행. 전체 집계는 지표 보기에서 확인하세요.');
    });
  const exportCsv = () =>
    action('export', async (c, signal) => {
      const result = await orgPost(root + '/export', { viewRevision: c.viewRevision, filters }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      const csv = validateScopedCsv(result, c);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'organization-analysis.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice('허용된 집계만 CSV로 내보냈습니다. 다시 조회해 최신 결과를 확인할 수 있습니다.');
    });
  const ask = () =>
    action('assistant', async (c, signal) => {
      const r = validateViewResult(
        await orgPost(root + '/assistant', { viewRevision: c.viewRevision, question, filters }, signal),
        c,
      );
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setFilters(r.filters);
      setData(r);
      setNotice('AI가 허용된 지표·조건을 선택했습니다. 숫자는 서버의 실제 계산 결과입니다.');
    });
  if (frame.error || !trustedFrameParent())
    return <Notice severity="error">신뢰된 같은 origin에서 지원하는 임베드 상태로 열어 주세요.</Notice>;
  return (
    <div className="studio-screen studio-published min-w-0">
      <header className="studio-published-header">
        <Link to="/dashboard" className="studio-brand dark:rounded-md dark:bg-white dark:px-2" aria-label="VanillaMeta">
          <IconLogo width="112" height="32" />
        </Link>
        <span>조직 분석 · 읽기 전용</span>
        <div className="studio-published-actions">
          <Button asChild variant="outline">
            <Link to="/organizations">조직 목록</Link>
          </Button>
          {!frame.state?.embedded && (
            <Button asChild variant="outline">
              <Link to={`/organizations/${orgId}/embed/${dashboardId}`}>포털 안에서 보기</Link>
            </Button>
          )}
          <Button variant="outline" disabled={!!busy} onClick={() => void load()}>
            접근·데이터 다시 확인
          </Button>
        </div>
      </header>
      <main className="min-w-0" aria-busy={!!busy}>
        {busy && (
          <p role="status">
            {busy === 'assistant'
              ? '허용된 범위에서 gpt-6-luna가 조회 조건을 준비합니다…'
              : '접근 권한과 결과를 확인합니다…'}
          </p>
        )}
        {error && <Notice severity="error">{error}</Notice>}
        {notice && <Notice severity="info">{notice}</Notice>}
        {catalog && (
          <>
            <div className="studio-published-heading">
              <div>
                <p className="studio-eyebrow">{catalog.organization}</p>
                <h1>{catalog.title}</h1>
              </div>
              <span className="studio-published-badge">{catalog.scope}</span>
            </div>
            <p className="my-3 text-sm text-muted-foreground">
              모든 조회·상세·내보내기에 같은 접근 범위를 적용합니다. 화면 필터로 조직의 행 범위를 넓힐 수 없습니다.
            </p>
            <section aria-label="조직 분석 필터" className="my-4 min-w-0 space-y-3 rounded-xl border bg-card p-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
                <TextField
                  label="허용된 필터 열"
                  select
                  disabled={!!busy}
                  value={column}
                  onChange={e => {
                    setColumn(e.target.value);
                    setValues([]);
                    setChosen('');
                  }}
                >
                  <option value="">열 선택</option>
                  {catalog.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </TextField>
                <Button variant="outline" disabled={!!busy || !column} onClick={() => void candidates()}>
                  후보값 확인
                </Button>
                <TextField
                  label="필터 값"
                  select
                  value={chosen}
                  disabled={!!busy || !values.length}
                  onChange={e => setChosen(e.target.value)}
                >
                  <option value="">값 선택</option>
                  {values.map((v, i) => (
                    <option key={i} value={JSON.stringify(v)}>
                      {v === null ? '(빈 값)' : String(v)}
                    </option>
                  ))}
                </TextField>
                <Button
                  disabled={!!busy || !column || !chosen}
                  onClick={() =>
                    void query([...filters.filter(f => f.column !== column), { column, values: [JSON.parse(chosen)] }])
                  }
                >
                  필터 적용
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map(f => (
                  <Button
                    key={f.column}
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => void query(filters.filter(v => v.column !== f.column))}
                  >
                    {f.column}: {f.values.map(String).join(', ')} ×
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!!busy} onClick={() => void query(filters)}>
                  지표 보기
                </Button>
                <Button variant="outline" disabled={!!busy} onClick={() => void details()}>
                  허용된 원본 행
                </Button>
                {catalog.capabilities.export && (
                  <Button variant="outline" disabled={!!busy} onClick={() => void exportCsv()}>
                    집계 CSV 내보내기
                  </Button>
                )}
              </div>
            </section>
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                {data?.blocks.map(block => (
                  <article key={block.id} className="studio-published-card min-w-0" aria-label={block.title + ' 조직 블록'}>
                    <PublishedBlockView block={block} />
                  </article>
                ))}
                {rows && (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="허용된 원본 행 표"
                    className="max-h-[480px] min-w-0 overflow-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <table className="w-full text-left text-sm">
                      <caption className="p-3 text-left">허용된 열 · 처음 최대 50행</caption>
                      <thead>
                        <tr>
                          {catalog.columns.map(c => (
                            <th key={c.name} scope="col" className="whitespace-nowrap border-b p-3">
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            {catalog.columns.map(c => (
                              <td key={c.name} className="whitespace-nowrap border-b p-3">
                                {r[c.name] === null ? '—' : String(r[c.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!frame.state?.embedded && <ConditionReports orgId={orgId} dashboardId={dashboardId} catalog={catalog} />}
              </div>
              <aside aria-label="조직 AI Assistant" className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
                <h2 className="text-base font-semibold">AI Assistant</h2>
                {catalog.capabilities.ai ? (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Codex · gpt-6-luna · 입력한 질문과 허용된 지표·열 정보만 전달합니다. 원본 행은 자동 전송하지 않습니다.
                    </p>
                    <TextField
                      label="허용된 분석에 질문"
                      multiline
                      minRows={4}
                      maxLength={1000}
                      value={question}
                      disabled={!!busy}
                      onChange={e => setQuestion(e.target.value)}
                    />
                    <Button disabled={!!busy || !question.trim()} onClick={() => void ask()}>
                      질문으로 조회
                    </Button>
                    {busy === 'assistant' && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          sequence.current += 1;
                          request.current?.abort();
                          pending.current = false;
                          setBusy('');
                          setNotice('AI 요청을 취소했습니다. 질문은 유지됩니다.');
                        }}
                      >
                        취소
                      </Button>
                    )}
                  </>
                ) : (
                  <Notice severity="info">조직 정책에 따라 AI 사용이 제한됩니다.</Notice>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
