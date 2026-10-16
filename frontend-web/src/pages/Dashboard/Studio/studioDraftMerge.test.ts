import { expect, it } from 'vitest';
import { mergeStudioDraft } from './studioDraftMerge';
import { StudioDocumentV1 } from './studioTypes';
const doc = (): StudioDocumentV1 => ({
  schemaVersion: 1,
  dashboardId: 46,
  sourceId: 34,
  title: '기준',
  blocks: [
    {
      id: 'one',
      definitionKey: 'one',
      kind: 'BOARD_NUMERIC',
      title: '매출',
      description: '설명',
      measureRefs: [],
      dimensionRefs: [],
      display: { decimalPlaces: 2 },
    },
    {
      id: 'two',
      definitionKey: 'two',
      kind: 'BOARD_NUMERIC',
      title: '환불',
      description: '설명',
      measureRefs: [],
      dimensionRefs: [],
      display: { decimalPlaces: 2 },
    },
  ],
  layouts: {
    lg: [
      { id: 'one', x: 0, y: 0, w: 4, h: 2 },
      { id: 'two', x: 4, y: 0, w: 4, h: 2 },
    ],
    md: [
      { id: 'one', x: 0, y: 0, w: 4, h: 2 },
      { id: 'two', x: 4, y: 0, w: 4, h: 2 },
    ],
    xs: [
      { id: 'one', x: 0, y: 0, w: 1, h: 2 },
      { id: 'two', x: 0, y: 2, w: 1, h: 2 },
    ],
  },
});
it('merges only local changed fields and keeps remote values and geometry', () => {
  const base = doc(),
    local = doc(),
    latest = doc();
  local.blocks[0].title = '내 매출';
  latest.blocks[1].title = '최신 환불';
  latest.layouts.lg[1].y = 3;
  const r = mergeStudioDraft(latest, local, base);
  expect(r.conflicts).toEqual([]);
  expect(r.blocked).toEqual([]);
  expect(r.document?.blocks.map(b => b.title)).toEqual(['내 매출', '최신 환불']);
  expect(r.document?.layouts.lg[1].y).toBe(3);
});
it('reports both values for same field conflicts while constructing the explicit mine choice', () => {
  const base = doc(),
    local = doc(),
    latest = doc();
  local.blocks[0].title = '내 제목';
  latest.blocks[0].title = '다른 탭 제목';
  local.blocks[0].display.decimalPlaces = 0;
  latest.blocks[0].display.decimalPlaces = 1;
  const r = mergeStudioDraft(latest, local, base);
  expect(r.conflicts).toHaveLength(2);
  expect(r.conflicts[0]).toMatchObject({ mine: '내 제목', latest: '다른 탭 제목' });
  expect(r.document?.blocks[0].title).toBe('내 제목');
});
it('preserves new temporary block layouts at every width', () => {
  const base = doc(),
    local = doc(),
    latest = doc();
  const id = 'new:11111111-1111-4111-8111-111111111111';
  local.blocks.push({ ...local.blocks[0], id });
  for (const bp of ['lg', 'md', 'xs'] as const) local.layouts[bp].push({ id, x: 0, y: 6, w: bp === 'xs' ? 1 : 6, h: 3 });
  const r = mergeStudioDraft(latest, local, base);
  expect(r.blocked).toEqual([]);
  expect(r.document?.layouts).toEqual(local.layouts);
});
it('blocks deleted changed targets, changed definitions, source mismatch and invalid merged geometry', () => {
  const base = doc(),
    local = doc();
  local.blocks[0].title = '내 제목';
  const removed = doc();
  removed.blocks.shift();
  for (const bp of ['lg', 'md', 'xs'] as const) removed.layouts[bp].shift();
  expect(mergeStudioDraft(removed, local, base).document).toBeNull();
  const def = doc();
  def.blocks[0].definitionKey = 'other';
  expect(mergeStudioDraft(def, local, base).document).toBeNull();
  const changed = doc();
  changed.sourceId = 99;
  expect(mergeStudioDraft(changed, local, base).document).toBeNull();
  const moved = doc();
  moved.layouts.lg[0].y = 4;
  const latest = doc();
  latest.layouts.lg[1] = { ...latest.layouts.lg[1], x: 0, y: 4 };
  expect(mergeStudioDraft(latest, moved, base).blocked[0]).toMatch(/겹치/);
});
it('compares whole common scope and deletion conflicts explicitly', () => {
  const base = doc(),
    local = doc(),
    latest = doc();
  local.title = '내 대시보드';
  latest.title = '최신 대시보드';
  local.filters = [{ column: 'channel', values: ['web'] }];
  latest.filters = [{ column: 'channel', values: ['app'] }];
  local.blocks.pop();
  for (const bp of ['lg', 'md', 'xs'] as const) local.layouts[bp].pop();
  latest.blocks[1].description = '원격 변경';
  const r = mergeStudioDraft(latest, local, base);
  expect(r.conflicts).toHaveLength(3);
  expect(r.document?.blocks).toHaveLength(1);
});
it('requires no conflict choice when both tabs reached the same result', () => {
  const base = doc(),
    local = doc();
  local.blocks[0].title = '동일';
  expect(mergeStudioDraft(local, local, base).conflicts).toEqual([]);
});
