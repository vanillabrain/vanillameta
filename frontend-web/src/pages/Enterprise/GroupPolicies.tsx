import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { fetchGroups, fetchGroupPolicies, GroupPolicy, GroupSummary, saveGroupPolicy } from '@/api/groupService';
import { ResourceKind, ResourceRights } from '@/api/resourcePolicyService';
import { enterpriseError } from '@/api/enterpriseService';
const empty: ResourceRights = { read: false, edit: false, publish: false, export: false };
const keys = ['read', 'edit', 'publish', 'export'] as const;
const labels = { read: '읽기', edit: '편집', publish: '게시', export: '내보내기' };
export default function GroupPolicies({ kind, resourceId }: { kind: ResourceKind; resourceId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="그룹 자원 권한" className="min-w-0 rounded-md border p-3 text-sm">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        그룹 권한 {open ? '접기' : '열기'}
      </Button>
      {open && <Panel key={`${kind}:${resourceId}`} kind={kind} resourceId={resourceId} />}
    </section>
  );
}
function Panel({ kind, resourceId }: { kind: ResourceKind; resourceId: number }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]),
    [policies, setPolicies] = useState<GroupPolicy[]>([]),
    [next, setNext] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null),
    [rights, setRights] = useState<ResourceRights>({ ...empty }),
    [ack, setAck] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
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
    task(async () => {
      const epoch = generation.current;
      const [page, rows] = await Promise.all([fetchGroups(), fetchGroupPolicies(kind, resourceId)]);
      if (epoch !== generation.current) return;
      setGroups(page.entries);
      setNext(page.nextAfterId);
      setPolicies(rows);
      setSelected(null);
      setRights({ ...empty });
      setAck(false);
      setReady(true);
    });
  const more = () =>
    task(async () => {
      if (next === null) return;
      const epoch = generation.current,
        page = await fetchGroups(next);
      if (epoch !== generation.current) return;
      setGroups(previous => [...previous, ...page.entries]);
      setNext(page.nextAfterId);
    });
  const group = groups.find(row => row.id === selected),
    prior = policies.find(row => row.groupId === selected);
  const save = () => {
    if (!group || !ack || !ready) return;
    void task(async () => {
      const epoch = generation.current;
      await saveGroupPolicy(kind, resourceId, {
        groupId: group.id,
        expectedGroupVersion: group.version,
        expectedVersion: prior?.version ?? 0,
        rights: { ...rights },
      });
      if (epoch !== generation.current) return;
      setReady(false);
      setAck(false);
      setNotice('그룹 권한을 저장했습니다. 최신 권한을 다시 읽어 주세요.');
    });
  };
  return (
    <div className="mt-3 min-w-0 space-y-3">
      <p className="break-words text-xs text-muted-foreground">
        그룹의 현재·미래 구성원에게 적용됩니다. 직접 권한과 다른 그룹 권한은 유지됩니다. 대시보드에는 별도 소스 읽기도
        필요합니다.
      </p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
        그룹 권한 최신 읽기 (초안 초기화)
      </Button>
      {error && <Notice severity="error">{error} 변경 초안을 보존했습니다. 최신 상태를 읽고 다시 검토해 주세요.</Notice>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">그룹 권한 처리 중…</p>}
      {(ready || selected !== null) && (
        <>
          <TextField
            select
            label="권한 대상 그룹"
            disabled={busy || !ready}
            value={selected ?? ''}
            onChange={e => {
              const id = Number(e.target.value);
              setSelected(id || null);
              setRights({ ...(policies.find(row => row.groupId === id)?.rights ?? empty) });
              setAck(false);
            }}
          >
            <option value="">그룹 선택</option>
            {groups.map(row => (
              <option key={row.id} value={row.id}>
                {row.name} · #{row.id} · {row.active ? '활성' : '비활성'}
              </option>
            ))}
          </TextField>
          {next !== null && (
            <Button size="sm" variant="outline" disabled={busy || !ready} onClick={() => void more()}>
              권한 그룹 더 보기
            </Button>
          )}
          {group && (
            <>
              <p className="text-xs text-muted-foreground">
                그룹 버전 {group.version} · 정책 버전 {prior?.version ?? 0}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {keys.map(key => (
                  <label key={key} className="flex min-h-8 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rights[key]}
                      disabled={
                        busy || !ready || (kind === 'source' && key === 'publish') || (key !== 'read' && !rights.read)
                      }
                      onChange={() => {
                        setRights(previous =>
                          key === 'read'
                            ? previous.read
                              ? { ...empty }
                              : { ...previous, read: true }
                            : { ...previous, [key]: !previous[key] },
                        );
                        setAck(false);
                      }}
                    />
                    {labels[key]}
                  </label>
                ))}
              </div>
              {!group.active && <p role="note">비활성 그룹입니다. 읽기를 해제해 기존 정책을 회수할 수 있습니다.</p>}
              <p className="break-words">
                변경 미리보기:{' '}
                {keys
                  .map(key => `${labels[key]} ${prior?.rights[key] ? '예' : '아니오'}→${rights[key] ? '예' : '아니오'}`)
                  .join(' · ')}
              </p>
              <label className="flex min-h-8 items-start gap-2">
                <input type="checkbox" disabled={busy || !ready} checked={ack} onChange={e => setAck(e.target.checked)} />
                <span className="break-words">그룹 구성원에게 적용할 권한과 변경 범위를 확인했습니다.</span>
              </label>
              <Button size="sm" disabled={busy || !ready || !ack || (!group.active && rights.read)} onClick={save}>
                그룹 권한 저장
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
