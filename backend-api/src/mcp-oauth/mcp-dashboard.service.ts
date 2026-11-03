import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  DashboardCommentOptions,
  DashboardCommentService,
} from '../dashboard/dashboard-comment.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { PersonalLibraryState } from '../dashboard/entities/personal-library-state.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import type { McpScope } from './config';
import { McpOAuthPrincipal, McpOAuthService } from './mcp-oauth.service';

const DASHBOARD_PAGE = 50;
const COMMENT_PAGE_BYTES = 192 * 1024;

/**
 * Dashboards for an external AI: an allowlisted list, the chart structure and comments. Every
 * dashboard must belong to the grant's organization (its single mapped owner's membership); the
 * comment service re-checks that on the locked row inside each read or write transaction.
 */
@Injectable()
export class McpDashboardService {
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly comments: DashboardCommentService,
    private readonly auth: McpOAuthService,
  ) {}

  private actor(principal: McpOAuthPrincipal) {
    return { id: principal.actorId, authVersion: principal.authVersion };
  }

  private write(principal: McpOAuthPrincipal, scopes: McpScope[]): DashboardCommentOptions {
    return {
      beforeAccess: async manager => {
        await this.auth.assertGrant(manager, principal, scopes);
      },
      ai: { grantId: principal.grantId, clientName: principal.clientName },
      expectedOrganizationId: principal.organizationId,
    };
  }

  /**
   * Candidates are the actor's own dashboards and policy grants, narrowed in SQL to live,
   * ungoverned dashboards whose single owner is in the grant's organization, then each one passes
   * the same read check as the web list. nextAfterId is the last id examined, so a page emptied
   * by that check can still have a next page.
   */
  async list(principal: McpOAuthPrincipal, afterId: number) {
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
      .take(DASHBOARD_PAGE + 1)
      .getMany();
    const examined = rows.slice(0, DASHBOARD_PAGE);
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
      nextAfterId: rows.length > DASHBOARD_PAGE ? examined[examined.length - 1].id : null,
    };
  }

  read(principal: McpOAuthPrincipal, dashboardId: number) {
    return this.comments.outline(String(dashboardId), this.actor(principal), {
      expectedOrganizationId: principal.organizationId,
    });
  }

  async threads(principal: McpOAuthPrincipal, dashboardId: number, threadOffset: number) {
    const result = await this.comments.list(String(dashboardId), this.actor(principal), {
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
      this.actor(principal),
      this.write(principal, ['dashboards:read', 'comments:write']),
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
      this.actor(principal),
      this.write(principal, ['dashboards:read', 'comments:write']),
    );
  }
}
