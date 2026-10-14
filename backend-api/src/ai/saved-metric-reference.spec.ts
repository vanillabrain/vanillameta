jest.mock('./ai.service', () => ({ AiService: class {} }));
import {
  applyMetricReferences,
  explicitMetricTarget,
  applyCanonicalCalculation,
} from './saved-metric-reference';
import { metricExpression } from '../bi/metric-expression';
import { AiDashboardService } from './ai-dashboard.service';

const draft = (metricId: any = 3, type = 'BOARD_NUMERIC') => ({
  databaseId: 7,
  title: 'Stored requests',
  explanation: '',
  widgets: [
    {
      title: 'Total Requests',
      description: '',
      type,
      sql: 'SELECT AVG(amount) AS value FROM source',
      valueField: 'value',
      metricId,
      ...(type === 'BOARD_NUMERIC' ? {} : { categoryField: 'device' }),
    },
  ],
});
const catalog = [{ id: 3, label: 'Requests', expression: 'SUM("amount")' }];

it('UC-002 BR-002 replaces a wrong AI average with the saved sum, preserving embedded WHERE', () => {
  const input = draft();
  input.widgets[0].sql = 'SELECT AVG(amount) AS value FROM source WHERE amount > 100';
  const output = applyMetricReferences(input, catalog, ['amount', 'device']);
  expect(output.widgets[0].sql).toBe(
    'SELECT SUM("amount") AS value FROM source WHERE amount > 100',
  );
  expect(output.widgets[0]).not.toHaveProperty('metricId');
  expect(input.widgets[0].sql).toContain('AVG');
});
it.each(['CHART_BAR', 'CHART_COLUMN', 'CHART_LINE'])(
  'uses one canonical expression for grouped %s',
  type => {
    expect(
      applyMetricReferences(draft(3, type), catalog, ['amount', 'device']).widgets[0].sql,
    ).toBe('SELECT SUM("amount") AS value FROM source');
  },
);
it.each([4, '3', null, 0, -1])('rejects inaccessible/invalid metric reference %s', id => {
  expect(() => applyMetricReferences(draft(id), catalog, ['amount'])).toThrow(
    'reference unavailable',
  );
});
it('requires a schema category rather than an invented expression alias', () => {
  expect(() => applyMetricReferences(draft(3, 'CHART_LINE'), catalog, ['amount'])).toThrow(
    'source category',
  );
});
it('preserves the legacy SQL generation path without a metric reference', () => {
  const input = draft();
  delete input.widgets[0].metricId;
  expect(applyMetricReferences(input, catalog, ['amount']).widgets[0].sql).toBe(
    input.widgets[0].sql,
  );
});
it('shares the exact ratio/weighted/COUNT_DISTINCT compiler with structured creation', () => {
  const profile = {
    columns: [
      { name: 'amount', numeric: true },
      { name: 'weight', numeric: true },
    ],
  };
  expect(
    metricExpression(
      { aggregation: 'RATIO_SUM', column: 'amount', denominatorColumn: 'weight', scale: 100 },
      profile,
    ),
  ).toBe('SUM(CAST("amount" AS DOUBLE)) / NULLIF(SUM(CAST("weight" AS DOUBLE)), 0) * 100');
  expect(
    metricExpression(
      { aggregation: 'WEIGHTED_AVG', column: 'amount', weightColumn: 'weight' },
      profile,
    ),
  ).toContain('CASE WHEN MIN("weight") < 0 THEN NULL');
  expect(metricExpression({ aggregation: 'COUNT_DISTINCT', column: 'amount' }, profile)).toBe(
    'COUNT(DISTINCT "amount")',
  );
});
const definition = {
  schemaVersion: 1,
  definitionVersion: 1,
  sourceId: 7,
  label: 'Stored Requests',
  aggregation: 'SUM',
  column: 'amount',
};
const schema = [
  { column_name: 'amount', column_type: 'BIGINT' },
  { column_name: 'device', column_type: 'VARCHAR' },
];
function setup(
  ownerId: any = 9,
  rows: any[] = [{ id: 3, definition: JSON.stringify(definition) }],
) {
  const manager = {
    findOne: jest.fn().mockResolvedValue({ id: 7, ownerId }),
    find: jest.fn().mockResolvedValue(rows),
  };
  const ai = {
    getSchemaContext: jest.fn().mockResolvedValue({ schemaText: 'amount BIGINT, device VARCHAR' }),
    callLlm: jest.fn().mockResolvedValue(JSON.stringify(draft())),
  };
  const service = new AiDashboardService(
    ai as any,
    { isDuckDB: async () => true, queryDuckDB: async () => ({ datas: schema }) } as any,
    { manager } as any,
  );
  jest
    .spyOn(service, 'preview')
    .mockImplementation(
      async (body: any) => ({ status: 'SUCCESS', data: { draft: body.draft } } as any),
    );
  return { service, manager, ai };
}
it('UC-002 supplies an authorized bounded catalog and applies its expression before preview', async () => {
  const { service, manager, ai } = setup();
  const result = await service.generate({ databaseId: 7, prompt: '저장 지표로 요청 수' }, 9);
  expect(manager.find).toHaveBeenCalledWith(expect.anything(), {
    where: { databaseId: 7, useYn: 'Y' },
    order: { id: 'ASC' },
    take: 30,
  });
  expect(ai.callLlm.mock.calls[0][1]).toContain('Stored Requests');
  if (!('data' in result)) throw new Error(result.message);
  expect(result.data.widgets[0].sql).toContain('SUM("amount")');
  expect(manager).not.toHaveProperty('save');
});
it.each([null, 8])('does not expose the catalog for foreign/legacy owner %s', async owner => {
  const { service, manager, ai } = setup(owner);
  await expect(service.generate({ databaseId: 7, prompt: 'requests' }, 9)).rejects.toThrow(
    'ownership',
  );
  expect(manager.find).not.toHaveBeenCalled();
  expect(ai.callLlm).not.toHaveBeenCalled();
});
it('excludes malformed, mismatched-version/source and unknown-column definitions', async () => {
  const { service } = setup(9, [
    { id: 1, definition: '{' },
    ...[
      { ...definition, sourceId: 8 },
      { ...definition, schemaVersion: 2 },
      { ...definition, definitionVersion: 0 },
      { ...definition, definitionVersion: -1 },
      { ...definition, definitionVersion: 1.5 },
      { ...definition, column: 'missing' },
    ].map((d, i) => ({ id: i + 2, definition: JSON.stringify(d) })),
  ]);
  expect(await (service as any).savedMetrics(7, 9, schema)).toEqual([]);
});

