import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';
import {
  DashboardCommentOptions,
  DashboardCommentService,
} from '../dashboard/dashboard-comment.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { PersonalLibraryState } from '../dashboard/entities/personal-library-state.entity';
import { DashboardDeletionService } from '../dashboard/dashboard-deletion.service';
import { DashboardDeleteReceipt } from '../dashboard/entities/dashboard-delete-receipt.entity';
import { DashboardRevision } from '../dashboard-studio/entities/dashboard-revision.entity';
import { StudioCreationService } from '../dashboard-studio/studio-creation.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { Database } from '../database/entities/database.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import type { McpScope } from './config';
import { MCP_SCOPE_POLICY } from './scope-policy';
import { assertGradeAllows } from './grade';
import { applyChanges, cleanChanges } from './mcp-dashboard.changes';
import { DashboardToolException, toDashboardFailure } from './mcp-dashboard.errors';
import { ActorWindowLimiter, DASHBOARD_LIMITS } from './mcp-dashboard.limits';
import { McpOAuthPrincipal, McpOAuthService } from './mcp-oauth.service';

const LIST_PAGE = 50;
const COMMENTABLE_PAGE = 50;
const COMMENT_PAGE_BYTES = 192 * 1024;
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
    private readonly deletion: DashboardDeletionService,
    private readonly access: SourceAccessService,
    private readonly comments: DashboardCommentService,
  ) {}

  /**
   * Scope, then a live token and membership, then the grade; each is read on every call. Several
   * scopes (a comment tool needs dashboards:read and a comment scope) must all be approved and each
   * one's grade capability must be allowed.
   */
  private async begin(principal: McpOAuthPrincipal, scope: McpScope | McpScope[]) {
    const scopes = Array.isArray(scope) ? scope : [scope];
    if (!scopes.length || scopes.some(item => !principal.scopes.includes(item)))
      throw new ForbiddenException();
    await this.auth.revalidate(principal);
    for (const item of scopes)
      await assertGradeAllows(this.db.manager, principal, MCP_SCOPE_POLICY[item].capability);
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
  async read(
    principal: McpOAuthPrincipal,
    dashboardId: unknown,
    historyBefore: unknown = undefined,
  ) {
    await this.begin(principal, 'dashboards:read');
    const id = this.dashboardId(dashboardId);
    // `seq` of the oldest row of the page before: the history is read newest first, a page at a time.
    if (
      historyBefore !== undefined &&
      (!Number.isSafeInteger(historyBefore) || (historyBefore as number) <= 0)
    )
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    await this.policy.assertSoleOwner(id, principal.actorId);
    const state = await this.studio.readDocument(id, principal.actorId);
    const history = await this.db.getRepository(DashboardRevision).find({
      where: {
        dashboardId: id,
        ...(historyBefore === undefined ? {} : { seq: LessThan(historyBefore as number) }),
      },
      order: { seq: 'DESC' },
      take: HISTORY_PAGE + 1,
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
      history: history.slice(0, HISTORY_PAGE).map(row => ({
        seq: row.seq,
        revisionId: row.revisionId,
        createdAt: row.createdAt,
        operation: row.operation,
        authorKind: row.authorKind,
        ...(row.authorKind === 'external-ai' ? { clientName: row.aiClientName } : {}),
        // A baseline is a state kept before an AI write, whoever made it; it is nobody's save.
        ...(row.operation === 'baseline' ? {} : { byYou: row.actorId === principal.actorId }),
        isCurrent: row.revision === state.document.revision,
      })),
      // Pass this as `historyBefore` for the next older page; null when there is no older row.
      historyNext: history.length > HISTORY_PAGE ? (history[HISTORY_PAGE - 1].seq as number) : null,
    };
  }

  /**
   * The saved metrics a dashboard can be built from, on a source the account owns: what a block's
   * `metric: {id, definitionVersion}` names. Only what is needed to choose one is returned. The
   * business basis and the nested definitions of a formula, which hold text people wrote, stay on the
   * server; the label is still text someone wrote and is untrusted. Pages of 50 by id.
   */
  async metrics(principal: McpOAuthPrincipal, sourceId: unknown, afterId: unknown = 0) {
    await this.begin(principal, 'dashboards:write');
    if (!Number.isSafeInteger(afterId) || (afterId as number) < 0)
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    await this.ownedSource(sourceId, principal.actorId);
    const catalog = await this.creation.specCatalog(sourceId as number, principal.actorId);
    // Ownership may have moved while the catalog was read.
    await this.ownedSource(sourceId, principal.actorId);
    await this.auth.revalidate(principal);
    const rows = catalog
      .filter(metric => metric.id > (afterId as number))
      .sort((a, b) => a.id - b.id)
      .slice(0, LIST_PAGE + 1);
    const visible = rows.slice(0, LIST_PAGE);
    return {
      sourceId: sourceId as number,
      metrics: visible.map(({ id, definitionVersion, definition }) => ({
        id,
        definitionVersion,
        label: definition.label,
        aggregation: definition.aggregation,
        column: definition.column,
        ...(definition.denominatorColumn
          ? { denominatorColumn: definition.denominatorColumn }
          : {}),
        ...(definition.weightColumn ? { weightColumn: definition.weightColumn } : {}),
        ...(definition.scale !== undefined ? { scale: definition.scale } : {}),
        unit: definition.unit,
        decimalPlaces: definition.decimalPlaces,
        numberNotation: definition.numberNotation,
      })),
      nextAfterId: rows.length > LIST_PAGE ? visible[visible.length - 1].id : null,
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
    // No check after the commit: the grant and the grade were read inside the writing transaction,
    // and a failure here would report a write that happened as one that did not.
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
          MCP_SCOPE_POLICY['dashboards:write'].capability,
        );
      },
    };
  }

  /** What still uses a dashboard, and the revision a removal must name. The deletion service answers. */
  async removalImpact(principal: McpOAuthPrincipal, dashboardId: unknown) {
    await this.begin(principal, 'dashboards:delete');
    const id = this.dashboardId(dashboardId);
    await this.policy.assertSoleOwner(id, principal.actorId);
    const { data } = await this.deletion
      .impact(id, principal.actorId, principal.authVersion)
      .catch(error => {
        throw toDashboardFailure(error);
      });
    await this.auth.revalidate(principal);
    return {
      dashboardId: id,
      revision: data.revision,
      canDelete: data.canDelete,
      dependencies: data.dependencies,
    };
  }

  /**
   * Deletes a dashboard the account alone owns, when nothing uses it (no share, permission, delivery
   * or publication) and its revision is the one `removalImpact` returned. The comments and history
   * go with it. A repeated request ID returns the first answer, even though the dashboard is gone.
   */
  async remove(principal: McpOAuthPrincipal, input: any) {
    await this.begin(principal, 'dashboards:delete');
    if (typeof input?.requestId !== 'string' || !UUID_V4.test(input.requestId))
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    const id = this.dashboardId(input.dashboardId);
    if (!HEX64.test(input.expectedRevision))
      throw new DashboardToolException('INVALID', 'INVALID_INPUT');
    this.limiter.take(
      principal.actorId,
      'delete',
      DASHBOARD_LIMITS.delete.limit,
      DASHBOARD_LIMITS.delete.windowMs,
    );
    // After a deletion the dashboard is gone, so a retry is recognised by its receipt; any other call
    // must be about a dashboard the account alone owns and can still open.
    const receipt = await this.db
      .getRepository(DashboardDeleteReceipt)
      .findOneBy({ actorId: principal.actorId, requestId: input.requestId });
    if (!receipt) await this.policy.assertSoleOwner(id, principal.actorId);
    const result = await this.deletion
      .remove(
        id,
        principal.actorId,
        {
          requestId: input.requestId,
          expectedRevision: input.expectedRevision,
          expectedActorId: principal.actorId,
          expectedOrganizationId: principal.organizationId ?? null,
        },
        principal.authVersion,
        {
          byConnection: true,
          // Read under the deleting transaction's lock: a revoked or demoted connection deletes nothing.
          beforeAccess: async manager => {
            await this.auth.assertGrant(manager, principal, 'dashboards:delete');
            await assertGradeAllows(
              manager,
              principal,
              MCP_SCOPE_POLICY['dashboards:delete'].capability,
            );
          },
        },
      )
      .catch(error => {
        throw toDashboardFailure(error);
      });
    // No check after the commit: the grant and the grade were read inside the writing transaction,
    // and a failure here would report a write that happened as one that did not.
    return { dashboardId: id, deleted: true, replayed: result.data.replayed };
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
    // No check after the commit: the grant and the grade were read inside the writing transaction,
    // and a failure here would report a write that happened as one that did not.
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
    // No check after the commit: the grant and the grade were read inside the writing transaction,
    // and a failure here would report a write that happened as one that did not.
    return { dashboardId: id, revision: result.document.revision as string, changed: true };
  }

  // ---- Dashboard comments (read the structure and write comments on dashboards one can read) ----

  private commentActor(principal: McpOAuthPrincipal) {
    return { id: principal.actorId, authVersion: principal.authVersion };
  }

  private commentWrite(principal: McpOAuthPrincipal, scopes: McpScope[]): DashboardCommentOptions {
    return {
      beforeAccess: async manager => {
        await this.auth.assertGrant(manager, principal, scopes);
        // The grade is read inside the writing transaction, like the report comment tools do.
        for (const item of scopes)
          await assertGradeAllows(manager, principal, MCP_SCOPE_POLICY[item].capability);
      },
      ai: { grantId: principal.grantId, clientName: principal.clientName },
      expectedOrganizationId: principal.organizationId,
    };
  }

  /**
   * Dashboards a person can comment on: their own plus those shared with them (not only ones they made, which
   * `list` returns). Candidates are the actor's own dashboards and policy grants, narrowed in SQL to live,
   * ungoverned dashboards whose single owner is in the grant's organization, then each one passes
   * the same read check as the web list. nextAfterId is the last id examined, so a page emptied
   * by that check can still have a next page.
   */
  async listCommentable(principal: McpOAuthPrincipal, afterId: number) {
    await this.begin(principal, 'dashboards:read');
    const grants = await this.access.readableDashboardIds(principal.actorId);
    const owners = this.db
      .getRepository(UserMapping)
      .createQueryBuilder('owner')
      .select('owner.dashboardId')
      .groupBy('owner.dashboardId')
      .having('COUNT(*) = 1');
    const rows = await this.db
      .getRepository(Dashboard)
      .createQueryBuilder('dashboard')
      .innerJoin(UserMapping, 'mapping', 'mapping.dashboardId = dashboard.id')
      .innerJoin(EnterpriseMembership, 'membership', 'membership.userId = mapping.userInfoId')
      .where(`dashboard.id IN (${owners.getQuery()})`)
      .andWhere('membership.organizationId = :org', { org: principal.organizationId })
      .andWhere('dashboard.id > :after', { after: afterId })
      .andWhere("dashboard.delYn <> 'Y'")
      .andWhere('dashboard.assetActive = :active', { active: true })
      .andWhere('dashboard.governed = :governed', { governed: false })
      .andWhere(
        grants.length
          ? '(mapping.userInfoId = :actor OR dashboard.id IN (:...grants))'
          : 'mapping.userInfoId = :actor',
        { actor: principal.actorId, grants },
      )
      .select(['dashboard.id', 'dashboard.title', 'dashboard.updatedAt'])
      .orderBy('dashboard.id', 'ASC')
      .take(COMMENTABLE_PAGE + 1)
      .getMany();
    const examined = rows.slice(0, COMMENTABLE_PAGE);
    const visible: typeof examined = [];
    for (const row of examined)
      try {
        await this.access.dashboard(row.id, principal.actorId, 'read');
        visible.push(row);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    const archived = new Set(
      visible.length
        ? (
            await this.db.manager.find(PersonalLibraryState, {
              where: {
                userId: principal.actorId,
                organizationId: principal.organizationId,
                dashboardId: In(visible.map(row => row.id)),
                archived: true,
              },
            })
          ).map(state => state.dashboardId)
        : [],
    );
    return {
      dashboards: visible.map(row => ({
        dashboardId: row.id,
        title: row.title,
        updatedAt: row.updatedAt,
        archived: archived.has(row.id),
      })),
      nextAfterId: rows.length > COMMENTABLE_PAGE ? examined[examined.length - 1].id : null,
    };
  }

  async outline(principal: McpOAuthPrincipal, dashboardId: number) {
    await this.begin(principal, 'dashboards:read');
    return this.comments.outline(String(dashboardId), this.commentActor(principal), {
      expectedOrganizationId: principal.organizationId,
    });
  }

  async threads(principal: McpOAuthPrincipal, dashboardId: number, threadOffset: number) {
    await this.begin(principal, ['dashboards:read', 'comments:read']);
    const result = await this.comments.list(String(dashboardId), this.commentActor(principal), {
      expectedOrganizationId: principal.organizationId,
    });
    const page: typeof result.threads = [];
    let bytes = 0;
    for (const thread of result.threads.slice(threadOffset)) {
      const size = Buffer.byteLength(JSON.stringify(thread));
      if (page.length && bytes + size > COMMENT_PAGE_BYTES) break;
      page.push(thread);
      bytes += size;
    }
    const next = threadOffset + page.length;
    return {
      dashboardId,
      revision: result.revision,
      canManage: result.canManage,
      blockAnchors: result.blockAnchors,
      threadOffset,
      totalThreads: result.threads.length,
      nextThreadOffset: next < result.threads.length ? next : null,
      threads: page,
    };
  }

  addComment(
    principal: McpOAuthPrincipal,
    input: {
      dashboardId: number;
      revision: string;
      anchor: { kind: 'whole' } | { kind: 'block'; blockId: string };
      body: string;
      requestId: string;
    },
  ) {
    return this.comments.createThread(
      String(input.dashboardId),
      {
        requestId: input.requestId,
        revision: input.revision,
        anchor: input.anchor,
        body: input.body,
      },
      this.commentActor(principal),
      this.commentWrite(principal, ['dashboards:read', 'comments:write']),
    );
  }

  reply(
    principal: McpOAuthPrincipal,
    input: { dashboardId: number; threadId: string; body: string; requestId: string },
  ) {
    return this.comments.reply(
      String(input.dashboardId),
      input.threadId,
      { requestId: input.requestId, body: input.body },
      this.commentActor(principal),
      this.commentWrite(principal, ['dashboards:read', 'comments:write']),
    );
  }
}
