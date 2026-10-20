import { buildReuseMetricGraph, persistReuseMetricGraph } from './reuse-metric-graph';
import { pinMetricFormula } from './metric-formula';
const originalProfile: any = {
  sourceId: 1,
  columns: [
    { name: 'revenue', numeric: true },
    { name: 'cost', numeric: true },
  ],
};
const targetProfile: any = {
  sourceId: 2,
  columns: [
    { name: 'sales', numeric: true },
    { name: 'expense', numeric: true },
  ],
};
const columnMap = { revenue: 'sales', cost: 'expense' };
const leaf = (column = 'revenue', version = 3) => ({
  schemaVersion: 1,
  definitionVersion: version,
  sourceId: 1,
  tableName: 'uploaded_data',
  label: 'Money',
  unit: 'USD',
  aggregation: 'SUM',
  column,
  decimalPlaces: 2,
  numberNotation: 'plain',
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
      { id: 10, definitionVersion: 3, definition: leaf() },
      { id: 11, definitionVersion: 3, definition: leaf('cost') },
    ],
    originalProfile,
  ),
});
const build = (references: any[]) =>
  buildReuseMetricGraph({ references, originalProfile, targetProfile, columnMap });
describe('canonical candidate reuse metric graph', () => {
  it('shared_formula_leaf_is_persisted_once', async () => {
    const g = build([
      { id: 10, version: 3, definition: leaf() },
      { id: 20, version: 3, definition: formula() },
      { id: 20, version: 3, definition: formula() },
    ]);
    expect(g.nodes).toHaveLength(3);
    expect(g.nodes.map(n => n.key)).toEqual(['candidate:1', 'candidate:2', 'candidate:3']);
    expect(g.nodes[0].definition).toMatchObject({
      sourceId: 2,
      column: 'sales',
      definitionVersion: 1,
    });
    const rows: any[] = [];
    const manager: any = {
      queryRunner: { isTransactionActive: true },
      save: jest.fn(async (_entity, row) => {
        const result = { ...row, id: 100 + rows.length };
        rows.push(result);
        return result;
      }),
    };
    const saved = await persistReuseMetricGraph(g, 2, 'file-v2', manager);
    expect(saved.size).toBe(3);
    expect(manager.save).toHaveBeenCalledTimes(3);
    const f: any = saved.get('candidate:3').definition;
    expect(f.formula.operands.map(o => o.id)).toEqual([100, 101]);
    expect(JSON.stringify(f.formula.expression)).not.toContain('"metricId":10,');
    expect(g.nodes[2].dependencies).toEqual(['candidate:1', 'candidate:2']);
  });
  it('same_label_different_identity_is_not_merged', () => {
    expect(
      build([
        { id: 10, version: 3, definition: leaf() },
        { id: 11, version: 4, definition: leaf('cost', 4) },
      ]).nodes,
    ).toHaveLength(2);
  });
  it('unsupported_basis_and_nested_formula_fail_closed', () => {
    expect(() =>
      build([{ id: 10, version: 3, definition: { ...leaf(), businessBasis: { sourceId: 1 } } }]),
    ).toThrow();
    const d = JSON.parse(JSON.stringify(formula()));
    (d.formula.operands[0] as any).definition = formula();
    expect(() => build([{ id: 20, version: 3, definition: d }])).toThrow();
  });
  it('explicit_null_default_date_is_preserved', () => {
    expect(
      build([{ id: 10, version: 3, definition: { ...leaf(), defaultDateColumn: null } }]).nodes[0]
        .definition.defaultDateColumn,
    ).toBeNull();
  });
  it('refuses_missing_columns_foreign_definitions_and_persistence_without_transaction', async () => {
    expect(() =>
      build([{ id: 10, version: 3, definition: { ...leaf(), column: 'missing' } }]),
    ).toThrow();
    expect(() =>
      build([{ id: 10, version: 3, definition: { ...leaf(), sourceId: 999 } }]),
    ).toThrow();
    await expect(
      persistReuseMetricGraph(
        build([{ id: 10, version: 3, definition: leaf() }]),
        2,
        'v',
        {} as any,
      ),
    ).rejects.toThrow('transaction');
  });
});
