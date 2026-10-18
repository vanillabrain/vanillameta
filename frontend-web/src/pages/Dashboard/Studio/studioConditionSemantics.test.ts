import { expect, it } from 'vitest';
import { validateStudioConditions, studioConditionsKey } from './studioDocument';
import { compile, operators, readPreview, readConditions } from '../../Explore/SourceConditions';
import { readProfileColumns } from '../../Explore/conditionProfile';
import { parseExploreViewState } from '../../Explore/exploreViewState';
const semantics = () => ({
  schemaVersion: 1 as const,
  catalogVersion: 7,
  columns: [
    { column: 'code', businessType: 'category' as const, dateFormat: '' as const },
    { column: 'day', businessType: 'date' as const, dateFormat: 'YYYY/MM/DD' as const },
  ],
});
const scope = () => ({
  sourceRevision: 'a'.repeat(64),
  definition: { include: null, exclude: null },
  semantics: semantics(),
});
it('clones and retains the complete canonical semantics wrapper; legacy absence stays absent', () => {
  const input = scope();
  const output = validateStudioConditions(input);
  input.semantics.columns[0].column = 'changed';
  expect(output).toEqual(scope());
  expect(studioConditionsKey(output)).not.toBe(studioConditionsKey({ ...output, semantics: undefined }));
  expect(
    validateStudioConditions({ sourceRevision: input.sourceRevision, definition: input.definition }),
  ).not.toHaveProperty('semantics');
});
it.each([
  null,
  {},
  { ...semantics(), schemaVersion: 2 },
  { ...semantics(), catalogVersion: 0 },
  { ...semantics(), catalogVersion: 1.5 },
  { ...semantics(), extra: true },
  { ...semantics(), columns: [...semantics().columns].reverse() },
  { ...semantics(), columns: [semantics().columns[0], semantics().columns[0]] },
  { ...semantics(), columns: [{ column: 'x', businessType: 'auto', dateFormat: '' }] },
  { ...semantics(), columns: [{ column: 'x', businessType: 'date', dateFormat: '' }] },
  { ...semantics(), columns: [{ column: 'x', businessType: 'category', dateFormat: 'native' }] },
  { ...semantics(), columns: [{ column: 'x', businessType: 'number', dateFormat: '', sql: 'x' }] },
])('fails closed on malformed semantic snapshot %j', value => {
  expect(() => validateStudioConditions({ ...scope(), semantics: value })).toThrow();
});
it('numeric business categories preserve scalar types and refuse ranges/contains', () => {
  const columns = readProfileColumns([
    { name: 'code', type: 'BIGINT', kind: 'number', businessType: 'category', dateFormat: '' },
  ]);
  expect(columns[0]).toMatchObject({ kind: 'number', businessType: 'category' });
  expect(operators('number', 'category')).toEqual(['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull']);
  const definition = {
    include: { kind: 'predicate' as const, column: 'code', operator: 'in', values: [1, 2] },
    exclude: null,
  };
  expect(compile(definition, columns)).toEqual(definition);
  for (const operator of ['gt', 'between', 'contains'])
    expect(() => compile({ ...definition, include: { ...definition.include, operator } }, columns)).toThrow();
});
it('projected VARCHAR date uses ISO condition values without rewriting old physical-format values', () => {
  const columns = readProfileColumns([
    { name: 'day', type: 'VARCHAR', kind: 'date', businessType: 'date', dateFormat: 'YYYY/MM/DD' },
  ]);
  const definition = {
    include: { kind: 'predicate' as const, column: 'day', operator: 'between', values: ['2024-01-01', '2024-01-31'] },
    exclude: null,
  };
  expect(compile(definition, columns)).toEqual(definition);
  const invalid = { ...definition, include: { ...definition.include, values: ['2024/01/01', '2024/01/31'] } };
  expect(() => compile(invalid, columns)).toThrow(/YYYY-MM-DD/);
  expect(invalid.include.values[0]).toBe('2024/01/01');
});
it('preview analysis wrapper must retain both the validated definition and semantic snapshot', () => {
  const draft = {
    sourceId: 3,
    sourceRevision: 'metadata-hash',
    version: 2,
    definition: scope().definition,
    semantics: semantics(),
  };
  const preview = {
    draft,
    population: { total: '1', matched: '1', excluded: '0', remaining: '1', matchedRatio: 1, remainingRatio: 1 },
    analysisConditions: scope(),
  };
  expect(readPreview(preview, draft).analysisConditions).toEqual(scope());
  for (const wrong of [undefined, { ...semantics(), catalogVersion: 8 }])
    expect(() => readPreview({ ...preview, analysisConditions: { ...scope(), semantics: wrong } }, draft)).toThrow();
});
it('Explore saved views retain semantic wrappers and validate them instead of dropping new fields', () => {
  const input = {
    version: 1,
    measureIds: [1],
    dimensionColumns: [],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value', direction: 'desc' },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day',
    comparePrevious: false,
    includeRows: false,
    conditions: scope(),
  };
  expect(parseExploreViewState(input).conditions).toEqual(scope());
  expect(() => parseExploreViewState({ ...input, conditions: { ...scope(), semantics: {} } })).toThrow();
});

