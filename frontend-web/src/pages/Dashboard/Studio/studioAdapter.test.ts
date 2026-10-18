import { describe, it, expect } from 'vitest';
import { fromLegacyAnalysis, toLegacySave } from './studioAdapter';
import { applyStudioOperation, createStudioState } from './studioReducer';
const input = () => ({
  dashboardId: 23,
  analysis: {
    databaseId: 7,
    title: 'Auction',
    explanation: 'Original explanation',
    revision: 'a'.repeat(64),
    layoutSizes: [
      { width: 6, height: 3 },
      { width: 6, height: 5 },
    ],
    widgets: [
      {
        blockId: 'b1',
        title: 'Requests',
        description: 'Original',
        type: 'BOARD_NUMERIC',
        sql: 'SELECT SUM(requests) AS value FROM source',
        valueField: 'value',
        decimalPlaces: 0,
        numberNotation: 'compact',
        prefix: '',
        suffix: ' requests',
      },
      {
        blockId: 'b2',
        title: 'By device',
        description: 'Column direction',
        type: 'CHART_COLUMN',
        sql: 'SELECT device_type AS label, SUM(requests) AS value FROM source GROUP BY device_type',
        valueField: 'value',
        categoryField: 'label',
        numberNotation: 'full',
      },
    ],
    blockLayouts: { b1: { x: 0, y: 0, w: 6, h: 2 }, b2: { x: 6, y: 0, w: 6, h: 5 } },
  },
});
describe('Legacy analysis projection', () => {
  it('roundtrips the supported analysis fields including chart direction, exact suffix and numeric height2 without writing', () => {
    const original = input();
    const before = structuredClone(original);
    const imported = fromLegacyAnalysis(original);
    const projection = toLegacySave(imported.document, imported.definitions);
    const { revision, ...rest } = original.analysis;
    const draft = { ...rest };
    delete draft.blockLayouts;
    expect(projection.draft).toEqual(draft);
    expect(projection.blockLayouts.lg[0].h).toBe(2);
    expect(projection.expectedRevision).toBe(revision);
    expect(projection.requiresServerSnapshot).toBe(true);
    expect(original).toEqual(before);
    expect(projection.draft.widgets[1].type).toBe('CHART_COLUMN');
  });
  it('keeps SQL outside document/history and never invents canonical references from a label or SQL alias', () => {
    const result = fromLegacyAnalysis(input());
    expect(JSON.stringify(createStudioState(result.document))).not.toContain('SELECT');
    expect(JSON.stringify(result.document)).not.toContain('sql');
    expect(result.document.blocks[0].measureRefs).toEqual([]);
    expect(result.document.blocks[1].dimensionRefs).toEqual([]);
    expect(result.unresolvedReferences).toEqual(['b1', 'b2']);
    expect(result.definitions.entries['b1'].widget.sql).toContain('SELECT');
  });
  it('accepts only explicitly supplied versioned semantic refs and copies them independently', () => {
    const data = input();
    const semantics = {
      b1: { measureRefs: [{ id: 10, definitionVersion: 'saved-v1' }], dimensionRefs: [] },
      b2: { measureRefs: [], dimensionRefs: [{ key: 'device_type', sourceId: 7, schemaVersion: 'saved-source-v1' }] },
    };
    const result = fromLegacyAnalysis({ ...data, semanticSnapshot: semantics });
    expect(result.document.blocks[0].measureRefs).toEqual(semantics.b1.measureRefs);
    expect(result.unresolvedReferences).toEqual([]);
    result.document.blocks[0].measureRefs[0].definitionVersion = 'edited';
    expect(semantics.b1.measureRefs[0].definitionVersion).toBe('saved-v1');
    expect(() =>
      fromLegacyAnalysis({
        ...data,
        semanticSnapshot: { b2: { ...semantics.b2, dimensionRefs: [{ ...semantics.b2.dimensionRefs[0], sourceId: 999 }] } },
      }),
    ).toThrow();
  });
  it('uses deterministic legacy IDs and derives secondary layouts in visual reading order only at import', () => {
    const original = input();
    delete original.analysis.widgets[0].blockId;
    original.analysis.blockLayouts['legacy-23-0'] = original.analysis.blockLayouts.b1;
    delete original.analysis.blockLayouts.b1;
    const result = fromLegacyAnalysis(original);
    expect(result.document.blocks[0].id).toBe('legacy-23-0');
    expect(fromLegacyAnalysis(original).document).toEqual(result.document);
    expect(result.document.layouts.lg[0].h).toBe(2);
    expect(result.document.layouts.xs.map(g => g.y)).toEqual([0, 2]);
  });
  it('does not silently repair missing layouts, unsupported schemas, duplicate IDs, absent definitions or cross-source catalogs', () => {
    const data = input();
    for (const mutate of [
      (d: any) => delete d.analysis.blockLayouts,
      (d: any) => (d.analysis.widgets[1].blockId = 'b1'),
      (d: any) => (d.analysis.widgets[1].type = 'CUSTOM_JS'),
      (d: any) => (d.dashboardId = 0),
    ]) {
      const d = structuredClone(data);
      mutate(d);
      expect(() => fromLegacyAnalysis(d)).toThrow();
    }
    const imported = fromLegacyAnalysis(data);
    expect(() => toLegacySave({ ...imported.document, sourceId: 99 }, imported.definitions)).toThrow();
    const missing = structuredClone(imported.definitions);
    delete missing.entries['b1'];
    expect(() => toLegacySave(imported.document, missing)).toThrow();
  });
  it('imports a maximum-length persisted ID without truncation or definition-key overflow', () => {
    const data = input();
    const id = 'x'.repeat(128);
    data.analysis.widgets[0].blockId = id;
    data.analysis.blockLayouts[id] = data.analysis.blockLayouts.b1;
    delete data.analysis.blockLayouts.b1;
    const imported = fromLegacyAnalysis(data);
    expect(imported.document.blocks[0].id).toBe(id);
    expect(toLegacySave(imported.document, imported.definitions).draft.widgets[0].blockId).toBe(id);
  });
  it('requires the separate server revision after history removes it and rejects stale definition catalogs', () => {
    const imported = fromLegacyAnalysis(input());
    const state = createStudioState(imported.document);
    expect(() => toLegacySave(state.present, imported.definitions)).toThrow();
    expect(toLegacySave(state.present, imported.definitions, state.serverRevision).expectedRevision).toBe(
      input().analysis.revision,
    );
    expect(() => toLegacySave({ ...imported.document, revision: 'b'.repeat(64) }, imported.definitions)).toThrow();
  });
  it('maps definition by identity after reorder/delete/duplicate and separates geometry from legacy metadata', () => {
    const imported = fromLegacyAnalysis(input());
    let d = applyStudioOperation(imported.document, {
      type: 'duplicateBlock',
      blockId: 'b2',
      newId: 'new:11111111-1111-4111-8111-111111111111',
    });
    d = applyStudioOperation(d, { type: 'removeBlock', blockId: 'b1' });
    const p = toLegacySave(d, imported.definitions);
    expect(p.draft.widgets.map(w => w.title)).toEqual(['By device', 'By device']);
    expect(p.draft.widgets[0].blockId).toBe('b2');
    expect(p.draft.widgets[1].blockId).toBeUndefined();
    expect(p.blockLayouts.lg[1].id).toContain('new:');
    expect(p.draft.widgets[0].sql).toBe(input().analysis.widgets[1].sql);
  });
});

it('UC052 roundtrips defaultConditions and fails closed on malformed saved scope', () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate', column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const data = input();
  const imported = fromLegacyAnalysis({ ...data, analysis: { ...data.analysis, defaultConditions: conditions } });
  expect(imported.document.conditions).toEqual(conditions);
  const saved = toLegacySave(imported.document, imported.definitions);
  expect(saved.draft.defaultConditions).toEqual(conditions);
  const reimported = fromLegacyAnalysis({
    ...data,
    analysis: { ...saved.draft, revision: data.analysis.revision, blockLayouts: data.analysis.blockLayouts },
  });
  expect(reimported.document.conditions).toEqual(conditions);
  for (const value of [
    null,
    undefined,
    {},
    { ...conditions, sourceRevision: 'metadata-revision' },
    { ...conditions, definition: { include: null } },
  ])
    expect(() => fromLegacyAnalysis({ ...data, analysis: { ...data.analysis, defaultConditions: value } })).toThrow();
});
