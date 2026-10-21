import { getAggregationData } from './aggregation.util';

describe('widget aggregation numeric compatibility', () => {
  it.each([
    ['sum', [0.1, 0.2, 0.123], 0.423],
    ['sum', [-20, 30, 5], 15],
    ['avg', ['0.1', '0.2', '0.3'], 0.2],
    ['avg', ['1000000000.01', '1000000000.03'], 1000000000.02],
    ['avg', [1, 2, 2], 1.666667],
    ['max', [-7, -2, -5], -2],
    ['min', [7, 2, 5], 2],
  ])('%s preserves the expected finite JSON number for %j', (kind, values, expected) => {
    const result = getAggregationData(
      kind,
      (values as (number | string)[]).map(value => ({ value })),
      'value',
    );
    expect(typeof result).toBe('number');
    expect(result).toBe(expected);
    expect(JSON.parse(JSON.stringify({ result }))).toEqual({ result: expected });
  });
});
