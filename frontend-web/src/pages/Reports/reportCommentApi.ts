import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import { isReportAccessError } from './reportApi';

const uuid = z.string().uuid();
const offset = z.number().int().nonnegative().safe();
const version = z.number().int().positive().safe();
const textAnchor = z
  .object({
    kind: z.literal('text'),
    start: offset,
    end: offset,
    quote: z.string(),
    prefix: z.string(),
    suffix: z.string(),
  })
  .strict();
const anchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('whole') }).strict(),
  textAnchor,
  z.object({ kind: z.literal('image'), blockId: z.string() }).strict(),
]);
const locationSchema = z
  .object({
    status: z.enum(['exact', 'moved', 'ambiguous', 'detached']),
    start: offset.optional(),
    end: offset.optional(),
  })
  .strict();
const authorSchema = z
  .object({ kind: z.enum(['user', 'ai']), userId: z.string().nullable(), clientName: z.string().nullable() })
  .strict();
const commentSchema = z
  .object({ id: uuid, body: z.string(), createdAt: z.string(), author: authorSchema, mine: z.boolean() })
  .strict();
const suggestionSchema = z
  .object({
    id: uuid,
    baseVersion: version,
    anchor: textAnchor,
    location: locationSchema,
    replacement: z.string(),
    rationale: z.string().nullable(),
    status: z.enum(['open', 'applied', 'dismissed']),
    statusVersion: offset,
    createdAt: z.string(),
    author: authorSchema,
    mine: z.boolean(),
    decidedAt: z.string().nullable(),
    appliedVersion: version.nullable(),
  })
  .strict();
const threadSchema = z
  .object({
    id: uuid,
    version,
    anchor: anchorSchema,
    location: locationSchema,
    status: z.enum(['open', 'resolved']),
    statusVersion: offset,
    createdAt: z.string(),
    author: authorSchema,
    mine: z.boolean(),
    resolvedAt: z.string().nullable(),
    resolvedBy: z.string().nullable(),
    comments: z.array(commentSchema),
    suggestions: z.array(suggestionSchema),
  })
  .strict();
const listSchema = z.object({ role: z.enum(['owner', 'recipient']), version, threads: z.array(threadSchema) }).strict();
const writeSchema = z
  .object({
    replayed: z.boolean(),
    operation: z.enum(['thread.create', 'comment.reply', 'thread.status', 'suggestion.create', 'suggestion.dismiss']),
    resultId: uuid,
    thread: threadSchema,
  })
  .strict();
export type CommentAuthor = z.infer<typeof authorSchema>;
export type CommentThread = z.infer<typeof threadSchema>;
export type CommentSuggestion = z.infer<typeof suggestionSchema>;
export type CommentList = z.infer<typeof listSchema>;
export type CommentAnchor = z.infer<typeof anchorSchema>;
export type CommentTextAnchor = z.infer<typeof textAnchor>;

const options = (signal?: AbortSignal) => ({ signal, headers: { 'Cache-Control': 'no-cache' } });
const write = async (url: string, body: Record<string, unknown>, signal?: AbortSignal) =>
  writeSchema.parse((await post(url, body, options(signal))).data);
const base = (id: string) => `/reports/${id}`;
export const reportCommentApi = {
  async list(id: string, signal?: AbortSignal) {
    return listSchema.parse((await get(`${base(id)}/comments`, undefined, options(signal))).data);
  },
  createThread(
    id: string,
    input: { requestId: string; version: number; anchor: CommentAnchor; body: string },
    signal?: AbortSignal,
  ) {
    return write(`${base(id)}/comments`, input, signal);
  },
  reply(id: string, threadId: string, input: { requestId: string; body: string }, signal?: AbortSignal) {
    return write(`${base(id)}/comments/${threadId}/replies`, input, signal);
  },
  setStatus(
    id: string,
    threadId: string,
    input: { requestId: string; status: 'open' | 'resolved'; expectedStatusVersion: number },
    signal?: AbortSignal,
  ) {
    return write(`${base(id)}/comments/${threadId}/status`, input, signal);
  },
  suggest(
    id: string,
    input: {
      requestId: string;
      version: number;
      threadId?: string;
      anchor: CommentTextAnchor;
      replacement: string;
      rationale?: string;
      body?: string;
    },
    signal?: AbortSignal,
  ) {
    return write(`${base(id)}/suggestions`, input, signal);
  },
  dismiss(id: string, suggestionId: string, input: { requestId: string; expectedStatusVersion: number }) {
    return write(`${base(id)}/suggestions/${suggestionId}/dismiss`, input);
  },
};

export const isCommentAccessError = isReportAccessError;

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

/** Korean copy for comment calls; conflicts and limits never reuse the report-basis message. */
export function commentError(error: unknown): string {
  const parsed = z.object({ response: z.object({ status: z.number(), data: z.unknown() }) }).safeParse(error);
  if (!parsed.success)
    return '댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  const { status } = parsed.data.response;
  const { detail, code } = errorDetail(parsed.data.response.data);
  if (code === 'REQUEST_REUSED')
    return '이 요청은 이전 입력으로 이미 저장됐습니다. 목록을 새로 불러와 저장된 내용을 확인해 주세요.';
  if (code === 'COMMENT_LIMIT' || status === 413)
    return detail || '댓글과 제안 저장 한도를 넘었습니다. 해결된 스레드를 정리한 뒤 다시 시도해 주세요.';
  switch (status) {
    case 400:
      return detail || '댓글 입력을 확인해 주세요.';
    case 401:
      return '로그인이 만료됐습니다. 다시 로그인한 뒤 보고서를 열어 주세요.';
    case 403:
      return '현재 이 보고서의 댓글에 접근할 수 없습니다.';
    case 404:
      return detail || '댓글 스레드를 찾을 수 없습니다. 목록을 새로 불러와 주세요.';
    case 409:
      return detail || '그 사이 댓글이나 제안이 바뀌었습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.';
  }
  return status >= 500
    ? '서버가 댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다. 잠시 후 같은 내용으로 다시 시도해 주세요.'
    : '댓글 요청을 완료하지 못했습니다. 입력은 그대로 두었습니다.';
}

export function authorLabel(author: CommentAuthor): string {
  if (author.kind === 'ai') return `Claude · ${author.clientName ?? '연결된 클라이언트'}`;
  return author.userId ?? '알 수 없는 사용자';
}
