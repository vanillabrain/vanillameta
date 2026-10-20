import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'fs';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
  resolveConditionSemantics,
  latestConditionSemantics,
  validateConditionBusinessDates,
} from './business-condition-context';
import type { ConditionSemantics } from './business-condition-semantics';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { compileConditionDefinition, conditionColumns } from './source-condition-definition';

// Independent execution lane: CSV bytes -> actual native types -> production compiler -> DuckDB.
// Catalog history resolution and full-file validation use the production server helpers on real SQLite/DuckDB.
const formats = [
  ['iso_day', 'YYYY-MM-DD'],
  ['slash_day', 'YYYY/MM/DD'],
  ['compact_day', 'YYYYMMDD'],
] as const;
const sourceRows = [
  { id: 1, day: '2024-02-28', category: '0' },
  { id: 2, day: '2024-02-29', category: '1' },
  { id: 3, day: '2024-03-01', category: '1.000000000000000001' },
  { id: 4, day: '2000-02-29', category: '9007199254740993' },
  { id: 5, day: '1900-03-01', category: null },
  { id: 6, day: null, category: '-1.5' },
];
const predicate = (column: string, operator: string, values?: unknown[]) => ({
  include: { kind: 'predicate', column, operator, ...(values ? { values } : {}) },
  exclude: null,
});
const snapshot = (
  catalogVersion = 1,
  columns: ConditionSemantics['columns'] = [
    ...formats.map(([column, dateFormat]) => ({
      column,
      businessType: 'date' as const,
      dateFormat,
    })),
    { column: 'category', businessType: 'category' as const, dateFormat: '' },
  ],
): ConditionSemantics => ({ schemaVersion: 1, catalogVersion, columns });

