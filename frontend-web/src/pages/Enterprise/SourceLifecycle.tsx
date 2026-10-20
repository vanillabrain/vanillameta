import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import {
  SourceLifecycle as SourceLifecycleState,
  fetchSourceLifecycle,
  saveSourceLifecycle,
  sourceLifecycleError,
} from '@/api/sourceLifecycleService';

/** The two states an admin can save; there is no third "unchanged" choice, so the diff stays explicit. */
type Target = 'active' | 'inactive';

const TARGETS: Target[] = ['active', 'inactive'];
const TARGET_LABEL: Record<Target, string> = { active: '활성', inactive: '비활성' };
const stateLabel = (active: boolean) => (active ? '활성' : '비활성');

const summaryOf = (current: SourceLifecycleState | null, target: Target | null) => {
  if (target === null) return '변경된 상태가 없습니다. 저장할 상태를 선택하면 요약이 표시됩니다.';
  if (!current) return `선택한 상태: ${TARGET_LABEL[target]}`;
  if ((target === 'active') === current.active)
    return `선택한 ${TARGET_LABEL[target]} 상태가 이미 현재 상태입니다. 저장할 변경이 없습니다.`;
  return `변경 요약: 현재 ${stateLabel(current.active)} → 저장 후 ${TARGET_LABEL[target]}`;
};

const consentLabel = (dirty: boolean, target: Target | null) => {
  if (!dirty || target === null) return '위 내용을 확인했습니다.';
  const effect = target === 'inactive' ? '차단' : '다시 허용';
  return `이 소스를 ${TARGET_LABEL[target]}으로 저장해 연결된 분석·게시의 새 조회가 ${effect}되는 데 동의합니다.`;
};

const savedNotice = (written: SourceLifecycleState) =>
  written.active
    ? `소스 #${written.sourceId}를 활성으로 저장했습니다(버전 ${written.version}). 저장된 권한과 게시의 만료·중지 상태는 그대로 적용되며, 활성화만으로 게시가 자동 재개되지는 않습니다.`
    : `소스 #${written.sourceId}를 비활성으로 저장했습니다(버전 ${written.version}). 연결된 분석·게시의 새 조회가 차단됩니다.`;

/**
 * UC050 next unit. Availability control for the selected source: it stays collapsed until an admin opens it, so
 * nothing is read before then, every write is confirmed against an explicit difference, and a refused answer can
 * never leave a stale state usable.
 */
export default function SourceLifecycle({
  sourceId,
  sourceLabel,
  organizationId,
}: {
  sourceId: number;
  /** Label of the selected resource, shown as context only; the server never receives it. */
  sourceLabel?: string;
  /** Part of the panel key, so one organization's snapshot never survives into another's seam. */
  organizationId?: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section aria-label="소스 활성 상태" className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(value => !value)}
        >
          {open ? '활성 상태 관리 접기' : '활성 상태 관리 열기'}
        </Button>
        <span className="min-w-0 text-xs wrap-anywhere text-muted-foreground">
          {sourceLabel ? `${sourceLabel} · ` : ''}이 소스의 활성 상태를 관리합니다. 열기 전에는 아무것도 읽지 않습니다.
        </span>
      </div>
      {open && (
        <div id={panelId} className="min-w-0">
          {/* The keyed panel owns exactly one source snapshot, so a resource or organization switch never inherits one. */}
          <SourceLifecyclePanel key={[organizationId ?? 0, sourceId].join(':')} sourceId={sourceId} />
        </div>
      )}
    </section>
  );
}

