import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import {
  Organization,
  assertOrganizationRequest,
  organizationAuthEvent,
  organizationSessionFence,
  orgGet,
  orgPost,
  organizationError,
} from './governanceApi';

export default function Organizations() {
  const [params] = useSearchParams();
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [org, setOrg] = useState('');
  const [state, setState] = useState<any>(null),
    [views, setViews] = useState<any[]>([]),
    [dashboards, setDashboards] = useState<any[]>([]);
  const [name, setName] = useState(''),
    [groupName, setGroupName] = useState(''),
    [group, setGroup] = useState(''),
    [login, setLogin] = useState('');
  const [dashboard, setDashboard] = useState(params.get('dashboardId') || ''),
    [options, setOptions] = useState<any>(null);
  const [displayTitle, setDisplayTitle] = useState(''),
    [allowedColumns, setAllowedColumns] = useState<string[]>([]),
    [blockIds, setBlockIds] = useState<string[]>([]);
  const [rowColumn, setRowColumn] = useState(''),
    [rowValue, setRowValue] = useState(''),
    [allowAi, setAllowAi] = useState(false),
    [allowExport, setAllowExport] = useState(false),
    [blockLinks, setBlockLinks] = useState(false);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0),
    pending = useRef(false);
  const clearOptions = () => {
    setOptions(null);
    setAllowedColumns([]);
    setBlockIds([]);
    setRowColumn('');
    setRowValue('');
    setBlockLinks(false);
    setAllowAi(false);
    setAllowExport(false);
    setDisplayTitle('');
  };
  useEffect(
    () => () => {
      sequence.current += 1;
      request.current?.abort();
    },
    [],
  );
  const run = async (kind: string, fn: (signal: AbortSignal) => Promise<void>) => {
    if (pending.current) return;
    const token = sequence.current,
      abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      await fn(abort.signal);
    } catch (failure) {
      if (!abort.signal.aborted && sequence.current === token) setError(organizationError(failure));
    } finally {
      if (sequence.current === token) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const loadOrganizations = async (signal: AbortSignal) => {
    const rows = await orgGet('', signal);
    if (signal.aborted) return;
    assertOrganizationRequest(signal);
    if (
      !Array.isArray(rows) ||
      rows.length > 50 ||
      !rows.every(r => Number.isSafeInteger(r.id) && typeof r.name === 'string' && ['admin', 'viewer'].includes(r.role))
    )
      throw new Error('organizations');
    setOrganizations(rows);
  };
  useEffect(() => {
    let initial = new AbortController();
    const load = () => {
      const signal = initial.signal;
      void loadOrganizations(signal).catch(e => {
        if (!signal.aborted) setError(organizationError(e));
      });
    };
    load();
    let sessionCheck = organizationSessionFence();
    const reset = (e: StorageEvent) => {
      if (!organizationAuthEvent(e)) return;
      try {
        sessionCheck();
        return;
      } catch {
        sessionCheck = organizationSessionFence();
      }
      initial.abort();
      initial = new AbortController();
      sequence.current += 1;
      request.current?.abort();
      pending.current = false;
      setOrganizations([]);
      setOrg('');
      setState(null);
      setViews([]);
      setDashboards([]);
      setGroup('');
      setLogin('');
      setName('');
      setGroupName('');
      setBusy('');
      setMessage('');
      setError('');
      clearOptions();
      load();
    };
    window.addEventListener('storage', reset);
    return () => {
      initial.abort();
      window.removeEventListener('storage', reset);
    };
  }, []);
  const loadState = async (id: string, signal: AbortSignal) => {
    const result = await orgGet(`/${id}/admin`, signal);
    if (signal.aborted) return;
    assertOrganizationRequest(signal);
    if (
      result?.id !== Number(id) ||
      !Array.isArray(result.groups) ||
      !Array.isArray(result.members) ||
      !Array.isArray(result.policies)
    )
      throw new Error('admin');
    setState(result);
  };
  const selectOrg = (id: string) => {
    sequence.current += 1;
    request.current?.abort();
    pending.current = false;
    setBusy('');
    setOrg(id);
    setState(null);
    setViews([]);
    setDashboards([]);
    setGroup('');
    clearOptions();
    if (!id) return;
    const chosen = organizations.find(o => o.id === Number(id));
    void run('organization', async signal => {
      if (chosen?.role === 'admin') {
        await loadState(id, signal);
        const rows = await orgGet(`/${id}/owned-dashboards`, signal);
        if (signal.aborted) return;
        assertOrganizationRequest(signal);
        if (!Array.isArray(rows?.dashboards)) throw new Error('dashboards');
        setDashboards(rows.dashboards);
      } else {
        const rows = await orgGet(`/${id}/views`, signal);
        if (signal.aborted) return;
        assertOrganizationRequest(signal);
        if (!Array.isArray(rows) || !rows.every(r => Number.isSafeInteger(r.dashboardId) && typeof r.title === 'string'))
          throw new Error('views');
        setViews(rows);
      }
    });
  };
  const createOrg = () =>
    run('create', async signal => {
      await orgPost('', { name }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setName('');
      await loadOrganizations(signal);
      setMessage('조직을 만들었습니다. 목록에서 선택해 그룹과 접근 범위를 설정하세요.');
    });
  const addGroup = () =>
    run('group', async signal => {
      await orgPost(`/${org}/groups`, { name: groupName }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      setGroupName('');
      await loadState(org, signal);
      setMessage('그룹을 준비했습니다.');
    });
  const member = (memberLogin: string, groupId: number, active: boolean, version: number) =>
    run('member', async signal => {
      await orgPost(`/${org}/members`, { login: memberLogin, groupId, active, expectedVersion: version }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      await loadState(org, signal);
      setMessage(active ? '읽기 전용 구성원을 등록했습니다.' : '구성원의 다음 접근을 차단했습니다.');
    });
  const loadOptions = () =>
    run('options', async signal => {
      clearOptions();
      const value = await orgGet(`/${org}/dashboards/${dashboard}/options`, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      if (value?.dashboardId !== Number(dashboard) || !Array.isArray(value.columns) || !Array.isArray(value.blocks))
        throw new Error('options');
      setOptions(value);
      setDisplayTitle(value.title);
    });
  const savePolicy = () =>
    run('policy', async signal => {
      const old = state.policies.find(p => p.groupId === Number(group) && p.dashboardId === Number(dashboard));
      await orgPost(
        `/${org}/dashboards/${dashboard}/policy`,
        {
          groupId: Number(group),
          displayTitle,
          columns: allowedColumns,
          blockIds,
          mandatory: [{ column: rowColumn, values: [rowValue] }],
          allowAi,
          allowExport,
          expiresAt: null,
          active: true,
          expectedVersion: old?.version ?? 0,
          expectedDashboardRevision: options.dashboardRevision,
          expectedSourceRevision: options.sourceRevision,
          blockPublicLinks: blockLinks,
        },
        signal,
      );
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      await loadState(org, signal);
      setMessage('그룹의 조직 보기 정책을 저장했습니다. 일반 공개 링크는 차단됩니다.');
      clearOptions();
    });
  const revoke = (policy: any) =>
    run('revoke', async signal => {
      await orgPost(`/${org}/policies/${policy.id}/revoke`, { expectedVersion: policy.version }, signal);
      if (signal.aborted) return;
      assertOrganizationRequest(signal);
      await loadState(org, signal);
      setMessage('정책을 중지했습니다. 기존 일반 공개 링크는 다시 열리지 않습니다.');
    });
  const toggle = (values: string[], value: string, set: (v: string[]) => void) =>
    set(values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
  const admin = organizations.find(o => o.id === Number(org))?.role === 'admin';
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">ORGANIZATION</p>
          <h1 className="text-2xl font-semibold">조직 분석</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard">내 대시보드</Link>
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        조직 관리자는 그룹별 지표·행·열 범위를 정하고, 구성원은 허용된 분석을 읽고 질문할 수 있습니다.
      </p>
      {error && <Notice severity="error">{error}</Notice>}
      {message && <Notice severity="info">{message}</Notice>}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          요청과 접근 상태를 확인합니다…
        </p>
      )}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <TextField label="내 조직" select disabled={!!busy} value={org} onChange={e => selectOrg(e.target.value)}>
          <option value="">조직 선택</option>
          {organizations.map(o => (
            <option key={o.id} value={o.id}>
              {o.name} · {o.role === 'admin' ? '관리자' : '읽기 전용'}
            </option>
          ))}
        </TextField>
        <details>
          <summary className="cursor-pointer py-2 text-sm font-medium">새 조직 만들기</summary>
          <div className="grid gap-3 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <TextField
              label="새 조직 이름"
              value={name}
              maxLength={100}
              disabled={!!busy}
              onChange={e => setName(e.target.value)}
            />
            <Button disabled={!!busy || !name.trim()} onClick={() => void createOrg()}>
              조직 만들기
            </Button>
          </div>
        </details>
      </section>
      {org && !admin && !busy && (
        <section aria-label="허용된 조직 분석" className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">내게 허용된 분석</h2>
          {views.length ? (
            views.map(v => (
              <Button key={v.dashboardId} asChild variant="outline">
                <Link to={`/organizations/${org}/dashboard/${v.dashboardId}`}>{v.title}</Link>
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              현재 조회할 수 있는 분석이 없습니다. 관리자에게 그룹 정책을 확인해 주세요.
            </p>
          )}
        </section>
      )}
      {admin && state && (
        <>
          <section aria-label="조직 그룹 관리" className="space-y-3 rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold">그룹과 구성원</h2>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField
                label="새 그룹 이름"
                value={groupName}
                maxLength={100}
                disabled={!!busy}
                onChange={e => setGroupName(e.target.value)}
              />
              <Button disabled={!!busy || !groupName.trim()} onClick={() => void addGroup()}>
                그룹 만들기
              </Button>
            </div>
            <TextField
              label="관리할 그룹"
              select
              value={group}
              disabled={!!busy}
              onChange={e => {
                setGroup(e.target.value);
                clearOptions();
              }}
            >
              <option value="">그룹 선택</option>
              {state.groups
                .filter(g => g.active)
                .map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </TextField>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField
                label="추가할 구성원의 로그인 ID"
                value={login}
                disabled={!!busy}
                onChange={e => setLogin(e.target.value)}
              />
              <Button
                disabled={!!busy || !group || !login.trim()}
                onClick={() =>
                  void member(login, Number(group), true, state.members.find(m => m.login === login)?.version ?? 0)
                }
              >
                읽기 전용으로 등록
              </Button>
            </div>
            <ul className="space-y-2">
              {state.members.map(m => (
                <li key={m.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border p-3">
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {m.login} · {m.role === 'admin' ? '관리자' : state.groups.find(g => g.id === m.groupId)?.name} ·{' '}
                    {m.active ? '활성' : '중지'}
                  </span>
                  {m.role === 'viewer' && m.active && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void member(m.login, m.groupId, false, m.version)}
                    >
                      접근 회수
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="조직 분석 정책" className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold">분석 접근 범위</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              선택한 그룹에만 읽기 권한을 부여합니다. 원본 소스 소유권·편집 권한은 넘기지 않습니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextField
                label="정책을 적용할 내 분석"
                select
                value={dashboard}
                disabled={!!busy}
                onChange={e => {
                  setDashboard(e.target.value);
                  clearOptions();
                }}
              >
                <option value="">분석 선택</option>
                {dashboards.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </TextField>
              <Button variant="outline" disabled={!!busy || !dashboard || !group} onClick={() => void loadOptions()}>
                지표·열 확인
              </Button>
            </div>
            {options && (
              <div className="min-w-0 space-y-4 border-t pt-4">
                <TextField
                  label="그룹에 표시할 분석 이름"
                  value={displayTitle}
                  maxLength={100}
                  disabled={!!busy}
                  onChange={e => setDisplayTitle(e.target.value)}
                />
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">허용할 원본 열</legend>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    지표 계산과 분류에 필요한 열을 포함하세요. 허용하지 않은 열은 상세·필터·AI·내보내기에도 제공하지
                    않습니다.
                  </p>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {options.columns.map(c => (
                      <label key={c.name} className="flex min-w-0 items-center gap-2 rounded-md border p-3 text-sm">
                        <Checkbox
                          aria-label={`허용 열: ${c.name}`}
                          checked={allowedColumns.includes(c.name)}
                          disabled={!!busy}
                          onCheckedChange={() => toggle(allowedColumns, c.name, setAllowedColumns)}
                        />
                        <span className="min-w-0 break-words">
                          {c.name} · {c.type}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">허용할 지표·차트</legend>
                  {options.blocks.map(b => (
                    <label key={b.id} className="flex min-w-0 items-center gap-2 rounded-md border p-3 text-sm">
                      <Checkbox
                        aria-label={`허용 블록: ${b.title}`}
                        checked={blockIds.includes(b.id)}
                        disabled={!!busy || !b.supported}
                        onCheckedChange={() => toggle(blockIds, b.id, setBlockIds)}
                      />
                      <span className="min-w-0 break-words">
                        {b.title}
                        {!b.supported ? ' · 구조화 계산 확인 필요' : ''}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="필수 행 범위의 기준 열"
                    select
                    value={rowColumn}
                    disabled={!!busy}
                    onChange={e => setRowColumn(e.target.value)}
                  >
                    <option value="">문자열 키 열 선택</option>
                    {options.columns
                      .filter(c => c.type === 'VARCHAR')
                      .map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </TextField>
                  <TextField
                    label="이 그룹에 허용할 값"
                    value={rowValue}
                    maxLength={256}
                    disabled={!!busy}
                    onChange={e => setRowValue(e.target.value)}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  필수 행 범위는 서버에서 항상 적용합니다. 기준 열을 숨겨도 행 범위는 유지됩니다. 이 화면은 단일 문자열 키
                  범위를 설정합니다.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={allowAi} disabled={!!busy} onCheckedChange={v => setAllowAi(v === true)} />
                    AI 사용 허용
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={allowExport} disabled={!!busy} onCheckedChange={v => setAllowExport(v === true)} />
                    집계 CSV 허용
                  </label>
                </div>
                <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">
                  <Checkbox
                    aria-label="일반 공개 링크 차단 확인"
                    checked={blockLinks}
                    disabled={!!busy}
                    onCheckedChange={v => setBlockLinks(v === true)}
                  />
                  <span>
                    이 분석의 일반 공개·공유 링크를 차단하고 조직 보기만 사용합니다. 그룹 접근을 회수해도 공개 링크가
                    자동으로 다시 열리지 않음을 확인했습니다.
                  </span>
                </label>
                <Button
                  disabled={
                    !!busy ||
                    !blockLinks ||
                    !group ||
                    !allowedColumns.length ||
                    !blockIds.length ||
                    !rowColumn ||
                    !rowValue ||
                    !displayTitle.trim()
                  }
                  onClick={() => void savePolicy()}
                >
                  그룹 접근 정책 저장
                </Button>
              </div>
            )}
            <ul className="space-y-2">
              {state.policies.map(p => (
                <li key={p.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border p-3">
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {p.displayTitle} · {state.groups.find(g => g.id === p.groupId)?.name} · v{p.version} ·{' '}
                    {p.active ? '활성' : '중지'}
                  </span>
                  {p.active && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void revoke(p)}>
                      정책 중지
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
