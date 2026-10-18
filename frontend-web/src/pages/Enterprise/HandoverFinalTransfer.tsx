import React, { useEffect, useRef, useState } from 'react';
import { HandoverProposal, HandoverScope } from '@/api/handoverService';
import { enterpriseError } from '@/api/enterpriseService';
import {
  decideTransfer,
  fetchTransfer,
  fetchTransferReview,
  prepareTransfer,
  TransferRecord,
  TransferReview,
} from '@/api/handoverTransferService';
import {
  clearPendingTransfer,
  PendingTransfer,
  readPendingTransfer,
  savePendingTransfer,
  transferStorageKey,
} from '@/api/handoverTransferStorage';
import { useClassificationSession } from './useClassificationSession';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
type Props = { review: HandoverProposal; scope: HandoverScope; organizationVersion: number };
const statusLabel = {
  prepared: '최종 수락 대기',
  accepted: '최종 수락됨',
  completed: '이전 완료',
  cancelled: '최종 요청 취소됨',
};
const blockers = {
  source_transfer_deferred: '소스 자체 이전은 이번 범위에 포함되지 않습니다.',
  recipient_source_ownership_required: '연결 소스는 수신자가 이미 활성 소유해야 합니다.',
  shared_dashboard: '활성 공유·게시·권한·전달 관계를 별도로 검토해야 합니다.',
  unsupported_definition: '지원하지 않거나 확인할 수 없는 정의입니다.',
  running_work: '실행 중이거나 미해결된 작업이 있습니다.',
  stale_studio: '저장된 Studio 기준을 다시 확인해야 합니다.',
  governed_dashboard: '관리 대상 대시보드는 이번 범위에 포함되지 않습니다.',
  unsupported_widget: '공유되었거나 지원하지 않는 위젯·템플릿 연결을 확인해 주세요.',
  asset_version_limit: '자료 버전 한도로 이전할 수 없습니다.',
};
export default function HandoverFinalTransfer(props: Props) {
  const session = useClassificationSession();
  return props.review.organizationId === props.scope.organizationId &&
    [props.review.ownerId, props.review.recipientId].includes(props.scope.actorId) ? (
    <FinalTransfer key={JSON.stringify([props, session])} {...props} session={session} />
  ) : null;
}
function FinalTransfer({ review, scope, session }: Props & { session: string | null }) {
  const [key] = useState(() => transferStorageKey(session, scope.actorId, scope.organizationId, review.requestId));
  const [restored] = useState(() => readPendingTransfer(key));
  const [pending, setPending] = useState<PendingTransfer | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [rejectedTicket, setRejectedTicket] = useState<PendingTransfer | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [retry, setRetry] = useState(false);
  const [report, setReport] = useState<TransferReview | null>(null),
    [record, setRecord] = useState<TransferRecord | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [checked, setChecked] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0),
    abort = useRef<AbortController | null>(null),
    gate = useRef(false);
  const owner = scope.actorId === review.ownerId;
  const canReview = owner && !terminal && review.status === 'accepted' && review.detailsAvailable && !review.expired;
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  const invalidate = () => {
    generation.current += 1;
    abort.current?.abort();
    gate.current = false;
    setBusy(false);
    setReport(null);
    setRecord(null);
    setStatusLoaded(false);
    setChecked(false);
    setRetry(false);
    setError('');
  };
  const clearPending = () => {
    setPending(null);
    setStorageError(!clearPendingTransfer(key));
  };
  const run = async (action: (current: () => boolean, signal: AbortSignal) => Promise<void>) => {
    if (gate.current) return;
    invalidate();
    gate.current = true;
    setBusy(true);
    const token = generation.current,
      controller = new AbortController();
    abort.current = controller;
    const current = () => generation.current === token && !controller.signal.aborted;
    try {
      await action(current, controller.signal);
    } catch (cause) {
      if (current()) setError(enterpriseError(cause).message);
    } finally {
      if (current()) {
        gate.current = false;
        setBusy(false);
        abort.current = null;
      }
    }
  };
  const status = () =>
    void run(async (current, signal) => {
      try {
        const next = await fetchTransfer(review, scope, { signal });
        if (!current()) return;
        // A different final request must never unlock a retained unknown preparation.
        if (pending && next.requestId !== pending.input.requestId) {
          setError('저장된 요청 번호와 현재 최종 기록이 다릅니다. 새 요청을 보내지 마세요.');
          return;
        }
        clearPending();
        setUnknown(false);
        setStatusLoaded(true);
        setRecord(next);
        if (next.status === 'completed' || next.status === 'cancelled') setTerminal(true);
      } catch (cause) {
        if (!current()) return;
        const err = enterpriseError(cause);
        if (err.status === 404 && pending) {
          setRetry(true);
          setUnknown(false);
          setError('최종 기록이 없습니다. 보존한 같은 요청 번호·입력으로만 다시 준비할 수 있습니다.');
        } else if (err.status === 404) {
          if (storageError) setStorageError(!clearPendingTransfer(key));
          setError('최종 기록이 없습니다. 소유자는 현재 조건을 명시 검토한 뒤 준비할 수 있습니다.');
        } else {
          setError(err.message);
        }
      }
    });
  const prepare = () => {
    if (!checked || storageError || (pending && !retry) || (!pending && !report?.eligible)) return;
    const ticket = pending ?? {
      savedAt: Date.now(),
      input: {
        requestId: crypto.randomUUID(),
        expectedProposalVersion: report.proposalVersion,
        basis: report.basis,
        acknowledgedTransfer: true as const,
      },
    };
    // Persist before sending: a reload during the write must retain its exact input.
    if (!savePendingTransfer(key, ticket)) {
      setStorageError(true);
      setError('탭 복구 정보를 저장하지 못해 요청을 보내지 않았습니다.');
      return;
    }
    setPending(ticket);
    setRejectedTicket(null);
    void run(async current => {
      setUnknown(true);
      try {
        const next = await prepareTransfer(review, scope, ticket.input);
        if (current()) {
          clearPending();
          setUnknown(false);
          setRecord(next);
          if (next.status === 'completed' || next.status === 'cancelled') setTerminal(true);
        }
      } catch (cause) {
        if (!current()) return;
        const err = enterpriseError(cause);
        if (err.status !== null && err.status >= 400 && err.status < 500) {
          setRejectedTicket(ticket);
          clearPending();
          setUnknown(false);
        }
        setError(err.message);
      }
    });
  };
  const decide = (action: 'accept' | 'execute' | 'cancel') => {
    if (!checked || !record || !statusLoaded || pending || unknown) return;
    if (action !== 'cancel' && Date.parse(record.expiresAt) <= Date.now()) {
      invalidate();
      setError('최종 요청이 만료되었습니다. 현재 상태를 다시 조회하세요.');
      return;
    }
    const captured = record;
    void run(async current => {
      setUnknown(true);
      try {
        const next = await decideTransfer(review, scope, captured, action);
        if (current()) {
          setUnknown(false);
          setRecord(next);
          if (next.status === 'completed' || next.status === 'cancelled') setTerminal(true);
        }
      } catch (cause) {
        if (!current()) return;
        const err = enterpriseError(cause);
        if (err.status !== null && err.status >= 400 && err.status < 500) setUnknown(false);
        setError(err.message);
      }
    });
  };
  const writable =
    record &&
    ['prepared', 'accepted'].includes(record.status) &&
    record.detailsAvailable &&
    Date.parse(record.expiresAt) > Date.now() &&
    review.status === 'accepted' &&
    !review.expired &&
    review.detailsAvailable;
  return (
    <section aria-label="최종 대시보드 인계" className="flex min-w-0 flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        aria-expanded={open}
        onClick={() => {
          invalidate();
          setOpen(!open);
        }}
      >
        최종 대시보드 인계 {open ? '닫기' : '열기'}
      </Button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
          <p className="text-sm">
            기존 제목 공개 의향과 별도의 최종 동의입니다. 실행하면 선택한 비공개 대시보드 전체의 소유권이 수신자에게 넘어가며
            기존 소유자의 소유권 기반 접근은 즉시 종료됩니다.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">이전 효과와 제외 범위</summary>
            <p className="mt-2">
              대시보드 번호·제목·정의·블록과 모든 폭의 배치는 보존합니다. 소스·원본 파일 내용·지표·독립 사본·게시
              이력·계정·조직·다른 권한은 이전하거나 새로 부여하지 않습니다. 연결 소스는 수신자가 이미 활성 소유해야 하며 단순
              열람 권한으로는 부족합니다. 기존 공유를 자동 정리하지 않습니다. 게시·대시보드 이용 가능 여부는 현재 소스·게시
              권한을 따릅니다. 과거 기록은 현재 접근권이나 전체 퇴사 완료의 증명이 아닙니다.
            </p>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={status}>
              최종 요청 상태 조회
            </Button>
            {canReview && (
              <Button
                variant="outline"
                disabled={busy || !!pending || unknown || storageError}
                onClick={() =>
                  void run(async (current, signal) => {
                    const next = await fetchTransferReview(review, scope, { signal });
                    if (current()) setReport(next);
                  })
                }
              >
                최종 이전 조건 검토
              </Button>
            )}
          </div>
          {rejectedTicket && (
            <p className="wrap-anywhere text-xs">
              요청이 거절되었습니다. 요청 번호 {rejectedTicket.input.requestId} · 읽은 의향 버전{' '}
              {rejectedTicket.input.expectedProposalVersion}의 입력을 유지했습니다. 조건을 다시 검토한 뒤 새 요청을 명시
              준비하세요.
            </p>
          )}
          {(pending || unknown) && (
            <Notice severity="warning">
              저장 결과를 확인해야 합니다. 같은 요청 번호로 상태를 먼저 조회하세요.
              {pending && <span className="block wrap-anywhere">요청 번호 {pending.input.requestId}</span>}
            </Notice>
          )}
          {storageError && (
            <Notice severity="warning">
              탭 복구 정보를 확인하지 못했습니다. 새 준비 요청을 보내기 전에 현재 최종 기록을 조회하세요.
            </Notice>
          )}
          {report && (
            <div>
              <p role="status" className="text-sm">
                {report.eligible
                  ? '현재 지원 범위에서 준비 가능 · 실행 승인은 아닙니다.'
                  : '현재 조건에서는 이전할 수 없습니다.'}
              </p>
              <ul className="text-xs">
                {report.blockers.map(b => (
                  <li key={b}>{blockers[b]}</li>
                ))}
              </ul>
            </div>
          )}
          {(report || record) && (
            <>
              <p className="wrap-anywhere text-xs">
                조직 #{review.organizationId} · 소유자 #{review.ownerId} → 수신자 #{review.recipientId}
              </p>
              {record && (
                <>
                  <p role="status" className="text-sm">
                    {statusLabel[record.status]} · 버전 {record.version} · 만료 {new Date(record.expiresAt).toLocaleString()}
                  </p>
                  <p className="wrap-anywhere text-xs">
                    요청 번호 {record.requestId} · 과거 기록이며 현재 접근권을 보장하지 않습니다.
                  </p>
                  {record.acceptedAt && (
                    <p className="text-xs">최종 수락 시각 {new Date(record.acceptedAt).toLocaleString()}</p>
                  )}
                  {record.completedAt && (
                    <p className="text-xs">이전 완료 시각 {new Date(record.completedAt).toLocaleString()}</p>
                  )}
                  {!record.detailsAvailable && (
                    <p className="text-sm">자료 공개가 종료되어 제목·번호를 표시하지 않습니다.</p>
                  )}
                </>
              )}
              <ul aria-label="최종 인계 대시보드" className="min-w-0 text-sm">
                {(record?.dashboards ?? report?.dashboards ?? []).map(d => (
                  <li className="wrap-anywhere" key={d.id}>
                    대시보드 #{d.id} · {d.title}
                  </li>
                ))}
              </ul>
            </>
          )}
          {(report?.eligible ||
            retry ||
            (record && (writable || (owner && ['prepared', 'accepted'].includes(record.status))))) && (
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={checked}
                disabled={busy || (!!pending && !retry) || unknown}
                onChange={e => setChecked(e.target.checked)}
              />
              목록·당사자·현재 상태와 이전 효과를 확인하고 아래 작업에 별도로 동의합니다.
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {canReview && (report?.eligible || retry) && (
              <Button disabled={busy || !checked || storageError} onClick={prepare}>
                {retry
                  ? '같은 요청으로 최종 준비 재시도'
                  : rejectedTicket
                  ? '새 최종 인계 요청 준비'
                  : '최종 인계 요청 준비'}
              </Button>
            )}
            {!owner && writable && record.status === 'prepared' && (
              <Button disabled={busy || !checked || unknown || !statusLoaded} onClick={() => decide('accept')}>
                최종 인계 수락
              </Button>
            )}
            {owner && writable && record.status === 'accepted' && (
              <Button disabled={busy || !checked || unknown || !statusLoaded} onClick={() => decide('execute')}>
                선택 대시보드 전체 이전 실행
              </Button>
            )}
            {owner && record && ['prepared', 'accepted'].includes(record.status) && (
              <Button
                variant="outline"
                disabled={busy || !checked || unknown || !statusLoaded}
                onClick={() => decide('cancel')}
              >
                최종 인계 요청 취소
              </Button>
            )}
          </div>
          {busy && (
            <p role="status" className="text-xs">
              최종 인계 확인 중…
            </p>
          )}
          {error && <Notice severity="error">{error}</Notice>}
        </div>
      )}
    </section>
  );
}
