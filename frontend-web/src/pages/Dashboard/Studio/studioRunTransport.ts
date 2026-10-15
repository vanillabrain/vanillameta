import type { ChatTransport } from 'ai';
import { post } from '@/helpers/apiHelper';
import { AssistantMessage, assistantResultStream, messageText } from '../assistantTransport';
import { validateStudioPreview, StudioPreview, StudioApiError, toStudioApiError, studioRequestId } from './studioApi';
import { studioAssert, studioKeys } from './studioDocument';
import { applyStudioOperation } from './studioReducer';
import { StudioDocumentV1, StudioOperation } from './studioTypes';
export type StudioRunContext = {
  dashboardId: number;
  document: StudioDocumentV1;
  expectedRevision: string;
  expectedSourceRevision: string;
  clientEditVersion: number;
  selectedBlockId?: string;
};
export type StudioRunResult = {
  runId: string;
  baseRevision: string;
  sourceRevision: string;
  clientEditVersion: number;
  selectedBlockId: string | null;
  intent: 'ask' | 'edit' | 'clarify' | 'unsupported';
  answer: string;
  proposedOperations: StudioOperation[];
  preview: StudioPreview;
  steps: Array<{ name: string; status: string }>;
};
export const canApplyStudioRun = (result: StudioRunResult, context: StudioRunContext) =>
  result.baseRevision === context.expectedRevision &&
  result.sourceRevision === context.expectedSourceRevision &&
  result.clientEditVersion === context.clientEditVersion &&
  result.selectedBlockId === (context.selectedBlockId ?? null);
export function validateStudioRun(input: unknown, context: StudioRunContext): StudioRunResult {
  const result = input as StudioRunResult;
  studioAssert(
    !!result &&
      typeof result === 'object' &&
      typeof result.runId === 'string' &&
      typeof result.answer === 'string' &&
      result.answer.length <= 4000 &&
      !!result.answer.trim() &&
      ['ask', 'edit', 'clarify', 'unsupported'].includes(result.intent),
    'AI 응답을 확인하지 못했습니다.',
  );
  studioAssert(canApplyStudioRun(result, context), 'AI 응답의 기준 문서가 요청과 다릅니다.');
  studioAssert(
    Array.isArray(result.proposedOperations) && result.proposedOperations.length <= 1,
    'AI 변경 수를 확인해 주세요.',
  );
  studioAssert(
    result.intent === 'edit' ? result.proposedOperations.length === 1 : result.proposedOperations.length === 0,
    'AI 변경 의도가 일치하지 않습니다.',
  );
  let document = context.document;
  for (const operation of result.proposedOperations) {
    studioAssert(
      operation.type === 'updateBlock' && operation.blockId === context.selectedBlockId,
      '선택한 블록만 수정할 수 있습니다.',
    );
    studioKeys(operation.patch, ['title', 'description', 'display']);
    document = applyStudioOperation(document, operation);
  }
  studioAssert(
    Array.isArray(result.steps) &&
      result.steps.length <= 10 &&
      result.steps.every(s => typeof s.name === 'string' && s.name.length <= 100 && s.status === 'succeeded'),
    'AI 검증 단계가 완료되지 않았습니다.',
  );
  result.preview = validateStudioPreview(result.preview);
  studioAssert(
    result.preview.draft.databaseId === context.document.sourceId &&
      result.preview.widgets.length === context.document.blocks.length,
    'AI 미리보기의 데이터 소스 또는 블록 수가 다릅니다.',
  );
  return result;
}
export function studioAssistantTransport(context: () => StudioRunContext): ChatTransport<AssistantMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const current = context();
      const prompt = messageText(messages[messages.length - 1]);
      const body = { ...current, requestId: studioRequestId(), prompt };
      let response: any;
      try {
        response = await post('/studio/runs', body, { timeout: 180000, signal: abortSignal });
      } catch (error) {
        throw toStudioApiError(error);
      }
      if (abortSignal?.aborted) throw new Error('AI 요청을 취소했습니다.');
      let result: StudioRunResult;
      try {
        result = validateStudioRun(response.data, current);
      } catch {
        throw new StudioApiError(
          'AI 변경안을 검증하지 못했습니다. 기존 내용을 유지했습니다. 다시 요청해 주세요.',
          'invalid',
        );
      }
      return assistantResultStream({ ...result, mode: 'studio' });
    },
    async reconnectToStream() {
      return null;
    },
  };
}
