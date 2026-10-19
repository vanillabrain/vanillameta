import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import StudioPivotConditions from './StudioPivotConditions';
import { pivotRecipe, pivotAggregate } from './studioPivot.fixture';
import type { StudioPivotRecipe } from './studioPivot';
afterEach(cleanup);
it('shows the block qualification dimension, AND conditions and precise thresholds with snapshot units', () => {
  const recipe: StudioPivotRecipe = pivotRecipe();
  recipe.state.segment.conditions.push({ measureId: 4, operator: 'lt', value: 20 });
  recipe.state.segment.conditions[0].value = 1000.0001;
  const result = pivotAggregate();
  result.kpis.push({ id: 4, label: '마진', value: '5.39', unit: '%', decimalPlaces: 2 });
  render(<StudioPivotConditions recipe={recipe} result={result} />);
  expect(screen.getByText('이 블록에 적용')).toBeTruthy();
  expect(screen.getByText(/company별.*AND/)).toBeTruthy();
  const list = screen.getByRole('list', { name: '이 블록의 집계 조건' });
  expect(list.textContent).toContain('매출 ≥ 1,000.0001 USD');
  expect(list.textContent).toContain('마진 < 20%');
  expect(list.querySelectorAll('li')).toHaveLength(2);
});
it('does not guess a label or unit for condition metadata absent from the confirmed result', () => {
  const recipe = pivotRecipe();
  recipe.state.segment.conditions[0].measureId = 99;
  render(<StudioPivotConditions recipe={recipe} result={pivotAggregate()} />);
  expect(screen.getByRole('list').textContent).toContain('지표 #99 ≥ 1,000');
  expect(screen.getByText(/단위 확인 필요/)).toBeTruthy();
  expect(screen.queryByText(/USD/)).toBeNull();
});
