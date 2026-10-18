import { describe, it, expect } from 'vitest';
import fixture from '../../../../../fixtures/studio/document-v1.json';
import { applyStudioOperation, createStudioState, remapStudioIds, studioReducer } from './studioReducer';
import { studioDateRangeKey, studioDateRangeSummary, studioScopeKey, validateStudioDocument } from './studioDocument';
import { StudioDocumentV1 } from './studioTypes';
const fresh = () => structuredClone(fixture) as StudioDocumentV1;
const newId = 'new:11111111-1111-4111-8111-111111111111';
describe('Studio operation identity and isolation', () => {
  it('moves only the target breakpoint and preserves original input and all other content', () => {
    const d = fresh();
    const next = applyStudioOperation(d, { type: 'moveBlock', blockId: 'b1', breakpoint: 'lg', x: 0, y: 6 });
    expect(next.layouts.lg[0].y).toBe(6);
    expect(next.blocks).toEqual(d.blocks);
    expect(next.layouts.md).toEqual(d.layouts.md);
    expect(d).toEqual(fixture);
  });
  it('duplicates with fresh identity and collision-free appended layouts at all breakpoints', () => {
    const d = fresh();
    const next = applyStudioOperation(d, { type: 'duplicateBlock', blockId: 'b1', newId });
    expect(next.blocks[2]).toEqual({ ...d.blocks[0], id: newId });
    for (const bp of ['lg', 'md', 'xs'] as const) {
      expect(next.layouts[bp][2].id).toBe(newId);
      expect(next.layouts[bp][2].y).toBe(Math.max(...d.layouts[bp].map(g => g.y + g.h)));
    }
    expect(() => applyStudioOperation(d, { type: 'duplicateBlock', blockId: 'b1', newId: 'b2' })).toThrow();
  });
  it('updates content without changing identity or any geometry and supports bounded resize', () => {
    const d = fresh();
    const changed = applyStudioOperation(d, { type: 'updateBlock', blockId: 'b1', patch: { title: '새 제목' } });
    expect(changed.layouts).toEqual(d.layouts);
    expect(changed.blocks[0].id).toBe('b1');
    expect(changed.blocks[1]).toEqual(d.blocks[1]);
    expect(
      applyStudioOperation(d, { type: 'resizeBlock', blockId: 'b1', breakpoint: 'lg', w: 5, h: 2 }).layouts.lg[0].w,
    ).toBe(5);
  });
  it('rejects invalid operations without mutating the document', () => {
    const d = fresh();
    for (const operation of [
      { type: 'moveBlock', blockId: 'b1', breakpoint: 'lg', x: 6, y: 0 },
      { type: 'moveBlock', blockId: 'missing', breakpoint: 'lg', x: 0, y: 8 },
      { type: 'resizeBlock', blockId: 'b1', breakpoint: 'xs', w: 2, h: 1 },
      { type: 'updateBlock', blockId: 'b1', patch: { id: 'hijack' } },
      { type: 'renameDashboard', title: '' },
      { type: 'moveBlock', blockId: 'b1', breakpoint: 'other', x: 0, y: 3 },
      { type: 'removeBlock', blockId: 'b1', extra: 'credential' },
    ])
      expect(() => applyStudioOperation(d, operation as any)).toThrow();
    expect(d).toEqual(fixture);
  });
  it('rejects malformed display patches instead of silently dropping invalid input', () => {
    for (const display of [null, [], { unknown: 'value' }])
      expect(() =>
        applyStudioOperation(fresh(), { type: 'updateBlock', blockId: 'b1', patch: { display } } as any),
      ).toThrow();
  });
  it('supports explicit add, remove all into an empty draft, and enforces the initial six-block limit', () => {
    let d = fresh();
    for (let i = 1; i <= 4; i++)
      d = applyStudioOperation(d, {
        type: 'addBlock',
        block: { ...d.blocks[0], id: `new:00000000-0000-4000-8000-${String(i).padStart(12, '0')}` },
      });
    expect(d.blocks).toHaveLength(6);
    expect(() => applyStudioOperation(d, { type: 'duplicateBlock', blockId: 'b1', newId })).toThrow();
    for (const b of [...d.blocks]) d = applyStudioOperation(d, { type: 'removeBlock', blockId: b.id });
    expect(d.blocks).toHaveLength(0);
    expect(d.layouts).toEqual({ lg: [], md: [], xs: [] });
  });
});
describe('Studio history', () => {
  it('merges display changes and treats field-order-only changes as no-ops', () => {
    const d = fresh();
    const changed = applyStudioOperation(d, { type: 'updateBlock', blockId: 'b1', patch: { display: { prefix: '₩' } } });
    expect(changed.blocks[0].display).toEqual({ ...d.blocks[0].display, prefix: '₩' });
    const state = createStudioState(d);
    const same = studioReducer(state, {
      type: 'apply',
      operation: { type: 'updateBlock', blockId: 'b1', patch: { display: { decimalPlaces: 0, numberNotation: 'compact' } } },
    });
    expect(same).toEqual(state);
  });
  it('clears selection on deletion and supports exact undo/redo plus no-op history', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'select', blockId: 'b1' });
    s = studioReducer(s, { type: 'apply', operation: { type: 'removeBlock', blockId: 'b1' } });
    expect(s.selectedBlockId).toBeNull();
    const undone = studioReducer(s, { type: 'undo' });
    expect(undone.present.blocks).toEqual(fixture.blocks);
    expect(undone.saveState).toBe('clean');
    expect(studioReducer(undone, { type: 'redo' }).present).toEqual(s.present);
    const same = studioReducer(undone, { type: 'apply', operation: { type: 'renameDashboard', title: fixture.title } });
    expect(same).toEqual(undone);
    const renamed = studioReducer(undone, { type: 'apply', operation: { type: 'renameDashboard', title: 'Changed' } });
    expect(renamed.future).toEqual([]);
  });
  it('caps history at 100 and keeps panel/breakpoint/selection out of history', () => {
    let s = createStudioState(fresh());
    for (let i = 0; i < 101; i++)
      s = studioReducer(s, { type: 'apply', operation: { type: 'renameDashboard', title: `Title ${i}` } });
    expect(s.past).toHaveLength(100);
    const old = s.past;
    s = studioReducer(s, { type: 'breakpoint', breakpoint: 'xs' });
    s = studioReducer(s, { type: 'panel', panel: 'settings' });
    s = studioReducer(s, { type: 'select', blockId: 'b2' });
    expect(s.past).toEqual(old);
    expect(s.present.revision).toBeUndefined();
    expect(s.serverRevision).toBe(fixture.revision);
  });
  it('remaps saved IDs across present, undo, redo, baseline and selection without resetting history', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'duplicateBlock', blockId: 'b1', newId } });
    s = studioReducer(s, { type: 'select', blockId: newId });
    s = studioReducer(s, { type: 'apply', operation: { type: 'renameDashboard', title: 'Changed' } });
    s = studioReducer(s, { type: 'undo' });
    s = studioReducer(s, { type: 'saveStarted', requestId: 'save-1' });
    const n = studioReducer(s, {
      type: 'saved',
      requestId: 'save-1',
      revision: 'b'.repeat(64),
      idMap: { [newId]: 'block-saved' },
    });
    expect(n.selectedBlockId).toBe('block-saved');
    expect(n.saveState).toBe('clean');
    expect(JSON.stringify(n)).not.toContain(newId);
    expect(studioReducer(n, { type: 'redo' }).present.blocks[2].id).toBe('block-saved');
    expect(studioReducer(n, { type: 'undo' }).present.blocks).toHaveLength(2);
    expect(s.present.blocks[2].id).toBe(newId);
  });
  it('marks only the submitted snapshot saved while retaining later edits as dirty', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'saveStarted', requestId: 'save-1' });
    s = studioReducer(s, { type: 'apply', operation: { type: 'renameDashboard', title: 'Edited while saving' } });
    const saved = studioReducer(s, { type: 'saved', requestId: 'save-1', revision: 'b'.repeat(64), idMap: {} });
    expect(saved.present.title).toBe('Edited while saving');
    expect(saved.savedBaseline.title).toBe(fixture.title);
    expect(saved.saveState).toBe('dirty');
    expect(saved.pendingSave).toBeNull();
    expect(studioReducer(saved, { type: 'undo' }).saveState).toBe('clean');
  });
  it('rejects missing submitted IDs, wrong responses and a second save in flight', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'duplicateBlock', blockId: 'b1', newId } });
    s = studioReducer(s, { type: 'saveStarted', requestId: 'save-1' });
    expect(() => studioReducer(s, { type: 'saved', requestId: 'save-1', revision: 'b'.repeat(64), idMap: {} })).toThrow();
    expect(() =>
      studioReducer(s, { type: 'saved', requestId: 'other', revision: 'b'.repeat(64), idMap: { [newId]: 'saved-new' } }),
    ).toThrow();
    expect(() => studioReducer(s, { type: 'saveStarted', requestId: 'save-2' })).toThrow();
    const failed = studioReducer(s, { type: 'saveFailed', requestId: 'save-1' });
    expect(failed.pendingSave).toBeNull();
    expect(failed.saveState).toBe('dirty');
  });
  it('rejects ID collisions, rewriting persisted IDs, unknown IDs and malformed revision', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'duplicateBlock', blockId: 'b1', newId } });
    for (const map of [{ [newId]: 'b1' }, { b1: 'new-name' }, { 'new:22222222-2222-4222-8222-222222222222': 'block-new' }])
      expect(() => remapStudioIds(s, map)).toThrow();
    expect(() => studioReducer(s, { type: 'saved', requestId: 'save-1', revision: 'bad', idMap: {} })).toThrow();
  });
});
describe('Studio document boundary', () => {
  it('accepts the shared protocol fixture but rejects incompatible references, fields, types and layout identities', () => {
    expect(validateStudioDocument(fixture)).toEqual(fixture);
    const sparse = fresh();
    delete sparse.blocks[0];
    expect(() => validateStudioDocument(sparse)).toThrow();
    for (const mutate of [
      (d: any) => (d.schemaVersion = 2),
      (d: any) => (d.sourceId = 0),
      (d: any) => (d.blocks[0].kind = 'JS_CODE'),
      (d: any) => (d.blocks[0].sql = 'secret'),
      (d: any) => (d.blocks[0].measureRefs[0].id = 0),
      (d: any) => (d.blocks[1].dimensionRefs[0].sourceId = 99),
      (d: any) => (d.layouts.lg[0].x = -1),
      (d: any) => (d.layouts.lg[0].w = NaN),
      (d: any) => d.layouts.xs.pop(),
      (d: any) => (d.layouts.lg[1].id = 'b1'),
    ]) {
      const d = fresh();
      mutate(d);
      expect(() => validateStudioDocument(d)).toThrow();
    }
  });
});

