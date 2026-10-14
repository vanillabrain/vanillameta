import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DashboardDraft } from './dashboard-draft';

/** UC-006 BR-001: deterministic read adapter, never writes or depends on recreated DB IDs. */
export function legacyBlockIds(draft: DashboardDraft, dashboardId: number): DashboardDraft {
  return {
    ...draft,
    widgets: draft.widgets.map((w, i) => ({
      ...w,
      blockId: w.blockId ?? `legacy-${dashboardId}-${i}`,
    })),
  };
}
export function storedBlockIds(draft: DashboardDraft, previous?: DashboardDraft): DashboardDraft {
  if (
    previous &&
    draft.widgets.every(w => !w.blockId) &&
    draft.widgets.length !== previous.widgets.length
  )
    throw new BadRequestException('블록 정보를 다시 불러와 주세요.');
  const known = new Set(previous?.widgets.map(w => w.blockId));
  return {
    ...draft,
    widgets: draft.widgets.map((w, i) => {
      if (previous && w.blockId && !known.has(w.blockId))
        throw new BadRequestException('알 수 없는 블록입니다. 새 블록은 ID 없이 추가해 주세요.');
      return {
        ...w,
        blockId: previous
          ? w.blockId ??
            (draft.widgets.every(item => !item.blockId)
              ? previous.widgets[i].blockId
              : `block-${randomUUID()}`)
          : `block-${randomUUID()}`,
      };
    }),
  };
}

/** Existing blocks follow identity when reordered/deleted; new blocks append below occupied space. */
export function blockGeometry(
  previous: DashboardDraft,
  draft: DashboardDraft,
  layout: any[],
  mappings: any[],
) {
  if (!Array.isArray(layout) || mappings.length !== previous.widgets.length)
    throw new BadRequestException('차트 배치를 다시 불러와 주세요.');
  const geometry = previous.widgets.map((_, i) =>
    layout.find(item => String(item.i) === String(mappings[i].widgetId)),
  );
  if (geometry.some(item => !item))
    throw new BadRequestException('차트 배치를 다시 불러와 주세요.');
  let bottom = geometry.reduce((n, g) => Math.max(n, g.y + g.h), 0);
  return draft.widgets.map((w, i) => {
    const index = previous.widgets.findIndex(old => old.blockId === w.blockId);
    if (index >= 0) {
      const size = draft.layoutSizes?.[i];
      const oldSize = previous.layoutSizes?.[index];
      if (size && JSON.stringify(size) !== JSON.stringify(oldSize))
        return {
          ...geometry[index],
          x: Math.min(geometry[index].x, 12 - size.width),
          w: size.width,
          h: size.height,
        };
      return geometry[index];
    }
    const size = draft.layoutSizes?.[i];
    const g = {
      x: 0,
      y: bottom,
      w: size?.width ?? (w.type === 'BOARD_NUMERIC' ? 6 : 12),
      h: size?.height ?? (w.type === 'BOARD_NUMERIC' ? 2 : 5),
    };
    bottom += g.h;
    return g;
  });
}

/** Read-only view geometry; public draft geometry never controls persisted positions. */
export function readBlockLayouts(draft: DashboardDraft, layout: any[], mappings: any[]) {
  const geometry = blockGeometry(draft, draft, layout, mappings);
  return Object.fromEntries(
    draft.widgets.map((w, i) => [
      w.blockId,
      { x: geometry[i].x, y: geometry[i].y, w: geometry[i].w, h: geometry[i].h },
    ]),
  );
}
