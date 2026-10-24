/** A model step the server refused or could not start. Trying the same step again will not help. */
export const AI_BLOCK_MESSAGES: Record<string, string> = {
  // One code covers the daily calls and the monthly tokens, so this promises no reset time: the header's
  // usage figure (and its tooltip) says which limit and when it resets.
  AI_QUOTA_EXCEEDED:
    '이 계정의 AI 사용 한도에 도달했습니다. 아무것도 저장하거나 공유하지 않았고 초안은 그대로입니다. 한도와 초기화 시각은 머리글의 AI 사용량 표시에서 확인하세요.',
  AI_BUDGET_EXHAUSTED:
    '이번 달 서비스 전체의 AI 사용량이 한도에 도달해 지금은 AI를 쓸 수 없습니다. 아무것도 저장하거나 공유하지 않았고 초안은 그대로입니다. 다음 달에 다시 사용할 수 있습니다.',
  AI_NOT_CONFIGURED: 'AI 기능이 아직 연결되지 않았습니다. 초안은 그대로입니다. 운영자에게 문의해 주세요.',
  AI_INPUT_TOO_LARGE: 'AI에 보낼 내용이 너무 큽니다. 초안은 그대로입니다. 범위를 줄여 다시 시도해 주세요.',
};

/** Gateway failures the server words itself and that no retry of the same request will fix quickly. */
const SERVER_WORDED = ['LLM_TIMEOUT', 'LLM_UNAVAILABLE', 'LLM_OUTPUT_TRUNCATED'];
const AI_TROUBLE = 'AI 연결 또는 처리 상태를 확인하지 못했습니다. 기존 입력을 유지했습니다. 잠시 후 다시 시도해 주세요.';
const has = (table: object, key: unknown): key is string =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

/**
 * The sentence for an AI refusal or gateway failure, whichever route it came from (an axios error or a
 * stream's `error` event, which is shaped like one): the server's own words when present and reasonable,
 * ours for the same code otherwise. `undefined` when the error is not one of these, so the caller's own
 * handling applies. A refusal is a final answer for now: callers must not treat it as "result unknown".
 */
export function aiRefusalMessage(cause: unknown): string | undefined {
  const body = (cause as any)?.response?.data;
  const detail = body?.data ?? body;
  const code = detail?.error;
  if (!has(AI_BLOCK_MESSAGES, code) && !(typeof code === 'string' && SERVER_WORDED.includes(code))) return undefined;
  const message = detail.message;
  if (typeof message === 'string' && message.trim() && message.length <= 300) return message;
  return has(AI_BLOCK_MESSAGES, code) ? AI_BLOCK_MESSAGES[code] : AI_TROUBLE;
}
