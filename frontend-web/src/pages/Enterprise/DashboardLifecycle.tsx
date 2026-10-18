import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import {
  DashboardLifecycleState,
  DashboardLifecycleRequest,
  DashboardLifecycleReceipt,
  dashboardLifecycleLabels,
  fetchDashboardLifecycle,
  saveDashboardLifecycle,
  dashboardLifecyclePendingKey,
  readDashboardLifecyclePending,
  writeDashboardLifecyclePending,
  removeDashboardLifecyclePending,
  isDashboardLifecycleStale,
} from '@/api/dashboardLifecycleService';
type Props = { dashboardId: number; organizationId: number; dashboardLabel?: string };
const label = (active: boolean) => (active ? '활성' : '비활성');
const tools = 'min-w-0 max-w-full whitespace-normal break-words text-sm';
export default function DashboardLifecycle(props: Props) {
  const [, refresh] = useState(0);
  const scope = personalLibrarySessionScope();
  const previousScope = useRef(scope);
  useLayoutEffect(() => {
    const previous = previousScope.current;
    previousScope.current = scope;
    if (!previous || previous === scope) return;
    // A different tab cannot clear this tab's sessionStorage. Remove only our old-session intent.
    try {
      Object.keys(sessionStorage)
        .filter(key => key.includes(':dashboard-lifecycle:') && key.endsWith(`:${encodeURIComponent(previous)}`))
        .forEach(key => removeDashboardLifecyclePending(key));
    } catch {
      /* New scope already hides private state even when storage is unavailable. */
    }
  }, [scope]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_ACCESS_TOKEN || event.key === 'vm:editor-draft-auth:v1')
        refresh(value => value + 1);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  return (
    <DashboardLifecyclePanel
      key={JSON.stringify([scope, props.organizationId, props.dashboardId])}
      {...props}
      scope={scope}
    />
  );
}
function DashboardLifecyclePanel({ dashboardId, organizationId, dashboardLabel, scope }: Props & { scope: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [current, setCurrent] = useState<DashboardLifecycleState | null>(null);
  const [receipt, setReceipt] = useState<DashboardLifecycleReceipt | null>(null);
  const [target, setTarget] = useState('');
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState<DashboardLifecycleRequest | null>(null);
  const frozen = useRef<DashboardLifecycleRequest | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const isCurrent = () => alive.current && !!scope && personalLibrarySessionScope() === scope;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setStorageReady(false);
    dashboardLifecyclePendingKey(dashboardId, organizationId)
      .then(key => {
        if (cancelled || !isCurrent()) return;
        setStorageKey(key);
        const value = readDashboardLifecyclePending(key, dashboardId, organizationId);
        frozen.current = value;
        setPending(value);
        setStorageReady(true);
      })
      .catch(() => {
        if (!cancelled && isCurrent()) setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, organizationId, scope]);
  const read = async () => {
    if (!isCurrent() || lock.current || reading || !storageReady) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    generation.current += 1;
    const request = generation.current;
    setCurrent(null);
    setAck(false);
    setReading(true);
    setError('');
    try {
      const value = await fetchDashboardLifecycle(dashboardId, controller.signal);
      if (controller.signal.aborted || !isCurrent() || generation.current !== request) return;
      if (value.organizationId !== organizationId || (frozen.current && value.actorId !== frozen.current.expectedActorId))
        throw new Error('scope mismatch');
      setCurrent(value);
    } catch {
      if (!controller.signal.aborted && isCurrent() && generation.current === request)
        setError('현재 상태와 영향을 확인하지 못했습니다. 현재 계정의 관리 권한·조직을 확인하고 다시 읽어 주세요.');
    } finally {
      if (isCurrent() && generation.current === request) setReading(false);
    }
  };
  const save = async () => {
    if (!isCurrent() || !current || current.organizationId !== organizationId || lock.current || reading || !storageReady)
      return;
    const existing = frozen.current;
    if (
      existing &&
      (existing.expectedActorId !== current.actorId || existing.expectedOrganizationId !== current.organizationId)
    )
      return;
    if (!existing && (target === '' || !ack)) return;
    const body: DashboardLifecycleRequest =
      existing ??
      Object.freeze({
        requestId: crypto.randomUUID(),
        expectedActorId: current.actorId,
        expectedOrganizationId: current.organizationId,
        expectedVersion: current.version,
        expectedRevision: current.revision,
        active: target === 'active',
        acknowledgedImpact: true,
      });
    if (!existing && !writeDashboardLifecyclePending(storageKey, dashboardId, body)) {
      setError('미확정 요청을 보관하지 못해 저장을 시작하지 않았습니다. 세션 저장소를 확인해 주세요.');
      return;
    }
    frozen.current = body;
    setPending(body);
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const value = await saveDashboardLifecycle(dashboardId, body);
      if (!isCurrent()) return;
      removeDashboardLifecyclePending(storageKey);
      frozen.current = null;
      setPending(null);
      setReceipt(value);
      setCurrent(null);
      setTarget('');
      setAck(false);
    } catch (cause: any) {
      if (!isCurrent()) return;
      const status = cause?.response?.status;
      if (isDashboardLifecycleStale(cause) || status === 400 || status === 422) {
        removeDashboardLifecyclePending(storageKey);
        frozen.current = null;
        setPending(null);
        setCurrent(null);
        setAck(false);
        setError('저장 기준이나 영향이 변경되었거나 요청이 거절되었습니다. 현재 상태·영향을 다시 읽고 동의해 주세요.');
      } else {
        if (status === 401 || status === 403) {
          setCurrent(null);
          setAck(false);
        }
        setError('상태 변경 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인해 주세요.');
      }
    } finally {
      lock.current = false;
      if (isCurrent()) setSaving(false);
    }
  };
  return (
    <section
      aria-label="대시보드 활성 상태"
      className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className={tools}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(value => !value)}
        >
          {open ? '대시보드 상태 관리 접기' : '대시보드 상태 관리 열기'}
        </Button>
        {current && (
          <span className="min-w-0 break-words">
            {dashboardLabel ? `${dashboardLabel} · ` : ''}대시보드 #{dashboardId}
          </span>
        )}
      </div>
      <div id={panelId} className="min-w-0 space-y-3" hidden={!open}>
        <Notice severity="warning">
          비활성화는 새 보호 요청을 차단하며 보관·영구 삭제와 다릅니다. 정의·권한·전달·게시·독립 사본을 삭제하지 않습니다.
          이미 받은 파일·화면이나 진행 중인 조회는 회수하지 않습니다. 복원 후에도 현재 소스·권한·게시의 만료·중지를 다시
          확인하며 자동 재게시하지 않습니다.
        </Notice>
        {!scope && <Notice severity="warning">로그인한 계정을 확인해 주세요.</Notice>}
        {error && <Notice severity="error">{error}</Notice>}
        {reading && <p role="status">현재 상태·영향 확인 중…</p>}
        {pending && (
          <p role="status">
            미확정 상태 변경 요청을 보존했습니다. 새 상태 저장은 잠겨 있습니다. 새로고침 후에는 현재 관리 권한을 읽고 같은
            요청만 명시 확인합니다.
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className={tools}
          disabled={!scope || reading || saving || !storageReady}
          onClick={() => void read()}
        >
          현재 상태·영향 읽기
        </Button>
        {current && (
          <>
            <div role="region" aria-label="현재 대시보드 상태" className="min-w-0 space-y-2">
              <p>
                현재 상태: {label(current.active)} · 버전 {current.version}
              </p>
              <ul className="min-w-0 space-y-1">
                {current.dependencies.map(entry => (
                  <li key={entry.kind} className="flex min-w-0 flex-wrap justify-between gap-2">
                    <span className="min-w-0 break-words">{dashboardLifecycleLabels[entry.kind]}</span>
                    <span>{entry.count}개</span>
                  </li>
                ))}
              </ul>
              <p>영향 건수는 비활성화를 막지 않습니다. 독립 사본은 이 영향에 포함하지 않습니다.</p>
            </div>
            <label className="flex min-w-0 flex-wrap items-center gap-2">
              저장할 대시보드 상태
              <select
                aria-label="저장할 대시보드 상태"
                className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
                value={target}
                disabled={saving || !!pending}
                onChange={event => {
                  setTarget(event.target.value);
                  setAck(false);
                }}
              >
                <option value="">선택</option>
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </label>
            {target && (
              <p role="status">
                변경 요약: 현재 {label(current.active)} → 요청 {label(target === 'active')}
                {(target === 'active') === current.active ? ' · 같은 상태도 새 버전으로 저장합니다.' : ''}
              </p>
            )}
            <label className="flex min-h-9 min-w-0 items-start gap-2 break-words">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0"
                checked={ack}
                disabled={saving || !!pending || !target}
                onChange={event => setAck(event.target.checked)}
              />
              영향을 확인하고 대시보드 상태 변경에 동의합니다.
            </label>
          </>
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            className={tools}
            disabled={saving || reading || !current || !!pending || !target || !ack || !storageReady}
            onClick={() => void save()}
          >
            대시보드 상태 저장
          </Button>
          {pending && (
            <Button
              size="sm"
              variant="outline"
              className={tools}
              disabled={saving || reading || !current || !storageReady}
              onClick={() => void save()}
            >
              같은 요청으로 상태 변경 결과 확인
            </Button>
          )}
        </div>
        {saving && <p role="status">상태 변경 결과 확인 중…</p>}
        {receipt && (
          <div role="region" aria-label="과거 상태 변경 영수증" className="min-w-0 space-y-1 break-words">
            <p>
              영수증 #{receipt.receiptId} · {label(receipt.active)} · 버전 {receipt.version}
              {receipt.replayed ? ' · 과거 요청 재확인' : ''}
            </p>
            <p>과거 저장 결과이며 현재 상태·접근권의 증명이 아닙니다. 현재 상태·영향을 별도로 다시 읽어 주세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
