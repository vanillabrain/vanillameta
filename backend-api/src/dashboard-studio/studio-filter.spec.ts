import { validateStudioFilters } from './studio-document';
describe('Studio categorical scope contract', () => {
  it('preserves primitive identity and safely clones values', () => {
    const input = [{ column: 'category', values: [null, true, false, 0, 1, '1', ''] }];
    expect(validateStudioFilters(input)).toEqual(input);
    expect(validateStudioFilters(input)).not.toBe(input);
  });
  it.each(
    [
      [{ column: 'category', values: [] }],
      [{ column: '', values: ['a'] }],
      [{ column: 'category', values: ['a'], sql: 'x' }],
      [
        { column: 'category', values: ['a'] },
        { column: 'category', values: ['b'] },
      ],
      [{ column: 'category', values: [Infinity] }],
      [{ column: 'category', values: [undefined] }],
      [{ column: 'category', values: [null, null] }],
      [{ column: 'category', values: ['a', 'a'] }],
      [{ column: 'category', values: [{ malicious: true }] }],
      [{ column: 'category', values: Array.from({ length: 51 }, (_, i) => i) }],
      Array.from({ length: 6 }, (_, i) => ({ column: 'c' + i, values: ['a'] })),
      [{ column: 'category', range: { min: 1 } }],
    ].map(input => [input]),
  )('rejects malformed scope %j', input => {
    expect(() => validateStudioFilters(input)).toThrow();
  });
});
