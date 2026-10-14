import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { post } from '@/helpers/apiHelper';
import { errorMessage, responseData, validDraft, validPreview } from './dashboardPreview';

export type AssistantMessage = UIMessage<{ result?: any }>;
export const messageText = (message: UIMessage) =>
  message.parts
    .filter(part => part.type === 'text')
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('\n');

/** Keep existing authenticated APIs and Codex's complete-response contract; no simulated token streaming. */
export function assistantTransport(context: () => any): ChatTransport<AssistantMessage> {
  return {
    async sendMessages({ messages, body, abortSignal }) {
      const current = context();
      const last = messages[messages.length - 1];
      const history = messages
        .slice(0, -1)
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role, text: messageText(m).slice(0, 2000) }));
      const mode = (body as { mode?: string })?.mode === 'edit' ? 'edit' : 'ask';
      const input = { ...current, history, prompt: messageText(last) };
      const config = { timeout: 180000, signal: abortSignal };
      try {
        let result: any;
        if (mode === 'edit') {
          const draft = responseData(await post('/ai/dashboard-draft', input, config));
          if (!validDraft(draft) || draft.databaseId !== current.databaseId)
            throw new Error('AI 초안을 검증하지 못했습니다.');
          const preview = responseData(
            await post(
              '/ai/dashboard-preview',
              {
                draft,
                dashboardId: current.dashboardId,
                filters: current.filters,
                ...(current.dateRange ? { dateRange: current.dateRange } : {}),
                includeTrends: true,
                trendGrain: current.trendGrain ?? 'auto',
                comparePrevious: current.comparePrevious ?? false,
              },
              config,
            ),
          );
          if (!validPreview(preview) || preview.draft.databaseId !== current.databaseId)
            throw new Error('미리보기를 검증하지 못했습니다.');
          result = {
            mode,
            preview,
            metricReferences: draft.metricReferences ?? [],
            base: JSON.stringify(current),
            answer: preview.draft.explanation || '변경 미리보기가 준비되었습니다.',
          };
        } else {
          result = { ...responseData(await post('/ai/dashboard-assistant', input, config)), mode };
          if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('AI 답변이 비어 있습니다.');
        }
        if (abortSignal?.aborted) throw new Error('요청이 중단되었습니다.');
        return new ReadableStream<UIMessageChunk>({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: crypto.randomUUID(), messageMetadata: { result } });
            controller.enqueue({ type: 'text-start', id: 'answer' });
            controller.enqueue({ type: 'text-delta', id: 'answer', delta: result.answer });
            controller.enqueue({ type: 'text-end', id: 'answer' });
            controller.enqueue({ type: 'finish', finishReason: 'stop' });
            controller.close();
          },
        });
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    async reconnectToStream() {
      return null;
    },
  };
}
