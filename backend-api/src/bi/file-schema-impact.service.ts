import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { BiService } from './bi.service';
import { reuseColumns } from './dashboard-remap';
import { metricDependencyColumns } from './metric-dependencies';
export { metricDependencyColumns } from './metric-dependencies';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const revision = (source: Database) =>
  createHash('sha256').update(source.connectionConfig).digest('hex');
/** Owner-only dependency projection. It never executes dashboard SQL or mutates a source. */
@Injectable()
export class FileSchemaImpactService {
  constructor(
    private readonly db: DataSource,
    private readonly bi: BiService,
    private readonly dashboards: AiDashboardService,
    private readonly access: SourceAccessService,
  ) {}
  async inspect(sourceInput: unknown, requestId: unknown, actor: number) {
    this.access.actor(actor);
    const sourceId = this.access.id(sourceInput);
    await this.access.assert('database', sourceId, actor);
    if (typeof requestId !== 'string' || !UUID.test(requestId))
      throw new BadRequestException('갱신 요청 ID를 확인해 주세요.');
    const job = await this.db.manager.findOne(FileRefresh, {
      where: { actorId: actor, sourceId, requestId: requestId.toLowerCase() },
    });
    if (!job) throw new NotFoundException('이 소스의 갱신 작업을 찾을 수 없습니다.');
    let error: any;
    try {
      error = JSON.parse(job.error);
    } catch {
      /* Not a schema rejection. */
    }
    if (job.status !== 'failed' || error?.code !== 'FILE_SCHEMA_CHANGED' || !error.changes)
      throw new BadRequestException(
        '열 구성 변경으로 거절된 작업에서만 영향을 확인할 수 있습니다.',
      );
    const source = await this.db.manager.findOne(Database, {
      where: { id: sourceId, ownerId: actor, engine: 'duckdb' },
    });
    if (!source || revision(source) !== job.expectedRevision)
      throw new ConflictException(
        '기준 파일이 바뀌었습니다. 최신 파일에서 열 구성을 다시 확인해 주세요.',
      );
    const profile = await this.bi.profile(sourceId, actor);
    const changed = new Set<string>(
      [...(error.changes.removed ?? []), ...(error.changes.typeChanged ?? [])].map(c =>
        String(c.name).toLowerCase(),
      ),
    );
    const classify = (columns: string[], unknown = false) => {
      const affectedColumns = columns.filter(name => changed.has(name.toLowerCase()));
      return {
        columns,
        affectedColumns,
        status:
          unknown || error.changes.truncated
            ? 'review'
            : affectedColumns.length
            ? 'affected'
            : 'no-changed-column',
      };
    };
    const metrics = await this.db.manager.find(Metric, {
      where: { databaseId: sourceId, useYn: 'Y' },
      order: { id: 'ASC' },
      take: 101,
    });
    const metricItems = metrics.slice(0, 100).map(metric => {
      try {
        const definition = JSON.parse(metric.definition);
        return {
          id: metric.id,
          title:
            typeof definition.label === 'string' && definition.label.trim()
              ? definition.label.slice(0, 100)
              : metric.name,
          ...classify(metricDependencyColumns(definition, profile)),
        };
      } catch {
        return { id: metric.id, title: metric.name, ...classify([], true) };
      }
    });
    const mappings = await this.db.manager.find(UserMapping, {
      where: { userInfoId: actor },
      order: { id: 'ASC' },
      take: 101,
    });
    const items: any[] = [];
    let unreadable = 0;
    for (const id of new Set(mappings.slice(0, 100).map(mapping => mapping.dashboardId))) {
      const saved = await this.db.manager.findOne(Dashboard, { where: { id, delYn: 'N' } });
      if (!saved?.analysisDefinition) continue;
      let raw: any;
      try {
        raw = JSON.parse(saved.analysisDefinition);
      } catch {
        unreadable += 1;
        continue;
      }
      if (raw.databaseId !== sourceId) continue;
      // Recheck dashboard ownership and all referenced sources before projecting even a title.
      await this.access.assert('dashboard', id, actor);
      try {
        const analysis = (await this.dashboards.analysis(id, actor, true)).data;
        if (analysis.databaseId !== sourceId) throw new Error('source changed');
        const sharedColumns = [
          ...(analysis.defaultFilters ?? []).map(f => f.column),
          ...(analysis.defaultDateRange ? [analysis.defaultDateRange.column] : []),
        ];
        const blocks = analysis.widgets.map(widget => {
          try {
            const columns = [
              ...new Set([
                ...reuseColumns({ ...analysis, widgets: [widget] }, profile).map(c => c.name),
                ...sharedColumns,
              ]),
            ];
            if (columns.some(name => !profile.columns.some(c => c.name === name)))
              throw new Error('scope column unknown');
            return { id: widget.blockId, title: widget.title, ...classify(columns as string[]) };
          } catch {
            return { id: widget.blockId, title: widget.title, ...classify([], true) };
          }
        });
        items.push({ id, title: analysis.title, revision: analysis.revision, blocks });
      } catch (failure) {
        if (failure instanceof ForbiddenException) throw failure;
        items.push({ id, title: saved.title, status: 'review', blocks: [] });
      }
    }
    const current = await this.db.manager.findOne(Database, {
      where: { id: sourceId, ownerId: actor },
    });
    if (!current || revision(current) !== job.expectedRevision)
      throw new ConflictException(
        '조회 중 기준 파일이 바뀌었습니다. 최신 파일에서 다시 확인해 주세요.',
      );
    return {
      sourceId,
      requestId: job.requestId,
      expectedRevision: job.expectedRevision,
      sourceRevision: profile.dataVersion,
      observedChanges: [
        ...(error.changes.removed ?? []).map(c => ({
          kind: 'removed',
          column: c.name,
          previousType: c.type,
        })),
        ...(error.changes.added ?? []).map(c => ({
          kind: 'added',
          column: c.name,
          incomingType: c.type,
        })),
        ...(error.changes.typeChanged ?? []).map(c => ({
          kind: 'typeChanged',
          column: c.name,
          previousType: c.from,
          incomingType: c.to,
        })),
      ],
      dependencyRevision: createHash('sha256')
        .update(
          JSON.stringify({
            metrics: metrics.map(m => ({ id: m.id, definition: m.definition, useYn: m.useYn })),
            dashboards: items,
            unreadable,
            truncated: metrics.length > 100 || mappings.length > 100 || !!error.changes.truncated,
          }),
        )
        .digest('hex'),
      scope: 'saved-analysis',
      metrics: metricItems,
      dashboards: items,
      unreadable,
      truncated: metrics.length > 100 || mappings.length > 100 || !!error.changes.truncated,
    };
  }
}