it('preserves quoted category commas, WHERE literals and ascending order', () => {
  const input = draft(3, 'CHART_BAR');
  input.widgets[0].categoryField = 'device,type';
  input.widgets[0].sql = `SELECT "device,type", AVG(amount) AS value FROM source WHERE "device,type" = 'from,where' GROUP BY "device,type" ORDER BY value ASC LIMIT 10`;
  expect(applyMetricReferences(input, catalog, ['device,type', 'amount']).widgets[0].sql).toBe(
    `SELECT "device,type", SUM("amount") AS value FROM source WHERE "device,type" = 'from,where' GROUP BY "device,type" ORDER BY value ASC LIMIT 10`,
  );
});

it('accepts a canonical quoted request counter rather than falsely rejecting it', async () => {
  const { service, ai } = setup(9, [
    { id: 3, definition: JSON.stringify({ ...definition, column: 'bid_request_cnt' }) },
  ]);
  (service as any).connection.queryDuckDB = async () => ({
    datas: [{ column_name: 'bid_request_cnt', column_type: 'BIGINT' }],
  });
  ai.getSchemaContext.mockResolvedValue({ schemaText: 'bid_request_cnt BIGINT' });
  ai.callLlm.mockResolvedValue(JSON.stringify(draft()));
  const result = await service.generate({ databaseId: 7, prompt: '저장된 요청 수' }, 9);
  if (!('data' in result)) throw new Error(result.message);
  expect(result.data.widgets[0].sql).toContain('SUM("bid_request_cnt")');
  expect(result.data.reusedMetricIds).toEqual([3]);
  expect(ai.callLlm).toHaveBeenCalledTimes(1);
});

