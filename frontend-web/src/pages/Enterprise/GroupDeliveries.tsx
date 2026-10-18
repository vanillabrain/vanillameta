import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { enterpriseError } from '@/api/enterpriseService';
import { fetchGroups, GroupSummary } from '@/api/groupService';
import { fetchGroupDeliveries, saveGroupDelivery, GroupDelivery, GroupDeliveryInput } from '@/api/groupDeliveryService';
export default function GroupDeliveries({ dashboardId }: { dashboardId: number }) {
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
      <div hidden={!open}>{mounted && <Panel key={dashboardId} dashboardId={dashboardId} />}</div>
    </section>
  );
}
function Panel({ dashboardId }: { dashboardId: number }) {
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
  const [attempt, setAttempt] = useState<GroupDeliveryInput | null>(null);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
      pending.current = false;
    },
    [],
  );
  const task = async (run: (epoch: number) => Promise<void>) => {
    if (pending.current) return;
    const epoch = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run(epoch);
    } catch (cause) {
      if (epoch === generation.current) {
        setReady(false);
        setError(enterpriseError(cause).message);
      }
    } finally {
      if (epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const load = () =>
    task(async epoch => {
      const [page, entries] = await Promise.all([fetchGroups(), fetchGroupDeliveries(dashboardId)]);
      if (epoch !== generation.current) return;
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
      if (epoch !== generation.current) return;
      setGroups(v => [...v, ...page.entries]);
      setNext(page.nextAfterId);
    });
  const group = groups.find(g => g.id === selected),
    prior = rows.find(r => r.groupId === selected);
  const changed = !!group && (active !== (prior?.active ?? false) || copy !== (prior?.allowCopy ?? false));
  const save = () =>
    task(async epoch => {
      if (!attempt && (!ready || !group || !changed || !ack)) return;
      let input = attempt;
      if (!input) {
        if (!group) return;
        input = {
          requestId: crypto.randomUUID(),
          groupId: group.id,
          expectedGroupVersion: group.version,
          expectedVersion: prior?.version ?? 0,
          active,
          allowCopy: copy,
        };
      }
      setAttempt(input);
      setReady(false);
      try {
        const result = await saveGroupDelivery(dashboardId, input);
        if (epoch !== generation.current) return;
        setAttempt(null);
        setAck(false);
        setNotice(
          result.replayed
            ? '이전 그룹 공유 요청의 성공을 확인했습니다. 현재 상태를 다시 읽어 주세요.'
            : '그룹 공유를 저장했습니다. 현재 상태를 다시 읽어 주세요.',
        );
      } catch (cause) {
        if (epoch !== generation.current) return;
        const details = enterpriseError(cause);
        if (details.status === 400 || details.status === 403 || details.status === 409) setAttempt(null);
        throw cause;
      }
    });
  return (
    <div className="mt-3 min-w-0 space-y-3" aria-busy={busy}>
      <p className="text-xs text-muted-foreground">
        현재·미래 그룹 구성원에게 조회만 공유합니다. 각 구성원의 소스 읽기 권한은 별도로 필요하며, 그룹 제외·비활성 후에는
        다음 요청에서 차단됩니다. 이미 만든 독립 사본은 유지됩니다.
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy || !!attempt} onClick={() => void load()}>
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
      {!!attempt && (
        <Notice severity="warning">
          결과가 불명확합니다. 선택과 요청을 보존했습니다. 같은 요청으로 결과를 확인해 주세요.
        </Notice>
      )}
      <label className="block min-w-0 space-y-1">
        <span className="text-xs">공유할 그룹</span>
        <select
          aria-label="공유할 그룹"
          className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-base md:text-sm"
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
        disabled={busy || (!attempt && (!ready || !changed || !ack || (!!group && !group.active && active)))}
        onClick={() => void save()}
      >
        {attempt ? '같은 그룹 공유 요청 확인' : '그룹 공유 변경 저장'}
      </Button>
    </div>
  );
}
