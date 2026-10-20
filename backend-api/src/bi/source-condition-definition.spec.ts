import { BadRequestException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import {
  conditionColumns,
  compileConditionDefinition,
  ConditionDefinition,
  ConditionNode,
} from './source-condition-definition';

const schema = [
  { name: 'n', type: 'DOUBLE' },
  { name: 'text', type: 'VARCHAR' },
  { name: 'flag', type: 'BOOLEAN' },
  { name: 'day', type: 'DATE' },
  { name: 'instant', type: 'TIMESTAMP' },
  { name: 'blob', type: 'BLOB' },
  { name: 'odd"; --', type: 'VARCHAR' },
];
const p = (column: string, operator: string, values?: any[]): ConditionNode => ({
  kind: 'predicate',
  column,
  operator: operator as any,
  ...(values === undefined ? {} : { values }),
});
const g = (operator: 'and' | 'or', ...children: ConditionNode[]): ConditionNode => ({
  kind: 'group',
  operator,
  children,
});
const def = (
  include: ConditionNode = null,
  exclude: ConditionNode = null,
): ConditionDefinition => ({ include, exclude });
const compile = (input: unknown) => compileConditionDefinition(input, conditionColumns(schema));
const reject = (input: unknown) => {
  try {
    compile(input);
    throw new Error('Accepted invalid condition');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('Invalid condition definition');
  }
};

describe('UC052 pure condition validation', () => {
  it('compiles absent trees as all included and none excluded', () => {
    expect(compile(def())).toEqual({
      definition: def(),
      includeSql: 'TRUE',
      excludeSql: 'FALSE',
      bindings: [],
    });
  });
  it.each([
    ['TINYINT', 'number'],
    ['UTINYINT', 'number'],
    ['SMALLINT', 'number'],
    ['USMALLINT', 'number'],
    ['INTEGER', 'number'],
    ['UINTEGER', 'number'],
    ['BIGINT', 'number'],
    ['UBIGINT', 'number'],
    ['HUGEINT', 'number'],
    ['UHUGEINT', 'number'],
    ['FLOAT', 'number'],
    ['DOUBLE', 'number'],
    ['DECIMAL(18,2)', 'number'],
    ['VARCHAR', 'string'],
    ['BOOLEAN', 'boolean'],
    ['DATE', 'date'],
    ['TIMESTAMP', 'timestamp'],
    ['TIMESTAMP_S', 'timestamp'],
    ['TIMESTAMP_MS', 'timestamp'],
    ['TIMESTAMP_NS', 'timestamp'],
    ['TIMESTAMP WITH TIME ZONE', 'timestamp'],
    ['TIMESTAMPTZ', 'timestamp'],
    ['INTEGER[]', 'unsupported'],
    ['INTEGER[3]', 'unsupported'],
    ['STRUCT(a INTEGER)', 'unsupported'],
    ['MAP(VARCHAR, INTEGER)', 'unsupported'],
    ['BLOB', 'unsupported'],
    ['INTERVAL', 'unsupported'],
    ['UUID', 'unsupported'],
    ['TIME', 'unsupported'],
    ['number', 'unsupported'],
    ['DECIMAL(no)', 'unsupported'],
  ])('classifies native %s as %s without business-type inference', (type, kind) => {
    expect(conditionColumns([{ name: 'c', type }])).toEqual([{ name: 'c', type, kind }]);
  });
  it('binds nested inclusion then exclusion once, keeping input independent', () => {
    const input = def(
      g(
        'or',
        p('n', 'between', [0, 10]),
        g('and', p('text', 'contains', ['%_']), p('flag', 'eq', [true])),
      ),
      p('text', 'in', ["x' OR 1=1 --", 'end']),
    );
    const result = compile(input);
    expect(result.definition).toEqual(input);
    expect(result.bindings).toEqual([0, 10, '%_', true, "x' OR 1=1 --", 'end']);
    expect((result.includeSql + result.excludeSql).match(/\?/g)).toHaveLength(6);
    expect(result.includeSql).toContain('strpos(');
    expect(result.excludeSql).not.toContain("x' OR");
    (input.include as any).children[0].values[0] = 999;
    expect(result.bindings[0]).toBe(0);
    expect((result.definition.include as any).children[0].values[0]).toBe(0);
  });
  it.each(['isNull', 'isNotNull'])('permits unsupported-type %s without values', operator => {
    expect(compile(def(p('blob', operator))).bindings).toEqual([]);
    reject(def(p('blob', operator, [])));
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { include: null },
    { include: null, exclude: null, sql: 'secret' },
    def({ kind: 'group', operator: 'and', children: [] }),
    def({ kind: 'group', operator: 'xor', children: [p('n', 'eq', [1])] } as any),
    def({ ...p('n', 'eq', [1]), sql: 'secret' } as any),
    def(p('N', 'eq', [1])),
    def(p('missing', 'eq', [1])),
    def(p('n', 'eq', ['1'])),
    def(p('n', 'eq', [true])),
    def(p('n', 'eq', [NaN])),
    def(p('n', 'eq', [Infinity])),
    def(p('n', 'eq', [Number.MAX_SAFE_INTEGER + 1])),
    def(p('n', 'eq', [1, 2])),
    def(p('n', 'in', [])),
    def(p('n', 'in', [null])),
    def(p('n', 'eq')),
    def(p('n', 'between', [2, 1])),
    def(p('text', 'gt', ['a'])),
    def(p('text', 'between', ['a', 'z'])),
    def(p('flag', 'lt', [true])),
    def(p('flag', 'eq', [1])),
    def(p('blob', 'eq', ['bytes'])),
    def(p('n', 'contains', [1])),
    def(p('n', 'IS NULL')),
    def(p('text', 'eq', ['x'.repeat(2001)])),
    def(p('n', 'in', Array(51).fill(1))),
  ])('rejects malformed input %# without reflecting values or SQL', input => reject(input));
  it.each([
    '2025-02-29',
    '2024-02-30',
    '2024-04-31',
    '2024-13-01',
    '2024-00-01',
    '2024-01-00',
    '24-01-01',
    '2024-1-01',
    '2024-01-01T00:00:00Z',
    '0000-01-01',
  ])('rejects invalid native date %s', value => reject(def(p('day', 'eq', [value]))));
  it.each([
    '2024-02-30T00:00:00Z',
    '2024-01-01T24:00:00Z',
    '2024-01-01T00:60:00Z',
    '2024-01-01T00:00:60Z',
    '2024-01-01T00:00Z',
    '2024-01-01T00:00:00+00:00',
    '2024-01-01 00:00:00Z',
    '2024-01-01T00:00:00',
    '2024-01-01T00:00:00.Z',
  ])('rejects rollover/non-UTC timestamp %s', value => reject(def(p('instant', 'eq', [value]))));
  it('compares fractional instants precisely and calendar dates in order', () => {
    const compile = (input: unknown) =>
      compileConditionDefinition(
        input,
        conditionColumns([{ name: 'instant', type: 'TIMESTAMP_NS' }]),
      );
    expect(
      compile(
        def(
          p('instant', 'between', [
            '2024-02-29T00:00:00.000000001Z',
            '2024-02-29T00:00:00.000000002Z',
          ]),
        ),
      ).bindings,
    ).toHaveLength(2);
    expect(() =>
      compile(
        def(
          p('instant', 'between', [
            '2024-02-29T00:00:00.000000002Z',
            '2024-02-29T00:00:00.000000001Z',
          ]),
        ),
      ),
    ).toThrow(BadRequestException);
    reject(def(p('day', 'between', ['2024-03-01', '2024-02-29'])));
  });
  it('enforces four group levels, eight children, and 32 nodes across both trees', () => {
    let node = p('n', 'eq', [1]);
    for (let i = 0; i < 4; i++) node = g('and', node);
    expect(compile(def(node)).bindings).toEqual([1]);
    reject(def(g('and', node)));
    reject(def(g('or', ...Array(9).fill(p('n', 'eq', [1])))));
    const branch = () => g('and', ...Array.from({ length: 7 }, () => p('n', 'eq', [1])));
    const fifteen = () => g('or', branch(), ...Array.from({ length: 6 }, () => p('n', 'eq', [1])));
    expect(compile(def(g('and', fifteen()), g('and', fifteen()))).bindings).toHaveLength(26);
    reject(def(g('and', fifteen(), p('n', 'eq', [1])), g('and', fifteen())));
  });
  it('accepts boundary values but rejects serialized UTF8 bodies over 32KiB', () => {
    expect(compile(def(p('text', 'eq', ['x'.repeat(2000)]))).bindings[0]).toHaveLength(2000);
    expect(compile(def(p('n', 'in', Array(50).fill(0)))).bindings).toHaveLength(50);
    reject(def(p('text', 'in', Array(6).fill('한'.repeat(2000)))));
  });
  it('rejects prototypes, accessors, symbols, sparse/custom arrays and cycles without invoking them', () => {
    reject(Object.assign(Object.create({ inherited: true }), def()));
    reject({ ...def(), [Symbol('hidden')]: true });
    const getter = jest.fn(() => null);
    reject(Object.defineProperty({ exclude: null }, 'include', { enumerable: true, get: getter }));
    expect(getter).not.toHaveBeenCalled();
    reject(def(p('n', 'in', new Array(2))));
    const values = [1];
    Object.assign(values, { extra: true });
    reject(def(p('n', 'in', values)));
    const node = g('and');
    (node as any).children.push(node);
    reject(def(node));
    reject({ ...def(), toJSON: () => def() });
  });
  it('requires an exact unique schema name and consistent native kind', () => {
    for (const columns of [
      [{ name: 'n', type: 'DOUBLE', kind: 'string' }],
      [
        { name: 'n', type: 'DOUBLE', kind: 'number' },
        { name: 'n', type: 'DOUBLE', kind: 'number' },
      ],
      [
        { name: 'n', type: 'DOUBLE', kind: 'number' },
        { name: 'N', type: 'DOUBLE', kind: 'number' },
      ],
    ])
      expect(() => compileConditionDefinition(def(p('n', 'eq', [1])), columns as any)).toThrow(
        BadRequestException,
      );
  });
});

// Independent row evaluator: no compiler SQL, normalization or validators used.
function matches(node: ConditionNode, row: Record<string, any>, absent: boolean): boolean {
  if (node === null) return absent;
  if (node.kind === 'group')
    return node.operator === 'and'
      ? node.children.every(child => matches(child, row, false))
      : node.children.some(child => matches(child, row, false));
  const value = row[node.column];
  if (node.operator === 'isNull') return value === null;
  if (node.operator === 'isNotNull') return value !== null;
  if (value === null) return false;
  const values = node.values;
  switch (node.operator) {
    case 'eq':
      return value === values[0];
    case 'ne':
      return value !== values[0];
    case 'in':
      return values.includes(value);
    case 'notIn':
      return !values.includes(value);
    case 'contains':
      return value.includes(values[0]);
    case 'gt':
      return value > values[0];
    case 'gte':
      return value >= values[0];
    case 'lt':
      return value < values[0];
    case 'lte':
      return value <= values[0];
    case 'between':
      return value >= values[0] && value <= values[1];
    default:
      throw new Error('Unknown test oracle operator');
  }
}

describe('UC052 actual DuckDB and independent row oracle', () => {
  let worker: DuckDBService;
  let root: string;
  let filename: string;
  const previousDirectory = process.env.FILE_UPLOAD_DIR;
  const rows = [
    {
      n: 0,
      text: 'literal %_ token',
      flag: true,
      day: '2024-02-29',
      instant: '2024-02-29T01:02:03Z',
      'odd"; --': "x' OR 1=1 --",
    },
    {
      n: 10.5,
      text: 'alpha',
      flag: false,
      day: '2024-03-01',
      instant: '2024-03-01T00:00:00Z',
      'odd"; --': 'safe',
    },
    {
      n: -2,
      text: 'ALPHA',
      flag: true,
      day: '2024-01-01',
      instant: '2024-01-01T00:00:00Z',
      'odd"; --': 'safe',
    },
    { n: null, text: null, flag: null, day: null, instant: null, 'odd"; --': null },
    {
      n: 5,
      text: '',
      flag: false,
      day: '2024-02-29',
      instant: '2024-02-29T12:00:00Z',
      'odd"; --': 'safe',
    },
  ];
  let nativeColumns: ReturnType<typeof conditionColumns>;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc052-definition-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    filename = (
      await worker.importFile({
        originalname: 'conditions.json',
        buffer: Buffer.from(JSON.stringify(rows)),
      })
    ).filename;
    // Imports sanitize column names. Restore an adversarial identifier only in this owned fixture.
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_WRITE' });
    const connection = await instance.connect();
    try {
      const importedSchema = (
        await connection.runAndReadAll('DESCRIBE uploaded_data')
      ).getRowObjects();
      const oddName = String(
        importedSchema.find(column => String(column.column_name).startsWith('odd')).column_name,
      );
      await connection.run(
        `ALTER TABLE uploaded_data RENAME COLUMN "${oddName.replace(/"/g, '""')}" TO "odd""; --"`,
      );
      await connection.run('ALTER TABLE uploaded_data ALTER COLUMN day TYPE DATE');
      await connection.run('ALTER TABLE uploaded_data ALTER COLUMN instant TYPE TIMESTAMP');
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
    const described = await worker.query(filename, 'DESCRIBE SELECT * FROM uploaded_data');
    nativeColumns = conditionColumns(
      described.datas.map((column: any) => ({
        name: column.column_name,
        type: column.column_type,
      })),
    );
  });
  afterAll(async () => {
    if (worker) await worker.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousDirectory === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousDirectory;
  });
  const cases = [
    def(),
    def(
      g(
        'and',
        p('n', 'gte', [0]),
        g('or', p('text', 'contains', ['%_']), p('flag', 'eq', [false])),
      ),
      p('n', 'gt', [8]),
    ),
    def(
      g('or', p('n', 'isNull'), p('n', 'between', [-2, 5])),
      g('and', p('text', 'isNotNull'), p('text', 'notIn', [''])),
    ),
    def(p('text', 'ne', ['alpha']), p('flag', 'in', [true])),
    def(
      p('day', 'between', ['2024-02-29', '2024-03-01']),
      p('instant', 'gte', ['2024-03-01T00:00:00Z']),
    ),
    def(p('instant', 'lt', ['2024-03-01T00:00:00Z']), p('day', 'eq', ['2024-01-01'])),
    def(p('odd"; --', 'in', ["x' OR 1=1 --"])),
    def(p('n', 'in', [0, 5, 10.5]), p('text', 'eq', [''])),
    def(p('n', 'lte', [-2]), p('n', 'notIn', [0])),
    def(p('n', 'gt', [100])),
    def(null, p('text', 'contains', [''])),
  ];
  it.each(cases.map((definition, index) => [index, definition] as const))(
    'matches oracle count partition for case %s',
    async (_index, definition) => {
      const compiled = compileConditionDefinition(definition, nativeColumns);
      const included = rows.filter(row => matches(definition.include, row, true));
      const excluded = included.filter(row => matches(definition.exclude, row, false));
      const sql = `WITH flags AS (
        SELECT ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM uploaded_data
      ) SELECT count(*) AS total, count(*) FILTER (WHERE inc) AS included,
        count(*) FILTER (WHERE inc AND exc) AS excluded,
        count(*) FILTER (WHERE inc AND NOT exc) AS final FROM flags`;
      let datas: any[];
      if (_index === 6) {
        // Service rejects every semicolon, even inside a quoted identifier.
        // Test escaping directly against the owned imported fixture instead.
        const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_ONLY' });
        const connection = await instance.connect();
        try {
          const result = await connection.runAndReadAll(sql, compiled.bindings);
          datas = result
            .getRowObjects()
            .map(row =>
              Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])),
            );
        } finally {
          connection.closeSync();
          instance.closeSync();
        }
      } else datas = (await worker.query(filename, sql, compiled.bindings)).datas;
      expect(datas).toEqual([
        {
          total: 5,
          included: included.length,
          excluded: excluded.length,
          final: included.length - excluded.length,
        },
      ]);
    },
  );
  it('identifies actual native DATE/TIMESTAMP and casts bindings explicitly', async () => {
    const typed = await worker.query(
      filename,
      'DESCRIBE SELECT CAST(day AS DATE) AS day, CAST(instant AS TIMESTAMP) AS instant FROM uploaded_data',
    );
    const columns = conditionColumns(
      typed.datas.map((column: any) => ({ name: column.column_name, type: column.column_type })),
    );
    expect(columns.map(column => column.kind)).toEqual(['date', 'timestamp']);
    const compiled = compileConditionDefinition(
      def(p('day', 'eq', ['2024-02-29']), p('instant', 'gt', ['2024-02-29T10:00:00.000Z'])),
      columns,
    );
    const result = await worker.query(
      filename,
      `WITH typed AS (SELECT CAST(day AS DATE) AS day, CAST(instant AS TIMESTAMP) AS instant FROM uploaded_data),
      flags AS (SELECT ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM typed)
      SELECT count(*) FILTER (WHERE inc AND NOT exc) AS n FROM flags`,
      compiled.bindings,
    );
    expect(result.datas).toEqual([{ n: 1 }]);
    expect(compiled.includeSql).toContain('CAST(? AS DATE)');
    expect(compiled.excludeSql).toContain(`("instant" AT TIME ZONE 'UTC')`);
    expect(compiled.excludeSql).toContain('CAST(? AS TIMESTAMPTZ)');
  });
  it.each([
    'TIMESTAMP',
    'TIMESTAMP_S',
    'TIMESTAMP_MS',
    'TIMESTAMP_NS',
    'TIMESTAMP WITH TIME ZONE',
    'TIMESTAMPTZ',
  ])('keeps native %s instants identical in UTC and Asia/Seoul sessions', async type => {
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_ONLY' });
    const connection = await instance.connect();
    try {
      const zoned = type.includes('ZONE') || type === 'TIMESTAMPTZ';
      const source = zoned ? `(instant AT TIME ZONE 'UTC')` : 'instant';
      const compiled = compileConditionDefinition(
        def(
          p('instant', 'eq', ['2024-02-29T01:02:03Z']),
          p('instant', 'lt', ['2024-02-29T01:00:00Z']),
        ),
        conditionColumns([{ name: 'instant', type }]),
      );
      for (const timezone of ['UTC', 'Asia/Seoul']) {
        await connection.run(`SET TimeZone = '${timezone}'`);
        const result = await connection.runAndReadAll(
          `WITH typed AS (
            SELECT CAST(${source} AS ${type}) AS instant FROM uploaded_data
          ), flags AS (SELECT ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM typed)
          SELECT count(*) FILTER (WHERE inc) AS included,
            count(*) FILTER (WHERE inc AND NOT exc) AS final FROM flags`,
          compiled.bindings,
        );
        expect(result.getRowObjects()).toEqual([{ included: BigInt(1), final: BigInt(1) }]);
      }
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
  it('preserves nanosecond precision for native TIMESTAMP_NS in both session timezones', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const columns = conditionColumns([{ name: 'instant', type: 'TIMESTAMP_NS' }]);
      const cases: Array<[ConditionDefinition, number[]]> = [
        [def(p('instant', 'eq', ['2024-01-01T00:00:00.000000001Z'])), [1]],
        [def(p('instant', 'ne', ['2024-01-01T00:00:00.000000001Z'])), [0, 2]],
        [def(p('instant', 'gt', ['2024-01-01T00:00:00Z'])), [1, 2]],
        [def(p('instant', 'gte', ['2024-01-01T00:00:00.000000001Z'])), [1, 2]],
        [def(p('instant', 'lt', ['2024-01-01T00:00:00.000000002Z'])), [0, 1]],
        [def(p('instant', 'lte', ['2024-01-01T00:00:00.000000001Z'])), [0, 1]],
        [def(p('instant', 'in', ['2024-01-01T00:00:00.000000001Z'])), [1]],
        [def(p('instant', 'notIn', ['2024-01-01T00:00:00.000000001Z'])), [0, 2]],
        [
          def(
            p('instant', 'between', [
              '2024-01-01T00:00:00.000000001Z',
              '2024-01-01T00:00:00.000000002Z',
            ]),
          ),
          [1, 2],
        ],
        [
          def(
            p('instant', 'gte', ['2024-01-01T00:00:00.000000001Z']),
            p('instant', 'eq', ['2024-01-01T00:00:00.000000001Z']),
          ),
          [2],
        ],
      ];
      for (const timezone of ['UTC', 'Asia/Seoul']) {
        await connection.run(`SET TimeZone = '${timezone}'`);
        for (const [definition, ids] of cases) {
          const compiled = compileConditionDefinition(definition, columns);
          const result = await connection.runAndReadAll(
            `WITH uploaded_data AS (
            SELECT 0 AS id, TIMESTAMP_NS '2024-01-01 00:00:00' AS instant UNION ALL
            SELECT 1, TIMESTAMP_NS '2024-01-01 00:00:00.000000001' UNION ALL
            SELECT 2, TIMESTAMP_NS '2024-01-01 00:00:00.000000002' UNION ALL
            SELECT 3, NULL
          ), flags AS (SELECT id, ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM uploaded_data)
          SELECT id FROM flags WHERE inc AND NOT exc ORDER BY id`,
            compiled.bindings,
          );
          expect(result.getRowObjects().map(row => row.id)).toEqual(ids);
        }
      }
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
  it('executes finite TIMESTAMP_NS epoch boundaries and pre-epoch fractions in both timezones', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const columns = conditionColumns([{ name: 'instant', type: 'TIMESTAMP_NS' }]);
      const boundaries = [
        ['1677-09-21T00:12:43.145224194Z', '-9223372036854775806'],
        ['2262-04-11T23:47:16.854775806Z', '9223372036854775806'],
        ['1969-12-31T23:59:59.999999999Z', '-1'],
        ['1970-01-01T00:00:00Z', '0'],
      ];
      for (const timezone of ['UTC', 'Asia/Seoul']) {
        await connection.run(`SET TimeZone = '${timezone}'`);
        for (const [boundary, nanos] of boundaries) {
          const compiled = compileConditionDefinition(def(p('instant', 'eq', [boundary])), columns);
          const result = await connection.runAndReadAll(
            `WITH uploaded_data AS (
            SELECT make_timestamp_ns(CAST(? AS BIGINT)) AS instant
          ) SELECT isfinite(instant) AS finite, epoch_ns(instant)::VARCHAR AS nanos,
            ${compiled.includeSql} AS included FROM uploaded_data`,
            [nanos, ...compiled.bindings],
          );
          expect(result.getRowObjects()).toEqual([{ finite: true, nanos, included: true }]);
          expect(compiled.bindings).toEqual([nanos]);
          expect((compiled.definition.include as any).values).toEqual([boundary]);
        }
      }
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
  it.each([
    '0001-01-01T00:00:00Z',
    '9999-12-31T23:59:59.999999999Z',
    '1677-09-21T00:12:43.145224192Z',
    '1677-09-21T00:12:43.145224193Z',
    '2262-04-11T23:47:16.854775807Z',
    '2262-04-11T23:47:16.854775808Z',
  ])(
    'rejects out-of-range or reserved TIMESTAMP_NS boundary %s at pure compile before save',
    boundary => {
      const columns = conditionColumns([{ name: 'instant', type: 'TIMESTAMP_NS' }]);
      for (const operator of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'between']) {
        const predicate = p(
          'instant',
          operator,
          operator === 'between' ? [boundary, boundary] : [boundary],
        );
        for (const definition of [def(predicate), def(null, predicate)]) {
          try {
            compileConditionDefinition(definition, columns);
            throw new Error('Pure compile admitted an unexecutable condition to persistence');
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect(error.getStatus()).toBe(400);
            expect(error.message).toBe('Invalid condition definition');
          }
        }
      }
    },
  );
  it.each(['TIMESTAMP', 'TIMESTAMP_S', 'TIMESTAMP_MS', 'TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE'])(
    'rejects nonzero precision beyond microseconds for %s',
    type => {
      const columns = conditionColumns([{ name: 'instant', type }]);
      for (const operator of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'between']) {
        const values =
          operator === 'between'
            ? ['2024-01-01T00:00:00Z', '2024-01-01T00:00:00.000000001Z']
            : ['2024-01-01T00:00:00.000000001Z'];
        expect(() =>
          compileConditionDefinition(def(p('instant', operator, values)), columns),
        ).toThrow(BadRequestException);
        expect(() =>
          compileConditionDefinition(def(null, p('instant', operator, values)), columns),
        ).toThrow(BadRequestException);
      }
      expect(
        compileConditionDefinition(
          def(p('instant', 'gte', ['2024-01-01T00:00:00.123456000Z'])),
          columns,
        ).bindings,
      ).toEqual(['2024-01-01T00:00:00.123456Z']);
    },
  );
  it('keeps native DECIMAL comparisons exact instead of promoting source values to DOUBLE', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const columns = conditionColumns([{ name: 'n', type: 'DECIMAL(38,18)' }]);
      const cases: Array<[ConditionDefinition, number[]]> = [
        [def(p('n', 'eq', [1])), [0]],
        [def(p('n', 'gt', [1])), [1, 2]],
        [def(p('n', 'between', [1, 1])), [0]],
        [def(p('n', 'in', [1])), [0]],
        [def(null, p('n', 'eq', [1])), [1, 2, 3]],
      ];
      for (const [definition, ids] of cases) {
        const compiled = compileConditionDefinition(definition, columns);
        const result = await connection.runAndReadAll(
          `WITH uploaded_data AS (
          SELECT 0 AS id, CAST('1' AS DECIMAL(38,18)) AS n UNION ALL
          SELECT 1, CAST('1.000000000000000001' AS DECIMAL(38,18)) UNION ALL
          SELECT 2, CAST('9007199254740993' AS DECIMAL(38,18)) UNION ALL SELECT 3, NULL
        ), flags AS (SELECT id, ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM uploaded_data)
        SELECT id FROM flags WHERE inc AND NOT exc ORDER BY id`,
          compiled.bindings,
        );
        expect(result.getRowObjects().map(row => row.id)).toEqual(ids);
      }
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
  it('keeps fractional DECIMAL precision when a JS number would bind as DOUBLE', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      const compiled = compileConditionDefinition(
        def(p('n', 'eq', [1.5])),
        conditionColumns([{ name: 'n', type: 'DECIMAL(38,18)' }]),
      );
      const result = await connection.runAndReadAll(
        `WITH uploaded_data AS (
        SELECT CAST('1.500000000000000001' AS DECIMAL(38,18)) AS n
      ) SELECT ${compiled.includeSql} AS included FROM uploaded_data`,
        compiled.bindings,
      );
      expect(result.getRowObjects()).toEqual([{ included: false }]);
      const fractional = compileConditionDefinition(
        def(p('n', 'gt', [1.5])),
        conditionColumns([{ name: 'n', type: 'DECIMAL(18,0)' }]),
      );
      const ordered = await connection.runAndReadAll(
        `WITH uploaded_data AS (
        SELECT CAST(1 AS DECIMAL(18,0)) AS n UNION ALL SELECT CAST(2 AS DECIMAL(18,0))
      ) SELECT n::INTEGER AS n FROM uploaded_data WHERE ${fractional.includeSql} ORDER BY n`,
        fractional.bindings,
      );
      expect(ordered.getRowObjects()).toEqual([{ n: 2 }]);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
  it('rejects DECIMAL thresholds when exact common precision would exceed 38 digits', () => {
    for (const [type, value] of [
      ['DECIMAL(38,0)', 1.5],
      ['DECIMAL(38,18)', 1e-19],
      ['DECIMAL(10,2)', 1e-40],
    ] as const) {
      expect(() =>
        compileConditionDefinition(
          def(p('n', 'eq', [value])),
          conditionColumns([{ name: 'n', type }]),
        ),
      ).toThrow(BadRequestException);
    }
  });
  it.each(['BIGINT', 'UBIGINT', 'HUGEINT', 'UHUGEINT', 'BIGNUM'])(
    'preserves exact large integer %s comparison at a safe-number boundary',
    async type => {
      const instance = await DuckDBInstance.create(':memory:');
      const connection = await instance.connect();
      try {
        const compiled = compileConditionDefinition(
          def(p('n', 'gt', [9007199254740991])),
          conditionColumns([{ name: 'n', type }]),
        );
        const result = await connection.runAndReadAll(
          `WITH uploaded_data AS (
          SELECT CAST('9007199254740992' AS ${type}) AS n
        ) SELECT ${compiled.includeSql} AS included FROM uploaded_data`,
          compiled.bindings,
        );
        expect(result.getRowObjects()).toEqual([{ included: true }]);
      } finally {
        connection.closeSync();
        instance.closeSync();
      }
    },
  );
  it('returns zero counts and null ratio on an empty population', async () => {
    const compiled = compileConditionDefinition(def(), nativeColumns);
    const result = await worker.query(
      filename,
      `WITH empty AS (SELECT * FROM uploaded_data WHERE FALSE),
      flags AS (SELECT ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM empty)
      SELECT count(*) AS total, count(*) FILTER (WHERE inc) AS included,
      count(*) FILTER (WHERE inc AND exc) AS excluded, count(*) FILTER (WHERE inc AND NOT exc) AS final,
      count(*) FILTER (WHERE inc AND NOT exc) * 1.0 / NULLIF(count(*), 0) AS ratio FROM flags`,
      compiled.bindings,
    );
    expect(result.datas).toEqual([{ total: 0, included: 0, excluded: 0, final: 0, ratio: null }]);
  });
});
