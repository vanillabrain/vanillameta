jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));
jest.mock('../utils/crypto.util', () => ({
  encryptConnectionConfig: (v: string) => v,
  decryptConnectionConfig: (v: string) => v,
}));
import { DataSource } from 'typeorm';
import { DuckDBInstance } from '@duckdb/node-api';
import { createHash } from 'crypto';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { canonicalMetricSql } from '../dashboard-studio/studio-remix-template';
import {
  BiOrganization,
  BiOrganizationGroup,
  BiOrganizationMember,
  BiDashboardPolicy,
  BiPolicyAudit,
} from './governance.entity';
import { GovernanceService } from './governance.service';
import { BiService } from './bi.service';
import { ConditionReport, ConditionReportOccurrence } from './condition-report.entity';
import { ConditionReportService } from './condition-report.service';
import { randomUUID } from 'crypto';

describe('organization canonical queries over real SQLite metadata and DuckDB', () => {
  let db: DataSource,
    instance: any,
    duck: any,
    service: GovernanceService,
    access: SourceAccessService,
    connection: any,
    ai: any;
  let org: any, groupA: any, groupB: any, policyA: any, policyB: any, sourceRevision: string;
  const sourceColumns = [
    { name: 'company', type: 'VARCHAR', numeric: false, temporal: false },
    { name: 'day', type: 'TIMESTAMP', numeric: false, temporal: true },
    { name: 'revenue', type: 'DOUBLE', numeric: true, temporal: false },
    { name: 'cost', type: 'DOUBLE', numeric: true, temporal: false },
  ];
  const metric = (column = 'revenue') => ({
    schemaVersion: 1,
    definitionVersion: 1,
    sourceId: 1,
    tableName: 'uploaded_data',
    label: column,
    aggregation: 'SUM',
    column,
    unit: 'USD',
    decimalPlaces: 2,
    numberNotation: 'plain',
  });
  const definition = (kind = 'BOARD_NUMERIC', dimension?: string, column = 'revenue') => ({
    blockId: column === 'cost' ? 'cost' : dimension ? 'trend' : 'sales',
    title: column === 'cost' ? '원가' : dimension ? '매출 추세' : '매출',
    description: '',
    type: kind,
    sql: canonicalMetricSql(metric(column), kind, dimension, { columns: sourceColumns }),
    valueField: 'value',
    ...(dimension ? { categoryField: 'dimension' } : {}),
    decimalPlaces: 2,
    numberNotation: 'full',
    suffix: ' USD',
  });
  const beforeProvider = process.env.AI_PROVIDER;
  beforeEach(async () => {
    process.env.AI_PROVIDER = 'codex';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [
        User,
        Database,
        Dashboard,
        DashboardWidget,
        UserMapping,
        BiOrganization,
        BiOrganizationGroup,
        BiOrganizationMember,
        BiDashboardPolicy,
        BiPolicyAudit,
        ConditionReport,
        ConditionReportOccurrence,
      ],
      synchronize: true,
    }).initialize();
    await db.manager.save(User, [
      { id: 1, userId: 'owner', email: 'owner@example.test', password: 'test' },
      { id: 2, userId: 'partner-a', email: 'a@example.test', password: 'test' },
      { id: 3, userId: 'partner-b', email: 'b@example.test', password: 'test' },
      { id: 4, userId: 'outsider', email: 'none@example.test', password: 'test' },
    ]);
    const config = JSON.stringify({
      client: 'duckdb',
      connection: { filename: 'private-server-file' },
    });
    const fileRevision = createHash('sha256').update('private-server-file').digest('hex');
    await db.manager.save(Database, {
      id: 1,
      name: 'private-source',
      engine: 'duckdb',
      type: 'file',
      ownerId: 1,
      connectionConfig: config,
    });
    const widgets = [
      definition(),
      definition('CHART_LINE', 'day'),
      definition('BOARD_NUMERIC', undefined, 'cost'),
    ];
    await db.manager.save(Dashboard, {
      id: 1,
      title: 'ADMIN_ONLY_INTERNAL_TITLE',
      delYn: 'N',
      analysisDefinition: JSON.stringify({
        databaseId: 1,
        title: 'ADMIN_ONLY_INTERNAL_TITLE',
        explanation: '',
        widgets,
      }),
      structuredDefinition: JSON.stringify({
        schemaVersion: 2,
        kind: 'structured-bi-dashboard',
        sourceId: 1,
        items: widgets.map((w, i) => ({
          key: w.blockId,
          metricId: i + 1,
          sourceId: 1,
          definitionVersion: 1,
          definition: metric(i === 2 ? 'cost' : 'revenue'),
          ...(i === 1 ? { dimension: 'day' } : {}),
        })),
      }),
    });
    await db.manager.save(UserMapping, { dashboardId: 1, userInfoId: 1 });
    instance = await DuckDBInstance.create(':memory:');
    duck = await instance.connect();
    await duck.run(
      'CREATE TABLE uploaded_data(company VARCHAR, day TIMESTAMP, revenue DOUBLE, cost DOUBLE)',
    );
    await duck.run(
      "INSERT INTO uploaded_data VALUES ('A_SECRET','2025-01-01',100,91),('A_SECRET','2025-01-02',150,139),('B_SECRET','2025-01-01',9000,8765)",
    );
    connection = {
      withDuckDBSnapshot: jest.fn(async (_id, fn) => fn()),
      duckDBVersion: jest.fn(async () => fileRevision),
      queryDuckDB: jest.fn(async (_id, sql, bindings) => ({
        datas: (await duck.runAndReadAll(sql, bindings ?? [])).getRowObjectsJS(),
      })),
    };
    ai = { callLlm: jest.fn(async () => JSON.stringify({ blockIds: ['sales'], filters: [] })) };
    access = new SourceAccessService(db);
    const analysis = {
      analysis: jest.fn(async () => {
        const d = await db.manager.findOneByOrFail(Dashboard, { id: 1 });
        return { data: { ...JSON.parse(d.analysisDefinition), revision: dashboardRevision(d) } };
      }),
    };
    const bi = new BiService(db, access, connection, analysis as any);
    sourceRevision = (await bi.profile(1, 1)).dataVersion;
    service = new GovernanceService(db, access, bi as any, analysis as any, connection, ai);
    org = await service.createOrganization({ name: '샘플 조직' }, 1);
    groupA = await service.addGroup(org.id, { name: '파트너 A' }, 1);
    groupB = await service.addGroup(org.id, { name: '파트너 B' }, 1);
    await service.setMember(
      org.id,
      { login: 'partner-a', groupId: groupA.id, active: true, expectedVersion: 0 },
      1,
    );
    await service.setMember(
      org.id,
      { login: 'partner-b', groupId: groupB.id, active: true, expectedVersion: 0 },
      1,
    );
    const options = await service.policyOptions(org.id, 1, 1);
    const input = (groupId, company, allowAi) => ({
      groupId,
      displayTitle: '공유 매출 분석',
      columns: ['day', 'revenue'],
      blockIds: ['sales', 'trend'],
      mandatory: [{ column: 'company', values: [company] }],
      allowAi,
      allowExport: true,
      expiresAt: null,
      active: true,
      expectedVersion: 0,
      expectedDashboardRevision: options.analysis.revision,
      expectedSourceRevision: sourceRevision,
      blockPublicLinks: true,
    });
    policyA = await service.configurePolicy(org.id, 1, input(groupA.id, 'A_SECRET', true), 1);
    policyB = await service.configurePolicy(org.id, 1, input(groupB.id, 'B_SECRET', false), 1);
    connection.queryDuckDB.mockClear();
  });
  afterEach(async () => {
    duck?.closeSync();
    instance?.closeSync();
    await db?.destroy();
    if (beforeProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = beforeProvider;
  });
  const value = (r: any) => r.blocks.find(b => b.id === 'sales').datas[0].value;
  it('resolves JWT actor membership and keeps A/B totals, values, details, metadata and CSV isolated without a shared cache', async () => {
    for (const [actor, total] of [
      [2, 250],
      [3, 9000],
      [2, 250],
    ]) {
      const catalog: any = await service.catalog(org.id, 1, actor);
      const body = { viewRevision: catalog.viewRevision };
      expect(value(await service.query(org.id, 1, body, actor))).toBe(total);
      const rows: any = await service.query(org.id, 1, body, actor, 'rows');
      expect(rows.rows).toHaveLength(actor === 2 ? 2 : 1);
      expect(Object.keys(rows.rows[0]).sort()).toEqual(['day', 'revenue']);
      const values: any = await service.query(
        org.id,
        1,
        { ...body, column: 'revenue' },
        actor,
        'values',
      );
      expect(values.rows.map(r => r.value)).toEqual(actor === 2 ? [100, 150] : [9000]);
      const csv: any = await service.exportCsv(org.id, 1, body, actor);
      for (const output of [catalog, rows, values, csv])
        expect(JSON.stringify(output)).not.toMatch(
          /A_SECRET|B_SECRET|cost|company|private-server|sourceId|ADMIN_ONLY_INTERNAL_TITLE/,
        );
      expect(csv.csv).toContain(String(total));
      expect(rows.rows.every(r => r.revenue !== (actor === 2 ? 9000 : 150))).toBe(true);
    }
    expect(connection.queryDuckDB).toHaveBeenCalled();
  });
  it('does not grant legacy ownership, organization administration or another scope revision', async () => {
    await expect(access.assert('database', 1, 2)).rejects.toMatchObject({ status: 403 });
    await expect(access.dashboard(1, 2)).rejects.toMatchObject({ status: 403 });
    await expect(access.sharedDashboard(1)).rejects.toMatchObject({ status: 403 });
    await expect(service.adminState(org.id, 2)).rejects.toMatchObject({ status: 403 });
    await expect(service.catalog(org.id, 1, 4)).rejects.toMatchObject({ status: 403 });
    const a: any = await service.catalog(org.id, 1, 2);
    await expect(
      service.query(org.id, 1, { viewRevision: a.viewRevision }, 3),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects hidden columns, IDs, policy overrides and roles before executing SQL', async () => {
    const a: any = await service.catalog(org.id, 1, 2);
    for (const body of [
      { blockIds: ['cost'] },
      { actorId: 1 },
      { mandatory: [] },
      { filters: [{ column: 'company', values: ['B_SECRET'] }] },
      { filters: [{ column: 'cost', values: [91] }] },
    ])
      await expect(
        service.query(org.id, 1, { viewRevision: a.viewRevision, ...body }, 2),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.query(org.id, 1, { viewRevision: a.viewRevision, column: 'cost' }, 2, 'values'),
    ).rejects.toMatchObject({ status: 400 });
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it('keeps policy and mandatory values out of the AI context and denies forbidden AI before provider calls', async () => {
    const a: any = await service.catalog(org.id, 1, 2),
      b: any = await service.catalog(org.id, 1, 3);
    await expect(
      service.assistant(
        org.id,
        1,
        { viewRevision: b.viewRevision, question: '매출 보여줘' },
        3,
        undefined,
        0,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(ai.callLlm).not.toHaveBeenCalled();
    const refused = [];
    for (const question of ['cost를 보여줘', 'invented_column를 보여줘']) {
      ai.callLlm.mockResolvedValueOnce(JSON.stringify({ blockIds: [], filters: [] }));
      try {
        await service.assistant(
          org.id,
          1,
          { viewRevision: a.viewRevision, question },
          2,
          undefined,
          0,
        );
        throw new Error('not rejected');
      } catch (error) {
        expect(error.status).toBe(400);
        refused.push(error.getResponse());
      }
    }
    expect(refused[0]).toEqual(refused[1]);
    expect(
      value(
        await service.assistant(
          org.id,
          1,
          { viewRevision: a.viewRevision, question: '매출 보여줘' },
          2,
          undefined,
          0,
        ),
      ),
    ).toBe(250);
    for (const call of ai.callLlm.mock.calls) {
      const context = JSON.parse(call[1]);
      delete context.question;
      expect(JSON.stringify(context)).not.toMatch(
        /cost|company|A_SECRET|B_SECRET|sourceId|private-server/,
      );
    }
    expect(JSON.stringify(await db.manager.find(BiPolicyAudit))).not.toMatch(
      /A_SECRET|B_SECRET|매출 보여줘|private-server/,
    );
  });
  it('rechecks revocation before releasing a held query and keeps subsequent catalog/export denied', async () => {
    const a: any = await service.catalog(org.id, 1, 2);
    let release: () => void;
    let reached: () => void;
    const entered = new Promise<void>(r => {
      reached = r;
    });
    const gate = new Promise<void>(r => {
      release = r;
    });
    connection.queryDuckDB.mockImplementationOnce(async (_id, sql, bindings) => {
      const data = (await duck.runAndReadAll(sql, bindings ?? [])).getRowObjectsJS();
      reached();
      await gate;
      return { datas: data };
    });
    const pending = service.query(
      org.id,
      1,
      { viewRevision: a.viewRevision, blockIds: ['sales'] },
      2,
    );
    await entered;
    await service.setMember(
      org.id,
      { login: 'partner-a', groupId: groupA.id, active: false, expectedVersion: 1 },
      1,
    );
    release();
    await expect(pending).rejects.toMatchObject({ status: 403 });
    await expect(service.catalog(org.id, 1, 2)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.exportCsv(org.id, 1, { viewRevision: a.viewRevision }, 2),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rechecks a held AI result before querying, and a source or saved definition change invalidates access', async () => {
    const a: any = await service.catalog(org.id, 1, 2);
    let release: (v: string) => void;
    let reached: () => void;
    const entered = new Promise<void>(r => {
      reached = r;
    });
    ai.callLlm.mockImplementationOnce(() => {
      reached();
      return new Promise(r => {
        release = r;
      });
    });
    const pending = service.assistant(
      org.id,
      1,
      { viewRevision: a.viewRevision, question: '매출' },
      2,
      undefined,
      0,
    );
    await entered;
    await service.revokePolicy(org.id, policyA.id, { expectedVersion: 1 }, 1);
    release(JSON.stringify({ blockIds: ['sales'], filters: [] }));
    await expect(pending).rejects.toMatchObject({ status: 403 });
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
    await db.manager.update(Database, 1, { connectionConfig: 'changed-source' });
    await expect(service.catalog(org.id, 1, 3)).rejects.toMatchObject({ status: 409 });
  });
  it('does not let AI widen a user filter or query an invented block', async () => {
    const a: any = await service.catalog(org.id, 1, 2);
    ai.callLlm.mockResolvedValueOnce(JSON.stringify({ blockIds: ['sales'], filters: [] }));
    const result = await service.assistant(
      org.id,
      1,
      {
        viewRevision: a.viewRevision,
        question: '매출',
        filters: [{ column: 'revenue', values: [100] }],
      },
      2,
      undefined,
      0,
    );
    expect(value(result)).toBe(100);
    ai.callLlm.mockResolvedValueOnce(JSON.stringify({ blockIds: ['cost'], filters: [] }));
    connection.queryDuckDB.mockClear();
    await expect(
      service.assistant(
        org.id,
        1,
        { viewRevision: a.viewRevision, question: '다른 지표' },
        2,
        undefined,
        0,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it('rejects a cross-organization group and preserves a sticky public-link gate after revoke', async () => {
    const other = await service.createOrganization({ name: '다른 조직' }, 1);
    const group = await service.addGroup(other.id, { name: '다른 그룹' }, 1);
    await expect(
      service.setMember(
        org.id,
        { login: 'outsider', groupId: group.id, active: true, expectedVersion: 0 },
        1,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await service.revokePolicy(org.id, policyA.id, { expectedVersion: 1 }, 1);
    expect((await db.manager.findOneByOrFail(Dashboard, { id: 1 })).governed).toBe(true);
    await expect(access.sharedDashboard(1)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.revokePolicy(org.id, policyA.id, { expectedVersion: 1 }, 1),
    ).rejects.toMatchObject({ status: 409 });
  });
  const report = async (reports: ConditionReportService, threshold = 200) => {
    const c = await service.catalog(org.id, 1, 2);
    const body = {
      requestId: randomUUID(),
      viewRevision: c.viewRevision,
      blockId: 'sales',
      operator: 'gt',
      threshold: String(threshold),
      intervalSeconds: 60,
    };
    return { body, saved: await reports.create(org.id, 1, body, 2) };
  };
  it('RXS20 schedules one durable exact occurrence across retries and a new worker instance', async () => {
    const reports = new ConditionReportService(db, service);
    const { body, saved } = await report(reports);
    expect((await reports.create(org.id, 1, body, 2)).id).toBe(saved.id);
    await Promise.all([
      reports.evaluate(org.id, 1, saved.id, {}, 2),
      new ConditionReportService(db, service).runDue(),
    ]);
    await reports.evaluate(org.id, 1, saved.id, {}, 2);
    expect(
      await db.manager.count(ConditionReportOccurrence, { where: { reportId: saved.id } }),
    ).toBe(1);
    const list = await reports.list(org.id, 1, 2);
    expect(list[0].records[0]).toMatchObject({ outcome: 'matched', result: { value: 250 } });
    const below = await report(reports, 300);
    await reports.evaluate(org.id, 1, below.saved.id, {}, 2);
    expect(
      (await reports.list(org.id, 1, 2)).find(r => r.id === below.saved.id).records[0].outcome,
    ).toBe('not_matched');
  });
  it('RXS20 hides A historical values after membership switches to B and does not alert stale jobs', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    await reports.evaluate(org.id, 1, saved.id, {}, 2);
    await service.setMember(
      org.id,
      { login: 'partner-a', groupId: groupB.id, active: true, expectedVersion: 1 },
      1,
    );
    const list = await reports.list(org.id, 1, 2);
    expect(list[0]).toMatchObject({ restricted: true, records: [] });
    expect(JSON.stringify(list)).not.toContain('250');
    await db.manager.update(ConditionReport, saved.id, {
      nextAt: new Date(Date.now() - 1000).toISOString(),
    });
    await new ConditionReportService(db, service).runDue();
    const rows = await db.manager.find(ConditionReportOccurrence, {
      where: { reportId: saved.id },
    });
    expect(rows.filter(r => r.outcome === 'matched')).toHaveLength(1);
    expect(rows.find(r => r.outcome === 'stale').result).toBeNull();
  });
  it('RXS20 does not commit a cancelled or superseded lease and never reuses prior successful data on failure', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    let resume: () => void, entered: () => void;
    const held = new Promise<void>(r => {
      entered = r;
    });
    const native = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementationOnce(async (...args) => {
      entered();
      await new Promise<void>(r => {
        resume = r;
      });
      return native(...args);
    });
    const running = reports.evaluate(org.id, 1, saved.id, {}, 2);
    await held;
    await reports.stop(org.id, 1, saved.id, { expectedVersion: 1 }, 2);
    resume();
    await running;
    expect(
      await db.manager.count(ConditionReportOccurrence, { where: { reportId: saved.id } }),
    ).toBe(0);
    const other = await report(reports);
    connection.queryDuckDB.mockRejectedValueOnce(new Error('private upstream path'));
    await reports.evaluate(org.id, 1, other.saved.id, {}, 2);
    const record = await db.manager.findOneByOrFail(ConditionReportOccurrence, {
      reportId: other.saved.id,
    });
    expect(record).toMatchObject({ outcome: 'failed', result: null });
  });
  it('RXS20 drops a superseded worker and recovers its expired lease without duplicate occurrence', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    let resume: () => void, entered: () => void;
    const held = new Promise<void>(r => {
      entered = r;
    });
    const native = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementationOnce(async (...args) => {
      entered();
      await new Promise<void>(r => {
        resume = r;
      });
      return native(...args);
    });
    const running = reports.evaluate(org.id, 1, saved.id, {}, 2);
    await held;
    await db.manager.update(ConditionReport, saved.id, {
      leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() + 60000).toISOString(),
    });
    resume();
    await running;
    expect(
      await db.manager.count(ConditionReportOccurrence, { where: { reportId: saved.id } }),
    ).toBe(0);
    await db.manager.update(ConditionReport, saved.id, {
      leaseUntil: new Date(Date.now() - 1000).toISOString(),
    });
    await new ConditionReportService(db, service).runDue();
    expect(
      await db.manager.count(ConditionReportOccurrence, { where: { reportId: saved.id } }),
    ).toBe(1);
    expect((await reports.list(org.id, 1, 2))[0].records[0]).toMatchObject({
      outcome: 'matched',
      result: { value: 250 },
    });
  });
  it('RXS20 keeps exact decimal strings through threshold comparison and report history', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports, 1000000000000000);
    // Worker protocol returns exact DECIMAL strings; inject that boundary value without rounding it to JS Number.
    const c = await service.catalog(org.id, 1, 2);
    jest.spyOn(service, 'query').mockResolvedValueOnce({
      viewRevision: c.viewRevision,
      queriedAt: new Date().toISOString(),
      filters: [],
      blocks: [
        {
          id: 'sales',
          kind: 'BOARD_NUMERIC',
          title: '매출',
          display: { suffix: 'USD' },
          datas: [{ value: '1000000000000000.01' }],
        },
      ],
    } as any);
    await reports.evaluate(org.id, 1, saved.id, {}, 2);
    expect((await reports.list(org.id, 1, 2))[0].records[0]).toMatchObject({
      outcome: 'matched',
      result: { value: '1000000000000000.01' },
    });
  });
  it('RXS20 serializes stop behind finalization so a successful stop cannot roll back', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    const native = service.catalog.bind(service);
    let count = 0,
      entered: () => void,
      resume: () => void;
    const held = new Promise<void>(r => {
      entered = r;
    });
    jest.spyOn(service, 'catalog').mockImplementation(async (...args) => {
      const value = await native(...args);
      if (++count === 3) {
        entered();
        await new Promise<void>(r => {
          resume = r;
        });
      }
      return value;
    });
    const running = reports.evaluate(org.id, 1, saved.id, {}, 2);
    await held;
    let stopped = false;
    const stopping = reports.stop(org.id, 1, saved.id, { expectedVersion: 1 }, 2).then(r => {
      stopped = true;
      return r;
    });
    await db.manager.findOneBy(ConditionReport, { id: saved.id });
    expect(stopped).toBe(false);
    resume();
    await Promise.all([running, stopping]);
    expect((await db.manager.findOneByOrFail(ConditionReport, { id: saved.id })).active).toBe(
      false,
    );
  });
  it('RXS20 rolls back an occurrence if the lease expires during final authorization', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    const native = service.catalog.bind(service);
    let count = 0,
      entered: () => void,
      resume: () => void;
    const held = new Promise<void>(r => {
      entered = r;
    });
    jest.spyOn(service, 'catalog').mockImplementation(async (...args) => {
      const value = await native(...args);
      if (++count === 3) {
        entered();
        await new Promise<void>(r => {
          resume = r;
        });
      }
      return value;
    });
    const running = reports.evaluate(org.id, 1, saved.id, {}, 2);
    await held;
    // Expire the persisted lease while the already-read worker is waiting inside its commit.
    await db.manager.update(ConditionReport, saved.id, {
      leaseUntil: new Date(Date.now() - 1000).toISOString(),
    });
    resume();
    await expect(running).rejects.toMatchObject({ status: 409 });
    expect(
      await db.manager.count(ConditionReportOccurrence, { where: { reportId: saved.id } }),
    ).toBe(0);
  });
  it('RXS20 lists active work ahead of newer stopped history', async () => {
    const reports = new ConditionReportService(db, service),
      { saved } = await report(reports);
    const base = await db.manager.findOneByOrFail(ConditionReport, { id: saved.id });
    for (let n = 0; n < 21; n++)
      await db.manager.save(ConditionReport, {
        ...base,
        id: randomUUID(),
        active: false,
        createdAt: new Date(Date.now() + n + 1000),
      });
    const list = await reports.list(org.id, 1, 2);
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe(saved.id);
    expect(list[0].active).toBe(true);
  });
});
