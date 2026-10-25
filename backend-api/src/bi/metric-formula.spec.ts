import { BadRequestException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { metricExpression } from './metric-expression';
import { businessSchemaRevision } from './semantic-business-basis';
import {
  FORMULA_LIMITS,
  collectFormulaReferences,
  compileMetricFormula,
  normalizeFormulaUnit,
  pinMetricFormula,
  assertNewMetricFormula,
} from './metric-formula';

jest.setTimeout(60000);

const profile = {
  sourceId: 7,
  columns: [
    { name: 'company', type: 'VARCHAR', numeric: false },
    { name: 'revenue', type: 'DOUBLE', numeric: true },
    { name: 'cost', type: 'DOUBLE', numeric: true },
    { name: 'sku', type: 'VARCHAR', numeric: false },
  ],
};

const definition = (over: any = {}) => ({
  schemaVersion: 1,
  definitionVersion: 1,
  sourceId: 7,
  tableName: 'uploaded_data',
  label: '지표',
  unit: 'USD',
  decimalPlaces: 2,
  numberNotation: 'plain',
  aggregation: 'SUM',
  column: 'revenue',
  ...over,
});

const operand = (id: number, over: any = {}, version = 1) => ({
  id,
  definitionVersion: version,
  definition: definition({ definitionVersion: version, ...over }),
});

const leaf = (metricId: number, definitionVersion = 1) => ({ metricId, definitionVersion });
const add = (left: unknown, right: unknown) => ({ op: 'add', left, right });
const subtract = (left: unknown, right: unknown) => ({ op: 'subtract', left, right });
const ratio = (left: unknown, right: unknown, scale: 1 | 100) => ({
  op: 'ratio',
  left,
  right,
  scale,
});

/** left-leaning chain: depth 1 is a leaf, every add adds one level. */
const chain = (depth: number) => {
  let node: any = leaf(1);
  for (let level = 2; level <= depth; level += 1) node = add(node, leaf(1));
  return node;
};

/** balanced tree: depth 4 holds 15 nodes, the largest shape the depth rule allows. */
const full = (level: number): any =>
  level === 1 ? leaf(1) : add(full(level - 1), full(level - 1));

const pin = (node: unknown, definitions: unknown, who = profile) =>
  pinMetricFormula(node, definitions, who);

const compile = (frozen: unknown, who = profile, compiler: any = metricExpression) =>
  compileMetricFormula(frozen, who, compiler);

const selfRatioError = {
  status: 400,
  response: {
    code: 'FORMULA_SELF_RATIO',
    message:
      '분자와 분모가 같은 계산은 비율을 비교할 수 없습니다. 서로 다른 지표나 계산을 선택해 주세요.',
  },
};

describe('metric formula helper', () => {
  describe('new formula self-ratio guard', () => {
    const validate = (expression: unknown, operands: unknown) =>
      assertNewMetricFormula(pin(expression, operands), profile, metricExpression);

    it.each([1, 100] as const)('rejects the same pinned metric at scale %s', scale => {
      expect(() => validate(ratio(leaf(1, 2), leaf(1, 2), scale), [operand(1, {}, 2)])).toThrow(
        expect.objectContaining(selfRatioError),
      );
    });

    it('rejects identical normalized subexpressions and ratios nested below other operators', () => {
      const a = add(leaf(1), leaf(2));
      const b = { right: leaf(2), op: 'add', left: leaf(1) };
      expect(() =>
        validate(ratio(a, b, 100), [operand(1), operand(2, { column: 'cost' })]),
      ).toThrow(expect.objectContaining(selfRatioError));
      expect(() =>
        validate(add(ratio(leaf(1), leaf(1), 1), ratio(leaf(2), leaf(1), 1)), [
          operand(1),
          operand(2, { column: 'cost' }),
        ]),
      ).toThrow(expect.objectContaining(selfRatioError));
      expect(() =>
        validate(ratio(ratio(leaf(1), leaf(1), 1), ratio(leaf(2), leaf(1), 1), 100), [
          operand(1),
          operand(2, { column: 'cost' }),
        ]),
      ).toThrow(expect.objectContaining(selfRatioError));
    });

    it('rejects distinct saved metrics with identical compiled arithmetic, ignoring display metadata', () => {
      const operands = [
        operand(1),
        operand(
          2,
          {
            label: 'Other label',
            unit: '$',
            decimalPlaces: 6,
            numberNotation: 'compact',
          },
          3,
        ),
      ];
      expect(() => validate(ratio(leaf(1), leaf(2, 3), 100), operands)).toThrow(
        expect.objectContaining(selfRatioError),
      );
      expect(() =>
        validate(ratio(subtract(leaf(1), leaf(3)), subtract(leaf(2, 3), leaf(3)), 1), [
          ...operands,
          operand(3, { column: 'cost' }),
        ]),
      ).toThrow(expect.objectContaining(selfRatioError));
    });

    it('allows different columns, aggregations, operand order and leaf scales', () => {
      expect(() =>
        validate(ratio(leaf(1), leaf(2), 100), [operand(1), operand(2, { column: 'cost' })]),
      ).not.toThrow();
      expect(() =>
        validate(ratio(leaf(1), leaf(2), 1), [operand(1), operand(2, { aggregation: 'AVG' })]),
      ).not.toThrow();
      expect(() =>
        validate(ratio(subtract(leaf(1), leaf(2)), subtract(leaf(2), leaf(1)), 100), [
          operand(1),
          operand(2, { column: 'cost' }),
        ]),
      ).not.toThrow();
      expect(() =>
        validate(ratio(leaf(1), leaf(2), 1), [
          operand(1, { aggregation: 'RATIO_SUM', denominatorColumn: 'cost', scale: 1, unit: '' }),
          operand(2, { aggregation: 'RATIO_SUM', denominatorColumn: 'cost', scale: 100, unit: '' }),
        ]),
      ).not.toThrow();
    });

    it('preserves historical pinning and compilation of self-ratios without changing snapshots', () => {
      const frozen = pin(ratio(leaf(1), leaf(2), 100), [operand(1), operand(2)]);
      const before = JSON.stringify(frozen);
      expect(compile(frozen).sql).toBe('((SUM("revenue")) / NULLIF((SUM("revenue")), 0) * 100)');
      expect(() => assertNewMetricFormula(frozen, profile, metricExpression)).toThrow(
        expect.objectContaining(selfRatioError),
      );
      expect(JSON.stringify(frozen)).toBe(before);
      expect(compile(frozen).sql).toContain('NULLIF');
    });
  });

  describe('collectFormulaReferences', () => {
    it('returns the unique referenced metrics sorted by metricId', () => {
      const expression = add(subtract(leaf(3), leaf(1)), ratio(leaf(2), leaf(3), 100));
      expect(collectFormulaReferences(expression)).toEqual([
        { metricId: 1, definitionVersion: 1 },
        { metricId: 2, definitionVersion: 1 },
        { metricId: 3, definitionVersion: 1 },
      ]);
    });

    it('rejects anything that is not a strict reference or operator node', () => {
      const invalid: Array<[string, unknown]> = [
        ['null node', null],
        ['array node', []],
        ['string node', 'SUM(revenue)'],
        ['number node', 1],
        ['empty object', {}],
        ['reference without a version', { metricId: 1 }],
        ['reference without a metricId', { definitionVersion: 1 }],
        ['zero metricId', { metricId: 0, definitionVersion: 1 }],
        ['negative version', { metricId: 1, definitionVersion: -1 }],
        ['fractional metricId', { metricId: 1.5, definitionVersion: 1 }],
        ['reference with an extra field', { metricId: 1, definitionVersion: 1, column: 'revenue' }],
        ['reference with raw SQL', { metricId: 1, definitionVersion: 1, sql: 'SELECT 1' }],
        ['unknown operator', { op: 'multiply', left: leaf(1), right: leaf(1) }],
        ['operator without operands', { op: 'add' }],
        ['operator with an extra field', { op: 'add', left: leaf(1), right: leaf(1), scale: 1 }],
        ['ratio without a scale', { op: 'ratio', left: leaf(1), right: leaf(1) }],
        ['ratio with a bad scale', ratio(leaf(1), leaf(1), 2 as any)],
        ['constant node', { value: 1 }],
        ['text node', { text: 'revenue' }],
        ['SQL node', { sql: 'SELECT * FROM uploaded_data' }],
      ];
      for (const [label, value] of invalid) {
        let thrown: unknown;
        try {
          collectFormulaReferences(value);
        } catch (error) {
          thrown = error;
        }
        expect([label, thrown instanceof BadRequestException]).toEqual([label, true]);
      }
    });

    it('rejects one metric referenced at two definition versions', () => {
      expect(() => collectFormulaReferences(add(leaf(1, 1), leaf(1, 2)))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('formula limits', () => {
    it('accepts the maximum depth and rejects one level more', () => {
      expect(collectFormulaReferences(chain(FORMULA_LIMITS.maxDepth))).toHaveLength(1);
      expect(() => collectFormulaReferences(chain(FORMULA_LIMITS.maxDepth + 1))).toThrow(
        BadRequestException,
      );
    });

    it('accepts the largest shape the depth rule allows', () => {
      expect(collectFormulaReferences(full(FORMULA_LIMITS.maxDepth))).toHaveLength(1);
      // One more level breaks the depth budget before the node budget could apply.
      expect(() => collectFormulaReferences(full(FORMULA_LIMITS.maxDepth + 1))).toThrow(
        BadRequestException,
      );
    });

    it('rejects more distinct references than the reference budget', () => {
      const seven = add(
        add(add(leaf(1), leaf(2)), add(leaf(3), leaf(4))),
        add(add(leaf(5), leaf(6)), add(leaf(7), leaf(1))),
      );
      expect(() => collectFormulaReferences(seven)).toThrow(BadRequestException);
      const six = add(add(add(leaf(1), leaf(2)), add(leaf(3), leaf(4))), add(leaf(5), leaf(6)));
      expect(collectFormulaReferences(six)).toHaveLength(6);
    });
  });

  describe('unit normalization', () => {
    it('folds the documented aliases and keeps other units exact', () => {
      expect(normalizeFormulaUnit(undefined)).toBe('');
      expect(normalizeFormulaUnit(' USD ')).toBe('USD');
      expect(normalizeFormulaUnit('usd')).toBe('USD');
      expect(normalizeFormulaUnit('$')).toBe('USD');
      expect(normalizeFormulaUnit('US$')).toBe('USD');
      expect(normalizeFormulaUnit('krw')).toBe('KRW');
      expect(normalizeFormulaUnit('₩')).toBe('KRW');
      expect(normalizeFormulaUnit('원')).toBe('KRW');
      // A count is its own dimension and stays distinct from an untagged metric.
      expect(normalizeFormulaUnit('count')).toBe('count');
      expect(normalizeFormulaUnit('건')).toBe('count');
      expect(normalizeFormulaUnit('')).toBe('');
      expect(normalizeFormulaUnit('  ')).toBe('');
      expect(normalizeFormulaUnit(' box ')).toBe('box');
      expect(normalizeFormulaUnit('Box')).toBe('Box');
      expect(() => normalizeFormulaUnit(5)).toThrow(BadRequestException);
      expect(() => normalizeFormulaUnit('x'.repeat(FORMULA_LIMITS.maxUnitLength + 1))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('pinMetricFormula', () => {
    it('keeps a legacy unlabelled count distinct from dimensionless ratios and rejects count currency', () => {
      const a = operand(1, { aggregation: 'COUNT', column: '*', unit: '' });
      const b = operand(2, { aggregation: 'COUNT_DISTINCT', column: 'company', unit: '건' });
      expect(pinMetricFormula(ratio(leaf(1), leaf(2), 100), [a, b], profile).unit).toBe('%');
      expect(pinMetricFormula(add(leaf(1), leaf(2)), [a, b], profile).unit).toBe('count');
      const fraction = operand(3, {
        aggregation: 'RATIO_SUM',
        column: 'cost',
        denominatorColumn: 'revenue',
        scale: 1,
        unit: '',
      });
      expect(() => pinMetricFormula(add(leaf(1), leaf(3)), [a, fraction], profile)).toThrow(
        BadRequestException,
      );
      expect(() =>
        pinMetricFormula(
          leaf(1),
          [operand(1, { aggregation: 'COUNT', column: '*', unit: 'USD' })],
          profile,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        pinMetricFormula(leaf(1), [operand(1, { unit: ' '.repeat(1000) + 'USD' })], profile),
      ).toThrow(BadRequestException);
    });
    const currency = [
      operand(1, { column: 'cost', unit: '$' }),
      operand(2, { column: 'revenue', unit: 'USD' }),
    ];

    it('pins a serializable snapshot with sorted operands and an inferred unit', () => {
      const frozen = pin(add(leaf(2), leaf(1)), [currency[0], currency[1]]);
      expect(frozen.unit).toBe('USD');
      expect(frozen.operands.map(entry => entry.id)).toEqual([1, 2]);
      // The snapshot records each stored definition verbatim; only the result unit is normalized.
      expect(frozen.operands[0].definition.unit).toBe('$');
      expect(frozen.operands[1].definition.unit).toBe('USD');
      expect(JSON.parse(JSON.stringify(frozen)).operands[0].definition.unit).toBe('$');
      expect(JSON.parse(JSON.stringify(frozen))).toEqual(frozen);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.operands[0].definition)).toBe(true);
    });

    it('infers the documented result unit for every operator', () => {
      const byId: Record<number, any> = {
        1: operand(1, { column: 'cost', unit: 'USD' }),
        2: operand(2, { column: 'revenue', unit: 'USD' }),
        3: operand(3, { aggregation: 'COUNT', column: '*', unit: '건' }),
        4: operand(4, { aggregation: 'COUNT', column: '*', unit: 'count' }),
        5: operand(5, { column: 'revenue', unit: 'box' }),
        6: operand(6, { column: 'cost', unit: 'box' }),
        7: operand(7, { column: 'revenue', unit: '' }),
        8: operand(8, { column: 'cost', unit: '' }),
      };
      const pick = (...ids: number[]) => ids.map(id => byId[id]);
      expect(pin(add(leaf(1), leaf(2)), pick(1, 2)).unit).toBe('USD');
      expect(pin(subtract(leaf(1), leaf(2)), pick(1, 2)).unit).toBe('USD');
      expect(pin(ratio(leaf(1), leaf(2), 1), pick(1, 2)).unit).toBe('');
      expect(pin(ratio(leaf(1), leaf(2), 100), pick(1, 2)).unit).toBe('%');
      expect(pin(add(leaf(3), leaf(4)), pick(3, 4)).unit).toBe('count');
      expect(pin(ratio(leaf(3), leaf(4), 100), pick(3, 4)).unit).toBe('%');
      expect(pin(add(leaf(5), leaf(6)), pick(5, 6)).unit).toBe('box');
      expect(pin(add(leaf(7), leaf(8)), pick(7, 8)).unit).toBe('');
      expect(pin(ratio(leaf(7), leaf(8), 1), pick(7, 8)).unit).toBe('');
    });

    it('refuses to mix units that are not provably identical', () => {
      const mixed = [
        operand(1, { column: 'cost', unit: 'USD' }),
        operand(2, { column: 'revenue', unit: 'KRW' }),
        operand(3, { column: 'revenue', unit: 'box' }),
        operand(4, { column: 'cost', unit: 'Box' }),
        operand(5, { aggregation: 'COUNT', column: '*', unit: '건' }),
        operand(6, { column: 'revenue', unit: '' }),
        operand(7, { column: 'cost', unit: '$' }),
      ];
      expect(() => pin(add(leaf(1), leaf(2)), mixed.slice(0, 2))).toThrow(BadRequestException);
      expect(() => pin(add(leaf(1), leaf(3)), [mixed[0], mixed[2]])).toThrow(BadRequestException);
      expect(() => pin(ratio(leaf(3), leaf(4), 1), [mixed[2], mixed[3]])).toThrow(
        BadRequestException,
      );
      expect(() => pin(add(leaf(3), leaf(4)), [mixed[2], mixed[3]])).toThrow(BadRequestException);
      // A count and a dimensionless metric (for example a ratio leaf) have different dimensions.
      expect(() => pin(add(leaf(5), leaf(6)), [mixed[4], mixed[5]])).toThrow(BadRequestException);
      expect(() => pin(ratio(leaf(5), leaf(6), 100), [mixed[4], mixed[5]])).toThrow(
        BadRequestException,
      );
      expect(() => pin(add(leaf(5), leaf(1)), [mixed[4], mixed[0]])).toThrow(BadRequestException);
      // Two count metrics still combine, and a '$' alias still matches 'USD'.
      expect(pin(add(leaf(5), leaf(5)), [mixed[4]]).unit).toBe('count');
      expect(pin(add(leaf(1), leaf(7)), [mixed[0], mixed[6]]).unit).toBe('USD');
    });

    it('rejects operand sets that do not match the referenced metrics exactly', () => {
      const definitions = [operand(1, { column: 'cost' }), operand(2)];
      expect(() => pin(leaf(1), [])).toThrow(BadRequestException);
      expect(() => pin(add(leaf(1), leaf(2)), [definitions[0]])).toThrow(BadRequestException);
      expect(() => pin(leaf(1), definitions)).toThrow(BadRequestException);
      expect(() => pin(leaf(1), [definitions[0], definitions[0]])).toThrow(BadRequestException);
      expect(() => pin(leaf(1), [operand(1, { column: 'cost' }, 2)])).toThrow(BadRequestException);
      expect(() => pin(leaf(1), 'nope')).toThrow(BadRequestException);
    });

    it('rejects definitions that break the leaf contract', () => {
      const cases: Array<[string, any]> = [
        ['unknown definition key', operand(1, { sql: 'SELECT 1' })],
        ['formula key', operand(1, { formula: { expression: leaf(2) } })],
        ['expression key', operand(1, { expression: 'SUM(revenue)' })],
        [
          'prototype key',
          {
            id: 1,
            definitionVersion: 1,
            definition: JSON.parse('{"__proto__": 1, "schemaVersion": 1}'),
          },
        ],
        ['constructor key', { id: 1, definitionVersion: 1, definition: { constructor: 'x' } }],
        ['prototype name key', { id: 1, definitionVersion: 1, definition: { prototype: 'x' } }],
        ['wrong schemaVersion', operand(1, { schemaVersion: 2 })],
        [
          'missing schemaVersion',
          {
            id: 1,
            definitionVersion: 1,
            definition: { ...definition(), schemaVersion: undefined },
          },
        ],
        ['foreign source', operand(1, { sourceId: 8 })],
        ['foreign table', operand(1, { tableName: 'other_table' })],
        ['FORMULA aggregation', operand(1, { aggregation: 'FORMULA' })],
        ['unknown aggregation', operand(1, { aggregation: 'MEDIAN' })],
        ['missing column', operand(1, { column: 'missing' })],
        ['non numeric SUM column', operand(1, { column: 'sku' })],
        ['COUNT with a column', operand(1, { aggregation: 'COUNT', column: 'revenue' })],
        ['RATIO_SUM without a denominator', operand(1, { aggregation: 'RATIO_SUM', scale: 1 })],
        [
          'RATIO_SUM without a scale',
          operand(1, { aggregation: 'RATIO_SUM', denominatorColumn: 'revenue' }),
        ],
        [
          'RATIO_SUM with a bad scale',
          operand(1, { aggregation: 'RATIO_SUM', denominatorColumn: 'revenue', scale: 3 }),
        ],
        ['scale on SUM', operand(1, { scale: 100 })],
        [
          'operand wrapper extra field',
          { id: 1, definitionVersion: 1, definition: definition(), extra: true },
        ],
        ['operand without a definition', { id: 1, definitionVersion: 1 }],
        ['bad decimalPlaces', operand(1, { decimalPlaces: 9 })],
        ['bad numberNotation', operand(1, { numberNotation: 'scientific' })],
        ['bad unit length', operand(1, { unit: 'x'.repeat(FORMULA_LIMITS.maxUnitLength + 1) })],
      ];
      for (const [label, value] of cases) {
        let thrown: unknown;
        try {
          pin(leaf(1), [value]);
        } catch (error) {
          thrown = error;
        }
        expect([label, thrown instanceof BadRequestException]).toEqual([label, true]);
      }
    });
  });

  describe('compileMetricFormula', () => {
    const definitions = [operand(1, { column: 'cost' }), operand(2, { column: 'revenue' })];

    it('emits canonical parenthesised SQL with the operands columns deduplicated', () => {
      const subtractFrozen = pin(subtract(leaf(2), leaf(1)), definitions);
      expect(compile(subtractFrozen)).toEqual({
        sql: '((SUM("revenue")) - (SUM("cost")))',
        unit: 'USD',
        columns: ['revenue', 'cost'],
      });
      const ratioFrozen = pin(ratio(leaf(1), leaf(2), 100), definitions);
      expect(compile(ratioFrozen)).toEqual({
        sql: '((SUM("cost")) / NULLIF((SUM("revenue")), 0) * 100)',
        unit: '%',
        columns: ['cost', 'revenue'],
      });
      const nestedFrozen = pin(ratio(add(leaf(2), leaf(1)), leaf(2), 1), definitions);
      expect(compile(nestedFrozen)).toEqual({
        sql: '(((SUM("revenue")) + (SUM("cost"))) / NULLIF((SUM("revenue")), 0))',
        unit: '',
        columns: ['revenue', 'cost'],
      });
    });

    it('compiles a repeated leaf once and keeps one column entry', () => {
      const frozen = pin(add(leaf(2), leaf(2)), [definitions[1]]);
      expect(frozen.operands).toHaveLength(1);
      expect(compile(frozen).sql).toBe('((SUM("revenue")) + (SUM("revenue")))');
      expect(compile(frozen).columns).toEqual(['revenue']);
    });

    it('revalidates the snapshot and the current profile on every compile', () => {
      const frozen = pin(subtract(leaf(2), leaf(1)), definitions);
      const tampered = JSON.parse(JSON.stringify(frozen));
      tampered.extra = true;
      expect(() => compile(tampered)).toThrow(BadRequestException);
      const badUnit = JSON.parse(JSON.stringify(frozen));
      badUnit.unit = 'KRW';
      expect(() => compile(badUnit)).toThrow(BadRequestException);
      const badVersion = JSON.parse(JSON.stringify(frozen));
      badVersion.operands[0].definition.definitionVersion = 2;
      expect(() => compile(badVersion)).toThrow(BadRequestException);
      const badSource = JSON.parse(JSON.stringify(frozen));
      badSource.operands[0].definition.sourceId = 9;
      expect(() => compile(badSource)).toThrow(BadRequestException);
      const foreignProfile = { ...profile, sourceId: 9 };
      expect(() => compile(frozen, foreignProfile)).toThrow(BadRequestException);
      const missingColumn = {
        sourceId: 7,
        columns: profile.columns.filter(column => column.name !== 'cost'),
      };
      expect(() => compile(frozen, missingColumn)).toThrow(BadRequestException);
      const textColumn = {
        sourceId: 7,
        columns: profile.columns.map(column =>
          column.name === 'cost' ? { ...column, numeric: false } : column,
        ),
      };
      expect(() => compile(frozen, textColumn)).toThrow(BadRequestException);
      expect(() => compileMetricFormula(frozen, profile, undefined as any)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a leaf compiler that returns unsafe or empty SQL', () => {
      const frozen = pin(subtract(leaf(2), leaf(1)), definitions);
      const unsafe: Array<[string, any]> = [
        ['statement separator', () => 'SUM("cost"); DROP TABLE uploaded_data'],
        ['line comment', () => 'SUM("cost") -- x'],
        ['block comment', () => 'SUM("cost") /* x */'],
        ['empty string', () => '   '],
        ['non string', () => 5],
        ['oversized', () => 'x'.repeat(FORMULA_LIMITS.maxLeafSqlLength + 1)],
      ];
      for (const [label, compiler] of unsafe) {
        let thrown: unknown;
        try {
          compile(frozen, profile, compiler);
        } catch (error) {
          thrown = error;
        }
        expect([label, thrown instanceof BadRequestException]).toEqual([label, true]);
      }
    });
  });
});

describe('metric formula over real DuckDB', () => {
  let instance: any;
  let connection: any;

  const table = () =>
    'CREATE OR REPLACE TABLE uploaded_data AS SELECT * FROM (VALUES ' +
    "('A', 100.0, 90.0), ('B', 900.0, 10.0), ('C', 0.0, 5.0)" +
    ') t(company, revenue, cost)';
  const rows = async (sql: string) =>
    (await connection.runAndReadAll(sql)).getRowObjectsJson() as Array<Record<string, any>>;

  beforeAll(async () => {
    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
    await connection.run(table());
  });

  afterAll(() => {
    connection?.closeSync();
    instance?.closeSync();
  });

  const costRatio = () =>
    pin(ratio(leaf(1), leaf(2), 100), [
      operand(1, { column: 'cost' }),
      operand(2, { column: 'revenue' }),
    ]);

  it('reaggregates the ratio over the qualified rows instead of averaging group ratios', async () => {
    const frozen = costRatio();
    const compiled = compile(frozen);
    const overall = await rows('SELECT ' + compiled.sql + ' AS value FROM uploaded_data');
    expect(Number(overall[0].value)).toBeCloseTo(10.5, 10);
    const grouped = await rows(
      'SELECT "company", ' + compiled.sql + ' AS value FROM uploaded_data GROUP BY 1 ORDER BY 1',
    );
    expect(Number(grouped[0].value)).toBeCloseTo(90, 10);
    expect(Number(grouped[1].value)).toBeCloseTo((10 / 900) * 100, 10);
    // The zero-revenue group divides by NULLIF(..., 0) and yields NULL, not infinity.
    expect(grouped[2].value).toBeNull();
    const average = (Number(grouped[0].value) + Number(grouped[1].value)) / 2;
    expect(average).toBeCloseTo(45.5555555556, 9);
    expect(Number(overall[0].value)).not.toBeCloseTo(average, 6);
    expect(compiled.columns).toEqual(['cost', 'revenue']);
    expect(compiled.unit).toBe('%');
  });

  it('keeps negative results and an empty scope as SQL facts', async () => {
    const negative = compile(
      pin(subtract(leaf(1), leaf(2)), [operand(1, { column: 'cost' }), operand(2)]),
    );
    const grouped = await rows(
      'SELECT "company", ' + negative.sql + ' AS value FROM uploaded_data GROUP BY 1 ORDER BY 1',
    );
    expect(Number(grouped[0].value)).toBeCloseTo(-10, 10);
    const overall = await rows('SELECT ' + negative.sql + ' AS value FROM uploaded_data');
    expect(Number(overall[0].value)).toBeCloseTo(-895, 10);
    const empty = await rows(
      'SELECT COUNT(*) AS n, SUM("revenue") AS revenue, ' +
        negative.sql +
        ' AS value FROM uploaded_data WHERE false',
    );
    expect(Number(empty[0].n)).toBe(0);
    expect(empty[0].revenue).toBeNull();
    expect(empty[0].value).toBeNull();
  });
});

it('preserves and validates saved business bases on formula operands', () => {
  const basis = {
    schemaVersion: 1,
    catalogVersion: null,
    schemaRevision: businessSchemaRevision(profile),
    columns: [
      {
        column: 'revenue',
        nativeType: 'DOUBLE',
        label: 'Revenue',
        description: '',
        unit: 'USD',
        businessType: 'auto',
        dateFormat: '',
        classification: '',
      },
    ],
  };
  const operands = [operand(1, { businessBasis: basis }), operand(2, { column: 'cost' })];
  const formula = pinMetricFormula(
    { op: 'subtract', left: leaf(1), right: leaf(2) },
    operands,
    profile,
  );
  expect((formula.operands[0].definition as any).businessBasis).toEqual(basis);
  expect((formula.operands[0].definition as any).businessBasis).not.toBe(basis);
  const projected = {
    ...profile,
    columns: profile.columns.map(c => ({ ...c, nativeNumeric: c.numeric, numeric: false })),
  };
  expect(() =>
    pinMetricFormula({ op: 'subtract', left: leaf(1), right: leaf(2) }, operands, projected),
  ).not.toThrow();
  const categoryBasis = {
    ...basis,
    columns: basis.columns.map(c => ({ ...c, businessType: 'category' })),
  };
  expect(() =>
    pinMetricFormula(leaf(1), [operand(1, { businessBasis: categoryBasis })], profile),
  ).toThrow('numeric');

  expect(compileMetricFormula(formula, profile, metricExpression).sql).toContain('SUM("revenue")');
  const stale = { ...basis, schemaRevision: '0'.repeat(64) };
  expect(() =>
    pinMetricFormula(leaf(1), [operand(1, { businessBasis: stale })], profile),
  ).toThrow();
  expect(() =>
    pinMetricFormula(
      leaf(1),
      [operand(1, { businessBasis: { ...basis, sql: 'private SQL' } })],
      profile,
    ),
  ).toThrow();
  expect(() =>
    pinMetricFormula(leaf(1), [operand(1, { businessBasis: { ...basis, columns: [] } })], profile),
  ).toThrow();
});
