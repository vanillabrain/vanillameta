import * as renderer from './validated-query-bindings';
import { DuckDBInstance } from '@duckdb/node-api';
describe('validated generated query binding persistence', () => {
  const render = (sql: string, values: unknown[]) =>
    renderer.renderValidatedQueryBindings(sql, values);
  it('keeps quoted question marks and escaped quotes; encodes hostile Unicode strings without semicolons', async () => {
    const input = "한글'; -- ? 😀\u0000";
    const sql = render(
      `SELECT '?' AS "q?", 'it''s ?' AS literal, ? AS value, ? AS n, ? AS yes, ? AS empty`,
      [input, 1.25, true, null],
    );
    expect(sql).not.toContain(';');
    const instance = await DuckDBInstance.create(':memory:');
    const conn = await instance.connect();
    try {
      const reader = await conn.runAndReadAll(sql);
      expect(reader.getRowObjects()).toEqual([
        { 'q?': '?', literal: "it's ?", value: input, n: 1.25, yes: true, empty: null },
      ]);
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  });
  it.each([[NaN], [Infinity], [undefined], [{}], [BigInt(1)]])(
    'rejects unsupported binding %s',
    values => {
      expect(() => render('SELECT ?', [values])).toThrow();
    },
  );
  it('rejects mismatched placeholders, comments, unterminated quotes and oversized encoded queries', () => {
    for (const [sql, values] of [
      ['SELECT ?', [1, 2]],
      ['SELECT ?, ?', [1]],
      ["SELECT 'oops", []],
      ['SELECT ? -- ?', [1]],
      ['SELECT ? /* ? */', [1]],
      ['SELECT ?', ['x'.repeat(30000)]],
    ] as [string, unknown[]][])
      expect(() => render(sql, values)).toThrow();
  });
});
