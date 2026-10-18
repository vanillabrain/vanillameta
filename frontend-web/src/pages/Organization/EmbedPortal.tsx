import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Logo from '@/assets/images/logo.svg?react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import {
  assertOrganizationRequest,
  organizationSessionFence,
  organizationAuthEvent,
  orgGet,
  orgPost,
  organizationError,
  validateScopedRows,
  validateViewCatalog,
  ViewCatalog,
  ViewFilter,
} from './governanceApi';
import { fixedFilters, trustedFrameParent } from './portalState';
export default function EmbedPortal() {
  const params = useParams(),
    orgId = Number(params.orgId),
    dashboardId = Number(params.dashboardId),
    root = `/${orgId}/dashboards/${dashboardId}/view`;
  const [catalog, setCatalog] = useState<ViewCatalog | null>(null),
    [theme, setTheme] = useState('light'),
    [column, setColumn] = useState(''),
    [values, setValues] = useState<unknown[]>([]),
    [chosen, setChosen] = useState(''),
    [filters, setFilters] = useState<ViewFilter[]>([]);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [generation, setGeneration] = useState(0),
    [height, setHeight] = useState(900);
  const request = useRef<AbortController | null>(null),
    observer = useRef<ResizeObserver | null>(null),
    mutation = useRef<MutationObserver | null>(null),
    pending = useRef(false);
  useEffect(() => {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setCatalog(null);
    setValues([]);
    setChosen('');
    setColumn('');
    setFilters([]);
    setError('');
    setBusy(true);
    pending.current = false;
    if (!trustedFrameParent()) {
      setError('신뢰된 같은 origin 포털에서 열어 주세요.');
      setBusy(false);
      return () => abort.abort();
    }
    void orgGet(root, abort.signal)
      .then(v => {
        if (abort.signal.aborted) return;
        assertOrganizationRequest(abort.signal);
        setCatalog(validateViewCatalog(v, dashboardId));
      })
      .catch(e => {
        if (!abort.signal.aborted) setError(organizationError(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    let sessionCheck = organizationSessionFence();
    const changed = (e: StorageEvent) => {
      if (organizationAuthEvent(e)) {
        try {
          sessionCheck();
          return;
        } catch {
          sessionCheck = organizationSessionFence();
        }
        setCatalog(null);
        request.current?.abort();
        setGeneration(v => v + 1);
      }
    };
    window.addEventListener('storage', changed);
    return () => {
      abort.abort();
      request.current?.abort();
      observer.current?.disconnect();
      mutation.current?.disconnect();
      window.removeEventListener('storage', changed);
    };
  }, [root, dashboardId, generation]);
  const candidates = async () => {
    if (!catalog || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    try {
      const rows = validateScopedRows(
        await orgPost(root + '/values', { viewRevision: catalog.viewRevision, column, filters: [] }, abort.signal),
        catalog,
        true,
      );
      if (abort.signal.aborted) return;
      assertOrganizationRequest(abort.signal);
      setValues(rows.map(r => r.value));
      setChosen('');
    } catch (e) {
      if (!abort.signal.aborted) {
        setCatalog(null);
        setValues([]);
        setError(organizationError(e));
      }
    } finally {
      if (!abort.signal.aborted) {
        setBusy(false);
        pending.current = false;
      }
    }
  };
  const search = new URLSearchParams({ embed: '1', theme, filters: fixedFilters(filters) });
  const url = `/organizations/${orgId}/dashboard/${dashboardId}?${search}`;
  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[1600px] space-y-5 bg-background p-4 text-foreground sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/organizations" aria-label="VanillaMeta 조직 목록">
          <Logo width="112" height="32" />
        </Link>
        <Button asChild variant="outline">
          <Link to={`/organizations/${orgId}/dashboard/${dashboardId}`}>전체 조직 보기</Link>
        </Button>
      </header>
      <div>
        <p className="text-xs font-medium text-muted-foreground">AUTHENTICATED PORTAL DEMO</p>
        <h1 className="mt-2 text-2xl font-semibold">조직 분석을 포털 안에서</h1>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        현재 로그인 계정으로 인증합니다. 주소의 사용자·그룹 값으로 권한을 바꾸지 않습니다. 신뢰된 같은 origin의 앱만 지원하며
        테마·필터 변경 시 프레임의 질문과 결과를 새로 시작합니다.
      </p>
      {error && <Notice severity="error">{error}</Notice>}
      {busy && <p role="status">허용된 포털 상태를 확인합니다…</p>}
      {catalog && (
        <>
          <section
            aria-label="포털 임베드 설정"
            className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">임베드 테마</legend>
              <div className="flex gap-2">
                <Button
                  className="min-w-0 flex-1"
                  variant={theme === 'light' ? 'default' : 'outline'}
                  aria-pressed={theme === 'light'}
                  onClick={() => setTheme('light')}
                >
                  밝은 테마
                </Button>
                <Button
                  className="min-w-0 flex-1"
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  aria-pressed={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                >
                  어두운 테마
                </Button>
              </div>
            </fieldset>
            <TextField
              label="포털에서 연결할 필터"
              select
              value={column}
              disabled={busy}
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
            <Button variant="outline" disabled={busy || !column} onClick={() => void candidates()} className="self-end">
              포털 필터 후보 확인
            </Button>
            <TextField
              label="연결할 값"
              select
              value={chosen}
              disabled={busy || !values.length}
              onChange={e => setChosen(e.target.value)}
            >
              <option value="">값 선택</option>
              {values.map((v, i) => (
                <option key={i} value={JSON.stringify(v)}>
                  {v === null ? '(빈 값)' : String(v)}
                </option>
              ))}
            </TextField>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                disabled={busy || !column || !chosen}
                onClick={() => setFilters([{ column, values: [JSON.parse(chosen)] }])}
              >
                포털 필터 적용
              </Button>
              <Button variant="outline" disabled={busy || !filters.length} onClick={() => setFilters([])}>
                포털 필터 초기화
              </Button>
              <Button variant="outline" onClick={() => setGeneration(v => v + 1)}>
                포털 접근 다시 확인
              </Button>
            </div>
            <p className="break-words text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              {catalog.title} ·{' '}
              {filters.length
                ? filters.map(f => f.column + ': ' + f.values.map(String).join(', ')).join(' · ')
                : '전체 기간 · 추가 필터 없음'}
            </p>
          </section>
          <iframe
            key={catalog.viewRevision + url}
            src={url}
            title="인증된 조직 분석 임베드"
            referrerPolicy="same-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
            className="block w-full min-w-0 rounded-xl border bg-card"
            style={{ height }}
            onLoad={e => {
              observer.current?.disconnect();
              mutation.current?.disconnect();
              const frame = e.currentTarget;
              try {
                const doc = frame.contentDocument;
                if (!doc) return;
                const observed = new WeakSet<Element>();
                const resize = () => {
                  const content = doc.querySelector('.studio-published > main'),
                    header = doc.querySelector('.studio-published-header');
                  for (const node of [content, header])
                    if (node && !observed.has(node)) {
                      observer.current?.observe(node);
                      observed.add(node);
                    }
                  // Measure natural content, not the root's 100dvh minimum, so desktop can shrink after mobile.
                  const natural = content
                    ? content.getBoundingClientRect().height + (header?.getBoundingClientRect().height || 0)
                    : doc.body?.scrollHeight || 480;
                  setHeight(Math.min(2400, Math.max(480, Math.ceil(natural) + 2)));
                };
                observer.current = new ResizeObserver(resize);
                observer.current.observe(doc.documentElement);
                mutation.current = new MutationObserver(resize);
                mutation.current.observe(doc.documentElement, { subtree: true, childList: true, characterData: true });
                resize();
              } catch {
                setError('같은 origin의 임베드만 사용할 수 있습니다.');
              }
            }}
          />
        </>
      )}
    </main>
  );
}
