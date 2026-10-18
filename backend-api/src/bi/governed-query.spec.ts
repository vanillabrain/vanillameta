import { DuckDBInstance } from '@duckdb/node-api';
import { GovernedRecipe, governedPlan, validateGovernedRecipe } from './governed-query';
const columns = [
  { name: 'company', type: 'VARCHAR' },
  { name: 'day', type: 'TIMESTAMP', temporal: true },
  { name: 'revenue', type: 'DOUBLE', numeric: true },
  { name: 'cost', type: 'DOUBLE', numeric: true },
];
const metric = {
  schemaVersion: 1,
  sourceId: 1,
  tableName: 'uploaded_data',
  aggregation: 'SUM',
  column: 'revenue',
};
const recipe = (company = 'A'): GovernedRecipe => ({
  sourceId: 1,
  columns: columns.filter(c => ['day', 'revenue'].includes(c.name)),
  mandatory: [{ column: 'company', values: [company] }],
  blocks: [
    {
      id: 'sales',
      title: '매출',
      kind: 'BOARD_NUMERIC',
      metric,
      display: { decimalPlaces: 2, numberNotation: 'full', suffix: ' USD' },
    },
    {
      id: 'trend',
      title: '매출 추세',
      kind: 'CHART_LINE',
      metric,
      dimension: 'day',
      display: { decimalPlaces: 2, numberNotation: 'full', suffix: ' USD' },
    },
  ],
});
it('reuses the structured compiler and applies hidden mandatory rows before every projection/aggregate', async () => {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await connection.run(
      'CREATE TABLE uploaded_data(company VARCHAR, day TIMESTAMP, revenue DOUBLE, cost DOUBLE)',
    );
    await connection.run(
      "INSERT INTO uploaded_data VALUES ('A','2025-01-01',100,91),('A','2025-01-02',150,139),('B','2025-01-01',9000,8765)",
    );
    for (const [tenant, total] of [
      ['A', 250],
      ['B', 9000],
    ] as const) {
      const r = recipe(tenant);
      validateGovernedRecipe(r, columns);
      const query = governedPlan(r, { blockIds: ['sales'] }).queries[0];
      expect((await connection.runAndReadAll(query.sql, query.bindings)).getRowObjectsJS()).toEqual(
        [{ value: total }],
      );
      const rows = governedPlan(r, {}, 'rows').queries[0];
      const data = (await connection.runAndReadAll(rows.sql, rows.bindings)).getRowObjectsJS();
      expect(data).toHaveLength(tenant === 'A' ? 2 : 1);
      expect(data.every(row => !('company' in row) && !('cost' in row))).toBe(true);
      const values = governedPlan(r, { column: 'revenue' }, 'values').queries[0];
      expect(
        (await connection.runAndReadAll(values.sql, values.bindings)).getRowObjectsJS(),
      ).toEqual(tenant === 'A' ? [{ value: 100 }, { value: 150 }] : [{ value: 9000 }]);
    }
    const narrow = governedPlan(recipe(), { filters: [{ column: 'revenue', values: [9000] }] })
      .queries[0];
    expect((await connection.runAndReadAll(narrow.sql, narrow.bindings)).getRowObjectsJS()).toEqual(
      [{ value: null }],
    );
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
});
it.each([
  { blockIds: ['cost'] },
  { sourceId: 9 },
  { company: 'B' },
  { filters: [{ column: 'company', values: ['B'] }] },
  { filters: [{ column: 'cost', values: [91] }] },
  { filters: [{ column: 'revenue', values: ['9000 OR 1=1'] }] },
  { filters: [{ column: 'revenue', values: [100], op: 'OR' }] },
])(
  'rejects forbidden columns/IDs/attributes and injection instead of dropping filters %#',
  input => {
    expect(() => governedPlan(recipe(), input)).toThrow();
  },
);
it('does not expose a forbidden value lookup or detail-column request', () => {
  expect(() => governedPlan(recipe(), { column: 'company' }, 'values')).toThrow();
  expect(() => governedPlan(recipe(), { columns: ['cost'] }, 'rows')).toThrow();
});
it('rejects hidden metric dependencies including a pinned formula leaf', () => {
  const r = recipe();
  r.blocks[0].metric = { ...metric, column: 'cost' };
  expect(() => validateGovernedRecipe(r, columns)).toThrow();
  const noScope = recipe();
  noScope.mandatory = [];
  expect(() => validateGovernedRecipe(noScope, columns)).toThrow();
});
it('keeps malicious-looking labels as bound values and never splices them into SQL', () => {
  const r = recipe("A' OR 1=1 --");
  const plan = governedPlan(r, {});
  expect(plan.queries[0].sql).not.toContain("A' OR");
  expect(plan.queries[0].bindings).toEqual(["A' OR 1=1 --"]);
});
