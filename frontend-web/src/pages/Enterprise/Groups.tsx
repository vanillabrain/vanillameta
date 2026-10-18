import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { createGroup, fetchGroup, fetchGroups, GroupDetail, GroupSummary, saveGroup } from '@/api/groupService';
import { EnterpriseApiError, EnterpriseMember, enterpriseError, fetchMembers } from '@/api/enterpriseService';

export default function Groups({ organizationId }: { organizationId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="동적 그룹 관리" className="mt-4 min-w-0 rounded-lg border p-3 text-sm">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        그룹 관리 {open ? '접기' : '열기'}
      </Button>
      {open && <GroupPanel key={organizationId} />}
    </section>
  );
}
function GroupPanel() {
  const [groups, setGroups] = useState<GroupSummary[]>([]),
    [directory, setDirectory] = useState<EnterpriseMember[]>([]);
  const [next, setNext] = useState<number | null>(null),
    [nextMember, setNextMember] = useState<number | null>(null),
    [orgVersion, setOrgVersion] = useState(0);
  const [current, setCurrent] = useState<GroupDetail | null>(null),
    [name, setName] = useState(''),
    [active, setActive] = useState(true),
    [ids, setIds] = useState<number[]>([]);
  const [newName, setNewName] = useState(''),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(true),
    [stale, setStale] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const pendingCreate = useRef<{ name: string; requestId: string } | null>(null);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
      pending.current = false;
    };
  }, []);
  const adopt = (group: GroupDetail) => {
    setCurrent(group);
    setName(group.name);
    setActive(group.active);
    setIds(group.members.map(m => m.id));
    setAck(false);
    setStale(false);
    setGroups(previous => [...previous.filter(g => g.id !== group.id), group].sort((a, b) => a.id - b.id));
  };
  const task = async (run: () => Promise<void>) => {
    if (pending.current) return;
    const epoch = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await run();
    } catch (cause) {
      if (generation.current === epoch) {
        setError(enterpriseError(cause).message);
        setStale(true);
      }
    } finally {
      if (generation.current === epoch) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const load = () =>
    task(async () => {
      const epoch = generation.current;
      const [page, members] = await Promise.all([fetchGroups(), fetchMembers()]);
      if (epoch !== generation.current) return;
      setGroups(page.entries);
      setNext(page.nextAfterId);
      setDirectory(members.entries);
      setNextMember(members.nextAfterId);
      setOrgVersion(members.organizationVersion);
      setCurrent(null);
      setAck(false);
      setStale(false);
    });
  const choose = (id: number) =>
    task(async () => {
      const epoch = generation.current;
      const group = await fetchGroup(id);
      if (epoch === generation.current) adopt(group);
    });
  const more = (members: boolean) =>
    task(async () => {
      const epoch = generation.current;
      if (members && nextMember !== null) {
        const page = await fetchMembers(nextMember);
        if (epoch !== generation.current) return;
        if (page.organizationVersion !== orgVersion)
          throw new EnterpriseApiError('직원 목록이 변경됐습니다. 목록을 다시 읽어 주세요.', 'conflict', 409);
        setDirectory(previous => [...previous, ...page.entries]);
        setNextMember(page.nextAfterId);
      } else if (!members && next !== null) {
        const page = await fetchGroups(next);
        if (epoch !== generation.current) return;
        setGroups(previous => Array.from(new Map([...previous, ...page.entries].map(row => [row.id, row])).values()));
        setNext(page.nextAfterId);
      }
    });
  const create = () =>
    task(async () => {
      const epoch = generation.current;
      const request = pendingCreate.current ?? { name: newName, requestId: crypto.randomUUID() };
      pendingCreate.current = request;
      const group = await createGroup(request.name, request.requestId);
      if (epoch !== generation.current) return;
      adopt(group);
      pendingCreate.current = null;
      setNewName('');
      setNotice(
        group.replayed
          ? '이전 생성 요청의 그룹을 확인했습니다. 현재 구성을 표시합니다.'
          : '새 그룹을 만들었습니다. 구성원을 선택한 뒤 변경을 확인하고 저장하세요.',
      );
    });
  const save = () => {
    if (!current || !ack || stale || !changed) return;
    void task(async () => {
      const epoch = generation.current;
      const group = await saveGroup(current.id, { name, active, expectedVersion: current.version, memberIds: [...ids] });
      if (epoch !== generation.current) return;
      adopt(group);
      setNotice('그룹 구성과 활성 상태를 저장했습니다.');
    });
  };
  const choices = Array.from(
    new Map(
      [...(current?.members ?? []), ...directory.map(member => ({ ...member, current: true }))].map(row => [row.id, row]),
    ).values(),
  ).sort((a, b) => a.id - b.id);
  const added = current ? ids.filter(id => !current.members.some(member => member.id === id)).length : 0;
  const removed = current ? current.members.filter(member => !ids.includes(member.id)).length : 0;
  const changed = !!current && (added > 0 || removed > 0 || name.trim() !== current.name || active !== current.active);
  const locked = busy || stale;
  return (
    <div className="mt-3 min-w-0 space-y-3">
      <p className="break-words text-xs text-muted-foreground">
        팀 이름과 별개인 그룹입니다. 구성원·활성을 바꾸면 이 그룹의 모든 자원 권한에 다음 요청부터 반영됩니다. 비활성/이탈
        연결은 보존되며 재활성·재소속 시 권한이 돌아올 수 있습니다.
      </p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
        그룹·직원 목록 읽기 (초안 초기화)
      </Button>
      {error && <Notice severity="error">{error} 초안을 유지했습니다. 최신 상태를 읽고 변경을 다시 검토해 주세요.</Notice>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">그룹 처리 중…</p>}
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <TextField
          label="새 그룹 이름"
          value={newName}
          maxLength={100}
          disabled={busy || !!pendingCreate.current}
          onChange={e => setNewName(e.target.value)}
        />
        <Button
          size="sm"
          disabled={busy || (!pendingCreate.current && stale) || !newName.trim()}
          onClick={() => void create()}
        >
          {pendingCreate.current ? '같은 그룹 생성 요청 확인' : '그룹 만들기'}
        </Button>
      </div>
      {pendingCreate.current && (
        <div className="space-y-2">
          <p className="break-words text-xs">
            미확정 생성 요청을 보존했습니다. 같은 요청으로 확인하면 이름 변경 뒤에도 원래 그룹을 찾습니다.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              pendingCreate.current = null;
              setError('');
              setNotice('이전 요청을 자동 재실행하지 않습니다. 목록을 읽고 새 이름/요청을 검토하세요.');
            }}
          >
            그룹 생성 요청 새로 작성
          </Button>
        </div>
      )}
      <ul className="min-w-0 space-y-1">
        {groups.map(group => (
          <li key={group.id}>
            <Button
              size="sm"
              variant="ghost"
              className="h-auto min-h-8 max-w-full whitespace-normal break-all text-left"
              disabled={busy}
              onClick={() => void choose(group.id)}
            >
              {group.name} · #{group.id} · {group.active ? '활성' : '비활성'}
            </Button>
          </li>
        ))}
      </ul>
      {next !== null && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void more(false)}>
          그룹 더 보기
        </Button>
      )}
      {current && (
        <div className="min-w-0 space-y-3 rounded-md border p-3" aria-label="그룹 구성 편집">
          <p className="text-xs text-muted-foreground">
            그룹 #{current.id} · 현재 버전 {current.version} · 선택 {ids.length}/200명
          </p>
          <TextField
            label="그룹 이름"
            value={name}
            maxLength={100}
            disabled={locked}
            onChange={e => {
              setName(e.target.value);
              setAck(false);
            }}
          />
          <label className="flex min-h-8 items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              disabled={locked}
              onChange={e => {
                setActive(e.target.checked);
                setAck(false);
              }}
            />
            그룹 활성
          </label>
          <ul className="max-h-64 min-w-0 space-y-1 overflow-y-auto">
            {choices.map(member => (
              <li key={member.id}>
                <label className="flex min-h-8 min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`그룹 구성원 ${member.id}`}
                    checked={ids.includes(member.id)}
                    disabled={
                      locked || (!ids.includes(member.id) && (!member.current || !member.active || ids.length >= 200))
                    }
                    onChange={() => {
                      setIds(previous =>
                        previous.includes(member.id) ? previous.filter(id => id !== member.id) : [...previous, member.id],
                      );
                      setAck(false);
                    }}
                  />
                  <span className="break-all">
                    {member.current ? member.userId : `직원 #${member.id} (소속 확인 필요)`} · #{member.id} ·{' '}
                    {member.active ? '활성' : '비활성/이탈'}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {nextMember !== null && (
            <Button size="sm" variant="outline" disabled={locked} onClick={() => void more(true)}>
              그룹 직원 더 보기
            </Button>
          )}
          <p className="break-words">
            변경 미리보기: 추가 {added}명 · 제외 {removed}명 · 활성 {current.active ? '예' : '아니오'}→
            {active ? '예' : '아니오'}
          </p>
          <label className="flex min-h-8 items-start gap-2">
            <input type="checkbox" disabled={locked} checked={ack} onChange={e => setAck(e.target.checked)} />
            <span className="break-words">선택한 구성원·활성 변경이 이 그룹의 모든 자원 접근에 반영됨을 확인했습니다.</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={locked || !ack || !changed || !name.trim()} onClick={save}>
              그룹 변경 저장
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(current.id)}>
              현재 그룹 다시 읽기 (초안 초기화)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
