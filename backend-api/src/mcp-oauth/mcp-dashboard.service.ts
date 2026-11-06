import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardRevision } from '../dashboard-studio/entities/dashboard-revision.entity';
import { StudioCreationService } from '../dashboard-studio/studio-creation.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { Database } from '../database/entities/database.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DASHBOARD_SCOPE_POLICY, DashboardScope } from './dashboard-scope';
import { assertGradeAllows } from './grade';
import { applyChanges, cleanChanges } from './mcp-dashboard.changes';
import { DashboardToolException, toDashboardFailure } from './mcp-dashboard.errors';
import { ActorWindowLimiter, DASHBOARD_LIMITS } from './mcp-dashboard.limits';
import { McpOAuthPrincipal, McpOAuthService } from './mcp-oauth.service';

const LIST_PAGE = 50;
const HISTORY_PAGE = 20;
const PREVIEW_ROWS = 100;
const HEX64 = /^[a-f0-9]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The dashboard tools' logic, before they are registered as tools. Every call is a connection acting
 * for one account on dashboards that account made: the checks are the grade, the scope, and
 * `assertSoleOwner` (no grants, no organization admin). Writes go through the Studio services that
 * people use, so a dashboard an AI creates is saved, validated and journaled the same way.
 */
@Injectable()
export class McpDashboardService {
  /** Replaceable so a test can drive the clock. */
  limiter = new ActorWindowLimiter();

  constructor(
    private readonly db: DataSource,
    private readonly policy: EnterpriseResourcePolicyService,
    private readonly studio: StudioService,
    private readonly creation: StudioCreationService,
    private readonly auth: McpOAuthService,
  ) {}

  /** Scope, then a live token and membership, then the grade; each is read on every call. */
  private async begin(principal: McpOAuthPrincipal, scope: DashboardScope) {
    if (!principal.scopes.includes(scope)) throw new ForbiddenException();
    await this.auth.revalidate(principal);
    await assertGradeAllows(this.db.manager, principal, DASHBOARD_SCOPE_POLICY[scope].capability);
  }

