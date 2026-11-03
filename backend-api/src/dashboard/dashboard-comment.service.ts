import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { z } from 'zod';
import { legacyBlockIds } from '../ai/dashboard-blocks';
import { validateDraft } from '../ai/dashboard-draft';
import { catalogActorContext } from '../bi/source-classifications';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { SourceAccessService } from '../ownership/source-access.service';
import {
  AuthorView,
  COMMENT_LIMITS,
  CommentLimitException,
  commentReplyRequest,
  isCommentConflict,
  RequestReusedException,
  ThreadStatus,
  threadStatusRequest,
} from '../reports/report-comment-contract';
import {
  ArtifactComment,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
} from '../reports/report-comment.entity';
import { canonicalReport, reportHash, reportId, ReportActor } from '../reports/report-contract';
import { User } from '../user/entities/user.entity';
import {
  DASHBOARD_OPERATIONS,
  DashboardAnchor,
  DashboardBlock,
  DashboardCommentList,
  DashboardCommentWrite,
  DashboardOperation,
  dashboardThreadRequest,
  DashboardThreadView,
} from './dashboard-comment-contract';
import { dashboardRevision } from './dashboard-revision';
import { lockDashboardWrite } from './dashboard-write-lock';
import { Dashboard } from './entities/dashboard.entity';
import { DASHBOARD_COMMENT_KIND as KIND } from './dashboard-comment-cleanup';

const denied = () => new ForbiddenException('현재 이 대시보드에 접근할 수 없습니다.');
const missingThread = () => new NotFoundException('댓글 스레드를 찾을 수 없습니다.');
const staleStatus = () =>
  new ConflictException('댓글 상태가 변경됐습니다. 현재 상태를 다시 확인해 주세요.');
const validEpoch = (value: number) => Number.isSafeInteger(value) && value >= 0;
const utf8 = (value: string) => Buffer.byteLength(value, 'utf8');
const isDashboardOperation = (value: string): value is DashboardOperation =>
  (DASHBOARD_OPERATIONS as readonly string[]).includes(value);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException('댓글 요청의 항목과 크기를 확인해 주세요.');
  return parsed.data;
}

/** Same ids the analysis read path shows: stored blockIds, else positional `legacy-<id>-<i>`. */
function currentBlocks(dashboard: Dashboard): DashboardBlock[] | null {
  if (!dashboard.analysisDefinition) return null;
  return legacyBlockIds(
    validateDraft(JSON.parse(dashboard.analysisDefinition)),
    dashboard.id,
  ).widgets.map(widget => ({ blockId: widget.blockId, title: widget.title, type: widget.type }));
}

/**
 * A positional legacy id names whatever chart now sits at that index, so a different title or
 * type there means the original chart may be gone.
 */
function locate(anchor: DashboardAnchor, blocks: DashboardBlock[] | null) {
  if (anchor.kind === 'whole') return { location: 'exact' as const, changed: false };
  const current = blocks?.find(block => block.blockId === anchor.blockId);
  if (!current) return { location: 'detached' as const, changed: false };
  const changed = current.title !== anchor.title || current.type !== anchor.type;
  return {
    location: changed && anchor.blockId.startsWith('legacy-') ? 'detached' : 'exact',
    changed,
  } as const;
}

type Access = {
  artifactId: string;
  organizationKey: number;
  canManage: boolean;
  revision: string;
  blocks: DashboardBlock[] | null;
};
type WriteContext = { manager: EntityManager; access: Access; now: string };

/**
 * Comments on a whole dashboard or one chart. Read access may comment and sees its own threads;
 * edit access (owner included) sees every thread and resolves or reopens. Governed dashboards
 * have no comments.
 */
@Injectable()
export class DashboardCommentService {
  constructor(private readonly db: DataSource, private readonly sources: SourceAccessService) {}

