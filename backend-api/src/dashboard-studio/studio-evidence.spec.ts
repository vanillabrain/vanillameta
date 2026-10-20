import { buildStudioEvidence } from './studio-evidence';
import { pinMetricFormula } from '../bi/metric-formula';
import { metricExpression } from '../bi/metric-expression';
const doc: any = {
  sourceId: 3,
  revision: 'a'.repeat(64),
  blocks: [
    {
      id: 'b1',
      definitionKey: 'b1',
      kind: 'BOARD_NUMERIC',
      measureRefs: [{ id: 5, definitionVersion: '2' }],
      dimensionRefs: [],
      display: {},
    },
  ],
};
const base: any = {
  document: doc,
  sourceRevision: 'b'.repeat(64),
  schemaVersion: 'c'.repeat(64),
  dataVersion: 'd'.repeat(64),
  calculationItems: [
    {
      metricId: 5,
      definitionVersion: 2,
      definition: {
        schemaVersion: 1,
        sourceId: 3,
        definitionVersion: 2,
        aggregation: 'SUM',
        column: 'revenue',
        unit: 'KRW',
        secret: 'never',
      },
    },
  ],
  definitionBlocks: doc.blocks,
  preview: {
    widgets: [{ datas: [{ value: 13000 }], sql: 'secret SQL', trendUnavailable: 'unsupported' }],
  },
};
describe('owner-only Studio execution evidence', () => {
  it('proves a saved formula against executed SQL and projects only labelled references', () => {
    const profile = {
      sourceId: 3,
      columns: [
        { name: 'revenue', numeric: true },
        { name: 'cost', numeric: true },
      ],
    };
    const operand = (id: number, column: string) => ({
      id,
      definitionVersion: 1,
      definition: {
        schemaVersion: 1,
        definitionVersion: 1,
        sourceId: 3,
        tableName: 'uploaded_data',
        label: column,
        aggregation: 'SUM',
        column,
        unit: 'USD',
        decimalPlaces: 2,
        numberNotation: 'plain',
      },
    });
    const formula = pinMetricFormula(
      {
        op: 'subtract',
        left: { metricId: 1, definitionVersion: 1 },
        right: { metricId: 2, definitionVersion: 1 },
      },
      [operand(1, 'revenue'), operand(2, 'cost')],
      profile,
    );
    const definition = {
      schemaVersion: 1,
      sourceId: 3,
      definitionVersion: 2,
      aggregation: 'FORMULA',
      column: '*',
      formula,
      unit: 'USD',
    };
    const input = {
      ...base,
      schema: profile.columns.map(column => ({ column_name: column.name, column_type: 'DOUBLE' })),
      calculationItems: [{ metricId: 5, definitionVersion: 2, definition }],
      preview: {
        widgets: [
          {
            datas: [{ value: 100 }],
            sql: `SELECT ${metricExpression(definition, profile)} AS value FROM source`,
          },
        ],
      },
    };
    const result = buildStudioEvidence(input).blocks[0].calculation;
    expect(result).toEqual({
      aggregation: 'FORMULA',
      unit: 'USD',
      expressionLabel: '(revenue (#1 · v1) − cost (#2 · v1))',
    });
    expect(JSON.stringify(result)).not.toMatch(/SELECT|uploaded_data|operands/);
    expect(
      buildStudioEvidence({
        ...input,
        preview: {
          widgets: [
            { ...input.preview.widgets[0], sql: 'SELECT SUM(revenue) AS value FROM source' },
          ],
        },
      }).blocks[0].calculation,
    ).toBeNull();
  });
  it('uses the saved calculation snapshot and only allowlisted evidence', () => {
    const e = buildStudioEvidence(base);
    expect(e.source).toEqual({
      id: 3,
      revision: base.sourceRevision,
      schemaVersion: base.schemaVersion,
      dataVersion: base.dataVersion,
    });
    expect(e.blocks[0].calculation).toEqual({ aggregation: 'SUM', column: 'revenue', unit: 'KRW' });
    expect(e.blocks[0].measureRefs).toEqual(doc.blocks[0].measureRefs);
    expect(e.blocks[0].aggregateRowCount).toBe(1);
    expect(JSON.stringify(e)).not.toMatch(/secret|never|SELECT/);
    expect(Number.isFinite(Date.parse(e.queriedAt))).toBe(true);
  });
  it('never invents a structured formula for legacy or mismatched references', () => {
    expect(buildStudioEvidence({ ...base, calculationItems: [] }).blocks[0].calculation).toBeNull();
    const wrong = { ...base.calculationItems[0], definitionVersion: 3 };
    expect(
      buildStudioEvidence({ ...base, calculationItems: [wrong] }).blocks[0].calculation,
    ).toBeNull();
  });
  it('binds exact scope and handles copied block definitions', () => {
    const document = {
      ...doc,
      filters: [{ column: 'channel', values: ['Site'] }],
      dateRange: { column: 'day', start: '2026-01-01', end: '2026-01-02' },
      blocks: [{ ...doc.blocks[0], id: 'new:copy' }],
    };
    const e = buildStudioEvidence({ ...base, document });
    expect(e.query.filters).toEqual(document.filters);
    expect(e.query.dateRange).toEqual(document.dateRange);
    expect(e.query.blocks[0].id).toBe('new:copy');
    expect(e.blocks[0].calculation?.unit).toBe('KRW');
  });
  it('does not call suppressed chart rows a zero-row aggregation', () => {
    const e = buildStudioEvidence({
      ...base,
      preview: { widgets: [{ datas: [], grainUnavailable: 'too many points' }] },
    });
    expect(e.blocks[0].resultStatus).toBe('unavailable');
    expect(e.blocks[0].aggregateRowCount).toBeNull();
  });
  it('rejects evidence without a successful matching preview', () => {
    expect(() => buildStudioEvidence({ ...base, preview: null })).toThrow();
    expect(() => buildStudioEvidence({ ...base, preview: { widgets: [] } })).toThrow();
  });
});