describe('FR015 actual CSV/DuckDB business condition semantics', () => {
  jest.setTimeout(30000);
  let root: string,
    native: Awaited<ReturnType<DuckDBInstance['connect']>>,
    instance: DuckDBInstance,
    db: DataSource,
    schema: Array<{ name: string; type: string }>;
  const compile = (definition: unknown, semantics?: unknown) =>
    compileConditionDefinition(
      definition,
      conditionColumns(schema),
      semantics as ConditionSemantics | undefined,
    );
  const ids = async (definition: unknown, semantics?: unknown, table = 'uploaded_data') => {
    const compiled = compile(definition, semantics);
    const result = await native.runAndReadAll(
      `WITH flags AS (SELECT id, ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM ${table})
       SELECT id FROM flags WHERE inc AND NOT exc ORDER BY id`,
      compiled.bindings,
    );
    return result.getRowObjects().map(row => Number(row.id));
  };
  const catalogEntry = (meaning: ConditionSemantics) => ({
    sourceId: 1,
    version: meaning.catalogVersion,
    actorId: 7,
    schemaRevision: createHash('sha256')
      .update(JSON.stringify(schema.map(column => ({ column: column.name, type: column.type }))))
      .digest('hex'),
    sourceRevision: 'own-immutable-file',
    metadata: JSON.stringify({
      label: 'Synthetic fixture',
      description: '',
      columns: schema.map(column => ({
        column: column.name,
        label: column.name,
        description: '',
        unit: '',
        classification: '',
        ...(meaning.columns.find(item => item.column === column.name) ?? {
          businessType: 'auto',
          dateFormat: '',
        }),
      })),
    }),
  });
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-business-condition-'));
    const csv =
      [
        'id,iso_day,slash_day,compact_day,category',
        ...sourceRows.map(row =>
          [
            row.id,
            row.day ?? '__NULL__',
            row.day?.replace(/-/g, '/') ?? '__NULL__',
            row.day?.replace(/-/g, '') ?? '__NULL__',
            row.category ?? '__NULL__',
          ].join(','),
        ),
      ].join('\n') + '\n';
    const csvPath = path.join(root, 'synthetic.csv');
    fs.writeFileSync(csvPath, csv, { mode: 0o600 });
    instance = await DuckDBInstance.create(path.join(root, 'fixture.duckdb'));
    native = await instance.connect();
    await native.run(
      `CREATE TABLE uploaded_data AS
      SELECT CAST(id AS INTEGER) AS id, iso_day, slash_day, compact_day,
      CAST(category AS DECIMAL(38,18)) AS category
      FROM read_csv(?, header=true, all_varchar=true, nullstr='__NULL__')`,
      [csvPath],
    );
    schema = (await native.runAndReadAll('DESCRIBE uploaded_data'))
      .getRowObjects()
      .map(row => ({ name: String(row.column_name), type: String(row.column_type) }));
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.sqlite'),
      synchronize: true,
      entities: [SourceCatalogEntry],
    }).initialize();
    await db.manager.insert(SourceCatalogEntry, catalogEntry(snapshot()));
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    native?.closeSync();
    instance?.closeSync();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps CSV dates as VARCHAR and exact numeric categories as DECIMAL before applying any business meaning', async () => {
    expect(
      schema.filter(column => column.name.endsWith('_day')).map(column => column.type),
    ).toEqual(['VARCHAR', 'VARCHAR', 'VARCHAR']);
    expect(schema.find(column => column.name === 'category').type).toBe('DECIMAL(38,18)');
    const exact = (
      await native.runAndReadAll(
        'SELECT CAST(category AS VARCHAR) AS value FROM uploaded_data ORDER BY id',
      )
    )
      .getRowObjects()
      .map(row => row.value);
    expect(exact).toEqual([
      '0.000000000000000000',
      '1.000000000000000000',
      '1.000000000000000001',
      '9007199254740993.000000000000000000',
      null,
      '-1.500000000000000000',
    ]);
  });
  it.each(formats)(
    'compares %s (%s) to ISO dates with a JS calendar oracle including leap day',
    async column => {
      const definition = predicate(column, 'between', ['2024-02-29', '2024-03-01']);
      const expected = sourceRows
        .filter(row => row.day && row.day >= '2024-02-29' && row.day <= '2024-03-01')
        .map(row => row.id);
      expect(expected).toEqual([2, 3]);
      expect(await ids(definition, snapshot())).toEqual(expected);
      expect(await ids(predicate(column, 'eq', ['2000-02-29']), snapshot())).toEqual([4]);
      expect(await ids(predicate(column, 'isNull'), snapshot())).toEqual([6]);
    },
  );
  it.each(formats)(
    'exposes %s to the editor/AI schema as a date rather than native string',
    column => {
      const businessColumns = conditionColumns(schema, snapshot());
      expect(businessColumns.find(c => c.name === column).kind).toBe('date');
      expect(conditionColumns(schema).find(c => c.name === column).kind).toBe('string');
    },
  );
  it('uses original numeric category scalar values without rounding adjacent DECIMALs or converting to strings', async () => {
    expect(await ids(predicate('category', 'eq', [1]), snapshot())).toEqual([2]);
    expect(await ids(predicate('category', 'in', [0, 1]), snapshot())).toEqual([1, 2]);
    expect(await ids(predicate('category', 'ne', [1]), snapshot())).toEqual([1, 3, 4, 6]);
    expect(await ids(predicate('category', 'isNull'), snapshot())).toEqual([5]);
    expect(() => compile(predicate('category', 'eq', ['1']), snapshot())).toThrow();
  });
  it.each(['gt', 'gte', 'lt', 'lte', 'between', 'contains'])(
    'rejects %s on a numeric business category before SQL execution',
    operator => {
      expect(() =>
        compile(predicate('category', operator, operator === 'between' ? [0, 1] : [1]), snapshot()),
      ).toThrow();
    },
  );
  it('forbids contains and ordering on VARCHAR categories while preserving blank distinct from NULL', async () => {
    const meaning = snapshot(1, [
      { column: 'iso_day', businessType: 'category' as const, dateFormat: '' },
    ]);
    expect(() => compile(predicate('iso_day', 'contains', ['2024']), meaning)).toThrow();
    expect(() => compile(predicate('iso_day', 'gt', ['2024-01-01']), meaning)).toThrow();
    await native.run(
      "CREATE TEMP TABLE blank_category AS SELECT 1 AS id, '' AS iso_day UNION ALL SELECT 2, NULL",
    );
    expect(await ids(predicate('iso_day', 'eq', ['']), meaning, 'blank_category')).toEqual([1]);
    expect(await ids(predicate('iso_day', 'isNull'), meaning, 'blank_category')).toEqual([2]);
  });
  it.each([
    ['iso_day', '1900-02-29'],
    ['iso_day', '2024-02-30'],
    ['iso_day', ''],
    ['iso_day', '2024-2-29'],
    ['iso_day', '2024-02-29tail'],
    ['slash_day', '2024/02/30'],
    ['slash_day', '2024-02-29'],
    ['compact_day', '20230229'],
    ['compact_day', '202402290'],
  ])(
    'rejects malformed non-NULL %s source value %j rather than silently dropping it',
    async (column, value) => {
      await native.run(
        `CREATE OR REPLACE TEMP TABLE invalid_dates AS SELECT 1 AS id, CAST(? AS VARCHAR) AS "${column}" UNION ALL SELECT 2, NULL`,
        [value],
      );
      const definition = predicate(column, 'gte', ['0001-01-01']);
      expect(() => compile(definition, snapshot())).not.toThrow();
      await expect(ids(definition, snapshot(), 'invalid_dates')).rejects.toThrow();
    },
  );
  it.each(['1900-02-29', '2024-02-30', '2024/02/29', '20240229', ''])(
    'rejects non-ISO or impossible condition date %j before SQL',
    value => {
      expect(() => compile(predicate('slash_day', 'eq', [value]), snapshot())).toThrow();
    },
  );
  it('preserves frozen old meaning across a SQLite catalog append and reconnect without rewriting CSV rows', async () => {
    const stored = await db.manager.findOneByOrFail(SourceCatalogEntry, {
      sourceId: 1,
      version: 1,
    });
    const frozen = await resolveConditionSemantics(db.manager, 1, schema, snapshot());
    const before = fs.readFileSync(path.join(root, 'synthetic.csv'));
    expect(
      await ids(predicate('slash_day', 'between', ['2024-02-29', '2024-03-01']), frozen),
    ).toEqual([2, 3]);
    await db.manager.insert(
      SourceCatalogEntry,
      catalogEntry(
        snapshot(2, [
          ...formats.map(([column]) => ({
            column,
            businessType: 'category' as const,
            dateFormat: '' as const,
          })),
          { column: 'category', businessType: 'number', dateFormat: '' },
        ]),
      ),
    );
    await db.destroy();
    await db.initialize();
    const latest = await db.manager.findOne(SourceCatalogEntry, {
      where: { sourceId: 1 },
      order: { version: 'DESC' },
    });
    expect(latest.version).toBe(2);
    const restored = await resolveConditionSemantics(db.manager, 1, schema, frozen);
    expect(restored).toEqual(frozen);
    const adopted = await latestConditionSemantics(db.manager, 1, schema);
    expect(
      await ids(predicate('slash_day', 'between', ['2024-02-29', '2024-03-01']), frozen),
    ).toEqual([2, 3]);
    expect(() =>
      compile(predicate('slash_day', 'between', ['2024-02-29', '2024-03-01']), adopted),
    ).toThrow();
    expect(
      (await db.manager.findOneByOrFail(SourceCatalogEntry, { sourceId: 1, version: 1 })).metadata,
    ).toBe(stored.metadata);
    expect(fs.readFileSync(path.join(root, 'synthetic.csv'))).toEqual(before);
  });
  it('resolves only the exact same-source historical catalog against the actual CSV schema', async () => {
    await expect(
      resolveConditionSemantics(db.manager, 1, schema, snapshot()),
    ).resolves.toMatchObject({ catalogVersion: 1 });
    await expect(
      resolveConditionSemantics(db.manager, 2, schema, snapshot()),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resolveConditionSemantics(db.manager, 1, schema, snapshot(99)),
    ).rejects.toMatchObject({ status: 409 });
    const forged = snapshot(1, [{ column: 'category', businessType: 'number', dateFormat: '' }]);
    await expect(resolveConditionSemantics(db.manager, 1, schema, forged)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      resolveConditionSemantics(
        db.manager,
        1,
        schema.map(c => (c.name === 'category' ? { ...c, type: 'DOUBLE' } : c)),
        snapshot(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    // Absence means native legacy, even though catalog rows exist.
    await expect(
      resolveConditionSemantics(db.manager, 1, schema, undefined),
    ).resolves.toBeUndefined();
  });
  it('validates the entire real file before a selective condition can hide an invalid business date', async () => {
    const meaning = snapshot(1, [
      { column: 'slash_day', businessType: 'date', dateFormat: 'YYYY/MM/DD' },
    ]);
    const read = async (sql: string, bindings?: unknown[]) => ({
      datas: (await native.runAndReadAll(sql, bindings as any[])).getRowObjects(),
    });
    await expect(validateConditionBusinessDates(schema, meaning, read)).resolves.toBeUndefined();
    await native.run(`CREATE TEMP TABLE unfiltered_dates AS SELECT * FROM uploaded_data
      UNION ALL SELECT 99, '2023-02-29', '2023/02/29', '20230229', CAST(0 AS DECIMAL(38,18))
      UNION ALL SELECT 100, '', '', '', CAST(0 AS DECIMAL(38,18))`);
    const scan = async (sql: string, bindings?: unknown[]) =>
      read(sql.replace(/FROM uploaded_data/g, 'FROM unfiltered_dates'), bindings);
    await expect(validateConditionBusinessDates(schema, meaning, scan)).rejects.toMatchObject({
      status: 400,
      response: {
        code: 'INVALID_BUSINESS_DATES',
        details: [{ column: 'slash_day', invalidCount: '2', blankCount: '1' }],
      },
    });
  });
  it('keeps semantics-free legacy native string/number behavior unchanged', async () => {
    expect(await ids(predicate('slash_day', 'contains', ['2024/02']))).toEqual([1, 2]);
    expect(await ids(predicate('category', 'gt', [1]))).toEqual([3, 4]);
    expect(await ids(predicate('category', 'eq', [0]))).toEqual([1]);
    expect(await ids(predicate('iso_day', 'isNull'))).toEqual([6]);
    expect(() =>
      compile(predicate('slash_day', 'between', ['2024-02-29', '2024-03-01'])),
    ).toThrow();
  });
  describe('UUID/ENUM category compatibility on isolated native schema', () => {
    const uuid = 'abcdef12-abcd-1234-abcd-abcdef123456';
    const secondUuid = '01234567-89ab-cdef-0123-456789abcdef';
    const quotedLabel = `O'Reilly, "x") OR 1=1 --`;
    let scalarSchema: Array<{ name: string; type: string }>;
    const meaning = snapshot(1, [
      { column: 'uuid_key', businessType: 'category', dateFormat: '' },
      { column: 'enum_key', businessType: 'category', dateFormat: '' },
    ]);
    const compileScalar = (
      definition: unknown,
      semantics: ConditionSemantics | undefined = meaning,
    ) => compileConditionDefinition(definition, conditionColumns(scalarSchema), semantics);
    const scalarIds = async (
      definition: unknown,
      semantics: ConditionSemantics | undefined = meaning,
    ) => {
      const compiled = compileScalar(definition, semantics);
      const result = await native.runAndReadAll(
        `WITH flags AS (SELECT id, ${compiled.includeSql} AS inc, ${compiled.excludeSql} AS exc FROM scalar_categories)
         SELECT id FROM flags WHERE inc AND NOT exc ORDER BY id`,
        compiled.bindings,
      );
      return result.getRowObjects().map(row => Number(row.id));
    };
    beforeAll(async () => {
      const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
      await native.run(`CREATE TEMP TABLE scalar_categories(
        id INTEGER, uuid_key UUID, enum_key ENUM('plain', ${quote(quotedLabel)}, 'UPPER', ''))`);
      await native.run(
        'INSERT INTO scalar_categories VALUES (1, ?, ?), (2, ?, ?), (3, NULL, NULL), (4, ?, ?)',
        [uuid, 'plain', secondUuid, quotedLabel, '00000000-0000-0000-0000-000000000000', 'UPPER'],
      );
      scalarSchema = (await native.runAndReadAll('DESCRIBE scalar_categories'))
        .getRowObjects()
        .map(row => ({ name: String(row.column_name), type: String(row.column_type) }));
    });
    it('projects explicit UUID/ENUM categories as strings while preserving the actual native type and original CSV schema', () => {
      const projected = conditionColumns(scalarSchema, meaning);
      for (const column of ['uuid_key', 'enum_key']) {
        expect(projected.find(item => item.name === column)).toMatchObject({
          kind: 'string',
          businessType: 'category',
          type: scalarSchema.find(item => item.name === column).type,
        });
      }
      expect(scalarSchema.find(item => item.name === 'uuid_key').type).toBe('UUID');
      expect(scalarSchema.find(item => item.name === 'enum_key').type).toMatch(/^ENUM\(/);
      expect(schema.some(item => item.name === 'uuid_key' || item.name === 'enum_key')).toBe(false);
    });
    it('matches uppercase canonical UUID operands to actual UUID rows without changing source values', async () => {
      expect(await scalarIds(predicate('uuid_key', 'eq', [uuid.toUpperCase()]))).toEqual([1]);
      expect(
        await scalarIds(
          predicate('uuid_key', 'in', [uuid.toUpperCase(), secondUuid.toUpperCase()]),
        ),
      ).toEqual([1, 2]);
      expect(await scalarIds(predicate('uuid_key', 'ne', [uuid.toUpperCase()]))).toEqual([2, 4]);
      expect(await scalarIds(predicate('uuid_key', 'isNull'))).toEqual([3]);
      expect(
        (
          await native.runAndReadAll(
            'SELECT CAST(uuid_key AS VARCHAR) AS value FROM scalar_categories WHERE id = 1',
          )
        ).getRowObjects(),
      ).toEqual([{ value: uuid }]);
    });
    it.each([
      'abcdef12abcd1234abcdabcdef123456',
      '{abcdef12-abcd-1234-abcd-abcdef123456}',
      'abcdef12-abcd-1234-abcd-abcdef12345g',
      'abcdef12-abcd-1234-abcd-abcdef12345',
      ' abcdef12-abcd-1234-abcd-abcdef123456',
      1,
    ])('rejects malformed UUID operand %j before SQL', value => {
      expect(() => compileScalar(predicate('uuid_key', 'eq', [value]))).toThrow();
      expect(() => compileScalar(predicate('uuid_key', 'in', [uuid, value]))).toThrow();
    });
    it('matches quoted ENUM labels exactly and safely using real native ENUM values', async () => {
      expect(await scalarIds(predicate('enum_key', 'eq', [quotedLabel]))).toEqual([2]);
      expect(await scalarIds(predicate('enum_key', 'in', ['plain', quotedLabel]))).toEqual([1, 2]);
      expect(await scalarIds(predicate('enum_key', 'notIn', ['plain', quotedLabel]))).toEqual([4]);
    });
    it('returns zero for unknown or differently cased ENUM labels and keeps native NULL distinct', async () => {
      expect(await scalarIds(predicate('enum_key', 'eq', ['unknown']))).toEqual([]);
      expect(await scalarIds(predicate('enum_key', 'eq', ['PLAIN']))).toEqual([]);
      expect(await scalarIds(predicate('enum_key', 'eq', ['']))).toEqual([]);
      expect(await scalarIds(predicate('enum_key', 'isNull'))).toEqual([3]);
      expect(await scalarIds(predicate('enum_key', 'isNotNull'))).toEqual([1, 2, 4]);
    });
    it.each(['uuid_key', 'enum_key'])(
      'rejects ordering and contains for explicit %s category',
      column => {
        const value = column === 'uuid_key' ? uuid : 'plain';
        for (const operator of ['gt', 'gte', 'lt', 'lte', 'between', 'contains'])
          expect(() =>
            compileScalar(
              predicate(column, operator, operator === 'between' ? [value, value] : [value]),
            ),
          ).toThrow();
      },
    );
    it('keeps UUID/ENUM unsupported without explicit semantics while retaining native NULL selection', async () => {
      for (const column of ['uuid_key', 'enum_key']) {
        expect(conditionColumns(scalarSchema).find(item => item.name === column).kind).toBe(
          'unsupported',
        );
        expect(() =>
          compileConditionDefinition(
            predicate(column, 'eq', [column === 'uuid_key' ? uuid : 'plain']),
            conditionColumns(scalarSchema),
          ),
        ).toThrow();
        const compiled = compileConditionDefinition(
          predicate(column, 'isNull'),
          conditionColumns(scalarSchema),
        );
        const result = await native.runAndReadAll(
          `SELECT id FROM scalar_categories WHERE ${compiled.includeSql} ORDER BY id`,
          compiled.bindings,
        );
        expect(result.getRowObjects().map(row => Number(row.id))).toEqual([3]);
      }
    });
  });
});
