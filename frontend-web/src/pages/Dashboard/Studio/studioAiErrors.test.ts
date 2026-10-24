import { describe, expect, it } from 'vitest';
import { AI_BLOCK_MESSAGES, aiBlockMessage, executionSummary, retryStep, validateExecution } from './studioExecution';
import { creationError } from './studioCreation';
import { aiRefusalMessage, RATE_LIMITED_MESSAGE } from './studioAiMessages';
import { errorMessage } from '../dashboardPreview';

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
    expect(creationError(body(429, 'RATE_LIMITED', 'x'.repeat(400)))).toBe(RATE_LIMITED_MESSAGE);
    expect(creationError(body(503, 'AI_NOT_CONFIGURED', undefined as any))).toBe(AI_BLOCK_MESSAGES.AI_NOT_CONFIGURED);
  });

  it.each([502, 503, 504])('treats a %s as an AI connection problem and keeps the input', status => {
    const message = creationError({ response: { status } });
    expect(message).toContain('AI 연결');
    expect(message).toContain('기존 입력을 유지');
  });

  it('shows the request-limit sentence, not the file-format advice, when the generate click is throttled', () => {
    const message = creationError(body(429, 'RATE_LIMITED', '잠시 뒤에 다시 눌러 주세요.'));
    expect(message).toBe('잠시 뒤에 다시 눌러 주세요.');
    expect(message).not.toContain('파일 형식');
    expect(creationError({ response: { status: 429 } })).toBe(RATE_LIMITED_MESSAGE);
  });

  it('words a throttled upload and a bare 429 the same way, whatever the context', () => {
    expect(creationError({ response: { status: 429 } }, 'file')).toBe(RATE_LIMITED_MESSAGE);
    expect(creationError(body(429, 'RATE_LIMITED', undefined as any), 'file')).toBe(RATE_LIMITED_MESSAGE);
    expect(creationError({ response: { status: 429, data: 'Too Many Requests' } })).toBe(RATE_LIMITED_MESSAGE);
  });

  it('does not take another error code for an AI refusal', () => {
    expect(creationError(body(429, 'SOMETHING_ELSE', 'private detail'))).toBe(RATE_LIMITED_MESSAGE);
  });
});

describe('aiRefusalMessage', () => {
  const failure = (error: string, message?: string, status = 429) => ({
    response: {
      status,
      data: { success: false, code: status, data: { error, ...(message === undefined ? {} : { message }) } },
    },
  });

  it('uses the server’s sentence, or ours for the same code, for every refusal code', () => {
    for (const code of Object.keys(AI_BLOCK_MESSAGES)) {
      expect(aiRefusalMessage(failure(code, '서버 문구'))).toBe('서버 문구');
      expect(aiRefusalMessage(failure(code))).toBe(AI_BLOCK_MESSAGES[code]);
      expect(aiRefusalMessage(failure(code, 'x'.repeat(301)))).toBe(AI_BLOCK_MESSAGES[code]);
    }
  });

  it('also covers the gateway failures the server words itself', () => {
    expect(aiRefusalMessage(failure('LLM_TIMEOUT', 'AI 응답이 늦어 중단했습니다.', 504))).toBe(
      'AI 응답이 늦어 중단했습니다.',
    );
    expect(aiRefusalMessage(failure('LLM_UNAVAILABLE', undefined, 502))).toContain('AI 연결');
  });

  it('words the per-user request limit (429 RATE_LIMITED) too, with the server’s sentence or ours', () => {
    expect(aiRefusalMessage(failure('RATE_LIMITED', '서버가 쓴 문장'))).toBe('서버가 쓴 문장');
    expect(aiRefusalMessage(failure('RATE_LIMITED'))).toBe(RATE_LIMITED_MESSAGE);
    expect(aiRefusalMessage(failure('RATE_LIMITED', 'x'.repeat(400)))).toBe(RATE_LIMITED_MESSAGE);
  });

  it('reads a stream’s error event the same way, and ignores everything else', () => {
    const fromStream = {
      message: 'x',
      response: { status: 429, data: { success: false, code: 429, data: { error: 'AI_QUOTA_EXCEEDED', message: '한도' } } },
    };
    expect(aiRefusalMessage(fromStream)).toBe('한도');
    expect(aiRefusalMessage(failure('SOMETHING_ELSE', '다른 오류'))).toBeUndefined();
    expect(aiRefusalMessage(failure('toString', 'inherited key'))).toBeUndefined();
    expect(aiRefusalMessage(undefined)).toBeUndefined();
    expect(aiRefusalMessage(new Error('x'))).toBeUndefined();
  });

  it('never promises a reset time, since one code covers the daily calls and the monthly tokens', () => {
    expect(AI_BLOCK_MESSAGES.AI_QUOTA_EXCEEDED).not.toMatch(/매일|오늘|초기화됩니다/);
  });
});

describe('errorMessage', () => {
  it('shows the server’s Korean sentence for a refusal body instead of axios’s English', () => {
    const cause = {
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        data: { success: false, code: 429, data: { error: 'RATE_LIMITED', message: '요청이 너무 많습니다.' } },
      },
    };
    expect(errorMessage(cause)).toBe('요청이 너무 많습니다.');
    expect(errorMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(errorMessage({ response: { data: { data: 'accessTokenExpired' } } })).toBe('accessTokenExpired');
  });
});
