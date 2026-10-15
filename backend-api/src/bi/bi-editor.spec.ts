jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
jest.mock('../ai/ai-dashboard.service', () => ({ AiDashboardService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Metric } from '../metric/entities/metric.entity';
import { BiService } from './bi.service';

describe('BiService dashboard editor boundaries', () => {
  const actor = 10;
  const dashboardId = 42;
  const revision = 'a'.repeat(64);
  const originalSql = 'SELECT SUM("amount") AS value FROM source WHERE "category" = \'A\'';
  let service: BiService;
  let access: any;
  let dashboards: any;
  let dashboard: any;
  let analysis: any;
  let db: any;
  let metricRows: any[];
  let availableMetrics: any[];
  let profile: any;

  const item = (overrides = {}) => ({
    key: 'new-sum',
    kind: 'metric',
    metricId: 11,
    title: 'Revenue',
    chart: 'number',
    dimension: undefined as string | undefined,
    unit: 'USD',
    decimalPlaces: 2,
    numberNotation: 'plain',
    width: 6,
    height: 3,
    ...overrides,
  });
  const body = (overrides = {}) => ({
    expectedRevision: revision,
    title: 'Edited dashboard',
    items: [item()],
    ...overrides,
  });

  const threeBlocks = () => {
    analysis.widgets = [
      { ...analysis.widgets[0], blockId: 'block-1', title: '월별 매출' },
      { ...analysis.widgets[0], blockId: 'block-2', title: '월별 비용' },
      { ...analysis.widgets[0], blockId: 'block-3', title: '건수' },
    ];
    analysis.layoutSizes = [
      { width: 6, height: 3 },
      { width: 6, height: 3 },
      { width: 6, height: 3 },
    ];
  };
  const blockCandidates = [
    { key: 'block-1', title: '월별 매출', position: 1 },
    { key: 'block-2', title: '월별 비용', position: 2 },
    { key: 'block-3', title: '건수', position: 3 },
  ];

  beforeEach(() => {
    profile = {
      sourceId: 1,
      supported: true,
      dataVersion: 'source-version',
      columns: [
        { name: 'amount', numeric: true, temporal: false },
        { name: 'category', numeric: false, temporal: false },
        { name: 'day', numeric: false, temporal: true },
      ],
    };
    metricRows = [
      { id: 11, aggregation: 'SUM', column: 'amount', sourceId: 1 },
      { id: 12, aggregation: 'COUNT', column: '*', sourceId: 1 },
      { id: 13, aggregation: 'SUM', column: 'amount', sourceId: 2 },
    ].map(m => ({
      id: m.id,
      databaseId: m.sourceId,
      useYn: 'Y',
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: m.sourceId,
        tableName: 'uploaded_data',
        label: `Metric ${m.id}`,
        aggregation: m.aggregation,
        column: m.column,
        unit: 'original',
        decimalPlaces: 0,
        numberNotation: 'compact',
      }),
    }));
    availableMetrics = metricRows
      .filter(m => m.databaseId === 1)
      .map(m => ({
        id: m.id,
        definition: JSON.parse(m.definition),
      }));
    analysis = {
      databaseId: 1,
      title: 'Original dashboard',
      explanation: 'Saved analysis',
      revision,
      widgets: [
        {
          title: 'Original filtered total',
          description: 'Original description',
          type: 'BOARD_NUMERIC',
          sql: originalSql,
          valueField: 'value',
          suffix: ' kg',
          decimalPlaces: 1,
          numberNotation: 'compact',
        },
      ],
      layoutSizes: [{ width: 6, height: 3 }],
    };
    dashboard = { id: dashboardId, structuredDefinition: null, layout: '[]' };
    db = {
      getRepository: jest.fn(entity => {
        if (entity === Dashboard) return { findOne: jest.fn(async () => dashboard) };
        if (entity === Metric)
          return {
            findOne: jest.fn(async ({ where }) => metricRows.find(m => m.id === where.id)),
          };
        throw new Error('unexpected repository');
      }),
    };
    access = { assert: jest.fn().mockResolvedValue(undefined), id: jest.fn(Number) };
    dashboards = {
      generate: jest.fn(),
      proposeBlockLayout: jest.fn(),
      classifyBlockIntent: jest.fn(),
      analysis: jest.fn(async () => ({ data: analysis })),
      preview: jest.fn().mockResolvedValue({ data: { widgets: [{ rows: [{ value: 150 }] }] } }),
      save: jest.fn().mockResolvedValue({ data: { id: dashboardId, revision: 'b'.repeat(64) } }),
    };
    service = new BiService(db, access, {} as any, dashboards);
    jest.spyOn(service, 'profile').mockImplementation(async () => profile);
    jest.spyOn(service, 'metrics').mockImplementation(async () => availableMetrics);
  });

  it('loads the owned, revisioned baseline and exposes presentation without raw SQL', async () => {
    const result = await service.editor(String(dashboardId), actor);
    expect(access.assert).toHaveBeenCalledWith('dashboard', String(dashboardId), actor);
    expect(dashboards.analysis).toHaveBeenCalledWith(dashboardId, actor, true);
    expect(service.profile).toHaveBeenCalledWith(1, actor);
    expect(service.metrics).toHaveBeenCalledWith(1, actor);
    expect(result).toMatchObject({
      dashboardId,
      title: analysis.title,
      sourceId: 1,
      revision,
      profile,
      metrics: availableMetrics,
      items: [
        {
          key: 'existing-0',
          kind: 'existing',
          title: analysis.widgets[0].title,
          chart: 'number',
          unit: 'kg',
          decimalPlaces: 1,
          numberNotation: 'compact',
          width: 6,
          height: 3,
        },
      ],
    });
    expect(result).not.toHaveProperty('analysis');
    expect(result.items[0]).not.toHaveProperty('sql');
  });

  it('compiles SUM/bar and COUNT/line plus a number with per-widget formats and atomic v2 snapshot', async () => {
    const request = body({
      items: [
        item({ key: 'sum-bar', chart: 'bar', dimension: 'category', width: 12, height: 5 }),
        item({
          key: 'count-line',
          metricId: 12,
          chart: 'line',
          dimension: 'day',
          unit: 'rows',
          decimalPlaces: 0,
          numberNotation: 'compact',
          width: 12,
          height: 7,
        }),
        item({ key: 'sum-number', unit: 'kg', decimalPlaces: 3 }),
      ],
    });
    expect(await service.saveEditor(dashboardId, request, actor)).toEqual({
      id: dashboardId,
      revision: 'b'.repeat(64),
    });
    expect(dashboards.save).toHaveBeenCalledTimes(1);
    const [saved, savedActor, snapshot] = dashboards.save.mock.calls[0];
    expect(savedActor).toBe(actor);
    expect(saved).toMatchObject({
      dashboardId,
      expectedRevision: revision,
      draft: {
        databaseId: 1,
        title: request.title,
        layoutSizes: [
          { width: 12, height: 5 },
          { width: 12, height: 7 },
          { width: 6, height: 3 },
        ],
      },
    });
    expect(saved.draft.widgets).toEqual([
      expect.objectContaining({
        type: 'CHART_COLUMN',
        categoryField: 'dimension',
        sql: 'SELECT "category" AS dimension, SUM("amount") AS value FROM source GROUP BY "category" ORDER BY value DESC LIMIT 500',
        suffix: ' USD',
        decimalPlaces: 2,
        numberNotation: 'full',
      }),
      expect.objectContaining({
        type: 'CHART_LINE',
        categoryField: 'dimension',
        sql: 'SELECT "day" AS dimension, COUNT(*) AS value FROM source GROUP BY "day" ORDER BY dimension LIMIT 500',
        suffix: ' rows',
        decimalPlaces: 0,
        numberNotation: 'compact',
      }),
      expect.objectContaining({
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM("amount") AS value FROM source',
        suffix: ' kg',
        decimalPlaces: 3,
        numberNotation: 'full',
      }),
    ]);
    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      dataVersion: profile.dataVersion,
    });
    expect(snapshot.items).toEqual(
      request.items.map(i =>
        expect.objectContaining({
          key: i.key,
          metricId: i.metricId,
          chart: i.chart,
          dimension: i.dimension,
          definition: JSON.parse(metricRows.find(m => m.id === i.metricId).definition),
          presentation: {
            unit: i.unit,
            decimalPlaces: i.decimalPlaces,
            numberNotation: i.numberNotation,
          },
        }),
      ),
    );
    expect(snapshot.items[0].dimensionDefinition).toMatchObject({
      column: 'category',
      definitionVersion: 1,
      id: expect.stringMatching(/^dim_/),
    });
    expect(snapshot.items[1].dimensionDefinition).toMatchObject({
      column: 'day',
      definitionVersion: 1,
    });
    expect(JSON.parse(metricRows[0].definition)).toMatchObject({
      unit: 'original',
      decimalPlaces: 0,
    });
  });

  it('previews and saves only the server SQL for an existing key despite forged client SQL/source', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const request = body({
      sourceId: 2,
      items: [
        {
          ...existing,
          title: 'Renamed',
          sql: 'SELECT * FROM secret',
          databaseId: 2,
          unit: 'USD',
          decimalPlaces: 2,
        },
      ],
    });
    expect(await service.editorPreview(dashboardId, request, actor)).toMatchObject({
      widgets: [{ rows: [{ value: 150 }] }],
    });
    expect(dashboards.preview).toHaveBeenCalledWith(
      {
        includeTrends: true,
        draft: expect.objectContaining({
          databaseId: 1,
          widgets: [
            expect.objectContaining({ sql: originalSql, title: 'Renamed', suffix: ' USD' }),
          ],
        }),
      },
      actor,
    );
    await service.saveEditor(dashboardId, request, actor);
    expect(dashboards.save.mock.calls[0][0].draft.widgets[0].sql).toBe(originalSql);
    expect(analysis.widgets[0].title).toBe('Original filtered total');
  });

  it('falls back to the original SQL when the saved metric has been deleted', async () => {
    dashboard.structuredDefinition = JSON.stringify({
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 1,
      items: [
        {
          key: 'saved-revenue',
          metricId: 99,
          chart: 'number',
          definition: { aggregation: 'SUM', column: 'amount' },
        },
      ],
    });
    const editor = await service.editor(dashboardId, actor);
    expect(editor.items[0]).toMatchObject({
      key: 'saved-revenue',
      kind: 'existing',
      metricId: 99,
      metricAvailable: false,
    });
    const prepare = jest.spyOn(service, 'prepare');
    await service.saveEditor(dashboardId, body({ items: editor.items }), actor);
    expect(prepare).not.toHaveBeenCalled();
    expect(dashboards.save.mock.calls[0][0].draft.widgets[0].sql).toBe(originalSql);
    expect(dashboards.save.mock.calls[0][2].items[0]).toMatchObject({
      key: 'saved-revenue',
      metricId: 99,
    });
  });

  it('duplicates an owned SQL block with a new stable ID and ignores client SQL', async () => {
    analysis.widgets[0].blockId = 'original-block';
    const original = (await service.editor(dashboardId, actor)).items[0];
    const copy = {
      ...original,
      key: 'copy-block',
      copyOf: original.key,
      sql: 'SELECT * FROM secret',
    };
    await service.saveEditor(dashboardId, body({ items: [original, copy] }), actor);
    const widgets = dashboards.save.mock.calls[0][0].draft.widgets;
    expect(widgets.map(w => w.blockId)).toEqual(['original-block', undefined]);
    expect(widgets.map(w => w.sql)).toEqual([originalSql, originalSql]);
    expect(analysis.widgets).toHaveLength(1);
    expect(analysis.widgets[0].blockId).toBe('original-block');
  });

  it.each(['foreign-block', 'original-block', 42])(
    'rejects invalid copy reference %s',
    async copyOf => {
      analysis.widgets[0].blockId = 'original-block';
      const original = (await service.editor(dashboardId, actor)).items[0];
      const key = copyOf === 'original-block' ? 'original-block' : 'copy-block';
      await expect(
        service.saveEditor(
          dashboardId,
          body({
            items: [{ ...original, key, copyOf }],
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('leaves new metric identity issuance to the existing server save boundary', async () => {
    await service.saveEditor(dashboardId, body(), actor);
    expect(dashboards.save.mock.calls[0][0].draft.widgets[0].blockId).toBeUndefined();
  });

  it.each(['editor', 'editorPreview', 'saveEditor', 'editorAi'] as const)(
    '%s denies unauthorized access before reading the baseline or executing SQL',
    async operation => {
      access.assert.mockRejectedValueOnce(new ForbiddenException('not dashboard owner'));
      const result =
        operation === 'editor'
          ? service.editor(dashboardId, 20)
          : service[operation](dashboardId, body(), 20);
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      expect(access.assert).toHaveBeenCalledWith('dashboard', dashboardId, 20);
      expect(dashboards.analysis).not.toHaveBeenCalled();
      expect(db.getRepository).not.toHaveBeenCalled();
      expect(dashboards.preview).not.toHaveBeenCalled();
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('UC-011 changes only selected breakpoint, preserves SQL, recompiles and never saves automatically', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const layouts = { mobile: { x: 0, y: 0, w: 4, h: 3 }, desktop: { x: 0, y: 0, w: 6, h: 3 } };
    dashboards.proposeBlockLayout.mockResolvedValue({ x: 1, y: 0, w: 6, h: 3 });
    const result = await service.editorAi(
      dashboardId,
      body({
        items: [{ ...existing, layouts }],
        selectedKey: existing.key,
        prompt: '오른쪽 한 칸',
        editMode: 'layout',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(result.item).toEqual({
      ...existing,
      layouts: { ...layouts, desktop: { x: 1, y: 0, w: 6, h: 3 } },
    });
    expect(dashboards.preview.mock.calls[0][0].draft.widgets[0].sql).toBe(originalSql);
    expect(JSON.stringify(dashboards.proposeBlockLayout.mock.calls[0][0])).not.toContain(
      originalSql,
    );
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });
  it('UC-011 rejects overlapping layout and stale revisions after provider response', async () => {
    const items = [
      item({ key: 'a', layouts: { desktop: { x: 0, y: 0, w: 6, h: 3 } } }),
      item({ key: 'b', layouts: { desktop: { x: 6, y: 0, w: 6, h: 3 } } }),
    ];
    const request = body({
      items,
      selectedKey: 'a',
      prompt: '오른쪽',
      editMode: 'layout',
      layoutMode: 'desktop',
    });
    dashboards.proposeBlockLayout.mockResolvedValueOnce({ x: 1, y: 0, w: 6, h: 3 });
    await expect(service.editorAi(dashboardId, request, actor)).rejects.toThrow(/겹/);
    dashboards.proposeBlockLayout.mockImplementationOnce(async () => {
      analysis.revision = 'b'.repeat(64);
      return { x: 0, y: 4, w: 6, h: 3 };
    });
    await expect(service.editorAi(dashboardId, request, actor)).rejects.toThrow(ConflictException);
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });
  it('generates against unsaved edits, returns a local draft and never saves it', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const definition = {
      ...analysis.widgets[0],
      title: 'AI average',
      sql: 'SELECT AVG("amount") AS value FROM source',
    };
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { ...analysis, widgets: [definition] },
    });
    const request = body({
      title: 'Unsaved title',
      items: [{ ...existing, title: 'Direct edit', height: 7 }],
      selectedKey: existing.key,
      prompt: '평균으로 변경',
    });
    const result = await service.editorAi(dashboardId, request, actor);
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: 1,
        selectedWidget: 0,
        currentDraft: expect.objectContaining({
          title: 'Unsaved title',
          layoutSizes: [{ width: 6, height: 7 }],
          widgets: [expect.objectContaining({ title: 'Direct edit' })],
        }),
      }),
      actor,
      undefined,
    );
    expect(result.item).toMatchObject({ key: existing.key, kind: 'draft', definition, height: 7 });
    expect(result.editMode).toBe('content');
    expect(result.saveRequested).toBe(false);
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
    await service.saveEditor(dashboardId, body({ items: [result.item] }), actor);
    expect(dashboards.save.mock.calls[0][0].draft.widgets[0].sql).toBe(definition.sql);
  });

  it('applies only the selected AI widget even if other generated widgets change', async () => {
    analysis.widgets.push({ ...analysis.widgets[0], blockId: 'second', title: 'Untouched' });
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        layoutSizes: undefined,
        widgets: [
          { ...analysis.widgets[0], title: 'Selected' },
          { ...analysis.widgets[1], title: 'Forbidden replacement' },
        ],
      },
    });
    await service.editorAi(
      dashboardId,
      body({ items, selectedKey: items[0].key, prompt: '제목 변경' }),
      actor,
    );
    expect(dashboards.preview.mock.calls[0][0].draft.widgets[1]).toEqual(analysis.widgets[1]);
  });

  it.each(['SELECT * FROM secret', 'DELETE FROM source'])(
    'rejects unsafe draft SQL %s',
    async sql => {
      const existing = (await service.editor(dashboardId, actor)).items[0];
      await expect(
        service.saveEditor(
          dashboardId,
          body({
            items: [{ ...existing, kind: 'draft', definition: { ...analysis.widgets[0], sql } }],
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );
  it('keeps the owned identity and source for explicit draft changes despite forged metadata', async () => {
    analysis.widgets[0].blockId = 'owned-block';
    const existing = (await service.editor(dashboardId, actor)).items[0];
    await service.saveEditor(
      dashboardId,
      body({
        sourceId: 2,
        items: [
          {
            ...existing,
            kind: 'draft',
            definition: { ...analysis.widgets[0], blockId: 'foreign-block', databaseId: 2 },
          },
        ],
      }),
      actor,
    );
    expect(dashboards.save.mock.calls[0][0].draft).toMatchObject({
      databaseId: 1,
      widgets: [expect.objectContaining({ blockId: 'owned-block' })],
    });
  });

  it('rejects a missing target and stale AI revision before invoking the model', async () => {
    const items = (await service.editor(dashboardId, actor)).items;
    await expect(
      service.editorAi(dashboardId, body({ items, selectedKey: 'foreign', prompt: '변경' }), actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.editorAi(
        dashboardId,
        body({
          items,
          selectedKey: items[0].key,
          prompt: '변경',
          expectedRevision: 'b'.repeat(64),
        }),
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dashboards.generate).not.toHaveBeenCalled();
  });
  it('rejects a revision changed during the AI call without returning a stale preview', async () => {
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.generate.mockImplementationOnce(async () => {
      analysis.revision = 'b'.repeat(64);
      return { status: 'SUCCESS', data: analysis };
    });
    await expect(
      service.editorAi(
        dashboardId,
        body({ items, selectedKey: items[0].key, prompt: '제목 변경' }),
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('rejects a metric from another source through real prepare even if both sources are owned', async () => {
    const prepare = jest.spyOn(service, 'prepare');
    await expect(
      service.saveEditor(dashboardId, body({ items: [item({ metricId: 13 })] }), actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 1, metricId: 13 }),
      actor,
    );
    expect(access.assert).toHaveBeenCalledWith('metric', 13, actor);
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each([
    ['missing revision', { expectedRevision: undefined }],
    ['invalid revision', { expectedRevision: 'g'.repeat(64) }],
    ['short revision', { expectedRevision: 'a'.repeat(63) }],
    ['empty title', { title: ' ' }],
    ['zero items', { items: [] }],
    ['seven items', { items: Array.from({ length: 7 }, (_, i) => item({ key: `metric-${i}` })) }],
    ['invalid width', { items: [item({ width: 7 })] }],
    ['invalid height', { items: [item({ height: 4 })] }],
    ['duplicate keys', { items: [item(), item()] }],
    ['invalid key', { items: [item({ key: 'injected key' })] }],
    ['unknown existing key', { items: [item({ kind: 'existing', key: 'forged-baseline' })] }],
    ['invalid precision', { items: [item({ decimalPlaces: 7 })] }],
  ])('rejects %s without preview or persistence', async (_name, overrides) => {
    await expect(service.saveEditor(dashboardId, body(overrides), actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each(['editorPreview', 'saveEditor'] as const)(
    '%s rejects a stale revision',
    async operation => {
      await expect(
        service[operation](dashboardId, body({ expectedRevision: 'b'.repeat(64) }), actor),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dashboards.preview).not.toHaveBeenCalled();
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );
  it('UC-013 routes auto layout and clarifies without generation or persistence', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const request = body({
      items: [existing],
      selectedKey: existing.key,
      prompt: '오른쪽 한 칸 옮기고 저장해 줘',
      editMode: 'auto',
      layoutMode: 'desktop',
    });
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'clarify',
      saveRequested: false,
      editPrompt: null,
    });
    await expect(service.editorAi(dashboardId, request, actor)).resolves.toEqual({
      editMode: 'clarify',
      saveRequested: false,
    });
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'layout',
      saveRequested: true,
      editPrompt: '오른쪽 한 칸',
    });
    dashboards.proposeBlockLayout.mockResolvedValueOnce({ x: 1, y: 0, w: 6, h: 3 });
    const result = await service.editorAi(dashboardId, request, actor);
    expect(result.editMode).toBe('layout');
    expect(result.saveRequested).toBe(true);
    expect(result.item.layouts.desktop).toEqual({ x: 1, y: 0, w: 6, h: 3 });
    expect(dashboards.proposeBlockLayout).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '오른쪽 한 칸' }),
      undefined,
    );
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
    await expect(
      service.editorAi(dashboardId, { ...request, expectedRevision: 'b'.repeat(64) }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dashboards.classifyBlockIntent).toHaveBeenCalledTimes(2);
  });

  it('UC-014 rejects access before classification and does not execute after cancellation during classification', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const request = body({
      items: [existing],
      selectedKey: existing.key,
      prompt: '오른쪽 한 칸',
      editMode: 'auto',
      layoutMode: 'desktop',
    });
    access.assert.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.editorAi(dashboardId, request, 20)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    const abort = new AbortController();
    dashboards.classifyBlockIntent.mockImplementationOnce(async () => {
      abort.abort();
      return { intent: 'layout', saveRequested: false, editPrompt: '오른쪽 한 칸' };
    });
    await expect(service.editorAi(dashboardId, request, actor, abort.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-014 previews the whole draft for a save-only plan without a selection or a write', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const request = body({
      items: [{ ...existing, title: 'Direct edit' }],
      selectedKey: '',
      prompt: '현재 편집 내용을 저장해 줘',
      editMode: 'auto',
      layoutMode: 'desktop',
    });
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'save',
      saveRequested: true,
      editPrompt: null,
    });
    const result = await service.editorAi(dashboardId, request, actor);
    expect(result).toEqual({
      editMode: 'save',
      saveRequested: true,
      preview: {
        widgets: [{ rows: [{ value: 150 }] }],
        responsiveLayouts: expect.any(Object),
      },
    });
    expect(result).not.toHaveProperty('item');
    expect(dashboards.preview.mock.calls[0][0]).toMatchObject({
      includeTrends: true,
      draft: {
        databaseId: 1,
        title: 'Edited dashboard',
        widgets: [expect.objectContaining({ sql: originalSql, title: 'Direct edit' })],
      },
    });
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-014 strips save wording before generation and returns the save flag without writing', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: true,
      editPrompt: '제목을 바꿔 줘',
    });
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { ...analysis, widgets: [{ ...analysis.widgets[0], title: '바뀐 제목' }] },
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items: [existing],
        selectedKey: existing.key,
        prompt: '제목을 바꾸고 저장해 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '제목을 바꿔 줘', selectedWidget: 0, databaseId: 1 }),
      actor,
      undefined,
    );
    expect(result.editMode).toBe('content');
    expect(result.saveRequested).toBe(true);
    expect(result.item).toMatchObject({ key: existing.key, title: '바뀐 제목' });
    expect(result.preview).toMatchObject({ responsiveLayouts: expect.any(Object) });
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-014 clarifies a question without a selection and never previews or writes', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'clarify',
      saveRequested: false,
      editPrompt: null,
    });
    await expect(
      service.editorAi(
        dashboardId,
        body({
          items: [existing],
          selectedKey: '',
          prompt: '저장할까요?',
          editMode: 'auto',
          layoutMode: 'desktop',
        }),
        actor,
      ),
    ).resolves.toEqual({ editMode: 'clarify', saveRequested: false });
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 offers every current block when the plan needs a target the question never names', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    const request = body({
      items: [existing],
      selectedKey: '',
      prompt: '제목 바꿔 줘',
      editMode: 'auto',
      layoutMode: 'desktop',
    });
    const candidates = [{ key: existing.key, title: existing.title, position: 1 }];
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: false,
      editPrompt: '제목 바꿔 줘',
    });
    await expect(service.editorAi(dashboardId, request, actor)).resolves.toEqual({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: candidates,
    });
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'layout',
      saveRequested: true,
      editPrompt: '아래로 한 칸',
    });
    await expect(service.editorAi(dashboardId, request, actor)).resolves.toEqual({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: candidates,
    });
    expect(dashboards.classifyBlockIntent).toHaveBeenCalledTimes(2);
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each(['foreign', 42, {}, ['a'], false])(
    'UC-014 rejects a defined selection without a matching key (%p) before classification',
    async selectedKey => {
      const existing = (await service.editor(dashboardId, actor)).items[0];
      await expect(
        service.editorAi(
          dashboardId,
          body({
            items: [existing],
            selectedKey,
            prompt: '저장해 줘',
            editMode: 'auto',
            layoutMode: 'desktop',
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
      expect(dashboards.preview).not.toHaveBeenCalled();
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('UC-014 checks the owned revision before classifying an explicit save', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    await expect(
      service.editorAi(
        dashboardId,
        body({
          items: [existing],
          prompt: '저장해 줘',
          editMode: 'auto',
          expectedRevision: 'b'.repeat(64),
        }),
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-014 keeps the draft and saves nothing when the save-plan preview fails', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'save',
      saveRequested: true,
      editPrompt: null,
    });
    dashboards.preview.mockRejectedValueOnce(new BadRequestException('미리보기 실패'));
    await expect(
      service.editorAi(
        dashboardId,
        body({ items: [existing], prompt: '저장해 줘', editMode: 'auto', layoutMode: 'desktop' }),
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-014 still needs a selected block for the legacy explicit modes', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    await expect(
      service.editorAi(
        dashboardId,
        body({
          items: [existing],
          prompt: '제목 저장해 줘',
          editMode: 'layout',
          layoutMode: 'desktop',
        }),
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each(['auto', 'content'] as const)(
    'UC-014 blocks the %s response when the request is cancelled during preview',
    async editMode => {
      const existing = (await service.editor(dashboardId, actor)).items[0];
      dashboards.generate.mockResolvedValueOnce({
        status: 'SUCCESS',
        data: { ...analysis, widgets: [{ ...analysis.widgets[0], title: 'AI 제목' }] },
      });
      if (editMode === 'auto')
        dashboards.classifyBlockIntent.mockResolvedValueOnce({
          intent: 'content',
          saveRequested: true,
          editPrompt: '제목 변경',
        });
      const abort = new AbortController();
      dashboards.preview.mockImplementationOnce(async () => {
        abort.abort();
        return { data: { widgets: [{ rows: [] }] } };
      });
      await expect(
        service.editorAi(
          dashboardId,
          body({
            items: [existing],
            selectedKey: existing.key,
            prompt: '제목 변경하고 저장해 줘',
            editMode,
            layoutMode: 'desktop',
          }),
          actor,
          abort.signal,
        ),
      ).rejects.toThrow('LLM_REQUEST_ABORTED');
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('UC-014 keeps explicit content mode preview-only even when the question mentions a save', async () => {
    const existing = (await service.editor(dashboardId, actor)).items[0];
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { ...analysis, widgets: [{ ...analysis.widgets[0], title: 'AI 제목' }] },
    });
    const result = await service.editorAi(
      dashboardId,
      body({ items: [existing], selectedKey: existing.key, prompt: '제목 바꾸고 저장해 줘' }),
      actor,
    );
    expect(result.editMode).toBe('content');
    expect(result.saveRequested).toBe(false);
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '제목 바꾸고 저장해 줘' }),
      actor,
      undefined,
    );
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 resolves a numbered target from the question and returns it as targetKey', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    expect(items.map(entry => entry.key)).toEqual(['block-1', 'block-2', 'block-3']);
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: true,
      editPrompt: '소수 자릿수를 1자리로 바꿔 줘',
    });
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        widgets: [
          analysis.widgets[0],
          { ...analysis.widgets[1], title: 'AI 비용' },
          analysis.widgets[2],
        ],
      },
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: items[0].key,
        prompt: '2번 차트의 소수 자릿수를 1자리로 바꾸고 저장해 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWidget: 1,
        prompt: '소수 자릿수를 1자리로 바꿔 줘',
        databaseId: 1,
      }),
      actor,
      undefined,
    );
    expect(result.targetKey).toBe('block-2');
    expect(result.item).toMatchObject({ key: 'block-2', kind: 'draft', title: 'AI 비용' });
    expect(result.editMode).toBe('content');
    expect(result.saveRequested).toBe(true);
    expect(dashboards.preview).toHaveBeenCalledTimes(1);
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 clarifies with the current blocks for an unknown number and writes nothing', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: true,
      editPrompt: '소수 자릿수를 1자리로 바꿔 줘',
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: items[0].key,
        prompt: '9번 차트의 소수 자릿수를 1자리로 바꾸고 저장해 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(result).toEqual({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: blockCandidates,
    });
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 confirms a recomputed candidate before the layout provider call', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'layout',
      saveRequested: false,
      editPrompt: '오른쪽 한 칸',
    });
    dashboards.proposeBlockLayout.mockResolvedValueOnce({ x: 1, y: 9, w: 6, h: 3 });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: '',
        targetChoiceKey: 'block-2',
        prompt: '선택한 차트를 오른쪽으로 한 칸 옮겨 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(dashboards.proposeBlockLayout).toHaveBeenCalledWith(
      expect.objectContaining({ selectedKey: 'block-2', prompt: '오른쪽 한 칸', mode: 'desktop' }),
      undefined,
    );
    expect(result.targetKey).toBe('block-2');
    expect(result.item).toMatchObject({
      key: 'block-2',
      layouts: { desktop: { x: 1, y: 9, w: 6, h: 3 } },
    });
    expect(result.editMode).toBe('layout');
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 keeps clarifying when a confirmation is outside the recomputed candidates', async () => {
    threeBlocks();
    analysis.widgets[1] = { ...analysis.widgets[1], title: '월별 매출' };
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: false,
      editPrompt: '소수 자릿수를 바꿔 줘',
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: items[2].key,
        targetChoiceKey: 'block-3',
        prompt: '월별 매출 차트의 소수 자릿수를 1자리로 바꿔 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(result).toEqual({
      editMode: 'clarify',
      saveRequested: false,
      targetCandidates: [
        { key: 'block-1', title: '월별 매출', position: 1 },
        { key: 'block-2', title: '월별 매출', position: 2 },
      ],
    });
    expect(dashboards.generate).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-015 never lets the confirmation override a unique explicit target', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce({
      intent: 'content',
      saveRequested: false,
      editPrompt: '소수 자릿수를 바꿔 줘',
    });
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { ...analysis, widgets: analysis.widgets.map(widget => ({ ...widget })) },
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: 'block-1',
        targetChoiceKey: 'block-3',
        prompt: '2번 차트의 소수 자릿수를 1자리로 바꿔 줘',
        editMode: 'auto',
        layoutMode: 'desktop',
      }),
      actor,
    );
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({ selectedWidget: 1 }),
      actor,
      undefined,
    );
    expect(result.targetKey).toBe('block-2');
    expect(result.item).toMatchObject({ key: 'block-2', kind: 'draft' });
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each(['foreign', 42, {}, ['block-1'], false])(
    'UC-015 rejects an invalid confirmation key (%p) before classification',
    async targetChoiceKey => {
      threeBlocks();
      const items = (await service.editor(dashboardId, actor)).items;
      await expect(
        service.editorAi(
          dashboardId,
          body({
            items,
            targetChoiceKey,
            prompt: '제목을 바꿔 줘',
            editMode: 'auto',
            layoutMode: 'desktop',
          }),
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
      expect(dashboards.generate).not.toHaveBeenCalled();
      expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
      expect(dashboards.preview).not.toHaveBeenCalled();
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('UC-015 keeps the legacy explicit selection when a confirmation key is present', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: { ...analysis, widgets: analysis.widgets.map(widget => ({ ...widget })) },
    });
    const result = await service.editorAi(
      dashboardId,
      body({
        items,
        selectedKey: items[0].key,
        targetChoiceKey: items[1].key,
        prompt: '제목을 바꿔 줘',
      }),
      actor,
    );
    expect(dashboards.classifyBlockIntent).not.toHaveBeenCalled();
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({ selectedWidget: 0 }),
      actor,
      undefined,
    );
    expect(result.targetKey).toBe('block-1');
    expect(result.item).toMatchObject({ key: 'block-1' });
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  const batchActions = (overrides: any[] = []) =>
    overrides.length
      ? overrides
      : [
          {
            editMode: 'content',
            targetPrompt: '2번 차트',
            editPrompt: '소수 자릿수를 1자리로 바꿔 줘',
          },
          { editMode: 'layout', targetPrompt: '3번 차트', editPrompt: '아래로 한 칸 옮겨 줘' },
        ];
  const batchPlan = (actions: any[] = batchActions(), saveRequested = false) => ({
    intent: 'batch' as const,
    saveRequested,
    actions,
  });
  const batchBody = (items: any[], overrides = {}) =>
    body({
      items,
      selectedKey: '',
      prompt: '2번 차트의 소수 자릿수를 1자리로 바꾸고 3번 차트를 아래로 한 칸 옮겨 줘',
      editMode: 'auto',
      layoutMode: 'desktop',
      ...overrides,
    });
  const failed = async (run: Promise<unknown>) => {
    try {
      await run;
    } catch (error) {
      return error as BadRequestException;
    }
    throw new Error('expected the call to reject');
  };

  it('UC-016 stages two block changes, previews the whole draft once and never writes', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce(batchPlan(batchActions(), true));
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        widgets: [
          analysis.widgets[0],
          { ...analysis.widgets[1], title: 'AI 비용' },
          analysis.widgets[2],
        ],
      },
    });
    dashboards.proposeBlockLayout.mockResolvedValueOnce({ x: 0, y: 6, w: 6, h: 3 });
    const result = await service.editorAi(dashboardId, batchBody(items), actor);
    expect(result.editMode).toBe('batch');
    expect(result.saveRequested).toBe(true);
    expect(result).not.toHaveProperty('item');
    expect(result.changes.map((change: any) => [change.targetKey, change.editMode])).toEqual([
      ['block-2', 'content'],
      ['block-3', 'layout'],
    ]);
    expect(result.changes[0].item).toMatchObject({
      key: 'block-2',
      kind: 'draft',
      title: '월별 비용',
    });
    expect(result.changes[1].item).toMatchObject({
      key: 'block-3',
      layouts: { desktop: { x: 0, y: 6, w: 6, h: 3 } },
    });
    expect(dashboards.generate).toHaveBeenCalledWith(
      expect.objectContaining({ selectedWidget: 1, prompt: '소수 자릿수를 1자리로 바꿔 줘' }),
      actor,
      undefined,
    );
    expect(dashboards.proposeBlockLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedKey: 'block-3',
        mode: 'desktop',
        prompt: '아래로 한 칸 옮겨 줘',
      }),
      undefined,
    );
    expect(dashboards.generate).toHaveBeenCalledTimes(1);
    expect(dashboards.preview).toHaveBeenCalledTimes(1);
    expect(result.preview).toMatchObject({ responsiveLayouts: expect.any(Object) });
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-016 allows an explicitly requested title change while preserving the other target', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce(
      batchPlan(
        batchActions([
          {
            editMode: 'content',
            targetPrompt: '2번 차트',
            editPrompt: '제목을 AI 비용으로 바꿔 줘',
          },
          { editMode: 'layout', targetPrompt: '3번 차트', editPrompt: '아래로 한 칸 옮겨 줘' },
        ]),
      ),
    );
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        widgets: analysis.widgets.map((widget, i) =>
          i === 1 ? { ...widget, title: 'AI 비용' } : widget,
        ),
      },
    });
    dashboards.proposeBlockLayout.mockResolvedValueOnce({ x: 0, y: 6, w: 6, h: 3 });
    const result = await service.editorAi(dashboardId, batchBody(items), actor);
    expect(result.changes[0].item.title).toBe('AI 비용');
    expect(result.changes[0].item.definition.title).toBe('AI 비용');
    expect(result.changes[1].item.title).toBe(items[2].title);
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an unknown block number',
      '2번 차트의 소수 자릿수를 바꾸고 9번 차트를 아래로 한 칸 옮겨 줘',
      batchActions([
        { editMode: 'content', targetPrompt: '2번 차트', editPrompt: '소수 자릿수를 바꿔 줘' },
        { editMode: 'layout', targetPrompt: '9번 차트', editPrompt: '아래로 한 칸 옮겨 줘' },
      ]),
      'target',
      undefined,
    ],
    [
      'a reference the question never contains',
      '2번 차트의 소수 자릿수를 바꾸고 3번 차트를 아래로 한 칸 옮겨 줘',
      batchActions([
        { editMode: 'content', targetPrompt: '2번 차트', editPrompt: '소수 자릿수를 바꿔 줘' },
        { editMode: 'layout', targetPrompt: '7번 차트', editPrompt: '아래로 한 칸 옮겨 줘' },
      ]),
      'target',
      undefined,
    ],
    [
      'the same block twice',
      '2번 차트의 소수 자릿수를 바꾸고 2번 차트를 아래로 한 칸 옮겨 줘',
      batchActions([
        { editMode: 'content', targetPrompt: '2번 차트', editPrompt: '소수 자릿수를 바꿔 줘' },
        { editMode: 'layout', targetPrompt: '2번 차트', editPrompt: '아래로 한 칸 옮겨 줘' },
      ]),
      'target',
      2,
    ],
  ])(
    'UC-016 rejects %s before any provider call',
    async (_name, prompt, actions, stage, position) => {
      threeBlocks();
      const items = (await service.editor(dashboardId, actor)).items;
      dashboards.classifyBlockIntent.mockResolvedValueOnce(batchPlan(actions));
      const error = await failed(
        service.editorAi(dashboardId, batchBody(items, { prompt }), actor),
      );
      expect(error.getResponse()).toMatchObject({
        batchFailure: { stage, ...(position === undefined ? {} : { position }) },
      });
      expect(dashboards.generate).not.toHaveBeenCalled();
      expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
      expect(dashboards.preview).not.toHaveBeenCalled();
      expect(dashboards.save).not.toHaveBeenCalled();
    },
  );

  it('UC-016 keeps the target title unless that action asks for a title change', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce(
      batchPlan(
        batchActions([
          {
            editMode: 'content',
            targetPrompt: '2번 차트',
            editPrompt: '소수 자릿수를 3자리로 바꿔 줘',
          },
          {
            editMode: 'content',
            targetPrompt: '3번 차트',
            editPrompt: '제목을 요청 건수로 바꿔 줘',
          },
        ]),
      ),
    );
    dashboards.generate
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        data: {
          ...analysis,
          widgets: [
            analysis.widgets[0],
            { ...analysis.widgets[1], title: '전체 요청 수', decimalPlaces: 3 },
            analysis.widgets[2],
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        data: {
          ...analysis,
          widgets: [
            analysis.widgets[0],
            analysis.widgets[1],
            { ...analysis.widgets[2], title: '요청 건수' },
          ],
        },
      });
    const result = await service.editorAi(dashboardId, batchBody(items), actor);
    expect(result.changes.map((change: any) => change.targetKey)).toEqual(['block-2', 'block-3']);
    expect(result.changes[0].item).toMatchObject({
      key: 'block-2',
      title: '월별 비용',
      decimalPlaces: 3,
    });
    expect(result.changes[0].item.definition.title).toBe('월별 비용');
    expect(JSON.stringify(result.changes[0].item)).not.toContain('전체 요청 수');
    expect(result.changes[1].item).toMatchObject({ key: 'block-3', title: '요청 건수' });
    expect(dashboards.preview).toHaveBeenCalledTimes(1);
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-016 discards the first staged change when the second change fails', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce(batchPlan());
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        widgets: [
          analysis.widgets[0],
          { ...analysis.widgets[1], title: 'AI 비용' },
          analysis.widgets[2],
        ],
      },
    });
    dashboards.proposeBlockLayout.mockRejectedValueOnce(
      new BadRequestException('배치 변경을 해석하지 못했습니다.'),
    );
    const error = await failed(service.editorAi(dashboardId, batchBody(items), actor));
    expect(error.getResponse()).toMatchObject({
      batchFailure: { stage: 'change', position: 3 },
      message: expect.stringContaining('변경을 적용하지 못했습니다'),
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('배치 변경을 해석하지 못했습니다');
    expect(dashboards.generate).toHaveBeenCalledTimes(1);
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-016 reports a whole-preview failure as the sanitized preview stage', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.classifyBlockIntent.mockResolvedValueOnce(
      batchPlan(
        batchActions([
          { editMode: 'content', targetPrompt: '2번 차트', editPrompt: '제목을 매출로 바꿔 줘' },
          { editMode: 'content', targetPrompt: '3번 차트', editPrompt: '제목을 비용으로 바꿔 줘' },
        ]),
      ),
    );
    dashboards.generate
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        data: {
          ...analysis,
          widgets: [
            analysis.widgets[0],
            { ...analysis.widgets[1], title: 'AI 비용' },
            analysis.widgets[2],
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        data: {
          ...analysis,
          widgets: [
            analysis.widgets[0],
            analysis.widgets[1],
            { ...analysis.widgets[2], title: 'AI 건수' },
          ],
        },
      });
    dashboards.preview.mockRejectedValueOnce(new Error('duckdb failure: SELECT * FROM source'));
    const error = await failed(service.editorAi(dashboardId, batchBody(items), actor));
    expect(error.getResponse()).toMatchObject({
      batchFailure: { stage: 'preview' },
      message: expect.stringContaining('전체 미리보기에 실패했습니다'),
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('duckdb');
    expect(error.getResponse()).not.toMatchObject({
      batchFailure: { position: expect.anything() },
    });
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-016 propagates a revision conflict raised by the staged compile', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    dashboards.analysis
      .mockResolvedValueOnce({ data: analysis })
      .mockResolvedValueOnce({ data: { ...analysis, revision: 'c'.repeat(64) } });
    dashboards.classifyBlockIntent.mockResolvedValueOnce(batchPlan());
    dashboards.generate.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: {
        ...analysis,
        widgets: [
          analysis.widgets[0],
          { ...analysis.widgets[1], title: 'AI 비용' },
          analysis.widgets[2],
        ],
      },
    });
    await expect(service.editorAi(dashboardId, batchBody(items), actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });

  it('UC-016 stops without a batch failure when the request is cancelled during a change', async () => {
    threeBlocks();
    const items = (await service.editor(dashboardId, actor)).items;
    const abort = new AbortController();
    dashboards.classifyBlockIntent.mockResolvedValueOnce(batchPlan());
    dashboards.generate.mockImplementationOnce(async () => {
      abort.abort();
      return {
        status: 'SUCCESS',
        data: {
          ...analysis,
          widgets: [
            analysis.widgets[0],
            { ...analysis.widgets[1], title: 'AI 비용' },
            analysis.widgets[2],
          ],
        },
      };
    });
    await expect(
      service.editorAi(dashboardId, batchBody(items), actor, abort.signal),
    ).rejects.toThrow('LLM_REQUEST_ABORTED');
    expect(dashboards.proposeBlockLayout).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
    expect(dashboards.save).not.toHaveBeenCalled();
  });
});
