import { describe, expect, it } from 'vitest';
import { parseSignupMode, signupErrorKey } from './signupErrors';

const failure = (status: number, data: unknown) => ({ response: { status, data: { data } } });

describe('signup error mapping', () => {
  it('keeps the existing duplicate messages', () => {
    expect(signupErrorKey(failure(409, 'conflict userId'))).toBe('signup.dupId');
    expect(signupErrorKey(failure(409, 'conflict email'))).toBe('signup.dupEmail');
  });

  it('maps the invitation refusals', () => {
    expect(signupErrorKey(failure(403, { error: 'INVITE_REQUIRED' }))).toBe('signup.inviteRequired');
    expect(signupErrorKey(failure(403, { error: 'INVITE_INVALID' }))).toBe('signup.inviteInvalid');
    expect(signupErrorKey(failure(403, { error: 'SIGNUP_CLOSED' }))).toBe('signup.closed');
  });

  it('reports a throttled request and leaves anything else to the generic message', () => {
    expect(signupErrorKey(failure(429, null))).toBe('signup.tooMany');
    expect(signupErrorKey(failure(500, 'boom'))).toBeNull();
    expect(signupErrorKey(failure(403, { error: 'SOMETHING_ELSE' }))).toBeNull();
    expect(signupErrorKey(new Error('network'))).toBeNull();
  });
});

describe('parseSignupMode', () => {
  it('reads the mode from either response envelope', () => {
    expect(parseSignupMode({ data: { mode: 'invite' } })).toBe('invite');
    expect(parseSignupMode({ data: { data: { mode: 'open' } } })).toBe('open');
  });

  it('fails closed on anything unexpected', () => {
    expect(parseSignupMode({ data: { mode: 'everyone' } })).toBe('closed');
    expect(parseSignupMode(undefined)).toBe('closed');
    expect(parseSignupMode({})).toBe('closed');
  });
});
