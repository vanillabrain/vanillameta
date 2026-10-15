import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { BiService } from './bi.service';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import {
  compileSemanticProposal,
  dimensionDefinition,
  semanticCatalog,
  semanticDigest,
  shape,
} from './semantic-proposal';
import { sourceRevision } from './source-revision';

// SQLite's TypeORM driver shares one connection. Cross-connection safety still uses DB unique + retry.
const sqliteQueues = new WeakMap<DataSource, Promise<unknown>>();
@Injectable()
export class SemanticCreationService {
  constructor(
    private readonly db: DataSource,
    private readonly bi: BiService,
    private readonly dashboards: AiDashboardService,
    private readonly connection: ConnectionService,
  ) {}
  private async replay(
    manager: EntityManager,
    actorId: number,
    requestId: string,
    payloadDigest: string,
  ) {
    const receipt = await manager.findOne(AnalysisCreationReceipt, {
      where: { actorId, requestId },
    });
    if (!receipt) return;
    if (receipt.payloadDigest !== payloadDigest) throw new ConflictException('REQUEST_CHANGED');
    const dashboard =
      receipt.dashboardId &&
      (await manager.findOne(Dashboard, { where: { id: receipt.dashboardId } }));
    const mapping =
      receipt.dashboardId &&
      (await manager.findOne(UserMapping, {
        where: { dashboardId: receipt.dashboardId, userInfoId: actorId },
      }));
    if (!dashboard || dashboard.delYn === 'Y' || !mapping)
      throw new NotFoundException(
        '저장한 분석을 사용할 수 없습니다. 자동으로 다시 만들지 않습니다.',
      );
    return { id: receipt.dashboardId, replayed: true };
  }
  private async currentSource(
    manager: EntityManager,
    sourceId: number,
    actor: number,
    revision: string,
  ) {
    const row = await manager.findOne(Database, { where: { id: sourceId } });
    if (!row || row.ownerId !== actor) throw new ForbiddenException('source ownership required');
    if (row.engine !== 'duckdb') throw new ConflictException('SOURCE_CHANGED');
    const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
    if (config.client !== 'duckdb' || typeof config.connection?.filename !== 'string')
      throw new ConflictException('SOURCE_CHANGED');
    const fileVersion = createHash('sha256').update(config.connection.filename).digest('hex');
    if (sourceRevision(row, fileVersion) !== revision)
      throw new ConflictException('SOURCE_CHANGED');
  }
  async save(body: any, actor: number) {
    shape(body, ['proposal', 'previewDigest', 'requestId']);
    if (!Number.isSafeInteger(actor) || actor <= 0) throw new ForbiddenException('invalid owner');
    if (
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        body.requestId,
      ) ||
      typeof body.previewDigest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.previewDigest) ||
      !body.proposal ||
      Buffer.byteLength(JSON.stringify(body.proposal)) > 128 * 1024
    )
      throw new BadRequestException('저장 요청을 확인해 주세요.');
    const requestId = body.requestId.toLowerCase();
    // Independent of today's catalog/source and of UUIDs assigned during persistence.
    const payloadDigest = semanticDigest({
      proposal: body.proposal,
      previewDigest: body.previewDigest,
    });
    const run = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const replay = await this.replay(this.db.manager, actor, requestId, payloadDigest);
          if (replay) return replay;
          return await this.db.transaction('SERIALIZABLE', async manager => {
            // First write acquires SQLite's writer lock before source/catalog reads.
            const receipt = await manager.save(AnalysisCreationReceipt, {
              actorId: actor,
              requestId,
              payloadDigest,
              dashboardId: null,
            });
            await this.currentSource(
              manager,
              body.proposal.sourceId,
              actor,
              body.proposal.sourceRevision,
            );
            return this.connection.withDuckDBSnapshot(body.proposal.sourceId, async () => {
              const profile = await this.bi.profile(body.proposal.sourceId, actor);
              const catalog = semanticCatalog(
                await manager.find(Metric, { where: { databaseId: profile.sourceId, useYn: 'Y' } }),
                profile,
              );
              const compiled = compileSemanticProposal(body.proposal, profile, catalog);
              if (compiled.previewDigest !== body.previewDigest)
                throw new ConflictException('PLAN_CHANGED');
              const resolved = new Map<string, any>();
              const created = new Map<string, any>();
              for (const measure of compiled.plan.measures) {
                let row: any;
                if (measure.action === 'reuse') {
                  row = await manager.findOne(Metric, {
                    where: { id: measure.metricId, databaseId: profile.sourceId, useYn: 'Y' },
                  });
                  if (!row) throw new ConflictException('PLAN_CHANGED');
                  const current = semanticCatalog([row], profile)[0];
                  if (
                    !current ||
                    current.definitionVersion !== measure.definitionVersion ||
                    current.identity !== measure.identity
                  )
                    throw new ConflictException('PLAN_CHANGED');
                } else {
                  row = created.get(measure.identity);
                  if (!row) {
                    const name = 'bi_v2_' + measure.identity;
                    if (await manager.findOne(Metric, { where: { name } }))
                      throw new ConflictException('METRIC_NAME_CONFLICT');
                    const definition = {
                      schemaVersion: 1,
                      definitionVersion: 1,
                      sourceId: profile.sourceId,
                      tableName: 'uploaded_data',
                      ...measure.definition,
                    };
                    row = await manager.save(Metric, {
                      name,
                      databaseId: profile.sourceId,
                      tableName: 'uploaded_data',
                      aggregation: definition.aggregation,
                      expression: definition.column === '*' ? 'count_rows' : definition.column,
                      description: definition.label,
                      definition: JSON.stringify(definition),
                      useYn: 'Y',
                    });
                    created.set(measure.identity, row);
                  }
                }
                resolved.set(measure.key, row);
              }
              const snapshot = {
                schemaVersion: 2,
                kind: 'structured-bi-dashboard',
                sourceId: profile.sourceId,
                dataVersion: profile.dataVersion,
                items: compiled.proposal.blocks.map(block => {
                  const row = resolved.get(block.measureKey);
                  const measure = compiled.plan.measures.find(m => m.key === block.measureKey);
                  const dimension = compiled.plan.dimensions.find(
                    d => d.key === block.dimensionKey,
                  );
                  const definition = JSON.parse(row.definition);
                  return {
                    key: block.key,
                    sourceId: profile.sourceId,
                    metricId: row.id,
                    definitionVersion: definition.definitionVersion,
                    definition,
                    chart: block.chart,
                    ...(dimension
                      ? {
                          dimension: dimension.column,
                          dimensionDefinition: dimensionDefinition(
                            profile,
                            profile.columns.find(c => c.name === dimension.column),
                          ),
                        }
                      : {}),
                    presentation: {
                      unit: measure.definition.unit,
                      decimalPlaces: measure.definition.decimalPlaces,
                      numberNotation: measure.definition.numberNotation,
                    },
                  };
                }),
              };
              const saved = (
                await this.dashboards.save(
                  { draft: compiled.draft },
                  actor,
                  snapshot,
                  undefined,
                  manager,
                )
              ).data;
              // This reads the CURRENT metadata pointer, not the pinned DuckDB version.
              await this.currentSource(manager, profile.sourceId, actor, profile.dataVersion);
              for (const row of resolved.values()) {
                const current = await manager.findOne(Metric, {
                  where: { id: row.id, definition: row.definition, useYn: 'Y' },
                });
                if (!current) throw new ConflictException('PLAN_CHANGED');
              }
              await manager.update(
                AnalysisCreationReceipt,
                { id: receipt.id },
                { dashboardId: saved.id },
              );
              // A replay intentionally has no historical revision: the receipt records identity only.
              return { id: saved.id, replayed: false, revision: saved.revision };
            });
          });
        } catch (error) {
          const retryable =
            /SQLITE_BUSY|SQLITE_LOCKED|SQLITE_CONSTRAINT|ER_DUP_ENTRY|ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT/.test(
              String(error?.code ?? error?.driverError?.code),
            );
          if (!retryable) throw error;
          if (attempt === 2)
            throw new ServiceUnavailableException(
              '저장이 경합 중입니다. 같은 요청 ID로 다시 시도해 주세요.',
            );
          await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
    };
    if (this.db.options.type !== 'sqlite') return run();
    const pending = (sqliteQueues.get(this.db) ?? Promise.resolve()).then(run, run);
    sqliteQueues.set(
      this.db,
      pending.catch(() => undefined),
    );
    return pending;
  }
}
