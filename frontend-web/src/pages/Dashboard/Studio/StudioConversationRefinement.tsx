import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';
import { CreationProposal } from './studioCreation';
import { CreationClarificationRequest, StudioExecution } from './studioExecution';
import { studioRequestId } from './studioApi';

/** UC035: a bound preview edit never applies operations to the initiating editor. */
export default function StudioConversationRefinement({
  run,
  proposal,
  disabled,
  onClarify,
  onLock,
}: {
  run: StudioExecution;
  proposal: CreationProposal;
  disabled: boolean;
  onClarify: (run: StudioExecution, request: CreationClarificationRequest, signal?: AbortSignal) => Promise<void>;
  onLock: (value: boolean) => void;
}) {
  const [target, setTarget] = useState('0'),
    [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState('');
  const request = useRef<CreationClarificationRequest | null>(null),
    controller = useRef<AbortController | null>(null),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      controller.current?.abort();
      onLock(false);
    };
  }, [onLock]);
  const refine = async () => {
    if (controller.current || disabled || !prompt.trim()) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    onLock(true);
    setError('');
    request.current ??= {
      requestId: studioRequestId(),
      proposalId: proposal.proposalId,
      expectedSourceRevision: proposal.sourceRevision,
      prompt: prompt.trim(),
      targetBlockIndex: target === 'append' ? ('append' as const) : Number(target),
    };
    try {
      await onClarify(run, request.current, active.signal);
      if (live.current) {
        setUncertain(false);
        onLock(false);
      }
    } catch (cause) {
      if (!live.current) return;
      const status = Number((cause as any)?.response?.status),
        unknown = !status || status >= 500;
      setUncertain(unknown);
      onLock(unknown);
      setError(
        unknown
          ? '수정 결과를 확인하지 못했습니다. 질문과 이전 미리보기를 유지했습니다. 같은 수정 요청으로 다시 확인해 주세요.'
          : status === 403
          ? '이 실행 또는 데이터에 접근할 수 없습니다. 이전 미리보기는 유지됩니다.'
          : '수정할 열·계산 기준 또는 생성안 만료를 확인해 주세요. 이전 미리보기와 질문은 유지됩니다.',
      );
    } finally {
      controller.current = null;
      if (live.current) setBusy(false);
    }
  };
  return (
    <details className="group rounded-lg border p-3">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
        <span>이 생성안 수정</span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 pt-3">
        <p className="studio-execution-hint">
          선택 블록만 수정하거나 새 블록을 추가합니다. 다른 블록과 대시보드 제목은 유지합니다.
        </p>
        <TextField
          select
          label="생성안 수정 대상"
          value={target}
          disabled={disabled || busy || uncertain}
          onChange={e => {
            setTarget(e.target.value);
            request.current = null;
            setError('');
          }}
        >
          {proposal.semanticProposal.map((block, index) => (
            <option key={index} value={index}>
              {index + 1}. {block.title}
            </option>
          ))}
          {proposal.semanticProposal.length < 6 && <option value="append">새 블록 추가</option>}
        </TextField>
        <TextField
          label="생성안에 다시 질문"
          value={prompt}
          multiline
          minRows={2}
          disabled={disabled || busy || uncertain}
          inputProps={{ maxLength: 2000 }}
          placeholder="예: 선택한 블록의 제목만 바꿔 줘"
          onChange={e => {
            setPrompt(e.target.value);
            request.current = null;
            setError('');
          }}
        />
        {error && <Notice severity="error">{error}</Notice>}
        <Button variant="outline" disabled={disabled || busy || !prompt.trim()} onClick={refine}>
          {busy ? '수정 내용을 계산하는 중…' : uncertain ? '같은 수정 요청으로 다시 확인' : '수정안 전체 미리보기'}
        </Button>
        {busy && (
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            수정 요청 중지
          </Button>
        )}
      </div>
    </details>
  );
}
