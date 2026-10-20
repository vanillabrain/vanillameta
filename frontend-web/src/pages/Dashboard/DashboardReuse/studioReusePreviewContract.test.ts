import { expect, it } from 'vitest';
import { validateStudioReusePreview, validateReuseAnalysisBasis } from './studioReusePreviewContract';
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

it('rejects malformed trend and missing chart result fields before rendering', () => {
  for (const mutate of [
    (w: any) => (w.trend = { grain: 'day', points: 42 }),
    (w: any) => (w.trend = { grain: 'day', points: [null] }),
    (w: any) => (w.trend = { grain: 'day', points: [{ time: 'bad', value: 1 }] }),
    (w: any) => (w.trend = { grain: 'day', points: [{ time: '2026-01-01', value: {} }] }),
    (w: any) => (w.datas = [{ other: 500 }]),
    (w: any) => (w.fields = []),
    (w: any) => (w.datas[0].value = 'not a number'),
    (w: any) => {
      w.type = 'CHART_BAR';
      w.categoryField = 'category';
    },
  ]) {
    const v = mixedReusePreview();
    mutate(v.blocks[0].widget);
    v.blocks[0].kind = v.blocks[0].widget.type;
    expect(() => validateStudioReusePreview(v)).toThrow();
  }
});

it('validates the target basis without accepting SQL, malformed typed filters or dates', () => {
  const basis = {
    sourceId: 30,
    sourceName: '내 파일',
    filters: [{ column: 'customer', values: ['1', 1, null] }],
    dateRange: { column: 'event_day', start: '2025-01-06', end: '2025-01-10', timeZone: 'UTC' },
  };
  expect(validateReuseAnalysisBasis(basis)).toEqual(basis);
  for (const value of [
    { ...basis, sql: 'SELECT secret' },
    { ...basis, sourceId: 0 },
    { ...basis, filters: [{ column: 'customer', values: [{}] }] },
    { ...basis, dateRange: { ...basis.dateRange, start: 'not-a-date' } },
  ]) {
    expect(() => validateReuseAnalysisBasis(value)).toThrow();
  }
});

it.each(['hour', 'day', 'week', 'month'])('preserves supported numeric trend grain %s in mixed previews', grain => {
  const value = mixedReusePreview();
  value.blocks[0].widget.trend = { grain, points: [{ time: '2025-01-06T09:00:00Z', value: 2400 }] };
  expect(validateStudioReusePreview(value).blocks[0]).toEqual(value.blocks[0]);
});

it.each(['minute', 'unknown'])('rejects unsupported numeric trend grain %s', grain => {
  const value = mixedReusePreview();
  value.blocks[0].widget.trend = { grain, points: [{ time: '2025-01-06T09:00:00Z', value: 2400 }] };
  expect(() => validateStudioReusePreview(value)).toThrow();
});
