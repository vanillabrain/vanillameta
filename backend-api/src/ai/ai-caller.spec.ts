import { BadRequestException, HttpException } from '@nestjs/common';
import {
  aiBlockingCode,
  callerOf,
  failureCode,
  isAiRefusal,
  llmFailure,
  requestEpoch,
} from './ai-caller';

describe('who a model call is for', () => {
  it('takes the user and the epoch from the verified token, never a default for a token that has one', () => {
    const req = { user: { accessKeyData: { id: 7, authVersion: 9 } } };
    expect(requestEpoch(req)).toBe(9);
    expect(callerOf(req, 'text-to-sql')).toEqual({ userId: 7, epoch: 9, feature: 'text-to-sql' });
  });

  it('counts a token from before the field existed as epoch 0', () => {
    expect(requestEpoch({ user: { accessKeyData: { id: 7 } } })).toBe(0);
  });
});

describe('isAiRefusal', () => {
  it.each([
    ['AI_QUOTA_EXCEEDED', 429],
    ['AI_BUDGET_EXHAUSTED', 503],
    ['AI_INPUT_TOO_LARGE', 400],
  ])('recognizes %s', (error, status) => {
    expect(isAiRefusal(new HttpException({ error, message: 'x' }, status))).toBe(true);
  });

  it('does not match other errors', () => {
    expect(isAiRefusal(new Error('AI_QUOTA_EXCEEDED'))).toBe(false);
    expect(isAiRefusal(new BadRequestException('AI_QUOTA_EXCEEDED'))).toBe(false);
    expect(isAiRefusal(new HttpException({ error: 'OTHER' }, 429))).toBe(false);
    expect(isAiRefusal(undefined)).toBe(false);
  });
});

describe('aiBlockingCode', () => {
  it('names the errors a retry cannot fix, and only those', () => {
    expect(aiBlockingCode(new HttpException({ error: 'AI_QUOTA_EXCEEDED' }, 429))).toBe(
      'AI_QUOTA_EXCEEDED',
    );
    expect(aiBlockingCode(new HttpException({ error: 'AI_BUDGET_EXHAUSTED' }, 503))).toBe(
      'AI_BUDGET_EXHAUSTED',
    );
    expect(aiBlockingCode(new Error('AI_NOT_CONFIGURED'))).toBe('AI_NOT_CONFIGURED');
    expect(aiBlockingCode(new HttpException({ error: 'AI_NOT_CONFIGURED' }, 503))).toBe(
      'AI_NOT_CONFIGURED',
    );
    expect(aiBlockingCode(new Error('LLM_TIMEOUT'))).toBeUndefined();
    expect(aiBlockingCode(new Error('LLM_API_ERROR_500'))).toBeUndefined();
  });
});

describe('llmFailure', () => {
  it('maps the gateway’s codes and ignores everything else', () => {
    expect(llmFailure(new Error('LLM_TIMEOUT'))?.status).toBe(504);
    expect(llmFailure(new Error('LLM_API_ERROR_UNKNOWN'))?.status).toBe(502);
    expect(llmFailure(new Error('boom'))).toBeUndefined();
    expect(llmFailure('LLM_TIMEOUT')).toBeUndefined();
  });
});

describe('failureCode', () => {
  it('keeps the gateway’s fixed codes, which tell a revoked key from a timeout from a ledger outage', () => {
    for (const code of [
      'LLM_TIMEOUT',
      'LLM_API_ERROR_401',
      'LLM_OUTPUT_TRUNCATED',
      'AI_NOT_CONFIGURED',
    ])
      expect(failureCode(new Error(code))).toBe(code);
  });

  it('reduces anything else to its class name, never its text', () => {
    const parse = (() => {
      try {
        JSON.parse('Here is the SELECT you asked for');
      } catch (error) {
        return error;
      }
    })();
    expect(String((parse as Error).message)).toContain('Here is');
    expect(failureCode(parse)).toBe('SyntaxError');
    expect(failureCode(new Error('connect ECONNREFUSED 10.0.0.5 password=hunter2'))).toBe('Error');
    expect(failureCode(new TypeError('x'))).toBe('TypeError');
    expect(failureCode(undefined)).toBe('Error');
  });

  it('does not accept a code-looking prefix followed by other text', () => {
    expect(failureCode(new Error('LLM_API_ERROR_401 for key sk-123'))).toBe('Error');
  });
});
