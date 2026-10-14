import { describe, it, expect } from 'vitest';
import fixture from '../../../../../fixtures/studio/document-v1.json';
import { createStudioState, studioReducer } from './studioReducer';
import { studioOrderOperations } from './studioEditing';
import { StudioDocumentV1 } from './studioTypes';
describe('Studio editing gestures', () => {
  it('reorders once, preserves content and other viewports, and undoes exactly', () => {
    const s = createStudioState(structuredClone(fixture) as StudioDocumentV1);
    const operations = studioOrderOperations(s.present, 'xs', 'b2', -1);
    const n = studioReducer(s, { type: 'applyBatch', operations });
    expect(n.past).toHaveLength(1);
    expect(n.present.layouts.xs.find(g => g.id === 'b2')?.y).toBe(0);
    expect(n.present.layouts.lg).toEqual(s.present.layouts.lg);
    expect(n.present.blocks).toEqual(s.present.blocks);
    expect(studioReducer(n, { type: 'undo' }).present).toEqual(s.present);
    expect(studioReducer(studioReducer(n, { type: 'undo' }), { type: 'redo' }).present).toEqual(n.present);
  });
  it('keeps state atomic when a later operation fails', () => {
    const s = createStudioState(structuredClone(fixture) as StudioDocumentV1);
    expect(() =>
      studioReducer(s, {
        type: 'applyBatch',
        operations: [
          { type: 'renameDashboard', title: 'Changed' },
          { type: 'removeBlock', blockId: 'missing' },
        ],
      }),
    ).toThrow();
    expect(s.present.title).toBe(fixture.title);
    expect(s.past).toHaveLength(0);
  });
  it('has no history for boundary order or viewport/selection changes', () => {
    const s = createStudioState(structuredClone(fixture) as StudioDocumentV1);
    expect(studioReducer(s, { type: 'applyBatch', operations: studioOrderOperations(s.present, 'xs', 'b1', -1) })).toEqual(
      s,
    );
    const n = studioReducer(studioReducer(s, { type: 'select', blockId: 'b1' }), { type: 'breakpoint', breakpoint: 'xs' });
    expect(n.past).toHaveLength(0);
    expect(n.present).toEqual(s.present);
  });
});
