import * as dummyJson from './QTT-004_dummyData.json';
import * as resultJson from './QTT-004_resultData.json';
import { getAggregationData, WIDGET_AGGREGATION } from '../../src/utils/aggregation.util';

describe('QTT-004: 데이터 집산', () => {
  const dummyData = dummyJson.dummyData;
  const expectData = resultJson.expectData;
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
