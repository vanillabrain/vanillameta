import React, { useEffect, useId, useRef, useState } from 'react';
import { EnterpriseContext, enterpriseError } from '@/api/enterpriseService';
import {
  HandoverAsset,
  HandoverCandidates,
  HandoverCreate,
  HandoverKind,
  HandoverProposal as Proposal,
  createHandoverProposal,
  fetchHandoverCandidates,
  fetchHandoverProposal,
  isHandoverId,
  writeHandoverDecision,
} from '@/api/handoverService';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';

type Pending = { type: 'create'; input: HandoverCreate; canRetry: boolean } | { type: 'decision'; requestId: string };
const assetKey = (asset: HandoverAsset) => `${asset.kind}:${asset.id}`;
const kindLabel = (kind: HandoverKind) => (kind === 'source' ? '소스' : '대시보드');
const statusLabel = (status: Proposal['status']) =>
  ({ pending: '의향 수락 대기', accepted: '의향 수락 기록', cancelled: '의향 철회 기록' }[status]);
export default function HandoverProposal({ context }: { context: EnterpriseContext }) {
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<HandoverKind>('source');
  const [page, setPage] = useState<HandoverCandidates | null>(null);
  const [selected, setSelected] = useState<HandoverAsset[]>([]);
  const [recipient, setRecipient] = useState('');
  const [requestId, setRequestId] = useState('');
  const [review, setReview] = useState<Proposal | null>(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [rejected, setRejected] = useState(false);
  const [consent, setConsent] = useState(false);
  const [decisionConsent, setDecisionConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0),
    gate = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const organization = context.organization,
    membership = context.membership;
  const scope = { organizationId: organization?.id, actorId: membership?.userId };
  const scopeKey = `${organization?.id}:${organization?.version}:${membership?.userId}:${membership?.role}`;
  const invalidate = () => {
    generation.current += 1;
    abort.current?.abort();
    abort.current = null;
    gate.current = false;
    setBusy(false);
    setReview(null);
    setReviewLoaded(false);
    setConsent(false);
    setDecisionConsent(false);
    setError('');
    setNotice('');
  };
  useEffect(() => {
    invalidate();
    setOpen(false);
    setPage(null);
    setSelected([]);
    setRecipient('');
    setRequestId('');
    setPending(null);
    setRejected(false);
    return () => {
      generation.current += 1;
      abort.current?.abort();
    };
  }, [scopeKey]);
  const run = async (action: (token: number, signal: AbortSignal) => Promise<void>) => {
    if (gate.current) return;
    invalidate();
    const token = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    gate.current = true;
    setBusy(true);
    try {
      await action(token, controller.signal);
    } catch (cause) {
      if (generation.current === token) setError(enterpriseError(cause).message);
    } finally {
      if (generation.current === token) {
        gate.current = false;
        setBusy(false);
        abort.current = null;
      }
    }
  };
  const loadCandidates = (more = false) =>
    void run(async (token, signal) => {
      const old = page;
      setPage(null);
      const next = await fetchHandoverCandidates(kind, more ? old?.nextAfterId ?? undefined : undefined, { signal });
      if (generation.current !== token) return;
      setPage(more && old ? { ...next, entries: [...old.entries, ...next.entries] } : next);
    });
  const reviewRequest = (id = requestId.trim()) =>
    void run(async (token, signal) => {
      try {
        if (pending?.type === 'create') setPending({ ...pending, canRetry: false });
        const next = await fetchHandoverProposal(id, scope, { signal });
        if (generation.current !== token) return;
        if (
          pending?.type === 'create' &&
          (next.ownerId !== membership.userId ||
            next.recipientId !== pending.input.recipientId ||
            (next.detailsAvailable &&
              (next.assets.length !== pending.input.assets.length ||
                !pending.input.assets.every(item =>
                  next.assets.some(found => found.kind === item.kind && found.id === item.id && found.title === item.title),
                ))))
        )
          throw new Error('같은 요청 번호의 저장 입력이 다릅니다. 현재 요청 번호를 보존하고 확인하세요.');
        if (!next.detailsAvailable) {
          setSelected([]);
          setPage(null);
        }
        setReview(next);
        setReviewLoaded(true);
        setRequestId(next.requestId);
        if (pending) {
          setPending(null);
          setNotice('같은 요청의 현재 저장 기록을 확인했습니다. 새 실행 승인이 아닙니다.');
        }
      } catch (cause) {
        if (generation.current === token && pending?.type === 'create' && (cause as { status?: number }).status === 404) {
          setPending({ ...pending, canRetry: true });
          setNotice(
            '같은 요청 번호의 기록을 찾지 못했습니다. 선택·수신자를 유지한 같은 요청 번호로 저장만 명시적으로 다시 시도할 수 있습니다.',
          );
        }
        throw cause;
      }
    });
  const save = () =>
    void run(async token => {
      const input: HandoverCreate =
        pending?.type === 'create'
          ? pending.input
          : {
              requestId: crypto.randomUUID(),
              recipientId: Number(recipient),
              assets: selected.map(item => ({ ...item })),
            };
      setPending({ type: 'create', input, canRetry: false });
      setRequestId(input.requestId);
      setRejected(false);
      let next: Proposal;
      try {
        next = await createHandoverProposal(input, scope);
      } catch (cause) {
        const failure = enterpriseError(cause);
        if (
          generation.current === token &&
          failure.status !== null &&
          [400, 401, 403, 404, 409, 422].includes(failure.status)
        ) {
          setPending(null);
          setRejected(true);
          setNotice(
            '저장이 거절되어 반영되지 않았습니다. 기존 입력·요청 번호는 유지합니다. 후보를 다시 확인해 초안을 수정한 뒤 새 요청 저장을 명시적으로 선택하세요.',
          );
        }
        throw cause;
      }
      if (generation.current !== token) return;
      setPending(null);
      if (!next.detailsAvailable) {
        setSelected([]);
        setPage(null);
      }
      setReview(next);
      setNotice(`${statusLabel(next.status)} 상태를 확인했습니다. 실제 자료 이전이나 권한 부여는 실행하지 않았습니다.`);
    });
  const decide = (action: 'accept' | 'cancel') => {
    const basis = review;
    if (!basis || !reviewLoaded || !decisionConsent || pending) return;
    void run(async token => {
      setPending({ type: 'decision', requestId: basis.requestId });
      let next: Proposal;
      try {
        next = await writeHandoverDecision(basis, action, scope);
      } catch (cause) {
        const failure = enterpriseError(cause);
        if (
          generation.current === token &&
          failure.status !== null &&
          [400, 401, 403, 404, 409, 422].includes(failure.status)
        ) {
          setPending(null);
          setNotice(
            '의향 변경이 거절되어 반영되지 않았습니다. 요청 번호·입력은 유지합니다. 요청 상태와 고정 목록을 명시적으로 다시 조회·검토한 뒤 진행하세요.',
          );
        }
        throw cause;
      }
      if (generation.current !== token) return;
      setPending(null);
      if (!next.detailsAvailable) {
        setSelected([]);
        setPage(null);
      }
      setReview(next);
      setNotice('의향의 과거 저장 결과입니다. 현재 자료 접근권·소유권 이전·실행 승인이 아닙니다.');
    });
  };
  if (!organization || !membership) return null;
  const pendingId = pending?.type === 'create' ? pending.input.requestId : pending?.requestId;
  const validRecipient =
    /^[1-9]\d*$/.test(recipient) && Number.isSafeInteger(Number(recipient)) && Number(recipient) !== membership.userId;
  const canSave =
    !busy &&
    consent &&
    selected.length > 0 &&
    validRecipient &&
    (!pending || (pending.type === 'create' && pending.canRetry));
  return (
    <section aria-label="업무 자료 인계" className="mt-4 min-w-0 rounded-lg border border-border p-3">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => {
          invalidate();
          setPage(null);
          setPending(current => (current?.type === 'create' ? { ...current, canRetry: false } : current));
          setOpen(!open);
        }}
      >
        업무 자료 인계 {open ? '접기' : '열기'}
      </Button>
      {open && (
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            본인 자료의 제목·번호만 공개해 같은 조직 직원의 인계 의향을 확인합니다. 수락해도 자료 열람권·소유권·소속은 바뀌지
            않습니다.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">인계 의향의 범위와 한계</summary>
            <p className="mt-2">
              이 화면은 퇴사·탈퇴 완료나 실제 이전의 실행 승인이 아닙니다. 의존성·파일 보관·원본 파일 내용·외부 DB·전역
              사용처는 별도 검토가 필요합니다. 과거 기록은 현재 자료 접근권을 뜻하지 않습니다. 권한·게시·출력·원본·독립
              사본을 변경하지 않으며 외부 메시지·자동 알림도 보내지 않습니다. 요청은 24시간 유효하며 새로고침 뒤에는 요청
              번호로 직접 조회하세요. 요청 번호·초안을 브라우저에 영구 저장하지 않습니다.
            </p>
          </details>
          {pending && (
            <Notice severity="warning">
              <span className="wrap-anywhere">
                저장 결과 확인이 필요합니다. 요청 {pendingId}의 상태부터 확인하세요. 자동 재전송하거나 새 요청 번호를 만들지
                않습니다.
              </span>
            </Notice>
          )}
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <TextField
              select
              label="선택할 자료 유형"
              value={kind}
              disabled={!!pending}
              className="w-full sm:max-w-xs"
              onChange={event => {
                if (pending) return;
                invalidate();
                setPage(null);
                setKind(event.target.value as HandoverKind);
              }}
            >
              <option value="source">소스</option>
              <option value="dashboard">대시보드</option>
            </TextField>
            <Button variant="outline" disabled={busy || !!pending} onClick={() => loadCandidates()}>
              본인 후보 불러오기
            </Button>
            <Button variant="ghost" disabled={busy || !!pending || !page?.nextAfterId} onClick={() => loadCandidates(true)}>
              다음 20개
            </Button>
          </div>
          {page && (
            <ul className="flex min-w-0 flex-col gap-2">
              {page.entries.map(item => (
                <li key={assetKey(item)} className="min-w-0">
                  <label className="flex min-h-9 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0"
                      checked={selected.some(entry => assetKey(entry) === assetKey(item))}
                      disabled={
                        !!pending || (selected.length >= 20 && !selected.some(entry => assetKey(entry) === assetKey(item)))
                      }
                      onChange={event => {
                        if (pending) return;
                        invalidate();
                        setSelected(current =>
                          event.target.checked
                            ? [...current, item]
                            : current.filter(entry => assetKey(entry) !== assetKey(item)),
                        );
                      }}
                    />
                    <span className="wrap-anywhere">
                      {kindLabel(item.kind)} #{item.id} · {item.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {page?.entries.length === 0 && <p className="text-xs">조회된 본인 후보가 없습니다.</p>}
          <p className="text-xs">선택 {selected.length}/20개</p>
          {selected.length > 0 && (
            <ul aria-label="공개할 제목과 번호" className="flex min-w-0 flex-col gap-1">
              {selected.map(item => (
                <li key={assetKey(item)} className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="min-w-0 wrap-anywhere">
                    {kindLabel(item.kind)} #{item.id} · {item.title}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!pending}
                    aria-label={`선택 해제 ${assetKey(item)}`}
                    onClick={() => {
                      invalidate();
                      setSelected(current => current.filter(entry => assetKey(entry) !== assetKey(item)));
                    }}
                  >
                    제외
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <TextField
            label="수신자 직원 번호"
            inputMode="numeric"
            aria-describedby={hintId}
            value={recipient}
            disabled={!!pending}
            onChange={event => {
              invalidate();
              setRecipient(event.target.value);
            }}
            className="w-full sm:max-w-xs"
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            같은 조직의 다른 활성 직원이 알려 준 내부 숫자 번호를 직접 입력하세요.
          </p>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 shrink-0"
              checked={consent}
              disabled={busy || (!!pending && !(pending.type === 'create' && pending.canRetry))}
              onChange={event => setConsent(event.target.checked)}
            />
            선택 목록의 정확한 제목·번호를 직원 #{recipient || '(미입력)'}에게 공개하는 데 동의합니다.
          </label>
          <Button className="self-start" disabled={!canSave} onClick={save}>
            {pending?.type === 'create'
              ? '같은 요청 번호로 요청 저장 재시도'
              : rejected
              ? '수정한 초안으로 새 요청 저장'
              : '인계 의향 요청 저장'}
          </Button>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <TextField
              label="조회할 요청 번호"
              value={requestId}
              disabled={!!pending}
              onChange={event => {
                if (pending) return;
                invalidate();
                setRequestId(event.target.value);
              }}
              className="w-full sm:max-w-lg"
            />
            <Button
              variant="outline"
              disabled={busy || !isHandoverId(pendingId || requestId.trim())}
              onClick={() => reviewRequest(pendingId || requestId.trim())}
            >
              {pending ? '같은 요청 번호 상태 확인' : '요청 상태·고정 목록 검토'}
            </Button>
          </div>
          {requestId && (
            <p className="wrap-anywhere text-xs">
              {review?.requestId === requestId
                ? review.ownerId === membership.userId
                  ? `요청 번호 ${requestId} · 수신자에게 기존 채널로 직접 전달하세요.`
                  : `요청 번호 ${requestId} · 같은 번호로 현재 기록을 다시 확인할 수 있습니다.`
                : `저장 여부를 확인할 요청 번호 ${requestId} · 수신자에게 전달하기 전 현재 기록을 확인하세요.`}
            </p>
          )}
          {review && (
            <div className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/40 p-3">
              <p role="status" className="wrap-anywhere text-sm">
                {statusLabel(review.status)} · 조직 #{review.organizationId} · 소유자 #{review.ownerId} → 수신자 #
                {review.recipientId} · 버전 {review.version} ·{' '}
                {review.expired ? '만료됨' : `만료 ${new Date(review.expiresAt).toLocaleString()}`}
              </p>
              {review.acceptedAt && <p className="text-xs">과거 수락 시각 {new Date(review.acceptedAt).toLocaleString()}</p>}
              {!review.detailsAvailable && (
                <p role="status" className="text-sm">
                  자료 공개가 종료되어 제목·번호를 표시하지 않습니다. 현재 상태 영수증만 확인할 수 있습니다.
                </p>
              )}
              <ul aria-label="검토한 고정 자료" className="min-w-0 text-sm">
                {review.assets.map(item => (
                  <li className="wrap-anywhere" key={assetKey(item)}>
                    {kindLabel(item.kind)} #{item.id} · {item.title}
                  </li>
                ))}
              </ul>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={decisionConsent}
                  disabled={busy || !!pending || !reviewLoaded}
                  onChange={event => setDecisionConsent(event.target.checked)}
                />
                위 고정 목록·관계·버전을 검토했습니다. 의향만 기록하며 실제 이전·열람권 부여가 아님을 확인합니다.
              </label>
              <div className="flex flex-wrap gap-2">
                {review.recipientId === membership.userId && review.detailsAvailable && (
                  <Button
                    disabled={
                      busy ||
                      !!pending ||
                      !reviewLoaded ||
                      !decisionConsent ||
                      !review.detailsAvailable ||
                      review.expired ||
                      review.status !== 'pending'
                    }
                    onClick={() => decide('accept')}
                  >
                    인계 의향 수락
                  </Button>
                )}
                {review.ownerId === membership.userId && (
                  <Button
                    variant="outline"
                    disabled={busy || !!pending || !reviewLoaded || !decisionConsent || review.status === 'cancelled'}
                    onClick={() => decide('cancel')}
                  >
                    인계 의향 철회
                  </Button>
                )}
              </div>
            </div>
          )}
          {notice && (
            <p role="status" className="wrap-anywhere text-sm">
              {notice}
            </p>
          )}
          {error && <Notice severity="error">{error}</Notice>}
        </div>
      )}
    </section>
  );
}
