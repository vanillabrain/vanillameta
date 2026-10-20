import {
  declaredReuseCurrency,
  prepareStructuredReuse,
  persistStructuredReuse,
} from './structured-reuse';
import { canonicalMetricSql } from '../dashboard-studio/studio-remix-template';
import { pinMetricFormula } from './metric-formula';
import { Metric } from '../metric/entities/metric.entity';
const profile = {
  sourceId: 1,
  columns: [
    { name: 'revenue', numeric: true },
    { name: 'cost', numeric: true },
    { name: 'company', numeric: false },
  ],
};
const target = {
  sourceId: 2,
  columns: [
    { name: 'sales_amount', numeric: true },
    { name: 'expense_amount', numeric: true },
    { name: 'customer', numeric: false },
  ],
};
const leaf = (column: string) => ({
  schemaVersion: 1,
  definitionVersion: 3,
  sourceId: 1,
  tableName: 'uploaded_data',
  label: column,
  unit: 'USD',
  decimalPlaces: 2,
  numberNotation: 'plain',
  aggregation: 'SUM',
  column,
});
const formula = () => ({
  ...leaf('*'),
  aggregation: 'FORMULA',
  unit: '%',
  formula: pinMetricFormula(
    {
      op: 'ratio',
      left: { metricId: 11, definitionVersion: 3 },
      right: { metricId: 10, definitionVersion: 3 },
      scale: 100,
    },
    [
      { id: 10, definitionVersion: 3, definition: leaf('revenue') },
      { id: 11, definitionVersion: 3, definition: leaf('cost') },
    ],
    profile,
  ),
});
function prepare() {
  const d = formula();
  const widgets = [
    {
      blockId: 'a',
      type: 'BOARD_NUMERIC',
      sql: canonicalMetricSql(d, 'BOARD_NUMERIC', undefined, profile),
    },
  ];
  const original = { databaseId: 1, widgets };
  const snapshot = {
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    sourceId: 1,
    items: [{ sourceId: 1, metricId: 12, definitionVersion: 3, definition: d }],
  };
  const remapped = {
    widgets: [
      {
        ...widgets[0],
        sql: widgets[0].sql
          .replace(/"cost"/g, '"expense_amount"')
          .replace(/"revenue"/g, '"sales_amount"'),
      },
    ],
  };
  return { original, snapshot, remapped };
}
it('remaps frozen FORMULA leaves and persists clone-local IDs without retaining original references', async () => {
  const x = prepare(),
    before = JSON.stringify(x);
  const plan = prepareStructuredReuse(
    x.snapshot,
    x.original,
    x.original,
    x.remapped,
    profile,
    target,
    { revenue: 'sales_amount', cost: 'expense_amount' },
  );
  expect(plan.nodes).toHaveLength(3);
  expect(plan.nodes.map(n => n.definition.sourceId)).toEqual([2, 2, 2]);
  let id = 100;
  const rows: any[] = [];
  const manager = {
    save: async (entity, row) => {
      expect(entity).toBe(Metric);
      rows.push(row);
      return { ...row, id: ++id };
    },
  };
  const snapshot = await persistStructuredReuse(plan, 2, 'new-version', manager as any);
  expect(rows).toHaveLength(3);
  const copied = snapshot.items[0].definition;
  expect(copied.formula.operands.map(o => o.id)).toEqual([101, 102]);
  expect(copied.formula.expression).toEqual({
    op: 'ratio',
    left: { metricId: 102, definitionVersion: 1 },
    right: { metricId: 101, definitionVersion: 1 },
    scale: 100,
  });
  expect(copied.formula.operands.map(o => o.definition.column)).toEqual([
    'sales_amount',
    'expense_amount',
  ]);
  expect(snapshot.items[0].metricId).toBe(103);
  expect(JSON.stringify(x)).toBe(before);
});
it('refuses a linked widget whose SQL no longer proves the frozen metric, before writes', () => {
  const x = prepare();
  x.original.widgets[0].sql = 'SELECT SUM(revenue) AS value FROM source';
  expect(() =>
    prepareStructuredReuse(x.snapshot, x.original, x.original, x.remapped, profile, target, {
      revenue: 'sales_amount',
      cost: 'expense_amount',
    }),
  ).toThrow('지표 연결');
});

it('retains declared monetary units on an ordinary user upload across future copies', () => {
  const x = prepare();
  expect(declaredReuseCurrency(x.snapshot, x.original)).toBe('USD');
  const plan = prepareStructuredReuse(
    x.snapshot,
    x.original,
    x.original,
    x.remapped,
    profile,
    target,
    { revenue: 'sales_amount', cost: 'expense_amount' },
  );
  const next = {
    schemaVersion: 2,
    kind: 'structured-bi-dashboard',
    sourceId: 2,
    items: plan.items.map(i => ({
      sourceId: 2,
      definition: plan.nodes.find(n => n.id === i.nodeId).definition,
    })),
  };
  expect(declaredReuseCurrency(next, { databaseId: 2 })).toBe('USD');
});
it('keeps positional unlinked slots and scope-only snapshots without inventing metrics', async () => {
  const x = prepare();
  const original = {
    ...x.original,
    widgets: [...x.original.widgets, { ...x.original.widgets[0], blockId: 'b' }],
  };
  const snapshot = { ...x.snapshot, items: [...x.snapshot.items, {}] };
  const remapped = { widgets: [...x.remapped.widgets, x.remapped.widgets[0]] };
  const plan = prepareStructuredReuse(snapshot, original, original, remapped, profile, target, {
    revenue: 'sales_amount',
    cost: 'expense_amount',
  });
  expect(plan.items).toHaveLength(2);
  expect(plan.items[1]).toEqual({});
  const empty = prepareStructuredReuse(
    { ...snapshot, items: [{}, {}] },
    original,
    original,
    remapped,
    profile,
    target,
    {},
  );
  expect(empty.nodes).toEqual([]);
  expect(
    (
      await persistStructuredReuse(empty, 2, 'v', {
        save: () => {
          throw new Error('no writes');
        },
      } as any)
    ).items,
  ).toEqual([{}, {}]);
  expect(() =>
    prepareStructuredReuse(
      { ...snapshot, items: [snapshot.items[0], { metricId: 99 }] },
      original,
      original,
      remapped,
      profile,
      target,
      { revenue: 'sales_amount', cost: 'expense_amount' },
    ),
  ).toThrow('지표 연결');
});

it.each(['source', 'schema'] as const)(
  'refuses an indicated canonical %s envelope mismatch instead of discarding links and units',
  kind => {
    const x = prepare();
    if (kind === 'source') x.snapshot.sourceId = 99;
    else x.snapshot.schemaVersion = 99;
    expect(() => declaredReuseCurrency(x.snapshot, x.original)).toThrow('지표 연결');
    expect(() =>
      prepareStructuredReuse(x.snapshot, x.original, x.original, x.remapped, profile, target, {
        revenue: 'sales_amount',
        cost: 'expense_amount',
      }),
    ).toThrow('지표 연결');
  },
);
