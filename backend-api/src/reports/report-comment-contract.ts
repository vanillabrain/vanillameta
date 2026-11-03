import { HttpException, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { reportId } from './report-contract';

/** Limits from docs/architecture/artifact-comments-collaboration.md (UTF-16 units unless noted). */
export const COMMENT_LIMITS = {
  quote: 2000,
  context: 32,
  body: 4000,
  replacement: 20000,
  rationale: 2000,
  documentText: 20000,
  threadsPerReport: 500,
  commentsPerThread: 200,
  openSuggestionsPerReport: 100,
  openAiThreadsPerReport: 100,
  /** UTF-8 bytes of comment bodies + suggestion replacement/rationale per report. */
  textBytesPerReport: 2 * 1024 * 1024,
} as const;

const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
/** No lone surrogates, and no NUL: PostgreSQL text columns reject U+0000 (SQLSTATE 22021). */
const unicode = z
  .string()
  .refine(value => !loneSurrogate.test(value) && !value.includes('\u0000'), 'Invalid Unicode');
const offset = z.number().int().nonnegative().safe();
const version = z.number().int().positive().safe();
const blockId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const body = unicode.refine(
  value => value.length <= COMMENT_LIMITS.body && value.trim().length > 0,
  'Comment body must be 1-4000 characters',
);

export const textAnchor = z
  .object({
    kind: z.literal('text'),
    start: offset,
    end: offset,
    quote: unicode.refine(
      value => value.length >= 1 && value.length <= COMMENT_LIMITS.quote,
      'Quote must be 1-2000 units',
    ),
    prefix: unicode.refine(value => value.length <= COMMENT_LIMITS.context),
    suffix: unicode.refine(value => value.length <= COMMENT_LIMITS.context),
  })
  .strict();
export const reportAnchor = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('whole') }).strict(),
  textAnchor,
  z.object({ kind: z.literal('image'), blockId }).strict(),
]);
export type ReportTextAnchor = z.infer<typeof textAnchor>;
export type ReportAnchor = z.infer<typeof reportAnchor>;

export const threadCreateRequest = z
  .object({ requestId: reportId, version, anchor: reportAnchor, body })
  .strict();
export const commentReplyRequest = z.object({ requestId: reportId, body }).strict();
export const threadStatusRequest = z
  .object({
    requestId: reportId,
    status: z.enum(['open', 'resolved']),
    expectedStatusVersion: offset,
  })
  .strict();
export const suggestionCreateRequest = z
  .object({
    requestId: reportId,
    version,
    threadId: reportId.optional(),
    anchor: textAnchor,
    replacement: unicode.refine(value => value.length <= COMMENT_LIMITS.replacement),
    rationale: unicode.refine(value => value.length <= COMMENT_LIMITS.rationale).optional(),
    body: body.optional(),
  })
  .strict();
export const suggestionDismissRequest = z
  .object({ requestId: reportId, expectedStatusVersion: offset })
  .strict();

/** MCP provenance; the MCP layer passes it with its in-transaction grant check. */
export const aiProvenance = z
  .object({
    grantId: z.string().min(1).max(36),
    clientName: unicode.refine(value => value.trim().length > 0 && value.length <= 255),
  })
  .strict();
export type AiProvenance = z.infer<typeof aiProvenance>;

export type ThreadCreate = z.infer<typeof threadCreateRequest>;
export type CommentReply = z.infer<typeof commentReplyRequest>;
export type ThreadStatusChange = z.infer<typeof threadStatusRequest>;
export type SuggestionCreate = z.infer<typeof suggestionCreateRequest>;
export type SuggestionDismiss = z.infer<typeof suggestionDismissRequest>;

export type AnchorStatus = 'exact' | 'moved' | 'ambiguous' | 'detached';
export type AnchorLocation = { status: AnchorStatus; start?: number; end?: number };
export type ThreadStatus = 'open' | 'resolved';
export type SuggestionStatus = 'open' | 'applied' | 'dismissed';
export type AuthorKind = 'user' | 'ai';
export type CommentOperation =
  | 'thread.create'
  | 'comment.reply'
  | 'thread.status'
  | 'suggestion.create'
  | 'suggestion.dismiss';

/** Authors are shown by login id only; numeric ids and email are never returned. */
export type AuthorView = { kind: AuthorKind; userId: string | null; clientName: string | null };
export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: AuthorView;
  mine: boolean;
};
export type SuggestionView = {
  id: string;
  baseVersion: number;
  anchor: ReportTextAnchor;
  location: AnchorLocation;
  replacement: string;
  rationale: string | null;
  status: SuggestionStatus;
  statusVersion: number;
  createdAt: string;
  author: AuthorView;
  mine: boolean;
  decidedAt: string | null;
  appliedVersion: number | null;
};
export type ThreadView = {
  id: string;
  version: number;
  anchor: ReportAnchor;
  /** Position in the viewer's version: head for the owner, pinned version for a recipient. */
  location: AnchorLocation;
  status: ThreadStatus;
  statusVersion: number;
  createdAt: string;
  author: AuthorView;
  mine: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  comments: CommentView[];
  suggestions: SuggestionView[];
};
export type CommentListResult = {
  role: 'owner' | 'recipient';
  version: number;
  threads: ThreadView[];
};
export type CommentWriteResult = {
  replayed: boolean;
  operation: CommentOperation;
  resultId: string;
  thread: ThreadView;
};

export class RequestReusedException extends HttpException {
  readonly code = 'REQUEST_REUSED';
  constructor(message: string, readonly resultId?: string, readonly threadId?: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message,
        code: 'REQUEST_REUSED',
        ...(resultId ? { resultId } : {}),
        ...(threadId ? { threadId } : {}),
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Retryable contention: unique races, serialization, deadlock, lock wait. On SQLite writes are
 * serialized in-process, so only BUSY/LOCKED count; constraint or I/O errors stay real failures.
 */
const CONFLICT_CODES = ['23505', '40001', '40P01', '55P03', 'SQLITE_BUSY', 'SQLITE_LOCKED'];

export function isCommentConflict(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error.driverError as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && CONFLICT_CODES.includes(code);
}

/**
 * A quantity limit from the design (not a retryable conflict): counts and the 2 MiB text total are
 * 409, the post-apply document length is 413. MCP maps this class to its LIMIT error code.
 */
export class CommentLimitException extends HttpException {
  readonly code = 'COMMENT_LIMIT';
  constructor(message: string, status: 409 | 413 = HttpStatus.CONFLICT) {
    super({ statusCode: status, message, code: 'COMMENT_LIMIT' }, status);
  }
}
