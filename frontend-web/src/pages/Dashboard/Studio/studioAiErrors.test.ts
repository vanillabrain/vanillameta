import { describe, expect, it } from 'vitest';
import { AI_BLOCK_MESSAGES, aiBlockMessage, executionSummary, retryStep, validateExecution } from './studioExecution';
import { creationError } from './studioCreation';

const blockedRun = (errorCode: string, retryable = false) =>
  validateExecution(
    {
      runId: 'run-1',
      requestId: 'request-1',
      dashboardId: 8,
      status: 'failed',
      steps: [
        { stepId: 'inspectSource', status: 'succeeded', retryable: false },
        { stepId: 'proposeSemantics', status: 'failed', retryable, errorCode },
      ],
    },
    8,
  );

describe('a run the AI refused', () => {
  it.each(['AI_QUOTA_EXCEEDED', 'AI_BUDGET_EXHAUSTED', 'AI_NOT_CONFIGURED', 'AI_INPUT_TOO_LARGE'])(
    '%s says why, that nothing was saved, and that retrying the step is not offered',
    code => {
      const run = blockedRun(code);
      expect(executionSummary(run)).toBe(AI_BLOCK_MESSAGES[code]);
      expect(aiBlockMessage(run)).toBe(AI_BLOCK_MESSAGES[code]);
      expect(retryStep(run)).toBeUndefined();
    },
  );

  it('keeps the generic failure text for a model step that simply failed, and offers the retry', () => {
    const run = blockedRun('MODEL_FAILED', true);
    expect(aiBlockMessage(run)).toBeUndefined();
    expect(executionSummary(run)).toContain('실패 단계부터 다시 시도');
    expect(retryStep(run)?.stepId).toBe('proposeSemantics');
  });

  it('does not let a refusal hide a saved result', () => {
    const run = validateExecution(
      {
        runId: 'run-2',
        requestId: 'request-2',
        dashboardId: 8,
        status: 'partial',
        steps: [
          { stepId: 'saveDraft', status: 'succeeded', retryable: false },
          { stepId: 'publish', status: 'failed', retryable: false, errorCode: 'AI_QUOTA_EXCEEDED' },
        ],
      },
      8,
    );
    expect(executionSummary(run)).toContain('저장 완료');
  });
});

describe('creation errors from the AI', () => {
  const body = (status: number, error: string, message: string) => ({
    response: { status, data: { success: false, code: status, data: { error, message } } },
  });

  it('shows the server’s own sentence for a quota, budget or setup refusal', () => {
    expect(creationError(body(429, 'AI_QUOTA_EXCEEDED', '오늘의 AI 호출을 모두 썼습니다.'))).toBe(
      '오늘의 AI 호출을 모두 썼습니다.',
    );
    expect(creationError(body(503, 'AI_BUDGET_EXHAUSTED', '이번 달 예산을 모두 썼습니다.'))).toBe(
      '이번 달 예산을 모두 썼습니다.',
    );
    expect(creationError(body(503, 'AI_NOT_CONFIGURED', 'AI 기능이 설정되지 않았습니다.'))).toBe(
      'AI 기능이 설정되지 않았습니다.',
    );
    expect(creationError(body(400, 'AI_INPUT_TOO_LARGE', '내용이 너무 큽니다.'))).toBe('내용이 너무 큽니다.');
  });

  it('ignores a refusal message that is empty or too long and falls back to a fixed sentence', () => {
    expect(creationError(body(429, 'AI_QUOTA_EXCEEDED', ''))).toBe(AI_BLOCK_MESSAGES.AI_QUOTA_EXCEEDED);
    expect(creationError(body(429, 'AI_QUOTA_EXCEEDED', 'x'.repeat(400)))).toBe(AI_BLOCK_MESSAGES.AI_QUOTA_EXCEEDED);
    expect(creationError(body(503, 'AI_NOT_CONFIGURED', undefined as any))).toBe(AI_BLOCK_MESSAGES.AI_NOT_CONFIGURED);
  });

  it.each([502, 503, 504])('treats a %s as an AI connection problem and keeps the input', status => {
    const message = creationError({ response: { status } });
    expect(message).toContain('AI 연결');
    expect(message).toContain('기존 입력을 유지');
  });

  it('does not take another error code for an AI refusal', () => {
    expect(creationError(body(429, 'SOMETHING_ELSE', 'private detail'))).not.toContain('private detail');
  });
});
