import type { StudioBlockKind, StudioDisplay, StudioDocumentV1 } from '../Studio/studioTypes';
import { STUDIO_BREAKPOINTS, STUDIO_COLUMNS } from '../Studio/studioTypes';
import { studioKeys, studioOverlap } from '../Studio/studioDocument';
import { validateStudioPivotResult, StudioPivotResult } from '../Studio/studioPivot';
export type StudioReusePreviewBlock = { blockId: string; title: string; description: string; display: StudioDisplay } & (
  | { kind: 'SEGMENT_PIVOT'; pivot: StudioPivotResult }
  | { kind: Exclude<StudioBlockKind, 'SEGMENT_PIVOT'>; widget: Record<string, any> }
);
export type StudioReusePreviewV1 = {
  schemaVersion: 1;
  kind: 'studio-reuse-preview';
  title: string;
  capturedAt: string;
  scope: string;
  blocks: StudioReusePreviewBlock[];
  layouts: StudioDocumentV1['layouts'];
  newMetricCount: number;
};
const fail = () => {
  throw new Error('복사본 미리보기의 블록·결과·배치를 확인하지 못했습니다. 열 연결은 유지됩니다.');
};
const assert = (ok: unknown) => {
  if (!ok) fail();
};
const text = (v: unknown, max = 1000) => typeof v === 'string' && v.length <= max;
const scalar = (v: unknown) =>
  v === null || typeof v === 'boolean' || text(v, 10000) || (typeof v === 'number' && Number.isFinite(v));
export function validateStudioReusePreview(input: unknown): StudioReusePreviewV1 {
  const v: any = input;
  studioKeys(v, ['schemaVersion', 'kind', 'title', 'capturedAt', 'scope', 'blocks', 'layouts', 'newMetricCount']);
  assert(
    v.schemaVersion === 1 &&
      v.kind === 'studio-reuse-preview' &&
      text(v.title, 300) &&
      v.title.trim() &&
      text(v.scope, 2000) &&
      v.scope.trim() &&
      typeof v.capturedAt === 'string' &&
      Number.isFinite(Date.parse(v.capturedAt)) &&
      Number.isSafeInteger(v.newMetricCount) &&
      v.newMetricCount >= 0 &&
      Array.isArray(v.blocks) &&
      v.blocks.length > 0 &&
      v.blocks.length <= 6,
  );
  const ids = new Set<string>();
  let ordinary = 0;
  v.blocks.forEach((b: any) => {
    studioKeys(b, [
      'blockId',
      'kind',
      'title',
      'description',
      'display',
      ...(b.kind === 'SEGMENT_PIVOT' ? ['pivot'] : ['widget']),
    ]);
    assert(
      typeof b.blockId === 'string' &&
        /^[A-Za-z0-9_-]{1,128}$/.test(b.blockId) &&
        !ids.has(b.blockId) &&
        text(b.title, 300) &&
        text(b.description, 1000),
    );
    ids.add(b.blockId);
    studioKeys(b.display, ['presentation', 'timeGrain', 'decimalPlaces', 'numberNotation', 'prefix', 'suffix']);
    const d = b.display;
    assert(
      (d.presentation === undefined || ['visual', 'table', 'summary'].includes(d.presentation)) &&
        (d.timeGrain === undefined || ['auto', 'day', 'week', 'month'].includes(d.timeGrain)) &&
        (d.decimalPlaces === undefined ||
          (Number.isInteger(d.decimalPlaces) && d.decimalPlaces >= 0 && d.decimalPlaces <= 6)) &&
        (d.numberNotation === undefined || ['full', 'compact'].includes(d.numberNotation)) &&
        (d.prefix === undefined || text(d.prefix, 100)) &&
        (d.suffix === undefined || text(d.suffix, 100)),
    );
    if (b.kind === 'SEGMENT_PIVOT') validateStudioPivotResult(b.pivot, true);
    else {
      assert(['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'].includes(b.kind));
      ordinary++;
      const w = b.widget;
      studioKeys(w, [
        'type',
        'title',
        'description',
        'valueField',
        'categoryField',
        'decimalPlaces',
        'numberNotation',
        'prefix',
        'suffix',
        'fields',
        'datas',
        'trend',
        'trendUnavailable',
      ]);
      assert(
        w.type === b.kind &&
          typeof w.valueField === 'string' &&
          text(w.valueField, 255) &&
          (w.categoryField === undefined || text(w.categoryField, 255)) &&
          Array.isArray(w.fields) &&
          Array.isArray(w.datas) &&
          w.datas.length <= 500,
      );
      w.datas.forEach((r: any) => {
        assert(r && typeof r === 'object' && !Array.isArray(r));
        assert(Object.values(r).every(scalar));
      });
    }
  });
  assert(ordinary > 0);
  studioKeys(v.layouts, ['xs', 'md', 'lg']);
  for (const bp of STUDIO_BREAKPOINTS) {
    const rows = v.layouts[bp];
    assert(Array.isArray(rows) && rows.length === ids.size);
    const seen = new Set<string>();
    rows.forEach((r: any, i: number) => {
      studioKeys(r, ['id', 'x', 'y', 'w', 'h']);
      assert(ids.has(r.id) && !seen.has(r.id));
      seen.add(r.id);
      assert(
        [r.x, r.y, r.w, r.h].every(Number.isSafeInteger) &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.w > 0 &&
          r.h > 0 &&
          r.x + r.w <= STUDIO_COLUMNS[bp] &&
          Number.isSafeInteger(r.y + r.h) &&
          rows.slice(0, i).every((o: any) => !studioOverlap(r, o)),
      );
    });
  }
  assert(new TextEncoder().encode(JSON.stringify(v)).length <= 6 * 1024 * 1024);
  return JSON.parse(JSON.stringify(v));
}
