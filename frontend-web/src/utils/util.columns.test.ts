import { describe, expect, it } from 'vitest';
import { createColumns } from './util';

describe('createColumns empty and named records', () => {
  it.each([[null], [undefined], [[]], [[null]], [0]])('returns no columns for %j', data => {
    expect(createColumns(data)).toEqual([]);
  });

  it('preserves named record fields including a legitimate rowKey', () => {
    const data = { rowKey: 'user', 'amount,usd': 100 };
    expect(createColumns(data).map(column => column.name)).toEqual(['rowKey', 'amount,usd']);
    expect(createColumns([data])).toEqual(createColumns(data));
  });
});
