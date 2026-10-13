jest.mock('./ai.service', () => ({ AiService: class {} }));
import { AiDashboardService } from './ai-dashboard.service';
import { AiController } from './ai.controller';
import { validateDraft, widgetOptions } from './dashboard-draft';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Component } from '../component/entities/component.entity';

const draft = () => ({
  databaseId: 1,
  title: 'Revenue',
  explanation: '',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
    },
    {
      title: 'Devices',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT device, sum(amount) AS value FROM source GROUP BY device LIMIT 1000',
      valueField: 'value',
      categoryField: 'device',
    },
  ],
});
const request = () => ({ dashboardId: 3, currentDraft: draft(), prompt: 'Explain revenue' });

describe('dashboard assistant', () => {
  let service: AiDashboardService;
  let ai: any;
  let connection: any;
  let manager: any;
  const provider = process.env.AI_PROVIDER;
  const model = process.env.AI_MODEL;
  beforeEach(() => {
    process.env.AI_PROVIDER = 'codex';
    ai = {
      callLlm: jest.fn().mockResolvedValue('Revenue is 30'),
      getSchemaContext: jest
        .fn()
        .mockResolvedValue({ schemaText: 'amount BIGINT, device VARCHAR' }),
    };
    manager = {
      findOne: jest.fn(async entity =>
        entity === UserMapping
          ? { id: 1 }
          : { id: 3, delYn: 'N', analysisDefinition: JSON.stringify(draft()) },
      ),
      save: jest.fn(),
      transaction: jest.fn(),
    };
    connection = {
      withDuckDBSnapshot: jest.fn((_id, callback) => callback()),
      duckDBVersion: jest.fn().mockResolvedValue('file-v1'),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn(async (_id, sql) => {
        if (sql.startsWith('DESCRIBE'))
          return {
            datas: [
              { column_name: 'amount', column_type: 'BIGINT' },
              { column_name: 'device', column_type: 'VARCHAR' },
              { column_name: 'event_time', column_type: 'TIMESTAMP' },
            ],
          };
        if (sql.startsWith('SELECT DISTINCT')) return { datas: [{ value: 'phone' }] };
        if (sql.startsWith('SELECT CAST'))
          return { datas: [{ min: '2026-01-01', max: '2026-01-03' }] };
        if (sql.includes('strftime('))
          return { datas: [{ __trend_time: '2026-01-01', __trend_value: 30 }] };
        return {
          fields: [
            { columnName: 'value', columnType: 'number' },
            { columnName: 'device', columnType: 'string' },
          ],
          datas: sql.includes('GROUP BY device')
            ? [{ device: 'phone', value: 30 }]
            : [{ value: 30 }],
        };
      }),
    };
    service = new AiDashboardService(ai, connection, { manager } as any);
  });
  afterAll(() => {
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
    if (model === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = model;
  });
  it('rejects assistant and revision requests for a different dashboard source before reading it', async () => {
    const other = { ...draft(), databaseId: 99 };
    await expect(service.assistant({ ...request(), currentDraft: other }, 1)).rejects.toThrow(
      'dashboard source mismatch',
    );
    await expect(
      service.generate({ ...request(), databaseId: 99, currentDraft: other }, 1),
    ).rejects.toThrow('dashboard source mismatch');
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('provides exact integer sums and differences without rounding unsafe integer strings', async () => {
    const definition = draft();
    jest.spyOn(service, 'preview').mockResolvedValue({
      data: {
        widgets: [
          { ...definition.widgets[0], datas: [{ value: '9007199254740995' }] },
          { ...definition.widgets[1], datas: [{ value: '9007199254740993' }, { value: 2 }] },
        ],
      },
    } as any);
    const result: any = await service.assistant(request(), 7);
    expect(result.data.context.arithmetic[0].includedRowsTotal).toBe('9007199254740995');
    expect(result.data.context.arithmetic[0].comparisons[0].difference).toBe('0');
    const evidence = JSON.parse(ai.callLlm.mock.calls[0][1]);
    expect(evidence.context.arithmetic[0].includedRowsTotal).toBe('9007199254740995');
  });
  it('does not compare a weighted ratio with its denominator or invent decimal/null totals', async () => {
    const definition = draft();
    jest.spyOn(service, 'preview').mockResolvedValue({
      data: {
        widgets: [
          {
            ...definition.widgets[0],
            sql: 'SELECT sum(other) / sum(amount) AS value FROM source',
            datas: [{ value: 30 }],
          },
          { ...definition.widgets[1], datas: [{ value: 30 }] },
        ],
      },
    } as any);
    expect(
      ((await service.assistant(request(), 7)) as any).data.context.arithmetic[0].comparisons,
    ).toEqual([]);
    jest.spyOn(service, 'preview').mockResolvedValue({
      data: {
        widgets: [{ ...definition.widgets[1], datas: [{ value: null }, { value: 1.25 }] }],
      },
    } as any);
    expect(
      ((await service.assistant(request(), 7)) as any).data.context.arithmetic[0].includedRowsTotal,
    ).toBeNull();
  });
  it('routes authenticated user IDs to assistant', () => {
    const handler = jest
      .spyOn(service, 'assistant')
      .mockResolvedValue({ status: 'SUCCESS' } as any);
    const controller = new AiController(ai, service);
    const body = request();
    controller.dashboardAssistant(body, { user: { accessKeyData: { id: 7 } } });
    expect(handler).toHaveBeenCalledWith(body, 7);
    expect(Reflect.getMetadata('path', controller.dashboardAssistant)).toBe('dashboard-assistant');
  });
  it('requires ownership before validation, source reads or model calls', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.assistant({ dashboardId: 3 }, 99)).rejects.toThrow('owner');
    expect(connection.isDuckDB).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
    await expect(service.assistant({ ...request(), dashboardId: undefined }, 7)).rejects.toThrow(
      'invalid id',
    );
  });
  it.each([
    { prompt: '' },
    { prompt: 'x'.repeat(2001) },
    { history: Array(11).fill({ role: 'user', text: 'x' }) },
    { history: [{ role: 'system', text: 'x' }] },
    { history: [{ role: 'assistant', text: 'x'.repeat(2001) }] },
    { history: [{ role: 'user', text: '' }] },
    { history: {} },
    { selectedWidget: -1 },
    { selectedWidget: 2 },
    { selectedWidget: 0.5 },
    { currentDraft: {} },
  ])('rejects invalid bounded input %#', async override => {
    await expect(service.assistant({ ...request(), ...override }, 7)).rejects.toThrow();
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(connection.queryDuckDB).not.toHaveBeenCalled();
  });
  it.each([
    { filters: [{ column: 'unknown', value: 'phone' }] },
    { filters: Array(6).fill({ column: 'device', value: 'phone' }) },
    { dateRange: { column: 'event_time', start: '2026-02-30', end: '2026-03-01' } },
  ])('rejects invalid filter/date scope %# before LLM', async override => {
    await expect(service.assistant({ ...request(), ...override }, 7)).rejects.toThrow();
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('uses exact server values, bound filters, dates and trend queries without writes', async () => {
    const filters = [{ column: 'device', values: ['phone'] }];
    const dateRange = { column: 'event_time', start: '2026-01-01', end: '2026-01-03' };
    const result = await service.assistant(
      {
        ...request(),
        filters,
        dateRange,
        selectedWidget: 0,
        history: [{ role: 'user', text: 'previous' }],
        widgets: [{ datas: [{ value: 999999 }] }],
      },
      7,
    );
    if (!('data' in result)) throw new Error('missing data');
    expect(result.data.ai).toEqual({ provider: 'codex', requestedModel: 'gpt-6-luna' });
    expect(result.data.context).toMatchObject({ filters, dateRange, selectedWidget: 0 });
    expect(result.data.context.widgets[0].datas).toEqual([{ value: 30 }]);
    expect(result.data.context.queries[0].bindings).toEqual([
      'phone',
      '2026-01-01T00:00:00Z',
      '2026-01-04T00:00:00Z',
    ]);
    expect(result.data.context.queries.some(q => q.kind === 'trend')).toBe(true);
    const evidence = JSON.parse(ai.callLlm.mock.calls[0][1]);
    expect(evidence.context.widgets[1].datas).toEqual([{ device: 'phone', value: 30 }]);
    expect(evidence.history).toEqual([{ role: 'user', text: 'previous' }]);
    expect(evidence.context.widgets[1].coverage.queryLimit).toBe('LIMIT 1000');
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });
  it('bounds rows/points/labels and discloses missing data without scaling KPI values', async () => {
    const preview = jest.spyOn(service, 'preview').mockResolvedValue({
      status: 'SUCCESS',
      data: {
        widgets: [
          {
            ...draft().widgets[0],
            datas: [{ value: 123456789.012345 }],
            trend: {
              column: 'event_time',
              grain: 'day',
              points: Array(200).fill({ time: '2026-01-01', value: null }),
            },
          },
          {
            ...draft().widgets[1],
            datas: Array(150).fill({ device: 'x'.repeat(600), value: null }),
            trendUnavailable: 'No temporal column',
          },
        ],
        queries: [],
      },
    } as any);
    const result: any = await service.assistant(request(), 7);
    if (!('data' in result)) throw new Error('missing data');
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ includeTrends: true }), 7);
    expect(result.data.context.widgets[0].datas[0].value).toBe(123456789.012345);
    expect(result.data.context.widgets[0].coverage).toMatchObject({
      trendTruncated: true,
      missingTrendValues: true,
    });
    expect(result.data.context.widgets[1].coverage).toMatchObject({
      rowsTruncated: true,
      labelsTruncated: true,
      missingData: true,
    });
    expect(result.data.context.widgets[1].datas).toHaveLength(100);
    expect(result.data.context.widgets[1].datas[0].device).toContain('[truncated]');
  });
  it('uses actual environment provider metadata', async () => {
    process.env.AI_PROVIDER = 'api';
    process.env.AI_MODEL = 'configured-model';
    const result: any = await service.assistant(request(), 7);
    expect('data' in result && result.data.ai).toEqual({
      provider: 'api',
      requestedModel: 'configured-model',
    });
  });
  it.each(['AI_NOT_CONFIGURED', 'MODEL_UNSUPPORTED'])(
    'reports %s without fallback',
    async error => {
      ai.callLlm.mockRejectedValue(new Error(error));
      expect((await service.assistant(request(), 7)).status).toBe('ERROR');
      expect(ai.callLlm).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects empty LLM responses', async () => {
    ai.callLlm.mockResolvedValue(' ');
    expect((await service.assistant(request(), 7)).status).toBe('ERROR');
  });
  it('does not invoke LLM when preview fails', async () => {
    connection.queryDuckDB.mockRejectedValue(new Error('query failed'));
    await expect(service.assistant(request(), 7)).rejects.toThrow('query failed');
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('extends generate with server context, bounded history and formatting guidance', async () => {
    ai.callLlm.mockResolvedValue(JSON.stringify(draft()));
    await service.generate(
      {
        ...request(),
        databaseId: 1,
        selectedWidget: 0,
        filters: [{ column: 'device', value: 'phone' }],
        history: [{ role: 'assistant', text: 'previous answer' }],
      },
      7,
    );
    expect(ai.callLlm.mock.calls[0][1]).toContain('Server preview context:');
    expect(ai.callLlm.mock.calls[0][1]).toContain('previous answer');
    expect(ai.callLlm.mock.calls[0][0]).toContain('never divide/multiply or round SQL');
    await expect(
      service.generate(
        { databaseId: 1, prompt: 'x', history: Array(11).fill({ role: 'user', text: 'x' }) },
        7,
      ),
    ).rejects.toThrow('history');
  });
});

describe('numberNotation persistence', () => {
  it.each(['full', 'compact'])(
    'preserves %s in definitions and numeric/chart options',
    numberNotation => {
      const input = draft();
      input.widgets.forEach(w => Object.assign(w, { numberNotation }));
      const validated = validateDraft(input);
      expect(validated.widgets[0].numberNotation).toBe(numberNotation);
      expect(widgetOptions(validated.widgets[0]).content.numberNotation).toBe(numberNotation);
      expect(widgetOptions(validated.widgets[1])).toMatchObject({ numberNotation });
      expect(validateDraft(JSON.parse(JSON.stringify(validated)))).toEqual(validated);
    },
  );
  it('rejects unsupported notation', () => {
    const input = draft();
    Object.assign(input.widgets[0], { numberNotation: 'scientific' });
    expect(() => validateDraft(input)).toThrow('numberNotation');
  });
  it.each(['BOARD_NUMERIC', 'CHART_COLUMN'])('recovers legacy %s options', async type => {
    const definition = {
      ...draft().widgets[type === 'BOARD_NUMERIC' ? 0 : 1],
      numberNotation: 'compact' as const,
    };
    const manager = {
      find: jest.fn().mockResolvedValue([{ widgetId: 5 }]),
      findOne: jest.fn(async entity => {
        if (entity === UserMapping) return { id: 1 };
        if (entity === Dashboard) return { id: 3, title: 'Recovered', delYn: 'N' };
        if (entity === Widget)
          return {
            title: definition.title,
            datasetType: 'DATASET',
            datasetId: 2,
            componentId: 4,
            option: JSON.stringify(widgetOptions(definition)),
          };
        if (entity === Dataset)
          return { databaseId: 1, query: definition.sql.replace('source', 'uploaded_data') };
        if (entity === Component) return { type };
      }),
    };
    const service = new AiDashboardService({} as any, {} as any, { manager } as any);
    jest
      .spyOn(service, 'preview')
      .mockImplementation(
        async body => ({ status: 'SUCCESS', data: { draft: validateDraft(body.draft) } } as any),
      );
    expect((await service.analysis(3, 7)).data.widgets[0].numberNotation).toBe('compact');
  });
});
