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
    avg: 34.58928571,
  },
  vcost: {
    max: 180,
    min: 2,
    sum: 40119,
    avg: 47.76071429,
  },
  travel: {
    max: 1440,
    min: 63,
    sum: 408379,
    avg: 486.1654762,
  },
  gcost: {
    max: 269,
    min: 30,
    sum: 93139,
    avg: 110.8797619,
  },
  income: {
    max: 72,
    min: 2,
    sum: 29020,
    avg: 34.54761905,
  },
  size: {
    max: 6,
    min: 1,
    sum: 1464,
    avg: 1.742857143,
  },
};

describe('QTT-004', () => {
  const dummyData = dummyJson.dummyData;
  const fieldList = Object.keys(expectData);

  it.each(fieldList)('QTT-004-01 (MAX): %s', fieldName => {
    console.log(fieldName);
    expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.MAX],
    );
  });

  it.each(fieldList)('QTT-004-02 (MIN) : %s ', fieldName => {
    console.log(fieldName);
    expect(getAggregationData(WIDGET_AGGREGATION.MIN, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.MIN],
    );
  });

  it.each(fieldList)('QTT-004-02 (SUM) : %s ', fieldName => {
    console.log(fieldName);
    expect(getAggregationData(WIDGET_AGGREGATION.SUM, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.SUM],
    );
  });

  it.each(fieldList)('QTT-004-02 (AVG) : %s ', fieldName => {
    console.log(fieldName);
    expect(getAggregationData(WIDGET_AGGREGATION.AVG, dummyData, fieldName)).toBe(
      expectData[fieldName][WIDGET_AGGREGATION.AVG],
    );
  });

  // fieldList.forEach(fieldName => {
  //   it(`QTT-004-01 : ${fieldName}`, () => {
  //     const dummyData = dummyJson.dummyData;
  //     // fieldList.forEach(fieldName => {
  //     expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, fieldName)).toBe(
  //       expectData[fieldName][WIDGET_AGGREGATION.MAX],
  //     );
  //     // });
  //     // expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, 'individual')).toBe(88621);
  //   });
  // });
  // console.log(dummyData);
  // it('QTT-004-01', () => {
  //   const dummyData = dummyJson.dummyData;
  //   fieldList.forEach(fieldName => {
  //     expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, fieldName)).toBe(
  //       expectData[fieldName][WIDGET_AGGREGATION.MAX],
  //     );
  //   });
  //   // expect(getAggregationData(WIDGET_AGGREGATION.MAX, dummyData, 'individual')).toBe(88621);
  // });
});

afterAll(() => {
  console.log('test end');
});

export { getAggregationData };
