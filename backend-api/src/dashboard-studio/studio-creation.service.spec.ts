import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
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
import { studioDemoData } from './studio-demo-data';
import { BiService } from '../bi/bi.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('T6 semantic creation with real DuckDB and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    bi: BiService,
    service: StudioCreationService,
    studio: StudioService,
    root: string,
    marginDigest: string,
    connection: any;
  const llm = { callLlm: jest.fn() };
  const previous = process.env.FILE_UPLOAD_DIR;
  const provider = process.env.AI_PROVIDER;
  const semantics = () => ({
    requiredFields: ['amount', 'channel'],
    title: 'Revenue',
    semanticProposal: [
      {
        title: 'Revenue',
        kind: 'BOARD_NUMERIC',
        metric: {
          label: 'Revenue',
          aggregation: 'SUM',
          column: 'amount',
          unit: 'USD',
          decimalPlaces: 2,
          numberNotation: 'plain',
        },
      },
      {
        title: 'Channels',
        kind: 'CHART_COLUMN',
        metric: {
          label: 'Revenue',
          aggregation: 'SUM',
          column: 'amount',
          unit: 'USD',
          decimalPlaces: 2,
          numberNotation: 'plain',
        },
        dimension: { column: 'channel' },
      },
    ],
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t6-'));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.AI_PROVIDER = 'codex';
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'channel,amount,refund_amount,paid_orders,refunded_orders,event_time\nSite,300,30,1,1,2026-01-01T00:00:00Z\nMobile,200,0,1,0,2026-01-02T00:00:00Z\n',
      ),
    });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
        User,
        EnterpriseMembership,
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
    }).initialize();
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
    const margin = studioDemoData('margin');
    const marginFile = await worker.importFile({
      originalname: margin.filename,
      buffer: margin.csv,
    });
    marginDigest = createHash('sha256').update(margin.csv).digest('hex');
    await db.manager.save(Database, {
      id: 2,
      ownerId: 7,
      name: 'VM margin demo',
      description: 'studio-sample:vm-margin-v1-' + marginDigest,
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: 'vm-margin.duckdb' },
        fileVersions: [
          {
            id: path.basename(path.dirname(marginFile.filename)),
            filename: 'vm-margin.duckdb',
            originalname: margin.filename,
            rows: margin.rows,
            uploadedAt: new Date().toISOString(),
            sha256: marginDigest,
          },
        ],
      }),
      engine: 'duckdb',
      type: 'FILE',
      timezone: 'UTC',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    // Source 1 keeps its legacy sentinel filename. Each pinned source resolves to the real imported
    // file, and its recorded revision stays fixed, so metadata tampering still exercises the real
    // revision checks instead of being mirrored back by the mock.
    const pinned: Record<number, { file: string; filename: string }> = {
      1: { file: file.filename, filename: 'fixture.duckdb' },
      2: { file: marginFile.filename, filename: 'vm-margin.duckdb' },
    };
    const recordedFilename = async (id: number) =>
      pinned[id]?.filename ??
      JSON.parse((await db.manager.findOneByOrFail(Database, { id })).connectionConfig).connection
        .filename;
    const recordedFile = async (id: number) => pinned[id]?.file ?? (await recordedFilename(id));
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn(async (id: number) =>
        createHash('sha256')
          .update(await recordedFilename(id))
          .digest('hex'),
      ),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn(async (id: number, sql: string, bindings: any[]) =>
        worker.query(await recordedFile(id), sql, bindings),
      ),
    };
    const access = new SourceAccessService(db);
    dashboards = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    bi = new BiService(db, access, connection, dashboards);
    studio = new StudioService(db, dashboards, connection, access);
    service = new StudioCreationService(db, bi, llm as any, dashboards, connection, access, studio);
  });
  beforeEach(() => {
    llm.callLlm.mockReset().mockResolvedValue(JSON.stringify(semantics()));
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
    service.propose(
      { sourceId: 1, prompt: 'Show revenue and channels', ...extra },
      7,
      undefined,
      0,
    );
  const save = (p: any, requestId = 'create-' + p.proposalId) =>
    service.create(
      { proposalId: p.proposalId, expectedSourceRevision: p.sourceRevision, requestId },
      7,
    );
  it('passes the connected categorical meaning without private origin IDs or configuration to the model', async () => {
    const profile = service.profile.bind(service);
    const spy = jest.spyOn(service, 'profile').mockImplementation(async (...args) => ({
      ...(await profile(...args)),
      modelInfo: {
        type: 'lookup',
        factKey: 'channel',
        lookupAttributes: ['channel'],
        quality: { unmatchedFactRows: 1 },
        nonAdditiveColumns: [],
        factSourceId: 9999,
        lookupSourceId: 8888,
        filename: '/private/model-origin',
        sql: 'private-sql',
      },
    }));
    try {
      await propose();
      const user = JSON.parse(llm.callLlm.mock.calls[0][1]);
      expect(user.source.modelContext).toEqual({
        grain: 'one output row per original fact row',
        factKey: 'channel',
        lookupAttributes: ['channel'],
        unmatchedFactRows: 1,
        nonAdditiveColumns: [],
      });
      expect(JSON.stringify(user)).not.toMatch(/9999|8888|private-sql|private\/model-origin/);
    } finally {
      spy.mockRestore();
    }
  });
  it('previews and atomically stores real table/summary presentations without altering queries or source', async () => {
    const response = semantics();
    response.semanticProposal.forEach(block => {
      block.metric.label = 'Report aggregate';
    });
    Object.assign(response.semanticProposal[0], { presentation: 'summary' });
    Object.assign(response.semanticProposal[1], { presentation: 'table' });
    llm.callLlm.mockResolvedValueOnce(JSON.stringify(response));
    const proposal = await propose();
    expect(proposal.preview.widgets.map(w => w.presentation)).toEqual(['summary', 'table']);
    expect(proposal.preview.widgets[0].datas[0].value).toBe(500);
    const saved = await save(proposal);
    const loaded = await studio.get(saved.document.dashboardId, 7);
    expect(loaded.document.blocks.map(b => b.display.presentation)).toEqual(['summary', 'table']);
    expect(loaded.preview.widgets.map(w => w.presentation)).toEqual(['summary', 'table']);
    expect(loaded.preview.widgets[0].datas[0].value).toBe(500);
    expect(loaded.preview.widgets[1].datas.map(r => r.value).sort()).toEqual([200, 300]);
    expect(loaded.document.blocks[0].measureRefs).toEqual(loaded.document.blocks[1].measureRefs);
    expect((await save(proposal)).document.dashboardId).toBe(saved.document.dashboardId);
    const basis = {
      blockId: loaded.document.blocks[1].id,
      expectedRevision: loaded.document.revision,
      expectedSourceRevision: loaded.sourceRevision,
    };
    const handoff = await studio.exploreHandoff(saved.document.dashboardId, basis, 7);
    expect(handoff.state.dimensionColumns).toEqual(['channel']);
    expect(handoff.state.measureIds).toEqual([loaded.document.blocks[1].measureRefs[0].id]);
    expect(JSON.stringify(handoff)).not.toMatch(/sql|password|filename|datas/);
    await expect(studio.exploreHandoff(saved.document.dashboardId, basis, 9)).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      studio.exploreHandoff(
        saved.document.dashboardId,
        { ...basis, expectedRevision: 'f'.repeat(64) },
        7,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const metric = await db.manager.findOneByOrFail(Metric, { id: handoff.state.measureIds[0] });
    const original = metric.definition;
    await db.manager.update(Metric, metric.id, {
      definition: JSON.stringify({ ...JSON.parse(original), label: 'Same version replacement' }),
    });
    try {
      await expect(
        studio.exploreHandoff(saved.document.dashboardId, basis, 7),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await db.manager.update(Metric, metric.id, { definition: original });
    }
  });
  it.each(['table', '<script>'])(
    'rejects unsupported numeric report presentation %s before any write',
    async presentation => {
      const response = semantics();
      Object.assign(response.semanticProposal[0], { presentation });
      const before = await db.manager.count(Dashboard);
      llm.callLlm.mockResolvedValueOnce(JSON.stringify(response));
      await expect(propose()).rejects.toThrow();
      expect(await db.manager.count(Dashboard)).toBe(before);
    },
  );
  it.each(['KRW', 'USD'])(
    'sends pinned Commerce %s context without rewriting the user question',
    async currency => {
      const original = await db.manager.findOneByOrFail(Database, { id: 1 });
      const config = JSON.parse(original.connectionConfig),
        digest = 'a'.repeat(64);
      await db.manager.update(Database, 1, {
        description: `commerce-studio:order-cohort-v1:12:3:${digest}`,
        connectionConfig: JSON.stringify({
          ...config,
          commerceSnapshot: {
            projectId: 12,
            version: 3,
            digest,
            currency,
            timeBasis: 'order-cohort',
          },
          fileVersions: [{ filename: config.connection.filename }],
        }),
      });
      try {
        await propose();
        const [system, user] = llm.callLlm.mock.calls[0],
          payload = JSON.parse(user);
        expect(payload.prompt).toBe('Show revenue and channels');
        expect(payload.source.analysisContext).toEqual({
          currency,
          timezone: 'UTC',
          timeBasis: 'order-cohort',
          dateColumn: 'ordered_at',
          scope: 'all-time',
          grain: 'one row per order',
          revenue: 'successful payments per order',
          refunds: 'recorded refunds per order within this bundle',
        });
        expect(JSON.stringify(payload.source.analysisContext)).not.toMatch(
          /filename|digest|projectId|connection/,
        );
        expect(system).toContain('Do not convert currencies');
        llm.callLlm.mockClear();
        await propose({ prompt: '환불률 보여줘' });
        expect(llm.callLlm).not.toHaveBeenCalled();
        await db.manager.update(Database, 1, {
          connectionConfig: JSON.stringify({
            ...config,
            commerceSnapshot: {
              projectId: 12,
              version: 3,
              digest,
              currency,
              timeBasis: 'order-cohort',
            },
            fileVersions: [{ filename: 'replaced.duckdb' }],
          }),
        });
        await propose();
        expect(JSON.parse(llm.callLlm.mock.calls[0][1]).source.analysisContext).toBeUndefined();
      } finally {
        await db.manager.update(Database, 1, {
          description: original.description,
          connectionConfig: original.connectionConfig,
        });
      }
    },
  );
  it.each([
    ['wrong currency', 'SUM', 'refund_amount', 'USD', 0, undefined, undefined, false],
    ['missing money unit', 'SUM', 'refund_amount', '', 0, undefined, undefined, false],
    ['money as percentage', 'SUM', 'refund_amount', '%', 0, undefined, undefined, false],
    ['fractional won display', 'SUM', 'refund_amount', 'KRW', 2, undefined, undefined, false],
    ['count as money', 'SUM', 'paid_orders', 'KRW', 0, undefined, undefined, false],
    ['row count as money', 'COUNT', '*', 'KRW', 0, undefined, undefined, false],
    ['percentage as count', 'RATIO_SUM', 'refunded_orders', 'count', 2, 'paid_orders', 100, false],
    ['fraction as percentage', 'RATIO_SUM', 'paid_orders', '%', 2, 'paid_orders', 1, false],
    ['valid won', 'SUM', 'refund_amount', 'KRW', 0, undefined, undefined, true],
    ['valid count', 'SUM', 'paid_orders', 'count', 0, undefined, undefined, true],
    ['valid percentage', 'RATIO_SUM', 'refunded_orders', '%', 2, 'paid_orders', 100, true],
    ['valid fraction', 'RATIO_SUM', 'paid_orders', '', 3, 'paid_orders', 1, true],
    ['unsupported inverse unit', 'RATIO_SUM', 'paid_orders', 'count', 0, 'refund_amount', 1, false],
    ['money per order', 'RATIO_SUM', 'refund_amount', 'KRW', 0, 'paid_orders', 1, true],
    ['money share', 'RATIO_SUM', 'refund_amount', '%', 2, 'refund_amount', 100, true],
  ])(
    'checks Commerce units before preview: %s',
    async (_label, aggregation, column, unit, decimalPlaces, denominatorColumn, scale, valid) => {
      const original = await db.manager.findOneByOrFail(Database, { id: 1 });
      const config = JSON.parse(original.connectionConfig),
        digest = 'b'.repeat(64);
      await db.manager.update(Database, 1, {
        description: `commerce-studio:order-cohort-v1:12:3:${digest}`,
        connectionConfig: JSON.stringify({
          ...config,
          commerceSnapshot: {
            projectId: 12,
            version: 3,
            digest,
            currency: 'KRW',
            timeBasis: 'order-cohort',
          },
          fileVersions: [{ filename: config.connection.filename }],
        }),
      });
      const preview = jest.spyOn(dashboards, 'preview');
      const counts = await Promise.all(
        [Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity)),
      );
      const metric = {
        label: 'Value',
        aggregation,
        column,
        unit,
        decimalPlaces,
        ...(denominatorColumn ? { denominatorColumn, scale } : {}),
      };
      llm.callLlm.mockResolvedValueOnce(
        JSON.stringify({
          requiredFields:
            column === '*' ? [] : [column, ...(denominatorColumn ? [denominatorColumn] : [])],
          title: 'Units',
          semanticProposal: [{ title: 'Value', kind: 'BOARD_NUMERIC', metric }],
        }),
      );
      try {
        if (valid) {
          const proposal = await propose({ prompt: '지표를 보여 줘' });
          expect(proposal.semanticProposal[0].metric.unit).toBe(unit);
          expect(preview).toHaveBeenCalledTimes(1);
        } else {
          await expect(propose({ prompt: '지표를 보여 줘' })).rejects.toThrow('단위');
          expect(preview).not.toHaveBeenCalled();
        }
        expect(
          await Promise.all([Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity))),
        ).toEqual(counts);
      } finally {
        preview.mockRestore();
        await db.manager.update(Database, 1, {
          description: original.description,
          connectionConfig: original.connectionConfig,
        });
      }
    },
  );
  it.each([
    ['KRW', 'KRW', true],
    ['KRW', 'USD', false],
    ['USD', 'USD', true],
    ['USD', 'KRW', false],
  ])(
    'checks reused Commerce %s metric unit %s without rewriting it',
    async (currency, unit, valid) => {
      const original = await db.manager.findOneByOrFail(Database, { id: 1 });
      const config = JSON.parse(original.connectionConfig),
        digest = 'c'.repeat(64);
      const m = await bi.createMetric(
        {
          sourceId: 1,
          label: 'Pinned refund',
          aggregation: 'SUM',
          column: 'refund_amount',
          unit,
          decimalPlaces: currency === 'KRW' ? 0 : 2,
          numberNotation: 'plain',
        },
        7,
      );
      const before = await db.manager.findOneByOrFail(Metric, { id: m.id });
      await db.manager.update(Database, 1, {
        description: `commerce-studio:order-cohort-v1:12:3:${digest}`,
        connectionConfig: JSON.stringify({
          ...config,
          commerceSnapshot: {
            projectId: 12,
            version: 3,
            digest,
            currency,
            timeBasis: 'order-cohort',
          },
          fileVersions: [{ filename: config.connection.filename }],
        }),
      });
      llm.callLlm.mockResolvedValueOnce(
        JSON.stringify({
          requiredFields: ['refund_amount'],
          title: 'Reuse',
          semanticProposal: [
            {
              title: 'Value',
              kind: 'BOARD_NUMERIC',
              metric: { id: m.id, definitionVersion: m.definitionVersion },
            },
          ],
        }),
      );
      try {
        if (valid) {
          const proposal = await propose({ prompt: '금액 지표', selectedMetricIds: [m.id] });
          expect(proposal.semanticProposal[0].metric.id).toBe(m.id);
          expect(proposal.semanticProposal[0].metric.unit).toBe(unit);
        } else
          await expect(propose({ prompt: '금액 지표', selectedMetricIds: [m.id] })).rejects.toThrow(
            '단위',
          );
        expect((await db.manager.findOneByOrFail(Metric, { id: m.id })).definition).toBe(
          before.definition,
        );
      } finally {
        await db.manager.delete(Metric, m.id);
        await db.manager.update(Database, 1, {
          description: original.description,
          connectionConfig: original.connectionConfig,
        });
      }
    },
  );
  it('rechecks cached Commerce units and preserves source-version checks before writes', async () => {
    const original = await db.manager.findOneByOrFail(Database, { id: 1 });
    const config = JSON.parse(original.connectionConfig),
      digest = 'd'.repeat(64);
    const pin = currency =>
      db.manager.update(Database, 1, {
        description: `commerce-studio:order-cohort-v1:12:3:${digest}`,
        connectionConfig: JSON.stringify({
          ...config,
          commerceSnapshot: {
            projectId: 12,
            version: 3,
            digest,
            currency,
            timeBasis: 'order-cohort',
          },
          fileVersions: [{ filename: config.connection.filename }],
        }),
      });
    await pin('KRW');
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['refund_amount'],
        title: 'Amount',
        semanticProposal: [
          {
            title: 'Value',
            kind: 'BOARD_NUMERIC',
            metric: {
              label: 'Value',
              aggregation: 'SUM',
              column: 'refund_amount',
              unit: 'KRW',
              decimalPlaces: 0,
            },
          },
        ],
      }),
    );
    try {
      const proposal = await propose({ prompt: '금액 지표' });
      const counts = await Promise.all(
        [Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity)),
      );
      // Internal cache fault injection: create requests never accept client metric definitions.
      const cached = (service as any).proposals.get(proposal.proposalId).value;
      cached.semanticProposal[0].metric.unit = 'USD';
      await expect(save(proposal)).rejects.toThrow('단위');
      cached.semanticProposal[0].metric.unit = 'KRW';
      await pin('USD');
      await expect(save(proposal)).rejects.toThrow(/데이터 소스가 변경|지표 단위/);
      expect(
        await Promise.all([Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity))),
      ).toEqual(counts);
    } finally {
      await db.manager.update(Database, 1, {
        description: original.description,
        connectionConfig: original.connectionConfig,
      });
    }
  });
  it('does not guess Commerce semantics for ordinary files', async () => {
    await propose();
    expect(JSON.parse(llm.callLlm.mock.calls[0][1]).source.analysisContext).toBeUndefined();
  });
  const marginRow = () => db.manager.findOneByOrFail(Database, { id: 2 });
  const marginPatch = (config: any, description?: string) =>
    db.manager.update(Database, 2, {
      ...(description ? { description } : {}),
      connectionConfig: JSON.stringify(config),
    });
  it('sends the pinned VM margin context and accepts USD amounts and the margin percentage', async () => {
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['revenue', 'cost', 'profit', 'company'],
        title: 'Margin',
        semanticProposal: [
          {
            title: 'Revenue',
            kind: 'BOARD_NUMERIC',
            metric: {
              label: 'Revenue',
              aggregation: 'SUM',
              column: 'revenue',
              unit: 'USD',
              decimalPlaces: 2,
            },
          },
          {
            title: 'Margin',
            kind: 'BOARD_NUMERIC',
            metric: {
              label: 'Margin',
              aggregation: 'RATIO_SUM',
              column: 'profit',
              denominatorColumn: 'revenue',
              scale: 100,
              unit: '%',
              decimalPlaces: 2,
            },
          },
        ],
      }),
    );
    const proposal = await propose({ sourceId: 2, prompt: '고객사별 매출과 마진' });
    const [system, user] = llm.callLlm.mock.calls[0],
      payload = JSON.parse(user);
    expect(payload.source.analysisContext).toEqual({
      currency: 'USD',
      timezone: 'UTC',
      timeBasis: 'daily-demo',
      dateColumn: 'day',
      scope: 'all-time',
      grain: 'one row per customer/day',
      amounts:
        'revenue, cost and profit are recorded USD amounts; profit is the fixture profit column, not a stored metric definition',
    });
    expect(JSON.stringify(payload.source.analysisContext)).not.toMatch(
      /filename|sha256|digest|fileVersions|uploadedAt|studio-sample|uploads/,
    );
    expect(system).toContain('not Commerce');
    expect(system).not.toContain('server-verified Commerce snapshot semantics');
    expect(proposal.semanticProposal.map(b => b.metric.unit)).toEqual(['USD', '%']);
    expect(Number(proposal.preview.widgets[0].datas[0].value)).toBeCloseTo(14937.49, 6);
    expect(Number(proposal.preview.widgets[1].datas[0].value)).toBeCloseTo(17.7911416, 6);
  });
  it.each([
    ['wrong currency on an amount sum', 'SUM', 'revenue', 'KRW', 0, undefined, undefined, false],
    ['percentage label on an amount sum', 'SUM', 'profit', '%', 2, undefined, undefined, false],
    ['count label on an amount sum', 'SUM', 'cost', 'count', 2, undefined, undefined, false],
    ['USD amount', 'SUM', 'revenue', 'USD', 2, undefined, undefined, true],
    ['margin percentage', 'RATIO_SUM', 'profit', '%', 2, 'revenue', 100, true],
    ['cost share fraction', 'RATIO_SUM', 'cost', '', 3, 'revenue', 1, true],
  ])(
    'checks VM margin units before preview: %s',
    async (_label, aggregation, column, unit, decimalPlaces, denominatorColumn, scale, valid) => {
      const preview = jest.spyOn(dashboards, 'preview');
      const counts = await Promise.all(
        [Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity)),
      );
      const metric = {
        label: 'Value',
        aggregation,
        column,
        unit,
        decimalPlaces,
        ...(denominatorColumn ? { denominatorColumn, scale } : {}),
      };
      llm.callLlm.mockResolvedValueOnce(
        JSON.stringify({
          requiredFields: [column, ...(denominatorColumn ? [denominatorColumn] : [])],
          title: 'Units',
          semanticProposal: [{ title: 'Value', kind: 'BOARD_NUMERIC', metric }],
        }),
      );
      try {
        if (valid) {
          const proposal = await propose({ sourceId: 2, prompt: '마진 지표' });
          expect(proposal.semanticProposal[0].metric.unit).toBe(unit);
          expect(preview).toHaveBeenCalledTimes(1);
        } else {
          await expect(propose({ sourceId: 2, prompt: '마진 지표' })).rejects.toThrow('단위');
          expect(preview).not.toHaveBeenCalled();
        }
        expect(
          await Promise.all([Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity))),
        ).toEqual(counts);
      } finally {
        preview.mockRestore();
      }
    },
  );
  it.each([
    [
      'a replaced active file version',
      (config: any) => ({
        config: {
          ...config,
          fileVersions: [{ ...config.fileVersions[0], filename: 'replaced.duckdb' }],
        },
      }),
    ],
    [
      'an extra recorded version',
      (config: any) => ({
        config: {
          ...config,
          fileVersions: [
            config.fileVersions[0],
            { ...config.fileVersions[0], filename: 'replaced.duckdb' },
          ],
        },
      }),
    ],
    [
      'a version checksum that no longer matches the fixture',
      (config: any) => ({
        config: {
          ...config,
          fileVersions: [{ ...config.fileVersions[0], sha256: 'e'.repeat(64) }],
        },
      }),
    ],
    [
      'a description tag for another fixture digest',
      (config: any) => ({ config, description: 'studio-sample:vm-margin-v1-' + 'f'.repeat(64) }),
    ],
  ] as Array<[string, (config: any) => { config: any; description?: string }]>)(
    'drops the VM margin contract for %s and never infers units from an ordinary file',
    async (_label, replace) => {
      const original = await marginRow();
      const { config, description } = replace(JSON.parse(original.connectionConfig));
      await marginPatch(config, description);
      llm.callLlm.mockResolvedValueOnce(
        JSON.stringify({
          requiredFields: ['revenue'],
          title: 'Units',
          semanticProposal: [
            {
              title: 'Value',
              kind: 'BOARD_NUMERIC',
              metric: {
                label: 'Value',
                aggregation: 'SUM',
                column: 'revenue',
                unit: 'KRW',
                decimalPlaces: 2,
              },
            },
          ],
        }),
      );
      try {
        const proposal = await propose({ sourceId: 2, prompt: '매출 금액' });
        expect(JSON.parse(llm.callLlm.mock.calls[0][1]).source.analysisContext).toBeUndefined();
        expect(proposal.semanticProposal[0].metric.unit).toBe('KRW');
      } finally {
        await marginPatch(JSON.parse(original.connectionConfig), original.description);
      }
    },
  );
  it('rechecks cached VM margin units before writing', async () => {
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['revenue'],
        title: 'Margin revenue',
        semanticProposal: [
          {
            title: 'Revenue',
            kind: 'BOARD_NUMERIC',
            metric: {
              label: 'Revenue',
              aggregation: 'SUM',
              column: 'revenue',
              unit: 'USD',
              decimalPlaces: 2,
            },
          },
        ],
      }),
    );
    const proposal = await propose({ sourceId: 2, prompt: '매출 금액' });
    const counts = await Promise.all(
      [Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity)),
    );
    // Internal cache fault injection: create requests never accept client metric definitions.
    const cached = (service as any).proposals.get(proposal.proposalId).value;
    cached.semanticProposal[0].metric.unit = 'KRW';
    await expect(save(proposal)).rejects.toThrow('단위');
    expect(
      await Promise.all([Dashboard, Metric, StudioRun].map(entity => db.manager.count(entity))),
    ).toEqual(counts);
    cached.semanticProposal[0].metric.unit = 'USD';
    expect((await save(proposal)).document.blocks[0].measureRefs).toBeDefined();
  });
  it('T15 reads only owned live proposals and restores the exact committed creation journal', async () => {
    const unique = semantics();
    unique.semanticProposal.forEach(b => {
      b.metric.label = 'T15 receipt revenue';
    });
    llm.callLlm.mockResolvedValueOnce(JSON.stringify(unique));
    const p = await propose();
    expect((await service.proposal(p.proposalId, 1, 7)).proposalId).toBe(p.proposalId);
    await expect(service.proposal(p.proposalId, 1, 8)).rejects.toThrow();
    await expect(service.proposal('expired', 1, 7)).rejects.toThrow('만료');
    const request = {
      proposalId: p.proposalId,
      expectedSourceRevision: p.sourceRevision,
      requestId: 't15-receipt',
    };
    expect(await service.receipt(request, 7)).toBeUndefined();
    const first = await service.create(request, 7);
    expect((await service.create(request, 7)).dashboardId).toBe(first.dashboardId);
    expect((await service.receipt(request, 7)).dashboardId).toBe(first.dashboardId);
    await expect(service.receipt({ ...request, proposalId: 'other' }, 7)).rejects.toThrow();
    expect(await service.receipt(request, 8)).toBeUndefined();
    await expect(service.proposal(p.proposalId, 1, 7)).rejects.toThrow('만료');
  });
  it('T15 separates physical file revision from metadata profile revision and rejects stale files before the model', async () => {
    await expect(propose({ expectedFileRevision: '0'.repeat(64) })).rejects.toThrow('원본 파일');
    expect(llm.callLlm).not.toHaveBeenCalled();
    const physical = await connection.duckDBVersion(1);
    const p = await propose({ expectedFileRevision: physical });
    expect(p.sourceRevision).not.toBe(physical);
    expect(p.preview.widgets[0].datas).toEqual([{ value: 500 }]);
  });
  it('T15 expires a real cached proposal without implicitly calling the model again', async () => {
    const p = await propose();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
    try {
      await expect(service.proposal(p.proposalId, 1, 7)).rejects.toThrow('만료');
    } finally {
      clock.mockRestore();
    }
    expect(llm.callLlm).toHaveBeenCalledTimes(1);
  });
  it('A6 reports definitive missing proposal only after checking for an existing receipt', async () => {
    const before = await db.manager.count(Dashboard);
    const p = await propose();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
    try {
      await expect(save(p)).rejects.toMatchObject({
        response: { code: 'STUDIO_CREATION_REPROPOSE_REQUIRED' },
      });
    } finally {
      clock.mockRestore();
    }
    expect(await db.manager.count(Dashboard)).toBe(before);
  });
  it('keeps the original question in the permission-scoped cached clarification', async () => {
    const p = await propose({ prompt: '환불률을 알려줘' });
    expect((await service.proposal(p.proposalId, 1, 7)).requestPrompt).toBe('환불률을 알려줘');
    expect(llm.callLlm).not.toHaveBeenCalled();
  });
  it('T15 caches clarification as read-only and refuses saving it before resolving meaning', async () => {
    const p = await propose({ prompt: '환불률 새 대시보드' });
    expect((await service.proposal(p.proposalId, 1, 7)).clarifications[0].id).toBe(
      'refundDenominator',
    );
    await expect(save(p)).rejects.toThrow('업무 의미');
    expect(llm.callLlm).not.toHaveBeenCalled();
  });
  it('returns validated semantics and calculated preview without writing anything', async () => {
    const before = await db.manager.count(Metric);
    const p = await propose();
    expect(p.sourceRevision).toBe((await bi.profile(1, 7)).dataVersion);
    expect(p.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect(p.semanticProposal[1].dimension).toEqual({
      column: 'channel',
      type: 'VARCHAR',
      schemaVersion: expect.any(String),
    });
    expect(await db.manager.count(Metric)).toBe(before);
    expect(p.semanticProposal[0].metric.definitionVersion).toBe(1);
  });
  it('clarifies refund denominator before model, metric lookup or preview and refuses saving it', async () => {
    const metrics = jest.spyOn(bi, 'metrics');
    const preview = jest.spyOn(dashboards, 'preview');
    const p = await propose({ prompt: '환불률과 매출을 보여줘' });
    expect(p.clarifications[0].id).toBe('refundDenominator');
    expect(p.preview).toBeUndefined();
    expect(llm.callLlm).not.toHaveBeenCalled();
    expect(metrics).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    await expect(save(p)).rejects.toThrow();
    metrics.mockRestore();
    preview.mockRestore();
  });
  it.each(['orders', 'amount'])(
    'compiles explicit refund denominator %s from the clarification',
    async answer => {
      llm.callLlm.mockResolvedValue(
        JSON.stringify({
          requiredFields:
            answer === 'orders' ? ['refunded_orders', 'paid_orders'] : ['refund_amount', 'amount'],
          title: 'Refund',
          semanticProposal: [
            {
              title: '환불률',
              kind: 'BOARD_NUMERIC',
              metric: {
                label: '환불률',
                aggregation: 'RATIO_SUM',
                column: answer === 'orders' ? 'refunded_orders' : 'refund_amount',
                denominatorColumn: answer === 'orders' ? 'paid_orders' : 'amount',
                scale: 100,
              },
            },
          ],
        }),
      );
      const p = await propose({
        prompt: '환불률',
        clarificationAnswers: { refundDenominator: answer },
      });
      expect(p.preview.widgets[0].datas[0].value).toBe(answer === 'orders' ? 50 : 6);
    },
  );
  it('creates deduplicated canonical metrics, dashboard, StudioState and replay journal atomically', async () => {
    const p = await propose();
    const n = await db.manager.count(Metric);
    const r = await save(p);
    expect(await db.manager.count(Metric)).toBe(n + 1);
    expect(r.document.blocks[0].measureRefs).toEqual(r.document.blocks[1].measureRefs);
    expect(Object.keys(r.idMap)).toHaveLength(2);
    expect((await studio.get(r.dashboardId, 7)).document).toEqual(r.document);
    expect(await save(p)).toEqual(r);
    await expect(
      service.create(
        {
          proposalId: p.proposalId,
          requestId: 'create-' + p.proposalId,
          expectedSourceRevision: studioDigest('other'),
        },
        7,
      ),
    ).rejects.toThrow();
  });
  it('locks explicitly selected canonical IDs and versions and never rewrites them', async () => {
    const m = await bi.createMetric(
      {
        sourceId: 1,
        label: 'Canonical',
        aggregation: 'SUM',
        column: 'amount',
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
      7,
    );
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['amount'],
        title: 'Reuse',
        semanticProposal: [
          {
            title: 'Reuse',
            kind: 'BOARD_NUMERIC',
            metric: { id: m.id, definitionVersion: m.definitionVersion },
          },
        ],
      }),
    );
    const p = await propose({ selectedMetricIds: [m.id] });
    expect(p.semanticProposal[0].metric.id).toBe(m.id);
    const n = await db.manager.count(Metric);
    await save(p);
    expect(await db.manager.count(Metric)).toBe(n);
    llm.callLlm.mockResolvedValue(JSON.stringify(semantics()));
    await expect(propose({ selectedMetricIds: [m.id] })).rejects.toThrow();
  });
  it('rolls back new metrics and dashboard when journal insertion fails', async () => {
    const p = await propose();
    const n = await db.manager.count(Metric),
      d = await db.manager.count(Dashboard);
    await db.query(
      "CREATE TRIGGER fail_t6 BEFORE INSERT ON studio_run BEGIN SELECT RAISE(ABORT,'journal unavailable'); END",
    );
    try {
      await expect(save(p)).rejects.toThrow('journal unavailable');
      expect(await db.manager.count(Metric)).toBe(n);
      expect(await db.manager.count(Dashboard)).toBe(d);
    } finally {
      await db.query('DROP TRIGGER fail_t6');
    }
  });
  it('source swaps and cross actor proposals cannot create rows', async () => {
    const p = await propose();
    connection.duckDBVersion.mockResolvedValueOnce(studioDigest('changed'));
    await expect(save(p)).rejects.toThrow();
    await expect(
      service.create(
        {
          requestId: 'foreign',
          proposalId: p.proposalId,
          expectedSourceRevision: p.sourceRevision,
        },
        8,
      ),
    ).rejects.toThrow();
  });
  it('rejects stale canonical metric definitions at save', async () => {
    const m = await bi.createMetric(
      {
        sourceId: 1,
        label: 'Stale',
        aggregation: 'SUM',
        column: 'amount',
        unit: '',
        decimalPlaces: 0,
        numberNotation: 'plain',
      },
      7,
    );
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['amount'],
        title: 'Stale',
        semanticProposal: [
          { title: 'Stale', kind: 'BOARD_NUMERIC', metric: { id: m.id, definitionVersion: 1 } },
        ],
      }),
    );
    const p = await propose({ selectedMetricIds: [m.id] });
    await db.manager.update(Metric, m.id, {
      definition: JSON.stringify({ ...m.definition, definitionVersion: 2 }),
    });
    await expect(save(p)).rejects.toThrow();
  });
  it.each([
    { sql: 'SELECT 1' },
    { semanticProposal: [] },
    {
      semanticProposal: [
        { title: 'X', kind: 'HTML', metric: { aggregation: 'SUM', column: 'amount' } },
      ],
    },
    {
      semanticProposal: [
        { title: 'X', kind: 'BOARD_NUMERIC', metric: { aggregation: 'SUM', column: 'missing' } },
      ],
    },
    {
      semanticProposal: [
        {
          title: 'X',
          kind: 'CHART_LINE',
          metric: { aggregation: 'SUM', column: 'amount' },
          dimension: { column: 'channel' },
        },
      ],
    },
  ])('rejects unsafe or unsupported model output %j', async patch => {
    llm.callLlm.mockResolvedValue(JSON.stringify({ ...semantics(), ...patch }));
    await expect(propose()).rejects.toThrow();
  });
  it('expires actor-bound immutable proposals', async () => {
    const p = await propose();
    p.semanticProposal[0].metric.column = 'refund_amount';
    const r = await save(p);
    expect((await studio.get(r.dashboardId, 7)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const q = await propose();
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 601000);
    try {
      await expect(save(q)).rejects.toThrow();
    } finally {
      now.mockRestore();
    }
  });
  it('cancels before inference and never retains a proposal cancelled during inference', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      (service.propose as any)({ sourceId: 1, prompt: 'revenue' }, 7, controller.signal),
    ).rejects.toThrow();
    expect(llm.callLlm).not.toHaveBeenCalled();
    const count = (service as any).proposals.size;
    const pending = new AbortController();
    llm.callLlm.mockImplementation(async (_s, _u, _j, signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      pending.abort();
      return JSON.stringify(semantics());
    });
    await expect(
      service.propose({ sourceId: 1, prompt: 'revenue' }, 7, pending.signal, 0),
    ).rejects.toThrow();
    expect((service as any).proposals.size).toBe(count);
  });
  it('serializes concurrent same-request saves and replays after ephemeral proposal expiry', async () => {
    const p = await propose();
    const before = await db.manager.count(Dashboard);
    const [a, b] = await Promise.all([save(p), save(p)]);
    expect(a).toEqual(b);
    expect(await db.manager.count(Dashboard)).toBe(before + 1);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 601000);
    try {
      expect(await save(p)).toEqual(a);
    } finally {
      now.mockRestore();
    }
  });
  it('refuses contradictory refund denominator semantics', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['refund_amount', 'amount'],
        title: 'Refund',
        semanticProposal: [
          {
            title: 'Refund rate',
            kind: 'BOARD_NUMERIC',
            metric: {
              label: 'Refund rate',
              aggregation: 'RATIO_SUM',
              column: 'refund_amount',
              denominatorColumn: 'amount',
              scale: 100,
            },
          },
        ],
      }),
    );
    await expect(
      propose({ prompt: 'refund rate', clarificationAnswers: { refundDenominator: 'orders' } }),
    ).rejects.toThrow();
  });
  it('does not create new metrics at invented definition versions', async () => {
    const data = semantics();
    (data.semanticProposal[0].metric as any).definitionVersion = 9;
    llm.callLlm.mockResolvedValue(JSON.stringify(data));
    await expect(propose()).rejects.toThrow();
  });

  it('UC055 completes real creation SQL before the source/metric persistence fences', async () => {
    const p = await propose();
    const query = connection.queryDuckDB.getMockImplementation();
    let calls = 0;
    connection.queryDuckDB.mockImplementation(async (...args) => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      calls++;
      return query(...args);
    });
    try {
      await save(p);
      expect(calls).toBeGreaterThan(0);
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('detects a source swap during the save preview and rolls back every created row', async () => {
    const p = await propose();
    const before = await db.manager.count(Dashboard);
    const original = dashboards.prepareSave.bind(dashboards);
    const spy = jest.spyOn(dashboards, 'prepareSave').mockImplementation(async (...args) => {
      const prepared = await original(...args);
      return {
        ...prepared,
        persist: async (...values) => {
          const result = await prepared.persist(...values);
          await db.manager.update(Database, 1, {
            connectionConfig: JSON.stringify({
              client: 'duckdb',
              connection: { filename: 'swapped.duckdb' },
            }),
          });
          return result;
        },
      };
    });
    try {
      await expect(save(p)).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(Dashboard)).toBe(before);
    } finally {
      spy.mockRestore();
      await db.manager.update(Database, 1, {
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: 'fixture.duckdb' },
        }),
      });
    }
  });
  it.each(['AVG', 'SUM'])(
    'rejects refund-rate %s bypass while retaining legitimate refund amount SUM',
    async aggregation => {
      llm.callLlm.mockResolvedValue(
        JSON.stringify({
          requiredFields: ['refund_amount'],
          title: 'Refund',
          semanticProposal: [
            {
              title: '환불률',
              kind: 'BOARD_NUMERIC',
              metric: { label: '환불률', aggregation, column: 'refund_amount', unit: '%' },
            },
          ],
        }),
      );
      await expect(
        propose({
          prompt: '매출과 환불액 및 환불률',
          clarificationAnswers: { refundDenominator: 'amount' },
        }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('releases a consumed proposal only after commit and replays from the durable journal', async () => {
    const before = (service as any).proposals.size;
    const p = await propose();
    expect((service as any).proposals.size).toBe(before + 1);
    const result = await save(p);
    expect((service as any).proposals.size).toBe(before);
    expect(await save(p)).toEqual(result);
  });
  it.each([100, 1])(
    'previews all four actual commerce columns with confirmed amount denominator and percentage scale %s',
    async scale => {
      const files = Object.fromEntries(
        ['orders', 'payments', 'refunds', 'customers'].map(key => {
          const destination = path.join(root, 'four-kpi-' + scale + '-' + key + '.csv');
          fs.copyFileSync(path.join(__dirname, '../commerce/samples', key + '.csv'), destination);
          return [key, destination];
        }),
      );
      const imported = await worker.importCommerce({ files: files as any, analytical: true });
      const sourceId = 100 + scale;
      await db.manager.save(Database, {
        id: sourceId,
        ownerId: 7,
        name: 'Commerce 37 order cohort',
        engine: 'duckdb',
        type: 'FILE',
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: imported.filename },
        }),
      });
      const oldQuery = connection.queryDuckDB.getMockImplementation();
      const oldVersion = connection.duckDBVersion.getMockImplementation();
      connection.queryDuckDB.mockImplementation((id, sql, bindings) =>
        id === sourceId
          ? worker.query(imported.filename, sql, bindings)
          : oldQuery(id, sql, bindings),
      );
      connection.duckDBVersion.mockImplementation(id =>
        id === sourceId
          ? Promise.resolve(createHash('sha256').update(imported.filename).digest('hex'))
          : oldVersion(id),
      );
      llm.callLlm.mockResolvedValue(
        JSON.stringify({
          requiredFields: ['revenue', 'refund_amount', 'net_amount'],
          title: '매출·환불',
          semanticProposal: [
            ...[
              ['매출', 'revenue'],
              ['환불액', 'refund_amount'],
              ['순수취액', 'net_amount'],
            ].map(([title, column]) => ({
              title,
              kind: 'BOARD_NUMERIC',
              metric: { label: title, aggregation: 'SUM', column, unit: 'USD' },
            })),
            {
              title: '환불률',
              kind: 'BOARD_NUMERIC',
              metric: {
                label: '환불률',
                aggregation: 'RATIO_SUM',
                column: 'refund_amount',
                denominatorColumn: 'revenue',
                scale,
                unit: '%',
              },
            },
          ],
        }),
      );
      try {
        const p = await service.propose(
          {
            sourceId,
            prompt: '총 매출, 환불액, 순수취액, 환불률 KPI 4개',
            clarificationAnswers: { refundDenominator: 'amount' },
          },
          7,
          undefined,
          0,
        );
        expect(p.preview.widgets.map(w => Number(w.datas[0].value))).toEqual([
          20994.61,
          4457.6,
          16537.01,
          expect.any(Number),
        ]);
        expect(p.preview.widgets[3].datas[0].value).toBeCloseTo((4457.6 / 20994.61) * 100, 10);
        expect(p.semanticProposal[3].metric.scale).toBe(100);
      } finally {
        connection.queryDuckDB.mockImplementation(oldQuery);
        connection.duckDBVersion.mockImplementation(oldVersion);
      }
    },
  );
  it.each([
    '존재하지 않는 revenue 매출 총합과 환불액을 계산해줘. 없는 열을 추측하지 마.',
    'Calculate the missing gross_profit column; do not substitute a different metric.',
    'Sum column: nonexistent_field',
    'Sum `nonexistent_field`',
  ])(
    'clarifies explicit missing raw fields without querying substitute metrics: %s',
    async prompt => {
      const preview = jest.spyOn(dashboards, 'preview');
      try {
        const p = await propose({ prompt });
        expect(p.clarifications).toEqual([
          { id: 'missingColumns', question: expect.any(String), choices: [], affectedBlockIds: [] },
        ]);
        expect(p.preview).toBeUndefined();
        expect(p.semanticProposal).toEqual([]);
        expect(llm.callLlm).not.toHaveBeenCalled();
        expect(preview).not.toHaveBeenCalled();
        await expect(save(p)).rejects.toThrow();
      } finally {
        preview.mockRestore();
      }
    },
  );
  it('turns declared required fields absent from the source into clarification instead of substituted preview', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({ ...semantics(), requiredFields: ['revenue', 'refund_amount'] }),
    );
    const preview = jest.spyOn(dashboards, 'preview');
    try {
      const p = await propose();
      expect(p.clarifications[0].id).toBe('missingColumns');
      expect(p.clarifications[0].question).toContain('revenue');
      expect(p.preview).toBeUndefined();
      expect(preview).not.toHaveBeenCalled();
    } finally {
      preview.mockRestore();
    }
  });
  it('accepts declared existing raw dependencies without changing semantic fixtures', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({ ...semantics(), requiredFields: ['amount', 'channel'] }),
    );
    const p = await propose({ prompt: 'Show sum of `amount` by column: channel' });
    expect(p.preview.widgets[0].datas).toEqual([{ value: 500 }]);
  });
  it.each(['inventedQuestion', 'refundDenominator'])(
    'rejects model clarification ID %s outside missingColumns',
    async id => {
      llm.callLlm.mockResolvedValue(
        JSON.stringify({
          clarifications: [{ id, question: 'Missing fields?', choices: [], affectedBlockIds: [] }],
        }),
      );
      await expect(propose()).rejects.toMatchObject({ status: 400 });
    },
  );
  it('UC034 retains only the confirmed denominator with a cached missing-field question', async () => {
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        clarifications: [
          { id: 'missingColumns', question: 'Missing field', choices: [], affectedBlockIds: [] },
        ],
      }),
    );
    const result = await propose({
      prompt: 'refund rate',
      clarificationAnswers: { refundDenominator: 'amount' },
    });
    expect(result.clarifications[0].id).toBe('missingColumns');
    const cached = await service.proposal(result.proposalId, result.sourceId, 7);
    expect(cached.requestAnswers).toEqual({ refundDenominator: 'amount' });
    expect(cached.requestPrompt).toBe('refund rate');
  });
  it('accepts a model missingColumns clarification without persisting or previewing it', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: ['missing_column'],
        clarifications: [
          {
            id: 'missingColumns',
            question: 'Choose a source with the requested field.',
            choices: [],
            affectedBlockIds: [],
          },
        ],
      }),
    );
    const p = await propose();
    expect(p.clarifications[0].id).toBe('missingColumns');
    expect(p.preview).toBeUndefined();
    await expect(save(p)).rejects.toThrow();
  });
  it.each([undefined, null])(
    'rejects successful semantic responses with missing/null requiredFields (%s) before preview',
    async declaration => {
      const response: any = { ...semantics() };
      if (declaration === undefined) delete response.requiredFields;
      else response.requiredFields = declaration;
      llm.callLlm.mockResolvedValue(JSON.stringify(response));
      const preview = jest.spyOn(dashboards, 'preview');
      const count = (service as any).proposals.size;
      try {
        await expect(propose()).rejects.toMatchObject({ status: 400 });
        expect(preview).not.toHaveBeenCalled();
        expect((service as any).proposals.size).toBe(count);
      } finally {
        preview.mockRestore();
      }
    },
  );
  it('allows omitted requiredFields only for a validated missingColumns clarification', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        clarifications: [
          {
            id: 'missingColumns',
            question: 'The requested field is unavailable. Choose a source containing it.',
            choices: [],
            affectedBlockIds: [],
          },
        ],
      }),
    );
    const p = await propose();
    expect(p.clarifications[0].id).toBe('missingColumns');
    expect(p.preview).toBeUndefined();
  });
  it('rejects null requiredFields even in a missingColumns clarification', async () => {
    llm.callLlm.mockResolvedValue(
      JSON.stringify({
        requiredFields: null,
        clarifications: [
          { id: 'missingColumns', question: 'Missing field', choices: [], affectedBlockIds: [] },
        ],
      }),
    );
    await expect(propose()).rejects.toMatchObject({ status: 400 });
  });
  const refine = (p: any, target: number | 'append', extra = {}, actor = 7) =>
    service.propose(
      {
        sourceId: 1,
        prompt: 'Change selected chart to event_time',
        parentProposalId: p.proposalId,
        targetBlockIndex: target,
        expectedSourceRevision: p.sourceRevision,
        ...extra,
      },
      actor,
      undefined,
      0,
    );
  it('UC035 keeps a confirmed refund denominator during title-only refinement', async () => {
    const block = {
      title: '환불률',
      kind: 'BOARD_NUMERIC',
      metric: {
        label: '환불률',
        aggregation: 'RATIO_SUM',
        column: 'refund_amount',
        denominatorColumn: 'amount',
        scale: 100,
      },
    };
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['refund_amount', 'amount'],
        title: 'Refund',
        semanticProposal: [block],
      }),
    );
    const parent = await propose({ prompt: '매출 금액 기준 환불률' });
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['refund_amount', 'amount'],
        title: 'ignored',
        semanticProposal: [{ ...block, title: '환불 비율' }],
      }),
    );
    const next = await refine(parent, 0, { prompt: '제목만 환불 비율로 바꿔 줘' });
    expect(next.preview.widgets[0].datas).toEqual([{ value: 6 }]);
    expect(next.semanticProposal[0].metric).toEqual(parent.semanticProposal[0].metric);
    expect(next.requestAnswers).toEqual({ refundDenominator: 'amount' });
  });
  it('REFINE-01 replaces only selected block, preserving parent, IDs and metadata until explicit save', async () => {
    const p = await propose();
    const baseline = await Promise.all([db.manager.count(Dashboard), db.manager.count(Metric)]);
    const block = semantics().semanticProposal[1];
    block.kind = 'CHART_LINE';
    block.dimension = { column: 'event_time' };
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['amount', 'event_time'],
        title: 'ignored',
        semanticProposal: [block],
      }),
    );
    const next = await refine(p, 1);
    expect(next.proposalId).not.toBe(p.proposalId);
    expect(next.parentProposalId).toBe(p.proposalId);
    expect(next.title).toBe(p.title);
    expect(next.semanticProposal[0]).toEqual(p.semanticProposal[0]);
    expect(next.semanticProposal[1].blockId).toBe(p.semanticProposal[1].blockId);
    expect(next.semanticProposal[1].dimension.column).toBe('event_time');
    expect(next.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect(await service.proposal(p.proposalId, 1, 7)).toEqual(JSON.parse(JSON.stringify(p)));
    expect(await Promise.all([db.manager.count(Dashboard), db.manager.count(Metric)])).toEqual(
      baseline,
    );
    expect(JSON.parse(llm.callLlm.mock.calls[1][1]).currentProposal.semanticProposal).toEqual(
      p.semanticProposal,
    );
    const saved = await save(next, 'refine-save-' + next.proposalId);
    expect((await save(next, 'refine-save-' + next.proposalId)).dashboardId).toBe(
      saved.dashboardId,
    );
    const state = await db.manager.findOneByOrFail(StudioState, { dashboardId: saved.dashboardId });
    expect((await studio.get(saved.dashboardId, 7)).document.blocks).toHaveLength(2);
    expect(state.dashboardId).toBe(saved.dashboardId);
  });
  it('REFINE title-only follow-up preserves the entire target definition except its title', async () => {
    const parent = await propose();
    const block = semantics().semanticProposal[1];
    block.title = 'Renamed block';
    block.metric.label = 'Unrequested metric rename';
    block.metric.aggregation = 'AVG';
    block.metric.decimalPlaces = 0;
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['amount', 'channel'],
        title: 'ignored',
        semanticProposal: [block],
      }),
    );
    const next = await refine(parent, 1, {
      prompt: '선택한 블록 제목만 Renamed block으로 변경해 줘.',
    });
    expect(next.semanticProposal[1]).toEqual({
      ...parent.semanticProposal[1],
      title: 'Renamed block',
    });
    expect(next.semanticProposal[0]).toEqual(parent.semanticProposal[0]);
    expect(next.title).toBe(parent.title);
  });
  it('KRW title-only refinement preserves won precision through private save and reload', async () => {
    const won = semantics();
    won.semanticProposal.forEach(block => {
      block.metric.unit = 'KRW';
      block.metric.decimalPlaces = 0;
    });
    llm.callLlm.mockResolvedValueOnce(JSON.stringify(won));
    const parent = await propose({ prompt: 'KRW 원화 금액 소수0자리로 만들어 줘' });
    const attemptedChange = semantics().semanticProposal[0];
    attemptedChange.title = '원화 결제 성공액';
    attemptedChange.metric.aggregation = 'AVG';
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({
        requiredFields: ['amount'],
        title: 'ignored',
        semanticProposal: [attemptedChange],
      }),
    );
    const next = await refine(parent, 0, {
      prompt: '선택한 블록 제목만 원화 결제 성공액으로 변경해 줘',
    });
    expect(next.semanticProposal[0]).toEqual({
      ...parent.semanticProposal[0],
      title: '원화 결제 성공액',
    });
    expect(next.semanticProposal[1]).toEqual(parent.semanticProposal[1]);
    const saved = await save(next);
    const firstRead = await studio.get(saved.dashboardId, 7);
    const reloaded = await studio.get(saved.dashboardId, 7);
    expect(reloaded.document).toEqual(firstRead.document);
    expect(reloaded.document.blocks[0]).toMatchObject({
      title: '원화 결제 성공액',
      display: { suffix: ' KRW', decimalPlaces: 0 },
    });
    expect(reloaded.document.blocks[1].display).toMatchObject({ suffix: ' KRW', decimalPlaces: 0 });
  });

  it('REFINE-02 appends one block and rejects a seventh before calling AI', async () => {
    let p = await propose();
    for (let i = 0; i < 4; i++) {
      const block = semantics().semanticProposal[0];
      block.title = 'Extra ' + i;
      llm.callLlm.mockResolvedValueOnce(
        JSON.stringify({ requiredFields: ['amount'], title: 'ignored', semanticProposal: [block] }),
      );
      const next = await refine(p, 'append');
      expect(next.semanticProposal.slice(0, -1)).toEqual(p.semanticProposal);
      p = next;
    }
    const calls = llm.callLlm.mock.calls.length;
    await expect(refine(p, 'append')).rejects.toThrow('최대 6개');
    expect(llm.callLlm).toHaveBeenCalledTimes(calls);
  });
  it('REFINE-03 keeps parent after failure, cancellation, unchanged output or multiple returned blocks', async () => {
    const p = await propose();
    llm.callLlm.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(refine(p, 1)).rejects.toThrow('준비하지 못');
    await expect(refine(p, 1)).rejects.toThrow('하나만');
    llm.callLlm.mockResolvedValueOnce(
      JSON.stringify({ ...semantics(), semanticProposal: [semantics().semanticProposal[1]] }),
    );
    await expect(refine(p, 1)).rejects.toThrow('변경된 내용이 없습니다');
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.propose(
        { sourceId: 1, prompt: 'change', parentProposalId: p.proposalId, targetBlockIndex: 1 },
        7,
        controller.signal,
        0,
      ),
    ).rejects.toThrow('취소');
    expect(await service.proposal(p.proposalId, 1, 7)).toEqual(JSON.parse(JSON.stringify(p)));
  });
  it('REFINE-04 rejects expired, foreign, mismatched-source and invalid target before AI', async () => {
    const p = await propose();
    const calls = llm.callLlm.mock.calls.length;
    await expect(refine(p, -1)).rejects.toThrow('블록');
    await expect(refine(p, 2)).rejects.toThrow('블록');
    await expect(refine(p, 0, {}, 8)).rejects.toThrow();
    await expect(refine(p, 0, { sourceId: 99 })).rejects.toThrow();
    await expect(refine(p, 0, { expectedSourceRevision: '0'.repeat(64) })).rejects.toThrow('변경');
    await expect(refine(p, 0, { selectedMetricIds: [1] })).rejects.toThrow('기존 제안');
    const profile = jest.spyOn(service, 'profile');
    profile.mockResolvedValueOnce({ ...p.profile, dataVersion: 'f'.repeat(64) });
    await expect(refine(p, 0, { expectedSourceRevision: undefined })).rejects.toThrow(
      '데이터가 변경',
    );
    profile.mockRestore();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
    try {
      await expect(refine(p, 0)).rejects.toThrow('만료');
    } finally {
      clock.mockRestore();
    }
    expect(llm.callLlm).toHaveBeenCalledTimes(calls);
  });

  describe('AI saved-measure composition', () => {
    const bases = async () => {
      const metrics = [];
      for (const column of ['revenue', 'cost'])
        metrics.push(
          await bi.createMetric(
            {
              sourceId: 2,
              label: 'Formula ' + column,
              aggregation: 'SUM',
              column,
              unit: 'USD',
              decimalPlaces: 2,
              numberNotation: 'plain',
            },
            7,
          ),
        );
      return metrics;
    };
    const response = (revenue: any, cost: any, override = {}) => ({
      requiredFields: ['revenue', 'cost'],
      title: 'Cost ratio',
      semanticProposal: [
        {
          title: 'Cost ratio',
          kind: 'BOARD_NUMERIC',
          metric: {
            label: 'Composed cost ratio',
            aggregation: 'FORMULA',
            decimalPlaces: 2,
            numberNotation: 'plain',
            expression: {
              op: 'ratio',
              left: { metricId: cost.id, definitionVersion: 1 },
              right: { metricId: revenue.id, definitionVersion: 1 },
              scale: 100,
            },
            ...override,
          },
        },
      ],
    });
    const counts = () => Promise.all([db.manager.count(Dashboard), db.manager.count(Metric)]);
    it('previews without writes, pins selected operands and atomically saves/reloads one formula', async () => {
      const [revenue, cost] = await bases(),
        before = await counts();
      llm.callLlm.mockResolvedValueOnce(JSON.stringify(response(revenue, cost)));
      const proposal = await propose({
        sourceId: 2,
        prompt: '저장 지표로 비용률',
        selectedMetricIds: [revenue.id, cost.id],
      });
      expect(await counts()).toEqual(before);
      expect(proposal.preview.widgets[0].datas[0].value).toBeCloseTo(82.20885838249933, 8);
      expect(proposal.semanticProposal[0].metric).toMatchObject({
        aggregation: 'FORMULA',
        unit: '%',
        formula: {
          operands: expect.arrayContaining([
            { id: revenue.id, definitionVersion: 1, definition: revenue.definition },
            { id: cost.id, definitionVersion: 1, definition: cost.definition },
          ]),
        },
      });
      const saved = await save(proposal),
        reloaded = await studio.get(saved.dashboardId, 7);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1]);
      expect(reloaded.preview.widgets[0].sql).toContain('NULLIF');
      expect(reloaded.preview.widgets[0].datas[0].value).toBeCloseTo(82.20885838249933, 8);
      expect((await save(proposal)).dashboardId).toBe(saved.dashboardId);
      expect(await counts()).toEqual([before[0] + 1, before[1] + 1]);
      expect((await db.manager.findOneByOrFail(Metric, { id: revenue.id })).definition).toBe(
        JSON.stringify(revenue.definition),
      );
    });
    it.each(['version', 'definition', 'inactive'])(
      'rejects changed %s before any save writes',
      async change => {
        const [revenue, cost] = await bases();
        llm.callLlm.mockResolvedValueOnce(JSON.stringify(response(revenue, cost)));
        const proposal = await propose({ sourceId: 2 });
        const definition = {
          ...cost.definition,
          ...(change === 'version' ? { definitionVersion: 2 } : { column: 'profit' }),
        };
        await db.manager.update(
          Metric,
          cost.id,
          change === 'inactive' ? { useYn: 'N' } : { definition: JSON.stringify(definition) },
        );
        const before = await counts();
        await expect(save(proposal)).rejects.toThrow('참조');
        expect(await counts()).toEqual(before);
      },
    );
    it('rejects model snapshots, unit overrides, raw SQL and cross-source leaves without writes', async () => {
      const [revenue, cost] = await bases(),
        foreign = await bi.createMetric(
          {
            sourceId: 1,
            label: 'Foreign',
            aggregation: 'SUM',
            column: 'amount',
            unit: 'USD',
            decimalPlaces: 2,
            numberNotation: 'plain',
          },
          7,
        );
      const before = await counts();
      for (const override of [
        { unit: 'KRW' },
        { formula: { operands: [] } },
        { expression: 'SUM(revenue)' },
        {
          expression: {
            op: 'ratio',
            left: { metricId: cost.id, definitionVersion: 1 },
            right: { metricId: foreign.id, definitionVersion: 1 },
            scale: 100,
          },
        },
      ]) {
        llm.callLlm.mockResolvedValueOnce(JSON.stringify(response(revenue, cost, override)));
        await expect(propose({ sourceId: 2 })).rejects.toThrow();
        expect(await counts()).toEqual(before);
      }
    });
  });
});
