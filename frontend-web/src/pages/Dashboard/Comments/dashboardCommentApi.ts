import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import { authorSchema, commentSchema } from '@/components/comments/commentModel';

const uuid = z.string().uuid();
const blockId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const blockSchema = z.object({ blockId, title: z.string(), type: z.string() }).strict();
const anchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('whole') }).strict(),
  z.object({ kind: z.literal('block'), blockId, title: z.string(), type: z.string() }).strict(),
]);
const threadSchema = z
  .object({
    id: uuid,
    anchor: anchorSchema,
    location: z.enum(['exact', 'detached']),
    changed: z.boolean(),
    status: z.enum(['open', 'resolved']),
    statusVersion: z.number().int().nonnegative().safe(),
    createdAt: z.string(),
    author: authorSchema,
    mine: z.boolean(),
    resolvedAt: z.string().nullable(),
    resolvedBy: z.string().nullable(),
    comments: z.array(commentSchema),
  })
  .strict();
const listSchema = z
  .object({
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    canManage: z.boolean(),
    blockAnchors: z.boolean(),
    blocks: z.array(blockSchema),
    threads: z.array(threadSchema),
  })
  .strict();
const writeSchema = z
  .object({
    replayed: z.boolean(),
    operation: z.enum(['dashboard.thread.create', 'dashboard.comment.reply', 'dashboard.thread.status']),
    resultId: uuid,
    thread: threadSchema,
  })
  .strict();
export type DashboardBlock = z.infer<typeof blockSchema>;
export type DashboardThread = z.infer<typeof threadSchema>;
export type DashboardCommentList = z.infer<typeof listSchema>;
export type DashboardCommentWrite = z.infer<typeof writeSchema>;
/** What a new thread targets; the server snapshots the chart title and type. */
export type DashboardAnchorRequest = { kind: 'whole' } | { kind: 'block'; blockId: string };

const options = (signal?: AbortSignal) => ({ signal, headers: { 'Cache-Control': 'no-cache' } });
const write = async (url: string, body: Record<string, unknown>) =>
  writeSchema.parse((await post(url, body, options())).data);
const base = (id: string) => `/dashboards/${encodeURIComponent(id)}/comments`;
export const dashboardCommentApi = {
  async list(id: string, signal?: AbortSignal) {
    return listSchema.parse((await get(base(id), undefined, options(signal))).data);
  },
  createThread(id: string, input: { requestId: string; revision: string; anchor: DashboardAnchorRequest; body: string }) {
    return write(base(id), input);
  },
  reply(id: string, threadId: string, input: { requestId: string; body: string }) {
    return write(`${base(id)}/${threadId}/replies`, input);
  },
  setStatus(
    id: string,
    threadId: string,
    input: { requestId: string; status: 'open' | 'resolved'; expectedStatusVersion: number },
  ) {
    return write(`${base(id)}/${threadId}/status`, input);
  },
};
