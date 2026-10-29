jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioRun } from '../dashboard-studio/entities/studio-run.entity';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { ReportsService } from './reports.service';
import {
  REPORT_ENTITIES,
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
  PrivateReportRequest,
} from './report.entity';
import { ReportSave } from './report-contract';

const actor = { id: 7, authVersion: 0 };
describe('private reports with SQLite transactions and native aggregate capture', () => {
  let db: DataSource,
    worker: DuckDBService,
    root: string,
    connection: any,
    studio: StudioService,
    reports: ReportsService,
    dashboardId: number;
  let file: string, nextFile: string, currentFile: string, command: ReportSave, id: string;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'private-report-test-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    file = (
      await worker.importFile({
        originalname: 'sales.csv',
        buffer: Buffer.from('channel,amount\nSite,300\nMobile,200\n'),
      })
    ).filename;
    nextFile = (
      await worker.importFile({
        originalname: 'new-sales.csv',
        buffer: Buffer.from('channel,amount\nSite,900\nMobile,400\n'),
      })
    ).filename;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        SourceCatalogEntry,
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
        ...REPORT_ENTITIES,
      ],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'report-owner',
      email: 'report-owner@example.invalid',
      password: 'synthetic',
    });
    await db.manager.insert(User, {
      id: 8,
      userId: 'other',
      email: 'other@example.invalid',
      password: 'synthetic',
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Sales',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.insert(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      captureDuckDBSnapshot: jest.fn(async () => {
        const pinned = currentFile;
        return {
          run: async callback => {
            const old = activeFile;
            activeFile = pinned;
            try {
              return await callback();
            } finally {
              activeFile = old;
            }
          },
        };
      }),
      withDuckDBSnapshot: jest.fn((_id, callback) => callback()),
      duckDBVersion: jest.fn(async () => studioDigest(activeFile ?? currentFile)),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) =>
        worker.query(activeFile ?? currentFile, sql, bindings),
      ),
    };
    const access = new SourceAccessService(db);
    const ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    studio = new StudioService(db, ai, connection, access);
    reports = new ReportsService(db, studio, access);
    currentFile = file;
    const definition = {
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
      unit: 'USD',
      decimalPlaces: 2,
      numberNotation: 'plain',
    };
    const metric = await db.manager.save(Metric, {
      name: 'report-revenue',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
    });
    const widgets = [
      {
        title: 'Revenue',
        description: '',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM("amount") AS value FROM source',
        valueField: 'value',
        decimalPlaces: 2,
      },
      {
        title: 'Channels',
        description: '',
        type: 'CHART_COLUMN',
        sql: 'SELECT "channel" AS dimension, SUM("amount") AS value FROM source GROUP BY "channel" ORDER BY value DESC LIMIT 500',
        valueField: 'value',
        categoryField: 'dimension',
        decimalPlaces: 2,
      },
    ];
    const structured = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: widgets.map((widget, index) => ({
        sourceId: 1,
        metricId: metric.id,
        definitionVersion: 1,
        definition,
        chart: index ? 'bar' : 'number',
        ...(index ? { dimension: 'channel' } : {}),
      })),
    };
    dashboardId = (
      await ai.save(
        { draft: { databaseId: 1, title: 'Sales', explanation: '', widgets } },
        7,
        structured,
      )
    ).data.id;
    const loaded = await studio.get(dashboardId, 7);
    await studio.save(
      dashboardId,
      {
        requestId: randomUUID(),
        expectedRevision: loaded.document.revision,
        expectedSourceRevision: loaded.sourceRevision,
        document: loaded.document,
      },
      7,
    );
  });
  let activeFile: string | undefined;
  beforeEach(async () => {
    await db.manager.update(User, 7, { active: true, authVersion: 0 });
    await db.manager.delete(EnterpriseMembership, { userId: 7 });
    await db.manager.update(Database, 1, {
      ownerId: 7,
      catalogActive: true,
      connectionConfig: '{}',
    });
    await db.manager.update(Dashboard, dashboardId, { assetActive: true, delYn: 'N' });
    currentFile = file;
    const options = await reports.rootOptions(dashboardId, actor);
    id = randomUUID();
    const capture = {
      dashboardId,
      expectedDashboardRevision: options.revision,
      kpiId: options.blocks[0].id,
      chartId: options.blocks[1].id,
    };
    const preview = await reports.preview(id, { expectedOrganizationId: null, capture }, actor);
    command = {
      requestId: randomUUID(),
      expectedOrganizationId: null,
      expectedRevision: null,
      title: 'Revenue report',
      body: '본문 A\n<script>alert("text only")</script>',
      data: { mode: 'capture', capture, previewDigest: preview.previewDigest },
    };
  });
  afterAll(async () => {
    await db?.destroy();
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });
  it('freezes independently known aggregates, preserves history on refresh and retains without SQL', async () => {
    const original = await reports.save(id, command, actor);
    expect(original.report.snapshot.rendered.blocks[0].datas).toEqual([{ value: 500 }]);
    expect(original.report.snapshot.rendered.blocks[1].datas).toEqual([
      { dimension: 'Site', value: 300 },
      { dimension: 'Mobile', value: 200 },
    ]);
    currentFile = nextFile;
    connection.queryDuckDB.mockClear();
    expect((await reports.get(id, actor)).revision).toBe(original.report.revision);
    expect((await reports.list(actor)).some(item => item.id === id)).toBe(true);
    const retained = await reports.save(
      id,
      {
        ...command,
        requestId: randomUUID(),
        expectedRevision: original.report.revision,
        body: '본문 B',
        data: { mode: 'retain', fromRevision: original.report.revision },
      },
      actor,
    );
    expect(retained.report.snapshot).toEqual(original.report.snapshot);
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
    const replay = await reports.save(id, command, actor);
    expect(replay).toEqual({ ...original, replayed: true });
    expect((await reports.get(id, actor)).revision).toBe(retained.report.revision);
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
    const options = await reports.rootOptions(dashboardId, actor);
    const capture = {
      dashboardId,
      expectedDashboardRevision: options.revision,
      kpiId: options.blocks[0].id,
      chartId: options.blocks[1].id,
    };
    const next = await reports.preview(id, { expectedOrganizationId: null, capture }, actor);
    expect(next.snapshot.rendered.blocks[0].datas).toEqual([{ value: 1300 }]);
    const updated = await reports.save(
      id,
      {
        ...command,
        requestId: randomUUID(),
        expectedRevision: retained.report.revision,
        data: { mode: 'capture', capture, previewDigest: next.previewDigest },
      },
      actor,
    );
    expect(updated.report.version).toBe(3);
    expect((await reports.outcome(id, command.requestId, dashboardId, actor)).status).toBe(
      'committed',
    );
    expect(await db.manager.count(PrivateReportRevision, { where: { reportId: id } })).toBe(3);
  });
  it('rejects different payload replay and concurrent head changes without extra revisions', async () => {
    const first = await reports.save(id, command, actor);
    connection.queryDuckDB.mockClear();
    await expect(reports.save(id, { ...command, body: 'different' }, actor)).rejects.toThrow(
      '같은 요청',
    );
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
    const retain = {
      ...command,
      expectedRevision: first.report.revision,
      data: { mode: 'retain' as const, fromRevision: first.report.revision },
    };
    const results = await Promise.allSettled([
      reports.save(id, { ...retain, requestId: randomUUID(), body: 'one' }, actor),
      reports.save(id, { ...retain, requestId: randomUUID(), body: 'two' }, actor),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.manager.count(PrivateReportRevision, { where: { reportId: id } })).toBe(2);
  });
  it('rolls back head, revision and chunks when receipt insertion fails, then retries once', async () => {
    const insert = EntityManager.prototype.insert;
    const spy = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(function (target, value) {
        if (target === PrivateReportRequest) throw new Error('receipt fixture failure');
        return insert.call(this, target, value);
      });
    try {
      await expect(reports.save(id, command, actor)).rejects.toThrow('receipt fixture');
    } finally {
      spy.mockRestore();
    }
    expect(await db.manager.count(PrivateReport, { where: { id } })).toBe(0);
    expect(await db.manager.count(PrivateReportRevision, { where: { reportId: id } })).toBe(0);
    expect(await db.manager.count(PrivateReportChunk, { where: { reportId: id } })).toBe(0);
    expect((await reports.save(id, command, actor)).report.version).toBe(1);
  });
  it('denies current epoch, source ownership and lifecycle while preserving stored revisions; fresh login reopens', async () => {
    const original = await reports.save(id, command, actor);
    await expect(reports.get(id, { id: 8, authVersion: 0 })).rejects.toThrow();
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(reports.get(id, actor)).rejects.toThrow();
    await expect(reports.save(id, command, actor)).rejects.toThrow();
    expect((await reports.get(id, { id: 7, authVersion: 1 })).revision).toBe(
      original.report.revision,
    );
    await db.manager.update(User, 7, { authVersion: 0 });
    await db.manager.update(Database, 1, { ownerId: 8 });
    await expect(reports.outcome(id, command.requestId, dashboardId, actor)).rejects.toThrow();
    await expect(reports.get(id, actor)).rejects.toThrow();
    expect((await reports.list(actor)).some(item => item.id === id)).toBe(false);
    await db.manager.update(Database, 1, { ownerId: 7 });
    await db.manager.update(Dashboard, dashboardId, { assetActive: false });
    await expect(reports.get(id, actor)).rejects.toThrow();
    expect(await db.manager.count(PrivateReportRevision, { where: { reportId: id } })).toBe(1);
  });
  it('detects corrupt, missing, reordered chunks before returning any report', async () => {
    await reports.save(id, command, actor);
    const chunk = await db.manager.findOneBy(PrivateReportChunk, {
      reportId: id,
      version: 1,
      ordinal: 0,
    });
    await db.manager.update(
      PrivateReportChunk,
      { reportId: id, version: 1, ordinal: 0 },
      { payload: chunk.payload + ' ' },
    );
    await expect(reports.get(id, actor)).rejects.toThrow('무결성');
    await expect(reports.list(actor)).rejects.toThrow('무결성');
    await db.manager.update(
      PrivateReportChunk,
      { reportId: id, version: 1, ordinal: 0 },
      { payload: chunk.payload, ordinal: 3 },
    );
    await expect(reports.get(id, actor)).rejects.toThrow('무결성');
    await db.manager.delete(PrivateReportChunk, { reportId: id });
  });
  it('rejects stale preview, unknown input and changed epoch after aggregation, with zero writes', async () => {
    currentFile = nextFile;
    await expect(reports.save(id, command, actor)).rejects.toThrow('미리보기');
    currentFile = file;
    await expect(reports.save(id, { ...command, datas: [{ value: 1 }] }, actor)).rejects.toThrow();
    const query = connection.queryDuckDB.getMockImplementation();
    let changed = false;
    connection.queryDuckDB.mockImplementation(async (...args) => {
      const result = await query(...args);
      if (!changed && /SELECT/i.test(args[1])) {
        changed = true;
        await db.manager.update(User, 7, { authVersion: 2 });
      }
      return result;
    });
    try {
      await expect(reports.save(id, command, actor)).rejects.toThrow();
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
    expect(await db.manager.count(PrivateReport, { where: { id } })).toBe(0);
  });
  it('never upserts another owner report inserted after an absent-head read', async () => {
    const competing = {
      id,
      ownerId: 8,
      organizationKey: 0,
      dashboardId: 999,
      sourceId: 999,
      version: 1,
      revision: 'c'.repeat(64),
      title: 'Other owner',
      updatedAt: '2026-10-29T00:00:00Z',
    };
    await db.manager.insert(PrivateReport, competing);
    const find = EntityManager.prototype.findOne;
    const spy = jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (target, options) {
        if (target === PrivateReport) return Promise.resolve(null);
        return find.call(this, target, options);
      });
    try {
      await expect(reports.save(id, command, actor)).rejects.toThrow('이미 사용');
    } finally {
      spy.mockRestore();
    }
    expect(await db.manager.findOneBy(PrivateReport, { id })).toEqual(competing);
    expect(await db.manager.count(PrivateReportRevision, { where: { reportId: id } })).toBe(0);
  });
  it('rejects a new revision at the owner retained-byte cap without pruning history', async () => {
    const reservedId = randomUUID();
    await db.manager.insert(PrivateReport, {
      id: reservedId,
      ownerId: 7,
      organizationKey: 0,
      dashboardId,
      sourceId: 1,
      version: 10,
      revision: 'd'.repeat(64),
      title: 'Reserved history',
      updatedAt: '2026-10-29T00:00:00Z',
    });
    for (let version = 1; version <= 10; version += 1)
      await db.manager.insert(PrivateReportRevision, {
        reportId: reservedId,
        version,
        ownerId: 7,
        revision: 'd'.repeat(64),
        bytes: 2 * 1024 * 1024,
        chunkCount: 1,
      });
    try {
      await expect(reports.save(id, command, actor)).rejects.toThrow('20MiB');
      expect(await db.manager.count(PrivateReport, { where: { id } })).toBe(0);
      expect(
        await db.manager.count(PrivateReportRevision, { where: { reportId: reservedId } }),
      ).toBe(10);
    } finally {
      await db.manager.delete(PrivateReportRevision, { reportId: reservedId });
      await db.manager.delete(PrivateReport, { id: reservedId });
    }
  });
});
