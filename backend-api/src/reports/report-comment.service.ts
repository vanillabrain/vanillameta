import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, LessThanOrEqual } from 'typeorm';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { User } from '../user/entities/user.entity';
import {
  appliedLength,
  documentText,
  locate,
  locateAnchor,
  textAnchorProblem,
} from './report-anchor';
import {
  aiProvenance,
  AiProvenance,
  AuthorKind,
  AuthorView,
  COMMENT_LIMITS,
  CommentLimitException,
  isCommentConflict,
  CommentListResult,
  CommentOperation,
  CommentWriteResult,
  commentReplyRequest,
  ReportAnchor,
  ReportTextAnchor,
  suggestionCreateRequest,
  suggestionDismissRequest,
  SuggestionStatus,
  ThreadStatus,
  threadCreateRequest,
  threadStatusRequest,
  ThreadView,
} from './report-comment-contract';
import {
  ArtifactComment,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
  ArtifactSuggestion,
} from './report-comment.entity';
import { canonicalReport, parseReport, reportHash, reportId, ReportActor } from './report-contract';
import { RequestReusedException } from './report-comment-contract';
import { ReportSharingService } from './report-sharing.service';

export { markSuggestionsApplied } from './report-suggestion-apply';

const KIND = 'report';
const denied = () => new ForbiddenException('현재 이 보고서에 접근할 수 없습니다.');
const validEpoch = (value: number) => Number.isSafeInteger(value) && value >= 0;
const missingThread = () => new NotFoundException('댓글 스레드를 찾을 수 없습니다.');
const staleStatus = () =>
  new ConflictException('댓글 상태가 변경됐습니다. 현재 상태를 다시 확인해 주세요.');

export { CommentLimitException, isCommentConflict };

/**
 * The requestId already committed a write with different input. Not a retryable conflict: the
 * earlier write is recorded, and a new requestId would add a second, different action.
 * MCP maps this class to its REQUEST_REUSED error code.
 */
export { RequestReusedException };

/** Lets the MCP layer re-check its grant in the same transaction and record AI provenance. */
export type CommentWriteOptions = {
  /** Runs first inside the write transaction, before the head lock and access(). */
  beforeAccess?: (manager: EntityManager) => Promise<void>;
  ai?: AiProvenance;
};
type Access = Awaited<ReturnType<ReportSharingService['access']>>;
type Author = { authorKind: AuthorKind; aiGrantId: string | null; aiClientName: string | null };
type WriteContext = { manager: EntityManager; access: Access; author: Author; now: string };

const anchorColumns = (anchor: ReportAnchor) => ({
  anchorKind: anchor.kind,
  anchorStart: anchor.kind === 'text' ? anchor.start : null,
  anchorEnd: anchor.kind === 'text' ? anchor.end : null,
  anchorQuote: anchor.kind === 'text' ? anchor.quote : null,
  anchorPrefix: anchor.kind === 'text' ? anchor.prefix : null,
  anchorSuffix: anchor.kind === 'text' ? anchor.suffix : null,
  anchorBlockId: anchor.kind === 'image' ? anchor.blockId : null,
});
const textAnchorOf = (row: {
  anchorStart: number;
  anchorEnd: number;
  anchorQuote: string;
  anchorPrefix: string | null;
  anchorSuffix: string | null;
}): ReportTextAnchor => ({
  kind: 'text',
  start: row.anchorStart,
  end: row.anchorEnd,
  quote: row.anchorQuote,
  prefix: row.anchorPrefix ?? '',
  suffix: row.anchorSuffix ?? '',
});
const anchorOf = (row: ArtifactCommentThread): ReportAnchor =>
  row.anchorKind === 'text'
    ? textAnchorOf(
        row as ArtifactCommentThread & {
          anchorStart: number;
          anchorEnd: number;
          anchorQuote: string;
        },
      )
    : row.anchorKind === 'image'
    ? { kind: 'image', blockId: row.anchorBlockId }
    : { kind: 'whole' };
const utf8 = (...values: Array<string | null | undefined>) =>
  values.reduce((total, value) => total + Buffer.byteLength(value ?? '', 'utf8'), 0);

@Injectable()
export class ReportCommentService {
  constructor(private readonly db: DataSource, private readonly sharing: ReportSharingService) {}

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

