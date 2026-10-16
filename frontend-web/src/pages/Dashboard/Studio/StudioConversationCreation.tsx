import React, { useEffect, useRef, useState } from 'react';
import { Notice as Alert } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { CreationProposal } from './studioCreation';
import { StudioExecution, getExecutionCreation } from './studioExecution';
import StudioSemanticReview from './StudioSemanticReview';

/** A new dashboard never replaces the editor that initiated the conversation. */
export default function StudioConversationCreation({
  run,
  onSave,
  disabled,
}: {
  run: StudioExecution;
  onSave?: (run: StudioExecution) => Promise<void>;
  disabled: boolean;
}) {
  const [proposal, setProposal] = useState<CreationProposal | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const live = useRef(true);
  const receipt = useRef<HTMLDivElement>(null);
  const wasSaved = useRef(!!run.creationSaveResult);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (run.creationSaveResult && !wasSaved.current) receipt.current?.focus();
    wasSaved.current = !!run.creationSaveResult;
  }, [run.creationSaveResult]);
  useEffect(() => {
    if (run.creationSaveResult) return;
    let current = true;
    setLoading(true);
    setError('');
    getExecutionCreation(run)
      .then(value => {
        if (current) setProposal(value);
      })
      .catch(() => {
        if (current)
          setError(
            '생성안을 불러오지 못했습니다. 연결·권한을 확인하세요. 제안이 만료됐거나 서버가 재시작됐다면 새 생성 요청을 보내 주세요.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [run.runId, run.creationResult?.proposalId, !!run.creationSaveResult]);
  const save = async () => {
    if (pending.current || disabled || !proposal?.preview || proposal.clarifications?.length || !onSave) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(run);
    } catch (cause) {
      if (!live.current) return;
      const status = Number((cause as any)?.response?.status);
      const unknown = !status || status >= 500;
      setUncertain(unknown);
      if (status === 400) setProposal(null);
      setError(
        unknown
          ? '저장 완료 여부를 확인하지 못했습니다. 같은 생성 요청으로 재시도하면 기존 저장 결과를 확인합니다.'
          : status === 400
          ? '생성안이 만료되었거나 저장할 수 없습니다. 새 생성 요청을 보내 주세요.'
          : status === 403
          ? '이 데이터를 사용할 권한이 없습니다.'
          : '데이터 기준이 변경됐거나 요청을 확인하지 못했습니다. 새 생성 요청을 보내 주세요.',
      );
    } finally {
      pending.current = false;
      if (live.current) setSaving(false);
    }
  };
  if (run.creationSaveResult)
    return (
      <div className="studio-remix-receipt" role="status" tabIndex={-1} ref={receipt}>
        <strong>비공개 생성 완료</strong>
        <p>새 대시보드로 저장했습니다. 현재 편집은 유지됩니다.</p>
        <Button variant="outline" asChild>
          <a href={'/dashboard/' + run.creationSaveResult.dashboardId + '/studio'} target="_blank" rel="noopener noreferrer">
            새 비공개 대시보드 열기
          </a>
        </Button>
      </div>
    );
  return (
    <div className="studio-conversation-creation">
      <p className="studio-creation-scope">새 대시보드 · 현재 소스 · 전체 기간 · 필터 없음</p>
      <p>현재 대시보드의 기간·필터와 배치를 복사하지 않습니다. 저장 전에 아래 계산 결과를 확인하세요.</p>
      {loading && <p role="status">지표·차원과 미리보기를 불러오는 중입니다…</p>}
      {error && <Alert severity="error">{error}</Alert>}
      {proposal?.clarifications?.map(c => (
        <Alert severity="warning" key={c.id}>
          {c.question} {c.choices.map(choice => choice.label).join(' / ')}. 같은 질문을 이어서 확인할 수 있습니다.
        </Alert>
      ))}
      {!!proposal?.clarifications?.length && (
        <Button variant="outline" asChild disabled={disabled || loading}>
          <a
            href={'/studio/new?sourceId=' + proposal.sourceId + '&proposalId=' + encodeURIComponent(proposal.proposalId)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled || loading}
            onClick={e => {
              if (disabled || loading) e.preventDefault();
            }}
          >
            같은 질문의 계산 기준 확인
          </a>
        </Button>
      )}
      {proposal?.preview && (
        <>
          <p className="studio-execution-hint">{proposal.profile.rowCount}행 · 제안은 10분간 유지됩니다.</p>
          <StudioSemanticReview proposal={proposal} />
          <Button variant="outline" asChild disabled={disabled || saving || uncertain}>
            <a
              href={'/studio/new?sourceId=' + proposal.sourceId + '&proposalId=' + encodeURIComponent(proposal.proposalId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={disabled || saving || uncertain}
              onClick={e => {
                if (disabled || saving || uncertain) e.preventDefault();
              }}
            >
              이 생성안을 이어서 수정
            </a>
          </Button>
          <Button variant="default" disabled={disabled || saving || !onSave} onClick={save}>
            {saving ? '비공개 저장 확인 중…' : uncertain ? '같은 생성 요청으로 저장 확인' : '제안 확인 후 비공개 저장'}
          </Button>
        </>
      )}
    </div>
  );
}
