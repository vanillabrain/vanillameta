import { z } from 'zod';
import {
  AuthorView,
  CommentView,
  commentReplyRequest,
  ThreadStatus,
} from '../reports/report-comment-contract';
import { reportId } from '../reports/report-contract';

const revision = z.string().regex(/^[a-f0-9]{64}$/);
/** Stored block ids are generated (`block-<uuid>`) or positional (`legacy-<id>-<i>`). */
const blockId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const dashboardAnchorRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('whole') }).strict(),
  z.object({ kind: z.literal('block'), blockId }).strict(),
]);
export const dashboardThreadRequest = z
  .object({
    requestId: reportId,
    revision,
    anchor: dashboardAnchorRequest,
    body: commentReplyRequest.shape.body,
  })
  .strict();

export type DashboardBlock = { blockId: string; title: string; type: string };
export type DashboardAnchor = { kind: 'whole' } | ({ kind: 'block' } & DashboardBlock);
/** Receipt operations; report receipts use unprefixed names in the same table. */
export const DASHBOARD_OPERATIONS = [
  'dashboard.thread.create',
  'dashboard.comment.reply',
  'dashboard.thread.status',
] as const;
export type DashboardOperation = (typeof DASHBOARD_OPERATIONS)[number];

export type DashboardThreadView = {
  id: string;
  /** Block anchors carry the chart title/type captured when the thread was opened. */
  anchor: DashboardAnchor;
  location: 'exact' | 'detached';
  /** The anchored chart's current title or type differs from the snapshot. */
  changed: boolean;
  status: ThreadStatus;
  statusVersion: number;
  createdAt: string;
  author: AuthorView;
  mine: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  comments: CommentView[];
};
export type DashboardCommentList = {
  revision: string;
  /** Edit access: sees every thread and may resolve or reopen. */
  canManage: boolean;
  /** Only dashboards with a stored analysis definition accept block anchors. */
  blockAnchors: boolean;
  blocks: DashboardBlock[];
  threads: DashboardThreadView[];
};
export type DashboardCommentWrite = {
  replayed: boolean;
  operation: DashboardOperation;
  resultId: string;
  thread: DashboardThreadView;
};