function SourceLifecyclePanel({ sourceId }: { sourceId: number }) {
  const [current, setCurrent] = useState<SourceLifecycleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState('');
  const [denied, setDenied] = useState('');
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(false);

  /** One generation per read plus a write fence, so an unmount or a refusal retires every in-flight answer. */
  const alive = useRef(true);
  const readGeneration = useRef(0);
  const writeGeneration = useRef(0);
  const readAbort = useRef<AbortController | null>(null);
  const radioName = useId();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      readGeneration.current += 1;
      writeGeneration.current += 1;
      readAbort.current?.abort();
    };
  }, []);

  /** 403: the former state, the chosen target and every write path must disappear together. */
  const deny = useCallback((message: string) => {
    readGeneration.current += 1;
    writeGeneration.current += 1;
    readAbort.current?.abort();
    setCurrent(null);
    setTarget(null);
    setAck(false);
    setSaving(false);
    setBusy(false);
    setLocked(false);
    setReadError('');
    setWriteError('');
    setNotice('');
    setDenied(message);
  }, []);

  useEffect(() => {
    const read = (readGeneration.current += 1);
    readAbort.current?.abort();
    const abort = new AbortController();
    readAbort.current = abort;
    setBusy(true);
    setReadError('');
    fetchSourceLifecycle(sourceId, { signal: abort.signal })
      .then(lifecycle => {
        if (!alive.current || readGeneration.current !== read) return;
        // An explicit read (and an explicit re-read) becomes the new baseline. The chosen target survives, while
        // consent is cleared because the confirmed state may have moved on underneath the choice.
        setCurrent(lifecycle);
        setAck(false);
        setLocked(false);
        setWriteError('');
        setNotice('');
      })
      .catch(error => {
        if (!alive.current || readGeneration.current !== read || abort.signal.aborted) return;
        const failure = sourceLifecycleError(error);
        if (failure.kind === 'forbidden') {
          deny(failure.message);
          return;
        }
        // A failed read leaves the previous baseline unconfirmed: it stays readable, but no write may leave this
        // panel until a read succeeds again and re-confirms the version.
        setReadError(failure.message);
        setAck(false);
        setLocked(true);
      })
      .finally(() => {
        if (alive.current && readGeneration.current === read) setBusy(false);
      });
    return () => {
      abort.abort();
    };
  }, [deny, reload, sourceId]);

  const dirty = !!current && target !== null && (target === 'active') !== current.active;

  const requery = () => {
    if (saving || busy) return;
    setReload(value => value + 1);
  };

  const choose = (value: Target) => {
    if (saving) return;
    // Every input change re-opens the agreement step; a lock from a refused answer stays in place.
    setTarget(value);
    setAck(false);
    setNotice('');
    if (!locked) setWriteError('');
  };

  const cancelChoice = () => {
    if (saving) return;
    setTarget(null);
    setAck(false);
    setNotice('');
    if (!locked) setWriteError('');
  };

  const save = async () => {
    if (!current || target === null || saving || busy || locked || denied) return;
    const next = target === 'active';
    if (next === current.active || !ack) return;
    const write = (writeGeneration.current += 1);
    setSaving(true);
    setReadError('');
    setWriteError('');
    setNotice('');
    try {
      const written = await saveSourceLifecycle(sourceId, { active: next, expectedVersion: current.version });
      if (!alive.current || writeGeneration.current !== write) return;
      // The receipt carries the same fields as the read, so it becomes the current state for this exact source.
      setCurrent(written);
      setTarget(null);
      setAck(false);
      setLocked(false);
      setNotice(savedNotice(written));
    } catch (error) {
      if (!alive.current || writeGeneration.current !== write) return;
      const failure = sourceLifecycleError(error);
      if (failure.kind === 'forbidden') {
        deny(failure.message);
        return;
      }
      // A conflict or a lost response leaves the outcome unknown: the choice stays, but no new write leaves this
      // panel until the current state is read explicitly.
      setLocked(true);
      setAck(false);
      setWriteError(failure.message);
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
            disabled={busy}
            onClick={() => {
              setDenied('');
              requery();
            }}
          >
            소스 상태 다시 확인
          </Button>
          <span className="text-xs text-muted-foreground">권한이 되돌아왔는지 읽기만 다시 확인합니다.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Notice severity="warning">
        <span className="wrap-anywhere">
          비활성으로 저장하면 이 소스를 쓰는 연결된 분석과 게시본의 새 조회가 차단되고 일반 데이터 소스 목록에서도 빠집니다.
          저장된 분석 정의·게시본·원본 데이터·연결 정보는 삭제되지 않으며, 재활성 후에도 현재 권한과 게시 만료·중지 조건을
          확인합니다. 이미 열려 있는 화면이나 진행 중인 조회는 회수하지 않습니다.
        </span>
      </Notice>

      {busy && !current && (
        <p role="status" className="text-sm text-muted-foreground">
          현재 활성 상태를 읽는 중…
        </p>
      )}

      {readError && (
        <Notice severity="error" className="flex flex-wrap items-center gap-2">
          <span className="wrap-anywhere">{readError}</span>
          {!current && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={requery}>
              현재 상태 다시 읽기
            </Button>
          )}
        </Notice>
      )}

      {current && (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">현재 상태</span>
            <span className="font-medium wrap-anywhere text-foreground">{stateLabel(current.active)}</span>
            <span className="text-muted-foreground">버전 {current.version}</span>
            <span className="text-muted-foreground">소스 #{current.sourceId}</span>
          </div>

          <fieldset className="flex min-w-0 flex-col gap-2" disabled={saving}>
            <legend className="text-sm text-foreground">저장할 상태</legend>
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              {TARGETS.map(value => (
                <label key={value} className="flex min-h-9 min-w-0 items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    className="size-4"
                    name={radioName}
                    checked={target === value}
                    onChange={() => choose(value)}
                  />
                  {TARGET_LABEL[value]}
                </label>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              바꿀 상태를 직접 선택해야 저장할 수 있습니다. 현재 상태를 다시 선택하면 변경이 취소됩니다.
            </span>
          </fieldset>

          <p role="status" className="text-xs text-muted-foreground">
            {summaryOf(current, target)}
          </p>

          <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={ack}
              disabled={saving || !dirty || locked}
              onChange={event => {
                setAck(event.target.checked);
                setWriteError('');
              }}
            />
            {consentLabel(dirty, target)}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={saving || !dirty || !ack || locked} onClick={() => void save()}>
              {saving ? '저장 중…' : '활성 상태 저장'}
            </Button>
            <Button size="sm" variant="ghost" disabled={saving || target === null} onClick={cancelChoice}>
              선택 취소
            </Button>
            <Button size="sm" variant="ghost" disabled={saving || busy} onClick={requery}>
              현재 상태 다시 읽기
            </Button>
            <span className="text-xs text-muted-foreground">저장은 아래 동의와 이 버튼을 눌러야만 전송됩니다.</span>
          </div>

          {locked && (
            <Notice severity="warning">
              <span className="wrap-anywhere">
                {writeError || '저장 결과를 확인하지 못했습니다.'} 선택한 상태는 그대로 두었습니다. 현재 상태를 다시 읽기
                전에는 새 저장을 보내지 않습니다.
              </span>
            </Notice>
          )}
          {!locked && writeError && (
            <Notice severity="error">
              <span className="wrap-anywhere">{writeError}</span>
            </Notice>
          )}
          {notice && (
            <p role="status" className="text-[13px] wrap-anywhere">
              {notice}
            </p>
          )}
        </>
      )}
    </div>
  );
}
