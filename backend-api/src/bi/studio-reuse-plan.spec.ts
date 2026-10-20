import { captureStudioReuseOrigin, prepareStudioReusePlan } from './studio-reuse-plan';
import { studioReuseFixture } from './studio-reuse.fixture';
const capture = (f = studioReuseFixture()) => captureStudioReuseOrigin(f);
describe('mixed saved Studio reuse plan', () => {
  it('stored_scope_mismatch_is_never_ignored', () => {
    const f = studioReuseFixture();
    f.document.filters = [{ column: 'company', values: ['Baro Tech'] }];
    expect(() => capture(f)).toThrow();
  });
  it('mixed_order_is_keyed_not_widget_index', () => {
    const f = studioReuseFixture(),
      origin = capture(f);
    const plan = prepareStudioReusePlan(origin, f.target, {
      title: 'Copy',
      columnMap: f.columnMap,
      blockIds: ['pivot-a', 'chart-a'],
    });
    expect(plan.blocks.map(b => b.original.id)).toEqual(['chart-a', 'pivot-a']);
    expect(plan.layouts).toEqual(f.document.layouts);
    expect(plan.graph.nodes).toHaveLength(2);
    expect(plan.blocks[1].pivot).toMatchObject({
      dimensionColumn: 'customer',
      pivotColumn: 'service',
      measureKeys: ['candidate:1', 'candidate:2'],
      conditions: [
        { measureId: 'candidate:1', operator: 'gte', value: 1000 },
        { measureId: 'candidate:2', operator: 'lt', value: 20 },
      ],
    });
  });
  it('missing_studio_state_never_falls_back', () => {
    const f = studioReuseFixture();
    f.document = undefined;
    expect(() => capture(f)).toThrow();
  });
  it('legacy_pivot_order_mismatch_is_rejected', () => {
    const f = studioReuseFixture();
    f.snapshot.studioBlockOrder.reverse();
    expect(() => capture(f)).toThrow();
  });
  it('explicit_exclusion_removes_only_unused_requirements', () => {
    const f = studioReuseFixture(),
      o = capture(f);
    const p = prepareStudioReusePlan(o, f.target, {
      title: 'Chart copy',
      columnMap: { revenue: 'sales', day: 'event_day' },
      blockIds: ['chart-a'],
    });
    expect(p.blocks).toHaveLength(1);
    expect(p.graph.nodes).toHaveLength(1);
    expect(() =>
      prepareStudioReusePlan(o, f.target, {
        title: 'Pivot only',
        columnMap: f.columnMap,
        blockIds: ['pivot-a'],
      }),
    ).toThrow();
  });
  it('chart_only_copies_require_and_preserve_implicit_numeric_trend_date', () => {
    const f = studioReuseFixture(),
      origin = capture(f);
    expect(origin.entries[0].columns).toContain('day');
    expect(() =>
      prepareStudioReusePlan(origin, f.target, {
        title: 'Chart copy',
        columnMap: { revenue: 'sales' },
        blockIds: ['chart-a'],
      }),
    ).toThrow();
    f.target.columns.unshift({
      name: 'unrelated_date',
      type: 'TIMESTAMP',
      temporal: true,
      numeric: false,
    });
    expect(() =>
      prepareStudioReusePlan(origin, f.target, {
        title: 'Chart copy',
        columnMap: f.columnMap,
        blockIds: ['chart-a'],
      }),
    ).toThrow();
  });
  it('two_axes_or_filter_columns_cannot_merge_implicitly', () => {
    const f = studioReuseFixture();
    expect(() =>
      prepareStudioReusePlan(capture(f), f.target, {
        title: 'Bad',
        columnMap: { ...f.columnMap, component: 'customer' },
        blockIds: ['chart-a', 'pivot-a'],
      }),
    ).toThrow();
  });
  it('a_different_implicit_target_trend_date_is_rejected_before_save', () => {
    const f = studioReuseFixture();
    f.target.columns.unshift({
      name: 'other_date',
      type: 'TIMESTAMP',
      numeric: false,
      temporal: true,
    });
    expect(() =>
      prepareStudioReusePlan(capture(f), f.target, {
        title: 'Copy',
        columnMap: f.columnMap,
        blockIds: ['chart-a', 'pivot-a'],
      }),
    ).toThrow();
  });
  it('unsupported_blocks_require_explicit_exclusion', () => {
    const f = studioReuseFixture();
    f.document.blocks[1].businessBasis = { sourceId: 1 };
    f.snapshot.studioPivots = [f.document.blocks[1]];
    // A malformed business basis is rejected by the document validator, never ignored.
    expect(() => capture(f)).toThrow();
  });
  it('stale_pivot_catalog_or_measure_refs_are_rejected', () => {
    const f = studioReuseFixture();
    f.catalog.viewRevision = 'd'.repeat(64);
    expect(() => capture(f)).toThrow();
    const g = studioReuseFixture();
    g.document.blocks[1].measureRefs[0].definitionVersion = '99';
    expect(() => capture(g)).toThrow();
  });
});
