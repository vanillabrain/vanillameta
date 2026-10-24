import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/helpers/apiHelper', () => ({ get: (...args: unknown[]) => get(...args) }));

import { aiStatusLabel, aiStatusNote, loadAiStatus, resetAiStatusCache, validateAiStatus } from './aiStatus';

describe('AI status', () => {
  beforeEach(() => {
    get.mockReset();
    resetAiStatusCache();
  });

  it('names the provider and model the server really uses', () => {
    expect(aiStatusLabel({ configured: true, provider: 'openai', model: 'gpt-4o-mini' })).toBe('OpenAI · gpt-4o-mini');
    expect(aiStatusLabel({ configured: true, provider: 'anthropic', model: 'claude-sonnet-5-5' })).toBe(
      'Anthropic · claude-sonnet-5-5',
    );
    expect(aiStatusLabel({ configured: true, provider: 'openai-compatible', model: 'm' })).toBe('OpenAI 호환 · m');
    expect(aiStatusLabel({ configured: true, provider: 'codex', model: 'gpt-6-luna' })).toBe('Codex · gpt-6-luna');
  });

  it('says not configured only when the server said so, and plain AI while it is unknown', () => {
    // A sentence names the recipient of data: it must not say a model that does not exist.
    expect(aiStatusLabel({ configured: false, provider: null, model: null })).toBe('AI');
    expect(aiStatusNote({ configured: false, provider: null, model: null })).toContain('연결되지 않았습니다');
    expect(aiStatusNote({ configured: true, provider: 'openai', model: 'm' })).toBe('');
    expect(aiStatusNote(null)).toBe('');
    expect(aiStatusLabel(null)).toBe('AI');
    expect(aiStatusLabel(undefined)).toBe('AI');
  });

  it('treats a reply that is not a status as unknown, not as not configured', () => {
    expect(validateAiStatus(undefined)).toBeNull();
    expect(validateAiStatus({ data: { configured: 'yes' } })).toBeNull();
    expect(validateAiStatus('x')).toBeNull();
  });

  it('accepts the SUCCESS envelope and drops over-long or non-text fields', () => {
    expect(validateAiStatus({ status: 'SUCCESS', data: { configured: true, provider: 'openai', model: 'm' } })).toEqual({
      configured: true,
      provider: 'openai',
      model: 'm',
    });
    expect(validateAiStatus({ configured: true, provider: 7, model: 'x'.repeat(200) })).toEqual({
      configured: true,
      provider: null,
      model: null,
    });
  });

  it('treats a request that throws before it is sent as unknown', async () => {
    get.mockImplementationOnce(() => {
      throw new Error('apiHelper is mocked without get');
    });
    expect(await loadAiStatus()).toBeNull();
  });

  it('asks once and shares the answer; a failed read is retried next time', async () => {
    get.mockResolvedValueOnce({ data: { data: { configured: true, provider: 'openai', model: 'm' } } });
    const [a, b] = await Promise.all([loadAiStatus(), loadAiStatus()]);
    expect(a).toEqual(b);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/ai/status');

    resetAiStatusCache();
    get.mockReset();
    get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      data: { data: { configured: false, provider: null, model: null } },
    });
    expect(await loadAiStatus()).toBeNull();
    expect(await loadAiStatus()).toEqual({ configured: false, provider: null, model: null });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
