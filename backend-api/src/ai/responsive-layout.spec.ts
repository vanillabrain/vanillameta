import { responsiveLayouts, validateBlockLayouts } from './responsive-layout';
const desktop = [
  { x: 0, y: 0, w: 6, h: 2 },
  { x: 6, y: 0, w: 6, h: 2 },
];
it('derives mobile and tablet without mutating desktop and preserves IDs across reordering', () => {
  const before = JSON.stringify(desktop);
  const initial = responsiveLayouts(['a', 'b'], desktop);
  expect(initial.mobile.b).toEqual({ x: 0, y: 2, w: 4, h: 2 });
  expect(initial.tablet.b).toEqual({ x: 4, y: 0, w: 4, h: 2 });
  const reordered = responsiveLayouts(['b', 'a'], [desktop[1], desktop[0]], initial);
  expect(reordered.mobile).toEqual(initial.mobile);
  expect(JSON.stringify(desktop)).toBe(before);
});
it('appends an inserted duplicate after all inherited positions instead of overlapping a later item', () => {
  const initial = responsiveLayouts(['a', 'b'], desktop);
  const next = responsiveLayouts(
    ['a', 'copy', 'b'],
    [desktop[0], { x: 0, y: 2, w: 6, h: 2 }, desktop[1]],
    initial,
  );
  expect(next.mobile.copy.y).toBe(4);
  expect(next.mobile.b).toEqual(initial.mobile.b);
});
it('accepts independent layouts and rejects overlapping explicit edits', () => {
  const initial = responsiveLayouts(['a', 'b'], desktop);
  const next = responsiveLayouts(['a', 'b'], desktop, initial, [
    { mobile: { x: 2, y: 6, w: 2, h: 3 } },
    undefined,
  ]);
  expect(next.mobile.a.y).toBe(6);
  expect(next.desktop).toEqual(initial.desktop);
  expect(() =>
    responsiveLayouts(['a', 'b'], desktop, initial, [{ mobile: initial.mobile.b }, undefined]),
  ).toThrow('겹칩니다');
});
it.each([
  { mobile: { x: 3, y: 0, w: 2, h: 2 } },
  { tablet: { x: 0.5, y: 0, w: 2, h: 2 } },
  { desktop: { x: 0, y: -1, w: 2, h: 2 } },
  { unknown: { x: 0, y: 0, w: 2, h: 2 } },
])('rejects invalid layout %p', value => expect(() => validateBlockLayouts(value)).toThrow());
it('keeps a temporary reserved-name key as data without changing dictionary prototypes', () => {
  const result = responsiveLayouts(['__proto__'], [desktop[0]]);
  expect(Object.getPrototypeOf(result.mobile)).toBeNull();
  expect(JSON.parse(JSON.stringify(result)).mobile.__proto__).toEqual({ x: 0, y: 0, w: 4, h: 2 });
});
