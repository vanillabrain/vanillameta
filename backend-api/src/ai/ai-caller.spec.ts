import { BadRequestException, HttpException } from '@nestjs/common';
import { callerOf, isAiRefusal, requestEpoch } from './ai-caller';

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
