/** Derive display layouts from the saved 12-column layout without changing persisted positions. */
export function readLayouts(layout: any[]) {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  let nextRow = 0;
  const xs = sorted.map(item => {
    const row = { ...item, i: String(item.i), x: 0, y: nextRow, w: 1, static: true };
    nextRow += item.h;
    return row;
  });
  const md = layout.map(item => {
    const x = Math.min(7, Math.floor((item.x * 8) / 12));
    const end = Math.min(8, Math.floor(((item.x + item.w) * 8) / 12));
    return { ...item, i: String(item.i), x, w: Math.max(1, end - x), static: true };
  });
  return { xs, md, lg: layout.map(item => ({ ...item, i: String(item.i), static: true })) };
}
