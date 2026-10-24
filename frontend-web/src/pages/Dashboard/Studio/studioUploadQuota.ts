/**
 * The server refuses an upload that would pass the per-user storage limits with 403 and
 * `{ data: { error: 'UPLOAD_QUOTA_EXCEEDED', message } }`. A bare 403 elsewhere means "no permission",
 * so callers that map 403 to a permission sentence ask this first and show the server's own message.
 */
export const uploadQuotaMessage = (cause: unknown): string | undefined => {
  const body = (cause as any)?.response?.data;
  const detail = body?.data ?? body;
  if (Number((cause as any)?.response?.status) !== 403 || detail?.error !== 'UPLOAD_QUOTA_EXCEEDED') return undefined;
  const message = detail.message;
  return typeof message === 'string' && message.trim() && message.length <= 300
    ? message
    : '저장 용량 한도에 도달했습니다. 사용하지 않는 소스를 삭제한 뒤 다시 시도해 주세요.';
};
