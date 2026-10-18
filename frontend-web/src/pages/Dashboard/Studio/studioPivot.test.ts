import { expect, it } from 'vitest';
import { validateStudioDocument } from './studioDocument';
import { validateStudioPreview, validateStudioDefinitions } from './studioApi';
import { createStudioState, studioReducer } from './studioReducer';
import { mergeStudioDraft } from './studioDraftMerge';
import { pivotBlock, pivotRecipe, pivotDocument, pivotAggregate, mixedPivotDocument } from './studioPivot.fixture';
it('accepts a strict declarative Pivot without any SQL and rejects foreign recipe keys', () => {
  expect(validateStudioDocument(pivotDocument())).toEqual(pivotDocument());
  const bad: any = pivotDocument();
  bad.blocks[0].pivot.sql = 'SELECT secret';
  expect(() => validateStudioDocument(bad)).toThrow();
});
it('retains recipe across duplication, undo, redo and isolated layout edits', () => {
  let state = createStudioState(pivotDocument());
  state = studioReducer(state, {
    type: 'apply',
    operation: { type: 'duplicateBlock', blockId: pivotBlock().id, newId: 'new:00000000-0000-4000-8000-000000000002' },
  });
  expect((state.present.blocks[1] as any).pivot).toEqual(pivotRecipe());
  state = studioReducer(state, { type: 'undo' });
  expect(state.present.blocks).toHaveLength(1);
  state = studioReducer(state, { type: 'redo' });
  expect(state.present.blocks).toHaveLength(2);
});
it('accepts mixed preview with chart-only draft and SQL-free Pivot definitions', () => {
  const pivot = {
    blockId: pivotBlock().id,
    type: 'SEGMENT_PIVOT',
    title: 'Pivot',
    description: '',
    pivot: pivotAggregate(),
  };
  const chart = {
    blockId: 'chart1',
    type: 'BOARD_NUMERIC',
    title: '매출',
    sql: 'SELECT sum(amount) AS value FROM source',
    valueField: 'value',
    fields: ['value'],
    datas: [{ value: 500 }],
  };
  const preview = { draft: { databaseId: 4, title: '혼합', explanation: '', widgets: [chart] }, widgets: [chart, pivot] };
  expect(validateStudioPreview(preview).widgets[1]).toEqual(pivot);
  expect(
    validateStudioDefinitions({
      dashboardId: 3,
      sourceId: 4,
      revision: 'a'.repeat(64),
      explanation: '',
      entries: { 'pivot:1': { pivot: pivotRecipe() } },
    }).entries['pivot:1'],
  ).toEqual({ pivot: pivotRecipe() });
});
it('never silently combines a concurrently changed Pivot recipe with local title edits', () => {
  const base = pivotDocument(),
    mine = pivotDocument(),
    latest = pivotDocument();
  mine.blocks[0].title = '내 제목';
  (latest.blocks[0] as any).pivot.revision = 'd'.repeat(64);
  const result = mergeStudioDraft(latest, mine, base);
  expect(result.document).toBeNull();
  expect(result.blocked.length).toBeGreaterThan(0);
});
it.each(['sql', 'details', 'recipe'])('rejects non-aggregate %s payloads even in private previews', async key => {
  const { validateStudioPivotResult } = await import('./studioPivot');
  expect(() =>
    validateStudioPivotResult({ ...pivotAggregate(), [key]: key === 'details' ? { rows: [{ secret: 1 }] } : 'private' }),
  ).toThrow();
});
it('publishes only whitelisted aggregates and renders without drill or requests', async () => {
  const { validateStudioPivotResult } = await import('./studioPivot');
  const { sourceRevision, ...value } = pivotAggregate();
  delete value.viewRevision;
  expect(validateStudioPivotResult(value, true)).toEqual(value);
  expect(() => validateStudioPivotResult({ ...value, sourceRevision }, true)).toThrow();
});
it('projects chart-only legacy widgets plus an explicit ordered Pivot snapshot and imports without losing recipe', async () => {
  const { toLegacySave, fromLegacyAnalysis } = await import('./studioAdapter');
  const doc = mixedPivotDocument();
  doc.blocks[1].id = 'saved-pivot';
  for (const bp of ['lg', 'md', 'xs'] as const) doc.layouts[bp][1].id = 'saved-pivot';
  const projection = toLegacySave(doc, {
    dashboardId: 3,
    sourceId: 4,
    revision: 'a'.repeat(64),
    explanation: '',
    entries: {
      'pivot:1': { pivot: pivotRecipe() },
      chart1: {
        widget: {
          type: 'BOARD_NUMERIC',
          title: '기존 매출',
          description: '',
          sql: 'SELECT sum(amount) AS value FROM source',
          valueField: 'value',
        },
      },
    },
  });
  expect(projection.draft.widgets).toHaveLength(1);
  expect(JSON.stringify(projection.studioSnapshot)).not.toContain('sql');
  const imported = fromLegacyAnalysis({
    dashboardId: 3,
    analysis: { ...projection.draft, revision: 'a'.repeat(64), blockLayouts: { chart1: { x: 0, y: 0, w: 1, h: 6 } } },
    snapshot: projection.studioSnapshot,
  });
  expect(imported.document).toEqual(doc);
  expect(imported.definitions.entries['pivot:1']).toEqual({ pivot: pivotRecipe() });
});
it('rejects deleting the last chart in a mixed document and preserves its full recipe and geometry', () => {
  const document = mixedPivotDocument(),
    state = createStudioState(document),
    before = JSON.stringify(state);
  expect(() => studioReducer(state, { type: 'apply', operation: { type: 'removeBlock', blockId: 'chart1' } })).toThrow(
    /마지막 일반 차트/,
  );
  expect(JSON.stringify(state)).toBe(before);
});
it('blocks Pivot-only preview/save projection with no dummy SQL widget', async () => {
  const { studioPrepareBody, studioSaveBody } = await import('./studioApi');
  const request = {
    document: pivotDocument(),
    expectedRevision: 'a'.repeat(64),
    expectedSourceRevision: 'c'.repeat(64),
    requestId: 'request-one',
  };
  expect(() => studioPrepareBody(request)).toThrow(/일반 차트/);
  expect(() => studioSaveBody(request)).toThrow(/일반 차트/);
});
it('explains unsupported common-row conditions without exposing server details', async () => {
  const { toStudioApiError } = await import('./studioApi');
  const error = toStudioApiError({
    response: { status: 400, data: { message: 'SEGMENT_PIVOT_UNSUPPORTED: private/path condition' } },
  });
  expect(error.message).toContain('현재 초안을 보존');
  expect(error.message).not.toContain('private/path');
});

