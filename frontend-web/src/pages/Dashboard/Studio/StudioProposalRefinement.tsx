import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { CreationClarification, CreationProposal, creationError, proposeStudio } from './studioCreation';

/** Refines a server-owned immutable proposal; only its explicit save may write metadata. */
export default function StudioProposalRefinement({
  proposal,
  disabled,
  onProposal,
  onBusy,
}: {
  proposal: CreationProposal;
  disabled: boolean;
  onProposal: (value: CreationProposal) => void;
  onBusy: (value: boolean) => void;
}) {
  const [target, setTarget] = useState('0'),
    [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [questions, setQuestions] = useState<CreationClarification[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const active = useRef<AbortController | null>(null);
  const cancel = () => {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    onBusy(false);
    setNotice('수정을 취소했습니다. 이전 미리보기와 입력은 유지됩니다.');
  };
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  const refine = async () => {
    if (active.current || disabled || !prompt.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await proposeStudio(
        {
          sourceId: proposal.sourceId,
          prompt: prompt.trim(),
          parentProposalId: proposal.proposalId,
          targetBlockIndex: target === 'append' ? 'append' : Number(target),
          expectedSourceRevision: proposal.sourceRevision,
          ...(Object.keys(answers).length ? { clarificationAnswers: answers } : {}),
        },
        controller.signal,
      );
      if (active.current !== controller || controller.signal.aborted) return;
      if (next.parentProposalId !== proposal.proposalId) throw new Error('mismatched proposal');
      if (next.clarifications?.length) {
        setQuestions(next.clarifications);
        return;
      }
      onProposal(next);
      setQuestions([]);
      setAnswers({});
      setNotice('수정된 전체 미리보기입니다. 확인 후 비공개로 저장해 주세요.');
    } catch (cause) {
      if (active.current === controller && !controller.signal.aborted)
        setError(
          Number((cause as any)?.response?.status) === 400
            ? '생성안이 만료되었거나 변경 내용을 확인하지 못했습니다. 요청을 구체적으로 적거나 위에서 새로 제안해 주세요. 이전 미리보기는 유지됩니다.'
            : creationError(cause),
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
        onBusy(false);
      }
    }
  };
  return (
    <section className="studio-create-clarify studio-proposal-refinement" aria-labelledby="studio-refine-heading">
      <span className="studio-eyebrow">후속 질문 · 저장 전 편집</span>
      <h2 id="studio-refine-heading">이 제안을 어떻게 바꿀까요?</h2>
      <p>선택한 블록만 수정하거나 새 블록을 추가합니다. 다른 블록과 대시보드 제목은 유지합니다.</p>
      <TextField
        select
        label="수정할 블록"
        value={target}
        disabled={disabled || busy}
        onChange={event => {
          setTarget(event.target.value);
          setQuestions([]);
          setAnswers({});
          setError('');
          setNotice('');
        }}
      >
        {proposal.semanticProposal.map((block, index) => (
          <option key={index} value={String(index)}>
            {index + 1}. {block.title}
          </option>
        ))}
        {proposal.semanticProposal.length < 6 && <option value="append">새 블록 추가</option>}
      </TextField>
      <TextField
        label="생성안 수정 요청"
        multiline
        minRows={3}
        value={prompt}
        disabled={disabled || busy}
        onChange={event => {
          setPrompt(event.target.value);
          setQuestions([]);
          setAnswers({});
          setError('');
          setNotice('');
        }}
        inputProps={{ maxLength: 2000 }}
        placeholder="예: 선택한 차트를 브라우저별 요청 수로 바꿔 줘"
      />
      {questions.map(q => (
        <div key={q.id}>
          <Notice severity="warning">{q.question}</Notice>
          {!!q.choices.length && (
            <TextField
              select
              label="수정 전 기준 확인"
              value={answers[q.id] ?? ''}
              disabled={disabled || busy}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
            >
              <option value="">기준을 선택하세요</option>
              {q.choices.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </TextField>
          )}
        </div>
      ))}
      {error && <Notice severity="error">{error}</Notice>}
      {notice && <p role="status">{notice}</p>}
      <div className="studio-create-request-actions">
        <span>{busy ? 'AI가 수정 내용을 계산하고 있습니다…' : 'Codex · gpt-6-luna · 전체 결과 재계산'}</span>
        {busy ? (
          <Button variant="outline" onClick={cancel}>
            수정 중지
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={refine}
            disabled={disabled || !prompt.trim() || questions.some(q => q.choices.length > 0 && !answers[q.id])}
          >
            수정안 미리보기
          </Button>
        )}
      </div>
    </section>
  );
}
