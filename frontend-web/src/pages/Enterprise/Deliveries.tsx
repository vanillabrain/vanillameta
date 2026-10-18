import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { EnterpriseMember, fetchMembers } from '@/api/enterpriseService';
import { DeliveryEntry, DeliveryInput, fetchDeliveries, saveDeliveries } from '@/api/deliveryService';

export default function Deliveries({ dashboardId, selfId }: { dashboardId: number; selfId?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0 rounded-md border p-3" aria-label="수신자 조회 공유">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        조회 공유 {open ? '접기' : '열기'}
      </Button>
      {open && <DeliveryPanel key={dashboardId} dashboardId={dashboardId} selfId={selfId} />}
    </section>
  );
}
function DeliveryPanel({ dashboardId, selfId }: { dashboardId: number; selfId?: number }) {
  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [rosterVersion, setRosterVersion] = useState<number | null>(null);
  const [rows, setRows] = useState<DeliveryEntry[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [active, setActive] = useState(true);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState<DeliveryInput | null>(null);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const load = async () => {
    if (pending.current) return;
    generation.current += 1;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setReady(false);
    setError('');
    setNotice('');
    setAck(false);
    try {
      const [relations, page] = await Promise.all([fetchDeliveries(dashboardId), fetchMembers()]);
      if (generation.current !== current) return;
      setRows(relations);
      setMembers(page.entries);
      setNext(page.nextAfterId);
      setRosterVersion(page.organizationVersion);
      setSelected([]);
      setAttempt(null);
      setReady(true);
    } catch {
      if (generation.current === current) setError('공유 관계와 직원 목록을 확인하지 못했습니다. 다시 읽어 주세요.');
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const more = async () => {
    if (pending.current || next === null) return;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const page = await fetchMembers(next);
      if (generation.current !== current) return;
      if (page.organizationVersion !== rosterVersion) throw new Error('changed roster');
      setMembers(previous => [...previous, ...page.entries]);
      setNext(page.nextAfterId);
    } catch {
      if (generation.current === current) {
        setReady(false);
        setError('직원 목록이 변경됐거나 조회에 실패했습니다. 최신 관계를 다시 읽어 주세요.');
      }
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const save = async () => {
    if (pending.current || (!attempt && (!ready || !ack || !selected.length))) return;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const request = attempt ?? {
        requestId: crypto.randomUUID(),
        active,
        recipients: selected.map(recipientId => ({
          recipientId,
          expectedVersion: rows.find(row => row.recipientId === recipientId)?.version ?? 0,
        })),
      };
      setAttempt(request);

      const result = await saveDeliveries(dashboardId, request);
      if (generation.current !== current) return;
      // Receipts prove a past operation. Always require a fresh relation read before another write.
      setReady(false);
      setAck(false);
      setAttempt(null);
      setNotice(
        result.replayed
          ? '이전 요청의 저장을 확인했습니다. 최신 관계를 다시 읽어 주세요.'
          : '선택한 수신자의 공유를 저장했습니다. 최신 관계를 다시 읽어 주세요.',
      );
    } catch {
      if (generation.current === current)
        setError('공유 결과를 확인하지 못했습니다. 같은 요청으로 확인하거나 최신 관계를 다시 읽고 검토해 주세요.');
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
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
      {!ready && attempt && (
        <div className="space-y-2">
          <p className="break-words">이전 공유 요청을 보존했습니다. 같은 요청으로 저장 결과를 확인할 수 있습니다.</p>
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            같은 공유 요청 확인
          </Button>
        </div>
      )}
      {ready && (
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
                    {rows.find(row => row.recipientId === member.id)?.active ? '공유 중' : '공유 없음'}
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
          <Button size="sm" disabled={busy || !ack || !selected.length} onClick={() => void save()}>
            {attempt ? '같은 공유 요청 확인' : '공유 변경 저장'}
          </Button>
        </>
      )}
    </div>
  );
}
