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

describe('T6 semantic creation with real DuckDB and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    dashboards: AiDashboardService,
    bi: BiService,
    service: StudioCreationService,
    studio: StudioService,
    root: string,
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
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_LINE'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest
        .fn()
        .mockResolvedValue(createHash('sha256').update('fixture.duckdb').digest('hex')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(file.filename, sql, bindings)),
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
    service.propose({ sourceId: 1, prompt: 'Show revenue and channels', ...extra }, 7);
  const save = (p: any, requestId = 'create-' + p.proposalId) =>
    service.create(
      { proposalId: p.proposalId, expectedSourceRevision: p.sourceRevision, requestId },
      7,
    );
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
      service.propose({ sourceId: 1, prompt: 'revenue' }, 7, pending.signal),
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

  it('detects a source swap during the save preview and rolls back every created row', async () => {
    const p = await propose();
    const before = await db.manager.count(Dashboard);
    const original = dashboards.save.bind(dashboards);
    const spy = jest.spyOn(dashboards, 'save').mockImplementation(async (...args) => {
      const result = await original(...args);
      await db.manager.update(Database, 1, {
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: 'swapped.duckdb' },
        }),
      });
      return result;
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
});
