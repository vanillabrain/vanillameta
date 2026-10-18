jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BiService } from './bi.service';
import { SemanticProposalService } from './semantic-proposal.service';
import { SemanticCreationService } from './semantic-creation.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { AnalysisCreationReceipt } from './analysis-creation-receipt.entity';
import * as basisModule from './semantic-business-basis';
import { businessSchemaRevision } from './semantic-business-basis';

describe('new direct and legacy AI business creation actual SQLite/DuckDB', () => {
  let db: DataSource, instance: DuckDBInstance, duck: DuckDBConnection, dir: string;
  let bi: BiService, proposals: SemanticProposalService, creation: SemanticCreationService;
  let query: jest.Mock, ai: any, dashboards: AiDashboardService;
  const metric = (changes = {}) => ({
    sourceId: 1,
    label: 'Amount',
    aggregation: 'SUM',
    column: 'amount',
    decimalPlaces: 0,
    numberNotation: 'plain',
    ...changes,
  });
  const addCatalog = async (version = 1, codeType = 'category') => {
    const profile = await bi.profile(1, 10);
    await db.manager.save(SourceCatalogEntry, {
      sourceId: 1,
      actorId: 10,
      version,
      sourceRevision: profile.dataVersion,
      schemaRevision: businessSchemaRevision(profile),
      metadata: JSON.stringify({
        label: 'Business source',
        description: '',
        columns: profile.columns.map(column => ({
          column: column.name,
          label: `Business ${column.name}`,
          description: 'Private context',
          unit: column.name === 'amount' ? '$' : '',
          classification: '',
          businessType:
            column.name === 'code'
              ? codeType
              : column.name === 'amount'
              ? 'number'
              : column.name === 'business_day'
              ? 'date'
              : 'category',
          dateFormat: column.name === 'business_day' ? 'YYYY/MM/DD' : '',
        })),
      }),
    });
  };
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-business-consumers-'));
    const filename = path.join(dir, 'source.duckdb');
    instance = await DuckDBInstance.create(filename);
    duck = await instance.connect();
    await duck.run(
      "CREATE TABLE uploaded_data(code BIGINT, amount DOUBLE, business_day VARCHAR, native_day DATE); INSERT INTO uploaded_data VALUES (101,10,'2024/02/28',DATE '2024-03-01'),(102,20,'2024/02/28',DATE '2024-03-02'),(101,30,'2024/02/29',DATE '2024-03-03')",
    );
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupGrant,
        EnterpriseGroupMember,
        Database,
        Metric,
        SourceCatalogEntry,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Dataset,
        Widget,
        Component,
        AnalysisCreationReceipt,
      ],
    }).initialize();
    await db.manager.save(
      User,
      [10, 20].map(id => ({
        id,
        userId: `business-${id}`,
        email: `business-${id}@example.invalid`,
        password: 'fixture',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.save(
      EnterpriseMembership,
      [10, 20].map(userId => ({ userId, organizationId: 1, role: 'member' as const, team: '' })),
    );
    await db.manager.save(Database, {
      id: 1,
      ownerId: 10,
      name: 'Fixture',
      type: 'FILE',
      engine: 'duckdb',
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    query = jest.fn(async (_id, sql, bindings = []) => {
      const result = await duck.runAndReadAll(sql, bindings);
      return {
        datas: result.getRowObjectsJson(),
        fields: result.columnNames().map((columnName, index) => ({
          columnName,
          columnType:
            /^(U?TINYINT|U?SMALLINT|U?INTEGER|U?BIGINT|U?HUGEINT|FLOAT|DOUBLE|DECIMAL)/.test(
              result.columnType(index).toString(),
            )
              ? 'number'
              : /^(DATE|TIME|TIMESTAMP)/.test(result.columnType(index).toString())
              ? 'date'
              : 'string',
        })),
      };
    });
    const connection: any = {
      queryDuckDB: query,
      isDuckDB: async () => true,
      withDuckDBSnapshot: (_id, run) => run(),
      duckDBVersion: async () => createHash('sha256').update(filename).digest('hex'),
      captureDuckDBSnapshot: async () => ({ run: run => run() }),
    };
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    bi = new BiService(db, access, connection, dashboards);
    ai = {
      callLlm: jest.fn(async (_system, raw) => {
        const context = JSON.parse(raw);
        return JSON.stringify({
          schemaVersion: 1,
          sourceId: 1,
          sourceRevision: context.sourceRevision,
          title: 'Business analysis',
          measures: [{ key: 'amount', definition: { ...metric(), unit: '$' } }].map(
            ({ key, definition }) => {
              delete definition.sourceId;
              return { key, definition };
            },
          ),
          dimensions: [{ key: 'day', column: 'business_day' }],
          blocks: [
            { key: 'total', measureKey: 'amount', chart: 'number', title: 'Total' },
            {
              key: 'day',
              measureKey: 'amount',
              dimensionKey: 'day',
              chart: 'line',
              title: 'Daily',
            },
          ],
        });
      }),
    };
    proposals = new SemanticProposalService(bi, db, ai, dashboards, connection);
    creation = new SemanticCreationService(db, bi, dashboards, connection);
  });
  afterEach(async () => {
    await db?.destroy();
    duck?.closeSync();
    instance?.closeSync();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exposes effective metadata only through the new endpoint and leaves the native profile unchanged', async () => {
    const nativeResponse = await bi.businessBasis({ sourceId: 1 }, 10, 0);
    expect(nativeResponse.businessBasis).toBeNull();
    for (const column of nativeResponse.businessColumns) {
      expect(Object.keys(column).sort()).toEqual(
        [
          'name',
          'type',
          'numeric',
          'temporal',
          'label',
          'description',
          'unit',
          'businessType',
          'dateFormat',
          'classification',
        ].sort(),
      );
      expect(column).toMatchObject({
        label: column.name,
        description: '',
        unit: '',
        businessType: 'auto',
        dateFormat: '',
        classification: '',
      });
    }
    await addCatalog();
    const response = await bi.businessBasis({ sourceId: 1 }, 10, 0);
    expect(response.businessBasis.columns).toHaveLength(4);
    expect(response.businessColumns.find(column => column.name === 'code')).toMatchObject({
      numeric: false,
      businessType: 'category',
    });
    expect(response.businessColumns.find(column => column.name === 'business_day')).toMatchObject({
      temporal: true,
      label: 'Business business_day',
    });
    expect(JSON.stringify(response)).not.toMatch(
      /try_strptime|expression|connection|filename|SELECT/,
    );
    const native = await bi.profile(1, 10);
    expect(native.columns.find(column => column.name === 'code').numeric).toBe(true);
    expect(native.columns.find(column => column.name === 'business_day').temporal).toBe(false);
  });
  it('denies a late JWT epoch change during direct preview aggregate SQL without returning rows', async () => {
    await addCatalog();
    const saved = await bi.createMetric(metric(), 10, 0);
    const original = query.getMockImplementation();
    query.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[1].includes('SUM("amount")')) await db.manager.update(User, 10, { authVersion: 1 });
      return result;
    });
    await expect(
      bi.preview({ sourceId: 1, metricId: saved.id, chart: 'number', title: 'Total' }, 10, 0),
    ).rejects.toMatchObject({ status: 401 });
    expect(await db.manager.count(Dashboard)).toBe(0);
  });
  it('uses current semantics even when direct create omits proof, persists used slices, and never gives counts an amount unit', async () => {
    await addCatalog();
    await expect(bi.createMetric(metric({ column: 'code' }), 10, 0)).rejects.toMatchObject({
      status: 400,
    });
    expect(await db.manager.count(Metric)).toBe(0);
    const sum = await bi.createMetric(metric(), 10, 0);
    expect(sum.definition.unit).toBe('$');
    expect(sum.definition.businessBasis.columns.map(column => column.column)).toEqual(['amount']);
    const distinct = await bi.createMetric(
      metric({ column: 'code', aggregation: 'COUNT_DISTINCT' }),
      10,
      0,
    );
    expect(distinct.definition.unit).toBe('');
    expect(distinct.definition.businessBasis.columns.map(column => column.column)).toEqual([
      'code',
    ]);
    const preview = await bi.preview(
      { sourceId: 1, metricId: sum.id, chart: 'line', dimension: 'business_day', title: 'Daily' },
      10,
    );
    expect(preview.rows.map(row => Number(row.value))).toEqual([30, 30]);
  });
  it('preserves old native metrics after category declarations and freezes full context on new number drafts', async () => {
    const original = await bi.createMetric(metric({ column: 'code', unit: '' }), 10, 0);
    expect(original.definition.businessBasis).toBeUndefined();
    await addCatalog();
    const compiled = await bi.prepare(
      { sourceId: 1, metricId: original.id, chart: 'number', title: 'Native sum' },
      10,
    );
    expect(compiled.draft.businessBasis.columns).toHaveLength(4);
    expect(compiled.draft.widgets[0].sql).toContain('SUM("code")');
    expect(
      Number(
        (
          await bi.preview(
            { sourceId: 1, metricId: original.id, chart: 'number', title: 'Native sum' },
            10,
          )
        ).rows[0].value,
      ),
    ).toBe(304);
    expect(
      JSON.parse((await db.manager.findOneBy(Metric, { id: original.id })).definition)
        .businessBasis,
    ).toBeUndefined();
  });
  it('rejects stale provided direct proof and full-scan catalog/epoch races without creating metrics', async () => {
    await addCatalog();
    const context = await bi.businessBasis({ sourceId: 1 }, 10, 0);
    await addCatalog(2, 'number');
    await expect(
      bi.createMetric({ ...metric(), businessBasis: context.businessBasis }, 10, 0),
    ).rejects.toMatchObject({ status: 409 });
    const original = query.getMockImplementation();
    query.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[1].includes('AS invalid_0')) await db.manager.update(User, 10, { authVersion: 1 });
      return result;
    });
    await expect(
      bi.createMetric(metric({ column: 'business_day', aggregation: 'COUNT_DISTINCT' }), 10, 0),
    ).rejects.toMatchObject({ status: 401 });
    expect(await db.manager.count(Metric)).toBe(0);
  });
  it('binds real model-fixture proposals server-side, preserves the full root, and previews independent 60/30/30 SQL', async () => {
    await addCatalog();
    const generated = await proposals.propose(
      { sourceId: 1, prompt: 'Amount by business day' },
      10,
      undefined,
      0,
    );
    if (!('proposal' in generated)) throw new Error('Expected a generated proposal');
    const model = JSON.parse(ai.callLlm.mock.calls[0][1]);
    expect(model.columns.find(column => column.name === 'code')).toMatchObject({
      numeric: false,
      businessType: 'category',
    });
    expect(model.columns.find(column => column.name === 'business_day')).toMatchObject({
      temporal: true,
      dateFormat: 'YYYY/MM/DD',
    });
    expect(generated.proposal.businessBasis.columns).toHaveLength(4);
    const preview = await proposals.preview({ proposal: generated.proposal }, 10, 0);
    expect(preview.preview.widgets[0].datas.map(row => Number(row.value))).toEqual([60]);
    expect(preview.preview.widgets[1].datas.map(row => Number(row.value))).toEqual([30, 30]);
    expect(await db.manager.count(Metric)).toBe(0);
  });
  it('persists frozen metric/dimension slices atomically and confirms a historical exact receipt with no new SQL', async () => {
    await addCatalog();
    const generated = await proposals.propose(
      { sourceId: 1, prompt: 'Amount by day' },
      10,
      undefined,
      0,
    );
    if (!('proposal' in generated)) throw new Error('Expected a generated proposal');
    await addCatalog(2, 'number');
    const body = {
      proposal: generated.proposal,
      previewDigest: generated.previewDigest,
      requestId: randomUUID(),
    };
    const saved = await creation.save(body, 10, 0);
    const row = await db.manager.findOneBy(Dashboard, { id: saved.id });
    const snapshot = JSON.parse(row.structuredDefinition);
    expect(snapshot.items[0].definition.businessBasis.columns.map(column => column.column)).toEqual(
      ['amount'],
    );
    expect(
      snapshot.items[1].dimensionDefinition.businessBasis.columns.map(column => column.column),
    ).toEqual(['business_day']);
    expect(JSON.parse(row.analysisDefinition).businessBasis.catalogVersion).toBe(1);
    await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 1 });
    const before = await Promise.all([
      db.manager.count(Metric),
      db.manager.count(Dashboard),
      db.manager.count(AnalysisCreationReceipt),
    ]);
    query.mockClear();
    await expect(creation.save(body, 10, 0)).resolves.toMatchObject({
      id: saved.id,
      replayed: true,
    });
    expect(query).not.toHaveBeenCalled();
    expect(
      await Promise.all([
        db.manager.count(Metric),
        db.manager.count(Dashboard),
        db.manager.count(AnalysisCreationReceipt),
      ]),
    ).toEqual(before);
    await expect(creation.save({ ...body, requestId: randomUUID() }, 10, 0)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.manager.count(Dashboard)).toBe(before[1]);
  });
  it('blocks reader epoch/read revocation at the endpoint after native profile SQL', async () => {
    await db.manager.save(EnterpriseResourceGrant, {
      resourceKind: 'source',
      resourceId: 1,
      recipientId: 20,
      ownerId: 10,
      organizationId: 1,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    const original = query.getMockImplementation();
    query.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[1].startsWith('DESCRIBE')) await db.manager.update(User, 20, { authVersion: 1 });
      return result;
    });
    await expect(bi.businessBasis({ sourceId: 1 }, 20, 0)).rejects.toMatchObject({ status: 401 });
    expect(await db.manager.count(Metric)).toBe(0);
  });
  it('keeps historical proposals valid but rejects a catalog change during actual save SQL with no writes', async () => {
    await addCatalog();
    const generated = await proposals.propose(
      { sourceId: 1, prompt: 'Amount by day' },
      10,
      undefined,
      0,
    );
    if (!('proposal' in generated)) throw new Error('Expected proposal');
    const original = query.getMockImplementation();
    let changed = false;
    query.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (!changed && args[1].includes('SUM("amount")')) {
        changed = true;
        await addCatalog(2, 'number');
      }
      return result;
    });
    await expect(
      creation.save(
        {
          proposal: generated.proposal,
          previewDigest: generated.previewDigest,
          requestId: randomUUID(),
        },
        10,
        0,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(changed).toBe(true);
    expect(await db.manager.count(Dashboard)).toBe(0);
    expect(await db.manager.count(Metric)).toBe(0);
    expect(await db.manager.count(AnalysisCreationReceipt)).toBe(0);
  });
  it('propagates saved-metric history infrastructure errors instead of generating a duplicate', async () => {
    await addCatalog();
    await bi.createMetric(metric(), 10, 0);
    const original = basisModule.resolveBusinessBasis;
    const failure = new Error('synthetic metadata unavailable');
    const spy = jest
      .spyOn(basisModule, 'resolveBusinessBasis')
      .mockImplementation(async (...args) => {
        if ((args[3] as any)?.columns?.length === 1) throw failure;
        return original(...args);
      });
    try {
      await expect(
        proposals.propose({ sourceId: 1, prompt: 'Amount' }, 10, undefined, 0),
      ).rejects.toBe(failure);
      expect(ai.callLlm).not.toHaveBeenCalled();
      expect(await db.manager.count(Metric)).toBe(1);
      expect(await db.manager.count(Dashboard)).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
