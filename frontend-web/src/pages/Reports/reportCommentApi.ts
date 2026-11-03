import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import { authorSchema, commentError as sharedCommentError, commentSchema } from '@/components/comments/commentModel';
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

export const commentError = (error: unknown) => sharedCommentError(error, '보고서');
export { authorLabel } from '@/components/comments/commentModel';
export type { CommentAuthor } from '@/components/comments/commentModel';