describe('Studio common filter scope', () => {
  const scope = [{ column: 'device_type', values: ['Mobile/Tablet', 1, true, null] }];
  it('applies one scope as a single history entry, clears the optional property, and undoes exactly', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'setFilters', filters: scope } });
    expect(s.present.filters).toEqual(scope);
    expect(s.past).toHaveLength(1);
    expect(s.saveState).toBe('dirty');
    expect(studioReducer(s, { type: 'apply', operation: { type: 'setFilters', filters: structuredClone(scope) } })).toEqual(
      s,
    );
    const cleared = studioReducer(s, { type: 'apply', operation: { type: 'setFilters', filters: [] } });
    expect('filters' in cleared.present).toBe(false);
    const undone = studioReducer(cleared, { type: 'undo' });
    expect(undone.present.filters).toEqual(scope);
    expect(studioReducer(undone, { type: 'redo' }).present.filters).toBeUndefined();
  });
  it('keeps the filter list in the saved baseline so only a real change stays dirty', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'setFilters', filters: scope } });
    s = studioReducer(s, { type: 'saveStarted', requestId: 'save-1' });
    const saved = studioReducer(s, { type: 'saved', requestId: 'save-1', revision: 'b'.repeat(64), idMap: {} });
    expect(saved.saveState).toBe('clean');
    expect(saved.savedBaseline.filters).toEqual(scope);
    expect(saved.present.filters).toEqual(scope);
  });
  it('rejects a scope the server would refuse without mutating the document', () => {
    const d = fresh();
    for (const filters of [
      [{ column: 'device_type', values: [] }],
      [{ column: 'device_type', values: ['a', 'a'] }],
      [{ column: 'device_type', values: [1, '1', true, null, 1] }],
      [{ column: 'device_type', values: [{ nested: 1 }] }],
      [
        { column: 'a', values: [1] },
        { column: 'a', values: [2] },
      ],
      Array.from({ length: 6 }, (_, index) => ({ column: 'c' + index, values: [index] })),
      [{ column: 'device_type', values: ['x'.repeat(2001)] }],
      [{ column: 'device_type', values: [1], extra: 'secret' }],
    ])
      expect(() => applyStudioOperation(d, { type: 'setFilters', filters } as any)).toThrow();
    expect(d).toEqual(fixture);
    expect(validateStudioDocument({ ...fresh(), filters: [{ column: 'device_type', values: [null] }] }).filters).toEqual([
      { column: 'device_type', values: [null] },
    ]);
    expect(() => validateStudioDocument({ ...fresh(), filters: [{ column: 'device_type', values: [] }] })).toThrow();
  });
});

