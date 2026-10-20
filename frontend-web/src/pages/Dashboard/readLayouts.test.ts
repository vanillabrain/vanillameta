import { describe, expect, it } from 'vitest';
import { readLayouts } from './readLayouts';

describe('dashboard reading layouts', () => {
  it('stacks two KPIs and a full-width chart on mobile without overwriting saved positions', () => {
    const saved = [
      { i: 3, x: 0, y: 2, w: 12, h: 5 },
      { i: 2, x: 6, y: 0, w: 6, h: 2 },
      { i: 1, x: 0, y: 0, w: 6, h: 2 },
    ];
    const before = JSON.stringify(saved);
    const result = readLayouts(saved);
    expect(result.xs.map(item => [item.i, item.x, item.y, item.w])).toEqual([
      ['1', 0, 0, 1],
      ['2', 0, 2, 1],
      ['3', 0, 4, 1],
    ]);
    expect(result.md.map(item => [item.x, item.w])).toEqual([
      [0, 8],
      [4, 4],
      [0, 4],
    ]);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
