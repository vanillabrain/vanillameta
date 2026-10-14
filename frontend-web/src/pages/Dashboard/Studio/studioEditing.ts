import { StudioBreakpoint, StudioDocumentV1, StudioOperation } from './studioTypes';

/** Explicit order controls reflow this viewport only; the entire gesture is one history entry. */
export function studioOrderOperations(
  document: StudioDocumentV1,
  breakpoint: StudioBreakpoint,
  blockId: string,
  direction: -1 | 1,
): StudioOperation[] {
  const ordered = [...document.layouts[breakpoint]].sort((a, b) => a.y - b.y || a.x - b.x);
  const index = ordered.findIndex(g => g.id === blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return [];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  let parking = Math.max(0, ...ordered.map(g => g.y + g.h));
  const operations: StudioOperation[] = ordered.map(g => {
    const move: StudioOperation = { type: 'moveBlock', blockId: g.id, breakpoint, x: 0, y: parking };
    parking += g.h;
    return move;
  });
  let y = 0;
  for (const g of ordered) {
    operations.push({ type: 'moveBlock', blockId: g.id, breakpoint, x: 0, y });
    y += g.h;
  }
  return operations;
}
