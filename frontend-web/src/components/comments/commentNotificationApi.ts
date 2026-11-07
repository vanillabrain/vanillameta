import { z } from 'zod';
import { get, post } from '@/helpers/apiHelper';
import { authorSchema } from './commentModel';

export const NOTIFICATION_EVENTS = [
  'thread.created',
  'thread.shared',
  'comment.replied',
  'suggestion.created',
  'suggestion.applied',
  'suggestion.dismissed',
  'thread.resolved',
  'thread.reopened',
] as const;
const notificationSchema = z
  .object({
    id: z.string().uuid(),
    reportId: z.string().uuid(),
    threadId: z.string().uuid(),
    event: z.enum(NOTIFICATION_EVENTS),
    role: z.enum(['owner', 'recipient']),
    title: z.string(),
    actor: authorSchema,
    createdAt: z.string(),
    read: z.boolean(),
  })
  .strict();
const pageSchema = z.object({ items: z.array(notificationSchema), nextCursor: z.string().uuid().nullable() }).strict();
const countSchema = z.object({ count: z.number().int().nonnegative() }).strict();
export type CommentNotification = z.infer<typeof notificationSchema>;
export type NotificationEvent = CommentNotification['event'];

const options = (signal?: AbortSignal) => ({ signal, headers: { 'Cache-Control': 'no-cache' } });
const base = '/comment-notifications';
export const commentNotificationApi = {
  async list(after?: string, signal?: AbortSignal) {
    return pageSchema.parse((await get(base, after ? { after } : undefined, options(signal))).data);
  },
  async unreadCount(signal?: AbortSignal) {
    return countSchema.parse((await get(`${base}/unread-count`, undefined, options(signal))).data).count;
  },
  async markRead(input: { ids: string[] } | { all: true }) {
    await post(`${base}/read`, input, options());
  },
};
