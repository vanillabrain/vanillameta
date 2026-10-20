import { semanticMetadata, assertSemanticMysqlIdentity } from '../../test/util/semantic-mysql';
import { PublicationService } from '../bi/publication.service';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { randomUUID } from 'crypto';
import { isCanonicalMetricWidget } from './studio-remix-template';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { DuckDBInstance } from '@duckdb/node-api';
import { businessSchemaRevision } from '../bi/semantic-business-basis';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioPublicationService } from './studio-publication.service';
import { StudioRemixService } from './studio-remix.service';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
import { studioDigest } from './studio-legacy';
import { StudioService } from './studio.service';
import { StudioCreationService } from './studio-creation.service';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('UC050 Studio business basis with real DuckDB and metadata persistence', () => {
  jest.setTimeout(30000);
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    bi: BiService,
    service: StudioCreationService,
    studio: StudioService,
    root: string,
    connection: any;
  let file: any, publications: StudioPublicationService, remix: StudioRemixService;
  const files = new Map<number, string>();
  const fileNames = new Map<number, string>();
  const llm = { callLlm: jest.fn() };
  const previous = process.env.FILE_UPLOAD_DIR;
  const provider = process.env.AI_PROVIDER;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t6-'));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.AI_PROVIDER = 'codex';
    worker = new DuckDBService();
    file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'code,amount,day,unused\n101,10,2026/01/01,private notes\n102,20,2026/01/01,private notes\n101,30,2026/01/02,private notes\n',
      ),
    });
    const native = await DuckDBInstance.create(file.filename);
    const conn = await native.connect();
    await conn.run('ALTER TABLE uploaded_data ALTER COLUMN day TYPE VARCHAR');
    await conn.run(
      "UPDATE uploaded_data SET day = CASE WHEN amount = 30 THEN '2026/01/02' ELSE '2026/01/01' END",
    );
    conn.closeSync();
    native.closeSync();
    files.set(1, file.filename);
    fileNames.set(1, 'fixture.duckdb');
    for (const sourceId of [3, 4, 5, 6]) {
      const extra = await worker.importFile({
        originalname: 'dates.csv',
        buffer: Buffer.from(
          'code,amount,day,unused\n101,10,2026/01/01,x\n102,20,2026/01/01,x\n101,30,2026/01/02,x\n' +
            ([3, 6].includes(sourceId)
              ? '101,0,2026/01/01,x\n101,0,2026/01/01,x\n101,0,2026/01/02,x\n'
              : ''),
        ),
      });
      const native = await DuckDBInstance.create(extra.filename);
      const conn = await native.connect();
      await conn.run('ALTER TABLE uploaded_data ALTER COLUMN day TYPE VARCHAR');
      const first = sourceId === 4 ? '20260101' : sourceId === 5 ? '2026-01-01' : '2026/01/01';
      const second = sourceId === 4 ? '20260102' : sourceId === 5 ? '2026-01-02' : '2026/01/02';
      await conn.run(
        `UPDATE uploaded_data SET day = CASE WHEN amount = 30 THEN '${second}' WHEN amount = 0 THEN '${
          sourceId === 3 ? '2026/02/29' : ''
        }' ELSE '${first}' END`,
      );
      conn.closeSync();
      native.closeSync();
      files.set(sourceId, extra.filename);
      fileNames.set(sourceId, 'fixture-' + sourceId + '.duckdb');
    }
    db = await semanticMetadata('studio', {
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
        User,
        EnterpriseMembership,
        StudioPublication,
        DashboardPublication,
        StudioPublicationRequest,
        StudioRemixRequest,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
      ],
    });
    await db.manager.save(User, {
      id: 7,
      userId: 'studio-owner',
      email: 'studio-owner@example.invalid',
      password: 'not-a-login-credential',
      active: true,
      authVersion: 0,
    });
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Source',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: 'fixture.duckdb' },
      }),
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const sourceId of [3, 4, 5, 6])
      await db.manager.save(Database, {
        id: sourceId,
        ownerId: 7,
        name: 'Dates ' + sourceId,
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: fileNames.get(sourceId) },
        }),
      });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async id =>
        createHash('sha256')
          .update(fileNames.get(id) ?? 'fixture.duckdb')
          .digest('hex'),
      ),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((id, sql, bindings) =>
        worker.query(files.get(id) ?? file.filename, sql, bindings),
      ),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    bi = new BiService(db, access, connection, dashboards);
    studio = new StudioService(db, dashboards, connection, access);
    service = new StudioCreationService(db, bi, llm as any, dashboards, connection, access, studio);
    publications = new StudioPublicationService(db, studio, access, connection);
    remix = new StudioRemixService(
      db,
      studio,
      publications,
      service,
      dashboards,
      connection,
      access,
    );
  });
  beforeEach(async () => {
    await db.manager.clear(SourceCatalogEntry);
    await db.manager.update(User, 7, { active: true, authVersion: 0 });
    llm.callLlm.mockReset().mockResolvedValue(JSON.stringify(businessBlocks()));
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
  });
  const propose = (extra = {}) =>
    service.propose({ sourceId: 1, prompt: '매출과 코드별 매출, 날짜별 매출', ...extra }, 7);
  const save = (p: any, requestId = 'create-' + p.proposalId) =>
    service.create(
      { proposalId: p.proposalId, expectedSourceRevision: p.sourceRevision, requestId },
      7,
    );

  const businessBlocks = () => ({
    requiredFields: ['amount', 'code', 'day'],
    title: 'Business totals',
    semanticProposal: [
      {
        title: 'Total',
        kind: 'BOARD_NUMERIC',
        metric: { label: 'Amount', aggregation: 'SUM', column: 'amount' },
      },
      {
        title: 'Codes',
        kind: 'CHART_COLUMN',
        metric: { label: 'Amount', aggregation: 'SUM', column: 'amount' },
        dimension: { column: 'code' },
      },
      {
        title: 'Days',
        kind: 'CHART_LINE',
        metric: { label: 'Amount', aggregation: 'SUM', column: 'amount' },
        dimension: { column: 'day' },
      },
    ],
  });
  const catalog = async (version = 1, changes: any = {}, sourceId = 1) => {
    const profile = await service.profile(sourceId, 7);
    await db.manager.save(SourceCatalogEntry, {
      sourceId,
      version,
      actorId: 7,
      sourceRevision: profile.dataVersion,
      schemaRevision: businessSchemaRevision(profile),
      metadata: JSON.stringify({
        label: 'Business',
        description: '',
        columns: profile.columns.map(c => ({
          column: c.name,
          label: c.name === 'amount' ? '매출' : c.name,
          description: c.name === 'unused' ? 'UNUSED_PRIVATE_DESCRIPTION' : '',
          unit: c.name === 'amount' ? 'USD' : '',
          classification: '',
          businessType:
            c.name === 'amount'
              ? 'number'
              : c.name === 'code'
              ? 'category'
              : c.name === 'day'
              ? 'date'
              : 'auto',
          dateFormat: c.name === 'day' ? 'YYYY/MM/DD' : '',
          ...(changes[c.name] ?? {}),
        })),
      }),
    });
  };
  const publish = async (saved: any) =>
    publications.publish(
      saved.dashboardId,
      {
        requestId: 'pub-' + saved.dashboardId,
        expectedRevision: saved.document.revision,
        visibility: 'link',
        allowRemix: true,
      },
      7,
    );
  const rows = (p: any, i: number) => p.preview.widgets[i].datas;
  it('computes numeric categories and full string-date groups, saves/reloads frozen snapshots and publishes only used private recipe metadata', async () => {
    await catalog();
    const p = await propose();
    expect(rows(p, 0)).toEqual([{ value: 60 }]);
    expect(rows(p, 1)).toEqual([
      { dimension: 101, value: 40 },
      { dimension: 102, value: 20 },
    ]);
    expect(rows(p, 2).map(r => r.value)).toEqual([30, 30]);
    expect(p.semanticProposal[0].metric.unit).toBe('USD');
    expect(p.businessBasis.columns.map(c => c.column)).toEqual(['amount', 'code', 'day', 'unused']);
    expect(p.contextBusinessBasis).toBeUndefined();
    const saved = await save(p);
    const reload = await studio.get(saved.dashboardId, 7);
    expect(
      reload.document.blocks[2].dimensionRefs[0].businessBasis.columns.map(c => c.column),
    ).toEqual(['day']);
    expect(reload.preview.widgets[2].datas.map(r => r.value)).toEqual([30, 30]);
    const metadata = await publish(saved);
    const stored = await db.manager.findOneByOrFail(StudioPublication, { token: metadata.token });
    const template = JSON.parse(stored.remixTemplate);
    expect(template.blocks.every(b => b.supported)).toBe(true);
    expect(stored.remixTemplate).not.toContain('UNUSED_PRIVATE_DESCRIPTION');
    expect(stored.snapshot).not.toMatch(/businessBasis|nativeType|classificationRef|try_strptime/);
    expect(JSON.stringify(await remix.template(metadata.token, 7))).not.toContain('businessBasis');
  });
  it.each(['SUM', 'AVG', 'MIN', 'MAX', 'RATIO_SUM', 'WEIGHTED_AVG'])(
    'refuses category %s before writes',
    async aggregation => {
      await catalog();
      const response = businessBlocks();
      response.semanticProposal = [response.semanticProposal[0]];
      Object.assign(response.semanticProposal[0].metric, {
        aggregation,
        column: 'code',
        denominatorColumn: 'amount',
        weightColumn: 'amount',
        scale: 1,
      });
      llm.callLlm.mockResolvedValue(JSON.stringify(response));
      const count = await db.manager.count(Metric);
      await expect(propose()).rejects.toThrow();
      expect(await db.manager.count(Metric)).toBe(count);
    },
  );
  it('freezes parent context and non-target blocks, explicitly adopts current basis into a new target and permits historical save', async () => {
    await catalog();
    const p = await propose();
    await catalog(2, { amount: { label: 'Latest amount', unit: 'KRW' } });
    const response = businessBlocks();
    response.semanticProposal = [response.semanticProposal[1]];
    response.semanticProposal[0].title = 'Updated codes';
    llm.callLlm.mockResolvedValue(JSON.stringify(response));
    const followup = {
      parentProposalId: p.proposalId,
      targetBlockIndex: 1,
      prompt: '코드별 제목 변경',
    };
    const frozen = await propose(followup);
    expect(frozen.semanticProposal[1].metric.businessBasis.catalogVersion).toBe(1);
    const adopted = await propose({ ...followup, adoptLatestBusinessBasis: true });
    expect(adopted.proposalId).not.toBe(frozen.proposalId);
    expect(studioDigest(adopted)).not.toBe(studioDigest(frozen));
    expect(adopted.semanticProposal[1].metric.businessBasis.catalogVersion).toBe(2);
    expect(adopted.semanticProposal[1].metric.unit).toBe('KRW');
    expect(adopted.semanticProposal[0]).toEqual(p.semanticProposal[0]);
    expect(adopted.semanticProposal[2]).toEqual(p.semanticProposal[2]);
    expect((await save(p)).dashboardId).toBeGreaterThan(0);
    const newest = await propose();
    expect(newest.businessBasis.catalogVersion).toBe(2);
  });
  it('detects a catalog edit during inference and keeps the old proposal usable', async () => {
    await catalog();
    const original = await propose();
    llm.callLlm.mockImplementationOnce(async () => {
      await catalog(2, { amount: { unit: 'KRW' } });
      return JSON.stringify(businessBlocks());
    });
    await expect(propose()).rejects.toThrow(/업무 기준/);
    expect((await service.proposal(original.proposalId, 1, 7)).proposalId).toBe(
      original.proposalId,
    );
  });
  it('preserves native reused metric definitions under new category declarations', async () => {
    const metric = await db.manager.save(Metric, {
      name: 'native-code-sum',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'code',
      useYn: 'Y',
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: 1,
        tableName: 'uploaded_data',
        label: 'Native code sum',
        aggregation: 'SUM',
        column: 'code',
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'plain',
      }),
    });
    await catalog();
    const original = JSON.parse(metric.definition);
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['code'],
        title: 'Native',
        semanticProposal: [
          {
            title: 'Native',
            kind: 'BOARD_NUMERIC',
            metric: { id: metric.id, definitionVersion: 1 },
          },
        ],
      }),
    );
    const p = await propose({ selectedMetricIds: [metric.id] });
    const definition = { ...p.semanticProposal[0].metric };
    delete definition.id;
    expect(definition).toEqual(original);
    expect(rows(p, 0)).toEqual([{ value: 304 }]);
    await save(p);
    expect(
      JSON.parse((await db.manager.findOneByOrFail(Metric, { id: metric.id })).definition),
    ).toEqual(original);
  });
  it('rebinds compatible remixes to exact target history, blocks changed execution meaning, and never copies origin catalog references', async () => {
    await catalog();
    const saved = await save(await propose());
    const publication = await publish(saved);
    const original = await db.manager.findOneByOrFail(Database, { id: 1 });
    await db.manager.save(Database, { ...original, id: 2, name: 'Target' });
    await catalog(7, { code: { classification: 'target category', classificationRef: null } }, 2);
    const requirements = await remix.template(publication.token, 7);
    const request = {
      expectedVersion: requirements.version,
      expectedLifecycleRevision: requirements.lifecycleRevision,
      targetSourceId: 2,
      mapping: {},
    };
    const preview = await remix.preview(publication.token, request, 7);
    expect(preview.unmappedBlocks).toHaveLength(0);
    expect(preview.preview.widgets[2].datas.map(r => r.value)).toEqual([30, 30]);
    const result = await remix.remix(
      publication.token,
      { ...request, requestId: 'business-remix', expectedSourceRevision: preview.sourceRevision },
      7,
    );
    const row = await db.manager.findOneByOrFail(Dashboard, { id: result.dashboardId });
    const snapshot = JSON.parse(row.structuredDefinition);
    expect(
      snapshot.items.every(item => !item.businessBasis.columns.some(c => c.column === 'unused')),
    ).toBe(true);
    expect(snapshot.items[2].dimensionBusinessBasis.catalogVersion).toBe(7);
    expect(snapshot.items[1].dimensionBusinessBasis.columns[0].classificationRef).toBeNull();
    expect(
      (await studio.get(result.dashboardId, 7)).preview.widgets[1].datas.map(r => r.value),
    ).toEqual([40, 20]);
    await catalog(8, { code: { businessType: 'number' } }, 2);
    const incompatible = await remix.preview(publication.token, request, 7);
    expect(incompatible.fields.find(f => f.sourceColumn === 'code').status).toBe('incompatible');
    expect(incompatible.unmappedBlocks.some(b => b.title === 'Codes')).toBe(true);
  });
  it.each([
    [4, 'YYYYMMDD'],
    [5, 'YYYY-MM-DD'],
  ])(
    'executes fixed date format on source %s through save/reload',
    async (sourceId: number, format: string) => {
      await catalog(1, { day: { dateFormat: format } }, sourceId);
      const p = await propose({ sourceId });
      expect(rows(p, 2).map(r => r.value)).toEqual([30, 30]);
      const saved = await save(p);
      expect(
        (await studio.get(saved.dashboardId, 7)).preview.widgets[2].datas.map(r => r.value),
      ).toEqual([30, 30]);
    },
  );
  it.each([3, 6])(
    'rejects invalid or blank dates beyond the five-row profile sample on source %s with no artifacts',
    async sourceId => {
      await catalog(1, {}, sourceId);
      const before = await Promise.all([db.manager.count(Metric), db.manager.count(Dashboard)]);
      const query = connection.queryDuckDB.getMockImplementation();
      let scans = 0;
      connection.queryDuckDB.mockImplementation((...args) => {
        if (/invalid_/.test(args[1])) {
          scans++;
          expect(db.createQueryRunner().isTransactionActive).toBe(false);
        }
        return query(...args);
      });
      try {
        await expect(propose({ sourceId })).rejects.toMatchObject({
          response: { code: 'INVALID_BUSINESS_DATES' },
        });
      } finally {
        connection.queryDuckDB.mockImplementation(query);
      }
      expect(scans).toBeGreaterThan(0);
      expect(await Promise.all([db.manager.count(Metric), db.manager.count(Dashboard)])).toEqual(
        before,
      );
    },
  );
  it('guards an invalid-date error with the captured account epoch before disclosing details', async () => {
    await catalog(1, {}, 3);
    const query = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (...args) => {
      const result = await query(...args);
      if (/invalid_/.test(args[1])) await db.manager.update(User, 7, { authVersion: 1 });
      return result;
    });
    try {
      await expect(propose({ sourceId: 3 })).rejects.toMatchObject({ status: 401 });
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('rejects missing history at final persistence and replays a committed receipt without running date or aggregate SQL', async () => {
    await catalog();
    const p = await propose();
    const before = await Promise.all([db.manager.count(Metric), db.manager.count(Dashboard)]);
    const prepare = dashboards.prepareSave.bind(dashboards);
    const spy = jest.spyOn(dashboards, 'prepareSave').mockImplementationOnce(async (...args) => {
      const result = await prepare(...args);
      await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 1 });
      return result;
    });
    try {
      await expect(save(p)).rejects.toThrow(/업무 기준/);
    } finally {
      spy.mockRestore();
    }
    expect(await Promise.all([db.manager.count(Metric), db.manager.count(Dashboard)])).toEqual(
      before,
    );
    await catalog();
    const saved = await save(p, 'historical-receipt');
    const queries = connection.queryDuckDB.mock.calls.length;
    expect(await save(p, 'historical-receipt')).toEqual(JSON.parse(JSON.stringify(saved)));
    expect(connection.queryDuckDB.mock.calls.length).toBe(queries);
  });
  it('preserves explicitly native non-target lineage when a parent adopts its first business catalog', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['amount'],
        title: 'Native',
        semanticProposal: [
          {
            title: 'Native total',
            kind: 'BOARD_NUMERIC',
            metric: { label: 'Native', aggregation: 'SUM', column: 'amount' },
          },
        ],
      }),
    );
    const p = await propose();
    expect(p.semanticProposal[0].businessBasis).toBeUndefined();
    expect(p.semanticProposal[0].defaultDateColumn).toBeUndefined();
    await catalog();
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['amount', 'day'],
        title: 'ignored',
        semanticProposal: [businessBlocks().semanticProposal[2]],
      }),
    );
    const adopted = await propose({
      parentProposalId: p.proposalId,
      targetBlockIndex: 'append',
      adoptLatestBusinessBasis: true,
    });
    expect(adopted.semanticProposal[0]).toMatchObject(p.semanticProposal[0]);
    expect(adopted.semanticProposal[0].businessBasis.catalogVersion).toBeNull();
    expect(adopted.semanticProposal[0].defaultDateColumn).toBeNull();
    expect(adopted.businessBasis.catalogVersion).toBe(1);
    const saved = await save(adopted);
    const row = await db.manager.findOneByOrFail(Dashboard, { id: saved.dashboardId });
    const draft = JSON.parse(row.analysisDefinition);
    expect(draft.widgets[0].businessBasis.catalogVersion).toBeNull();
    expect(draft.widgets[0].defaultDateColumn).toBeNull();
    expect(draft.widgets[1].businessBasis.catalogVersion).toBe(1);
  });
  it('proves only exact server date SQL and rejects arbitrary function or grouping changes', async () => {
    await catalog();
    const p = await propose();
    const block = p.semanticProposal[2],
      widget =
        p.preview.draft?.widgets?.[2] ??
        service.compile(1, p.title, p.semanticProposal, p.profile, p.businessBasis).widgets[2];
    const profile = await service.profile(1, 7);
    expect(
      isCanonicalMetricWidget(
        widget,
        block.metric,
        block.dimension.column,
        profile,
        block.dimension.businessBasis,
      ),
    ).toBe(true);
    expect(
      isCanonicalMetricWidget(
        { ...widget, sql: widget.sql.replace('try_strptime', 'strptime') },
        block.metric,
        block.dimension.column,
        profile,
        block.dimension.businessBasis,
      ),
    ).toBe(false);
    expect(
      isCanonicalMetricWidget(
        { ...widget, sql: widget.sql + ' UNION SELECT 1,2' },
        block.metric,
        block.dimension.column,
        profile,
        block.dimension.businessBasis,
      ),
    ).toBe(false);
  });
  it('rejects an omitted used category declaration rather than falling back to a native numeric SUM', async () => {
    await catalog();
    const p = await propose();
    const blocks = JSON.parse(JSON.stringify(p.semanticProposal));
    blocks[0].metric.aggregation = 'SUM';
    blocks[0].metric.column = 'code';
    blocks[0].metric.businessBasis.columns = [];
    const count = await db.manager.count(Metric);
    await expect(
      (service as any).revalidate(blocks, await service.profile(1, 7), db.manager),
    ).rejects.toThrow(/업무 기준/);
    expect(await db.manager.count(Metric)).toBe(count);
  });
  const legacyPublication = () =>
    new PublicationService(
      db.getRepository(DashboardPublication),
      db.getRepository(Dashboard),
      new SourceAccessService(db),
      dashboards,
      bi,
    );
  it('publishes exact frozen business-date SQL through legacy snapshots while leaving contribution unsupported', async () => {
    await catalog();
    const saved = await save(await propose());
    const legacy = legacyPublication();
    const previewSpy = jest.spyOn(dashboards, 'preview');
    const preview = await legacy.preview(saved.dashboardId, 7, {
      expectedRevision: saved.document.revision,
    });
    const internal = await previewSpy.mock.results[0].value;
    expect(internal.data.widgets[2].contribution.supported).toBe(false);
    previewSpy.mockRestore();
    expect(preview.snapshot.widgets[2].datas.map(r => r.value)).toEqual([30, 30]);
    expect(JSON.stringify(preview.snapshot)).not.toMatch(
      /businessBasis|try_strptime|UNUSED_PRIVATE_DESCRIPTION|classificationRef/,
    );
    const result = await legacy.publish(saved.dashboardId, 7, {
      expectedRevision: saved.document.revision,
      expectedVersion: 0,
      ticket: preview.ticket,
      requestId: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      visibility: 'link',
    });
    expect((await legacy.publicResult(result.publication.uuid)).snapshot).toEqual(preview.snapshot);
  });
  it('rejects changed frozen history at legacy publication CAS without new SQL or a publication row', async () => {
    await catalog();
    const saved = await save(await propose());
    const legacy = legacyPublication();
    const preview = await legacy.preview(saved.dashboardId, 7, {
      expectedRevision: saved.document.revision,
    });
    await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 1 });
    const queries = connection.queryDuckDB.mock.calls.length;
    await expect(
      legacy.publish(saved.dashboardId, 7, {
        expectedRevision: saved.document.revision,
        expectedVersion: 0,
        ticket: preview.ticket,
        requestId: randomUUID(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        visibility: 'link',
      }),
    ).rejects.toThrow(/업무 기준/);
    expect(connection.queryDuckDB.mock.calls.length).toBe(queries);
    expect(
      await db.manager.count(DashboardPublication, { where: { dashboardId: saved.dashboardId } }),
    ).toBe(0);
  });
  it('declines legacy raw-SQL reuse of private business context instead of copying unused catalog metadata', async () => {
    await catalog();
    const saved = await save(await propose());
    await expect(
      legacyPublication().preview(saved.dashboardId, 7, {
        expectedRevision: saved.document.revision,
        allowReuse: true,
      }),
    ).rejects.toThrow(/Studio/);
    expect(
      await db.manager.count(DashboardPublication, { where: { dashboardId: saved.dashboardId } }),
    ).toBe(0);
  });
  it('fences the trusted request token epoch before proposing or accepting a creation receipt', async () => {
    await expect(
      service.propose({ sourceId: 1, prompt: 'Amount' }, 7, undefined, 1),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.create(
        { requestId: 'stale-epoch', proposalId: 'stale', expectedSourceRevision: 'a'.repeat(64) },
        7,
        1,
      ),
    ).rejects.toMatchObject({ status: 401 });
    await catalog();
    const p = await propose();
    await save(p, 'committed-before-epoch');
    const counts = await Promise.all([
      db.manager.count(Dashboard),
      db.manager.count(Metric),
      db.manager.count(StudioRun),
    ]);
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(
      service.propose({ sourceId: 1, prompt: 'Amount' }, 7, undefined, 0),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.create(
        {
          requestId: 'committed-before-epoch',
          proposalId: p.proposalId,
          expectedSourceRevision: p.sourceRevision,
        },
        7,
        0,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      await Promise.all([
        db.manager.count(Dashboard),
        db.manager.count(Metric),
        db.manager.count(StudioRun),
      ]),
    ).toEqual(counts);
  });
  const mysqlOnly = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  const peerDatabase = async () => {
    const peer = await new DataSource({ ...db.options, synchronize: false }).initialize();
    await assertSemanticMysqlIdentity(peer);
    return peer;
  };
  const observeLockWait = async (peer: DataSource, table: string, blockerId: number) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const rows = await peer.query(
        `SELECT r.PROCESSLIST_ID AS requestingId, b.PROCESSLIST_ID AS blockingId FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID JOIN performance_schema.threads r ON r.THREAD_ID=w.REQUESTING_THREAD_ID JOIN performance_schema.threads b ON b.THREAD_ID=w.BLOCKING_THREAD_ID WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME=?`,
        [table],
      );
      if (rows.length) {
        expect(Number(rows[0].blockingId)).toBe(blockerId);
        expect(Number(rows[0].requestingId)).not.toBe(blockerId);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected actual InnoDB lock wait for ' + table);
  };
  mysqlOnly(
    'fences an epoch committed by another connection while creation waits on an actual User lock',
    async () => {
      await catalog();
      const p = await propose();
      const peer = await peerDatabase();
      const tx = peer.createQueryRunner();
      let pending: Promise<any> | undefined;
      const before = await Promise.all([
        db.manager.count(Dashboard),
        db.manager.count(Metric),
        db.manager.count(StudioRun),
      ]);
      try {
        await tx.startTransaction();
        await tx.manager.findOne(User, { where: { id: 7 }, lock: { mode: 'pessimistic_write' } });
        await tx.manager.update(User, 7, { authVersion: 1 });
        pending = service
          .create(
            {
              requestId: 'actual-user-wait',
              proposalId: p.proposalId,
              expectedSourceRevision: p.sourceRevision,
            },
            7,
            0,
          )
          .then(
            value => ({ value }),
            error => ({ error }),
          );
        const [blocking] = await tx.query('SELECT CONNECTION_ID() AS id');
        await observeLockWait(peer, 'user', Number(blocking.id));
        await tx.commitTransaction();
        expect((await pending).error).toMatchObject({ status: 401 });
        expect(
          await Promise.all([
            db.manager.count(Dashboard),
            db.manager.count(Metric),
            db.manager.count(StudioRun),
          ]),
        ).toEqual(before);
      } finally {
        if (tx.isTransactionActive) await tx.rollbackTransaction();
        if (pending) await pending;
        await tx.release();
        await peer.destroy();
      }
    },
  );
  mysqlOnly(
    'confirms one publication receipt under two independent MySQL connections and services',
    async () => {
      await catalog();
      const saved = await save(await propose());
      const peer = await peerDatabase();
      try {
        const access = new SourceAccessService(peer);
        const ai = new AiDashboardService({} as any, connection, peer.getRepository(Dashboard));
        const peerStudio = new StudioService(peer, ai, connection, access);
        const peerPublications = new StudioPublicationService(peer, peerStudio, access, connection);
        const body = {
          requestId: 'actual-concurrent-pub-' + saved.dashboardId,
          expectedRevision: saved.document.revision,
          visibility: 'private',
          allowRemix: true,
        };
        const before = await db.manager.count(StudioPublicationRequest);
        const [first, second] = await Promise.all([
          publications.publish(saved.dashboardId, body, 7),
          peerPublications.publish(saved.dashboardId, body, 7),
        ]);
        expect(first.token).toBe(second.token);
        expect(first.version).toBe(second.version);
        expect(await db.manager.count(StudioPublicationRequest)).toBe(before + 1);
        expect(
          await db.manager.count(StudioPublication, { where: { dashboardId: saved.dashboardId } }),
        ).toBe(1);
      } finally {
        await peer.destroy();
      }
    },
  );
  mysqlOnly(
    'rolls back real aggregate persistence and rejects a peer revision change without overwriting it',
    async () => {
      await catalog();
      const p = await propose();
      const prepared = await dashboards.prepareSave({ draft: p.preview.draft }, 7);
      const entities = [
        Dashboard,
        Metric,
        Dataset,
        Widget,
        DashboardWidget,
        UserMapping,
        StudioRun,
        StudioState,
      ];
      const before = await Promise.all(entities.map(entity => db.manager.count(entity)));
      const injected = new Error('synthetic rollback after all artifact writes');
      await expect(
        db.transaction(async manager => {
          await prepared.persist(manager);
          throw injected;
        }),
      ).rejects.toBe(injected);
      expect(await Promise.all(entities.map(entity => db.manager.count(entity)))).toEqual(before);
      const saved = await save(p);
      const loaded = (await dashboards.analysis(saved.dashboardId, 7, true)).data;
      const update = await dashboards.prepareSave(
        {
          dashboardId: saved.dashboardId,
          expectedRevision: loaded.revision,
          draft: { ...loaded, title: 'My draft' },
        },
        7,
      );
      const peer = await peerDatabase();
      try {
        await peer.manager.update(Dashboard, saved.dashboardId, { title: 'Peer committed title' });
        await expect(db.transaction(manager => update.persist(manager))).rejects.toMatchObject({
          status: 409,
        });
        expect(
          (await peer.manager.findOneByOrFail(Dashboard, { id: saved.dashboardId })).title,
        ).toBe('Peer committed title');
      } finally {
        await peer.destroy();
      }
    },
  );
});