  private dashboardId(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) <= 0)
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    return value as number;
  }

  /** A connection builds only from sources its account owns, not from ones shared with it. */
  private async ownedSource(sourceId: unknown, actor: number) {
    if (!Number.isSafeInteger(sourceId) || (sourceId as number) <= 0)
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    const source = await this.db.manager.findOne(Database, {
      where: { id: sourceId as number },
      select: { id: true, ownerId: true, catalogActive: true },
    });
    if (!source || source.ownerId !== actor || source.catalogActive === false)
      throw new ForbiddenException();
  }

  /**
   * Only blocks that point at a saved metric. A block with a new definition or a formula would make
   * the creation insert a Metric row, which the caller may not do; refuse it before the kernel
   * sees it (the kernel asserts the same, as a second line).
   */
  private storedMetricBlocks(blocks: unknown) {
    if (!Array.isArray(blocks)) throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    for (const block of blocks) {
      const id = block?.metric?.id;
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE');
    }
  }

  /** The dashboards this account made and can still open, oldest id first. */
  async list(principal: McpOAuthPrincipal, afterId: unknown = 0) {
    await this.begin(principal, 'dashboards:read');
    if (!Number.isSafeInteger(afterId) || (afterId as number) < 0)
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    // The same conditions as assertSoleOwner: one owning row, the caller, not deleted, active.
    const rows = await this.db
      .getRepository(Dashboard)
      .createQueryBuilder('dashboard')
      .innerJoin(UserMapping, 'mapping', 'mapping.dashboardId = dashboard.id')
      .where('mapping.userInfoId = :actor', { actor: principal.actorId })
      .andWhere('dashboard.delYn = :live', { live: 'N' })
      .andWhere('dashboard.assetActive = :active', { active: true })
      .andWhere('dashboard.id > :after', { after: afterId })
      .andWhere(
        '(SELECT COUNT(*) FROM "user_mapping" owning WHERE owning."dashboardId" = dashboard.id) = 1',
      )
      .select(['dashboard.id', 'dashboard.title'])
      .orderBy('dashboard.id', 'ASC')
      .take(LIST_PAGE + 1)
      .getMany();
    await this.auth.revalidate(principal);
    const visible = rows.slice(0, LIST_PAGE);
    return {
      dashboards: visible.map(({ id, title }) => ({ dashboardId: id, title })),
      nextAfterId: rows.length > LIST_PAGE ? visible[visible.length - 1].id : null,
    };
  }

  /**
   * The saved document and how it got here. A history row says who saved that state, not what
   * changed between states, so the summary carries no diff. The stored documents, the account ids
   * and the grant ids of the rows stay on the server; a restore reads the document itself.
   */
  async read(principal: McpOAuthPrincipal, dashboardId: unknown) {
    await this.begin(principal, 'dashboards:read');
    const id = this.dashboardId(dashboardId);
    await this.policy.assertSoleOwner(id, principal.actorId);
    const state = await this.studio.readDocument(id, principal.actorId);
    const history = await this.db.getRepository(DashboardRevision).find({
      where: { dashboardId: id },
      order: { seq: 'DESC' },
      take: HISTORY_PAGE,
      select: {
        seq: true,
        revisionId: true,
        revision: true,
        createdAt: true,
        operation: true,
        authorKind: true,
        aiClientName: true,
        actorId: true,
      },
    });
    // Ownership may have moved while the document was read.
    await this.policy.assertSoleOwner(id, principal.actorId);
    await this.auth.revalidate(principal);
    return {
      dashboardId: id,
      title: state.document.title,
      sourceName: state.sourceName,
      revision: state.document.revision,
      sourceRevision: state.sourceRevision,
      document: state.document,
      history: history.map(row => ({
        revisionId: row.revisionId,
        createdAt: row.createdAt,
        operation: row.operation,
        authorKind: row.authorKind,
        ...(row.authorKind === 'external-ai' ? { clientName: row.aiClientName } : {}),
        // A baseline is a state kept before an AI write, whoever made it; it is nobody's save.
        ...(row.operation === 'baseline' ? {} : { byYou: row.actorId === principal.actorId }),
        isCurrent: row.revision === state.document.revision,
      })),
    };
  }

  /** Computes a dashboard from saved metrics and saves nothing. */
  async preview(principal: McpOAuthPrincipal, input: any) {
    await this.begin(principal, 'dashboards:write');
    this.limiter.take(
      principal.actorId,
      'preview',
      DASHBOARD_LIMITS.preview.limit,
      DASHBOARD_LIMITS.preview.windowMs,
    );
    await this.ownedSource(input?.sourceId, principal.actorId);
    this.storedMetricBlocks(input?.blocks);
    const result = await this.creation
      .previewSpec(
        { sourceId: input.sourceId, title: input.title, blocks: input.blocks },
        principal.actorId,
        principal.authVersion,
      )
      .catch(error => {
        throw toDashboardFailure(error);
      });
    await this.auth.revalidate(principal);
    return {
      previewDigest: result.previewDigest,
      sourceRevision: result.sourceRevision,
      // The query text the preview ran stays on the server.
      blocks: (result.preview.widgets as any[]).map((widget, index) => ({
        index,
        title: widget.title,
        type: widget.type,
        valueField: widget.valueField,
        categoryField: widget.categoryField,
        prefix: widget.prefix,
        suffix: widget.suffix,
        rowCount: (widget.datas ?? []).length,
        truncated: (widget.datas ?? []).length > PREVIEW_ROWS,
        rows: ((widget.datas ?? []) as any[]).slice(0, PREVIEW_ROWS).map(row => ({
          [widget.valueField]: row[widget.valueField],
          ...(widget.categoryField ? { [widget.categoryField]: row[widget.categoryField] } : {}),
        })),
      })),
    };
  }

  /**
   * Saves a dashboard the preview showed. The spec is sent again with the preview's digest; the
   * server recomputes and refuses (PREVIEW_STALE) if the data or a metric moved. The same
   * `requestId` with the same input returns the dashboard already made.
   */
  async create(principal: McpOAuthPrincipal, input: any) {
    await this.begin(principal, 'dashboards:write');
    if (typeof input?.requestId !== 'string' || !UUID_V4.test(input.requestId))
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    this.limiter.take(
      principal.actorId,
      'write',
      DASHBOARD_LIMITS.write.limit,
      DASHBOARD_LIMITS.write.windowMs,
    );
    this.limiter.take(
      principal.actorId,
      'create',
      DASHBOARD_LIMITS.create.limit,
      DASHBOARD_LIMITS.create.windowMs,
    );
    await this.ownedSource(input.sourceId, principal.actorId);
    this.storedMetricBlocks(input.blocks);
    const result = await this.creation
      .createFromSpec(
        {
          sourceId: input.sourceId,
          title: input.title,
          blocks: input.blocks,
          previewDigest: input.previewDigest,
          expectedSourceRevision: input.expectedSourceRevision,
          requestId: input.requestId,
        },
        principal.actorId,
        principal.authVersion,
        this.writeOptions(principal),
      )
      .catch(error => {
        throw toDashboardFailure(error);
      });
    await this.auth.revalidate(principal);
    return { dashboardId: result.dashboardId, revision: result.document.revision };
  }

  /** The author and the in-transaction checks of every write a connection makes. */
  private writeOptions(principal: McpOAuthPrincipal) {
    return {
      author: {
        kind: 'external-ai' as const,
        grantId: principal.grantId,
        clientName: principal.clientName,
      },
      // Read under the save's own lock: a connection revoked or demoted while this waited cannot write.
      beforeAccess: async (manager: EntityManager) => {
        await this.auth.assertGrant(manager, principal, 'dashboards:write');
        await assertGradeAllows(
          manager,
          principal,
          DASHBOARD_SCOPE_POLICY['dashboards:write'].capability,
        );
      },
    };
  }

  /**
   * Changes a saved dashboard's text, layout, display and filters, or removes a block. The request is
   * named by its own input (not by the document it produces), so a retry after the dashboard moved on
   * still gets the first answer, and the same ID with other input is REQUEST_REUSED. A change list
   * that leaves the dashboard as it is saves nothing.
   */
  async update(principal: McpOAuthPrincipal, input: any) {
    await this.begin(principal, 'dashboards:write');
    if (typeof input?.requestId !== 'string' || !UUID_V4.test(input.requestId))
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    const id = this.dashboardId(input.dashboardId);
    if (!HEX64.test(input.expectedRevision) || !HEX64.test(input.expectedSourceRevision))
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    const changes = cleanChanges(input.changes);
    this.limiter.take(
      principal.actorId,
      'write',
      DASHBOARD_LIMITS.write.limit,
      DASHBOARD_LIMITS.write.windowMs,
    );
    const key = {
      kind: 'mcp-dashboard-update',
      id,
      expectedRevision: input.expectedRevision,
      expectedSourceRevision: input.expectedSourceRevision,
      changes,
    };
    await this.policy.assertSoleOwner(id, principal.actorId);
    const earlier = await this.studio
      .replayRecord(principal.actorId, input.requestId, studioDigest(key))
      .catch(error => {
        throw toDashboardFailure(error);
      });
    if (earlier) {
      await this.auth.revalidate(principal);
      return { dashboardId: id, revision: earlier.document.revision as string, changed: true };
    }
    const state = await this.studio.readDocument(id, principal.actorId);
    if (state.document.revision !== input.expectedRevision)
      throw new DashboardToolException('CONFLICT', 'REVISION_CHANGED');
    if (state.sourceRevision !== input.expectedSourceRevision)
      throw new DashboardToolException('CONFLICT', 'SOURCE_CHANGED');
    const document = applyChanges(state.document, changes);
    if (studioDigest(document) === studioDigest(state.document)) {
      await this.auth.revalidate(principal);
      return { dashboardId: id, revision: state.document.revision as string, changed: false };
    }
    const result = await this.studio
      .save(
        id,
        {
          requestId: input.requestId,
          expectedRevision: input.expectedRevision,
          expectedSourceRevision: input.expectedSourceRevision,
          document,
        },
        principal.actorId,
        undefined,
        { ...this.writeOptions(principal), payloadKey: key },
      )
      .catch(error => {
        throw toDashboardFailure(error);
      });
    await this.auth.revalidate(principal);
    return { dashboardId: id, revision: result.document.revision as string, changed: true };
  }

  /**
   * Puts a saved state back as a new save (a new history row; nothing is erased). `revisionId` comes
   * from the history `read` returns. The state is rebuilt from the server's own history row, so a
   * block removed since is created again with a new id and its comments stay with the old one. A
   * state the dashboard's metrics or data no longer carry is RESTORE_STALE, which is not retryable.
   */
  async restore(principal: McpOAuthPrincipal, input: any) {
    await this.begin(principal, 'dashboards:write');
    if (
      typeof input?.requestId !== 'string' ||
      !UUID_V4.test(input.requestId) ||
      typeof input.revisionId !== 'string' ||
      !UUID_V4.test(input.revisionId) ||
      !HEX64.test(input.expectedRevision)
    )
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    const id = this.dashboardId(input.dashboardId);
    this.limiter.take(
      principal.actorId,
      'write',
      DASHBOARD_LIMITS.write.limit,
      DASHBOARD_LIMITS.write.windowMs,
    );
    const key = {
      kind: 'mcp-dashboard-restore',
      id,
      revisionId: input.revisionId,
      expectedRevision: input.expectedRevision,
    };
    await this.policy.assertSoleOwner(id, principal.actorId);
    const earlier = await this.studio
      .replayRecord(principal.actorId, input.requestId, studioDigest(key))
      .catch(error => {
        throw toDashboardFailure(error);
      });
    if (earlier) {
      await this.auth.revalidate(principal);
      return { dashboardId: id, revision: earlier.document.revision as string, changed: true };
    }
    // Looked up by dashboard and revision together: another dashboard's history is never reachable.
    const row = await this.db.getRepository(DashboardRevision).findOne({
      where: { dashboardId: id, revisionId: input.revisionId },
      select: { revision: true },
    });
    if (!row) throw new NotFoundException();
    const state = await this.studio.readDocument(id, principal.actorId);
    if (state.document.revision !== input.expectedRevision)
      throw new DashboardToolException('CONFLICT', 'REVISION_CHANGED');
    if (row.revision === state.document.revision) {
      await this.auth.revalidate(principal);
      return { dashboardId: id, revision: state.document.revision as string, changed: false };
    }
    const result = await this.studio
      .restore(
        id,
        {
          requestId: input.requestId,
          revisionId: input.revisionId,
          expectedRevision: input.expectedRevision,
        },
        principal.actorId,
        { ...this.writeOptions(principal), payloadKey: key },
      )
      .catch(error => {
        throw toDashboardFailure(error);
      });
    await this.auth.revalidate(principal);
    return { dashboardId: id, revision: result.document.revision as string, changed: true };
  }
}
