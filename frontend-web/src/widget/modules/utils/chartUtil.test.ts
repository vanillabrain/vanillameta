import { getAggregationData } from '@/widget/modules/utils/chartUtil';
import { WIDGET_AGGREGATION } from '@/constant';

const dummyData = [
  {
    id: 1,
    month: 1,
    color: '#00BFFF',
    high: 18,
    low: 2,
    avg: 8.9,
    cDate: '2022-09-14T08:06:11+09:00',
  },
  {
    id: 2,
    month: 1,
    high: 23,
    low: -2,
    avg: 9.9,
    cDate: '2022-09-14T08:06:11+09:00',
  },
  {
    id: 3,
    month: 2,
    high: 25,
    low: -1,
    avg: 11.3,
    cDate: '2022-09-14T08:06:11+09:00',
  },
  {
    id: 4,
    month: 2,
    high: 23,
    low: 1,
    avg: 13,
    cDate: '2022-09-14T08:06:11+09:00',
  },
];
test('2 * 2 to be 4', () => {
  expect(getAggregationData(WIDGET_AGGREGATION.SUM, dummyData, 'high')).toBe(89);
});

export { getAggregationData };
