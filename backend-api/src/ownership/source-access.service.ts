import {
  EnterpriseResourcePolicyService,
  ResourceAction,
} from '../enterprise/resource-policy.service';
import { EntityManager } from 'typeorm';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Widget } from '../widget/entities/widget.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';

export type SourceAsset = 'database' | 'dataset' | 'metric' | 'table' | 'widget' | 'dashboard';
const entities = {
  database: Database,
  dataset: Dataset,
  metric: Metric,
  table: TableQuery,
  widget: Widget,
  dashboard: Dashboard,
};
@Injectable()
export class SourceAccessService {
  constructor(
    private readonly db: DataSource,
    private readonly policy?: EnterpriseResourcePolicyService,
  ) {}
  readableSourceIds(actor: number) {
    return this.policy ? this.policy.sourceIds(actor) : Promise.resolve([] as number[]);
  }
  readableDashboardIds(actor: number) {
    return this.policy ? this.policy.dashboardIds(actor) : Promise.resolve([] as number[]);
  }
  async sourceCapabilities(id: number, actor: number) {
    await this.assert('database', id, actor, 'read');
    return this.policy
      ? (await this.policy.capabilities('source', id, actor)).rights
      : { read: true, edit: true, publish: false, export: true };
  }
  async dashboardCapabilities(id: number, actor: number) {
    await this.dashboard(id, actor, 'read');
    return this.policy
      ? (await this.policy.capabilities('dashboard', id, actor)).rights
      : { read: true, edit: true, publish: true, export: true };
  }
  actor(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new ForbiddenException('invalid owner');
    return Number(value);
  }
  id(value: unknown): number {
    const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
    if (!Number.isSafeInteger(n) || Number(n) <= 0)
      throw new BadRequestException('invalid resource id');
    return Number(n);
  }
  async sourceId(
    kind: SourceAsset,
    value: unknown,
    manager: EntityManager = this.db.manager,
  ): Promise<number> {
    const id = this.id(value);
    const row: any = await (manager ?? this.db)
      .getRepository(entities[kind] as any)
      .findOne({ where: { id } });
    if (!row) throw new ForbiddenException('data access denied');
    if (kind === 'database') return row.id;
    if (kind === 'widget') {
      if (![DatasetType.DATASET, DatasetType.TABLE].includes(row.datasetType))
        throw new ForbiddenException('data access denied');
      return this.sourceId(
        row.datasetType === DatasetType.DATASET ? 'dataset' : 'table',
        row.datasetId,
        manager,
      );
    }
    if (!Number.isSafeInteger(row.databaseId) || row.databaseId <= 0)
      throw new ForbiddenException('data access denied');
    return row.databaseId;
  }
  async assert(
    kind: SourceAsset,
    id: unknown,
    actor: number,
    action: ResourceAction | 'owner' = 'owner',
    manager: EntityManager = this.db.manager,
  ): Promise<void> {
    this.actor(actor);
    if (kind === 'dashboard') return this.dashboard(id, actor, action, manager);
    const sourceId = await this.sourceId(kind, id, manager);
    const source = await (manager ?? this.db)
      .getRepository(Database)
      .findOne({ where: { id: sourceId } });
    // NULL legacy owners are locked; an authenticated first reader never acquires them.
    if (!source) throw new ForbiddenException('data access denied');
    if (source.ownerId === actor) {
      if (action !== 'owner' && this.policy)
        return this.policy.assert('source', source.id, actor, action, manager);
      return;
    }
    if (action !== 'owner' && this.policy)
      return this.policy.assert('source', source.id, actor, action, manager);
    throw new ForbiddenException('data access denied: source ownership required');
  }
  async dashboard(
    id: unknown,
    actor: number,
    action: ResourceAction | 'owner' = 'owner',
    manager: EntityManager = this.db.manager,
  ): Promise<void> {
    const dashboardId = this.id(id);
    this.actor(actor);
    const mapping = await (manager ?? this.db)
      .getRepository(UserMapping)
      .findOne({ where: { dashboardId, userInfoId: actor } });
    const dashboard = await (manager ?? this.db)
      .getRepository(Dashboard)
      .findOne({ where: { id: dashboardId } });
    if (!dashboard || dashboard.delYn === 'Y') throw new ForbiddenException('not dashboard owner');
    if (action !== 'owner' && this.policy)
      await this.policy.assert('dashboard', dashboardId, actor, action, manager);
    else if (!mapping) throw new ForbiddenException('not dashboard owner');
    const links = await (manager ?? this.db)
      .getRepository(DashboardWidget)
      .find({ where: { dashboardId } });
    for (const link of links)
      await this.assert(
        'widget',
        link.widgetId,
        actor,
        action === 'owner' ? 'owner' : 'read',
        manager,
      );
    if (dashboard.analysisDefinition) {
      let definition: any;
      try {
        definition = JSON.parse(dashboard.analysisDefinition);
      } catch {
        throw new ForbiddenException('invalid stored source');
      }
      await this.assert(
        'database',
        definition.databaseId,
        actor,
        action === 'owner' ? 'owner' : 'read',
        manager,
      );
    }
  }
  async sharedDashboard(id: unknown): Promise<number> {
    const dashboardId = this.id(id);
    const mappings = await this.db.getRepository(UserMapping).find({ where: { dashboardId } });
    if (mappings.length !== 1) throw new ForbiddenException('share source ownership required');
    if (this.policy)
      await this.policy.assert('dashboard', dashboardId, mappings[0].userInfoId, 'read');
    await this.dashboard(dashboardId, mappings[0].userInfoId);
    return mappings[0].userInfoId;
  }
  async filterResults(
    kind: SourceAsset,
    actor: number,
    result: any,
    action: ResourceAction | 'owner' = 'owner',
  ): Promise<any> {
    this.actor(actor);
    const rows = Array.isArray(result) ? result : result?.data;
    if (!Array.isArray(rows)) return result;
    const allowed = [];
    for (const row of rows) {
      try {
        await this.assert(kind, row.id, actor, action);
        allowed.push(row);
      } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
      }
    }
    return Array.isArray(result) ? allowed : { ...result, data: allowed };
  }
  async assertWebConnection(body: any, existingId?: unknown): Promise<void> {
    let engine = body.engine;
    if (existingId !== undefined) {
      const source = await this.db
        .getRepository(Database)
        .findOne({ where: { id: this.id(existingId) } });
      engine = source?.engine;
    }
    if (['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(String(engine).toLowerCase())) {
      throw new ForbiddenException(
        'File sources require managed upload; connection paths cannot be supplied or changed.',
      );
    }
  }
  async metricName(name: unknown, actor: number): Promise<void> {
    if (typeof name !== 'string') return;
    const existing = await this.db.getRepository(Metric).findOne({ where: { name } });
    if (existing) await this.assert('metric', existing.id, actor);
  }
}
