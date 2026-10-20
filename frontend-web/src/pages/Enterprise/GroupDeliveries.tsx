import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { enterpriseError } from '@/api/enterpriseService';
import { fetchGroups, GroupSummary } from '@/api/groupService';
import { fetchGroupDeliveries, saveGroupDelivery, GroupDelivery } from '@/api/groupDeliveryService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import {
  clearGroupDeliveryPending,
  GroupDeliveryPending,
  groupDeliveryPendingStorageKey,
  readGroupDeliveryPending,
  saveGroupDeliveryPending,
} from '@/api/groupDeliveryPendingStorage';
type Props = { dashboardId: number; organizationId: number; selfId?: number };
export default function GroupDeliveries(props: Props) {
  const [session, setSession] = useState(() => personalLibrarySessionScope());
  useEffect(() => {
    const check = () => setSession(personalLibrarySessionScope());
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  const [open, setOpen] = useState(false),
    [mounted, setMounted] = useState(false);
  return (
    <section aria-label="동적 그룹 조회 공유" className="min-w-0 rounded-md border p-3 text-sm">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          setOpen(v => !v);
        }}
      >
        그룹 공유 {open ? '접기' : '열기'}
      </Button>
      <div hidden={!open}>
        {mounted && <Panel key={JSON.stringify([props, session])} {...props} session={session} open={open} />}
      </div>
    </section>
  );
}
function Panel({ dashboardId, organizationId, selfId, session, open }: Props & { session: string | null; open: boolean }) {
  const scope = { dashboardId, organizationId, selfId: selfId || 0, session };
  const key = groupDeliveryPendingStorageKey(scope);
  const currentScope = () =>
    open && key !== null && groupDeliveryPendingStorageKey({ ...scope, session: personalLibrarySessionScope() }) === key;
  const [restored] = useState(() => readGroupDeliveryPending(scope));
  const [storageError, setStorageError] = useState(restored.error);
  const [retryAck, setRetryAck] = useState(false),
    [discardAck, setDiscardAck] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]),
    [rows, setRows] = useState<GroupDelivery[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null),
    [active, setActive] = useState(false),
    [copy, setCopy] = useState(false),
    [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState<GroupDeliveryPending | null>(restored.pending);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
      pending.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!open) {
      generation.current += 1;
      pending.current = false;
      setBusy(false);
      setRetryAck(false);
      setDiscardAck(false);
      if (attempt) setReady(false);
    }
  }, [open, attempt]);
  const task = async (run: (epoch: number) => Promise<void>) => {
    if (pending.current || !currentScope()) return;
    const epoch = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run(epoch);
    } catch (cause) {
      if (epoch === generation.current && currentScope()) {
        setReady(false);
        setError(enterpriseError(cause).message);
      }
    } finally {
      if (epoch === generation.current && currentScope()) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const load = () =>
    task(async epoch => {
      setReady(false);
      setRetryAck(false);
      setDiscardAck(false);
      setAck(false);
      const [page, entries] = await Promise.all([fetchGroups(), fetchGroupDeliveries(dashboardId)]);
      if (epoch !== generation.current || !currentScope()) return;
      setGroups(page.entries);
      setNext(page.nextAfterId);
      setRows(entries);
      setSelected(null);
      setActive(false);
      setCopy(false);
      setAck(false);
      setReady(true);
    });
  const more = () =>
    task(async epoch => {
      if (next === null) return;
      const page = await fetchGroups(next);
      if (epoch !== generation.current || !currentScope()) return;
      setGroups(v => [...v, ...page.entries]);
      setNext(page.nextAfterId);
    });
  const group = groups.find(g => g.id === selected),
    prior = rows.find(r => r.groupId === selected);
  const changed = !!group && (active !== (prior?.active ?? false) || copy !== (prior?.allowCopy ?? false));
  const save = () => {
    if (
      pending.current ||
      !currentScope() ||
      storageError ||
      !ready ||
      (attempt ? !retryAck : !group || !changed || !ack || (!group.active && active))
    )
      return;
    const existing = readGroupDeliveryPending(scope);
    if (existing.error || (existing.pending && JSON.stringify(existing.pending) !== JSON.stringify(attempt))) {
      setStorageError(true);
      return;
    }
    let ticket = attempt;
    if (!ticket) {
      if (!group) return;
      ticket = {
        savedAt: Date.now(),
        selfId: scope.selfId,
        organizationId,
        dashboardId,
        input: {
          requestId: crypto.randomUUID(),
          groupId: group.id,
          expectedGroupVersion: group.version,
          expectedVersion: prior?.version ?? 0,
          active,
          allowCopy: copy,
        },
      };
    }
    const frozen = ticket;
    if (!saveGroupDeliveryPending(scope, ticket)) {
      setStorageError(true);
      return;
    }
    setAttempt(ticket);
    void task(async epoch => {
      setReady(false);
      setRetryAck(false);
      setDiscardAck(false);
      const result = await saveGroupDelivery(dashboardId, frozen.input);
      if (epoch !== generation.current || !currentScope()) return;
      if (clearGroupDeliveryPending(scope)) setAttempt(null);
      else setStorageError(true);
      setAck(false);
      setNotice(
        result.replayed
          ? '이전 그룹 공유 요청의 성공을 확인했습니다. 현재 상태를 다시 읽어 주세요.'
          : '그룹 공유를 저장했습니다. 현재 상태를 다시 읽어 주세요.',
      );
    });
  };
  const discard = () => {
    if (pending.current || !discardAck || !currentScope()) return;
    if (!clearGroupDeliveryPending(scope)) {
      setStorageError(true);
      return;
    }
    generation.current += 1;
    setAttempt(null);
    setStorageError(false);
    setReady(false);
    setRetryAck(false);
    setDiscardAck(false);
    setSelected(null);
    setGroups([]);
    setRows([]);
    setNext(null);
    setActive(false);
    setCopy(false);
    setAck(false);
    setError('');
    setNotice('이 탭의 보관만 해제했습니다. 서버 요청을 취소한 것이 아닙니다. 현재 그룹 공유를 다시 읽어 주세요.');
  };
  return (
    <div className="mt-3 min-w-0 space-y-3" aria-busy={busy}>
      <p className="text-xs text-muted-foreground">
        현재·미래 그룹 구성원에게 조회만 공유합니다. 각 구성원의 소스 읽기 권한은 별도로 필요하며, 그룹 제외·비활성 후에는
        다음 요청에서 차단됩니다. 이미 만든 독립 사본은 유지됩니다.
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
          그룹 공유 최신 읽기 · 초안 초기화
        </Button>
        {next !== null && (
          <Button size="sm" variant="outline" disabled={busy || !!attempt || !ready} onClick={() => void more()}>
            공유 그룹 더 읽기
          </Button>
        )}
      </div>
      {busy && <p role="status">그룹 공유 처리 중…</p>}
      {error && <Notice severity="error">{error}</Notice>}
      {notice && <Notice severity="info">{notice}</Notice>}
      {storageError && (
        <Notice severity="error" role="alert">
          그룹 공유 복구 기록을 안전하게 읽거나 저장하지 못했습니다. 새 쓰기를 차단했습니다. 보관 해제는 서버 취소가
          아닙니다.
        </Notice>
      )}
      {attempt && (
        <div aria-label="보존한 그룹 공유 요청" className="space-y-2 rounded-md border p-3">
          <p>이전 그룹 공유 요청을 보존했습니다. 최신 조회나 오류는 이 요청을 지우지 않습니다.</p>
          <p className="break-all">요청 번호: {attempt.input.requestId}</p>
          <p>
            그룹 번호 {attempt.input.groupId} · 그룹 버전 {attempt.input.expectedGroupVersion} · 공유 버전{' '}
            {attempt.input.expectedVersion}
          </p>
          <p>
            변경: {attempt.input.active ? '조회 공유' : '공유 회수'} · 독립 복제:{' '}
            {attempt.input.allowCopy ? '허용' : '미허용'}
          </p>
          <p className="text-xs text-muted-foreground">
            영수증은 과거 저장 결과이며 현재 그룹·공유 가용성의 증거가 아닙니다. 최신 관리 조회 후에만 같은 요청을 다시 보낼
            수 있습니다.
          </p>
          <label className="flex min-h-8 items-start gap-2">
            <input
              type="checkbox"
              checked={retryAck}
              disabled={busy || !ready || storageError}
              onChange={e => setRetryAck(e.target.checked)}
            />
            보존한 그룹 번호·버전·변경·복제 설정을 확인했으며 같은 그룹 공유 요청을 다시 보냅니다.
          </label>
          <Button size="sm" disabled={busy || !ready || !retryAck || storageError} onClick={save}>
            같은 그룹 공유 요청 확인
          </Button>
        </div>
      )}
      {(attempt || storageError) && (
        <details>
          <summary className="cursor-pointer">이 탭의 그룹 요청 보관 해제</summary>
          <p>
            이미 서버에서 그룹 공유가 적용됐을 수 있습니다. 보관 해제는 서버 취소나 공유 회수가 아니며, 같은 요청으로 확인할
            단서를 이 탭에서 지웁니다.
          </p>
          <label className="flex min-h-8 items-start gap-2">
            <input type="checkbox" checked={discardAck} disabled={busy} onChange={e => setDiscardAck(e.target.checked)} />
            서버 결과가 남을 수 있음을 이해하고 이 탭의 그룹 요청 보관만 해제합니다.
          </label>
          <Button size="sm" variant="outline" disabled={busy || !discardAck} onClick={discard}>
            그룹 요청 보관 해제
          </Button>
        </details>
      )}
      {!attempt && (
        <>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs">공유할 그룹</span>
            <select
              aria-label="공유할 그룹"
              className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-base lg:text-sm"
              disabled={busy || !!attempt || !ready}
              value={selected ?? ''}
              onChange={e => {
                const id = Number(e.target.value),
                  row = rows.find(r => r.groupId === id);
                setSelected(id || null);
                setActive(row?.active ?? false);
                setCopy(row?.allowCopy ?? false);
                setAck(false);
              }}
            >
              <option value="">그룹 선택</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} · v{g.version}
                  {g.active ? '' : ' · 비활성'}
                </option>
              ))}
            </select>
          </label>
          {group && (
            <fieldset disabled={busy || !!attempt || !ready} className="min-w-0 space-y-2">
              <legend className="break-words text-xs">
                그룹 #{group.id} · 공유 버전 {prior?.version ?? 0}
              </legend>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!group.active && !active}
                  onChange={e => {
                    setActive(e.target.checked);
                    if (!e.target.checked) setCopy(false);
                    setAck(false);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>조회 공유 활성</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={copy}
                  disabled={!active || !group.active}
                  onChange={e => {
                    setCopy(e.target.checked);
                    setAck(false);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>내 소스로 독립 복제 허용</span>
              </label>
              <p className="break-words text-xs text-muted-foreground">
                조회 공유: {prior?.active ? '활성' : '중지'} → {active ? '활성' : '중지'} · 복제:{' '}
                {prior?.allowCopy ? '허용' : '미허용'} → {copy ? '허용' : '미허용'}
              </p>
              <p className="text-xs text-muted-foreground">
                복제 허용 시 계산식·조건을 복사본 소유자가 편집할 수 있습니다. 비활성 그룹은 공유 중지만 가능합니다.
              </p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={e => setAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>그룹 전체·향후 구성원과 독립 사본에 미치는 영향을 확인했습니다.</span>
              </label>
            </fieldset>
          )}
          <Button
            size="sm"
            disabled={busy || storageError || !ready || !changed || !ack || (!!group && !group.active && active)}
            onClick={() => void save()}
          >
            그룹 공유 변경 저장
          </Button>
        </>
      )}
    </div>
  );
}
