import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { randomUUID, createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { applyFileCorrection } from './file-correction';

type Order = [string | null, string | null, string, string];
const base: Order[] = [
  ['ORD-001', '2025-01-02 00:00:00', '100.00', '0.00'],
  ['ORD-002', '2025-01-03 00:00:00', '200.00', '20.00'],
  ['ORD-003', '2025-01-04 00:00:00', '300.00', '0.00'],
];
const updates: Order[] = [
  ['ORD-001', '2025-01-05 00:00:00', '100.00', '30.00'],
  ['ORD-002', '2025-01-02 00:00:00', '999.00', '0.00'],
  ['ORD-004', '2025-01-05 00:00:00', '400.00', '40.00'],
  ['ORD-004', '2025-01-05 00:00:00', '400.00', '40.00'],
  ['ORD-003', '2025-01-04 00:00:00', '300.00', '0.00'],
  ['ORD-001', '2025-01-03 00:00:00', '100.00', '10.00'],
];
const settings = { keyColumn: 'order_id', updatedAtColumn: 'updated_at' };
const literal = (value: string | null) =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
describe('correction rules against real DuckDB files', () => {
  let root: string, retained: string, checksum: string;
  const connections: Array<{ connection: DuckDBConnection; instance: DuckDBInstance }> = [];
  const close = (entry: (typeof connections)[number]) => {
    entry.connection.closeSync();
    entry.instance.closeSync();
    connections.splice(connections.indexOf(entry), 1);
  };
  const create = async (
    rows: Order[],
    options: {
      duplicateBase?: boolean;
      keyType?: string;
      timeType?: string;
      reverseColumns?: boolean;
      rankColumn?: boolean;
    } = {},
  ) => {
    const filename = path.join(root, randomUUID() + '.duckdb');
    const instance = await DuckDBInstance.create(filename);
    const connection = await instance.connect();
    const entry = { instance, connection };
    connections.push(entry);
    const key = options.keyType ?? 'VARCHAR',
      time = options.timeType ?? 'TIMESTAMP';
    await connection.run(
      `CREATE TABLE uploaded_data(order_id ${key}, updated_at ${time}, revenue DECIMAL(18,2), refund_amount DECIMAL(18,2)${
        options.rankColumn ? ', __correction_rank INTEGER' : ''
      })`,
    );
    for (const row of rows)
      await connection.run(
        `INSERT INTO uploaded_data VALUES (${literal(row[0])},${literal(row[1])},${row[2]},${
          row[3]
        }${options.rankColumn ? ', 99' : ''})`,
      );
    if (options.reverseColumns)
      await connection.run(
        'CREATE OR REPLACE TABLE uploaded_data AS SELECT refund_amount,revenue,updated_at,order_id FROM uploaded_data',
      );
    await connection.run('CHECKPOINT');
    return { filename, ...entry };
  };
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "vm-correction-'"));
    const source = await create(base);
    retained = source.filename;
    close(source);
    checksum = createHash('sha256')
      .update(await fs.readFile(retained))
      .digest('hex');
  });
  afterEach(async () => {
    for (const item of [...connections]) close(item);
    expect(
      createHash('sha256')
        .update(await fs.readFile(retained))
        .digest('hex'),
    ).toBe(checksum);
    await fs.rm(root, { recursive: true, force: true });
  });
  it('applies one newer correction and one insertion, ignores older and duplicate rows and keeps cent totals', async () => {
    const candidate = await create(updates);
    const result = await applyFileCorrection(candidate.connection, retained, settings);
    expect(result).toEqual({
      rows: 4,
      unchanged: false,
      inputRows: 6,
      duplicateRowsDropped: 1,
      supersededRows: 1,
      inserted: 1,
      updated: 1,
      identical: 1,
      ignoredOlder: 1,
    });
    const sums = (
      await candidate.connection.runAndReadAll(
        'SELECT COUNT(*)::INTEGER AS n,SUM(revenue)::VARCHAR AS revenue,SUM(refund_amount)::VARCHAR AS refunds,(SUM(revenue)-SUM(refund_amount))::VARCHAR AS net FROM uploaded_data',
      )
    ).getRowObjects()[0];
    expect(sums).toEqual({ n: 4, revenue: '1000.00', refunds: '90.00', net: '910.00' });
    close(candidate);
    const replay = await create([...updates].reverse());
    expect(
      await applyFileCorrection(replay.connection, candidate.filename, settings),
    ).toMatchObject({
      rows: 4,
      unchanged: true,
      inserted: 0,
      updated: 0,
      identical: 3,
      ignoredOlder: 1,
    });
  });
  it('rejects same-key/same-time conflicting incoming content and rolls back the candidate', async () => {
    const rows: Order[] = [updates[0], ['ORD-001', updates[0][1], '100.00', '99.00']];
    const candidate = await create(rows);
    await expect(
      applyFileCorrection(candidate.connection, retained, settings),
    ).rejects.toMatchObject({ code: 'FILE_CORRECTION_AMBIGUOUS' });
    expect(
      (
        await candidate.connection.runAndReadAll('SELECT COUNT(*)::INTEGER AS n FROM uploaded_data')
      ).getRowObjects()[0].n,
    ).toBe(2);
  });
  it('rejects a conflicting incoming value at the retained timestamp', async () => {
    const candidate = await create([['ORD-002', base[1][1], '200.00', '50.00']]);
    await expect(
      applyFileCorrection(candidate.connection, retained, settings),
    ).rejects.toMatchObject({ code: 'FILE_CORRECTION_AMBIGUOUS' });
  });
  it.each<Order>([
    [null, '2025-01-05 00:00:00', '100.00', '0.00'],
    ['  ', '2025-01-05 00:00:00', '100.00', '0.00'],
    ['ORD-001', null, '100.00', '0.00'],
  ])('rejects missing/empty key or correction timestamp: %s', async (...row) => {
    const candidate = await create([row as Order]);
    await expect(
      applyFileCorrection(candidate.connection, retained, settings),
    ).rejects.toMatchObject({ code: 'FILE_CORRECTION_KEY' });
  });
  it('refuses ambiguous existing keys and never casts a string timestamp implicitly', async () => {
    const duplicate = await create([...base, base[0]]);
    close(duplicate);
    const candidate = await create(updates);
    await expect(
      applyFileCorrection(candidate.connection, duplicate.filename, settings),
    ).rejects.toMatchObject({ code: 'FILE_CORRECTION_KEY' });
    const wrong = await create(updates, { timeType: 'VARCHAR' });
    await expect(applyFileCorrection(wrong.connection, retained, settings)).rejects.toMatchObject({
      code: 'FILE_CORRECTION_COLUMNS',
    });
  });
  it('accepts reordered full-row columns and preserves a newer timestamp even when money is unchanged', async () => {
    const candidate = await create([['ORD-001', '2025-01-06 00:00:00', '100.00', '0.00']], {
      reverseColumns: true,
    });
    expect(await applyFileCorrection(candidate.connection, retained, settings)).toMatchObject({
      updated: 1,
      inserted: 0,
      rows: 3,
      unchanged: false,
    });
  });
  it('keeps customer fields that happen to have the internal rank name', async () => {
    const source = await create(base, { rankColumn: true });
    close(source);
    const candidate = await create(updates, { rankColumn: true });
    expect(
      await applyFileCorrection(candidate.connection, source.filename, settings),
    ).toMatchObject({ rows: 4, updated: 1, inserted: 1 });
    expect(
      (
        await candidate.connection.runAndReadAll(
          'SELECT COUNT(*)::INTEGER AS n FROM uploaded_data WHERE __correction_rank=99',
        )
      ).getRowObjects()[0].n,
    ).toBe(4);
  });
  it('rejects a retained-timestamp conflict even when the batch contains a newer row for that key', async () => {
    const candidate = await create([
      ['ORD-002', base[1][1], '200.00', '99.00'],
      ['ORD-002', '2025-01-06 00:00:00', '200.00', '50.00'],
    ]);
    await expect(
      applyFileCorrection(candidate.connection, retained, settings),
    ).rejects.toMatchObject({ code: 'FILE_CORRECTION_AMBIGUOUS' });
    expect(
      (
        await candidate.connection.runAndReadAll('SELECT COUNT(*)::INTEGER AS n FROM uploaded_data')
      ).getRowObjects()[0].n,
    ).toBe(2);
  });
});