describe('Studio common date range', () => {
  const range = { column: 'created_at', start: '2024-01-01', end: '2024-01-31' };
  it('applies one period as a single history entry and removes the property when cleared', () => {
    let s = createStudioState(fresh());
    s = studioReducer(s, { type: 'apply', operation: { type: 'setDateRange', dateRange: range } });
    expect(s.present.dateRange).toEqual(range);
    expect(s.past).toHaveLength(1);
    expect(s.saveState).toBe('dirty');
    expect(studioReducer(s, { type: 'apply', operation: { type: 'setDateRange', dateRange: { ...range } } })).toEqual(s);
    const cleared = studioReducer(s, { type: 'apply', operation: { type: 'setDateRange', dateRange: null } });
    expect('dateRange' in cleared.present).toBe(false);
    const undone = studioReducer(cleared, { type: 'undo' });
    expect(undone.present.dateRange).toEqual(range);
    expect(studioReducer(undone, { type: 'redo' }).present.dateRange).toBeUndefined();
  });
  it('rejects a period the server would refuse without mutating the document', () => {
    const d = fresh();
    const refused = [
      { column: 'created_at', start: '2024-02-31', end: '2024-03-05' },
      { column: 'created_at', start: '0000-01-01', end: '2024-01-01' },
      { column: 'created_at', start: '2024-01-01', end: '9999-12-31' },
      { column: 'created_at', start: '2024-03-05', end: '2024-01-01' },
      { column: 'created_at', start: '2024-01-01', end: '2024-01-31', precision: 'date' },
      { column: 'created_at', start: '2024-01-01', end: '2024-01-31', timeZone: undefined },
      { column: '', start: '2024-01-01', end: '2024-01-31' },
      { column: 'c'.repeat(129), start: '2024-01-01', end: '2024-01-31' },
      { column: 'created_at', start: '2024-01-01', end: '2024-01-31', extra: 'secret' },
    ] as any[];
    for (const dateRange of refused)
      expect(() => applyStudioOperation(d, { type: 'setDateRange', dateRange } as any)).toThrow();
    expect(d).toEqual(fixture);
    // The instant shape round-trips with its business timezone and exclusive end.
    const instant = {
      column: 'created_at',
      start: '2024-01-01T00:00:00Z',
      end: '2024-02-01T00:00:00Z',
      precision: 'timestamp' as const,
      timeZone: 'Asia/Seoul',
    };
    expect(validateStudioDocument({ ...fresh(), dateRange: instant }).dateRange).toEqual(instant);
  });
  it('keeps a stable scope key and a readable summary that never overstates the range', () => {
    expect(studioDateRangeSummary(null)).toBe('전체 기간');
    expect(studioDateRangeKey(null)).toBe('');
    expect(studioDateRangeKey(range)).toBe(studioDateRangeKey({ ...range }));
    expect(studioDateRangeSummary(range)).toContain('created_at');
    expect(studioDateRangeSummary({ ...range, timeZone: 'Asia/Seoul' })).toContain('Asia/Seoul');
    expect(studioDateRangeSummary({ column: 'created_at', start: '2024-01-01', end: '2024-01-01' })).toContain('2024-01-01');
    expect(studioScopeKey(undefined, null)).toBe(studioScopeKey([], null));
    expect(studioScopeKey(undefined, range)).not.toBe(studioScopeKey(undefined, null));
    expect(studioScopeKey([{ column: 'device_type', values: [1] }], range)).not.toBe(studioScopeKey(undefined, range));
    expect(() => studioScopeKey(undefined, { ...range, end: '9999-12-31' })).toThrow();
    expect(() => studioScopeKey([{ column: 'a', values: [] }], null)).toThrow();
  });
});

