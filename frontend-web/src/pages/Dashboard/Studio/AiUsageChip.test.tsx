import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAiUsage = vi.fn();
vi.mock('@/api/usageService', async () => {
  const actual = await vi.importActual<typeof import('@/api/usageService')>('@/api/usageService');
  return { ...actual, fetchAiUsage: (...args: unknown[]) => fetchAiUsage(...args) };
});

const status = vi.hoisted(() => ({
  value: null as null | { configured: boolean; provider: string | null; model: string | null },
}));
vi.mock('@/api/aiStatus', async () => {
  const actual = await vi.importActual<typeof import('@/api/aiStatus')>('@/api/aiStatus');
  return { ...actual, loadAiStatus: async () => status.value };
});

import AiUsageChip from './AiUsageChip';
import { notifyAiUsageChanged, trackAiCall } from '@/api/usageService';

const usage = (used: number, limit = 30) => ({
  daily: { used, limit, resetsAt: '2026-10-25T00:00:00.000Z' },
  monthlyTokens: { used: 0, limit: 500000, resetsAt: '2026-11-01T00:00:00.000Z' },
});
const setHidden = (hidden: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
const flush = () => act(async () => undefined);

describe('AiUsageChip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    fetchAiUsage.mockReset();
    status.value = null;
    setHidden(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setHidden(false);
  });

  it('shows nothing until the server has said, then the day’s calls', async () => {
    fetchAiUsage.mockResolvedValue(usage(3));
    const { container } = render(<AiUsageChip />);
    expect(container.textContent).toBe('');
    await flush();
    expect(screen.getByText('AI 호출 3/30')).toBeTruthy();
  });

  it('stays hidden when the usage is unknown', async () => {
    fetchAiUsage.mockResolvedValue(null);
    const { container } = render(<AiUsageChip />);
    await flush();
    expect(container.textContent).toBe('');
  });

  it('reads again once a call was spent, and says so at the limit', async () => {
    fetchAiUsage.mockResolvedValueOnce(usage(29)).mockResolvedValueOnce(usage(30));
    render(<AiUsageChip />);
    await flush();
    expect(screen.getByText('AI 호출 29/30')).toBeTruthy();
    await act(async () => {
      notifyAiUsageChanged();
    });
    expect(screen.getByText(/AI 호출 30\/30 · 오늘 한도 도달/)).toBeTruthy();
  });

  it('says which limit was reached when only the month’s tokens are used up', async () => {
    fetchAiUsage.mockResolvedValue({
      daily: { used: 3, limit: 30, resetsAt: '2026-10-25T00:00:00.000Z' },
      monthlyTokens: { used: 500000, limit: 500000, resetsAt: '2026-11-01T00:00:00.000Z' },
    });
    render(<AiUsageChip />);
    await flush();
    expect(screen.getByText(/AI 호출 3\/30 · 이달 한도 도달/)).toBeTruthy();
  });

  it('shows nothing when the server says no model is connected', async () => {
    status.value = { configured: false, provider: null, model: null };
    fetchAiUsage.mockResolvedValue(usage(0));
    const { container } = render(<AiUsageChip />);
    await flush();
    expect(container.textContent).toBe('');
  });

  it('polls once a minute while the tab is visible and not at all while it is hidden', async () => {
    fetchAiUsage.mockResolvedValue(usage(1));
    render(<AiUsageChip />);
    await flush();
    expect(fetchAiUsage).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchAiUsage).toHaveBeenCalledTimes(2);
    setHidden(true);
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(fetchAiUsage).toHaveBeenCalledTimes(2);
    await act(async () => {
      notifyAiUsageChanged();
    });
    expect(fetchAiUsage).toHaveBeenCalledTimes(2);
  });

  it('reads right away when the tab becomes visible again', async () => {
    fetchAiUsage.mockResolvedValue(usage(1));
    render(<AiUsageChip />);
    await flush();
    setHidden(true);
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchAiUsage).toHaveBeenCalledTimes(2);
  });

  it('stops polling and listening after unmount', async () => {
    fetchAiUsage.mockResolvedValue(usage(1));
    const { unmount } = render(<AiUsageChip />);
    await flush();
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
      notifyAiUsageChanged();
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchAiUsage).toHaveBeenCalledTimes(1);
  });
});

describe('trackAiCall', () => {
  it('tells the chip to read again whether the request succeeded or failed, and returns its result', async () => {
    const seen = vi.fn();
    const { onAiUsageChanged } = await import('@/api/usageService');
    const off = onAiUsageChanged(seen);
    expect(await trackAiCall(async () => 'ok')).toBe('ok');
    await expect(
      trackAiCall(async () => {
        throw new Error('429');
      }),
    ).rejects.toThrow('429');
    off();
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
