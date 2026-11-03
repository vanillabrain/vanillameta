import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, LessThan } from 'typeorm';
import { z } from 'zod';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { User } from '../user/entities/user.entity';
import { canSeeThread, NotificationEvent } from './comment-notification';
import { ArtifactCommentNotification, ArtifactCommentThread } from './report-comment.entity';
import { ReportActor } from './report-contract';
import { ReportSharingService } from './report-sharing.service';

export const NOTIFICATION_PAGE = 20;
export const NOTIFICATION_RETENTION = { days: 90, rows: 500 };

export type NotificationView = {
  id: string;
  reportId: string;
  threadId: string;
  event: NotificationEvent;
  role: 'owner' | 'recipient';
  /** The report title in the version this user reads (recipients: their pinned version). */
  title: string;
  actor: { kind: 'user' | 'ai'; userId: string | null; clientName: string | null };
  createdAt: string;
  read: boolean;
};

const markReadRequest = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
]);
const denied = () => new ForbiddenException('현재 알림을 확인할 수 없습니다.');
type Access = Awaited<ReturnType<ReportSharingService['access']>>;
type Readable = Awaited<ReturnType<ReportSharingService['readableHead']>>;

/**
 * Reads a user's comment notifications. A row only says something happened; every read re-runs
 * report access() and hides rows the user can no longer see: lost access, a newer share relation
 * than the one the row was written under, or a thread that is no longer visible to them.
 */
@Injectable()
export class CommentNotificationService {
  constructor(private readonly db: DataSource, private readonly sharing: ReportSharingService) {}

  private transaction<T>(actor: ReportActor, run: (manager: EntityManager) => Promise<T>) {
    if (!actor || !Number.isSafeInteger(actor.authVersion) || actor.authVersion < 0) throw denied();
    return sourceWriteTransaction(this.db, run);
  }

  /** Newest first, after the notification id `after`. Trims the user's own old rows first. */
  async list(actor: ReportActor, after?: string) {
    return this.transaction(actor, async manager => {
      await this.trim(manager, actor.id);
      let older: { createdAt: string; id: string } | null = null;
      if (after) {
        const cursor = await manager.findOneBy(ArtifactCommentNotification, {
          id: after,
          recipientId: actor.id,
        });
        if (!cursor) throw new BadRequestException('알림 목록 위치를 확인할 수 없습니다.');
        older = cursor;
      }
      const rows = (
        await manager.find(ArtifactCommentNotification, {
          where: { recipientId: actor.id },
          order: { createdAt: 'DESC', id: 'DESC' },
        })
      ).filter(
        row =>
          !older ||
          row.createdAt < older.createdAt ||
          (row.createdAt === older.createdAt && row.id < older.id),
      );
      const visible = this.visibility(manager, actor, id =>
        this.sharing.access(manager, id, actor),
      );
      const items: Array<{ row: ArtifactCommentNotification; access: Access }> = [];
      let index = 0;
      for (; index < rows.length && items.length < NOTIFICATION_PAGE; index++) {
        const access = await visible(rows[index]);
        if (access) items.push({ row: rows[index], access });
      }
      const users = await this.userIds(
        manager,
        items.filter(item => item.row.actorKind === 'user').map(item => item.row.actorId),
      );
      return {
        items: items.map(({ row, access }) => this.view(row, access, users)),
        nextCursor: index < rows.length && items.length ? items[items.length - 1].row.id : null,
      };
    });
  }

  async unreadCount(actor: ReportActor) {
    return this.transaction(actor, async manager => {
      // Polled every minute and never trims, so it reads at most what retention keeps.
      const rows = await manager.find(ArtifactCommentNotification, {
        where: { recipientId: actor.id, readAt: IsNull() },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: NOTIFICATION_RETENTION.rows,
      });
      // Permission only: the count never needs the stored report, so it skips loading it. It also
      // skips the revision check, so a report failing integrity can stay counted while list() hides it.
      const visible = this.visibility(manager, actor, id =>
        this.sharing.readableHead(manager, id, actor),
      );
      let count = 0;
      for (const row of rows) if (await visible(row)) count++;
      return { count };
    });
  }

