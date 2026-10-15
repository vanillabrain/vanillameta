import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Alert, Button, TextField } from '@mui/material';
import { AssistantMessage, messageText } from '../assistantTransport';
import { canApplyStudioRun, StudioRunContext, StudioRunResult, studioAssistantTransport } from './studioRunTransport';
type Props = {
  context: StudioRunContext;
  selectedTitle?: string;
  onApply: (result: StudioRunResult) => boolean;
  locked: boolean;
};
export default function StudioConversation({ context, selectedTitle, onApply, locked }: Props) {
  const current = useRef(context);
  current.current = context;
  const apply = useRef(onApply);
  apply.current = onApply;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const transport = useMemo(() => studioAssistantTransport(() => current.current), []);
  const { messages, sendMessage, status, error, clearError, stop } = useChat<AssistantMessage>({
    id: 'studio-' + context.dashboardId,
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      const result = message.metadata?.result as StudioRunResult | undefined;
      if (isAbort || isError || !result) return;
      if (result.intent !== 'edit') {
        setNotice('답변만 표시했습니다. 블록은 변경하지 않았습니다.');
        return;
      }
      if (lockedRef.current || !canApplyStudioRun(result, current.current)) {
        setNotice(
          '응답을 기다리는 동안 편집·선택·저장 기준이 바뀌었습니다. 변경을 적용하지 않았습니다. 현재 상태로 다시 요청해 주세요.',
        );
        return;
      }
      setNotice(
        apply.current(result)
          ? '선택 블록에 적용했습니다. 저장 전 초안이며 되돌리기로 취소할 수 있습니다.'
          : '변경을 적용하지 못했습니다. 기존 내용을 유지했습니다.',
      );
    },
  });
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  const selected = context.document.blocks.find(block => block.id === context.selectedBlockId);
  const grain = selected?.display.timeGrain;
  const busy = status === 'submitted' || status === 'streaming';
  return (
    <div className="studio-ai studio-live-ai">
      <div className="studio-ai-content">
        <h2>선택한 블록을 함께 다듬기</h2>
        <p>질문하거나 원하는 변경을 요청하세요. 계산과 배치는 유지하고 검증된 변경만 초안에 적용합니다.</p>
        <div className="studio-context-card">
          <span className="studio-eyebrow">현재 문맥</span>
          <strong>{selectedTitle || '선택한 블록 없음'}</strong>
          <span>전체 기간 · 필터 없음</span>
          {grain && grain !== 'auto' && (
            <span>{({ day: '일간', week: '주간', month: '월간' } as const)[grain]} 집계 · UTC</span>
          )}
          <span>Codex · gpt-6-luna 요청</span>
        </div>
        {!selectedTitle && <p>캔버스에서 블록을 먼저 선택하면 해당 블록만 수정할 수 있습니다.</p>}
        <div className="studio-ai-messages" aria-label="AI 대화" aria-live="polite">
          {messages.map(message => (
            <div className={'studio-ai-message studio-ai-' + message.role} key={message.id}>
              <span>{message.role === 'user' ? '나' : 'AI'}</span>
              <p>{messageText(message)}</p>
            </div>
          ))}
        </div>
        {busy && <p role="status">AI 응답과 변경 검증을 기다리는 중입니다…</p>}
        {notice && <Alert severity="info">{notice}</Alert>}
        {error && <Alert severity="error">{error.message}</Alert>}
      </div>
      <form
        className="studio-ai-composer"
        onSubmit={event => {
          event.preventDefault();
          if (!input.trim() || busy || locked) return;
          clearError();
          setNotice('');
          sendMessage({ text: input.trim() });
          setInput('');
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          label="AI에게 요청할 내용"
          placeholder="선택 차트를 주간으로 바꿔 줘"
          value={input}
          onChange={event => setInput(event.target.value)}
          inputProps={{ maxLength: 2000 }}
          InputLabelProps={{ shrink: true }}
          disabled={busy || locked}
        />
        <div>
          <span>변경은 초안에만 적용됩니다</span>
          {busy ? (
            <Button
              onClick={() => {
                stop();
                setNotice('AI 요청을 취소했습니다. 기존 편집 내용을 유지했습니다.');
              }}
            >
              중지
            </Button>
          ) : (
            <Button type="submit" variant="contained" disabled={!input.trim() || locked}>
              전송
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
