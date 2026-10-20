import { describe, expect, it } from 'vitest';
import { RECOVERY_DASHBOARD_TITLE_KEY, recoveryPlan } from './editorRecovery';

type TestRect = { x: number; y: number; w: number; h: number };

type TestItem = {
  key: string;
  kind: 'metric' | 'existing' | 'draft';
  title: string;
  chart: 'number' | 'bar' | 'line';
  dimension?: string;
  unit: string;
  decimalPlaces: number;
  numberNotation: 'plain' | 'compact';
  width: number;
  height: number;
  layouts?: Partial<Record<'mobile' | 'tablet' | 'desktop', TestRect>>;
  metricId?: number;
  definition?: Record<string, unknown>;
  savedDefinition?: Record<string, unknown>;
};

const rect = (x: number, y: number, w: number, h: number): TestRect => ({ x, y, w, h });

const savedWidget = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: '매출',
  description: '월별 매출 합계',
  type: 'CHART_COLUMN',
  sql: 'SELECT "month" AS category, SUM("amount") AS value FROM uploaded_data GROUP BY "month"',
  valueField: 'value',
  categoryField: 'category',
  prefix: '₩',
  suffix: '',
  decimalPlaces: 2,
  numberNotation: 'compact',
  blockId: 'block-1',
  ...overrides,
});

const block = (overrides: Partial<TestItem> = {}): TestItem => ({
  key: 'block-1',
  kind: 'existing',
  title: '매출',
  chart: 'bar',
  dimension: 'month',
  unit: '원',
  decimalPlaces: 2,
  numberNotation: 'compact',
  width: 6,
  height: 5,
  layouts: { mobile: rect(0, 0, 4, 3), tablet: rect(0, 0, 8, 5), desktop: rect(0, 0, 6, 5) },
  savedDefinition: savedWidget(),
  ...overrides,
});

const unit = (items: TestItem[], title = '분석22') => ({ title, items });

