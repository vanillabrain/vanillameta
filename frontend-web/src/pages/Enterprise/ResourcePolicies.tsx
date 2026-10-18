import GroupPolicies from './GroupPolicies';
import Deliveries from './Deliveries';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { EnterpriseMember, fetchMembers } from '@/api/enterpriseService';
import {
  ResourceKind,
  ResourcePolicyEntry,
  ResourcePolicyResource,
  ResourcePolicyWrite,
  ResourceRights,
  fetchResourcePolicies,
  fetchResourcePolicyResources,
  resourcePolicyError,
  saveResourcePolicy,
} from '@/api/resourcePolicyService';
import SourceLifecycle from './SourceLifecycle';

const KIND_LABEL: Record<ResourceKind, string> = { dashboard: '대시보드', source: '데이터 소스' };
const RIGHT_LABEL: Record<keyof ResourceRights, string> = {
  read: '읽기',
  edit: '편집',
  publish: '게시',
  export: '내보내기',
};
const RIGHT_KEYS: Array<keyof ResourceRights> = ['read', 'edit', 'publish', 'export'];

type Draft = {
  mode: 'new' | 'existing';
  kind: ResourceKind;
  resourceId: number;
  recipientId: number;
  userId: string;
  /** 0 for a brand-new grant; the stored entry version for a change (compare-and-swap). */
  expectedVersion: number;
  /** The stored rights the draft is compared against, so the diff on screen stays explicit. */
  base: ResourceRights | null;
  rights: ResourceRights;
};

/** edit/publish/export are meaningless without read, and a source grant never publishes. */
const normalizeRights = (kind: ResourceKind, rights: ResourceRights): ResourceRights => ({
  read: rights.read,
  edit: rights.read && rights.edit,
  publish: rights.read && kind === 'dashboard' && rights.publish,
  export: rights.read && rights.export,
});

const grantedLabels = (rights: ResourceRights) => RIGHT_KEYS.filter(key => rights[key]).map(key => RIGHT_LABEL[key]);
const rightsText = (rights: ResourceRights) => grantedLabels(rights).join(' · ') || '권한 없음';
const rightsSummary = (rights: ResourceRights) => grantedLabels(rights).join(' · ') || '없음';
const changedKeys = (base: ResourceRights, rights: ResourceRights) => RIGHT_KEYS.filter(key => base[key] !== rights[key]);

const draftChanged = (draft: Draft | null) => (draft && draft.base ? changedKeys(draft.base, draft.rights) : []);
const draftSummary = (draft: Draft | null) => {
  if (!draft) return '';
  const base = draft.base;
  if (draft.mode === 'new' || !base) return `새 권한: ${rightsSummary(draft.rights)}`;
  return changedKeys(base, draft.rights)
    .map(key => `${RIGHT_LABEL[key]} ${base[key] ? '예' : '아니오'} → ${draft.rights[key] ? '예' : '아니오'}`)
    .join(' · ');
};

/**
 * UC051 next unit. The grant editor stays collapsed until an admin opens it, so nothing is read before then, every
 * write is confirmed against an explicit diff, and a refused answer can never leave a stale grant usable.
 */
export default function ResourcePolicies({
  organizationId,
  selfRecipientId,
}: {
  organizationId: number;
  /** The reading account's own internal id: the server always refuses a self grant. */
  selfRecipientId?: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section aria-label="자원별 권한" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(value => !value)}
        >
          {open ? '자원별 권한 접기' : '자원별 권한 관리 열기'}
        </Button>
        <span className="text-xs text-muted-foreground">
          본인이 소유한 자원의 수신자별 읽기·편집·게시·내보내기 권한을 관리합니다.
        </span>
      </div>
      {open && (
        <div id={panelId} className="min-w-0">
          {/* The keyed panel owns exactly one organization snapshot. */}
          <ResourcePolicyPanel key={organizationId} organizationId={organizationId} selfRecipientId={selfRecipientId} />
        </div>
      )}
    </section>
  );
}

