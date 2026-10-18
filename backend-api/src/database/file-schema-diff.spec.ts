import { diffFileSchema, FILE_SCHEMA_DIFF_LIMIT } from './file-schema-diff';

describe('file schema diff', () => {
  const col = (name: any, type: any = 'VARCHAR') => ({ name, type });

  it('reports no change for identical columns regardless of order', () => {
    const diff = diffFileSchema([col('b', 'BIGINT'), col('a')], [col('a'), col('b', 'BIGINT')]);
    expect(diff.changed).toBe(false);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.typeChanged).toEqual([]);
    expect(diff.counts).toEqual({ removed: 0, added: 0, typeChanged: 0 });
    expect(diff.truncated).toBe(false);
  });

  it('lists removed and added columns with their own types', () => {
    const diff = diffFileSchema(
      [col('z', 'BIGINT'), col('a'), col('shared', 'BIGINT')],
      [col('a'), col('m', 'DOUBLE'), col('shared', 'BIGINT')],
    );
    expect(diff.changed).toBe(true);
    expect(diff.removed).toEqual([{ name: 'z', type: 'BIGINT' }]);
    expect(diff.added).toEqual([{ name: 'm', type: 'DOUBLE' }]);
    expect(diff.typeChanged).toEqual([]);
    expect(diff.counts).toEqual({ removed: 1, added: 1, typeChanged: 0 });
  });

  it('orders every list by column name', () => {
    const diff = diffFileSchema(
      [col('zeta'), col('alpha'), col('mid', 'BIGINT')],
      [col('yankee'), col('beta')],
    );
    expect(diff.removed.map(entry => entry.name)).toEqual(['alpha', 'mid', 'zeta']);
    expect(diff.added.map(entry => entry.name)).toEqual(['beta', 'yankee']);
  });

  it('reports a type change as from/to without removing the column', () => {
    const diff = diffFileSchema(
      [col('amount', 'BIGINT'), col('day', 'DATE')],
      [col('amount', 'VARCHAR'), col('day', 'DATE')],
    );
    expect(diff.changed).toBe(true);
    expect(diff.typeChanged).toEqual([{ name: 'amount', from: 'BIGINT', to: 'VARCHAR' }]);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.counts).toEqual({ removed: 0, added: 0, typeChanged: 1 });
  });

  it('orders type changes by name too', () => {
    const diff = diffFileSchema(
      [col('second', 'BIGINT'), col('first', 'BIGINT')],
      [col('second', 'DOUBLE'), col('first', 'DOUBLE')],
    );
    expect(diff.typeChanged.map(entry => entry.name)).toEqual(['first', 'second']);
  });

  it('caps each list while reporting the full counts', () => {
    const existing = Array.from({ length: FILE_SCHEMA_DIFF_LIMIT + 3 }, (_value, index) =>
      col(`old_${String(index).padStart(2, '0')}`),
    );
    const incoming = Array.from({ length: FILE_SCHEMA_DIFF_LIMIT + 5 }, (_value, index) =>
      col(`new_${String(index).padStart(2, '0')}`),
    );
    const diff = diffFileSchema(existing, incoming);
    expect(diff.changed).toBe(true);
    expect(diff.removed).toHaveLength(FILE_SCHEMA_DIFF_LIMIT);
    expect(diff.added).toHaveLength(FILE_SCHEMA_DIFF_LIMIT);
    expect(diff.counts).toEqual({
      removed: FILE_SCHEMA_DIFF_LIMIT + 3,
      added: FILE_SCHEMA_DIFF_LIMIT + 5,
      typeChanged: 0,
    });
    expect(diff.truncated).toBe(true);
    expect(diff.removed[0].name).toBe('old_00');
    expect(diff.removed[FILE_SCHEMA_DIFF_LIMIT - 1].name).toBe(
      `old_${String(FILE_SCHEMA_DIFF_LIMIT - 1).padStart(2, '0')}`,
    );
    expect(diff.added[0].name).toBe('new_00');
  });

  it('stays truncated when only one list exceeds the cap', () => {
    const existing = Array.from({ length: FILE_SCHEMA_DIFF_LIMIT + 1 }, (_value, index) =>
      col(`old_${index}`),
    );
    const diff = diffFileSchema(existing, [col('shared')]);
    expect(diff.removed).toHaveLength(FILE_SCHEMA_DIFF_LIMIT);
    expect(diff.added).toEqual([{ name: 'shared', type: 'VARCHAR' }]);
    expect(diff.truncated).toBe(true);
    expect(diff.counts.removed).toBe(FILE_SCHEMA_DIFF_LIMIT + 1);
  });

  it('ignores malformed entries instead of throwing', () => {
    const diff = diffFileSchema(
      [col('ok'), col(''), col('badType', 3), null, { name: 'noType' }, col(7)],
      [col('ok')],
    );
    expect(diff.changed).toBe(false);
    expect(diff.removed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.typeChanged).toEqual([]);
  });

  it('keeps only name/type/from/to keys in every entry', () => {
    const diff = diffFileSchema(
      [{ name: 'a', type: 'BIGINT', extra: 'SELECT * FROM uploaded_data' }],
      [{ name: 'a', type: 'VARCHAR', extra: '/tmp/secret/data.duckdb' }],
    );
    expect(Object.keys(diff.typeChanged[0]).sort()).toEqual(['from', 'name', 'to']);
    const json = JSON.stringify(diff);
    expect(json).not.toContain('SELECT');
    expect(json).not.toContain('/tmp/secret/data.duckdb');
  });
});
