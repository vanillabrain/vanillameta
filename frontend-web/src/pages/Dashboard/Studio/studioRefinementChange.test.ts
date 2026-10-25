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
  expect(text).toContain('제목만 바뀌었고');
  expect(text).toContain('SUM(amount)');
  expect(text).toContain('channel');
});

it('lists each changed field when the calculation or dimension moved', () => {
  const text = describeBlockChange(
    block(),
    block({ metric: { aggregation: 'AVG', column: 'amount' }, dimension: { column: 'region', type: 'category', schemaVersion: '1' } }),
  );
  expect(text).toBe('바뀐 내용: 계산 SUM(amount) → AVG(amount), 차원 channel → region');
  expect(text).not.toContain('제목만');
});

it('reports a title change that comes with a real change as an ordinary change list', () => {
  const text = describeBlockChange(block(), block({ title: '지역별 매출', dimension: { column: 'region', type: 'category', schemaVersion: '1' } }));
  expect(text).toBe('바뀐 내용: 제목 "채널별 매출" → "지역별 매출", 차원 channel → region');
});

it('describes a saved metric reference and a block without a dimension', () => {
  const saved = block({ kind: 'BOARD_NUMERIC', dimension: undefined, metric: { id: 9, definitionVersion: 3, aggregation: 'SUM', column: 'amount' } });
  expect(describeBlockChange(undefined, saved)).toBe('새 블록 "채널별 매출": 계산 저장 지표 #9 v3 · SUM(amount) · 차원 없음');
});

it('returns null when nothing visible changed', () => {
  expect(describeBlockChange(block(), block())).toBeNull();
});