it('UC052 apply/clear/undo/redo and content edits preserve exact immutable condition scope', () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  expect(studioScopeKey(undefined, null, conditions)).not.toBe(studioScopeKey(undefined, null));
  let state = createStudioState(fresh());
  state = studioReducer(state, { type: 'apply', operation: { type: 'setConditions', conditions } });
  expect(state.saveState).toBe('dirty');
  expect(state.present.conditions).toEqual(conditions);
  expect(state.present.blocks).toEqual(fixture.blocks);
  expect(state.present.layouts).toEqual(fixture.layouts);
  const edited = studioReducer(state, {
    type: 'apply',
    operation: { type: 'updateBlock', blockId: 'b1', patch: { title: 'AI title' } },
  });
  expect(edited.present.conditions).toEqual(conditions);
  state = studioReducer(state, { type: 'apply', operation: { type: 'setConditions', conditions: null } });
  expect(state.present.conditions).toBeUndefined();
  expect(studioReducer(state, { type: 'undo' }).present.conditions).toEqual(conditions);
  expect(studioReducer(studioReducer(state, { type: 'undo' }), { type: 'redo' }).present.conditions).toBeUndefined();
  for (const invalid of [
    { ...conditions, provenance: 'unverified' },
    { ...conditions, definition: { include: undefined, exclude: null } },
    {
      ...conditions,
      definition: { include: { kind: 'predicate', column: 'a', operator: 'eq', values: [null] }, exclude: null },
    },
  ])
    expect(() => applyStudioOperation(fresh(), { type: 'setConditions', conditions: invalid } as any)).toThrow();
});
