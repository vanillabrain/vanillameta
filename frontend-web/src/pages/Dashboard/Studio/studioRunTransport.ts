import type { ChatTransport } from 'ai';
import { post } from '@/helpers/apiHelper';
import { trackAiCall } from '@/api/usageService';
import { postNdjson } from '@/api/ndjsonClient';
import { AssistantMessage, assistantResultStream, messageText } from '../assistantTransport';
import { validateStudioPreview, StudioPreview, StudioApiError, toStudioApiError, studioRequestId } from './studioApi';
import { studioAssert, studioKeys, studioConditionsKey, validateStudioConditions } from './studioDocument';
import { applyStudioOperation } from './studioReducer';
import { StudioDocumentV1, StudioOperation } from './studioTypes';
import {
  validateExecution,
  executionSummary,
  StudioExecution,
  ExecutionRequest,
  ExecutionProgress,
} from './studioExecution';
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
    if (operation.type === 'setConditions') {
      studioKeys(operation, ['type', 'conditions']);
      studioAssert(Object.prototype.hasOwnProperty.call(operation, 'conditions'), '조건 변경안이 누락됐습니다.');
      const conditions = operation.conditions === null ? undefined : validateStudioConditions(operation.conditions);
      studioAssert(
        !conditions || conditions.sourceRevision === context.expectedSourceRevision,
        '조건 파일 버전이 다릅니다.',
      );
      if (conditions && context.document.conditions) {
        const semanticKey = (value: typeof conditions) =>
          studioConditionsKey({ ...value, definition: { include: null, exclude: null } });
        studioAssert(
          semanticKey(conditions) === semanticKey(context.document.conditions),
          'AI 조건의 업무 의미가 현재 검토 기준과 다릅니다. 최신 업무 의미는 명시적으로 채택하세요.',
        );
      }
      studioAssert(
        studioConditionsKey(conditions) !== studioConditionsKey(context.document.conditions),
        '조건 변경이 없습니다.',
      );
    } else {
      studioAssert(
        operation.type === 'updateBlock' && operation.blockId === context.selectedBlockId,
        '선택한 블록만 수정할 수 있습니다.',
      );
      studioKeys(operation.patch, ['title', 'description', 'display']);
      if (context.document.blocks.find(b => b.id === operation.blockId)?.kind === 'SEGMENT_PIVOT')
        studioKeys(operation.patch, ['title', 'description']);
    }
    document = applyStudioOperation(document, operation);
  }
  studioAssert(
    Array.isArray(result.steps) &&
      result.steps.length <= 10 &&
      result.steps.every(s => typeof s.name === 'string' && s.name.length <= 100 && s.status === 'succeeded'),
    'AI 검증 단계가 완료되지 않았습니다.',
  );
  result.preview = validateStudioPreview(result.preview, document, context.expectedSourceRevision);
  studioAssert(
    result.preview.draft.databaseId === context.document.sourceId &&
      result.preview.widgets.length === context.document.blocks.length,
    'AI 미리보기의 데이터 소스 또는 블록 수가 다릅니다.',
  );
  return result;
}
export function studioAssistantTransport(
  context: () => StudioRunContext,
  activity?: {
    onRequest: (request: ExecutionRequest) => void;
    onExecution: (run: StudioExecution) => void;
    /** A persisted step transition, while the server is still working (the request is streamed). */
    onProgress?: (progress: ExecutionProgress) => void;
    /** The request ended, however it ended: there is no stream left to wait for. */
    onSettled?: () => void;
  },
): ChatTransport<AssistantMessage> {
  return {
    async sendMessages({ messages, abortSignal }) {
      const current = context();
      const prompt = messageText(messages[messages.length - 1]);
      const body = { ...current, requestId: studioRequestId(), prompt };
      let response: any;
      try {
        activity?.onRequest(body);
        response = activity
          ? {
              // The server streams the run; its `result` is the body the plain request used to return.
              data: await trackAiCall(() =>
                postNdjson('/studio/executions', body, {
                  signal: abortSignal,
                  onEvent: event => {
                    if (event.type === 'step')
                      activity.onProgress?.({
                        requestId: body.requestId,
                        runId: event.runId,
                        status: event.status,
                        steps: event.steps,
                      });
                  },
                }),
              ),
            }
          : await trackAiCall(() => post('/studio/runs', body, { timeout: 180000, signal: abortSignal }));
      } catch (error) {
        throw toStudioApiError(error);
      } finally {
        activity?.onSettled?.();
      }
      if (abortSignal?.aborted) throw new Error('AI 요청을 취소했습니다.');
      if (activity) {
        try {
          const run = validateExecution(response.data, current.dashboardId);
          studioAssert(
            !run.saveResult || run.saveResult.document.sourceId === current.document.sourceId,
            '저장 결과의 데이터 소스가 요청과 다릅니다.',
          );
          studioAssert(
            !run.creationResult || run.creationResult.sourceId === current.document.sourceId,
            '신규 생성 결과의 소스가 요청과 다릅니다.',
          );
          const result =
            run.result && !run.saveResult && !run.publicationResult ? validateStudioRun(run.result, current) : undefined;
          activity.onExecution(run);
          return assistantResultStream({
            mode: 'studioExecution',
            execution: run,
            result,
            answer: result?.answer || executionSummary(run),
          });
        } catch {
          throw new StudioApiError('실행 결과를 검증하지 못했습니다. 실행 상태를 새로 확인해 주세요.', 'invalid');
        }
      }
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
