import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isReportAccessError, reportError } from './reportApi';
import { ReportPeer, ReportShares as Shares, ShareCommand, reportSharingApi } from './reportSharingApi';
import { readSharePending, removeSharePending, sharePendingKey, storeSharePending } from './reportSharePending';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { useProtectedReport } from './useProtectedReport';

export default function ReportShares({
  id,
  reviewedVersion,
  onAccessFailure,
}: {
  id: string;
  reviewedVersion: number | null;
  onAccessFailure?: () => void;
}) {
  const [afterId, setAfterId] = useState(0);
  const confirmed = useRef<{ key: string; requestId: string } | null>(null);
  const protectedRead = useProtectedReport(async signal => {
    const scope = personalLibrarySessionScope();
    const result = await reportSharingApi.shares(id, signal, afterId);
    const ticket = confirmed.current;
    if (
      ticket &&
      scope &&
      !signal.aborted &&
      scope === personalLibrarySessionScope() &&
      ticket.key === sharePendingKey(scope, result.organizationId, id) &&
      readSharePending(ticket.key)?.requestId === ticket.requestId
    ) {
      if (!removeSharePending(ticket.key)) throw new Error('Pending storage unavailable');
      confirmed.current = null;
    }
    return result;
  });
  const { state, retained, boundary, reload } = protectedRead;
  const [notice, setNotice] = useState('');
  useEffect(() => {
    reload();
  }, [afterId, reload]);
  return (
    <section className="mt-6 rounded-xl border bg-card p-6" aria-label="보고서 공유 관리">
      <div className="flex items-center justify-between gap-4">
        <h2>지정 수신자 공유</h2>
        <Button className="h-10" variant="outline" onClick={reload}>
          공유 상태 다시 읽기
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        저장 버전을 고정해 공유합니다. 원본 소스·Studio 접근권은 부여하지 않습니다. 계정 비활성이나 조직 변경으로 사용이
        중단된 관계는 명시적으로 다시 공유해야 합니다.
      </p>
      <div className="mb-4 min-h-6">
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {state.kind === 'loading' && <p role="status">현재 공유 상태를 확인하고 있습니다.</p>}
        {state.kind === 'error' && <p role="alert">{state.message}</p>}
      </div>
      <div>
        {retained && (
          <ShareControls
            key={`${id}:${retained.scope}:${retained.data.organizationId}`}
            id={id}
            invalidate={() => {
              reload();
              onAccessFailure?.();
            }}
            shares={retained.data}
            boundary={boundary}
            authority={state.kind === 'ready' ? state.generation : null}
            reviewedVersion={reviewedVersion}
            scope={retained.scope}
            afterId={afterId}
            next={setAfterId}
            notice={setNotice}
            confirmed={(key, requestId) => {
              confirmed.current = { key, requestId };
              reload();
            }}
            isCurrent={() => state.kind === 'ready' && protectedRead.current(state.generation, state.scope)}
          />
        )}
      </div>
    </section>
  );
}
function ShareControls({
  id,
  invalidate,
  shares,
  boundary,
  authority,
  reviewedVersion,
  scope,
  isCurrent,
  notice,
  next,
  afterId,
  confirmed,
}: {
  id: string;
  invalidate: () => void;
  shares: Shares;
  boundary: React.RefObject<HTMLDivElement>;
  authority: number | null;
  reviewedVersion: number | null;
  scope: string;
  isCurrent: () => boolean;
  notice: (text: string) => void;
  next: (id: number) => void;
  afterId: number;
  confirmed: (key: string, requestId: string) => void;
}) {
  const canShare =
    authority !== null && shares.canShare && reviewedVersion !== null && shares.headVersion === reviewedVersion;
  const key = sharePendingKey(scope, shares.organizationId, id);
  const [pending, setPending] = useState(() => readSharePending(key));
  const [confirmation, setConfirmation] = useState<{ command: ShareCommand; label: string } | null>(null);
  const [q, setQuery] = useState('');
  const [peers, setPeers] = useState<ReportPeer[]>([]);
  const [peerCursor, setPeerCursor] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const alive = useRef(true);
  const request = useRef(new AbortController());
  const searchGeneration = useRef(0);
  const confirmRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const restoreOnCancel = useRef(false);
  const currentReview = useRef(reviewedVersion);
  currentReview.current = reviewedVersion;
  const valid = () => alive.current && isCurrent() && currentReview.current === reviewedVersion;
  useLayoutEffect(() => {
    request.current.abort();
    request.current = new AbortController();
    searchGeneration.current += 1;
    setConfirmation(null);
    setPeers([]);
    setPeerCursor(null);
    setSearched(false);
    setBusy(false);
    setError('');
    setPending(readSharePending(key));
  }, [authority, reviewedVersion, shares, key]);
  useEffect(() => {
    alive.current = true;
    request.current = new AbortController();
    return () => {
      alive.current = false;
      request.current.abort();
    };
  }, []);
  useLayoutEffect(() => {
    if (confirmation) confirmRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    else if (restoreOnCancel.current) {
      restoreOnCancel.current = false;
      returnFocus.current?.focus();
    }
  }, [confirmation]);
  const fail = (cause: unknown, context: 'load' | 'action', suffix = '') => {
    if (isReportAccessError(cause)) invalidate();
    else setError(reportError(cause, context) + suffix);
  };
  const committed = (historical: boolean, requestId: string) => {
    notice(
      historical
        ? '과거 요청의 성공 영수증을 확인했습니다. 현재 공유 상태를 다시 확인합니다.'
        : '요청을 저장했습니다. 현재 공유 상태를 다시 확인합니다.',
    );
    confirmed(key, requestId);
  };
  const outcome = async (command: ShareCommand) => {
    if (!valid()) return;
    setBusy(true);
    setError('');
    try {
      const result = await reportSharingApi.outcome(id, command.requestId, request.current.signal);
      if (!valid()) return;
      if (result.status === 'committed') committed(true, command.requestId);
      else setError('완료 기록을 찾지 못했습니다. 취소를 뜻하지 않습니다. 원래 요청을 명시적으로 다시 확인할 수 있습니다.');
    } catch (cause) {
      if (valid()) fail(cause, 'load', ' 보관된 요청을 유지했습니다.');
    } finally {
      if (valid()) setBusy(false);
    }
  };
  useEffect(() => {
    if (pending) void outcome(pending);
  }, []);
  const send = async (command: ShareCommand) => {
    if (!valid() || busy || (command.operation.kind === 'share' && !canShare)) return;
    if (!pending && !storeSharePending(key, command)) {
      setError('탭에 요청을 보관하지 못해 전송하지 않았습니다.');
      return;
    }
    setPending(command);
    setConfirmation(null);
    setBusy(true);
    setError('');
    try {
      const result = await reportSharingApi.change(id, command, request.current.signal);
      if (valid()) committed(result.replayed, command.requestId);
    } catch (cause) {
      if (valid()) fail(cause, 'action', ' 원래 요청을 보관했습니다.');
    } finally {
      if (valid()) setBusy(false);
    }
  };
  const search = async (after = 0) => {
    if (!valid() || !canShare || pending || confirmation) return;
    searchGeneration.current += 1;
    const generation = searchGeneration.current;
    setBusy(true);
    setPeers([]);
    setPeerCursor(null);
    setError('');
    setSearched(false);
    try {
      const result = await reportSharingApi.peers(id, q, after, request.current.signal);
      if (valid() && generation === searchGeneration.current) {
        setPeers(result.items);
        setPeerCursor(result.nextCursor);
        setSearched(true);
      }
    } catch (cause) {
      if (valid() && generation === searchGeneration.current) fail(cause, 'load');
    } finally {
      if (valid() && generation === searchGeneration.current) setBusy(false);
    }
  };
  const select = async (recipientId: number, label: string, kind: 'share' | 'revoke') => {
    if (!valid() || busy || pending || confirmation || (kind === 'share' && !canShare)) return;
    let relation = shares.items.find(item => item.recipientId === recipientId);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!relation && (afterId > 0 || shares.nextCursor !== null)) {
      setBusy(true);
      setError('');
      try {
        let cursor: number | undefined;
        do {
          const page = await reportSharingApi.shares(id, request.current.signal, cursor);
          if (!valid()) return;
          relation = page.items.find(item => item.recipientId === recipientId);
          if (relation || !page.nextCursor || page.nextCursor >= recipientId) break;
          cursor = page.nextCursor;
        } while (true);
      } catch (cause) {
        if (valid()) fail(cause, 'load');
        return;
      } finally {
        if (valid()) setBusy(false);
      }
    }
    if (kind === 'share' && !shares.headRevision) return;
    const operation =
      kind === 'share' && shares.headRevision
        ? { kind: 'share' as const, expectedHeadRevision: shares.headRevision }
        : { kind: 'revoke' as const };
    setConfirmation({
      label,
      command: {
        requestId: crypto.randomUUID(),
        expectedOrganizationId: shares.organizationId,
        recipientId,
        expectedRelationVersion: relation?.relationVersion ?? 0,
        operation,
      },
    });
  };
  const cancel = () => {
    restoreOnCancel.current = true;
    setConfirmation(null);
  };
  return (
    <>
      {shares.canShare && !pending && (
        <form
          hidden={authority !== null && reviewedVersion !== null && !canShare}
          className="mb-4 flex items-end gap-3"
          onSubmit={event => {
            event.preventDefault();
            void search();
          }}
        >
          <label className="min-w-0 flex-1 text-sm">
            같은 조직 직원 검색
            <Input
              className="mt-2 h-10 text-base md:text-base"
              disabled={busy || !!confirmation}
              value={q}
              maxLength={100}
              onChange={event => {
                searchGeneration.current += 1;
                setQuery(event.target.value);
                setPeers([]);
                setPeerCursor(null);
                setSearched(false);
              }}
              placeholder="이름 또는 팀"
            />
          </label>
          <Button className="h-10" type="submit" disabled={!canShare || busy || !!confirmation}>
            검색
          </Button>
        </form>
      )}
      <div ref={boundary} hidden={authority === null}>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {pending && (
          <div className="mb-4 rounded-lg border p-4">
            <p>
              미확정 요청 · 수신자 #{pending.recipientId} · {pending.operation.kind === 'share' ? '공유' : '회수'}
            </p>
            <p className="my-2 text-sm text-muted-foreground">
              재조회는 쓰지 않습니다. 다시 전송하면 보관된 UUID와 입력을 그대로 사용합니다. 보관 해제는 서버 요청을 취소하지
              않습니다.
            </p>
            <div className="flex gap-2">
              <Button className="h-10" variant="outline" disabled={busy} onClick={() => void outcome(pending)}>
                결과만 조회
              </Button>
              <Button
                className="h-10"
                disabled={busy || !!confirmation}
                onClick={event => {
                  returnFocus.current = event.currentTarget;
                  setConfirmation({ command: pending, label: `수신자 #${pending.recipientId}의 보관된 동일 요청` });
                }}
              >
                동일 요청 재시도 검토
              </Button>
              <Button
                className="h-10"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (removeSharePending(key)) {
                    setPending(null);
                    setError('');
                  }
                }}
              >
                요청 보관 해제
              </Button>
            </div>
          </div>
        )}
        {confirmation && (
          <div
            ref={confirmRef}
            role="region"
            aria-label="수신자 변경 확인"
            tabIndex={-1}
            className="mb-4 rounded-lg border border-primary p-4"
            onKeyDown={event => {
              if (event.key === 'Escape') cancel();
            }}
          >
            <p className="break-words font-medium">{confirmation.label}</p>
            <p className="my-3">
              {confirmation.command.operation.kind === 'share'
                ? `검토한 저장본을 읽기 전용으로 공유합니다${
                    !pending ? ` · 버전 ${shares.headVersion}` : ''
                  }. 이후 편집 내용은 자동 전달되지 않습니다. 원본 접근권은 부여하지 않습니다.`
                : '이 수신자의 보고서 공유를 회수합니다. 원본 자료는 변경하지 않습니다.'}
            </p>
            <div className="flex gap-2">
              <Button className="h-10" variant="outline" onClick={cancel}>
                취소
              </Button>
              <Button className="h-10" disabled={busy} onClick={() => void send(confirmation.command)}>
                확정
              </Button>
            </div>
          </div>
        )}
        {shares.canShare && !canShare && (
          <p role="status" className="mb-4">
            공유할 최신 저장본을 먼저 검토해 주세요. 위의 보고서 다시 읽기를 선택하세요.
          </p>
        )}
        {!shares.canShare && (
          <p role="status" className="mb-4">
            원본이 비활성 상태입니다. 내용을 표시하거나 새로 공유할 수 없으며 기존 공유는 회수할 수 있습니다.
          </p>
        )}
        {!!peers.length && !pending && (
          <ul className="mb-6 divide-y rounded-lg border">
            {peers.map(peer => (
              <li key={peer.id} className="flex min-w-0 items-center gap-4 p-3">
                <span className="min-w-0 flex-1 break-words">
                  {peer.userId} · {peer.team || '팀 없음'}
                </span>
                <Button
                  className="h-10"
                  variant="outline"
                  disabled={busy || !!confirmation}
                  onClick={() => select(peer.id, peer.userId, 'share')}
                >
                  이 직원 선택
                </Button>
              </li>
            ))}
          </ul>
        )}
        {searched && !peers.length && <p className="mb-4 text-sm">검색된 활성 직원이 없습니다.</p>}
        {peerCursor && (
          <Button className="mb-4 h-10" variant="outline" disabled={busy} onClick={() => void search(peerCursor)}>
            다음 직원
          </Button>
        )}
        <h3 className="mb-3 font-medium">현재 공유 관계</h3>
        <ul className="divide-y rounded-lg border">
          {shares.items.map(item => (
            <li key={item.recipientId} className="flex min-w-0 items-center gap-4 p-3">
              <div className="min-w-0 flex-1 break-words">
                <p>
                  {item.userId ?? `사용할 수 없는 수신자 #${item.recipientId}`}
                  {item.team ? ` · ${item.team}` : ''}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  버전 {item.pinnedVersion} ·{' '}
                  {item.status === 'active'
                    ? '공유 중'
                    : item.status === 'suspended'
                    ? '사용 중단 · 다시 공유 필요'
                    : '회수됨'}
                </p>
              </div>
              {canShare && item.userId && (
                <Button
                  className="h-10"
                  variant="outline"
                  disabled={busy || !!pending || !!confirmation}
                  onClick={() => select(item.recipientId, item.userId ?? '', 'share')}
                >
                  최신 저장본 공유
                </Button>
              )}
              {item.active && (
                <Button
                  className="h-10"
                  variant="outline"
                  disabled={busy || !!pending || !!confirmation}
                  onClick={() => select(item.recipientId, item.userId ?? `수신자 #${item.recipientId}`, 'revoke')}
                >
                  회수
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!shares.items.length && <p className="py-4 text-sm text-muted-foreground">공유한 수신자가 없습니다.</p>}
        <div className="mt-3 flex gap-2">
          {afterId > 0 && (
            <Button className="h-10" variant="outline" onClick={() => next(0)}>
              처음 관계
            </Button>
          )}
          {shares.nextCursor && (
            <Button className="h-10" variant="outline" onClick={() => next(shares.nextCursor ?? 0)}>
              다음 관계
            </Button>
          )}
        </div>
        {busy && (
          <p role="status" className="mt-3">
            요청을 확인하고 있습니다.
          </p>
        )}
      </div>
    </>
  );
}
