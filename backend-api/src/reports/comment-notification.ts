import { randomUUID } from 'crypto';
import { Between, EntityManager } from 'typeorm';
import {
  ArtifactComment,
  ArtifactCommentNotification,
  ArtifactCommentThread,
} from './report-comment.entity';
import { ReportDelivery } from './report-sharing.entity';

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
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type NotificationActor = { id: number; kind: 'user' | 'ai'; clientName: string | null };

export const THREAD_VISIBILITIES = ['private', 'participants'] as const;
export type ThreadVisibility = (typeof THREAD_VISIBILITIES)[number];

/** The reader: the report owner (pinnedVersion null) or a recipient reading their pinned version. */
export type ThreadViewer = { userId: number; ownerId: number; pinnedVersion: number | null };

/**
 * The one rule for who sees a report thread: the owner, its author, and for a `participants` thread
 * every recipient whose pinned version already contains it. A recipient without a pinned version
 * sees nothing but their own threads.
 */
export const canSeeThread = (
  thread: Pick<ArtifactCommentThread, 'createdBy' | 'visibility' | 'version'>,
  viewer: ThreadViewer,
) => {
  if (viewer.userId === viewer.ownerId || thread.createdBy === viewer.userId) return true;
  return (
    thread.visibility === 'participants' &&
    viewer.pinnedVersion !== null &&
    thread.version <= viewer.pinnedVersion
  );
};

/** Owner or author: the people who resolve, suggest on and change the visibility of a thread. */
export const managesThread = (
  thread: Pick<ArtifactCommentThread, 'createdBy'>,
  userId: number,
  ownerId: number,
) => userId === ownerId || thread.createdBy === userId;

const BROADCAST: NotificationEvent[] = ['thread.created', 'thread.shared'];

/**
 * Writes one notification per person who can see the thread now. A new or newly shared
 * `participants` thread goes to every active recipient who can see it; other events go to the
 * owner, the author and earlier commenters. Suggestion events skip recipients pinned before the
 * suggestion's base version, who cannot see it. A person acting themselves is skipped, but an AI
 * acting for its grant user still notifies that user. Entities only, so report-suggestion-apply and
 * report-sharing can call it; callers run it inside the write that caused the event, never on a
 * replay.
 */
export async function notifyThread(
  manager: EntityManager,
  input: {
    reportId: string;
    ownerId: number;
    organizationKey: number | null;
    threadId: string;
    event: NotificationEvent;
    actor: NotificationActor;
    now: string;
    suggestionBaseVersion?: number;
    /** Only these recipients (re-share); default: everyone the event reaches. */
    onlyRecipientId?: number;
  },
): Promise<void> {
  const { reportId, ownerId, organizationKey, threadId, event, actor, now } = input;
  if (!organizationKey) return;
  const thread = await manager.findOneBy(ArtifactCommentThread, {
    id: threadId,
    artifactKind: 'report',
    artifactId: reportId,
  });
  if (!thread) return;
  const deliveries = new Map(
    (await manager.find(ReportDelivery, { where: { reportId, active: true } })).map(
      row => [row.recipientId, row] as const,
    ),
  );
  const candidates = new Set<number>();
  if (input.onlyRecipientId !== undefined) candidates.add(input.onlyRecipientId);
  else {
    candidates.add(ownerId).add(thread.createdBy);
    if (BROADCAST.includes(event) && thread.visibility === 'participants')
      for (const recipientId of deliveries.keys()) candidates.add(recipientId);
    else
      for (const row of await manager.find(ArtifactComment, {
        select: { authorId: true },
        where: { threadId },
      }))
        candidates.add(row.authorId);
  }
  if (actor.kind === 'user') candidates.delete(actor.id);
  const rows: ArtifactCommentNotification[] = [];
  for (const recipientId of [...candidates].sort((a, b) => a - b)) {
    let relationVersion: number | null = null;
    let pinnedVersion: number | null = null;
    if (recipientId !== ownerId) {
      const relation = deliveries.get(recipientId);
      if (!relation || relation.organizationId !== organizationKey) continue;
      relationVersion = relation.relationVersion;
      pinnedVersion = relation.pinnedVersion;
      if (input.suggestionBaseVersion !== undefined && input.suggestionBaseVersion > pinnedVersion)
        continue;
    }
    if (!canSeeThread(thread, { userId: recipientId, ownerId, pinnedVersion })) continue;
    rows.push({
      id: randomUUID(),
      recipientId,
      organizationKey,
      artifactKind: 'report',
      artifactId: reportId,
      threadId,
      event,
      actorKind: actor.kind,
      actorId: actor.id,
      aiClientName: actor.kind === 'ai' ? actor.clientName : null,
      relationVersion,
      createdAt: now,
      readAt: null,
    });
  }
  if (rows.length) await manager.insert(ArtifactCommentNotification, rows);
}

/**
 * After a share moved a recipient's pin from `fromVersion` to `toVersion`, tells them about open
 * `participants` threads they can now see (not their own). Run after the delivery row is written.
 */
export async function notifyNewlyVisible(
  manager: EntityManager,
  input: {
    reportId: string;
    ownerId: number;
    organizationKey: number;
    recipientId: number;
    fromVersion: number;
    toVersion: number;
    now: string;
    /** The owner, or their AI when the share came through MCP. */
    actor: NotificationActor;
  },
): Promise<void> {
  if (input.toVersion <= input.fromVersion) return;
  const threads = await manager.find(ArtifactCommentThread, {
    select: { id: true, createdBy: true, version: true },
    where: {
      artifactKind: 'report',
      artifactId: input.reportId,
      visibility: 'participants',
      status: 'open',
      version: Between(input.fromVersion + 1, input.toVersion),
    },
    order: { createdAt: 'ASC', id: 'ASC' },
  });
  for (const thread of threads) {
    if (thread.createdBy === input.recipientId) continue;
    await notifyThread(manager, {
      reportId: input.reportId,
      ownerId: input.ownerId,
      organizationKey: input.organizationKey,
      threadId: thread.id,
      event: 'thread.shared',
      actor: input.actor,
      now: input.now,
      onlyRecipientId: input.recipientId,
    });
  }
}