describe('UC-017 editor recovery plan', () => {
  it('treats a committed save with a lost response as identical and plans no write', () => {
    const base = unit([block()]);
    const local = unit([block({ title: '매출 요약' })]);
    const latest = unit([block({ title: '매출 요약' })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(true);
    expect(plan.structural).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].title).toBe('매출 요약');
  });

  it('keeps local-only edits when the latest snapshot never changed', () => {
    const base = unit([block()]);
    const local = unit([block({ title: '내 초안 제목', unit: 'USD' })]);
    const latest = unit([block()]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].title).toBe('내 초안 제목');
    expect(plan.merged.items[0].unit).toBe('USD');
    expect(plan.merged.items[0].savedDefinition).toEqual(savedWidget());
  });

  it('merges disjoint local and latest changes per unit', () => {
    const base = unit([block(), block({ key: 'block-2', title: '비용' })]);
    const local = unit([block({ title: '매출(내 변경)' }), block({ key: 'block-2', title: '비용' })]);
    const latest = unit([block(), block({ key: 'block-2', title: '비용', unit: 'USD', height: 7 })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].title).toBe('매출(내 변경)');
    expect(plan.merged.items[1].unit).toBe('USD');
    expect(plan.merged.items[1].height).toBe(7);
  });

  it('reports a divergent actual SQL snapshot and keeps latest until confirmed', () => {
    const base = unit([block()]);
    const localSql = 'SELECT "month" AS category, SUM("amount") * 2 AS value FROM uploaded_data';
    const latestSql = 'SELECT "month" AS category, SUM("amount") / 2 AS value FROM uploaded_data';
    const local = unit([block({ savedDefinition: savedWidget({ sql: localSql }) })]);
    const latest = unit([block({ savedDefinition: savedWidget({ sql: latestSql }) })]);

    const plan = recoveryPlan(base, local, latest);
    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([{ key: 'block-1', label: '1. 매출 · 계산/차트 정의' }]);
    expect((plan.merged.items[0].savedDefinition as { sql: string }).sql).toBe(latestSql);

    const confirmed = recoveryPlan(
      base,
      local,
      latest,
      plan.conflicts.map(conflict => conflict.key ?? RECOVERY_DASHBOARD_TITLE_KEY),
    );
    expect((confirmed.merged.items[0].savedDefinition as { sql: string }).sql).toBe(localSql);
  });

  it('ignores duplicated display fields inside a definition and normalizes title and decimals', () => {
    const base = unit([block()]);
    const local = unit([
      block({
        title: '  매출  ',
        decimalPlaces: undefined,
        numberNotation: 'plain',
        unit: '원 ',
        savedDefinition: savedWidget({
          title: '메트릭 라벨',
          suffix: ' 원',
          decimalPlaces: 0,
          numberNotation: 'full',
        }),
      }),
    ]);
    const latest = unit([
      block({
        title: '매출',
        decimalPlaces: 0,
        numberNotation: 'plain',
        savedDefinition: savedWidget({ title: '매출', suffix: '', decimalPlaces: 3, numberNotation: 'full' }),
      }),
    ]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(true);
    expect(plan.conflicts).toEqual([]);
  });

  it('lists a same-field conflict without exposing SQL', () => {
    const base = unit([block()]);
    const local = unit([block({ decimalPlaces: 4 })]);
    const latest = unit([block({ decimalPlaces: 1 })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.conflicts).toEqual([{ key: 'block-1', label: '1. 매출 · 소수 자릿수' }]);
    expect(plan.merged.items[0].decimalPlaces).toBe(1);
    expect(JSON.stringify(plan.conflicts)).not.toContain('SELECT');
  });

  it('preserves the other block width change coming from the latest snapshot', () => {
    const base = unit([block(), block({ key: 'block-2', title: '비용' })]);
    const local = unit([block({ width: 12 }), block({ key: 'block-2', title: '비용' })]);
    const latest = unit([block(), block({ key: 'block-2', title: '비용', width: 12 })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items.map(item => item.width)).toEqual([12, 12]);
  });

  it('merges each breakpoint rect independently', () => {
    const base = unit([block()]);
    const local = unit([
      block({ layouts: { mobile: rect(0, 6, 4, 3), tablet: rect(0, 0, 8, 5), desktop: rect(0, 0, 6, 5) } }),
    ]);
    const latest = unit([
      block({ layouts: { mobile: rect(0, 0, 4, 3), tablet: rect(0, 0, 8, 5), desktop: rect(0, 9, 12, 5) } }),
    ]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].layouts).toEqual({
      mobile: rect(0, 6, 4, 3),
      tablet: rect(0, 0, 8, 5),
      desktop: rect(0, 9, 12, 5),
    });
  });

  it('blocks automatic merging when key order or the key set differs', () => {
    const base = unit([block(), block({ key: 'block-2', title: '비용' })]);
    const local = unit([block({ key: 'block-2', title: '비용' }), block({ title: '매출' })]);
    const latest = unit([block(), block({ key: 'block-2', title: '비용' })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.structural).toBe(true);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items.map(item => item.key)).toEqual(['block-1', 'block-2']);
  });

  it('blocks merging even when the reordered content is otherwise identical', () => {
    const base = unit([block(), block({ key: 'block-2' })]);
    const local = unit([block({ key: 'block-2' }), block()]);
    const latest = unit([block(), block({ key: 'block-2' })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.structural).toBe(true);
    expect(plan.merged.items).toEqual(latest.items);
  });

  it('treats a materialized draft as the same binding as its existing origin', () => {
    const base = unit([block()]);
    const local = unit([block({ kind: 'draft', savedDefinition: undefined, definition: savedWidget() })]);
    const latest = unit([block()]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(true);
    expect(plan.conflicts).toEqual([]);
  });

  it('treats a materialized SQL draft with a stale metric id as the existing origin', () => {
    const base = unit([block()]);
    const local = unit([block({ kind: 'draft', metricId: 11, savedDefinition: undefined, definition: savedWidget() })]);
    const latest = unit([block()]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(true);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].metricId).toBeUndefined();
  });

  it('never reports a metric binding that flipped to existing as identical', () => {
    const base = unit([block({ kind: 'metric', metricId: 11 })]);
    const local = unit([block({ kind: 'existing' })]);
    const latest = unit([block({ kind: 'metric', metricId: 11 })]);

    const plan = recoveryPlan(base, local, latest);

    // The binding changed locally while the latest snapshot stayed put: the plan must not read as
    // "already saved", and the merged draft carries the user's change forward for a new preview.
    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].kind).toBe('existing');
  });

  it('counts a changed metric binding even while the old SQL snapshot persists', () => {
    const base = unit([block({ kind: 'metric', metricId: 11 })]);
    const local = unit([block({ kind: 'metric', metricId: 12 })]);
    const latest = unit([block({ kind: 'metric', metricId: 11 })]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].metricId).toBe(12);
  });

  it('keeps a changed materialized draft SQL as a local-only change', () => {
    const base = unit([block()]);
    const localSql = 'SELECT "month" AS category, COUNT(*) AS value FROM uploaded_data';
    const local = unit([
      block({
        kind: 'draft',
        savedDefinition: undefined,
        definition: savedWidget({ type: 'BOARD_NUMERIC', sql: localSql, categoryField: undefined }),
      }),
    ]);
    const latest = unit([block()]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([]);
    expect(plan.merged.items[0].definition).toEqual(
      savedWidget({ type: 'BOARD_NUMERIC', sql: localSql, categoryField: undefined }),
    );
  });

  it('does not assume equivalence when the local canonical definition is missing', () => {
    const base = unit([block()]);
    const local = unit([block({ savedDefinition: undefined })]);
    const latest = unit([block()]);

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([{ key: 'block-1', label: '1. 매출 · 계산/차트 정의' }]);
    expect((plan.merged.items[0].savedDefinition as { sql: string }).sql).toBe(savedWidget().sql);
  });

  it('reports a dashboard title divergence and only applies local after confirmation', () => {
    const base = unit([block()], '분석22');
    const local = unit([block()], '내 제목');
    const latest = unit([block()], '다른 화면 제목');

    const plan = recoveryPlan(base, local, latest);

    expect(plan.same).toBe(false);
    expect(plan.conflicts).toEqual([{ label: '대시보드 제목 · 제목' }]);
    expect(plan.merged.title).toBe('다른 화면 제목');

    const confirmed = recoveryPlan(base, local, latest, [RECOVERY_DASHBOARD_TITLE_KEY]);
    expect(confirmed.merged.title).toBe('내 제목');
  });
});

it('UC-017 never confirms a save when both canonical snapshots are missing or malformed', () => {
  for (const savedDefinition of [undefined, {}, { sql: 'SELECT 1' }]) {
    const snapshot = unit([block({ savedDefinition })]);
    expect(recoveryPlan(snapshot, snapshot, snapshot).same).toBe(false);
  }
});

it('UC-017 malformed canonical models require confirmation before replacing the latest model', () => {
  const base = unit([block()]);
  const local = unit([block({ kind: 'draft', definition: { sql: 'incomplete' } })]);
  const latest = unit([block()]);
  const result = recoveryPlan(base, local, latest);
  expect(result.same).toBe(false);
  expect(result.conflicts).toHaveLength(1);
  expect(result.merged.items[0].kind).toBe('existing');
});