  /** Threads the actor may see, with positions in the viewer's version. Reads take no locks. */
  async list(rawId: string, actor: ReportActor): Promise<CommentListResult> {
    const id = parseReport(reportId, rawId);
    return this.transaction(actor, async manager => {
      const access = await this.sharing.access(manager, id, actor);
      return {
        role: access.role,
        version: access.version,
        threads: await this.views(manager, access, actor),
      };
    });
  }

  async createThread(
    rawId: string,
    input: unknown,
    actor: ReportActor,
    options: CommentWriteOptions = {},
  ): Promise<CommentWriteResult> {
    const id = parseReport(reportId, rawId),
      body = parseReport(threadCreateRequest, input);
    return this.write(
      'thread.create',
      id,
      body.requestId,
      { body },
      actor,
      options,
      async context => {
        const { manager, access, author, now } = context;
        this.requireVersion(access, body.version);
        this.checkAnchor(access, body.anchor);
        await this.limitThreads(manager, id, author);
        await this.limitText(manager, id, utf8(body.body));
        const threadId = await this.insertThread(context, actor, body.version, body.anchor);
        await this.insertComment(manager, threadId, actor, author, body.body, now);
        return threadId;
      },
    );
  }

  async reply(
    rawId: string,
    rawThreadId: string,
    input: unknown,
    actor: ReportActor,
    options: CommentWriteOptions = {},
  ): Promise<CommentWriteResult> {
    const id = parseReport(reportId, rawId),
      threadId = parseReport(reportId, rawThreadId),
      body = parseReport(commentReplyRequest, input);
    return this.write(
      'comment.reply',
      id,
      body.requestId,
      { threadId, body },
      actor,
      options,
      async ({ manager, access, author, now }) => {
        await this.visibleThread(manager, access, actor, threadId);
        await this.limitComments(manager, threadId);
        await this.limitText(manager, id, utf8(body.body));
        return this.insertComment(manager, threadId, actor, author, body.body, now);
      },
    );
  }

