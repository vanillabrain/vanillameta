import { serializedViewWrite } from '../dashboard/view-write-queue';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiService } from './bi.service';
import { buildReuseRecipe, readReuseRecipe } from './reuse-recipe';

export type ReuseReference = { kind: 'share' | 'publication'; key: string; revision: string };
const unavailable = () =>
  new NotFoundException('재사용이 허용되지 않았거나 중지·만료된 링크입니다.');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
@Injectable()
export class SharedReuseOriginService {
  constructor(
    private readonly db: DataSource,
    private readonly ai: AiDashboardService,
    private readonly bi: BiService,
    private readonly access: SourceAccessService,
  ) {}
  private kind(value: string): 'share' | 'publication' {
    if (value !== 'share' && value !== 'publication') throw unavailable();
    return value;
  }
  async resolve(kind: string, key: string, manager: EntityManager = this.db.manager) {
    this.kind(kind);
    if (!UUID.test(key)) throw unavailable();
    const lock =
      manager.queryRunner?.isTransactionActive && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    let dashboard: Dashboard, recipe: string, identity: any;
    if (kind === 'publication') {
      const row = await manager.findOne(DashboardPublication, { where: { uuid: key }, ...lock });
      if (!row?.active || !row.reuseDefinition || !(Date.parse(row.expiresAt) > Date.now()))
        throw unavailable();
      dashboard = await manager.findOne(Dashboard, { where: { id: row.dashboardId }, ...lock });
      recipe = row.reuseDefinition;
      identity = [kind, key, row.version, row.dashboardRevision, row.expiresAt, recipe];
    } else {
      const row = await manager.findOne(DashboardShare, { where: { uuid: key }, ...lock });
      if (
        !row?.allowReuse ||
        row.shareYn !== 'Y' ||
        !(new Date(row.endDate).getTime() > Date.now())
      )
        throw unavailable();
      dashboard = await manager.findOne(Dashboard, {
        where: { shareId: (row as DashboardShare).id },
        ...lock,
      });
      if (!dashboard || dashboard.delYn === 'Y' || !dashboard.analysisDefinition)
        throw unavailable();
      // Resolve schema/definition as the owner; no original result preview is executed for a recipient.
      const owner = await this.access.sharedDashboard(dashboard.id);
      const analysis = (await this.ai.analysis(dashboard.id, owner, true)).data;
      const profile = await this.bi.profile(analysis.databaseId, owner);
      recipe = buildReuseRecipe(analysis, profile);
      identity = [kind, key, row.reuseVersion, row.endDate, dashboardRevision(dashboard), recipe];
    }
    if (!dashboard || dashboard.delYn === 'Y' || dashboard.governed) throw unavailable();
    const { analysis, profile } = readReuseRecipe(recipe);
    const revision = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    return {
      originalId: dashboard.id,
      analysis: { ...analysis, revision },
      profile,
      reference: { kind: this.kind(kind), key, revision } as ReuseReference,
    };
  }
  async current(reference: ReuseReference, manager: EntityManager) {
    const value = await this.resolve(reference.kind, reference.key, manager);
    if (value.reference.revision !== reference.revision) throw unavailable();
  }
  async status(kind: string, key: string) {
    // No recipe/SQL/source IDs in an anonymous response. Unavailable links are indistinguishable.
    this.kind(kind);
    if (!UUID.test(key)) return { reusable: false };
    const row =
      kind === 'publication'
        ? await this.db.manager.findOne(DashboardPublication, { where: { uuid: key } })
        : await this.db.manager.findOne(DashboardShare, { where: { uuid: key } });
    const active =
      kind === 'publication'
        ? (row as DashboardPublication)?.active && !!(row as DashboardPublication)?.reuseDefinition
        : (row as DashboardShare)?.shareYn === 'Y' && (row as DashboardShare)?.allowReuse;
    const expiry =
      kind === 'publication'
        ? (row as DashboardPublication)?.expiresAt
        : (row as DashboardShare)?.endDate;
    if (!row || !active || !(new Date(expiry).getTime() > Date.now())) return { reusable: false };
    const dashboard = await this.db.manager.findOne(Dashboard, {
      where:
        kind === 'publication'
          ? { id: (row as DashboardPublication).dashboardId }
          : { shareId: (row as DashboardShare).id },
    });
    return { reusable: !!dashboard && dashboard.delYn !== 'Y' && !dashboard.governed };
  }
  async grant(id: unknown, actor: number, body?: any) {
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor);
    const dashboard = await this.db.manager.findOne(Dashboard, { where: { id: dashboardId } });
    if (dashboard.governed && body?.allowReuse === true) throw unavailable();
    const share = await this.db.manager.findOne(DashboardShare, {
      where: { id: dashboard.shareId },
    });
    if (!share) throw unavailable();
    if (body !== undefined) {
      if (!body || Object.keys(body).length !== 1 || typeof body.allowReuse !== 'boolean')
        throw new BadRequestException('재사용 허용 설정을 확인해 주세요.');
      await serializedViewWrite(this.db.getRepository(DashboardShare), () =>
        this.db.manager
          .createQueryBuilder()
          .update(DashboardShare)
          .set({ allowReuse: body.allowReuse, reuseVersion: () => 'reuseVersion + 1' })
          .where('id = :id', { id: share.id })
          .execute(),
      );
      return { allowReuse: body.allowReuse };
    }
    return { allowReuse: share.allowReuse === true };
  }
}
