import { expect, it } from 'vitest';
import { validateStudioReusePreview } from './studioReusePreviewContract';
import { mixedReusePreview } from './studioReusePreview.fixture';
it('accepts mixed display-only preview without source queries', () => {
  expect(validateStudioReusePreview(mixedReusePreview()).blocks).toHaveLength(2);
});
it('rejects_unknown_duplicate_missing_or_mixed_payload_blocks', () => {
  for (const mutate of [
    (v: any) => (v.blocks[0].kind = 'UNKNOWN'),
    (v: any) => (v.blocks[1].blockId = 'chart1'),
    (v: any) => v.blocks.pop(),
    (v: any) => (v.blocks[1].widget = {}),
    (v: any) => (v.blocks[0].widget.sql = 'SELECT secret'),
  ]) {
    const v = mixedReusePreview();
    mutate(v);
    expect(() => validateStudioReusePreview(v)).toThrow();
  }
});
it('all_breakpoint_layouts_reference_exact_block_set', () => {
  for (const mutate of [
    (v: any) => v.layouts.xs.pop(),
    (v: any) => (v.layouts.md[0].w = 99),
    (v: any) => (v.layouts.lg[1].id = 'other'),
  ]) {
    const v = mixedReusePreview();
    mutate(v);
    expect(() => validateStudioReusePreview(v)).toThrow();
  }
});
