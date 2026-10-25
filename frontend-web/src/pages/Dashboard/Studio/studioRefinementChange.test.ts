import { expect, it } from 'vitest';
import { describeBlockChange } from './studioRefinementChange';
import { CreationSemantic } from './studioCreation';

const block = (patch: Partial<CreationSemantic> = {}): CreationSemantic => ({
  title: '채널별 매출',
  kind: 'CHART_COLUMN',
  metric: { aggregation: 'SUM', column: 'amount' },
  dimension: { column: 'channel', type: 'category', schemaVersion: '1' },
  ...patch,
});

it('flags a title-only edit and names the calculation and dimension that stayed the same', () => {
  const text = describeBlockChange(block(), block({ title: '지역별 매출' }));
  expect(text).toContain('"채널별 매출" → "지역별 매출"');
  expect(text).toContain('제목 외에');
  expect(text).toContain('SUM(amount)');
  expect(text).toContain('channel');
});

it('lists each changed field when the calculation or dimension moved', () => {
  const text = describeBlockChange(
    block(),
    block({
      metric: { aggregation: 'AVG', column: 'amount' },
      dimension: { column: 'region', type: 'category', schemaVersion: '1' },
    }),
  );
  expect(text).toBe('바뀐 내용: 계산 SUM(amount) → AVG(amount), 차원 channel → region.');
  expect(text).not.toContain('제목만');
});

it('reports a title change that comes with a real change as an ordinary change list', () => {
  const text = describeBlockChange(
    block(),
    block({ title: '지역별 매출', dimension: { column: 'region', type: 'category', schemaVersion: '1' } }),
  );
  expect(text).toBe('바뀐 내용: 제목 "채널별 매출" → "지역별 매출", 차원 channel → region.');
});

it('describes a saved metric reference and a block without a dimension', () => {
  const saved = block({
    kind: 'BOARD_NUMERIC',
    dimension: undefined,
    metric: { id: 9, definitionVersion: 3, aggregation: 'SUM', column: 'amount' },
  });
  expect(describeBlockChange(undefined, saved)).toBe(
    '새 블록 "채널별 매출": 계산 저장 지표 #9 v3 · SUM(amount) · 차원 없음',
  );
});

it('returns null when nothing visible changed', () => {
  expect(describeBlockChange(block(), block())).toBeNull();
});

const ratio = (patch: Record<string, unknown> = {}) =>
  block({ metric: { aggregation: 'RATIO_SUM', column: 'refund', denominatorColumn: 'revenue', scale: 100, ...patch } });

it.each([
  ['denominator', { denominatorColumn: 'amount' }],
  ['scale', { scale: 1 }],
])('never says the calculation is unchanged when a ratio %s changed', (_name, patch) => {
  const text = describeBlockChange(ratio(), { ...ratio(patch), title: '지역별 환불률' });
  expect(text).toMatch(/^바뀐 내용: 제목 .*, 계산 /);
  expect(text).not.toContain('그대로');
});

it('detects a changed weight column', () => {
  const weighted = (weightColumn: string) =>
    block({ metric: { aggregation: 'WEIGHTED_AVG', column: 'price', weightColumn } });
  expect(describeBlockChange(weighted('quantity'), weighted('orders'))).toContain('가중치 quantity');
});

it('detects a swapped saved formula, a version bump and different new formula operands', () => {
  const formula = (metric: Record<string, unknown>) =>
    block({ title: '이익률', metric: { aggregation: 'FORMULA', ...metric } });
  const swapped = describeBlockChange(formula({ id: 9, definitionVersion: 1 }), formula({ id: 12, definitionVersion: 1 }));
  expect(swapped).toBe('바뀐 내용: 계산 저장 지표 #9 v1 (조합) → 저장 지표 #12 v1 (조합).');
  const bumped = describeBlockChange(formula({ id: 9, definitionVersion: 1 }), formula({ id: 9, definitionVersion: 2 }));
  expect(bumped).toContain('v1 (조합) → 저장 지표 #9 v2');
  const operands = describeBlockChange(formula({ expression: { op: 'add' } }), formula({ expression: { op: 'subtract' } }));
  expect(operands).toBe('바뀐 내용: 계산 세부 설정(새 조합 지표).');
});

it('ignores display-only metric fields and reports kind and presentation changes in Korean', () => {
  const styled = block({ metric: { aggregation: 'SUM', column: 'amount', unit: '원', decimalPlaces: 2, label: '매출' } });
  expect(describeBlockChange(block(), styled)).toBeNull();
  expect(describeBlockChange(block(), block({ kind: 'CHART_LINE', presentation: 'table' }))).toBe(
    '바뀐 내용: 차트 종류 막대형 가로 차트 → 선형 차트, 표시 방식 없음 → 표.',
  );
});

it('says nothing when the refined block is missing', () => {
  expect(describeBlockChange(block(), undefined)).toBeNull();
});