it('adds a full-width Pivot with height 10 on mobile and 8 on wider breakpoints while keeping chart defaults and duplicate sizes', () => {
  const document = mixedPivotDocument();
  document.blocks.pop();
  for (const bp of ['lg', 'md', 'xs'] as const) document.layouts[bp].pop();
  let state = createStudioState(document);
  state = studioReducer(state, { type: 'apply', operation: { type: 'addBlock', block: pivotBlock() } });
  for (const [bp, width] of [
    ['lg', 12],
    ['md', 8],
    ['xs', 1],
  ] as const) {
    expect(state.present.layouts[bp][1]).toMatchObject({ x: 0, w: width, h: bp === 'xs' ? 10 : 8 });
    expect(state.present.layouts[bp][0]).toEqual(document.layouts[bp][0]);
  }
  const chart = { ...document.blocks[0], id: 'new:00000000-0000-4000-8000-000000000003' };
  state = studioReducer(state, { type: 'apply', operation: { type: 'addBlock', block: chart } });
  expect(state.present.layouts.lg[2]).toMatchObject({ w: 6, h: 3 });
  state = studioReducer(state, {
    type: 'apply',
    operation: { type: 'duplicateBlock', blockId: pivotBlock().id, newId: 'new:00000000-0000-4000-8000-000000000004' },
  });
  expect(state.present.layouts.lg[3]).toMatchObject({ w: 12, h: 8 });
});
