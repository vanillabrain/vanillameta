import { expect, it } from 'vitest';
import { getAggregationDataForChart } from './chartUtil';

it('preserves all-null SQL groups without losing valid values or turning zero into missing data', () => {
  expect(
    getAggregationDataForChart(
      [
        { group: 'valid', value: null },
        { group: 'valid', value: 17.5 },
        { group: 'missing', value: null },
        { group: 'missing', value: undefined },
        { group: 'zero', value: 0 },
      ],
      'group',
      'value',
      'sum',
    ),
  ).toEqual([
    { group: 'valid', value: 17.5 },
    { group: 'missing', value: null },
    { group: 'zero', value: 0 },
  ]);
});
