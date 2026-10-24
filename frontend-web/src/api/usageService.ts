import { get } from '@/helpers/apiHelper';

export type UsageWindow = { used: number; limit: number; resetsAt: string };
export type AiUsage = { daily: UsageWindow; monthlyTokens: UsageWindow };

const whole = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const windowOf = (value: any): UsageWindow | null =>
  value &&
  whole(value.used) &&
  whole(value.limit) &&
  typeof value.resetsAt === 'string' &&
  !Number.isNaN(Date.parse(value.resetsAt))
    ? { used: value.used, limit: value.limit, resetsAt: value.resetsAt }
    : null;

/** The AI part of `GET /me/usage`; anything not shaped like it is "unknown" (no chip), never zero. */
export function validateAiUsage(input: unknown): AiUsage | null {
  const body = input as { data?: any } | null;
  const ai = (body?.data ?? body)?.ai;
  const daily = windowOf(ai?.daily);
  const monthlyTokens = windowOf(ai?.monthlyTokens);
  return daily && monthlyTokens ? { daily, monthlyTokens } : null;
}

export async function fetchAiUsage(): Promise<AiUsage | null> {
  try {
    const response = await get('/me/usage');
    return validateAiUsage(response?.data);
  } catch {
    return null;
  }
}

/** "AI 호출 3/30" — the unit is one model call, however many calls one action makes. */
export const usageChipText = (usage: AiUsage): string => `AI 호출 ${usage.daily.used}/${usage.daily.limit}`;

export const usageChipTitle = (usage: AiUsage, timeZone?: string): string => {
  const left = Math.max(0, usage.daily.limit - usage.daily.used);
  const reset = new Date(usage.daily.resetsAt).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
  const month = ` · 이달 토큰 ${usage.monthlyTokens.used.toLocaleString('ko-KR')}/${usage.monthlyTokens.limit.toLocaleString(
    'ko-KR',
  )}`;
  return `오늘 남은 AI 호출 ${left}회 · ${reset}에 초기화${month}. 한 번의 작업이 여러 번 호출할 수 있습니다.`;
};

/** Which limit is used up, for the chip. When both are, the month: it is the one that lasts longer. */
export const limitReached = (usage: AiUsage): '오늘' | '이달' | null =>
  usage.monthlyTokens.used >= usage.monthlyTokens.limit ? '이달' : usage.daily.used >= usage.daily.limit ? '오늘' : null;

/** The daily calls or the monthly tokens are used up (the server refuses at either; a limit of 0 refuses all). */
export const isAtLimit = (usage: AiUsage) => limitReached(usage) !== null;

/** Runs a request that may spend AI calls, then tells the chip to read its numbers again. */
export async function trackAiCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } finally {
    notifyAiUsageChanged();
  }
}

// Anything that just spent a call tells the chip to read again.
const bus = new EventTarget();
export const notifyAiUsageChanged = () => bus.dispatchEvent(new Event('changed'));
export const onAiUsageChanged = (listener: () => void) => {
  bus.addEventListener('changed', listener);
  return () => bus.removeEventListener('changed', listener);
};
