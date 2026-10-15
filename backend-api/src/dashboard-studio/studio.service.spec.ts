jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
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
import { SourceAccessService } from '../ownership/source-access.service';
import { applyStudioOperation } from './studio-operations';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const draft = () => ({
  databaseId: 1,
  title: 'Studio actual',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    },
    {
      title: 'Channels',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT category,sum(amount) AS value FROM source GROUP BY category',
      categoryField: 'category',
      valueField: 'value',
      decimalPlaces: 0,
    },
  ],
});
describe('Studio real DuckDB and transactional metadata', () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    root: string,
    id: number,
    connection: any;
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-t4-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time\nSite,300,2026-01-01T00:00:00Z\nMobile,200,2026-01-02T00:00:00Z\n',
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
      connectionConfig: '{}',
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    connection = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      duckDBVersion: jest.fn().mockResolvedValue(studioDigest('test-source')),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(file.filename, sql, bindings)),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, ai, connection, new SourceAccessService(db));
  });
  beforeEach(async () => {
    id = (await ai.save({ draft: draft() }, 7)).data.id;
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  const save = async (doc: any, requestId = 'request1-' + id, expectedRevision = doc.revision) =>
    studio.save(
      id,
      {
        requestId,
        expectedRevision,
        expectedSourceRevision: studioDigest('test-source'),
        document: doc,
      },
      7,
    );
  it('filters every block before aggregation, persists scope without changing canonical SQL, clears scope', async () => {
    const initial = await studio.get(id, 7);
    const document = applyStudioOperation(initial.document, {
      type: 'setFilters',
      filters: [{ column: 'category', values: ['Site'] }],
    });
    const body = {
      document,
      expectedRevision: document.revision,
      expectedSourceRevision: initial.sourceRevision,
    };
    const filtered = await studio.prepare(id, body, 7);
    expect(filtered.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(filtered.preview.widgets[1].datas).toEqual([{ category: 'Site', value: 300 }]);
    expect((await studio.get(id, 7)).document.filters).toBeUndefined();
    const saved = await save(document);
    const loaded = await studio.get(id, 7);
    expect(loaded.document.filters).toEqual(document.filters);
    expect(loaded.preview.widgets.map(w => w.datas)).toEqual(
      filtered.preview.widgets.map(w => w.datas),
    );
    expect((await ai.analysis(id, 7)).data.defaultFilters).toEqual(document.filters);
    expect((await ai.analysis(id, 7)).data.widgets.map(w => w.sql)).toEqual(
      draft().widgets.map(w => w.sql),
    );
    const published = await studio.publicationSnapshot(
      id,
      saved.document.revision,
      7,
      async v => v,
    );
    expect(published.document.filters).toEqual(document.filters);
    expect(published.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    // Legacy writes invalidate StudioState; server-owned scope is still reconstructed correctly.
    const row = await db.manager.findOneBy(Dashboard, { id });
    await db.manager.update(Dashboard, { id }, { title: row.title + ' legacy' });
    const imported = await studio.get(id, 7);
    expect(imported.document.filters).toEqual(document.filters);
    const cleared = applyStudioOperation(imported.document, { type: 'setFilters', filters: [] });
    await save(cleared, 'clear-filter-' + id);
    expect((await studio.get(id, 7)).preview.widgets[0].datas).toEqual([{ value: 500 }]);
    expect((await ai.analysis(id, 7)).data.defaultFilters).toBeUndefined();
  });
  it('unknown filter columns fail closed before save or preview and empty results do not use stale totals', async () => {
    const initial = await studio.get(id, 7);
    const invalid = {
      ...initial.document,
      filters: [{ column: 'not_a_column', values: ['Site'] }],
    };
    const count = await db.manager.count(Widget);
    await expect(
      studio.prepare(
        id,
        {
          document: invalid,
          expectedRevision: invalid.revision,
          expectedSourceRevision: initial.sourceRevision,
        },
        7,
      ),
    ).rejects.toThrow();
    await expect(save(invalid)).rejects.toThrow();
    expect(await db.manager.count(Widget)).toBe(count);
    expect((await studio.get(id, 7)).document).toEqual(initial.document);
    const empty = { ...initial.document, filters: [{ column: 'category', values: ['Absent'] }] };
    const result = await studio.prepare(
      id,
      {
        document: empty,
        expectedRevision: empty.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(result.preview.widgets[0].datas).toEqual([{ value: null }]);
    expect(result.preview.widgets[1].datas).toEqual([]);
  });
  it('applies a saved date range before aggregation, imports it, and clears the stored range', async () => {
    const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-01' };
    const initial = await studio.get(id, 7);
    const scoped = applyStudioOperation(initial.document, {
      type: 'setDateRange',
      dateRange: range,
    });
    const prepared = await studio.prepare(
      id,
      {
        document: scoped,
        expectedRevision: scoped.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(prepared.document.dateRange).toEqual(range);
    expect(prepared.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    expect(prepared.preview.widgets[1].datas).toEqual([{ category: 'Site', value: 300 }]);
    // An unsaved range never becomes part of the server document.
    expect((await studio.get(id, 7)).document.dateRange).toBeUndefined();

    await save(scoped, 'range-save-' + id);
    const loaded = await studio.get(id, 7);
    expect(loaded.document.dateRange).toEqual(range);
    expect(loaded.preview.widgets[0].datas).toEqual([{ value: 300 }]);
    const stored = JSON.parse(
      String((await db.manager.findOneBy(Dashboard, { id }))?.structuredDefinition),
    );
    expect(stored.studioDateRange).toEqual(range);
    expect(stored.studioFilters).toBeUndefined();
    expect((await ai.analysis(id, 7)).data.defaultDateRange).toEqual(range);
    // The stored range and filters compose in one scoped query: Mobile exists only outside it.
    const combined = applyStudioOperation(loaded.document, {
      type: 'setFilters',
      filters: [{ column: 'category', values: ['Mobile'] }],
    });
    const composed = await studio.prepare(
      id,
      {
        document: combined,
        expectedRevision: combined.revision,
        expectedSourceRevision: initial.sourceRevision,
      },
      7,
    );
    expect(composed.preview.widgets[0].datas).toEqual([{ value: null }]);
    expect(composed.preview.widgets[1].datas).toEqual([]);

    // A legacy write invalidates StudioState; the server-owned range is still reconstructed.
    await db.manager.update(Dashboard, { id }, { title: 'range legacy' });
    const imported = await studio.get(id, 7);
    expect(imported.document.dateRange).toEqual(range);
    expect(imported.preview.widgets[0].datas).toEqual([{ value: 300 }]);

    const cleared = applyStudioOperation(imported.document, {
      type: 'setDateRange',
      dateRange: null,
    });
    await save(cleared, 'range-clear-' + id);
    const afterClear = await studio.get(id, 7);
    expect(afterClear.document.dateRange).toBeUndefined();
    expect(afterClear.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const clearedSnapshot = JSON.parse(
      String((await db.manager.findOneBy(Dashboard, { id }))?.structuredDefinition),
    );
    expect(clearedSnapshot.studioDateRange).toBeUndefined();
    expect((await ai.analysis(id, 7)).data.defaultDateRange).toBeUndefined();
  });
  it('fails closed on a malformed saved scope with a distinguishable code', async () => {
    const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-01' };
    const initial = await studio.get(id, 7);
    await save(
      applyStudioOperation(initial.document, { type: 'setDateRange', dateRange: range }),
      'range-invalid-' + id,
    );
    const row = await db.manager.findOneBy(Dashboard, { id });
    if (!row) throw new Error('Expected saved dashboard');
    const stored = JSON.parse(String(row.structuredDefinition));
    stored.studioDateRange = { column: 'event_time', start: '2026-01-01', end: 'not-a-date' };
    await db.manager.update(
      Dashboard,
      { id },
      { structuredDefinition: JSON.stringify(stored), title: 'malformed range' },
    );
    const failure = async (run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        return (error as any).getResponse?.();
      }
      return null;
    };
    expect(await failure(() => ai.analysis(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
    expect(await failure(() => studio.get(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
    // Malformed stored filters use the same distinguishable code.
    stored.studioDateRange = range;
    stored.studioFilters = [{ column: 'category' }];
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(stored) });
    expect(await failure(() => ai.analysis(id, 7))).toMatchObject({ code: 'INVALID_STUDIO_SCOPE' });
  });
  it('persists exact viewport geometry/title, keeps existing viewer numbers and canonical references', async () => {
    const state = await studio.get(id, 7);
    expect(state.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const doc = state.document;
    doc.title = 'Edited';
    doc.blocks[0].title = 'Total sales';
    doc.layouts.lg[0].y = 10;
    doc.layouts.md[0].y = 20;
    doc.layouts.xs[0].y = 30;
    const result = await save(doc);
    const loaded = await studio.get(id, 7);
    expect(loaded.document).toEqual(result.document);
    expect(loaded.document.layouts).toEqual(doc.layouts);
    expect(loaded.preview.widgets[0].datas).toEqual([{ value: 500 }]);
    const analysis = (await ai.analysis(id, 7, true)).data;
    expect(analysis.blockLayouts[doc.blocks[0].id].y).toBe(10);
    expect(analysis.widgets[0].sql).toBe(draft().widgets[0].sql);
  });
  it('remaps duplicates only, replays exactly once, rejects changed payload and stale saves without writes', async () => {
    const original = (await studio.get(id, 7)).document;
    const doc = applyStudioOperation(original, {
      type: 'duplicateBlock',
      blockId: original.blocks[0].id,
      newId: 'new:11111111-1111-4111-8111-111111111111',
    });
    const first = await save(doc);
    const count = await db.manager.count(Widget);
    expect(await save(doc)).toEqual(first);
    expect(await db.manager.count(Widget)).toBe(count);
    expect(Object.keys(first.idMap)).toHaveLength(1);
    await expect(save({ ...doc, title: 'Different' })).rejects.toThrow('같은 저장 요청');
    await expect(save(original, 'stale')).rejects.toThrow('다른 화면');
    expect(await db.manager.count(Widget)).toBe(count);
    const loaded = (await studio.get(id, 7)).document;
    expect(loaded.blocks[0].id).toBe(original.blocks[0].id);
    expect(loaded.blocks[2].id).toBe(first.idMap[doc.blocks[2].id]);
  });
  it('checks dashboard/source ownership and rejects unknown persisted IDs/definition tampering', async () => {
    await expect(studio.get(id, 8)).rejects.toThrow();
    const doc = (await studio.get(id, 7)).document;
    const invalid = JSON.parse(JSON.stringify(doc));
    invalid.blocks[0].definitionKey = 'other';
    await expect(save(invalid)).rejects.toThrow('계산 정의');
    const changed = JSON.parse(JSON.stringify(doc));
    changed.blocks[0].id = 'unknown';
    for (const bp of ['lg', 'md', 'xs']) changed.layouts[bp][0].id = 'unknown';
    await expect(save(changed)).rejects.toThrow('계산 정의');
    await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
    try {
      await expect(save(doc)).rejects.toThrow();
    } finally {
      await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
    }
  });
  it('rolls all writes back if the journal fails after widget creation', async () => {
    const doc = (await studio.get(id, 7)).document;
    const count = await db.manager.count(Widget);
    const original = await db.manager.findOneBy(Dashboard, { id });
    await db.query(
      "CREATE TRIGGER studio_fail BEFORE INSERT ON studio_run BEGIN SELECT RAISE(FAIL, 'journal failure'); END",
    );
    try {
      await expect(save({ ...doc, title: 'Failure' })).rejects.toThrow('journal failure');
      expect(await db.manager.count(Widget)).toBe(count);
      expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(original);
      expect(await db.manager.countBy(StudioState, { dashboardId: id })).toBe(0);
    } finally {
      await db.query('DROP TRIGGER studio_fail');
    }
  });
  it('preserves structured metric snapshots through duplicate/delete and blocks stale metric versions', async () => {
    const definition = {
      schemaVersion: 1,
      sourceId: 1,
      definitionVersion: 1,
      label: 'Sales',
      aggregation: 'sum',
      column: 'amount',
    };
    const metric = await db.manager.save(Metric, {
      name: 'studio_sales_' + id,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      dataVersion: 'fixture',
      items: [
        { sourceId: 1, metricId: metric.id, definitionVersion: 1, definition },
        {
          sourceId: 1,
          metricId: metric.id,
          definitionVersion: 1,
          definition,
          dimension: 'category',
          chart: 'bar',
        },
      ],
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const doc = (await studio.get(id, 7)).document;
    expect(doc.blocks[0].measureRefs).toEqual([{ id: metric.id, definitionVersion: '1' }]);
    const next = applyStudioOperation(doc, {
      type: 'duplicateBlock',
      blockId: doc.blocks[1].id,
      newId: 'new:22222222-2222-4222-8222-222222222222',
    });
    const tampered = JSON.parse(JSON.stringify(next));
    tampered.blocks[0].measureRefs = [];
    await expect(save(tampered, 'drop-ref-' + id)).rejects.toThrow('계산 정의');
    await save(next);
    const stored = JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition);
    expect(stored.items).toEqual([snapshot.items[0], snapshot.items[1], snapshot.items[1]]);
    const latest = (await studio.get(id, 7)).document;
    await db.manager.update(
      Metric,
      { id: metric.id },
      { definition: JSON.stringify({ ...definition, definitionVersion: 2 }) },
    );
    await expect(
      studio.prepare(
        id,
        {
          document: latest,
          expectedRevision: latest.revision,
          expectedSourceRevision: await connection.duckDBVersion(1),
        },
        7,
      ),
    ).rejects.toThrow('지표 정의');
    await expect(save({ ...latest, title: 'Stale metric' }, 'metric-stale')).rejects.toThrow(
      '지표 정의',
    );
  });
  it('rejects schema drift in stored dimension references without any writes', async () => {
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [{}, { sourceId: 1, dimension: 'category', chart: 'bar' }],
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const doc = (await studio.get(id, 7)).document;
    await save(doc);
    const latest = (await studio.get(id, 7)).document;
    const count = await db.manager.count(Widget);
    const query = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (source, sql, bindings) => {
      const result = await query(source, sql, bindings);
      return sql === 'DESCRIBE uploaded_data'
        ? { ...result, datas: [...result.datas, { column_name: 'extra', column_type: 'VARCHAR' }] }
        : result;
    });
    try {
      await expect(
        save({ ...latest, title: 'Schema changed' }, 'schema-drift-' + id),
      ).rejects.toThrow('소스 열');
      const latestSource = await connection.duckDBVersion(1);
      await expect(
        studio.prepare(
          id,
          {
            document: latest,
            expectedRevision: latest.revision,
            expectedSourceRevision: latestSource,
          },
          7,
        ),
      ).rejects.toThrow('소스 열');
      expect(await db.manager.count(Widget)).toBe(count);
    } finally {
      connection.queryDuckDB.mockImplementation(query);
    }
  });
  it('rejects a replaced source file even when only numeric measures are edited', async () => {
    const doc = (await studio.get(id, 7)).document;
    const before = await db.manager.count(Widget);
    connection.duckDBVersion.mockResolvedValue(studioDigest('new-source'));
    try {
      await expect(save({ ...doc, title: 'Changed source' }, 'file-stale-' + id)).rejects.toThrow(
        '데이터 파일',
      );
      expect(await db.manager.count(Widget)).toBe(before);
      expect((await studio.get(id, 7)).sourceRevision).toBe(studioDigest('new-source'));
    } finally {
      connection.duckDBVersion.mockResolvedValue(studioDigest('test-source'));
    }
  });
  it('imports legacy single-block metric links with explicitly unlinked attached widgets', async () => {
    const definition = {
      schemaVersion: 1,
      sourceId: 1,
      definitionVersion: 1,
      label: 'Sales',
      aggregation: 'sum',
      column: 'amount',
    };
    const metric = await db.manager.save(Metric, {
      name: 'single_sales_' + id,
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      definition: JSON.stringify(definition),
      useYn: 'Y',
    });
    const snapshot = {
      schemaVersion: 1,
      kind: 'structured-bi',
      sourceId: 1,
      metricId: metric.id,
      definitionVersion: 1,
      definition,
    };
    await db.manager.update(Dashboard, { id }, { structuredDefinition: JSON.stringify(snapshot) });
    const doc = (await studio.get(id, 7)).document;
    expect(doc.blocks[0].measureRefs).toEqual([{ id: metric.id, definitionVersion: '1' }]);
    expect(doc.blocks[1].measureRefs).toEqual([]);
    await save({ ...doc, title: 'Legacy linked' });
    const stored = JSON.parse((await db.manager.findOneBy(Dashboard, { id })).structuredDefinition);
    expect(stored.items[0]).toEqual(snapshot);
    expect(stored.items[1]).toEqual({ kind: 'studio-unlinked-legacy', sourceId: 1 });
  });
  it('rejects malformed structured snapshot alignment rather than inventing unlinked blocks', async () => {
    await db.manager.update(
      Dashboard,
      { id },
      {
        structuredDefinition: JSON.stringify({
          schemaVersion: 1,
          kind: 'structured-bi',
          sourceId: 1,
          metricId: 1,
        }),
      },
    );
    await expect(studio.get(id, 7)).rejects.toThrow('지표 연결');
  });
  it('serializes competing Studio saves and only commits one revision', async () => {
    const doc = (await studio.get(id, 7)).document;
    const before = await db.manager.count(StudioRun);
    const results = await Promise.allSettled([
      save({ ...doc, title: 'First' }, 'race-first-' + id),
      save({ ...doc, title: 'Second' }, 'race-second-' + id),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.manager.count(StudioRun)).toBe(before + 1);
  });
  it('detects legacy edits, reimports current definitions, and retains failed preview metadata', async () => {
    const doc = (await studio.get(id, 7)).document;
    await save({ ...doc, title: 'Studio saved' });
    const edited = await db.manager.findOneBy(Dashboard, { id });
    edited.title = 'Legacy edit';
    await db.manager.save(Dashboard, edited);
    await expect(save({ ...doc, title: 'Overwrite' }, 'legacy-stale')).rejects.toThrow('다른 화면');
    const loaded = await studio.get(id, 7);
    expect(loaded.document.title).toBe('Legacy edit');
    const spy = jest.spyOn(ai, 'preview').mockRejectedValueOnce(new Error('offline'));
    try {
      const failed = await studio.get(id, 7);
      expect(failed.preview).toBeNull();
      expect(failed.document.title).toBe('Legacy edit');
      expect(failed.previewError).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
  it('previews and persists a selected weekly chart without SQL, other blocks or layout changes', async () => {
    await db.manager.save(Component, {
      type: 'CHART_LINE',
      title: 'Line',
      option: '{}',
      useYn: 'Y',
    });
    const original = draft();
    original.widgets[1] = {
      ...original.widgets[1],
      type: 'CHART_LINE',
      categoryField: 'dimension',
      sql: "SELECT date_trunc('day', event_time) AS dimension, sum(amount) AS value FROM source GROUP BY dimension ORDER BY dimension",
    };
    const lineId = (await ai.save({ draft: original }, 7)).data.id;
    const loaded = await studio.get(lineId, 7);
    const next = applyStudioOperation(loaded.document, {
      type: 'updateBlock',
      blockId: loaded.document.blocks[1].id,
      patch: { display: { timeGrain: 'week' } },
    });
    const body = {
      expectedRevision: loaded.document.revision,
      expectedSourceRevision: loaded.sourceRevision,
      document: next,
    };
    const checked = await studio.prepare(lineId, body, 7);
    expect(checked.preview.widgets[1].datas).toHaveLength(1);
    expect(checked.preview.widgets[1].datas[0].value).toBe(500);
    expect(checked.preview.widgets[0].datas).toEqual(loaded.preview.widgets[0].datas);
    expect(checked.document.layouts).toEqual(loaded.document.layouts);
    expect((await studio.get(lineId, 7)).document).toEqual(loaded.document);
    const saved = await studio.save(lineId, { ...body, requestId: 'weekly' }, 7);
    const after = await studio.get(lineId, 7);
    expect(after.document.blocks[1].display.timeGrain).toBe('week');
    expect(after.document.layouts).toEqual(saved.document.layouts);
    expect(after.preview.widgets[1].datas[0].value).toBe(500);
    const mapped = await db.manager.find(DashboardWidget, {
      where: { dashboardId: lineId },
      order: { id: 'ASC' },
    });
    const savedWidget = await db.manager.findOneBy(Widget, { id: mapped[1].widgetId });
    const dataset = await db.manager.findOneBy(Dataset, { id: savedWidget.datasetId });
    const detailRows = await connection.queryDuckDB(1, dataset.query);
    expect(detailRows.datas).toHaveLength(1);
    expect(detailRows.datas[0].value).toBe(500);
    expect((await ai.analysis(lineId, 7, true)).data.widgets[1].sql).toBe(original.widgets[1].sql);
    const daily = applyStudioOperation(after.document, {
      type: 'updateBlock',
      blockId: after.document.blocks[1].id,
      patch: { display: { timeGrain: 'day' } },
    });
    const undo = await studio.prepare(
      lineId,
      {
        expectedRevision: after.document.revision,
        expectedSourceRevision: after.sourceRevision,
        document: daily,
      },
      7,
    );
    expect(undo.preview.widgets[1].datas).toHaveLength(2);
  });
  it('T7 rolls back all metadata and save journal when cancellation arrives before commit', async () => {
    const document = (await studio.get(id, 7)).document;
    const before = await db.manager.findOneBy(Dashboard, { id });
    const count = await db.manager.count(Widget);
    const controller = new AbortController();
    const originalSave = ai.save.bind(ai);
    const hook = jest.spyOn(ai, 'save').mockImplementation(async (...args) => {
      const result = await originalSave(...args);
      controller.abort();
      return result;
    });
    try {
      await expect(
        studio.save(
          id,
          {
            requestId: 'cancel-' + id,
            expectedRevision: document.revision,
            expectedSourceRevision: studioDigest('test-source'),
            document: { ...document, title: 'Cancelled' },
          },
          7,
          controller.signal,
        ),
      ).rejects.toThrow('취소');
      expect(await db.manager.findOneBy(Dashboard, { id })).toEqual(before);
      expect(await db.manager.count(Widget)).toBe(count);
      expect(await db.manager.countBy(StudioRun, { requestId: 'cancel-' + id })).toBe(0);
      expect(await db.manager.countBy(StudioState, { dashboardId: id })).toBe(0);
    } finally {
      hook.mockRestore();
    }
  });
  it('T7 queued cancellation writes zero and aborted replay after commit returns the existing result', async () => {
    const document = (await studio.get(id, 7)).document;
    const request = {
      requestId: 'cancel-queued-' + id,
      expectedRevision: document.revision,
      expectedSourceRevision: studioDigest('test-source'),
      document,
    };
    let release: () => void;
    const blocked = studio.serializeWrite(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );
    await new Promise(resolve => setImmediate(resolve));
    const controller = new AbortController();
    const pending = studio.save(id, request, 7, controller.signal);
    const check = expect(pending).rejects.toThrow('취소');
    controller.abort();
    release();
    await blocked;
    await check;
    expect(await db.manager.countBy(StudioRun, { requestId: request.requestId })).toBe(0);
    const saved = await studio.save(id, request, 7);
    expect(await studio.save(id, request, 7, controller.signal)).toEqual(saved);
    expect(await db.manager.countBy(StudioRun, { requestId: request.requestId })).toBe(1);
  });
  it('T7 checks original and current source ownership independently on read/replay', async () => {
    await db.manager.save(Database, {
      id: 2,
      ownerId: 8,
      name: 'Other',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    const read = jest.spyOn(ai, 'analysis').mockResolvedValue({ data: { databaseId: 2 } } as any);
    try {
      await expect(studio.assertExecutionAccess(id, 1, 7)).rejects.toMatchObject({ status: 403 });
    } finally {
      read.mockRestore();
    }
    await db.manager.update(Database, { id: 2 }, { ownerId: 7 });
    await db.manager.update(Database, { id: 1 }, { ownerId: 8 });
    try {
      await expect(studio.assertExecutionAccess(id, 1, 7)).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.manager.update(Database, { id: 1 }, { ownerId: 7 });
    }
  });
});
