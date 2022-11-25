import * as math from 'mathjs';

export const WIDGET_AGGREGATION = {
  SUM: 'sum',
  AVG: 'avg',
  MAX: 'max',
  MIN: 'min',
};

/**
 *
 * @param type
 * @param data
 * @param field
 */
export const getAggregationData = (type, data, field) => {
  let result = 0;
  let fits = 0;
  let dataList = [];
  if (data.length > 0 && (type === WIDGET_AGGREGATION.MIN || type === WIDGET_AGGREGATION.MAX)) {
    result = Number(data[0][field]);
  } else if (data.length > 0 && type === WIDGET_AGGREGATION.SUM) {
    dataList = data.map(row => row[field]);
    fits = decimalFits(dataList);
  }

  switch (type) {
    case WIDGET_AGGREGATION.SUM:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result += Number(item[field]);
        }
      });
      result = Number(result.toFixed(fits));
      break;
    case WIDGET_AGGREGATION.AVG:
      // result = math.mean(dataList);
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result = math.add(result, math.bignumber(item[field]));
        }
      });
      result = math.divide(result, math.bignumber(data.length));
      // // result = Number(result.toFixed(fits));
      // // result = Math.round((result / data.length) * 1000000) / 1000000;
      // result = result / data.length;
      // result = Number(result);
      // result = Math.round(result * 1000000) / 1000000;
      result = Number(result.toFixed(6));
      break;
    case WIDGET_AGGREGATION.MAX:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result = Math.max(result, item[field]);
        }
      });
      break;
    case WIDGET_AGGREGATION.MIN:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result = Math.min(result, item[field]);
        }
      });
      break;
    default:
  }
  return result;
};

function decimalFits(arr) {
  //소수점 자리수가 가장많은 수 return
  var decimalN = 0;
  for (var j = 0; j < arr.length; j++) {
    var n = arr[j];
    if (!Number.isInteger(n)) {
      //소수
      var d = String(n).split('.')[1].length; //문자열 소수점 다음 개수
      if (decimalN < d) decimalN = d;
    }
  }
  return decimalN;
}
var arr = [0.1, 0.12, 0.123];
decimalFits(arr);
