import React, { useEffect, useRef, useState } from 'react';
import { EnterpriseContext, enterpriseError } from '@/api/enterpriseService';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { getToken } from '@/helpers/authHelper';
import { isHandoverId } from '@/api/handoverService';
import {
  cancelStaffDeparture,
  completeStaffDeparture,
  fetchStaffDeparture,
  requestStaffDeparture,
  reviewStaffDeparture,
  StaffDepartureRecord,
  StaffDepartureReview,
  StaffDepartureScope,
} from '@/api/staffDepartureService';
import {
  clearPendingStaffDeparture,
  PendingStaffDeparture,
  readPendingStaffDeparture,
  savePendingStaffDeparture,
} from '@/api/staffDepartureStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';

// Token claims are a cache/response fence only. Every API authorizes against the current server identity.
function cachedActor(context: EnterpriseContext): number | null {
  if (context.membership) return context.membership.userId;
  try {
    const payload = getToken()?.split('.')[1];
    const id = payload && JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))?.accessKeyData?.id;
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
function sessionIdentity(context: EnterpriseContext) {
  return { session: personalLibrarySessionScope(), actor: cachedActor(context) };
}
export default function StaffDeparture({ context }: { context: EnterpriseContext }) {
  const [identity, setIdentity] = useState(() => sessionIdentity(context));
  useEffect(() => {
    const check = () =>
      setIdentity(old => {
        const next = sessionIdentity(context);
        return JSON.stringify(next) === JSON.stringify(old) ? old : next;
      });
    check();
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, [context]);
  return <DeparturePanel key={JSON.stringify([context, identity])} context={context} {...identity} />;
}
const statusLabel = { requested: '다른 admin 검토 대기', completed: '조직 탈퇴 완료', cancelled: '요청 취소됨' };
const countLabels = {
  ownedSources: '개인 소유 소스',
  ownedDashboards: '소유·연결 대시보드',
  activePublications: '미중지 게시',
  openExports: '미해결 출력',
  openRefreshes: '미해결 갱신',
  openExecutions: '미해결 실행',
  pendingHandovers: '미완료 최종 인계',
  pendingTransfer: '미완료 조직 이동',
  pendingCleanup: '미완료 파일 정리',
};
const blockerLabels = {
  owned_assets: '개인 소유·연결 자료를 먼저 정리해 주세요.',
  active_publications: '진행 중인 게시를 먼저 확인해 주세요.',
  open_work: '미해결 작업·파일 정리가 남아 있습니다.',
  pending_handover: '최종 인계가 아직 끝나지 않았습니다.',
  pending_transfer: '조직 이동 요청이 남아 있습니다.',
  last_admin: '다른 활성 admin이 남아야 합니다.',
  unsupported_state: '현재 상태를 안전하게 확정할 수 없습니다.',
};
function DeparturePanel({
  context,
  actor,
  session,
}: {
  context: EnterpriseContext;
  actor: number | null;
  session: string | null;
}) {
  const scope: StaffDepartureScope = {
    actorId: actor || 0,
    organizationId: context.organization?.id ?? null,
    organizationVersion: context.organization?.version ?? null,
    isAdmin: context.membership?.role === 'admin',
  };
  const [restored] = useState(() => readPendingStaffDeparture(session, actor || 0));
  const [pending, setPending] = useState<PendingStaffDeparture | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [id, setId] = useState(restored.pending?.requestId || '');
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [record, setRecord] = useState<StaffDepartureRecord | null>(null),
    [review, setReview] = useState<StaffDepartureReview | null>(null);
  const [requestAck, setRequestAck] = useState(false),
    [finalAck, setFinalAck] = useState(false),
    [cancelAck, setCancelAck] = useState(false);
  const [retry, setRetry] = useState(false),
    [cancelUnknown, setCancelUnknown] = useState(false),
    [authExpired, setAuthExpired] = useState(false);
  const generation = useRef(0),
    abort = useRef<AbortController | null>(null),
    gate = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  const reset = () => {
    generation.current += 1;
    abort.current?.abort();
    gate.current = false;
    setBusy(false);
    setRecord(null);
    setReview(null);
    setRequestAck(false);
    setFinalAck(false);
    setCancelAck(false);
    setRetry(false);
    setError('');
  };
  const liveIdentity = () => personalLibrarySessionScope() === session && cachedActor(context) === actor;
  const run = async (work: (current: () => boolean, signal: AbortSignal) => Promise<void>) => {
    if (gate.current || !actor || !liveIdentity() || authExpired) return;
    reset();
    gate.current = true;
    setBusy(true);
    const n = generation.current,
      controller = new AbortController();
    abort.current = controller;
    const current = () => generation.current === n && !controller.signal.aborted && liveIdentity();
    try {
      await work(current, controller.signal);
    } catch (cause) {
      if (current()) {
        const e = enterpriseError(cause);
        setError(
          e.kind === 'auth' ? '로그인이 만료되었습니다. 다시 로그인한 뒤 같은 요청 번호로 직접 조회해 주세요.' : e.message,
        );
        if (e.kind === 'auth') setAuthExpired(true);
      }
    } finally {
      if (current()) {
        gate.current = false;
        setBusy(false);
      }
    }
  };
  const clearTicket = (p: PendingStaffDeparture) => {
    const ok = clearPendingStaffDeparture(session, p);
    setStorageError(!ok);
    if (ok) setPending(null);
  };
  const read = () =>
    void run(async (current, signal) => {
      try {
        const next = await fetchStaffDeparture(id, scope, { signal });
        if (!current()) return;
        if (pending) {
          if (
            next.requestId !== pending.requestId ||
            next.organizationId !== pending.organizationId ||
            next.userId !== (pending.operation === 'request' ? actor : pending.targetId)
          )
            throw new Error('retained request mismatch');
          if (pending.operation === 'complete' && next.status === 'requested') {
            // The exact captured completion body is retained. Reading must never silently replace its basis.
            if (
              Date.parse(next.expiresAt) > Date.now() &&
              next.version === pending.input.expectedVersion &&
              scope.organizationId === pending.organizationId &&
              scope.isAdmin
            )
              setRetry(true);
          } else clearTicket(pending);
        }
        setCancelUnknown(false);
        setRecord(next);
      } catch (cause) {
        if (!current()) return;
        const e = enterpriseError(cause);
        if (
          e.status === 404 &&
          pending?.operation === 'request' &&
          pending.organizationId === scope.organizationId &&
          pending.input.expectedOrganizationVersion === scope.organizationVersion
        ) {
          setRetry(true);
          setError('기록이 없습니다. 보존한 같은 요청 번호·입력으로만 다시 요청할 수 있습니다.');
        } else throw e;
      }
    });
  const write = (p: PendingStaffDeparture, old?: StaffDepartureRecord) => {
    if (gate.current || !liveIdentity() || (p.operation === 'complete' && !old)) return;
    if (!savePendingStaffDeparture(session, p)) {
      setStorageError(true);
      return;
    }
    setPending(p);
    setId(p.requestId);
    void run(async current => {
      try {
        let next: StaffDepartureRecord;
        if (p.operation === 'request') next = await requestStaffDeparture(p.input, scope);
        else {
          if (!old) return;
          next = await completeStaffDeparture(old, p.input, scope);
        }
        // A close/unmount still leaves the ticket for explicit reconciliation.
        if (!current()) return;
        clearTicket(p);
        setRecord(next);
      } catch (cause) {
        if (!current()) return;
        const e = enterpriseError(cause);
        if (e.status !== null && e.status >= 400 && e.status < 500) clearTicket(p);
        throw e;
      }
    });
  };
  const request = () => {
    if (
      gate.current ||
      pending ||
      storageError ||
      !requestAck ||
      !!id.trim() ||
      !scope.organizationId ||
      scope.organizationVersion === null ||
      !session ||
      !actor ||
      !liveIdentity()
    )
      return;
    const requestId = crypto.randomUUID();
    write({
      savedAt: Date.now(),
      actorId: actor,
      organizationId: scope.organizationId,
      requestId,
      operation: 'request',
      input: { requestId, expectedOrganizationVersion: scope.organizationVersion, acknowledgedDeparture: true },
    });
  };
  const inspect = () => {
    const previous = record;
    if (!previous || pending) return;
    void run(async (current, signal) => {
      const next = await reviewStaffDeparture(previous, scope, { signal });
      if (current()) {
        setRecord(previous);
        setReview(next);
      }
    });
  };
  const complete = () => {
    if (!record || !review?.eligible || !finalAck || pending || storageError || !actor) return;
    write(
      {
        savedAt: Date.now(),
        actorId: actor,
        organizationId: record.organizationId,
        requestId: record.requestId,
        targetId: record.userId,
        operation: 'complete',
        input: { expectedVersion: review.requestVersion, reviewBasis: review.basis, acknowledgedDeparture: true },
      },
      record,
    );
  };
  const retryWrite = () => {
    if (!pending || !retry || !(pending.operation === 'request' ? requestAck : finalAck)) return;
    write(pending, record || undefined);
  };
  const cancel = () => {
    const previous = record;
    if (!previous || !cancelAck || pending) return;
    void run(async current => {
      try {
        const next = await cancelStaffDeparture(previous, scope);
        if (current()) {
          setRecord(next);
          setCancelUnknown(false);
        }
      } catch (cause) {
        if (current()) {
          const e = enterpriseError(cause);
          setCancelUnknown(e.status === null || e.status >= 500);
        }
        throw cause;
      }
    });
  };
  const self = record?.userId === actor;
  const active = record?.status === 'requested' && Date.parse(record.expiresAt) > Date.now();
  const admin = active && !self && scope.isAdmin && record?.organizationId === scope.organizationId;
  const disabled = busy || authExpired || !actor || !session;
  return (
    <section aria-label="조직 탈퇴" className="mt-4 min-w-0 rounded-lg border p-3">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          reset();
          setOpen(v => !v);
        }}
      >
        조직 탈퇴 {open ? '접기' : '펼치기'}
      </Button>
      {open && (
        <div className="mt-3 min-w-0 space-y-3 text-sm">
          <p>조직 소속만 종료합니다. 법적 퇴사나 계정 삭제가 아니며, 개인 계정과 기존 자료·기록은 보존됩니다.</p>
          <p>기존 로그인과 조직 권한·전달·그룹 관계는 회수됩니다. 보존된 자료의 열람은 현재 권한을 따릅니다.</p>
          <details>
            <summary className="cursor-pointer">처리 기준과 보존 범위</summary>
            <p className="mt-2">
              전체 개인 소유 자료와 미해결 게시·작업·인계를 먼저 확인합니다. 자동 자료 이전·삭제는 없습니다. 본인 동의 후
              15분 안에 다른 현재 조직 admin이 최신 잔여 건수를 검토하고 별도로 확정합니다. 완료 영수증은 과거 처리 기록이며
              현재 소속·접근권을 증명하지 않습니다.
            </p>
          </details>
          {!actor && <Notice severity="info">다시 로그인한 뒤 본인 요청 번호를 조회해 주세요.</Notice>}
          {storageError && (
            <Notice severity="error" role="alert">
              탭 복구 기록을 안전하게 확인하거나 저장할 수 없습니다. 새 요청을 보내지 말고 기존 요청 번호로 현재 기록을
              확인해 주세요.
            </Notice>
          )}
          {pending && (
            <Notice severity="warning" role="status">
              저장 결과를 확인할 요청 번호가 보존되어 있습니다. 먼저 현재 기록을 조회해 주세요. 확인 전에는 새 요청을 보내지
              않습니다.
            </Notice>
          )}
          {cancelUnknown && (
            <Notice severity="warning">취소 결과가 불명확합니다. 같은 요청 번호로 현재 기록을 조회해 주세요.</Notice>
          )}
          <div>
            <label htmlFor="departure-request-id">탈퇴 요청 번호</label>
            <div className="mt-1 flex min-w-0 flex-col items-start gap-2 sm:flex-row">
              <Input
                id="departure-request-id"
                className="md:text-base lg:text-sm"
                aria-describedby="departure-request-help"
                value={id}
                disabled={busy || !!pending || cancelUnknown}
                onChange={e => {
                  reset();
                  setId(e.target.value);
                }}
              />
              <Button disabled={disabled || !isHandoverId(id)} onClick={read}>
                현재 기록 조회
              </Button>
            </div>
            <p id="departure-request-help" className="mt-1 text-xs text-muted-foreground">
              본인은 소속이 없어도 과거 기록을 조회할 수 있습니다. 다른 직원 기록은 원 조직의 현재 admin만 확인할 수
              있습니다.
            </p>
          </div>
          {error && (
            <Notice severity="error" role="alert">
              {error}
            </Notice>
          )}
          {record && (
            <div role="status" className="min-w-0 space-y-1 rounded-md bg-muted p-3">
              <p>{statusLabel[record.status]}</p>
              <p className="break-all">요청 번호: {record.requestId}</p>
              <p>
                직원 번호 {record.userId} · 원 조직 번호 {record.organizationId} · 요청 버전 {record.version}
              </p>
              <p>
                요청 시각 {record.requestedAt} · 기한 {record.expiresAt}
              </p>
              {record.completedAt && (
                <p>
                  완료 시각 {record.completedAt} · 처리 admin 번호 {record.completedBy}
                </p>
              )}
              {record.cancelledAt && <p>취소 시각 {record.cancelledAt}</p>}
              {self && record.status === 'requested' && (
                <p>이 요청 번호를 기존 연락 경로로 다른 조직 admin에게 전달해 주세요.</p>
              )}
              {self && record.status === 'completed' && (
                <p>완료 이전 로그인은 회수됩니다. 다시 로그인한 뒤 본인 영수증을 조회해 주세요.</p>
              )}
              {record.status === 'requested' && !active && <p>기한이 지난 과거 요청입니다. 실행할 수 없습니다.</p>}
            </div>
          )}
          {context.membership && !pending && !cancelUnknown && !id.trim() && (!record || self) && (
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={requestAck}
                  disabled={disabled || storageError}
                  onChange={e => setRequestAck(e.target.checked)}
                />
                본인의 조직 탈퇴 요청과 로그인·조직 관계 회수에 동의합니다.
              </label>
              <Button disabled={disabled || storageError || !requestAck} onClick={request}>
                본인 탈퇴 요청 저장
              </Button>
            </div>
          )}
          {context.membership && !pending && !cancelUnknown && !!id.trim() && (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || storageError}
              onClick={() => {
                reset();
                setId('');
              }}
            >
              새 본인 요청 작성
            </Button>
          )}
          {admin && !pending && (
            <Button disabled={disabled} onClick={inspect}>
              최신 잔여 검토
            </Button>
          )}
          {review && (
            <div className="space-y-2">
              <p>
                직원 번호 {review.userId} · 조직 번호 {review.organizationId} · 조직 버전 {review.organizationVersion}
              </p>
              <p>
                검토 시각 {review.checkedAt} · {review.eligible ? '이번 검토에서 차단 사유 없음' : '확정 차단 사유 있음'}
              </p>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(countLabels).map(([k, label]) => (
                  <div key={k} className="rounded-md border p-2">
                    <dt>{label}</dt>
                    <dd>{review.counts[k]}</dd>
                  </div>
                ))}
              </dl>
              {review.blockers.map(b => (
                <p key={b}>{blockerLabels[b]}</p>
              ))}
            </div>
          )}
          {admin && review?.eligible && !pending && (
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={finalAck}
                  disabled={disabled}
                  onChange={e => setFinalAck(e.target.checked)}
                />
                최신 잔여와 보존 범위를 확인했으며, 이 직원의 조직 탈퇴를 확정합니다.
              </label>
              <Button variant="destructive" disabled={disabled || storageError || !finalAck} onClick={complete}>
                조직 탈퇴 확정
              </Button>
            </div>
          )}
          {self && record?.status === 'requested' && !pending && !cancelUnknown && (
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={cancelAck}
                  disabled={disabled}
                  onChange={e => setCancelAck(e.target.checked)}
                />
                아직 실행되지 않은 본인 요청을 취소합니다.
              </label>
              <Button variant="outline" disabled={disabled || !cancelAck} onClick={cancel}>
                본인 요청 취소
              </Button>
            </div>
          )}
          {pending && retry && (
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={pending.operation === 'request' ? requestAck : finalAck}
                  disabled={disabled}
                  onChange={e =>
                    pending.operation === 'request' ? setRequestAck(e.target.checked) : setFinalAck(e.target.checked)
                  }
                />
                보존한 같은 요청 번호·입력으로 {pending.operation === 'request' ? '본인 탈퇴 요청' : '조직 탈퇴 확정'}을 다시
                시도합니다.
              </label>
              <Button
                disabled={disabled || storageError || !(pending.operation === 'request' ? requestAck : finalAck)}
                onClick={retryWrite}
              >
                같은 요청 다시 시도
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
