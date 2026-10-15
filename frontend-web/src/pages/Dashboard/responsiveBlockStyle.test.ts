import { expect, it } from 'vitest';
import { responsiveBlockStyle } from './responsiveBlockStyle';
it('uses independent saved positions across the three reading widths', () => {
  const style = responsiveBlockStyle(
    {
      mobile: { a: { x: 1, y: 3, w: 3, h: 5 } },
      tablet: { a: { x: 4, y: 0, w: 4, h: 2 } },
      desktop: { a: { x: 6, y: 8, w: 6, h: 3 } },
    },
    'a',
  );
  expect(style.gridColumn).toEqual({ xs: '2 / span 3', sm: '5 / span 4', md: '7 / span 6' });
  expect(style.gridRow.md).toBe('9 / span 3');
});
it('keeps legacy auto placement for a newly generated block absent from the saved maps', () => {
  expect(responsiveBlockStyle({ mobile: {}, tablet: {}, desktop: {} }, 'new')).toEqual({});
});
