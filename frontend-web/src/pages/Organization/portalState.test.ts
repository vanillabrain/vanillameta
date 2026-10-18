import { expect, it } from 'vitest';
import { readFrameState, frameFilters, fixedFilters } from './portalState';
it('normalizes typed equality sets without accepting identities, duplicate keys or unsupported themes', () => {
  const filters = [
    { column: 'revenue', values: [2, 1] },
    { column: 'day', values: ['2025-01-01'] },
  ];
  const parsed = readFrameState('?embed=1&theme=dark&filters=' + encodeURIComponent(JSON.stringify(filters)));
  expect(parsed.filters).toEqual([
    { column: 'day', values: ['2025-01-01'] },
    { column: 'revenue', values: [1, 2] },
  ]);
  expect(parsed.key).toBe(fixedFilters(filters));
  for (const query of [
    '?embed=1&theme=purple',
    '?embed=1&actorId=2',
    '?embed=1&embed=1',
    '?embed=1&filters=' + encodeURIComponent('[{"column":"cost","values":[],"role":"admin"}]'),
  ])
    expect(() => readFrameState(query)).toThrow();
  expect(() => frameFilters(parsed.filters, { columns: [{ name: 'revenue' }] } as any)).toThrow();
});
