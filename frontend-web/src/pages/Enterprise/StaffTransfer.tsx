import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { EnterpriseApiError, EnterpriseContext, enterpriseError, isEnrollmentCode } from '@/api/enterpriseService';
import {
  StaffTransferReview,
  reviewStaffTransfer,
  StaffTransferStatus,
  StaffTransferCode,
  StaffTransferAcceptance,
  fetchStaffTransfer,
  createStaffTransfer,
  revokeStaffTransfer,
  acceptStaffTransfer,
  completeStaffTransfer,
} from '@/api/staffTransferService';

type Props = { context: EnterpriseContext; onReload: (notice?: string) => void };
const positiveId = (s: string) => /^[1-9]\d*$/.test(s) && Number.isSafeInteger(Number(s));
export default function StaffTransfer({ context, onReload }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StaffTransferStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [issued, setIssued] = useState<StaffTransferCode | null>(null);
  const [receipt, setReceipt] = useState<StaffTransferAcceptance | null>(null);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [team, setTeam] = useState('');
  const [review, setReview] = useState<StaffTransferReview | null>(null);
  const [ack, setAck] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const gate = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const organization = context.organization;
  const admin = context.membership?.role === 'admin';
  const run = async (action: () => Promise<void>, mutation = false) => {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setAck('');
    try {
      await action();
    } catch (cause) {
      if (mounted.current) {
        const failure = enterpriseError(cause);
        setError(failure.message);
        if (mutation) {
          setUncertain(true);
          setUnknownOutcome(failure.kind === 'network' || failure.status === null || failure.status >= 500);
          setReview(null);
          setIssued(null);
        }
      }
    } finally {
      gate.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const load = () =>
    run(async () => {
      setLoaded(false);
      const next = await fetchStaffTransfer();
      if (!mounted.current) return;
      setStatus(next);
      setLoaded(true);
    });
  const confirm = (action: string, label: string) => (
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 shrink-0"
        checked={ack === action}
        disabled={busy || uncertain || completed}
        onChange={event => setAck(event.target.checked ? action : '')}
      />
      {label}
    </label>
  );
  const change = (setter: (s: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    setAck('');
    setReceipt(null);
  };
  const disabled = busy || uncertain || completed || !loaded;
  if (!organization || !context.membership) return null;
  return (
    <section className="mt-4 min-w-0 rounded-lg border border-border p-3">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !loaded) void load();
        }}
      >
        조직 이동 {open ? '접기' : '열기'}
      </Button>
      {open && (
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            본인 동의 → 대상 조직 admin 수락 → 현재 조직의 다른 admin 최종 이동 순서입니다. 코드는 15분 동안 유효합니다.
            수락만으로 소속이나 권한이 바뀌지 않으며 이동 역할은 member로 고정됩니다.
          </p>
          <p className="text-xs text-muted-foreground">
            이동해도 개인 소유 자료·원본 파일·분석·게시·독립 사본·과거 기록은 보존됩니다. 대상 조직에 자동 공개하거나 이전
            조직의 업무를 자동 이관하지 않습니다. 최종 이동 시 기존 로그인 토큰과 조직 공유·권한·그룹 가입은 회수되며 다시
            로그인해야 합니다. 같은 팀명도 그룹 자동 가입을 뜻하지 않습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void load()}>
              내 이동 상태 다시 불러오기
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => onReload()}>
              조직·버전 다시 불러오기
            </Button>
          </div>
          {loaded && (
            <p role="status" className="wrap-anywhere text-sm">
              {status
                ? `내 이동: 조직 #${status.sourceOrganizationId} → #${status.targetOrganizationId} · ${
                    status.status === 'completed' ? '이동 완료' : status.accepted ? '대상 조직 수락 완료' : '수락 대기'
                  } · 팀 ${status.team || '미지정'} · 만료 ${new Date(status.expiresAt).toLocaleString()}`
                : '현재 확인된 내 이동 요청이 없습니다.'}
            </p>
          )}
          {uncertain && (
            <Notice severity="warning">
              {unknownOutcome
                ? '처리 결과가 확정되지 않았습니다. 본인은 내 이동 상태를 확인하고, 관리자는 해당 직원에게 현재 소속·수락 상태를 확인하세요.'
                : '변경 요청이 거절되어 이동하지 않았습니다. 최신 조직·수락 내용을 다시 확인하세요.'}{' '}
              조직·버전을 다시 불러온 뒤 새로 확인해야 하며 자동 재전송하지 않습니다.
            </Notice>
          )}
          <div className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/40 p-3">
            <h3 className="text-sm font-semibold">1. 본인 이동 동의</h3>
            <TextField
              label="이동할 조직 번호"
              value={target}
              inputMode="numeric"
              disabled={disabled}
              onChange={change(setTarget)}
              className="w-full max-w-xs"
            />
            {confirm(
              'issue',
              `조직 #${target || '(미입력)'}로 member 이동에 동의하며 새 코드 발급 시 이전 동의가 무효가 됨을 확인했습니다.`,
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled || ack !== 'issue' || !positiveId(target) || Number(target) === organization.id}
                onClick={() =>
                  void run(async () => {
                    const next = await createStaffTransfer(Number(target));
                    if (!mounted.current) return;
                    setIssued(next);
                    setLoaded(false);
                    setStatus(null);
                    setNotice('본인 동의 코드를 발급했습니다. 대상 조직과 현재 조직의 admin에게만 전달하세요.');
                  }, true)
                }
              >
                이동 동의 코드 발급
              </Button>
            </div>
            {issued && (
              <div className="min-w-0">
                <TextField
                  label="발급된 이동 코드"
                  readOnly
                  value={issued.code}
                  onFocus={event => event.currentTarget.select()}
                  className="w-full"
                />
                <p className="wrap-anywhere text-xs">
                  조직 #{issued.sourceOrganizationId} → #{issued.targetOrganizationId} · 만료{' '}
                  {new Date(issued.expiresAt).toLocaleString()} · 화면을 떠나면 코드를 복구할 수 없습니다. 브라우저에 영속
                  저장하지 않습니다.
                </p>
              </div>
            )}
            {confirm('revoke', '본인의 현재 이동 동의를 철회합니다.')}
            <Button
              variant="outline"
              className="self-start"
              disabled={
                busy ||
                uncertain ||
                completed ||
                ack !== 'revoke' ||
                (!issued && (!loaded || !status || status.status === 'completed'))
              }
              onClick={() =>
                void run(async () => {
                  await revokeStaffTransfer();
                  if (!mounted.current) return;
                  setIssued(null);
                  setStatus(null);
                  setLoaded(true);
                  setNotice('이동 동의를 철회했습니다.');
                }, true)
              }
            >
              이동 동의 철회
            </Button>
          </div>
          {admin && (
            <div className="flex min-w-0 flex-col gap-3 rounded-md bg-muted/40 p-3">
              <h3 className="text-sm font-semibold">2·3. 조직 admin 확인</h3>
              <p className="text-xs">
                현재 조직 #{organization.id} · 버전 {organization.version}. 직원 본인의 코드만 입력하세요. 최종 이동은 대상
                조직 수락 후 현재 조직의 다른 admin이 진행합니다.
              </p>
              <TextField
                label="직원이 전달한 이동 코드"
                value={code}
                maxLength={64}
                autoComplete="off"
                disabled={disabled}
                onChange={event => {
                  setCode(event.target.value);
                  setReview(null);
                  setAck('');
                  setReceipt(null);
                }}
                className="w-full max-w-lg"
              />
              <Button
                variant="outline"
                className="self-start"
                disabled={disabled || !isEnrollmentCode(code.trim())}
                onClick={() =>
                  void run(async () => {
                    setReview(null);
                    const next = await reviewStaffTransfer(code.trim());
                    if (!mounted.current) return;
                    if (next.sourceOrganizationId !== organization.id && next.targetOrganizationId !== organization.id)
                      throw new EnterpriseApiError('현재 조직의 이동 요청이 아닙니다.', 'forbidden');
                    setReview(next);
                    setTeam(next.team);
                  })
                }
              >
                이동 요청 검토
              </Button>
              {review && (
                <div role="status" className="wrap-anywhere text-sm">
                  <p>
                    검토한 직원 #{review.userId}: 이전 조직 #{review.sourceOrganizationId} (버전 {review.sourceVersion}) →
                    대상 조직 #{review.targetOrganizationId} (버전 {review.targetVersion})
                  </p>
                  <p>
                    수락 팀 {review.team || '미지정'} · member · {review.accepted ? '수락 완료' : '수락 대기'} · 만료{' '}
                    {new Date(review.expiresAt).toLocaleString()}
                  </p>
                  <p>
                    개인 소유 자료·파일·게시 snapshot은 보존됩니다. 기존 조직 권한·공유·그룹 가입과 로그인 토큰은 회수됩니다.
                    새 조직에 자동 권한을 주지 않습니다. 대시보드·게시의 이용 가능 여부는 현재 소스 조회·게시 권한에 따르며,
                    기록 보존이 계속 조회할 수 있음을 보장하지 않습니다. 대상 조직 버전이나 수락 관리자·팀이 검토 후 바뀌면
                    최종 이동이 거절됩니다. 대상 admin의 수락 상태를 다시 검토해야 합니다.
                  </p>
                </div>
              )}
              <TextField
                label="대상 조직 수락 팀"
                value={team}
                maxLength={100}
                disabled={disabled || !review || review.targetOrganizationId !== organization.id}
                onChange={change(setTeam)}
                className="w-full max-w-xs"
              />
              {confirm(
                'accept',
                `현재 조직 #${organization.id}에서 팀 ${
                  team.trim() || '미지정'
                } · member로 수락합니다. 아직 이동은 실행되지 않습니다.`,
              )}
              <Button
                className="self-start"
                disabled={disabled || ack !== 'accept' || !review || review.targetOrganizationId !== organization.id}
                onClick={() =>
                  void run(async () => {
                    const next = await acceptStaffTransfer({
                      code: code.trim(),
                      team: team.trim(),
                      expectedVersion: review.targetVersion,
                    });
                    if (!mounted.current) return;
                    setReceipt(next);
                    setReview(null);
                    setNotice('대상 조직에서 수락했습니다. 현재 조직 admin의 최종 이동이 필요합니다.');
                  }, true)
                }
              >
                대상 조직으로 수락
              </Button>
              {receipt && (
                <p role="status" className="wrap-anywhere text-sm">
                  수락 확인: 조직 #{receipt.sourceOrganizationId} → #{receipt.targetOrganizationId} · 팀{' '}
                  {receipt.team || '미지정'} · member · 만료 {new Date(receipt.expiresAt).toLocaleString()}
                </p>
              )}
              {confirm(
                'complete',
                '대상 조직의 수락과 최신 버전을 확인했습니다. 현재 조직에서 최종 이동하고 기존 토큰·조직 권한·그룹 가입을 회수합니다.',
              )}
              <Button
                className="self-start"
                disabled={
                  disabled ||
                  ack !== 'complete' ||
                  !review ||
                  !review.accepted ||
                  review.sourceOrganizationId !== organization.id ||
                  review.userId === context.membership.userId
                }
                onClick={() =>
                  void run(async () => {
                    const result = await completeStaffTransfer({
                      code: code.trim(),
                      expectedVersion: review.sourceVersion,
                      targetExpectedVersion: review.targetVersion,
                      reviewBasis: review.reviewBasis,
                    });
                    if (!mounted.current) return;
                    setCode('');
                    setReceipt(null);
                    setCompleted(true);
                    const message = `직원 #${result.userId}의 조직 #${result.sourceOrganizationId} → #${result.targetOrganizationId} 이동을 완료했습니다. 해당 직원은 다시 로그인해야 합니다.`;
                    setReview(null);
                    setNotice(message);
                    onReload(message);
                  }, true)
                }
              >
                현재 조직에서 최종 이동
              </Button>
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
