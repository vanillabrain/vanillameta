/** Test-only OS process host. No production API, configuration or startup hook is modified. */
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { SourceCatalogEntry } from '../../src/bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../../src/bi/entities/source-condition-entry.entity';
import { semanticMetadata } from '../util/semantic-mysql';
import { User } from '../../src/user/entities/user.entity';
import { Database } from '../../src/database/entities/database.entity';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { Metric, MetricAggregation } from '../../src/metric/entities/metric.entity';
import { EnterpriseMembership } from '../../src/enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../../src/enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../../src/enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../../src/enterprise/entities/enterprise-group.entity';
import { ExportJob, ExportPart } from '../../src/bi/entities/export-job.entity';
import { DuckDBService } from '../../src/analysis/duckdb.service';
import { ConnectionService } from '../../src/connection/connection.service';
import { EnterpriseResourcePolicyService } from '../../src/enterprise/resource-policy.service';
import { SourceAccessService } from '../../src/ownership/source-access.service';
import { AiDashboardService } from '../../src/ai/ai-dashboard.service';
import { BiService } from '../../src/bi/bi.service';
import { BiExploreService } from '../../src/bi/bi-explore.service';
import { ExportJobsService } from '../../src/bi/export-jobs.service';

export const exportRestartEntities = [
  User,
  EnterpriseMembership,
  Dashboard,
  Database,
  Metric,
  EnterpriseAuditEvent,
  EnterpriseResourceGrant,
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
  SourceCatalogEntry,
  SourceConditionEntry,
  ExportJob,
  ExportPart,
];

export async function main() {
  if (!process.send || !process.env.VM_SEMANTIC_MYSQL_CONFIG)
    throw new Error('Owned MySQL IPC fixture required');
  const db = await semanticMetadata('runtime', {
    type: 'sqlite',
    database: ':memory:',
    entities: exportRestartEntities,
  });
  const worker = new DuckDBService();
  const connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
  const policy = new EnterpriseResourcePolicyService(db);
  const access = new SourceAccessService(db, policy);
  const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
  const bi = new BiService(db, access, connection, ai);
  const explore = new BiExploreService(bi, ai, connection);
  const jobs = new ExportJobsService(db, bi, explore, connection);
  let aggregates = 0,
    queries = 0,
    release: (() => void) | undefined,
    holdNext = false;
  let holdParts = false;
  const insert = EntityManager.prototype.insert;
  EntityManager.prototype.insert = async function (entity, values) {
    if (entity === ExportPart && holdParts) {
      holdParts = false;
      await new Promise<void>(resolve => {
        release = resolve;
        process.send({ event: 'parts-held', pid: process.pid });
      });
    }
    return insert.call(this, entity, values);
  };
  const query = connection.queryDuckDB.bind(connection);
  connection.queryDuckDB = (...args: Parameters<ConnectionService['queryDuckDB']>) => {
    queries++;
    return query(...args);
  };
  const exportCsv = explore.exportCsv.bind(explore);
  explore.exportCsv = async (...args) => {
    aggregates++;
    if (holdNext) {
      holdNext = false;
      await new Promise<void>(resolve => {
        release = resolve;
        process.send({ event: 'aggregate-held', pid: process.pid });
      });
    }
    return exportCsv(...args);
  };
  const seed = async () => {
    if (await db.manager.count(User)) throw new Error('Fixture must be empty');
    for (const id of [7, 8, 9]) {
      await db.manager.insert(User, {
        id,
        userId: `restart-${id}`,
        email: `restart-${id}@example.invalid`,
        password: 'synthetic',
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: id,
        organizationId: 1,
        role: id === 7 ? 'admin' : 'member',
      });
    }
    const csv =
      'region,amount\n' +
      Array.from(
        { length: 140 },
        (_, i) => `Group${String(i).padStart(3, '0')}_${'x'.repeat(2000)},${i + 1}\n`,
      ).join('');
    const file = await worker.importFile({
      originalname: 'synthetic.csv',
      buffer: Buffer.from(csv),
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Restart fixture',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
    });
    await db.manager.insert(Metric, {
      id: 1,
      databaseId: 1,
      name: 'restart_revenue',
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      useYn: 'Y',
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: 1,
        tableName: 'uploaded_data',
        label: `Revenue ${'m'.repeat(180)}`,
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
        aggregation: 'SUM',
        column: 'amount',
      }),
    });
    await policy.set('source', 1, 7, {
      recipientId: 8,
      expectedVersion: 0,
      rights: { read: true, edit: false, publish: false, export: true },
    });
    const revision = await connection.duckDBVersion(1);
    return {
      requestId: randomUUID(),
      payload: {
        mode: 'explore',
        query: {
          sourceId: 1,
          sourceRevision: revision,
          measureIds: [1],
          dimensionColumns: ['region'],
          rankingMeasureId: 1,
          includeRows: false,
          pageSize: 50,
        },
      },
      measureVersions: { '1': 1 },
    };
  };
  const handle = async (message: any) => {
    const a = message.args ?? {};
    switch (message.op) {
      case 'seed':
        return seed();
      case 'stats':
        return { pid: process.pid, aggregates, queries };
      case 'groupPolicy':
        return policy.setGroupPolicy('source', 1, 7, a.body);
      case 'directPolicy':
        return policy.set('source', 1, 7, a.body);
      case 'armParts':
        holdParts = true;
        return { armed: true };
      case 'arm':
        holdNext = true;
        return { armed: true };
      case 'release':
        release?.();
        release = undefined;
        return { released: true };
      case 'create':
        return jobs.create(a.body, a.actor ?? 8, a.epoch ?? 0);
      case 'get':
        return jobs.get(a.id, a.actor ?? 8, a.epoch ?? 0);
      case 'list':
        return jobs.list(a.actor ?? 8, undefined, a.epoch ?? 0);
      case 'run':
        return jobs.run(
          a.id,
          { expectedVersion: a.version },
          a.actor ?? 8,
          a.background ?? false,
          a.epoch ?? 0,
        );
      case 'file':
        return jobs.file(a.id, a.actor ?? 8, a.epoch ?? 0);
      case 'drain':
        await jobs.onModuleDestroy();
        return { drained: true };
      default:
        throw new Error('Unknown fixture operation');
    }
  };
  process.on('message', (message: any) => {
    void handle(message).then(
      value => process.send({ id: message.id, value }),
      error =>
        process.send({
          id: message.id,
          error: {
            status: error?.getStatus?.() ?? error?.status ?? 500,
            kind: error?.name ?? 'Error',
          },
        }),
    );
  });
  process.on('disconnect', () => process.exit(0));
  process.send({ event: 'ready', pid: process.pid });
}
