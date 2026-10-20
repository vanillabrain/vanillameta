import { BadRequestException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import {
  ConditionSemantics,
  projectConditionColumns,
  validateConditionSemantics,
} from './business-condition-semantics';
import {
  compileConditionDefinition,
  conditionColumns,
  conditionOperators,
} from './source-condition-definition';

const semantics = (columns: ConditionSemantics['columns']): ConditionSemantics => ({
  schemaVersion: 1,
  catalogVersion: 3,
  columns,
});
const declaration = (
  column: string,
  businessType: 'number' | 'category' | 'date',
  dateFormat: ConditionSemantics['columns'][number]['dateFormat'] = '',
) => ({ column, businessType, dateFormat });
const definition = (column: string, operator: string, values?: any[]) => ({
  include: { kind: 'predicate', column, operator, ...(values === undefined ? {} : { values }) },
  exclude: null,
});
const compile = (
  type: string,
  business: ConditionSemantics | undefined,
  operator: string,
  values?: any[],
) =>
  compileConditionDefinition(
    definition('c', operator, values),
    conditionColumns([{ name: 'c', type }], business),
    business,
  );
async function withDb(run: (connection: any) => Promise<void>) {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await run(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

describe('UC050 pinned business condition semantics structural kernel', () => {
  it('normalizes whole declarations in deterministic column order without mutating inputs', () => {
    const input = semantics([declaration('z', 'category'), declaration('a', 'date', 'YYYY/MM/DD')]);
    const before = JSON.stringify(input);
    const result = validateConditionSemantics(input);
    expect(result).toEqual(
      semantics([declaration('a', 'date', 'YYYY/MM/DD'), declaration('z', 'category')]),
    );
    expect(JSON.stringify(input)).toBe(before);
    result.columns[0].column = 'other';
    expect(input.columns[1].column).toBe('a');
    expect(validateConditionSemantics(semantics([]))).toEqual(semantics([]));
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { ...semantics([]), schemaVersion: 2 },
    { ...semantics([]), catalogVersion: 0 },
    { ...semantics([]), catalogVersion: 1.1 },
    { ...semantics([]), catalogVersion: '3' },
    { ...semantics([]), sql: 'SELECT secret' },
    semantics([declaration('c', 'date', '')]),
    semantics([declaration('c', 'number', 'native')]),
    semantics([declaration('c', 'date', 'native'), declaration('C', 'category')]),
    semantics([{ ...declaration('c', 'category'), businessType: 'auto' } as any]),
    semantics([{ ...declaration('c', 'date', 'native'), dateFormat: '%Y;DROP TABLE x' } as any]),
    semantics([{ ...declaration('c', 'number'), nativeType: 'DOUBLE' } as any]),
    semantics([declaration('', 'category')]),
    semantics([declaration('c\0secret', 'category')]),
  ])('fails closed on malformed/forged semantics: %j', input => {
    expect(() => validateConditionSemantics(input)).toThrow('Invalid condition semantics');
  });
  it('rejects sparse arrays, accessors, prototypes, invisible fields and size/count excess', () => {
    const accessor = semantics([]);
    Object.defineProperty(accessor, 'catalogVersion', {
      get: () => {
        throw new Error('private');
      },
      enumerable: true,
    });
    const hidden = semantics([]);
    Object.defineProperty(hidden, 'private', { value: 'secret' });
    const inherited = Object.assign(Object.create({ private: 'secret' }), semantics([]));
    const sparse = semantics(new Array(1));
    for (const input of [
      accessor,
      hidden,
      inherited,
      sparse,
      semantics(Array.from({ length: 129 }, (_, i) => declaration(String(i), 'category'))),
      semantics([declaration('가'.repeat(12000), 'category')]),
    ])
      expect(() => validateConditionSemantics(input)).toThrow(BadRequestException);
  });
  it('projects declared behavior without replacing native types or inferring undeclared columns', () => {
    const schema = [
      { name: 'n', type: 'DECIMAL(38,18)' },
      { name: 'd', type: 'VARCHAR' },
      { name: 't', type: 'TIMESTAMP_NS' },
    ];
    const pinned = semantics([declaration('n', 'category'), declaration('d', 'date', 'YYYYMMDD')]);
    expect(projectConditionColumns(schema, pinned)).toEqual([
      {
        name: 'n',
        type: 'DECIMAL(38,18)',
        kind: 'number',
        businessType: 'category',
        dateFormat: '',
      },
      { name: 'd', type: 'VARCHAR', kind: 'date', businessType: 'date', dateFormat: 'YYYYMMDD' },
      { name: 't', type: 'TIMESTAMP_NS', kind: 'timestamp' },
    ]);
    expect(conditionColumns(schema)).toEqual(
      schema.map((column, index) => ({
        ...column,
        kind: ['number', 'string', 'timestamp'][index],
      })),
    );
  });
  it.each([
    ['VARCHAR', declaration('c', 'number')],
    ['DOUBLE', declaration('c', 'date', 'native')],
    ['VARCHAR', declaration('c', 'date', 'native')],
    ['TIMESTAMP', declaration('c', 'date', 'YYYY-MM-DD')],
    ['BLOB', declaration('c', 'category')],
    ['INTEGER[]', declaration('c', 'category')],
  ] as const)('rejects incompatible native %s declarations', (type, item) => {
    expect(() => conditionColumns([{ name: 'c', type }], semantics([item]))).toThrow(
      BadRequestException,
    );
  });
  it('rejects missing/case-mismatched declarations and duplicate native identifiers', () => {
    const pinned = semantics([declaration('c', 'category')]);
    expect(() => conditionColumns([{ name: 'C', type: 'VARCHAR' }], pinned)).toThrow(
      BadRequestException,
    );
    expect(() =>
      conditionColumns(
        [
          { name: 'c', type: 'VARCHAR' },
          { name: 'C', type: 'VARCHAR' },
        ],
        pinned,
      ),
    ).toThrow(BadRequestException);
  });
  it.each(['gt', 'gte', 'lt', 'lte', 'between', 'contains'])(
    'restricts category operator %s on native numeric/string/date values',
    operator => {
      for (const type of ['DECIMAL(38,18)', 'VARCHAR', 'DATE', 'TIMESTAMP_NS']) {
        expect(() =>
          compile(type, semantics([declaration('c', 'category')]), operator, [1, 2]),
        ).toThrow(BadRequestException);
      }
    },
  );
  it('shares category operators while preserving typed values and rejecting silent semantics loss', () => {
    const pinned = semantics([declaration('c', 'category')]);
    const columns = conditionColumns([{ name: 'c', type: 'BIGINT' }], pinned);
    expect(conditionOperators(columns[0])).toEqual([
      'eq',
      'ne',
      'in',
      'notIn',
      'isNull',
      'isNotNull',
    ]);
    expect(compile('BIGINT', pinned, 'eq', [1]).bindings).toEqual(['1']);
    expect(() => compile('BIGINT', pinned, 'eq', ['1'])).toThrow(BadRequestException);
    expect(() => compileConditionDefinition(definition('c', 'gt', [1]), columns)).toThrow(
      BadRequestException,
    );
    expect(() =>
      compileConditionDefinition(
        definition('c', 'eq', [1]),
        [{ name: 'c', type: 'VARCHAR', kind: 'number' }],
        pinned,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      compile('VARCHAR', semantics([declaration('c', 'date', 'YYYY-MM-DD')]), 'eq', ['2024-02-30']),
    ).toThrow(BadRequestException);
  });
  it('accepts raw native columns or projected columns only with the explicit pinned snapshot', () => {
    const pinned = semantics([declaration('c', 'date', 'YYYY/MM/DD')]);
    const native = conditionColumns([{ name: 'c', type: 'VARCHAR' }]);
    expect(
      compileConditionDefinition(definition('c', 'eq', ['2024-02-29']), native, pinned),
    ).toEqual(compile('VARCHAR', pinned, 'eq', ['2024-02-29']));
    expect(() => compile('VARCHAR', pinned, 'contains', ['2024'])).toThrow(BadRequestException);
  });
});

describe('UC050 business semantics actual DuckDB execution', () => {
  it.each([
    ['YYYY-MM-DD', '2024-02-29', '2024-03-01'],
    ['YYYY/MM/DD', '2024/02/29', '2024/03/01'],
    ['YYYYMMDD', '20240229', '20240301'],
  ] as const)(
    'executes fixed %s dates with ISO thresholds, leap days, NULL and exclusion',
    async (format, leap, next) => {
      await withDb(async connection => {
        await connection.run('CREATE TABLE source(c VARCHAR)');
        for (const value of [null, leap, next])
          await connection.run('INSERT INTO source VALUES (?)', [value]);
        const pinned = semantics([declaration('c', 'date', format)]);
        const compiled = compileConditionDefinition(
          {
            include: definition('c', 'between', ['2024-02-29', '2024-03-01']).include,
            exclude: definition('c', 'eq', ['2024-03-01']).include,
          },
          conditionColumns([{ name: 'c', type: 'VARCHAR' }], pinned),
          pinned,
        );
        const rows = await connection.runAndReadAll(
          `SELECT c FROM source WHERE ${compiled.includeSql} AND NOT ${compiled.excludeSql}`,
          compiled.bindings,
        );
        expect(rows.getRowObjects()).toEqual([{ c: leap }]);
        const nulls = compile('VARCHAR', pinned, 'isNull');
        expect(
          (
            await connection.runAndReadAll(
              `SELECT c FROM source WHERE ${nulls.includeSql}`,
              nulls.bindings,
            )
          ).getRowObjects(),
        ).toEqual([{ c: null }]);
        expect(
          (
            await connection.runAndReadAll('SELECT c FROM source ORDER BY c NULLS FIRST')
          ).getRowObjects(),
        ).toEqual([{ c: null }, { c: leap }, { c: next }]);
      });
    },
  );
  it.each([
    '',
    ' ',
    '2024/02/30',
    '2023/02/29',
    '0000/01/01',
    '2024/2/29',
    '2024-02-29',
    "2024/02/29');DROP TABLE source;--",
  ])('rejects invalid/blank source date rather than treating it as NULL: %j', async value => {
    await withDb(async connection => {
      const compiled = compile(
        'VARCHAR',
        semantics([declaration('c', 'date', 'YYYY/MM/DD')]),
        'isNull',
      );
      await expect(
        connection.runAndReadAll(
          `SELECT ${compiled.includeSql} AS matched FROM (SELECT CAST(? AS VARCHAR) AS c)`,
          [value],
        ),
      ).rejects.toThrow('Invalid business date');
    });
  });
  it.each(['TIMESTAMP', 'TIMESTAMP_NS', 'TIMESTAMPTZ'])(
    'executes declared native %s as UTC civil DATE in all session zones',
    async type => {
      await withDb(async connection => {
        const pinned = semantics([declaration('c', 'date', 'native')]);
        const compiled = compile(type, pinned, 'eq', ['2024-02-29']);
        for (const zone of ['UTC', 'Asia/Seoul', 'America/New_York']) {
          await connection.run(`SET TimeZone = '${zone}'`);
          const literal =
            type === 'TIMESTAMPTZ'
              ? "TIMESTAMPTZ '2024-03-01 00:30:00+09'"
              : `CAST('2024-02-29 15:30:00.000000001' AS ${type})`;
          expect(
            (
              await connection.runAndReadAll(
                `SELECT ${compiled.includeSql} AS matched FROM (SELECT ${literal} AS c)`,
                compiled.bindings,
              )
            ).getRowObjects(),
          ).toEqual([{ matched: true }]);
        }
      });
    },
  );
  it('keeps category DECIMAL(38,18) equality exact without rounding to DOUBLE', async () => {
    await withDb(async connection => {
      const compiled = compile('DECIMAL(38,18)', semantics([declaration('c', 'category')]), 'eq', [
        0.1,
      ]);
      const result = await connection.runAndReadAll(
        `SELECT ${compiled.includeSql} AS matched FROM (VALUES (CAST('0.100000000000000000' AS DECIMAL(38,18))), (CAST('0.100000000000000001' AS DECIMAL(38,18)))) source(c)`,
        compiled.bindings,
      );
      expect(result.getRowObjects()).toEqual([{ matched: true }, { matched: false }]);
    });
  });
  it('keeps undeclared/category nanosecond timestamps exact while explicit date drops the time only intentionally', async () => {
    await withDb(async connection => {
      for (const pinned of [undefined, semantics([declaration('c', 'category')])]) {
        const compiled = compile('TIMESTAMP_NS', pinned, 'eq', ['2024-01-01T00:00:00.000000001Z']);
        const result = await connection.runAndReadAll(
          `SELECT ${compiled.includeSql} AS matched FROM (VALUES (TIMESTAMP_NS '2024-01-01 00:00:00.000000001'), (TIMESTAMP_NS '2024-01-01 00:00:00.000000002')) source(c)`,
          compiled.bindings,
        );
        expect(result.getRowObjects()).toEqual([{ matched: true }, { matched: false }]);
      }
    });
  });
  it('quotes odd identifiers, binds injection text, and leaves the source table intact', async () => {
    await withDb(async connection => {
      const name = 'odd"; DROP TABLE source;--';
      const pinned = semantics([declaration(name, 'category')]);
      const value = "x'); DROP TABLE source;--";
      const compiled = compileConditionDefinition(
        definition(name, 'eq', [value]),
        conditionColumns([{ name, type: 'VARCHAR' }], pinned),
        pinned,
      );
      await connection.run(`CREATE TABLE source("${name.replace(/"/g, '""')}" VARCHAR)`);
      await connection.run('INSERT INTO source VALUES (?)', [value]);
      expect(
        (
          await connection.runAndReadAll(
            `SELECT count(*) AS n FROM source WHERE ${compiled.includeSql}`,
            compiled.bindings,
          )
        ).getRowObjects(),
      ).toEqual([{ n: BigInt(1) }]);
      expect(compiled.includeSql).not.toContain(value);
      expect(
        (await connection.runAndReadAll('SELECT count(*) AS n FROM source')).getRowObjects(),
      ).toEqual([{ n: BigInt(1) }]);
    });
  });
});