  /** Resolve or reopen: owner on any thread, recipient on their own; CAS on statusVersion. */
  async setThreadStatus(
    rawId: string,
    rawThreadId: string,
    input: unknown,
    actor: ReportActor,
    options: CommentWriteOptions = {},
  ): Promise<CommentWriteResult> {
    const id = parseReport(reportId, rawId),
      threadId = parseReport(reportId, rawThreadId),
      body = parseReport(threadStatusRequest, input);
    return this.write(
      'thread.status',
      id,
      body.requestId,
      { threadId, body },
      actor,
      options,
      async ({ manager, access, now }) => {
        const thread = await this.visibleThread(manager, access, actor, threadId);
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

  /** A proposed text edit; never changes the report. Without threadId it opens a new thread. */
  async createSuggestion(
    rawId: string,
    input: unknown,
    actor: ReportActor,
    options: CommentWriteOptions = {},
  ): Promise<CommentWriteResult> {
    const id = parseReport(reportId, rawId),
      body = parseReport(suggestionCreateRequest, input);
    return this.write(
      'suggestion.create',
      id,
      body.requestId,
      { body },
      actor,
      options,
      async context => {
        const { manager, access, author, now } = context;
        this.requireVersion(access, body.version);
        const text = this.checkAnchor(access, body.anchor);
        if (body.replacement === body.anchor.quote)
          throw new BadRequestException('제안 내용이 선택한 본문과 같습니다.');
        if (appliedLength(text, body.anchor, body.replacement) > COMMENT_LIMITS.documentText)
          throw new CommentLimitException('제안을 적용하면 본문이 20,000자를 넘습니다.', 413);
        if (body.threadId) {
          const thread = await this.visibleThread(manager, access, actor, body.threadId);
          if (thread.status !== 'open')
            throw new ConflictException(
              '해결된 스레드에는 제안할 수 없습니다. 먼저 다시 열어 주세요.',
            );
          if (body.body !== undefined) await this.limitComments(manager, thread.id);
        } else await this.limitThreads(manager, id, author);
        if (
          (await manager.countBy(ArtifactSuggestion, { artifactId: id, status: 'open' })) >=
          COMMENT_LIMITS.openSuggestionsPerReport
        )
          throw new CommentLimitException('열린 제안은 보고서당 100개까지입니다.');
        await this.limitText(manager, id, utf8(body.replacement, body.rationale, body.body));
        const threadId =
          body.threadId ?? (await this.insertThread(context, actor, body.version, body.anchor));
        const suggestionId = randomUUID();
        await manager.insert(ArtifactSuggestion, {
          id: suggestionId,
          threadId,
          artifactId: id,
          baseVersion: body.version,
          anchorStart: body.anchor.start,
          anchorEnd: body.anchor.end,
          anchorQuote: body.anchor.quote,
          anchorPrefix: body.anchor.prefix,
          anchorSuffix: body.anchor.suffix,
          replacement: body.replacement,
          rationale: body.rationale ?? null,
          status: 'open',
          statusVersion: 0,
          createdBy: actor.id,
          ...author,
          createdAt: now,
          decidedBy: null,
          decidedAt: null,
          appliedVersion: null,
        });
        if (body.body !== undefined)
          await this.insertComment(manager, threadId, actor, author, body.body, now);
        return suggestionId;
      },
    );
  }

  /** Owner closes an open suggestion without applying it; the thread is left as it is. */
  async dismissSuggestion(
    rawId: string,
    rawSuggestionId: string,
    input: unknown,
    actor: ReportActor,
    options: CommentWriteOptions = {},
  ): Promise<CommentWriteResult> {
    const id = parseReport(reportId, rawId),
      suggestionId = parseReport(reportId, rawSuggestionId),
      body = parseReport(suggestionDismissRequest, input);
    return this.write(
      'suggestion.dismiss',
      id,
      body.requestId,
      { suggestionId, body },
      actor,
      options,
      async ({ manager, access, now }) => {
        if (access.role !== 'owner')
          throw new ForbiddenException('보고서 소유자만 제안을 닫을 수 있습니다.');
        const suggestion = await manager.findOneBy(ArtifactSuggestion, {
          id: suggestionId,
          artifactId: id,
        });
        if (!suggestion) throw new NotFoundException('제안을 찾을 수 없습니다.');
        if (suggestion.statusVersion !== body.expectedStatusVersion) throw staleStatus();
        if (suggestion.status !== 'open') throw new ConflictException('이미 처리된 제안입니다.');
        const result = await manager.update(
          ArtifactSuggestion,
          { id: suggestionId, status: 'open', statusVersion: body.expectedStatusVersion },
          {
            status: 'dismissed',
            statusVersion: body.expectedStatusVersion + 1,
            decidedBy: actor.id,
            decidedAt: now,
          },
        );
        if (result.affected !== 1) throw staleStatus();
        return suggestionId;
      },
    );
  }

  /**
   * Lock order: transaction → options.beforeAccess (MCP grant) → head FOR UPDATE (not SQLite) →
   * access() → receipt → write. No staff or root locks: a comment grants no access, and every read
   * re-runs access().
   */
  private async write(
    operation: CommentOperation,
    id: string,
    requestId: string,
    payload: Record<string, unknown>,
    actor: ReportActor,
    options: CommentWriteOptions,
    perform: (context: WriteContext) => Promise<string>,
  ): Promise<CommentWriteResult> {
    const ai = options.ai === undefined ? null : parseReport(aiProvenance, options.ai);
    const digest = reportHash(canonicalReport({ operation, reportId: id, ...payload, ai }));
    const author: Author = ai
      ? { authorKind: 'ai', aiGrantId: ai.grantId, aiClientName: ai.clientName }
      : { authorKind: 'user', aiGrantId: null, aiClientName: null };
    return this.transaction(actor, async manager => {
      if (options.beforeAccess) await options.beforeAccess(manager);
      const access = await this.sharing.access(manager, id, actor, { lock: true });
      const key = { actorId: actor.id, organizationKey: access.head.organizationKey, requestId };
      const prior = await manager.findOneBy(ArtifactCommentReceipt, key);
      let resultId: string;
      if (prior) {
        if (prior.operation !== operation || prior.payloadHash !== digest)
          throw new RequestReusedException(
            '같은 요청 ID의 입력이 다릅니다.',
            prior.resultId,
            await this.threadIdOf(manager, prior.operation as CommentOperation, prior.resultId),
          );
        resultId = prior.resultId;
      } else {
        const now = new Date().toISOString();
        resultId = await perform({ manager, access, author, now });
        await manager.insert(ArtifactCommentReceipt, {
          ...key,
          operation,
          payloadHash: digest,
          resultId,
          createdAt: now,
        });
      }
      return this.result(manager, access, actor, operation, resultId, !!prior);
    });
  }

  /**
   * The committed result of this actor's earlier write with `requestId`, or null. Changes nothing
   * and takes no locks. MCP resolves a text anchor against the caller's current version before it
   * writes, so it looks here first: a retry after the report moved on must reuse the stored anchor
   * instead of failing on the newer version. write() still compares the whole payload under lock.
   */
  async replay(
    rawId: string,
    requestId: string,
    actor: ReportActor,
  ): Promise<CommentWriteResult | null> {
    const id = parseReport(reportId, rawId);
    return this.transaction(actor, async manager => {
      const access = await this.sharing.access(manager, id, actor);
      const prior = await manager.findOneBy(ArtifactCommentReceipt, {
        actorId: actor.id,
        organizationKey: access.head.organizationKey,
        requestId,
      });
      return prior
        ? this.result(
            manager,
            access,
            actor,
            prior.operation as CommentOperation,
            prior.resultId,
            true,
          )
        : null;
    });
  }

  private async result(
    manager: EntityManager,
    access: Access,
    actor: ReportActor,
    operation: CommentOperation,
    resultId: string,
    replayed: boolean,
  ): Promise<CommentWriteResult> {
    const threadId = await this.threadIdOf(manager, operation, resultId);
    const [thread] = threadId ? await this.views(manager, access, actor, threadId) : [];
    if (!thread) throw missingThread();
    return { replayed, operation, resultId, thread };
  }

  private async threadIdOf(
    manager: EntityManager,
    operation: CommentOperation,
    resultId: string,
  ): Promise<string | undefined> {
    return operation === 'comment.reply'
      ? (await manager.findOneBy(ArtifactComment, { id: resultId }))?.threadId
      : operation.startsWith('suggestion.')
      ? (await manager.findOneBy(ArtifactSuggestion, { id: resultId }))?.threadId
      : operation.startsWith('dashboard.')
      ? undefined
      : resultId;
  }

  private requireVersion(access: Access, version: number) {
    if (version !== access.version)
      throw new ConflictException('보고서 버전이 변경됐습니다. 최신 내용을 다시 불러와 주세요.');
  }
  /** Validates the anchor against the actor's version and returns that version's text. */
  private checkAnchor(access: Access, anchor: ReportAnchor) {
    const text = documentText(access.report.blocks, access.report.body);
    if (anchor.kind === 'text' && textAnchorProblem(anchor, text))
      throw new BadRequestException('선택한 본문 범위를 확인해 주세요.');
    if (
      anchor.kind === 'image' &&
      !access.report.blocks?.some(block => block.kind === 'IMAGE' && block.id === anchor.blockId)
    )
      throw new BadRequestException('선택한 이미지를 확인해 주세요.');
    return text;
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
      artifactId: access.head.id,
    });
    if (!thread || (access.role !== 'owner' && thread.createdBy !== actor.id))
      throw missingThread();
    return thread;
  }
  private async limitThreads(manager: EntityManager, id: string, author: Author) {
    if (
      (await manager.countBy(ArtifactCommentThread, { artifactKind: KIND, artifactId: id })) >=
      COMMENT_LIMITS.threadsPerReport
    )
      throw new CommentLimitException('댓글 스레드는 보고서당 500개까지입니다.');
    if (
      author.authorKind === 'ai' &&
      (await manager.countBy(ArtifactCommentThread, {
        artifactKind: KIND,
        artifactId: id,
        authorKind: 'ai',
        status: 'open',
      })) >= COMMENT_LIMITS.openAiThreadsPerReport
    )
      throw new CommentLimitException('AI가 연 열린 스레드는 보고서당 100개까지입니다.');
  }
  private async limitComments(manager: EntityManager, threadId: string) {
    if ((await manager.countBy(ArtifactComment, { threadId })) >= COMMENT_LIMITS.commentsPerThread)
      throw new CommentLimitException('댓글은 스레드당 200개까지입니다.');
  }
  /** UTF-8 bytes of comment bodies and suggestion text already stored for the report. */
  private async limitText(manager: EntityManager, id: string, adding: number) {
    const bytes = (column: string) =>
      manager.connection.options.type === 'postgres'
        ? `octet_length(${column})`
        : `length(CAST(${column} AS BLOB))`;
    const comments = await manager
      .createQueryBuilder(ArtifactComment, 'c')
      .innerJoin(ArtifactCommentThread, 't', '"t"."id" = "c"."threadId"')
      .select(`COALESCE(SUM(${bytes('"c"."body"')}), 0)`, 'total')
      .where('"t"."artifactKind" = :kind AND "t"."artifactId" = :id', { kind: KIND, id })
      .getRawOne<{ total: string | number }>();
    const suggestions = await manager
      .createQueryBuilder(ArtifactSuggestion, 's')
      .select(
        `COALESCE(SUM(${bytes('"s"."replacement"')} + COALESCE(${bytes(
          '"s"."rationale"',
        )}, 0)), 0)`,
        'total',
      )
      .where('"s"."artifactId" = :id', { id })
      .getRawOne<{ total: string | number }>();
    if (
      Number(comments?.total ?? 0) + Number(suggestions?.total ?? 0) + adding >
      COMMENT_LIMITS.textBytesPerReport
    )
      throw new CommentLimitException('보고서의 댓글과 제안은 합계 2MiB까지 저장할 수 있습니다.');
  }
  private async insertThread(
    { manager, author, now, access }: WriteContext,
    actor: ReportActor,
    version: number,
    anchor: ReportAnchor,
  ) {
    const threadId = randomUUID();
    await manager.insert(ArtifactCommentThread, {
      id: threadId,
      artifactKind: KIND,
      artifactId: access.head.id,
      version,
      ...anchorColumns(anchor),
      status: 'open',
      statusVersion: 0,
      createdBy: actor.id,
      ...author,
      createdAt: now,
      resolvedBy: null,
      resolvedAt: null,
    });
    return threadId;
  }
  private async insertComment(
    manager: EntityManager,
    threadId: string,
    actor: ReportActor,
    author: Author,
    body: string,
    now: string,
  ) {
    const commentId = randomUUID();
    await manager.insert(ArtifactComment, {
      id: commentId,
      threadId,
      authorId: actor.id,
      ...author,
      body,
      createdAt: now,
    });
    return commentId;
  }

  /** Owner: every thread. Recipient: threads they started; suggestions up to their pinned version. */
  private async views(
    manager: EntityManager,
    access: Access,
    actor: ReportActor,
    onlyThreadId?: string,
  ): Promise<ThreadView[]> {
    const recipient = access.role !== 'owner';
    const threads = await manager.find(ArtifactCommentThread, {
      where: {
        artifactKind: KIND,
        artifactId: access.head.id,
        ...(recipient ? { createdBy: actor.id } : {}),
        ...(onlyThreadId ? { id: onlyThreadId } : {}),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    if (!threads.length) return [];
    const threadIds = threads.map(thread => thread.id);
    const comments = await manager.find(ArtifactComment, {
      where: { threadId: In(threadIds) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const suggestions = await manager.find(ArtifactSuggestion, {
      where: {
        artifactId: access.head.id,
        threadId: In(threadIds),
        ...(recipient ? { baseVersion: LessThanOrEqual(access.version) } : {}),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const userIds = new Set<number>();
    for (const thread of threads) {
      userIds.add(thread.createdBy);
      if (thread.resolvedBy !== null) userIds.add(thread.resolvedBy);
    }
    for (const comment of comments) userIds.add(comment.authorId);
    for (const suggestion of suggestions) userIds.add(suggestion.createdBy);
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
    const text = documentText(access.report.blocks, access.report.body);
    return threads.map(thread => {
      const anchor = anchorOf(thread);
      return {
        id: thread.id,
        version: thread.version,
        anchor,
        location: locateAnchor(anchor, text, access.report.blocks),
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
        suggestions: suggestions
          .filter(suggestion => suggestion.threadId === thread.id)
          .map(suggestion => {
            const anchor = textAnchorOf(suggestion);
            return {
              id: suggestion.id,
              baseVersion: suggestion.baseVersion,
              anchor,
              location: locate(anchor, text),
              replacement: suggestion.replacement,
              rationale: suggestion.rationale,
              status: suggestion.status as SuggestionStatus,
              statusVersion: suggestion.statusVersion,
              createdAt: suggestion.createdAt,
              author: author(suggestion.createdBy, suggestion.authorKind, suggestion.aiClientName),
              mine: suggestion.createdBy === actor.id,
              decidedAt: suggestion.decidedAt,
              appliedVersion: suggestion.appliedVersion,
            };
          }),
      };
    });
  }
}