  /** Marks the user's own rows read; ids of other users' rows match nothing. */
  async markRead(actor: ReportActor, input: unknown) {
    const parsed = markReadRequest.safeParse(input);
    if (!parsed.success) throw new BadRequestException('읽음 처리할 알림을 확인해 주세요.');
    return this.transaction(actor, async manager => {
      const result = await manager.update(
        ArtifactCommentNotification,
        {
          recipientId: actor.id,
          readAt: IsNull(),
          ...('ids' in parsed.data ? { id: In(parsed.data.ids) } : {}),
        },
        { readAt: new Date().toISOString() },
      );
      return { updated: result.affected ?? 0 };
    });
  }

  /**
   * One permission check per report, never per row (access() loads the stored version). A report
   * that fails its integrity check is hidden like a lost one, so the bell does not keep failing.
   */
  private visibility<T extends Readable>(
    manager: EntityManager,
    actor: ReportActor,
    check: (reportId: string) => Promise<T>,
  ) {
    const reports = new Map<string, Promise<T | null>>();
    const threads = new Map<string, Promise<ArtifactCommentThread | null>>();
    const accessOf = (reportId: string) => {
      if (!reports.has(reportId))
        reports.set(
          reportId,
          check(reportId).catch(error => {
            if (
              error instanceof ForbiddenException ||
              error instanceof NotFoundException ||
              error instanceof InternalServerErrorException
            )
              return null;
            throw error;
          }),
        );
      return reports.get(reportId)!;
    };
    const threadOf = (row: ArtifactCommentNotification) => {
      if (!threads.has(row.threadId))
        threads.set(
          row.threadId,
          manager.findOneBy(ArtifactCommentThread, {
            id: row.threadId,
            artifactKind: row.artifactKind,
            artifactId: row.artifactId,
          }),
        );
      return threads.get(row.threadId)!;
    };
    return async (row: ArtifactCommentNotification): Promise<T | null> => {
      if (row.artifactKind !== 'report') return null;
      const access = await accessOf(row.artifactId);
      if (
        !access ||
        access.head.organizationKey !== row.organizationKey ||
        !this.sameRelation(access, row.relationVersion)
      )
        return null;
      const thread = await threadOf(row);
      const viewer = {
        userId: actor.id,
        ownerId: access.head.ownerId,
        pinnedVersion: access.role === 'owner' ? null : access.version,
      };
      return thread && canSeeThread(thread, viewer) ? access : null;
    };
  }

  /**
   * Owner rows carry no relation. A recipient row stays visible across re-shares of new versions
   * while the relation stays readable, and hides once it was revoked or auth-reset and reopened.
   */
  private sameRelation(access: Readable, relationVersion: number | null) {
    if (access.role === 'owner') return relationVersion === null;
    return (
      relationVersion !== null &&
      relationVersion >= (access.activatedRelationVersion ?? 0) &&
      relationVersion <= (access.relationVersion ?? -1)
    );
  }

  private async trim(manager: EntityManager, recipientId: number) {
    const cutoff = new Date(
      Date.now() - NOTIFICATION_RETENTION.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    await manager.delete(ArtifactCommentNotification, { recipientId, createdAt: LessThan(cutoff) });
    const overflow = await manager.find(ArtifactCommentNotification, {
      select: { id: true },
      where: { recipientId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: NOTIFICATION_RETENTION.rows,
    });
    if (overflow.length)
      await manager.delete(ArtifactCommentNotification, { id: In(overflow.map(row => row.id)) });
  }

  private async userIds(manager: EntityManager, ids: number[]) {
    if (!ids.length) return new Map<number, string>();
    const users = await manager.find(User, {
      select: { id: true, userId: true },
      where: { id: In([...new Set(ids)]) },
    });
    return new Map(users.map(user => [user.id, user.userId] as const));
  }

  private view(
    row: ArtifactCommentNotification,
    access: Access,
    users: Map<number, string>,
  ): NotificationView {
    const ai = row.actorKind === 'ai';
    return {
      id: row.id,
      reportId: row.artifactId,
      threadId: row.threadId,
      event: row.event as NotificationEvent,
      role: access.role,
      title: access.report.title,
      actor: {
        kind: ai ? 'ai' : 'user',
        userId: users.get(row.actorId) ?? null,
        clientName: ai ? row.aiClientName : null,
      },
      createdAt: row.createdAt,
      read: row.readAt !== null,
    };
  }
}
