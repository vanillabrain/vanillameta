import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { buildFileLookup, fileLookupDefinition, FileLookup } from './file-lookup';

describe('fact-preserving lookup snapshots in actual DuckDB', () => {
  let root: string, connection: DuckDBConnection, instance: DuckDBInstance;
  const definition: FileLookup = {
    factKey: 'provider_id',
    lookupKey: 'provider_id',
    attributes: [{ column: 'name', alias: 'provider_name' }],
    nonAdditiveColumns: ['beneficiaries'],
  };
  const create = async (name: string, sql: string) => {
    const filename = path.join(root, name + '.duckdb');
    const i = await DuckDBInstance.create(filename),
      c = await i.connect();
    await c.run(sql);
    c.closeSync();
    i.closeSync();
    return filename;
  };
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "lookup's-"));
    instance = await DuckDBInstance.create(':memory:');
    connection = await instance.connect();
  });
  afterEach(async () => {
    connection?.closeSync();
    instance?.closeSync();
    await fs.rm(root, { recursive: true, force: true });
  });
  const factSql =
    "CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ('P1', 100.00::DECIMAL(18,2), 10), ('P1', 120.00, 12), ('P2', 80.00, 8), ('P9', 50.00, 5), (NULL, 20.00, 2)) t(provider_id, amount, beneficiaries)";
  const lookupSql =
    "CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ('P1','서울'),('P2','부산'),('P3','미사용')) t(provider_id,name)";
  it('keeps every fact row and exact money, counts unmatched/unused, and never sums lookup measures', async () => {
    const fact = await create('fact', factSql),
      lookup = await create('lookup', lookupSql);
    const hash = async (p: string) =>
      createHash('sha256')
        .update(await fs.readFile(p))
        .digest('hex');
    const before = [await hash(fact), await hash(lookup)];
    const result = await buildFileLookup(connection, fact, lookup, definition, true);
    expect(result.quality).toEqual({
      factRows: 5,
      lookupRows: 3,
      duplicateLookupKeys: 0,
      invalidLookupKeys: 0,
      unmatchedFactRows: 2,
      unusedLookupRows: 1,
      outputRows: 5,
      ready: true,
    });
    const rows = (
      await connection.runAndReadAll(
        'SELECT COUNT(*) AS n,SUM(amount)::VARCHAR AS amount,COUNT(provider_name) AS matched FROM uploaded_data',
      )
    ).getRowObjects();
    expect(rows).toEqual([{ n: BigInt(5), amount: '370.00', matched: BigInt(3) }]);
    expect([await hash(fact), await hash(lookup)]).toEqual(before);
  });
  it('returns quality without joining or materializing duplicate lookup keys, even exact duplicate rows', async () => {
    const fact = await create('fact', factSql),
      lookup = await create(
        'lookup',
        "CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ('P1','서울'),('P1','서울')) t(provider_id,name)",
      );
    const r = await buildFileLookup(connection, fact, lookup, definition, true);
    expect(r.quality.ready).toBe(false);
    expect(r.quality.duplicateLookupKeys).toBe(1);
    expect(r.quality.outputRows).toBeNull();
    expect(r.preview).toEqual([]);
    await expect(connection.run('SELECT * FROM uploaded_data')).rejects.toThrow();
  });
  it.each(['NULL', "''", "'  '"])(
    'rejects missing/blank lookup key %s without dropping facts',
    async key => {
      const fact = await create('fact', factSql),
        lookup = await create(
          'lookup',
          `CREATE TABLE uploaded_data AS SELECT ${key}::VARCHAR AS provider_id, 'invalid' AS name`,
        );
      const r = await buildFileLookup(connection, fact, lookup, definition, false);
      expect(r.quality.invalidLookupKeys).toBe(1);
      expect(r.quality.ready).toBe(false);
    },
  );
  it('does not normalize keys, infer coercions or silently match trailing whitespace', async () => {
    const fact = await create('fact', factSql),
      lookup = await create(
        'lookup',
        "CREATE TABLE uploaded_data AS SELECT 'P1 ' AS provider_id,'space' AS name",
      );
    const r = await buildFileLookup(connection, fact, lookup, definition, false);
    expect(r.quality.unmatchedFactRows).toBe(5);
  });
  it('refuses different key types and alias collisions before joining', async () => {
    const fact = await create('fact', factSql),
      lookup = await create(
        'lookup',
        "CREATE TABLE uploaded_data AS SELECT 1 AS provider_id,'x' AS name",
      );
    await expect(buildFileLookup(connection, fact, lookup, definition, true)).rejects.toThrow(
      '같은 문자열',
    );
  });
  it('rejects aliases shadowing a fact column, case-insensitive, and unsupported fields', async () => {
    const fact = await create('fact', factSql),
      lookup = await create('lookup', lookupSql);
    await expect(
      buildFileLookup(
        connection,
        fact,
        lookup,
        { ...definition, attributes: [{ column: 'name', alias: 'AMOUNT' }] },
        true,
      ),
    ).rejects.toThrow('겹칩니다');
    expect(() => fileLookupDefinition({ ...definition, sql: 'DROP TABLE x' })).toThrow();
    expect(() =>
      fileLookupDefinition({ ...definition, attributes: [{ column: 'name', alias: 'bad;sql' }] }),
    ).toThrow();
  });
  it('retains child file grain while distinct commit, full path and basename have different counts', async () => {
    const fact = await create(
      'fact',
      "CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ('C1','src/api/index.ts',10),('C1','src/web/index.ts',20),('C2','src/api/index.ts',5),('C3','README',3),('C9',NULL,4)) t(commit_id,file_path,additions)",
    );
    const lookup = await create(
      'lookup',
      "CREATE TABLE uploaded_data AS SELECT * FROM (VALUES ('C1','Alice'),('C2','Bob'),('C3','Alice'),('C4','No files')) t(commit_id,author)",
    );
    const r = await buildFileLookup(
      connection,
      fact,
      lookup,
      {
        factKey: 'commit_id',
        lookupKey: 'commit_id',
        attributes: [{ column: 'author', alias: 'commit_author' }],
        pathColumn: 'file_path',
        nonAdditiveColumns: [],
      },
      true,
    );
    expect(r.quality.factRows).toBe(5);
    expect(r.quality.unmatchedFactRows).toBe(1);
    expect(r.quality.unusedLookupRows).toBe(1);
    const v = (
      await connection.runAndReadAll(
        'SELECT COUNT(*) AS events,COUNT(DISTINCT commit_id) AS commits,COUNT(DISTINCT file_path) AS paths,COUNT(DISTINCT path_filename) AS filenames,SUM(additions) AS additions FROM uploaded_data',
      )
    ).getRowObjects()[0];
    expect(v).toEqual({
      events: BigInt(5),
      commits: BigInt(4),
      paths: BigInt(3),
      filenames: BigInt(2),
      additions: BigInt(42),
    });
    expect(
      (
        await connection.runAndReadAll(
          "SELECT path_directory,path_extension FROM uploaded_data WHERE file_path='src/api/index.ts' LIMIT 1",
        )
      ).getRowObjects()[0],
    ).toEqual({ path_directory: 'src/api', path_extension: 'ts' });
  });
  it('uses numeric lookup attributes only as categories and leaves nonadditive facts explicit', async () => {
    const fact = await create('fact', factSql),
      lookup = await create(
        'lookup',
        "CREATE TABLE uploaded_data AS SELECT 'P1' AS provider_id, 123::INTEGER AS code",
      );
    const r = await buildFileLookup(
      connection,
      fact,
      lookup,
      { ...definition, attributes: [{ column: 'code', alias: 'provider_code' }] },
      true,
    );
    expect(r.definition.nonAdditiveColumns).toEqual(['beneficiaries']);
    expect(
      (await connection.runAndReadAll('DESCRIBE uploaded_data'))
        .getRowObjects()
        .find(x => x.column_name === 'provider_code').column_type,
    ).toBe('VARCHAR');
  });
  it('previews a stable five-row sample without creating an output table', async () => {
    const fact = await create('fact', factSql),
      lookup = await create('lookup', lookupSql);
    const r = await buildFileLookup(connection, fact, lookup, definition, false);
    expect(r.preview).toHaveLength(5);
    await expect(connection.run('SELECT * FROM uploaded_data')).rejects.toThrow();
  });
  it('rejects oversized cells before materializing output or constructing preview row objects', async () => {
    const fact = await create('fact', factSql),
      lookup = await create(
        'lookup',
        "CREATE TABLE uploaded_data AS SELECT 'P1' AS provider_id, repeat('x',1100000) AS name",
      );
    await expect(buildFileLookup(connection, fact, lookup, definition, true, 1024)).rejects.toThrow(
      '미리보기 결과가 큽니다',
    );
    await expect(connection.run('SELECT * FROM uploaded_data')).rejects.toThrow();
  });
});
