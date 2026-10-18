import { parseExploreViewState, ExploreViewState } from '../../Explore/exploreViewState';
import type { SegmentResult } from '../../Explore/AggregateSegment';
import type { StudioDocumentV1 } from './studioTypes';
export type StudioPivotRecipe = { revision: string; state: ExploreViewState };
export type StudioPivotResult = Pick<SegmentResult, 'scope' | 'kpis' | 'groups' | 'groupsTruncated' | 'pivot'> &
  Partial<Pick<SegmentResult, 'sourceRevision' | 'viewRevision' | 'trends' | 'trendsTruncated'>>;
function assert(ok: unknown): asserts ok {
  if (!ok) throw new Error('Pivot 기준 또는 집계 결과를 확인하지 못했습니다. 초안은 유지됩니다.');
}
const object = (v: any, required: string[], optional: string[] = []) => {
  assert(v && typeof v === 'object' && !Array.isArray(v));
  assert(
    required.every(k => Object.prototype.hasOwnProperty.call(v, k)) &&
      Object.keys(v).every(k => [...required, ...optional].includes(k)),
  );
};
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validateStudioPivotRecipe(v: any): StudioPivotRecipe {
  object(v, ['revision', 'state']);
  assert(hash(v.revision));
  const state = parseExploreViewState(v.state);
  assert(
    state.mode === 'segment' && !!state.segment?.pivotColumn && state.pivot === undefined && state.conditions === undefined,
  );
  return { revision: v.revision, state };
}
export const studioCanonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(studioCanonical)
    : v && typeof v === 'object'
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, studioCanonical(v[k])]),
      )
    : v;
export const studioPivotKey = (v: unknown) => JSON.stringify(studioCanonical(v));
export const hasStudioPivot = (d: StudioDocumentV1) => d.blocks.some(b => b.kind === 'SEGMENT_PIVOT');
/** Calculation identity excludes presentation/title/geometry; never uses a SQL fallback for a Pivot. */
export const studioCalculationKey = (d: StudioDocumentV1) =>
  studioPivotKey({
    sourceId: d.sourceId,
    filters: d.filters ?? [],
    dateRange: d.dateRange ?? null,
    conditions: d.conditions ?? null,
    blocks: d.blocks.map(b => ({
      id: b.id,
      kind: b.kind,
      definitionKey: b.definitionKey,
      pivot: b.pivot,
      measureRefs: b.measureRefs,
      dimensionRefs: b.dimensionRefs,
      timeGrain: b.display.timeGrain,
    })),
  });
export function validateStudioPivotResult(v: any, publicSnapshot = false): StudioPivotResult {
  object(
    v,
    ['scope', 'kpis', 'groups', 'groupsTruncated', 'pivot', ...(!publicSnapshot ? ['sourceRevision', 'viewRevision'] : [])],
    ['trends', 'trendsTruncated'],
  );
  for (const k of ['sourceRevision', 'viewRevision']) if (v[k] !== undefined) assert(hash(v[k]));
  const scalar = (x: any) =>
    x === null ||
    typeof x === 'boolean' ||
    (typeof x === 'number' && Number.isFinite(x)) ||
    (typeof x === 'string' && x.length <= 10000);
  const numeric = (x: any) =>
    x === null ||
    (typeof x === 'number' && Number.isFinite(x)) ||
    (typeof x === 'string' && x.length <= 128 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(x));
  const count = (x: any) => (Number.isSafeInteger(x) && x >= 0) || (typeof x === 'string' && /^\d{1,24}$/.test(x));
  const text = (x: any) => typeof x === 'string' && x.length > 0 && x.length <= 10000;
  object(v.scope, ['dimensionColumn', 'totalGroups', 'rows']);
  assert(text(v.scope.dimensionColumn) && count(v.scope.totalGroups) && count(v.scope.rows));
  assert(Array.isArray(v.kpis) && v.kpis.length >= 1 && v.kpis.length <= 6);
  const ids = new Set<number>();
  v.kpis.forEach((m: any, index: number) => {
    object(m, ['id', 'label', 'value', 'unit', 'decimalPlaces']);
    assert(
      Number.isSafeInteger(m.id) &&
        m.id > 0 &&
        !ids.has(m.id) &&
        text(m.label) &&
        numeric(m.value) &&
        typeof m.unit === 'string' &&
        m.unit.length <= 100 &&
        Number.isInteger(m.decimalPlaces) &&
        m.decimalPlaces >= 0 &&
        m.decimalPlaces <= 6,
    );
    if (publicSnapshot) assert(m.id === index + 1);
    ids.add(m.id);
  });
  const values = (xs: any) => {
    assert(Array.isArray(xs) && xs.length <= ids.size);
    const seen = new Set();
    xs.forEach((x: any) => {
      object(x, ['id', 'value']);
      assert(ids.has(x.id) && !seen.has(x.id) && numeric(x.value));
      seen.add(x.id);
    });
  };
  assert(typeof v.groupsTruncated === 'boolean' && Array.isArray(v.groups) && v.groups.length <= 50);
  v.groups.forEach((g: any) => {
    object(g, ['category', 'values']);
    assert(scalar(g.category));
    values(g.values);
  });
  object(v.pivot, ['column', 'columns', 'rows', 'truncatedColumns', 'columnLimit']);
  assert(
    text(v.pivot.column) &&
      typeof v.pivot.truncatedColumns === 'boolean' &&
      v.pivot.columnLimit === 20 &&
      Array.isArray(v.pivot.columns) &&
      v.pivot.columns.length <= 20 &&
      Array.isArray(v.pivot.rows) &&
      v.pivot.rows.length <= 50,
  );
  v.pivot.columns.forEach((c: any) => {
    object(c, ['value', 'totals']);
    assert(scalar(c.value));
    values(c.totals);
  });
  v.pivot.rows.forEach((r: any) => {
    object(r, ['category', 'cells']);
    assert(scalar(r.category) && Array.isArray(r.cells) && r.cells.length <= 20);
    r.cells.forEach((c: any) => {
      object(c, ['column', 'values']);
      assert(scalar(c.column));
      values(c.values);
    });
  });
  if (v.trends !== undefined) {
    assert(Array.isArray(v.trends) && v.trends.length <= 200);
    v.trends.forEach((t: any) => {
      object(t, ['time', 'values']);
      assert(text(t.time));
      values(t.values);
    });
  }
  if (v.trendsTruncated !== undefined) assert(typeof v.trendsTruncated === 'boolean');
  assert(new TextEncoder().encode(JSON.stringify(v)).length <= 1024 * 1024);
  return JSON.parse(JSON.stringify(v));
}
export const studioPivotMetricText =
  (format: (value: unknown, options: any) => { text: string }) =>
  (metric: StudioPivotResult['kpis'][number], value: unknown) => {
    const currency = ['$', '€', '₩', '£', '¥'].includes(metric.unit.trim());
    return format(value, {
      decimalPlaces: metric.decimalPlaces,
      numberNotation: 'full',
      prefix: currency ? metric.unit.trim() : '',
      suffix: currency ? '' : metric.unit.trim() ? ` ${metric.unit.trim()}` : '',
    }).text;
  };
