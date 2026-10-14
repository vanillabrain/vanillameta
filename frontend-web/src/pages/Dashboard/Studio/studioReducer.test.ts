import { describe, it, expect } from 'vitest';
import fixture from '../../../../../fixtures/studio/document-v1.json';
import { applyStudioOperation, createStudioState, remapStudioIds, studioReducer } from './studioReducer';
import { validateStudioDocument } from './studioDocument';
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
