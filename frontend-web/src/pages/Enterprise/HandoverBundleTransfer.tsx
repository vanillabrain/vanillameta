import React, { useEffect, useRef, useState } from 'react';
import { HandoverProposal, HandoverScope } from '@/api/handoverService';
import { enterpriseError } from '@/api/enterpriseService';
import {
  decideBundleTransfer,
  fetchBundleTransfer,
  fetchBundleTransferReview,
  prepareBundleTransfer,
  BundleTransferRecord,
  BundleTransferReview,
} from '@/api/bundlehandoverService';
import {
  clearPendingBundleTransfer,
  PendingBundleTransfer,
  readPendingBundleTransfer,
  savePendingBundleTransfer,
  bundleTransferStorageKey,
} from '@/api/bundlehandoverStorage';
import { useClassificationSession } from './useClassificationSession';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
type Props = { review: HandoverProposal; scope: HandoverScope; organizationVersion: number };
const statusLabel = {
  prepared: '묶음 최종 수락 대기',
  accepted: '묶음 최종 수락됨',
  completed: '묶음 이전 완료',
  cancelled: '묶음 최종 요청 취소됨',
};
const blockers = {
  mixed_assets: '소스와 대시보드를 각각 하나 이상, 전체 2~20개 선택한 의향이 필요합니다.',
  unsupported_source: '등록·준비 완료한 관리 DuckDB 파일 소스만 함께 이전할 수 있습니다.',
  source_in_use: '선택 목록 밖의 자료·공유 자식·보기 등 사용처를 먼저 확인해 주세요.',
  active_permissions: '활성 직접·그룹 권한을 별도로 검토해야 합니다.',
  running_work: '진행 중이거나 미해결된 작업·출력·갱신·보관 처리가 있습니다.',
  file_unresolved: '파일 신원·등록·관리 범위 또는 사용처를 확정할 수 없습니다.',
  file_shared: '파일 공유 사용처가 관측되어 함께 이전할 수 없습니다.',
  asset_version_limit: '자료 버전 한도로 이전할 수 없습니다.',
  source_transfer_deferred: '현재 지원 범위에서 소스 이전 조건을 확인할 수 없습니다.',
  recipient_source_ownership_required: '소스 소유권과 연결 범위를 다시 확인해 주세요.',
  shared_dashboard: '대시보드의 활성 공유·게시·권한·전달 관계를 별도로 검토해야 합니다.',
  unsupported_definition: '지원하지 않거나 확인할 수 없는 저장 정의입니다.',
  stale_studio: '저장된 Studio 기준을 다시 확인해야 합니다.',
  governed_dashboard: '관리 대상 대시보드는 이번 범위에 포함되지 않습니다.',
  unsupported_widget: '공유되었거나 지원하지 않는 위젯·템플릿 연결을 확인해 주세요.',
  connection_scope_required:
    '선택한 대시보드의 모든 연결 소스를 포함하고, 모든 선택 소스가 선택 대시보드에서 사용되는지 확인해 주세요. 누락 자료는 자동 추가하지 않습니다.',
};
export default function HandoverBundleTransfer(props: Props) {
  const session = useClassificationSession();
  return props.review.organizationId === props.scope.organizationId &&
    [props.review.ownerId, props.review.recipientId].includes(props.scope.actorId) ? (
    <BundleTransfer key={JSON.stringify([props, session])} {...props} session={session} />
  ) : null;
}
function BundleTransfer({ review, scope, session }: Props & { session: string | null }) {
  const [key] = useState(() => bundleTransferStorageKey(session, scope.actorId, scope.organizationId, review.requestId));
  const [restored] = useState(() => readPendingBundleTransfer(key));
  const [pending, setPending] = useState<PendingBundleTransfer | null>(restored.pending);
  const [storageError, setStorageError] = useState(restored.error);
  const [rejectedTicket, setRejectedTicket] = useState<PendingBundleTransfer | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [retry, setRetry] = useState(false);
  const [report, setReport] = useState<BundleTransferReview | null>(null),
    [record, setRecord] = useState<BundleTransferRecord | null>(null);
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
    setStorageError(!clearPendingBundleTransfer(key));
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
        const next = await fetchBundleTransfer(review, scope, { signal });
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
          if (storageError) setStorageError(!clearPendingBundleTransfer(key));
          setError('최종 기록이 없습니다. 소유자는 현재 조건을 명시 검토한 뒤 준비할 수 있습니다.');
        } else {
          setError(err.message);
        }
      }
    });
  const prepare = () => {
    if (gate.current || !checked || storageError || (pending && !retry) || (!pending && !report?.eligible)) return;
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
    if (!savePendingBundleTransfer(key, ticket)) {
      setStorageError(true);
      setError('탭 복구 정보를 저장하지 못해 요청을 보내지 않았습니다.');
      return;
    }
    setPending(ticket);
    setRejectedTicket(null);
    void run(async current => {
      setUnknown(true);
      try {
        const next = await prepareBundleTransfer(review, scope, ticket.input);
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
        const next = await decideBundleTransfer(review, scope, captured, action);
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
    <section aria-label="소스·대시보드 함께 인계" className="flex min-w-0 flex-col gap-2">
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
        소스·대시보드 함께 인계 {open ? '닫기' : '열기'}
      </Button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
          <p className="text-sm">
            기존 제목 공개 의향과 별도의 최종 동의입니다. 실행하면 선택 소스의 파일 데이터·저장 업무 정의·지표 관리권과 연결
            대시보드 전체의 소유권이 수신자에게 함께 넘어갑니다. 기존 소유자의 다음 보호 요청은 거절되며 실제 내용은 실행
            이후 현재 새 소유권으로만 열람할 수 있습니다.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">이전 효과와 제외 범위</summary>
            <p className="mt-2">
              같은 소유자의 등록·준비 완료한 관리 DuckDB 소스와 비공개 대시보드를 각각 하나 이상, 전체 2~20개 함께
              이전합니다. 모든 대시보드의 연결 소스가 선택 목록에 있고, 모든 선택 소스가 선택 대시보드에서 사용되어야 합니다.
              누락 자료를 자동 추가하거나 미선택 자료 제목을 공개하지 않습니다. 하나라도 실패하면 묶음 전체가 이전되지
              않습니다. 소스·지표 번호와 정의·카탈로그·조건 이력·파일 경로·원본 파일 내용·관리 명세와 대시보드·연결 자료
              번호와 정의·Studio 문서·블록·모든 폭 배치·기존 사본·과거 기록을 보존합니다. OS 파일 이동·복사·삭제·소유자 변경
              없이 앱 관리권을 넘깁니다. 공유·게시·다른 권한은 새로 부여하지 않으며 이용 가능 여부는 현재 권한을 따릅니다.
              이미 전달된 데이터·진행 중 조회을 회수하거나 전역 소비자 부재·배타 보관·퇴사 완료를 보장하지 않습니다. 과거
              영수증은 현재 접근권이 아닙니다.
            </p>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={status}>
              묶음 인계 상태 조회
            </Button>
            {canReview && (
              <Button
                variant="outline"
                disabled={busy || !!pending || unknown || storageError}
                onClick={() =>
                  void run(async (current, signal) => {
                    const next = await fetchBundleTransferReview(review, scope, { signal });
                    if (current()) setReport(next);
                  })
                }
              >
                함께 이전할 조건 검토
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
                  ? '현재 지원 범위에서 묶음 준비 가능 · 실행 승인은 아닙니다.'
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
              <ul aria-label="최종 인계 소스" className="grid min-w-0 grid-cols-1 gap-2 text-sm md:grid-cols-2">
                {(record?.sources ?? report?.sources ?? []).map(d => (
                  <li className="wrap-anywhere" key={d.id}>
                    소스 #{d.id} · {d.title}
                    <span className="block text-xs text-muted-foreground">
                      검사한 파일 {d.filesChecked}개 · 저장 지표 {d.metricCount}개
                    </span>
                  </li>
                ))}
              </ul>
              <ul aria-label="최종 인계 대시보드" className="grid min-w-0 grid-cols-1 gap-2 text-sm md:grid-cols-2">
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
              목록·당사자·현재 상태를 확인했습니다. 파일 데이터·저장 업무 정의·지표 관리권과 대시보드 내용·정의·블록·배치
              소유권 전체를 함께 이전·수락하는 아래 작업에 별도로 동의합니다.
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {canReview && (report?.eligible || retry) && (
              <Button disabled={busy || !checked || storageError} onClick={prepare}>
                {retry
                  ? '같은 요청으로 묶음 준비 재시도'
                  : rejectedTicket
                  ? '새 묶음 인계 요청 준비'
                  : '최종 묶음 인계 요청 준비'}
              </Button>
            )}
            {!owner && writable && record.status === 'prepared' && (
              <Button disabled={busy || !checked || unknown || !statusLoaded} onClick={() => decide('accept')}>
                최종 묶음 인계 수락
              </Button>
            )}
            {owner && writable && record.status === 'accepted' && (
              <Button disabled={busy || !checked || unknown || !statusLoaded} onClick={() => decide('execute')}>
                선택 묶음 전체 이전 실행
              </Button>
            )}
            {owner && record && ['prepared', 'accepted'].includes(record.status) && (
              <Button
                variant="outline"
                disabled={busy || !checked || unknown || !statusLoaded}
                onClick={() => decide('cancel')}
              >
                묶음 인계 요청 취소
              </Button>
            )}
          </div>
          {busy && (
            <p role="status" className="text-xs">
              묶음 인계 확인 중…
            </p>
          )}
          {error && <Notice severity="error">{error}</Notice>}
        </div>
      )}
    </section>
  );
}
