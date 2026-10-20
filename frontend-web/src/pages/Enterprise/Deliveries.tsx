import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { EnterpriseMember, fetchMembers } from '@/api/enterpriseService';
import { DeliveryEntry, fetchDeliveries, saveDeliveries } from '@/api/deliveryService';

import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import {
  clearDeliveryPending,
  DeliveryPending,
  deliveryPendingStorageKey,
  readDeliveryPending,
  saveDeliveryPending,
} from '@/api/deliveryPendingStorage';
type Props = { dashboardId: number; selfId?: number; organizationId: number };
export default function Deliveries(props: Props) {
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
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0 rounded-md border p-3" aria-label="수신자 조회 공유">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        조회 공유 {open ? '접기' : '열기'}
      </Button>
      {open && <DeliveryPanel key={JSON.stringify([props, session])} {...props} session={session} />}
    </section>
  );
}
function DeliveryPanel({ dashboardId, selfId, organizationId, session }: Props & { session: string | null }) {
  const scope = { dashboardId, selfId: selfId || 0, organizationId, session };
  const key = deliveryPendingStorageKey(scope);
  const currentScope = () =>
    key !== null && deliveryPendingStorageKey({ ...scope, session: personalLibrarySessionScope() }) === key;
  const [restored] = useState(() => readDeliveryPending(scope));
  const [storageError, setStorageError] = useState(restored.error);
  const [retryAck, setRetryAck] = useState(false),
    [discardAck, setDiscardAck] = useState(false);
  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [rosterVersion, setRosterVersion] = useState<number | null>(null);
  const [rows, setRows] = useState<DeliveryEntry[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [active, setActive] = useState(true);
  const [copyMode, setCopyMode] = useState('preserve');
  const [copyAck, setCopyAck] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState<DeliveryPending | null>(restored.pending);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const load = async () => {
    if (pending.current || !currentScope()) return;
    generation.current += 1;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setReady(false);
    setError('');
    setNotice('');
    setAck(false);
    setCopyMode('preserve');
    setCopyAck(false);
    setRetryAck(false);
    setDiscardAck(false);
    try {
      const [relations, page] = await Promise.all([fetchDeliveries(dashboardId), fetchMembers()]);
      if (generation.current !== current || !currentScope()) return;
      setRows(relations);
      setMembers(page.entries);
      setNext(page.nextAfterId);
      setRosterVersion(page.organizationVersion);
      setSelected([]);
      // A current relationship is not proof of this frozen request's outcome.
      setReady(true);
    } catch {
      if (generation.current === current && currentScope())
        setError('공유 관계와 직원 목록을 확인하지 못했습니다. 다시 읽어 주세요.');
    } finally {
      if (generation.current === current && currentScope()) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const more = async () => {
    if (pending.current || next === null || !currentScope()) return;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await fetchMembers(next);
      if (generation.current !== current || !currentScope()) return;
      if (page.organizationVersion !== rosterVersion) throw new Error('changed roster');
      setMembers(previous => [...previous, ...page.entries]);
      setNext(page.nextAfterId);
    } catch {
      if (generation.current === current && currentScope()) {
        setReady(false);
        setError('직원 목록이 변경됐거나 조회에 실패했습니다. 최신 관계를 다시 읽어 주세요.');
      }
    } finally {
      if (generation.current === current && currentScope()) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const save = async () => {
    if (
      pending.current ||
      !currentScope() ||
      storageError ||
      !ready ||
      (attempt ? !retryAck : !ack || (active && copyMode === 'allow' && !copyAck) || !selected.length)
    )
      return;
    // Verify existing storage before allocating a new request or replacing any ticket.
    const existing = readDeliveryPending(scope);
    if (existing.error || (existing.pending && JSON.stringify(existing.pending) !== JSON.stringify(attempt))) {
      setStorageError(true);
      return;
    }
    const ticket: DeliveryPending = attempt ?? {
      savedAt: Date.now(),
      selfId: scope.selfId,
      organizationId,
      dashboardId,
      input: {
        requestId: crypto.randomUUID(),
        active,
        ...(active && copyMode !== 'preserve' ? { allowCopy: copyMode === 'allow' } : {}),
        recipients: selected.map(recipientId => ({
          recipientId,
          expectedVersion: rows.find(row => row.recipientId === recipientId)?.version ?? 0,
        })),
      },
    };
    if (!saveDeliveryPending(scope, ticket)) {
      setStorageError(true);
      return;
    }
    setAttempt(ticket);
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setReady(false);
    setRetryAck(false);
    setDiscardAck(false);
    try {
      const result = await saveDeliveries(dashboardId, ticket.input);
      if (generation.current !== current || !currentScope()) return;
      // A receipt proves the old operation only. Another write always needs a fresh authorized GET.
      setAck(false);
      if (clearDeliveryPending(scope)) setAttempt(null);
      else setStorageError(true);
      setNotice(
        result.replayed
          ? '이전 요청의 저장을 확인했습니다. 최신 관계를 다시 읽어 주세요.'
          : '선택한 수신자의 공유를 저장했습니다. 최신 관계를 다시 읽어 주세요.',
      );
    } catch {
      if (generation.current === current && currentScope())
        setError(
          '공유 결과를 확인하지 못했습니다. 최신 관계를 다시 읽은 뒤 같은 요청으로 확인하거나 보관 해제를 검토해 주세요.',
        );
    } finally {
      if (generation.current === current && currentScope()) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const discard = () => {
    if (busy || !discardAck || !currentScope()) return;
    if (!clearDeliveryPending(scope)) {
      setStorageError(true);
      return;
    }
    generation.current += 1;
    setAttempt(null);
    setStorageError(false);
    setReady(false);
    setRetryAck(false);
    setDiscardAck(false);
    setAck(false);
    setSelected([]);
    setRows([]);
    setMembers([]);
    setError('');
    setNotice('이 탭의 보관만 해제했습니다. 서버 요청을 취소한 것이 아닙니다. 최신 관계를 다시 읽어 주세요.');
  };
  const toggle = (id: number) => {
    setSelected(previous =>
      previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id].slice(0, 50),
    );
    setAck(false);
    setNotice('');
  };
  const candidates = members.filter(member => member.id !== selfId && (active ? member.active : true));
  const departed = rows.filter(row => row.active && !members.some(member => member.id === row.recipientId));
  const locked = busy || !!attempt;
  return (
    <div className="mt-3 min-w-0 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        공유는 읽기만 추가합니다. 소스 읽기 권한도 별도로 필요합니다. 회수해도 직접 부여한 권한·원본·독립 사본은 유지됩니다.
      </p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
        최신 공유 관계 읽기
      </Button>
      {busy && <p role="status">공유 처리 중…</p>}
      {error && <Notice severity="error">{error}</Notice>}
      {notice && <p role="status">{notice}</p>}
      {storageError && (
        <Notice severity="error" role="alert">
          공유 복구 기록을 안전하게 읽거나 저장하지 못했습니다. 새 공유 쓰기를 차단했습니다. 보관 해제는 서버 취소가
          아닙니다.
        </Notice>
      )}
      {attempt && (
        <div className="space-y-2 rounded-md border p-3" aria-label="보존한 공유 요청">
          <p>이전 공유 요청을 보존했습니다. 최신 관계 조회는 이 요청을 지우지 않습니다.</p>
          <p className="break-all">요청 번호: {attempt.input.requestId}</p>
          <p className="break-words">수신자 번호: {attempt.input.recipients.map(r => r.recipientId).join(', ')}</p>
          <p>
            변경: {attempt.input.active ? '조회 공유' : '공유 회수'} · 독립 복제:{' '}
            {attempt.input.allowCopy === undefined
              ? '기존 설정 유지 (신규 미허용)'
              : attempt.input.allowCopy
              ? '허용'
              : '중지'}
          </p>
          <p className="text-xs text-muted-foreground">
            같은 요청의 영수증은 과거 저장 결과이며 현재 공유 관계·권한을 증명하지 않습니다. 재시도 전에 최신 관계를 읽어
            현재 관리 권한을 확인해 주세요.
          </p>
          <label className="flex min-h-8 items-start gap-2">
            <input
              type="checkbox"
              checked={retryAck}
              disabled={busy || !ready || storageError}
              onChange={e => setRetryAck(e.target.checked)}
            />
            보존한 수신자 번호·변경·복제 설정을 확인했으며 같은 공유 요청을 다시 보냅니다.
          </label>
          <Button size="sm" disabled={busy || !ready || !retryAck || storageError} onClick={() => void save()}>
            같은 공유 요청 확인
          </Button>
        </div>
      )}
      {(attempt || storageError) && (
        <details className="space-y-2">
          <summary className="cursor-pointer">이 탭의 요청 보관 해제</summary>
          <p>
            이미 서버에서 공유가 적용됐을 수 있습니다. 보관 해제는 서버 취소나 공유 회수가 아니며, 같은 요청으로 확인할
            단서를 이 탭에서 지웁니다.
          </p>
          <label className="flex min-h-8 items-start gap-2">
            <input type="checkbox" checked={discardAck} disabled={busy} onChange={e => setDiscardAck(e.target.checked)} />
            서버 결과가 남을 수 있음을 이해하고 이 탭의 보관만 해제합니다.
          </label>
          <Button size="sm" variant="outline" disabled={busy || !discardAck} onClick={discard}>
            요청 보관 해제
          </Button>
        </details>
      )}
      {ready && !attempt && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-8 items-center gap-2">
              <input
                type="radio"
                name={`delivery-mode-${dashboardId}`}
                checked={active}
                disabled={locked}
                onChange={() => {
                  setActive(true);
                  setSelected([]);
                  setAck(false);
                }}
              />
              조회 공유
            </label>
            <label className="flex min-h-8 items-center gap-2">
              <input
                type="radio"
                name={`delivery-mode-${dashboardId}`}
                checked={!active}
                disabled={locked}
                onChange={() => {
                  setActive(false);
                  setSelected([]);
                  setAck(false);
                }}
              />
              공유 회수
            </label>
          </div>
          {active && (
            <div className="min-w-0 space-y-2">
              <label className="flex min-w-0 flex-wrap items-center gap-2">
                독립 복제 설정
                <select
                  className="h-8 max-w-full rounded-md border bg-background px-2 text-base text-foreground sm:text-sm"
                  aria-label="독립 복제 설정"
                  disabled={locked}
                  value={copyMode}
                  onChange={event => {
                    setCopyMode(event.target.value);
                    setCopyAck(false);
                    setAck(false);
                  }}
                >
                  <option value="preserve">기존 설정 유지 (신규 미허용)</option>
                  <option value="allow">독립 복제 허용</option>
                  <option value="deny">독립 복제 중지</option>
                </select>
              </label>
              {copyMode === 'allow' && (
                <label className="flex min-h-8 min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={copyAck}
                    onChange={event => setCopyAck(event.target.checked)}
                  />
                  <span className="break-words text-xs">
                    지표 계산식·조건·배치가 수신자의 편집 가능한 독립 사본에 제공되며 공유를 회수해도 이미 저장한 사본은 남는
                    것을 확인했습니다.
                  </span>
                </label>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            최대50명. 팀 선택은 지금 불러온 명단만 선택하며, 이후 소속 변경에 따라 자동으로 인원을 추가하지 않습니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from(new Set(candidates.map(member => member.team).filter(Boolean))).map(team => (
              <Button
                key={team}
                className="h-auto min-h-8 max-w-full whitespace-normal break-all text-left"
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => {
                  setSelected(
                    candidates
                      .filter(member => member.team === team)
                      .map(member => member.id)
                      .slice(0, 50),
                  );
                  setAck(false);
                }}
              >
                불러온 {team} 팀 선택
              </Button>
            ))}
          </div>
          <ul className="max-h-64 min-w-0 space-y-1 overflow-y-auto">
            {candidates.map(member => (
              <li key={member.id}>
                <label className="flex min-h-8 min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(member.id)}
                    disabled={locked || (!selected.includes(member.id) && selected.length >= 50)}
                    onChange={() => toggle(member.id)}
                  />
                  <span className="break-all">
                    {member.userId} · #{member.id} ·{' '}
                    {rows.find(row => row.recipientId === member.id)?.active ? '공유 중' : '공유 없음'} ·{' '}
                    {rows.find(row => row.recipientId === member.id)?.allowCopy ? '복제 허용' : '복제 미허용'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {next !== null && (
            <Button size="sm" variant="outline" disabled={locked} onClick={() => void more()}>
              직원 더 보기
            </Button>
          )}
          {!active &&
            departed.map(row => (
              <label key={row.recipientId} className="flex min-h-8 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(row.recipientId)}
                  disabled={locked || (!selected.includes(row.recipientId) && selected.length >= 50)}
                  onChange={() => toggle(row.recipientId)}
                />
                직원 #{row.recipientId} · 현재 명단에서 확인되지 않음
              </label>
            ))}
          <p className="break-words">
            변경 미리보기: {selected.length}명 → {active ? '조회 공유' : '공유 회수'}
          </p>
          <label className="flex min-h-8 items-center gap-2">
            <input
              type="checkbox"
              checked={ack}
              disabled={locked || !selected.length}
              onChange={event => setAck(event.target.checked)}
            />
            선택한 수신자와 공유 변경을 확인했습니다.
          </label>
          <Button
            size="sm"
            disabled={busy || storageError || !ack || (active && copyMode === 'allow' && !copyAck) || !selected.length}
            onClick={() => void save()}
          >
            공유 변경 저장
          </Button>
        </>
      )}
    </div>
  );
}