  private async transaction<T>(
    actor: ReportActor,
    run: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!actor || !validEpoch(actor.authVersion)) throw denied();
    try {
      return await sourceWriteTransaction(this.db, run);
    } catch (error) {
      if (isCommentConflict(error))
        throw new ConflictException(
          '동시 변경을 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.',
        );
      throw error;
    }
  }

  private async access(
    manager: EntityManager,
    id: number,
    actor: ReportActor,
    lock: boolean,
  ): Promise<Access> {
    const dashboard = lock
      ? await lockDashboardWrite(manager, id).catch(error => {
          throw error instanceof ForbiddenException ? denied() : error;
        })
      : await manager.findOneBy(Dashboard, { id });
    if (!dashboard) throw denied();
    const context = await catalogActorContext(manager, actor.id, actor.authVersion);
    const allowed = async (action: 'read' | 'edit') => {
      try {
        await this.sources.dashboard(id, actor.id, action, manager);
        return true;
      } catch (error) {
        if (error instanceof ForbiddenException) return false;
        throw error;
      }
    };
    if (!(await allowed('read'))) throw denied();
    if (dashboard.governed)
      throw new ForbiddenException('조직 정책이 적용된 대시보드에는 댓글을 달 수 없습니다.');
    return {
      artifactId: String(id),
      organizationKey: context.organizationId ?? 0,
      canManage: await allowed('edit'),
      revision: dashboardRevision(dashboard),
      blocks: currentBlocks(dashboard),
    };
  }

  async list(rawId: string, actor: ReportActor): Promise<DashboardCommentList> {
    const id = this.sources.id(rawId);
    return this.transaction(actor, async manager => {
      const access = await this.access(manager, id, actor, false);
      return {
        revision: access.revision,
        canManage: access.canManage,
        blockAnchors: access.blocks !== null,
        blocks: access.blocks ?? [],
        threads: await this.views(manager, access, actor),
      };
    });
  }

  async createThread(
    rawId: string,
    input: unknown,
    actor: ReportActor,
  ): Promise<DashboardCommentWrite> {
    const id = this.sources.id(rawId),
      body = parse(dashboardThreadRequest, input);
    return this.write(
      'dashboard.thread.create',
      id,
      body.requestId,
      { body },
      actor,
      async ({ manager, access, now }) => {
        if (body.revision !== access.revision)
          throw new ConflictException({
            statusCode: 409,
            message: '대시보드가 변경됐습니다. 최신 내용을 다시 불러와 주세요.',
            code: 'REVISION_CONFLICT',
          });
        const block = body.anchor.kind === 'block' ? this.block(access, body.anchor.blockId) : null;
        await this.limitThreads(manager, access.artifactId);
        await this.limitText(manager, access.artifactId, utf8(body.body));
        const threadId = randomUUID();
        await manager.insert(ArtifactCommentThread, {
          id: threadId,
          artifactKind: KIND,
          artifactId: access.artifactId,
          version: 0,
          artifactRevision: access.revision,
          anchorKind: body.anchor.kind,
          anchorBlockId: block?.blockId ?? null,
          anchorLabel: block?.title ?? null,
          anchorType: block?.type ?? null,
          status: 'open',
          statusVersion: 0,
          createdBy: actor.id,
          authorKind: 'user',
          createdAt: now,
          resolvedBy: null,
          resolvedAt: null,
        });
        await this.insertComment(manager, threadId, actor, body.body, now);
        return threadId;
      },
    );
  }

  async reply(
    rawId: string,
    rawThreadId: string,
    input: unknown,
    actor: ReportActor,
  ): Promise<DashboardCommentWrite> {
    const id = this.sources.id(rawId),
      threadId = parse(reportId, rawThreadId),
      body = parse(commentReplyRequest, input);
    return this.write(
      'dashboard.comment.reply',
      id,
      body.requestId,
      { threadId, body },
      actor,
      async ({ manager, access, now }) => {
        await this.visibleThread(manager, access, actor, threadId);
        if (
          (await manager.countBy(ArtifactComment, { threadId })) >= COMMENT_LIMITS.commentsPerThread
        )
          throw new CommentLimitException('댓글은 스레드당 200개까지입니다.');
        await this.limitText(manager, access.artifactId, utf8(body.body));
        return this.insertComment(manager, threadId, actor, body.body, now);
      },
    );
  }

  /** Resolve or reopen, edit access only; CAS on statusVersion. */
  async setThreadStatus(
    rawId: string,
    rawThreadId: string,
    input: unknown,
    actor: ReportActor,
  ): Promise<DashboardCommentWrite> {
    const id = this.sources.id(rawId),
      threadId = parse(reportId, rawThreadId),
      body = parse(threadStatusRequest, input);
    return this.write(
      'dashboard.thread.status',
      id,
      body.requestId,
      { threadId, body },
      actor,
      async ({ manager, access, now }) => {
        const thread = await this.visibleThread(manager, access, actor, threadId);
        if (!access.canManage)
          throw new ForbiddenException(
            '대시보드 편집 권한이 있어야 스레드를 해결하거나 다시 열 수 있습니다.',
          );
        if (thread.statusVersion !== body.expectedStatusVersion) throw staleStatus();
        if (thread.status === body.status) return threadId;
        const resolved = body.status === 'resolved';
        const result = await manager.update(
          ArtifactCommentThread,
          { id: threadId, statusVersion: body.expectedStatusVersion },
          {
            status: body.status,
            statusVersion: body.expectedStatusVersion + 1,
            resolvedBy: resolved ? actor.id : null,
            resolvedAt: resolved ? now : null,
          },
        );
        if (result.affected !== 1) throw staleStatus();
        return threadId;
      },
    );
  }

  /**
   * Lock order: transaction → dashboard row FOR UPDATE (not SQLite; the same fence deletion and
   * handover take before removing comments) → access → receipt → write.
   */
  private async write(
    operation: DashboardOperation,
    id: number,
    requestId: string,
    payload: Record<string, unknown>,
    actor: ReportActor,
    perform: (context: WriteContext) => Promise<string>,
  ): Promise<DashboardCommentWrite> {
    const digest = reportHash(canonicalReport({ operation, dashboardId: id, ...payload }));
    return this.transaction(actor, async manager => {
      const access = await this.access(manager, id, actor, true);
      const key = { actorId: actor.id, organizationKey: access.organizationKey, requestId };
      const prior = await manager.findOneBy(ArtifactCommentReceipt, key);
      let resultId: string;
      if (prior) {
        if (prior.operation !== operation || prior.payloadHash !== digest)
          throw new RequestReusedException(
            '같은 요청 ID의 입력이 다릅니다.',
            prior.resultId,
            isDashboardOperation(prior.operation)
              ? await this.threadIdOf(manager, prior.operation, prior.resultId)
              : undefined,
          );
        resultId = prior.resultId;
      } else {
        const now = new Date().toISOString();
        resultId = await perform({ manager, access, now });
        await manager.insert(ArtifactCommentReceipt, {
          ...key,
          operation,
          payloadHash: digest,
          resultId,
          createdAt: now,
        });
      }
      const threadId = await this.threadIdOf(manager, operation, resultId);
      const [thread] = threadId ? await this.views(manager, access, actor, threadId) : [];
      if (!thread) throw missingThread();
      return { replayed: !!prior, operation, resultId, thread };
    });
  }

  private async threadIdOf(
    manager: EntityManager,
    operation: DashboardOperation,
    resultId: string,
  ): Promise<string | undefined> {
    return operation === 'dashboard.comment.reply'
      ? (await manager.findOneBy(ArtifactComment, { id: resultId }))?.threadId
      : resultId;
  }

  private block(access: Access, blockId: string) {
    if (!access.blocks)
      throw new BadRequestException('이 대시보드에는 대시보드 전체 댓글만 달 수 있습니다.');
    const block = access.blocks.find(item => item.blockId === blockId);
    if (!block) throw new BadRequestException('선택한 차트를 확인해 주세요.');
    return block;
  }
  private async visibleThread(
    manager: EntityManager,
    access: Access,
    actor: ReportActor,
    threadId: string,
  ) {
    const thread = await manager.findOneBy(ArtifactCommentThread, {
      id: threadId,
      artifactKind: KIND,
      artifactId: access.artifactId,
    });
    if (!thread || (!access.canManage && thread.createdBy !== actor.id)) throw missingThread();
    return thread;
  }
  private async limitThreads(manager: EntityManager, artifactId: string) {
    if (
      (await manager.countBy(ArtifactCommentThread, { artifactKind: KIND, artifactId })) >=
      COMMENT_LIMITS.threadsPerReport
    )
      throw new CommentLimitException('댓글 스레드는 대시보드당 500개까지입니다.');
  }
  /** UTF-8 bytes of comment bodies already stored for the dashboard. */
  private async limitText(manager: EntityManager, artifactId: string, adding: number) {
    const bytes =
      manager.connection.options.type === 'postgres'
        ? 'octet_length("c"."body")'
        : 'length(CAST("c"."body" AS BLOB))';
    const stored = await manager
      .createQueryBuilder(ArtifactComment, 'c')
      .innerJoin(ArtifactCommentThread, 't', '"t"."id" = "c"."threadId"')
      .select(`COALESCE(SUM(${bytes}), 0)`, 'total')
      .where('"t"."artifactKind" = :kind AND "t"."artifactId" = :artifactId', {
        kind: KIND,
        artifactId,
      })
      .getRawOne<{ total: string | number }>();
    if (Number(stored?.total ?? 0) + adding > COMMENT_LIMITS.textBytesPerReport)
      throw new CommentLimitException('대시보드의 댓글은 합계 2MiB까지 저장할 수 있습니다.');
  }
  private async insertComment(
    manager: EntityManager,
    threadId: string,
    actor: ReportActor,
    body: string,
    now: string,
  ) {
    const commentId = randomUUID();
    await manager.insert(ArtifactComment, {
      id: commentId,
      threadId,
      authorId: actor.id,
      authorKind: 'user',
      body,
      createdAt: now,
    });
    return commentId;
  }

  /** Edit access: every thread. Read access: threads the actor started. */
  private async views(
    manager: EntityManager,
    access: Access,
    actor: ReportActor,
    onlyThreadId?: string,
  ): Promise<DashboardThreadView[]> {
    const threads = await manager.find(ArtifactCommentThread, {
      where: {
        artifactKind: KIND,
        artifactId: access.artifactId,
        ...(access.canManage ? {} : { createdBy: actor.id }),
        ...(onlyThreadId ? { id: onlyThreadId } : {}),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (!threads.length) return [];
    const comments = await manager.find(ArtifactComment, {
      where: { threadId: In(threads.map(thread => thread.id)) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const userIds = new Set<number>(comments.map(comment => comment.authorId));
    for (const thread of threads) {
      userIds.add(thread.createdBy);
      if (thread.resolvedBy !== null) userIds.add(thread.resolvedBy);
    }
    const users = new Map(
      (
        await manager.find(User, {
          select: { id: true, userId: true },
          where: { id: In([...userIds]) },
        })
      ).map(user => [user.id, user.userId] as const),
    );
    const author = (id: number, kind: string, clientName: string | null): AuthorView => ({
      kind: kind === 'ai' ? 'ai' : 'user',
      userId: users.get(id) ?? null,
      clientName: kind === 'ai' ? clientName : null,
    });
    return threads.map(thread => {
      const anchor: DashboardAnchor =
        thread.anchorKind === 'block'
          ? {
              kind: 'block',
              blockId: thread.anchorBlockId,
              title: thread.anchorLabel,
              type: thread.anchorType,
            }
          : { kind: 'whole' };
      return {
        id: thread.id,
        anchor,
        ...locate(anchor, access.blocks),
        status: thread.status as ThreadStatus,
        statusVersion: thread.statusVersion,
        createdAt: thread.createdAt,
        author: author(thread.createdBy, thread.authorKind, thread.aiClientName),
        mine: thread.createdBy === actor.id,
        resolvedAt: thread.resolvedAt,
        resolvedBy: thread.resolvedBy === null ? null : users.get(thread.resolvedBy) ?? null,
        comments: comments
          .filter(comment => comment.threadId === thread.id)
          .map(comment => ({
            id: comment.id,
            body: comment.body,
            createdAt: comment.createdAt,
            author: author(comment.authorId, comment.authorKind, comment.aiClientName),
            mine: comment.authorId === actor.id,
          })),
      };
    });
  }
}