it.each([undefined, 99])(
  'explicit selection overrides missing/conflicting AI reference %s without touching other widgets',
  id => {
    const current = draft();
    current.widgets.push({ ...current.widgets[0], title: 'Other' });
    delete current.widgets[0].metricId;
    delete current.widgets[1].metricId;
    const candidate = draft(id);
    const merged = explicitMetricTarget(candidate, current, 0, 3);
    const output = applyMetricReferences(merged, catalog, ['amount']);
    expect(output.widgets[0].sql).toContain('SUM("amount")');
    expect(output.widgets[1]).toEqual(current.widgets[1]);
    expect(output.title).toBe(current.title);
  },
);
it('rejects ambiguous output rather than applying a selected metric to unrelated charts', () => {
  const current = draft();
  expect(() => explicitMetricTarget({ ...draft(), widgets: [] }, current, 0, 3)).toThrow(
    'exactly one',
  );
  const candidate = draft();
  candidate.widgets[0].title = 'Unrelated';
  expect(() => explicitMetricTarget(candidate, current, 0, 3)).toThrow('original title');
  expect(() => explicitMetricTarget(candidate, current, 9, 3)).toThrow('target widget');
});

it.each([99, '3', null])(
  'rejects an explicit unavailable selection %s before calling AI',
  async selectedMetricId => {
    const { service, ai } = setup();
    await expect(
      service.generate(
        {
          databaseId: 7,
          prompt: 'update',
          currentDraft: draft(),
          selectedWidget: 0,
          selectedMetricId,
        },
        9,
      ),
    ).rejects.toThrow('selected metric unavailable');
    expect(ai.callLlm).not.toHaveBeenCalled();
  },
);
it('enforces an explicit selection in generation and reports the correct widget index', async () => {
  const { service, ai } = setup();
  jest.spyOn(service as any, 'previewContext').mockResolvedValue({});
  const current = draft();
  delete current.widgets[0].metricId;
  current.widgets.unshift({ ...current.widgets[0], title: 'Keep this KPI' });
  const candidate = draft();
  delete candidate.widgets[0].metricId;
  ai.callLlm.mockResolvedValue(JSON.stringify(candidate));
  const result = await service.generate(
    {
      databaseId: 7,
      prompt: 'update',
      currentDraft: current,
      selectedWidget: 1,
      selectedMetricId: 3,
    },
    9,
  );
  if (!('data' in result)) throw new Error(result.message);
  expect(result.data.widgets[0]).toEqual(current.widgets[0]);
  expect(result.data.widgets[1].sql).toContain('SUM("amount")');
  expect(result.data.metricReferences).toEqual([
    { widgetIndex: 1, metricId: 3, label: 'Stored Requests' },
  ]);
});

it('UC-003 retains trusted category aliases, filters and sorting while replacing the calculation', () => {
  const current = draft(undefined, 'CHART_BAR');
  current.widgets[0].categoryField = 'dimension';
  current.widgets[0].sql =
    'SELECT device AS dimension, SUM(amount) AS value FROM source WHERE amount > 0 GROUP BY device ORDER BY value DESC LIMIT 10';
  expect(applyCanonicalCalculation(current, 0, 'AVG("amount")').widgets[0].sql).toBe(
    'SELECT device AS dimension, AVG("amount") AS value FROM source WHERE amount > 0 GROUP BY device ORDER BY value DESC LIMIT 10',
  );
});

it('UC-003 reuses an updated AVG requests definition without forcing it back to SUM', async () => {
  const { service, ai } = setup(9, [
    {
      id: 3,
      definition: JSON.stringify({
        ...definition,
        definitionVersion: 2,
        aggregation: 'AVG',
        column: 'bid_request_cnt',
      }),
    },
  ]);
  (service as any).connection.queryDuckDB = async () => ({
    datas: [{ column_name: 'bid_request_cnt', column_type: 'BIGINT' }],
  });
  ai.getSchemaContext.mockResolvedValue({ schemaText: 'bid_request_cnt BIGINT' });
  const result = await service.generate({ databaseId: 7, prompt: '저장 지표로 요청 수 평균' }, 9);
  if (!('data' in result)) throw new Error(result.message);
  expect(result.data.widgets[0].sql).toContain('AVG("bid_request_cnt")');
  expect(ai.callLlm).toHaveBeenCalledTimes(1);
});