function ResourcePolicyPanel({ organizationId, selfRecipientId }: { organizationId: number; selfRecipientId?: number }) {
  const [resources, setResources] = useState<ResourcePolicyResource[]>([]);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [resourcesBusy, setResourcesBusy] = useState(false);
  const [resourcesError, setResourcesError] = useState('');
  const [resourcesReload, setResourcesReload] = useState(0);

  const [selected, setSelected] = useState<ResourcePolicyResource | null>(null);
  const [entries, setEntries] = useState<ResourcePolicyEntry[]>([]);
  const [policiesBusy, setPoliciesBusy] = useState(false);
  const [policiesError, setPoliciesError] = useState('');
  const [policiesReload, setPoliciesReload] = useState(0);
  const [denied, setDenied] = useState('');

  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [membersNextAfterId, setMembersNextAfterId] = useState<number | null>(null);
  const [membersBusy, setMembersBusy] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [membersReload, setMembersReload] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [pickerError, setPickerError] = useState('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);

  /** One generation per read family plus a write fence, so an unmount or a refusal retires every in-flight answer. */
  const alive = useRef(true);
  const listGeneration = useRef(0);
  const policiesGeneration = useRef(0);
  const membersGeneration = useRef(0);
  const writeGeneration = useRef(0);
  const listAbort = useRef<AbortController | null>(null);
  const policiesAbort = useRef<AbortController | null>(null);
  const membersAbort = useRef<AbortController | null>(null);
  const pickerId = useId();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      listGeneration.current += 1;
      policiesGeneration.current += 1;
      membersGeneration.current += 1;
      writeGeneration.current += 1;
      listAbort.current?.abort();
      policiesAbort.current?.abort();
      membersAbort.current?.abort();
    };
  }, []);

  /** 403: the former resources, grants and draft must disappear, and every write path with them. */
  const deny = useCallback((message: string) => {
    listGeneration.current += 1;
    policiesGeneration.current += 1;
    membersGeneration.current += 1;
    writeGeneration.current += 1;
    listAbort.current?.abort();
    policiesAbort.current?.abort();
    membersAbort.current?.abort();
    setResources([]);
    setNextAfter(null);
    setSelected(null);
    setEntries([]);
    setMembers([]);
    setMembersNextAfterId(null);
    setPickerOpen(false);
    setNewRecipient('');
    setPickerError('');
    setDraft(null);
    setAck(false);
    setSaving(false);
    setNeedsReload(false);
    setResourcesError('');
    setPoliciesError('');
    setMembersError('');
    setWriteError('');
    setNotice('');
    setDenied(message);
  }, []);

  useEffect(() => {
    const read = (listGeneration.current += 1);
    listAbort.current?.abort();
    const abort = new AbortController();
    listAbort.current = abort;
    setResourcesBusy(true);
    setResourcesError('');
    fetchResourcePolicyResources(undefined, { signal: abort.signal })
      .then(page => {
        if (!alive.current || listGeneration.current !== read) return;
        setResources(page.entries);
        setNextAfter(page.nextAfter);
      })
      .catch(error => {
        if (!alive.current || listGeneration.current !== read || abort.signal.aborted) return;
        const failure = resourcePolicyError(error);
        if (failure.kind === 'forbidden') {
          deny(failure.message);
          return;
        }
        setResources([]);
        setNextAfter(null);
        setResourcesError(failure.message);
      })
      .finally(() => {
        if (alive.current && listGeneration.current === read) setResourcesBusy(false);
      });
    return () => {
      abort.abort();
    };
  }, [deny, resourcesReload]);

  useEffect(() => {
    if (!selected) return undefined;
    const read = (policiesGeneration.current += 1);
    policiesAbort.current?.abort();
    const abort = new AbortController();
    policiesAbort.current = abort;
    setPoliciesBusy(true);
    setPoliciesError('');
    // A previous resource's grants must never stay on screen under a new heading.
    setEntries([]);
    fetchResourcePolicies(selected.kind, selected.id, { signal: abort.signal })
      .then(list => {
        if (!alive.current || policiesGeneration.current !== read) return;
        setEntries(list.entries);
        // Re-read answers re-point an open draft at the stored version while its rights choice is kept.
        setDraft(current => {
          if (!current) return current;
          const stored = list.entries.find(entry => entry.recipientId === current.recipientId);
          if (!stored) return { ...current, mode: 'new', expectedVersion: 0, base: null };
          return {
            ...current,
            mode: 'existing',
            userId: stored.userId,
            expectedVersion: stored.version,
            base: normalizeRights(current.kind, stored.rights),
          };
        });
      })
      .catch(error => {
        if (!alive.current || policiesGeneration.current !== read || abort.signal.aborted) return;
        const failure = resourcePolicyError(error);
        if (failure.kind === 'forbidden') {
          deny(failure.message);
          return;
        }
        setPoliciesError(failure.message);
      })
      .finally(() => {
        if (alive.current && policiesGeneration.current === read) setPoliciesBusy(false);
      });
    return () => {
      abort.abort();
    };
  }, [deny, policiesReload, selected]);

  useEffect(() => {
    if (!pickerOpen || !selected) return undefined;
    const read = (membersGeneration.current += 1);
    membersAbort.current?.abort();
    const abort = new AbortController();
    membersAbort.current = abort;
    setMembersBusy(true);
    setMembersError('');
    fetchMembers(undefined, { signal: abort.signal })
      .then(page => {
        if (!alive.current || membersGeneration.current !== read) return;
        setMembers(page.entries);
        setMembersNextAfterId(page.nextAfterId);
      })
      .catch(error => {
        if (!alive.current || membersGeneration.current !== read || abort.signal.aborted) return;
        const failure = resourcePolicyError(error);
        if (failure.kind === 'forbidden') {
          deny(failure.message);
          return;
        }
        setMembers([]);
        setMembersNextAfterId(null);
        setMembersError(failure.message);
      })
      .finally(() => {
        if (alive.current && membersGeneration.current === read) setMembersBusy(false);
      });
    return () => {
      abort.abort();
    };
  }, [deny, membersReload, pickerOpen, selected]);

  const changed = draftChanged(draft);
  const dirty = !!draft && (draft.mode === 'new' || changed.length > 0);
  const summary = draftSummary(draft);

  const clearWrite = () => {
    setAck(false);
    setWriteError('');
    setNotice('');
    setNeedsReload(false);
  };

  const loadMoreResources = async () => {
    if (nextAfter === null || resourcesBusy || denied) return;
    const read = (listGeneration.current += 1);
    listAbort.current?.abort();
    const abort = new AbortController();
    listAbort.current = abort;
    setResourcesBusy(true);
    setResourcesError('');
    try {
      const page = await fetchResourcePolicyResources(nextAfter, { signal: abort.signal });
      if (!alive.current || listGeneration.current !== read) return;
      setResources(current => {
        const seen = new Set(current.map(item => `${item.kind}:${item.id}`));
        return [...current, ...page.entries.filter(item => !seen.has(`${item.kind}:${item.id}`))];
      });
      setNextAfter(page.nextAfter);
    } catch (error) {
      if (!alive.current || listGeneration.current !== read || abort.signal.aborted) return;
      const failure = resourcePolicyError(error);
      if (failure.kind === 'forbidden') deny(failure.message);
      else setResourcesError(failure.message);
    } finally {
      if (alive.current && listGeneration.current === read) setResourcesBusy(false);
    }
  };

  const loadMoreMembers = async () => {
    if (membersNextAfterId === null || membersBusy) return;
    const read = (membersGeneration.current += 1);
    membersAbort.current?.abort();
    const abort = new AbortController();
    membersAbort.current = abort;
    setMembersBusy(true);
    setMembersError('');
    try {
      const page = await fetchMembers(membersNextAfterId, { signal: abort.signal });
      if (!alive.current || membersGeneration.current !== read) return;
      setMembers(current => {
        const seen = new Set(current.map(member => member.id));
        return [...current, ...page.entries.filter(member => !seen.has(member.id))];
      });
      setMembersNextAfterId(page.nextAfterId);
    } catch (error) {
      if (!alive.current || membersGeneration.current !== read || abort.signal.aborted) return;
      const failure = resourcePolicyError(error);
      if (failure.kind === 'forbidden') deny(failure.message);
      else setMembersError(failure.message);
    } finally {
      if (alive.current && membersGeneration.current === read) setMembersBusy(false);
    }
  };

  const selectResource = (resource: ResourcePolicyResource) => {
    // An open draft is saved or cancelled first, so switching never drops a pending grant silently.
    if (dirty) return;
    if (selected?.kind === resource.kind && selected?.id === resource.id) return;
    setSelected(resource);
    setEntries([]);
    setPoliciesError('');
    setMembers([]);
    setMembersNextAfterId(null);
    setMembersError('');
    setPickerOpen(false);
    setNewRecipient('');
    setPickerError('');
    setDraft(null);
    clearWrite();
  };

  const openExisting = (entry: ResourcePolicyEntry) => {
    if (!selected || dirty) return;
    const base = normalizeRights(selected.kind, entry.rights);
    setDraft({
      mode: 'existing',
      kind: selected.kind,
      resourceId: selected.id,
      recipientId: entry.recipientId,
      userId: entry.userId,
      expectedVersion: entry.version,
      base,
      rights: { ...base },
    });
    clearWrite();
  };

  const chooseRecipient = (value: string) => {
    if (!selected || !value || dirty) return;
    const member = members.find(item => String(item.id) === value);
    if (member && selfRecipientId !== undefined && member.id === selfRecipientId) {
      setPickerError('본인 계정은 권한 대상이 될 수 없습니다. 다른 직원을 선택해 주세요.');
      return;
    }
    if (!member || !member.active) {
      setPickerError('현재 조직의 활성 직원만 권한을 받을 수 있습니다. 목록에서 다시 선택해 주세요.');
      return;
    }
    setPickerError('');
    setDraft({
      mode: 'new',
      kind: selected.kind,
      resourceId: selected.id,
      recipientId: member.id,
      userId: member.userId,
      expectedVersion: 0,
      base: null,
      rights: normalizeRights(selected.kind, { read: true, edit: false, publish: false, export: false }),
    });
    clearWrite();
  };

  const toggleRight = (key: keyof ResourceRights) => {
    setDraft(current => {
      if (!current) return current;
      if (key === 'publish' && current.kind === 'source') return current;
      if (key !== 'read' && !current.rights.read) return current;
      const next = { ...current.rights, [key]: !current.rights[key] };
      if (key === 'read' && !next.read) {
        next.edit = false;
        next.publish = false;
        next.export = false;
      }
      return { ...current, rights: next };
    });
    // Every right change re-opens the explicit agreement step.
    clearWrite();
  };

  const cancelDraft = () => {
    if (saving) return;
    setDraft(null);
    setNewRecipient('');
    setPickerOpen(false);
    setPickerError('');
    clearWrite();
  };

  const applyWritten = (target: Draft, written: ResourcePolicyWrite) => {
    setEntries(current => {
      const next: ResourcePolicyEntry = {
        recipientId: written.recipientId,
        userId: target.userId,
        version: written.version,
        rights: written.rights,
      };
      const index = current.findIndex(entry => entry.recipientId === target.recipientId);
      if (index === -1) return [...current, next];
      return current.map((entry, position) => (position === index ? next : entry));
    });
  };

  const save = async () => {
    if (!draft || saving || !dirty || !ack || needsReload || denied) return;
    const target = draft;
    const write = (writeGeneration.current += 1);
    setSaving(true);
    setWriteError('');
    setNotice('');
    try {
      const written = await saveResourcePolicy(target.kind, target.resourceId, {
        recipientId: target.recipientId,
        expectedVersion: target.expectedVersion,
        rights: target.rights,
      });
      if (!alive.current || writeGeneration.current !== write) return;
      applyWritten(target, written);
      setDraft(null);
      setAck(false);
      setNewRecipient('');
      setPickerOpen(false);
      setNeedsReload(false);
      setNotice(
        `로그인 ID ${target.userId} 님의 권한을 저장했습니다(버전 ${written.version} · ${rightsText(written.rights)}).`,
      );
    } catch (error) {
      if (!alive.current || writeGeneration.current !== write) return;
      const failure = resourcePolicyError(error);
      if (failure.kind === 'forbidden') {
        deny(failure.message);
        return;
      }
      if (failure.kind === 'conflict') {
        // The stored version moved on: the draft stays, but a fresh read must confirm the version first.
        setNeedsReload(true);
        setAck(false);
        setWriteError('');
      } else {
        setWriteError(failure.message);
      }
    } finally {
      if (alive.current && writeGeneration.current === write) setSaving(false);
    }
  };

  if (denied) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <Notice severity="error">
          <span className="wrap-anywhere">{denied}</span>
        </Notice>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDenied('');
              setResourcesReload(value => value + 1);
            }}
          >
            자원 권한 다시 확인
          </Button>
          <span className="text-xs text-muted-foreground">권한이 되돌아왔는지 읽기만 다시 확인합니다.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">권한을 관리할 자원</h3>
        <p className="text-xs text-muted-foreground">
          본인이 소유한 자원만 표시합니다. 조직 admin이어도 다른 사람이 소유한 자원의 권한은 관리할 수 없습니다.
        </p>
        {resourcesBusy && resources.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            자원 목록을 불러오는 중…
          </p>
        )}
        {!resourcesBusy && resources.length === 0 && !resourcesError && (
          <p className="text-sm text-muted-foreground">
            관리할 수 있는 자원이 없습니다. 대시보드나 데이터 소스를 만든 뒤 다시 확인해 주세요.
          </p>
        )}
        <ul aria-label="권한을 관리할 자원" className="flex min-w-0 flex-col gap-2">
          {resources.map(resource => {
            const isSelected = selected?.kind === resource.kind && selected?.id === resource.id;
            return (
              <li
                key={`${resource.kind}:${resource.id}`}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-3"
              >
                <span className="text-xs text-muted-foreground">{KIND_LABEL[resource.kind]}</span>
                <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-foreground">
                  {resource.label || '이름 없음'}
                </span>
                <span className="text-xs text-muted-foreground">#{resource.id}</span>
                <Button
                  size="sm"
                  variant={isSelected ? 'secondary' : 'outline'}
                  aria-pressed={isSelected}
                  disabled={dirty && !isSelected}
                  aria-label={`권한 관리: ${KIND_LABEL[resource.kind]} ${resource.label || '이름 없음'} #${resource.id}`}
                  onClick={() => selectResource(resource)}
                >
                  권한 관리
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resourcesBusy || nextAfter === null || resourcesError !== ''}
            onClick={() => void loadMoreResources()}
          >
            {resourcesBusy ? '불러오는 중…' : '다음 20개 더 보기'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={resourcesBusy || saving}
            onClick={() => setResourcesReload(value => value + 1)}
          >
            자원 목록 다시 불러오기
          </Button>
        </div>
        {resourcesError && (
          <Notice severity="error" className="flex flex-wrap items-center gap-2">
            <span className="wrap-anywhere">{resourcesError}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={resourcesBusy}
              onClick={() => setResourcesReload(value => value + 1)}
            >
              자원 목록 다시 불러오기
            </Button>
          </Notice>
        )}
      </div>

      {selected && (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-foreground">선택한 자원 권한</h3>
            <span className="min-w-0 text-sm wrap-anywhere text-foreground">
              {KIND_LABEL[selected.kind]} {selected.label || '이름 없음'} #{selected.id}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            저장된 수신자별 권한입니다. 변경은 요약을 확인하고 동의한 뒤에만 전송되며, 저장하면 그 수신자의 버전이
            올라갑니다.
          </p>

          <GroupPolicies
            key={`group:${organizationId}:${selected.kind}:${selected.id}:${selfRecipientId}`}
            kind={selected.kind}
            resourceId={selected.id}
          />
          {selected.kind === 'dashboard' && (
            <Deliveries
              key={`${organizationId}:${selected.id}:${selfRecipientId}`}
              dashboardId={selected.id}
              selfId={selfRecipientId}
            />
          )}
          {selected.kind === 'source' && (
            // UC050: availability of this exact source. The control reads nothing until the admin opens it, and no
            // grant above changes with it.
            <SourceLifecycle organizationId={organizationId} sourceId={selected.id} sourceLabel={selected.label} />
          )}

          {policiesBusy && (
            <p role="status" className="text-sm text-muted-foreground">
              저장된 권한을 불러오는 중…
            </p>
          )}
          {!policiesBusy && entries.length === 0 && !policiesError && (
            <p className="text-sm text-muted-foreground">아직 이 자원에 부여된 권한이 없습니다.</p>
          )}

          <ul aria-label="수신자별 권한" className="flex min-w-0 flex-col gap-2">
            {entries.map(entry => {
              const isSelf = selfRecipientId !== undefined && entry.recipientId === selfRecipientId;
              return (
                <li
                  key={entry.recipientId}
                  className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border p-3 text-sm"
                >
                  <span className="font-medium wrap-anywhere text-foreground">로그인 ID {entry.userId}</span>
                  <span className="text-muted-foreground">수신자 #{entry.recipientId}</span>
                  <span className="text-muted-foreground">
                    권한 {rightsSummary(normalizeRights(selected.kind, entry.rights))}
                  </span>
                  <span className="text-muted-foreground">버전 {entry.version}</span>
                  {isSelf && <span className="text-xs text-muted-foreground">본인(권한 변경 불가)</span>}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    disabled={saving || dirty || isSelf}
                    aria-label={`권한 변경: 로그인 ID ${entry.userId}`}
                    onClick={() => openExisting(entry)}
                  >
                    권한 변경
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/40 p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={pickerOpen}
                aria-controls={pickerId}
                disabled={saving || dirty}
                onClick={() => setPickerOpen(value => !value)}
              >
                새 수신자에게 권한 부여
              </Button>
              <span className="text-xs text-muted-foreground">
                현재 조직(#{organizationId})의 직원만 지정할 수 있습니다.
              </span>
            </div>
            {pickerOpen && (
              <div id={pickerId} className="flex min-w-0 flex-col gap-2">
                {membersBusy && members.length === 0 && (
                  <p role="status" className="text-xs text-muted-foreground">
                    직원 목록을 불러오는 중…
                  </p>
                )}
                <TextField
                  select
                  label="수신자(직원)"
                  value={newRecipient}
                  disabled={saving || dirty || membersBusy || members.length === 0}
                  onChange={event => {
                    setNewRecipient(event.target.value);
                    setPickerError('');
                    chooseRecipient(event.target.value);
                  }}
                  helperText="로그인 ID로 표시합니다. 선택하면 아래에서 권한을 지정합니다. 기본값은 읽기만입니다."
                  className="w-full max-w-[280px]"
                >
                  <option value="">직원 선택</option>
                  {members.map(member => (
                    <option
                      key={member.id}
                      value={String(member.id)}
                      disabled={!member.active || member.id === selfRecipientId}
                    >
                      {member.userId}
                      {member.active ? '' : ' (비활성)'}
                      {member.id === selfRecipientId ? ' (본인)' : ''}
                    </option>
                  ))}
                </TextField>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={membersBusy || membersNextAfterId === null || membersError !== '' || dirty}
                    onClick={() => void loadMoreMembers()}
                  >
                    {membersBusy ? '불러오는 중…' : '다음 20명 더 보기'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={membersBusy}
                    onClick={() => setMembersReload(value => value + 1)}
                  >
                    직원 목록 다시 불러오기
                  </Button>
                  <span className="text-xs text-muted-foreground">비활성 직원은 지정할 수 없습니다.</span>
                </div>
                {membersError && (
                  <Notice severity="error">
                    <span className="wrap-anywhere">{membersError}</span>
                  </Notice>
                )}
                {pickerError && (
                  <Notice severity="error">
                    <span className="wrap-anywhere">{pickerError}</span>
                  </Notice>
                )}
              </div>
            )}

            {draft && (
              <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-background p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium wrap-anywhere text-foreground">로그인 ID {draft.userId}</span>
                  <span className="text-muted-foreground">수신자 #{draft.recipientId}</span>
                  <span className="text-muted-foreground">
                    {draft.mode === 'new' ? '새 권한(버전 0)' : `기존 권한 버전 ${draft.expectedVersion}`}
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                  {RIGHT_KEYS.map(key => {
                    const disabled =
                      saving || (key === 'publish' && draft.kind === 'source') || (key !== 'read' && !draft.rights.read);
                    return (
                      <label key={key} className="flex min-h-9 min-w-0 items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={draft.rights[key]}
                          disabled={disabled}
                          onChange={() => toggleRight(key)}
                        />
                        {RIGHT_LABEL[key]}
                      </label>
                    );
                  })}
                </div>
                {draft.kind === 'source' && (
                  <p className="text-xs text-muted-foreground">
                    데이터 소스는 게시 권한을 지원하지 않습니다. 게시는 대시보드 자원에서만 지정할 수 있습니다.
                  </p>
                )}
                {draft.mode === 'existing' && (
                  <p className="text-xs text-muted-foreground">
                    수신자가 비활성이거나 조직을 떠난 뒤에도 저장된 권한은 여기서 회수(모든 권한 끄기)할 수 있습니다. 비활성
                    수신자에게는 회수만 저장되며, 권한을 다시 켜려면 대상이 활성 상태여야 합니다.
                  </p>
                )}
                {!draft.rights.read && (
                  <p className="text-xs text-muted-foreground">읽기 권한을 끄면 편집·게시·내보내기도 함께 꺼집니다.</p>
                )}
                {dirty && !grantedLabels(draft.rights).length && (
                  <p className="text-xs text-muted-foreground">
                    모든 권한을 끈 상태로 저장하면 이 수신자의 권한은 회수되고 회수 기록(버전)만 남습니다.
                  </p>
                )}
                <p role="status" className="text-xs text-muted-foreground">
                  {dirty
                    ? `변경 요약: ${summary}. 저장은 아래 확인란을 선택한 뒤에만 전송됩니다.`
                    : '변경된 권한이 없습니다. 읽기·편집·게시·내보내기를 수정하면 요약이 표시됩니다.'}
                </p>
                <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={ack}
                    disabled={saving || !dirty || needsReload}
                    onChange={event => {
                      setAck(event.target.checked);
                      setWriteError('');
                    }}
                  />
                  {dirty
                    ? draft.mode === 'new'
                      ? `로그인 ID ${draft.userId} 님에게 위 권한(${rightsSummary(draft.rights)})을 부여하는 데 동의합니다.`
                      : `로그인 ID ${draft.userId} 님의 위 변경(${summary})을 저장하는 데 동의합니다.`
                    : '위 권한을 확인했습니다.'}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={saving || !dirty || !ack || needsReload} onClick={() => void save()}>
                    {saving ? '저장 중…' : '권한 저장'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={cancelDraft}>
                    취소
                  </Button>
                  {dirty && (
                    <span className="text-xs text-muted-foreground">
                      저장하거나 취소해야 다른 자원·수신자를 선택할 수 있습니다.
                    </span>
                  )}
                </div>
                {needsReload && (
                  <Notice severity="warning" className="flex flex-wrap items-center gap-2">
                    <span className="wrap-anywhere">
                      저장된 권한이 다른 곳에서 먼저 변경되었습니다. 입력한 권한은 그대로 두었습니다. 최신 정책을 다시 불러온
                      뒤 다시 동의하고 저장해 주세요.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNeedsReload(false);
                        setAck(false);
                        setPoliciesReload(value => value + 1);
                      }}
                    >
                      정책 다시 불러오기
                    </Button>
                  </Notice>
                )}
                {writeError && (
                  <Notice severity="error">
                    <span className="wrap-anywhere">{writeError}</span>
                  </Notice>
                )}
              </div>
            )}
          </div>

          {policiesError && (
            <Notice severity="error" className="flex flex-wrap items-center gap-2">
              <span className="wrap-anywhere">{policiesError}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={policiesBusy}
                onClick={() => setPoliciesReload(value => value + 1)}
              >
                정책 다시 불러오기
              </Button>
            </Notice>
          )}
          {notice && (
            <p role="status" className="text-[13px]">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