it('explicit UUID categories retain native type and canonicalize strict UUID strings without editing the input', () => {
  const upper = 'ABCDEF01-2345-6789-ABCD-0123456789AB';
  const columns = [
    { name: 'id', type: 'UUID', kind: 'string' as const, businessType: 'category' as const, dateFormat: '' as const },
  ];
  const definition = {
    include: { kind: 'predicate' as const, column: 'id', operator: 'eq', values: [upper] },
    exclude: null,
  };
  const semantics = {
    schemaVersion: 1 as const,
    catalogVersion: 2,
    columns: [{ column: 'id', businessType: 'category' as const, dateFormat: '' as const }],
  };
  const response = readConditions(
    { sourceId: 1, sourceRevision: 'metadata', version: 1, schemaChanged: false, columns, definition, semantics },
    1,
  );
  expect(response.columns[0]).toMatchObject({ type: 'UUID', kind: 'string', businessType: 'category' });
  expect((compile(definition, response.columns).include as any).values).toEqual([upper.toLowerCase()]);
  expect(definition.include.values).toEqual([upper]);
  for (const value of [' ' + upper, upper.replaceAll('-', ''), upper.replace('A', 'G'), upper.slice(1), 123])
    expect(() => compile({ ...definition, include: { ...definition.include, values: [value] } }, columns)).toThrow(/UUID/);
});
it('explicit ENUM categories preserve exact strings, including unknown labels, and refuse ordered or contains operators', () => {
  const columns = readProfileColumns([
    { name: 'state', type: "ENUM('Draft', 'Done')", kind: 'string', businessType: 'category', dateFormat: '' },
  ]);
  const definition = {
    include: {
      kind: 'predicate' as const,
      column: 'state',
      operator: 'in',
      values: ['Draft', 'draft', ' Done ', "not'a'label"],
    },
    exclude: null,
  };
  expect(compile(definition, columns)).toEqual(definition);
  expect(columns[0].type).toBe("ENUM('Draft', 'Done')");
  for (const operator of ['gt', 'between', 'contains'])
    expect(() => compile({ ...definition, include: { ...definition.include, operator } }, columns)).toThrow();
  expect(() => compile({ ...definition, include: { ...definition.include, values: [1] } }, columns)).toThrow(/문자열/);
});
it('legacy UUID and ENUM without business semantics remain unsupported and do not acquire text equality', () => {
  for (const type of ['UUID', "ENUM('A','B')"]) {
    const columns = readProfileColumns([{ name: 'id', type, kind: 'unsupported' }]);
    const definition = {
      include: { kind: 'predicate' as const, column: 'id', operator: 'eq', values: ['A'] },
      exclude: null,
    };
    expect(() => compile(definition, columns)).toThrow();
    expect(
      compile({ ...definition, include: { kind: 'predicate', column: 'id', operator: 'isNull' } }, columns).include,
    ).toEqual({ kind: 'predicate', column: 'id', operator: 'isNull' });
    expect(() => readProfileColumns([{ name: 'id', type, kind: 'string' }])).toThrow();
    expect(() =>
      readConditions(
        {
          sourceId: 1,
          sourceRevision: 'metadata',
          version: 0,
          schemaChanged: false,
          definition: { include: null, exclude: null },
          columns: [{ name: 'id', type, kind: 'string', businessType: 'category', dateFormat: '' }],
        },
        1,
      ),
    ).toThrow(/업무 의미/);
    expect(() =>
      readProfileColumns([{ name: 'id', type, kind: 'unsupported', businessType: 'category', dateFormat: '' }]),
    ).toThrow();
  }
});
