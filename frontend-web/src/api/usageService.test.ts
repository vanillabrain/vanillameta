import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/helpers/apiHelper', () => ({ get: (...args: unknown[]) => get(...args) }));

import {
  fetchAiUsage,
  isAtLimit,
  notifyAiUsageChanged,
  onAiUsageChanged,
  usageChipText,
  usageChipTitle,
  validateAiUsage,
} from './usageService';

const quotaWindow = (used: number, limit: number) => ({ used, limit, resetsAt: '2026-10-25T00:00:00.000Z' });
const reply = (daily = quotaWindow(3, 30), monthlyTokens = quotaWindow(1200, 500000)) => ({
  status: 'SUCCESS',
  data: { ai: { daily, monthlyTokens }, storage: {} },
});

describe('AI usage', () => {
  it('reads the daily calls and monthly tokens from the SUCCESS envelope', () => {
    const usage = validateAiUsage(reply())!;
    expect(usageChipText(usage)).toBe('AI 호출 3/30');
    expect(isAtLimit(usage)).toBe(false);
    expect(isAtLimit(validateAiUsage(reply(quotaWindow(30, 30)))!)).toBe(true);
    // The monthly tokens refuse as well, whatever the daily count says.
    expect(isAtLimit(validateAiUsage(reply(quotaWindow(3, 30), quotaWindow(500000, 500000)))!)).toBe(true);
    expect(isAtLimit(validateAiUsage(reply(quotaWindow(3, 30), quotaWindow(0, 0)))!)).toBe(true);
  });

  it('states remaining calls, the reset time and that one action can make several calls', () => {
    const usage = validateAiUsage(reply(quotaWindow(28, 30)))!;
    const title = usageChipTitle(usage, 'Asia/Seoul');
    expect(title).toContain('오늘 남은 AI 호출 2회');
    expect(title).toContain('9:00'); // 00:00 UTC is 09:00 in Seoul
    expect(title).toContain('여러 번 호출');
    expect(title).toContain('이달 토큰 1,200/500,000');
  });

  it('never shows a negative remainder', () => {
    expect(usageChipTitle(validateAiUsage(reply(quotaWindow(35, 30)))!)).toContain('남은 AI 호출 0회');
  });

  it.each([
    undefined,
    null,
    {},
    { data: { ai: {} } },
    { data: { ai: { daily: quotaWindow(1, 2) } } },
    reply({ used: -1 } as any),
  ])('treats %j as unknown, not as zero use', input => {
    expect(validateAiUsage(input)).toBeNull();
  });

  it('returns null when the request fails', async () => {
    get.mockRejectedValueOnce(new Error('network'));
    expect(await fetchAiUsage()).toBeNull();
    get.mockResolvedValueOnce({ data: reply() });
    expect((await fetchAiUsage())?.daily.used).toBe(3);
    expect(get).toHaveBeenCalledWith('/me/usage');
  });

  it('tells subscribers to read again, and stops after unsubscribing', () => {
    const listener = vi.fn();
    const off = onAiUsageChanged(listener);
    notifyAiUsageChanged();
    off();
    notifyAiUsageChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
