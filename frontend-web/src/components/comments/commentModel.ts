import { z } from 'zod';

export const authorSchema = z
  .object({ kind: z.enum(['user', 'ai']), userId: z.string().nullable(), clientName: z.string().nullable() })
  .strict();
export const commentSchema = z
  .object({ id: z.string().uuid(), body: z.string(), createdAt: z.string(), author: authorSchema, mine: z.boolean() })
  .strict();
export type CommentAuthor = z.infer<typeof authorSchema>;
export type CommentEntry = z.infer<typeof commentSchema>;

export function authorLabel(author: CommentAuthor): string {
  if (author.kind === 'ai') return `Claude · ${author.clientName ?? '연결된 클라이언트'}`;
  return author.userId ?? '알 수 없는 사용자';
}

const messages = z.union([z.string(), z.array(z.string())]);
const exceptionBody = z.object({ message: messages.optional(), code: z.string().optional() }).passthrough();
/**
 * Reads a Nest error. The global HttpExceptionFilter wraps it as
 * `{success, code: <status>, data: <exception response or Bad Request message>}`.
 */
function errorDetail(body: unknown): { detail: string; code?: string } {
  const inner = z.object({ success: z.literal(false), data: z.unknown() }).safeParse(body);
  const payload = inner.success ? inner.data.data : body;
  const text = messages.safeParse(payload);
  if (text.success) return { detail: [text.data].flat().join(' ') };
  const object = exceptionBody.safeParse(payload);
  if (!object.success) return { detail: '' };
  return { detail: object.data.message ? [object.data.message].flat().join(' ') : '', code: object.data.code };
}

export type CommentFailure = { status: number | null; code?: string; detail: string };
export function commentFailure(error: unknown): CommentFailure {
  const parsed = z.object({ response: z.object({ status: z.number(), data: z.unknown() }) }).safeParse(error);
  if (!parsed.success) return { status: null, detail: '' };
  return { status: parsed.data.response.status, ...errorDetail(parsed.data.response.data) };
}

/** Korean copy for comment calls; conflicts and limits never reuse the access-basis message. */
export function commentError(error: unknown, artifact: '보고서' | '대시보드'): string {
  const { status, code, detail } = commentFailure(error);
  if (status === null)
    return '댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  if (code === 'REQUEST_REUSED')
    return '이 요청은 이전 입력으로 이미 저장됐습니다. 목록을 새로 불러와 저장된 내용을 확인해 주세요.';
  if (code === 'COMMENT_LIMIT' || status === 413)
    return detail || '댓글과 제안 저장 한도를 넘었습니다. 해결된 스레드를 정리한 뒤 다시 시도해 주세요.';
  switch (status) {
    case 400:
      return detail || '댓글 입력을 확인해 주세요.';
    case 401:
      return `로그인이 만료됐습니다. 다시 로그인한 뒤 ${artifact}를 열어 주세요.`;
    case 403:
      return `현재 이 ${artifact}의 댓글에 접근할 수 없습니다.`;
    case 404:
      return detail || '댓글 스레드를 찾을 수 없습니다. 목록을 새로 불러와 주세요.';
    case 409:
      return detail || '그 사이 댓글이나 제안이 바뀌었습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.';
  }
  return status >= 500
    ? '서버가 댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다. 잠시 후 같은 내용으로 다시 시도해 주세요.'
    : '댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다.';
}
