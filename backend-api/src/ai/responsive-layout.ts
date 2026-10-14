import { BadRequestException } from '@nestjs/common';

export const layoutColumns = { mobile: 4, tablet: 8, desktop: 12 } as const;
export type LayoutSize = keyof typeof layoutColumns;
export type BlockRect = { x: number; y: number; w: number; h: number };
export type BlockLayouts = Partial<Record<LayoutSize, BlockRect>>;
export type ResponsiveLayouts = Record<LayoutSize, Record<string, BlockRect>>;
const overlaps = (a: BlockRect, b: BlockRect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export function validateBlockLayouts(value: unknown): asserts value is BlockLayouts {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('블록 배치를 확인해 주세요.');
  for (const [name, rect] of Object.entries(value)) {
    const cols = layoutColumns[name];
    if (
      !Object.prototype.hasOwnProperty.call(layoutColumns, name) ||
      !rect ||
      typeof rect !== 'object' ||
      !['x', 'y', 'w', 'h'].every(k => Number.isSafeInteger(rect[k])) ||
      rect.x < 0 ||
      rect.y < 0 ||
      rect.y > 1000 ||
      rect.w < 1 ||
      rect.x + rect.w > cols ||
      rect.h < 1 ||
      rect.h > 50
    )
      throw new BadRequestException('블록 배치의 범위를 확인해 주세요.');
  }
}

/** Server IDs are assigned before mapping per-item edits; omitted edits preserve prior geometry. */
export function responsiveLayouts(
  ids: string[],
  desktop: BlockRect[],
  stored?: ResponsiveLayouts,
  edits?: BlockLayouts[],
): ResponsiveLayouts {
  const result = {
    mobile: Object.create(null),
    tablet: Object.create(null),
    desktop: Object.create(null),
  } as ResponsiveLayouts;
  for (const name of Object.keys(layoutColumns) as LayoutSize[]) {
    const cols = layoutColumns[name];
    const explicit = edits?.some(edit => edit?.[name] !== undefined);
    let bottom = Math.max(
      0,
      ...ids.map((id, i) => {
        const rect = edits?.[i]?.[name] ?? stored?.[name]?.[id];
        return rect ? rect.y + rect.h : 0;
      }),
    );
    ids.forEach((id, i) => {
      const original = desktop[i];
      const inherited = name === 'desktop' ? undefined : stored?.[name]?.[id];
      const proposed = edits?.[i]?.[name];
      const rect =
        proposed ??
        inherited ??
        (name === 'desktop'
          ? original
          : name === 'mobile'
          ? { x: 0, y: bottom, w: cols, h: original.h }
          : {
              x: Math.min(cols - 1, Math.floor((original.x * cols) / 12)),
              y: original.y,
              w: Math.max(1, Math.ceil((original.w * cols) / 12)),
              h: original.h,
            });
      let placed = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
      if (!proposed && !stored?.[name]?.[id] && (explicit || stored))
        placed.y = Math.max(placed.y, bottom);
      if (!inherited && !proposed && name === 'tablet')
        placed.x = Math.min(placed.x, cols - placed.w);
      validateBlockLayouts({ [name]: placed });
      if (Object.values(result[name]).some(other => overlaps(placed, other))) {
        if (explicit || inherited)
          throw new BadRequestException('블록 배치가 겹칩니다. 위치를 조정해 주세요.');
        placed = { ...placed, y: bottom };
      }
      validateBlockLayouts({ [name]: placed });
      result[name][id] = placed;
      bottom = Math.max(bottom, placed.y + placed.h);
    });
  }
  return result;
}
