import {
  compileSemanticProposal,
  semanticCatalog,
  metricIdentity,
  normalizeMetric,
  dimensionDefinition,
} from './semantic-proposal';
import { metricExpression, metricFields } from './metric-expression';
import { compileMetricWidget } from './structured-widget';
import {
  BusinessBasis,
  businessProfile,
  businessSchemaRevision,
  businessDimensionExpression,
  sliceBusinessBasis,
} from './semantic-business-basis';

describe('new semantic compiler business basis and frozen native reuse', () => {
  const profile = {
    sourceId: 1,
    dataVersion: 'v1',
    supported: true,
    columns: [
      { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
      { name: 'code', type: 'BIGINT', numeric: true, temporal: false },
      { name: 'business_day', type: 'VARCHAR', numeric: false, temporal: false },
      { name: 'native_day', type: 'DATE', numeric: false, temporal: true },
    ],
  };
  const basis = (): BusinessBasis => ({
    schemaVersion: 1,
    catalogVersion: 1,
    schemaRevision: businessSchemaRevision(profile),
    columns: profile.columns
      .map(column => ({
        column: column.name,
        nativeType: column.type,
        label: `Business ${column.name}`,
        description: 'Private context',
        unit: column.name === 'amount' ? '$' : '',
        classification: '',
        businessType:
          column.name === 'amount'
            ? 'number'
            : column.name === 'business_day'
            ? 'date'
            : 'category',
        dateFormat: column.name === 'business_day' ? 'YYYY/MM/DD' : '',
      }))
      .sort((a, b) => (a.column < b.column ? -1 : 1)) as BusinessBasis['columns'],
  });
  const metric = (overrides = {}) => ({
    label: 'Amount',
    aggregation: 'SUM',
    column: 'amount',
    unit: '$',
    decimalPlaces: 0,
    numberNotation: 'plain',
    ...overrides,
  });
  const proposal = (overrides = {}) => ({
    schemaVersion: 1,
    sourceId: 1,
    sourceRevision: 'v1',
    title: 'Business',
    businessBasis: basis(),
    measures: [{ key: 'amount', definition: metric() }],
    dimensions: [{ key: 'day', column: 'business_day' }],
    blocks: [
      { key: 'daily', measureKey: 'amount', dimensionKey: 'day', chart: 'line', title: 'Daily' },
    ],
    ...overrides,
  });

  it.each(['SUM', 'AVG', 'MIN', 'MAX'])(
    'blocks new %s of a native numeric category but permits exact count/distinct and dimensions',
    aggregation => {
      expect(() =>
        normalizeMetric(metric({ column: 'code', aggregation }), profile, basis()),
      ).toThrow();
      const distinct = normalizeMetric(
        metric({ column: 'code', aggregation: 'COUNT_DISTINCT' }),
        profile,
        basis(),
      );
      expect(metricExpression(distinct, profile)).toBe('COUNT(DISTINCT "code")');
      expect(
        compileMetricWidget(distinct, profile, 'bar', 'code', 'Codes', basis()).dimension.name,
      ).toBe('code');
    },
  );
  it('rejects category denominator/weight and incomplete new metric/root subsets before falling back to native flags', () => {
    for (const [aggregation, key] of [
      ['RATIO_SUM', 'denominatorColumn'],
      ['WEIGHTED_AVG', 'weightColumn'],
    ]) {
      expect(() =>
        normalizeMetric(
          metric({
            aggregation,
            [key]: 'code',
            ...(aggregation === 'RATIO_SUM' ? { scale: 1 } : {}),
          }),
          profile,
          basis(),
        ),
      ).toThrow();
      const incomplete = sliceBusinessBasis(basis(), ['amount']);
      expect(() =>
        normalizeMetric(
          metric({
            aggregation,
            [key]: 'code',
            ...(aggregation === 'RATIO_SUM' ? { scale: 1 } : {}),
          }),
          profile,
          incomplete,
        ),
      ).toThrow();
    }
    const input = proposal();
    input.businessBasis = sliceBusinessBasis(input.businessBasis, ['amount', 'business_day']);
    expect(() => compileSemanticProposal(input, profile, [])).toThrow();
  });
  it('uses the exact same parsed date expression in SELECT/GROUP with ordered line output and freezes full root/private context', () => {
    const result = compileSemanticProposal(proposal(), profile, []);
    const expression = businessDimensionExpression(profile, basis(), 'business_day');
    expect(result.draft.widgets[0].sql).toBe(
      `SELECT ${expression} AS dimension, SUM("amount") AS value FROM source GROUP BY ${expression} ORDER BY dimension LIMIT 500`,
    );
    expect(result.proposal.businessBasis.columns).toHaveLength(4);
    expect(result.draft.businessBasis.columns).toHaveLength(4);
    expect(
      result.plan.measures[0].definition.businessBasis.columns.map(column => column.column),
    ).toEqual(['amount']);
    expect(result.plan.dimensions[0].businessBasis.columns.map(column => column.column)).toEqual([
      'business_day',
    ]);
    expect(result.draft.widgets[0].businessBasis.columns.map(column => column.column)).toEqual([
      'business_day',
    ]);
  });
  it('retains full root time declarations even for a number-only proposal and does not revive a category native DATE', () => {
    const input = proposal({
      dimensions: [],
      blocks: [{ key: 'total', measureKey: 'amount', chart: 'number', title: 'Total' }],
    });
    const result = compileSemanticProposal(input, profile, []);
    expect(
      result.draft.businessBasis.columns.find(column => column.column === 'business_day')
        .businessType,
    ).toBe('date');
    expect(() =>
      compileMetricWidget(
        result.plan.measures[0].definition,
        profile,
        'line',
        'native_day',
        'No implicit native time',
        basis(),
      ),
    ).toThrow();
  });
  it('preserves a legacy SUM metric using its own native flags even when passed the new projected category profile', () => {
    const native = metric({ column: 'code' });
    const projected = businessProfile(profile, basis());
    expect(projected.columns.find(column => column.name === 'code').numeric).toBe(false);
    expect(metricFields(native, projected).column).toBe('code');
    expect(metricExpression(native, projected)).toBe('SUM("code")');
    const catalog = semanticCatalog(
      [
        {
          id: 9,
          databaseId: 1,
          useYn: 'Y',
          definition: JSON.stringify({
            schemaVersion: 1,
            sourceId: 1,
            definitionVersion: 1,
            tableName: 'uploaded_data',
            ...native,
          }),
        },
      ],
      projected,
    );
    const input = proposal({
      measures: [{ key: 'amount', reuse: { metricId: 9, definitionVersion: 1 } }],
    });
    expect(compileSemanticProposal(input, profile, catalog).draft.widgets[0].sql).toContain(
      'SUM("code")',
    );
  });
  it('changes proposal digest on explicit context adoption but preserves calculation identity across labels and unused metadata', () => {
    const first = basis(),
      second = basis();
    second.catalogVersion = 2;
    second.columns.forEach(column => {
      column.label += ' renamed';
      column.description = 'Changed';
      column.classification = 'New metadata';
    });
    const left = normalizeMetric(metric(), profile, first),
      right = normalizeMetric(metric(), profile, second);
    expect(metricIdentity(left, 1)).toBe(metricIdentity(right, 1));
    expect(dimensionDefinition(profile, profile.columns[2], first).id).toBe(
      dimensionDefinition(profile, profile.columns[2], second).id,
    );
    expect(
      compileSemanticProposal(proposal({ businessBasis: first }), profile, []).previewDigest,
    ).not.toBe(
      compileSemanticProposal(proposal({ businessBasis: second }), profile, []).previewDigest,
    );
  });
});
