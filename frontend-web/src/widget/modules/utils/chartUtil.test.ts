import { getAggregationData } from './chartUtil';
import { WIDGET_AGGREGATION } from '../../../constant';
import * as dummyJson from '../../../data/QTT-004_dummyData.json';

const expectData = {
  individual: {
    max: 210,
    min: 1,
    sum: 88620,
    avg: 105.5,
  },
  wait: {
    max: 99,
    min: 0,
    sum: 29055,
    avg: 34.589286,
  },
  vcost: {
    max: 180,
    min: 2,
    sum: 40119,
    avg: 47.760714,
  },
  travel: {
    max: 1440,
    min: 63,
    sum: 408379,
    avg: 486.165476,
  },
  gcost: {
    max: 269,
    min: 30,
    sum: 93139,
    avg: 110.879762,
  },
  income: {
    max: 72,
    min: 2,
    sum: 29020,
    avg: 34.547619,
  },
  size: {
    max: 6,
    min: 1,
    sum: 1464,
    avg: 1.742857,
  },
};

describe('QTT-004', () => {
  const dummyData = dummyJson.dummyData;
  const fieldList = Object.keys(expectData);

  it.each(fieldList)('QTT-004-01 (MAX): %s', fieldName => {
    expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.MAX],
    );
  });

  it.each(fieldList)('QTT-004-02 (MIN) : %s ', fieldName => {
    expect(getAggregationData(WIDGET_AGGREGATION.MIN, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.MIN],
    );
  });

  it.each(fieldList)('QTT-004-03 (SUM) : %s ', fieldName => {
    expect(getAggregationData(WIDGET_AGGREGATION.SUM, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.SUM],
    );
  });

  it.each(fieldList)('QTT-004-04 (AVG) : %s ', fieldName => {
    expect(getAggregationData(WIDGET_AGGREGATION.AVG, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.AVG],
    );
  });
});

afterAll(() => {
  console.log('test end');
});

export { getAggregationData };
