import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioInspector from './StudioInspector';
import { pivotBlock } from './studioPivot.fixture';
import { validateStudioDefinitions } from './studioApi';
import { StudioBlock } from './studioTypes';
afterEach(cleanup);
const basis = {
  sourceId: 3,
  metricId: 9,
  definitionVersion: '2',
  definition: { aggregation: 'RATIO_SUM', column: 'refund', denominatorColumn: 'revenue', scale: 100, unit: '%' },
};
const block: StudioBlock = {
  id: 'b1',
  definitionKey: 'b1',
  kind: 'BOARD_NUMERIC',
  title: '매출',
  description: '',
  measureRefs: [{ id: 9, definitionVersion: '2' }],
  dimensionRefs: [],
  display: {},
};
const props = () => ({
  block,
  sourceId: 3,
  metricBasis: basis,
  onOperation: vi.fn(),
  onDuplicate: vi.fn(),
  onRemove: vi.fn(),
  canDuplicate: true,
});
const open = () => fireEvent.click(screen.getByText('저장 계산 기준 확인'));
it('reads the stored source/metric/version and basis without editing the block', () => {
  const p = props();
  const before = JSON.stringify(block);
  render(<StudioInspector {...p} />);
  const details = screen.getByText('저장 계산 기준 확인').closest('details') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  open();
  expect(details.open).toBe(true);
  expect(screen.getByText(/소스 #3 · 지표 #9 · v2/)).toBeTruthy();
  expect(screen.getByText('revenue')).toBeTruthy();
  expect(screen.getByText('100')).toBeTruthy();
  expect(p.onOperation).not.toHaveBeenCalled();
  expect(p.onDuplicate).not.toHaveBeenCalled();
  expect(JSON.stringify(block)).toBe(before);
});
it.each(['source', 'metric', 'version', 'unlinked'])('does not display a different basis: %s', kind => {
  const p = props();
  if (kind === 'source') p.sourceId = 4;
  if (kind === 'metric') p.metricBasis = { ...basis, metricId: 10 };
  if (kind === 'version') p.metricBasis = { ...basis, definitionVersion: '3' };
  if (kind === 'unlinked') p.block = { ...block, measureRefs: [] };
  render(<StudioInspector {...p} />);
  open();
  expect(screen.getByText(/이 블록의 저장 계산 기준을 확인하지 못했습니다/)).toBeTruthy();
  expect(screen.queryByText('revenue')).toBeNull();
});
it('removes old details when selection switches to an unlinked block', () => {
  const p = props();
  const view = render(<StudioInspector {...p} />);
  open();
  expect(screen.getByText('revenue')).toBeTruthy();
  view.rerender(<StudioInspector {...p} block={{ ...block, id: 'b2', measureRefs: [] }} />);
  expect(screen.queryByText('revenue')).toBeNull();
  expect(p.onOperation).not.toHaveBeenCalled();
});
const definitions = (metricBasis?: any) => ({
  dashboardId: 4,
  sourceId: 3,
  revision: 'a'.repeat(64),
  explanation: '',
  entries: {
    b1: {
      widget: { type: 'BOARD_NUMERIC', sql: 'private', valueField: 'value' },
      ...(metricBasis === undefined ? {} : { metricBasis }),
    },
  },
});
it('keeps previous payloads compatible and accepts the optional whitelist basis', () => {
  expect(validateStudioDefinitions(definitions())).toBeTruthy();
  expect(validateStudioDefinitions(definitions(basis)).entries.b1.metricBasis).toEqual(basis);
});
it.each([
  { ...basis, sourceId: 4 },
  { ...basis, definitionVersion: '-1' },
  { ...basis, definition: { sql: 'secret' } },
  { ...basis, definition: { scale: '100' } },
  { ...basis, metricId: 0 },
])('rejects malformed optional basis %j', value => {
  expect(() => validateStudioDefinitions(definitions(value))).toThrow();
});

it('does not show saved-basis status in a design-only inspector without a source context', () => {
  render(<StudioInspector {...props()} sourceId={undefined} metricBasis={undefined} />);
  expect(screen.queryByText('저장 계산 기준 확인')).toBeNull();
  expect(screen.getByLabelText('블록 제목')).toBeTruthy();
});

it('labels Pivot conditions with preview measures and units, falling back to selection order without changing the recipe', () => {
  const selected = pivotBlock();
  if (!selected.pivot?.state.segment) throw new Error('Pivot fixture requires segment conditions');
  selected.pivot.state.measureIds = [1, 4];
  selected.pivot.state.segment.conditions.push({ measureId: 4, operator: 'lt', value: 20 });
  const before = JSON.stringify(selected);
  const p = { ...props(), block: selected };
  const view = render(<StudioInspector {...p} />);
  expect(screen.getByText('조건 선택 지표 1 ≥ 1,000 · 선택 지표 2 < 20')).toBeTruthy();
  view.rerender(
    <StudioInspector
      {...p}
      pivotMeasures={[
        { id: 4, label: '마진', unit: '%', value: 10, decimalPlaces: 2 },
        { id: 1, label: '총매출', unit: '', value: 2000, decimalPlaces: 2 },
      ]}
    />,
  );
  expect(screen.getByText('조건 총매출 ≥ 1,000 · 마진 < 20%')).toBeTruthy();
  expect(p.onOperation).not.toHaveBeenCalled();
  expect(JSON.stringify(selected)).toBe(before);
});
