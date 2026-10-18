jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));
jest.mock('./bi.service', () => ({ BiService: class {} }));
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { pinMetricFormula } from './metric-formula';
import { FileSchemaImpactService, metricDependencyColumns } from './file-schema-impact.service';

const profile = {
  sourceId: 1,
  supported: true,
  dataVersion: 'a'.repeat(64),
  columns: [
    { name: 'sales_amount', type: 'DOUBLE', numeric: true },
    { name: 'expense_amount', type: 'DOUBLE', numeric: true },
    { name: 'company', type: 'VARCHAR' },
    { name: 'day', type: 'TIMESTAMP', temporal: true },
  ],
};
const definition = (column = 'expense_amount') => ({
  schemaVersion: 1,
  sourceId: 1,
  tableName: 'uploaded_data',
  definitionVersion: 1,
  label: 'saved metric',
  aggregation: 'SUM',
  column,
  unit: 'USD',
  decimalPlaces: 2,
  numberNotation: 'plain',
});
const formula = () => ({
  schemaVersion: 1,
  sourceId: 1,
  tableName: 'uploaded_data',
  definitionVersion: 1,
  label: 'Ratio',
  aggregation: 'FORMULA',
  column: '*',
  unit: '%',
  formula: pinMetricFormula(
    {
      op: 'ratio',
      left: { metricId: 1, definitionVersion: 1 },
      right: { metricId: 2, definitionVersion: 1 },
      scale: 100,
    },
    [
      { id: 1, definitionVersion: 1, definition: definition() },
      { id: 2, definitionVersion: 1, definition: definition('sales_amount') },
    ],
    profile,
  ),
});
describe('owner-only changed-column impact', () => {
  let db: DataSource,
    service: FileSchemaImpactService,
    requestId: string,
    analysis: jest.Mock,
    access: any;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Dashboard, Database, FileRefresh, Metric, UserMapping],
      synchronize: true,
    }).initialize();
    await db.manager.save(Database, {
      id: 1,
      name: 'source',
      engine: 'duckdb',
      type: 'file',
      connectionConfig: 'retained-private-config',
      ownerId: 1,
    });
    requestId = randomUUID();
    await db.manager.save(FileRefresh, {
      id: randomUUID(),
      actorId: 1,
      sourceId: 1,
      requestId,
      payloadDigest: 'b'.repeat(64),
      inputDigest: 'c'.repeat(64),
      storageDigest: 'd'.repeat(64),
      expectedRevision: createHash('sha256').update('retained-private-config').digest('hex'),
      originalname: 'changed.csv',
      extension: '.csv',
      status: 'failed',
      attempts: 1,
      error: JSON.stringify({
        code: 'FILE_SCHEMA_CHANGED',
        changes: {
          removed: [{ name: 'expense_amount', type: 'DOUBLE' }],
          added: [],
          typeChanged: [],
          truncated: false,
        },
      }),
    });
    await db.manager.save(Dashboard, [
      { id: 1, title: 'Owned', analysisDefinition: JSON.stringify({ databaseId: 1 }), delYn: 'N' },
      {
        id: 2,
        title: 'Other owner private title',
        analysisDefinition: JSON.stringify({ databaseId: 1 }),
        delYn: 'N',
      },
    ]);
    await db.manager.save(UserMapping, [
      { dashboardId: 1, userInfoId: 1 },
      { dashboardId: 2, userInfoId: 2 },
    ]);
    analysis = jest.fn(async () => ({
      data: {
        databaseId: 1,
        title: 'Owned',
        revision: 'r1',
        widgets: [
          {
            blockId: 'cost',
            title: 'Cost',
            sql: 'SELECT SUM("expense_amount") AS "value" FROM source',
          },
          {
            blockId: 'revenue',
            title: 'Revenue',
            sql: 'SELECT SUM("sales_amount") AS "value" FROM source',
          },
        ],
      },
    }));
    access = {
      actor: (actor: number) => {
        if (actor !== 1) throw new ForbiddenException();
        return actor;
      },
      id: Number,
      assert: jest.fn(async () => undefined),
    };
    service = new FileSchemaImpactService(
      db,
      { profile: jest.fn(async () => profile) } as any,
      { analysis } as any,
      access,
    );
  });
  afterEach(async () => {
    await db.destroy();
    jest.restoreAllMocks();
  });
  it('projects affected and nonreferencing blocks without SQL, rows, configuration or other owner titles', async () => {
    await db.manager.save(Metric, {
      name: 'cost',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'expense_amount',
      definition: JSON.stringify(definition()),
    });
    const before = await db.manager.find(Database);
    const result = await service.inspect(1, requestId, 1);
    expect(result.metrics[0]).toMatchObject({
      title: 'saved metric',
      status: 'affected',
      affectedColumns: ['expense_amount'],
    });
    expect(result.dashboards[0].blocks.map(b => b.status)).toEqual([
      'affected',
      'no-changed-column',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /SELECT|retained-private-config|Other owner|datas|filename|leaseToken/,
    );
    expect(await db.manager.find(Database)).toEqual(before);
  });
  it('checks source ownership before reading the requested receipt', async () => {
    const read = jest.spyOn(db.manager, 'findOne');
    await expect(service.inspect(1, requestId, 2)).rejects.toBeInstanceOf(ForbiddenException);
    expect(read).not.toHaveBeenCalled();
  });
  it('changes the dependency fingerprint when a same-file saved definition or membership changes', async () => {
    const metric = await db.manager.save(Metric, {
      name: 'cost',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'expense_amount',
      definition: JSON.stringify(definition()),
    });
    const initial = await service.inspect(1, requestId, 1);
    const repeated = await service.inspect(1, requestId, 1);
    expect(repeated.dependencyRevision).toBe(initial.dependencyRevision);
    await db.manager.update(Metric, metric.id, {
      definition: JSON.stringify({ ...definition(), definitionVersion: 2 }),
    });
    const changed = await service.inspect(1, requestId, 1);
    expect(changed.sourceRevision).toBe(initial.sourceRevision);
    expect(changed.dependencyRevision).not.toBe(initial.dependencyRevision);
    await db.manager.delete(Metric, metric.id);
    expect((await service.inspect(1, requestId, 1)).dependencyRevision).not.toBe(
      changed.dependencyRevision,
    );
  });
  it('rejects a request from another source or an already changed source revision', async () => {
    await expect(service.inspect(2, requestId, 1)).rejects.toThrow('작업을 찾을');
    await db.manager.update(Database, 1, { connectionConfig: 'different-current-version' });
    await expect(service.inspect(1, requestId, 1)).rejects.toThrow('기준 파일이 바뀌');
    expect(analysis).not.toHaveBeenCalled();
  });
  it('uses pinned formula leaf columns, preserving the operand unit and source checks', () => {
    const d = JSON.parse(JSON.stringify(formula()));
    expect(metricDependencyColumns(d, profile)).toEqual(['expense_amount', 'sales_amount']);
    d.formula.operands[0].definition.sourceId = 2;
    expect(() => metricDependencyColumns(d, profile)).toThrow();
  });
  it('includes common date and filter columns for every affected block', async () => {
    const row = await db.manager.findOneByOrFail(FileRefresh, { requestId });
    await db.manager.update(FileRefresh, row.id, {
      error: JSON.stringify({
        code: 'FILE_SCHEMA_CHANGED',
        changes: { removed: [{ name: 'day', type: 'TIMESTAMP' }], typeChanged: [] },
      }),
    });
    analysis.mockResolvedValueOnce({
      data: {
        databaseId: 1,
        title: 'Owned',
        revision: 'r1',
        defaultDateRange: { column: 'day', start: '2026-01-01', end: '2026-01-31' },
        defaultFilters: [{ column: 'company', values: ['Acme'] }],
        widgets: [
          {
            blockId: 'revenue',
            title: 'Revenue',
            sql: 'SELECT SUM("sales_amount") AS "value" FROM source',
          },
        ],
      },
    });
    const b = (await service.inspect(1, requestId, 1)).dashboards[0].blocks[0];
    expect(b.columns).toEqual(['sales_amount', 'company', 'day']);
    expect(b.affectedColumns).toEqual(['day']);
  });
  it('keeps unsupported SQL and a truncated schema diff as manual review', async () => {
    analysis.mockResolvedValueOnce({
      data: {
        databaseId: 1,
        title: 'Owned',
        revision: 'r1',
        widgets: [
          {
            blockId: 'unknown',
            title: 'Unknown',
            sql: 'WITH t AS (SELECT * FROM source) SELECT * FROM t',
          },
        ],
      },
    });
    expect((await service.inspect(1, requestId, 1)).dashboards[0].blocks[0].status).toBe('review');
    const row = await db.manager.findOneByOrFail(FileRefresh, { requestId });
    await db.manager.update(FileRefresh, row.id, {
      error: JSON.stringify({
        code: 'FILE_SCHEMA_CHANGED',
        changes: { removed: [], typeChanged: [], truncated: true },
      }),
    });
    const result = await service.inspect(1, requestId, 1);
    expect(result.truncated).toBe(true);
    expect(result.dashboards[0].blocks.every(b => b.status === 'review')).toBe(true);
  });
  it('rechecks the file revision after scanning and propagates revoked dashboard access', async () => {
    analysis.mockImplementationOnce(async () => {
      await db.manager.update(Database, 1, { connectionConfig: 'changed-during-read' });
      return { data: { databaseId: 1, title: 'Owned', widgets: [] } };
    });
    await expect(service.inspect(1, requestId, 1)).rejects.toThrow('조회 중');
    await db.manager.update(Database, 1, { connectionConfig: 'retained-private-config' });
    access.assert.mockImplementation(async (kind: string) => {
      if (kind === 'dashboard') throw new ForbiddenException();
    });
    await expect(service.inspect(1, requestId, 1)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['SELECT * FROM source', 'SELECT source.* FROM source'])(
    'keeps wildcard projection as review: %s',
    async sql => {
      analysis.mockResolvedValueOnce({
        data: {
          databaseId: 1,
          title: 'Owned',
          revision: 'r1',
          widgets: [
            { blockId: 'wildcard', title: 'Raw wildcard', sql, valueField: 'expense_amount' },
          ],
        },
      });
      expect((await service.inspect(1, requestId, 1)).dashboards[0].blocks[0].status).toBe(
        'review',
      );
    },
  );
  it('marks a type-changed operand as affected and COUNT as column-independent', async () => {
    const row = await db.manager.findOneByOrFail(FileRefresh, { requestId });
    await db.manager.update(FileRefresh, row.id, {
      error: JSON.stringify({
        code: 'FILE_SCHEMA_CHANGED',
        changes: {
          removed: [],
          typeChanged: [{ name: 'expense_amount', from: 'DOUBLE', to: 'VARCHAR' }],
        },
      }),
    });
    analysis.mockResolvedValueOnce({
      data: {
        databaseId: 1,
        title: 'Owned',
        revision: 'r1',
        widgets: [{ blockId: 'count', title: 'Rows', sql: 'SELECT COUNT(*) AS value FROM source' }],
      },
    });
    await db.manager.save(Metric, [
      {
        name: 'cost leaf',
        databaseId: 1,
        tableName: 'uploaded_data',
        aggregation: MetricAggregation.SUM,
        expression: 'expense_amount',
        definition: JSON.stringify(definition()),
      },
      {
        name: 'frozen ratio',
        databaseId: 1,
        tableName: 'uploaded_data',
        aggregation: MetricAggregation.SUM,
        expression: '*',
        definition: JSON.stringify(formula()),
      },
    ]);
    const result = await service.inspect(1, requestId, 1);
    expect(result.metrics.map(metric => metric.status)).toEqual(['affected', 'affected']);
    expect(result.dashboards[0].blocks[0].status).toBe('no-changed-column');
  });
});
