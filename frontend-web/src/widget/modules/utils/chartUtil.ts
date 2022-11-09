import { WIDGET_AGGREGATION } from '../../../constant';

/**
 *
 * @param position
 */
export const getLegendOption = position => {
  let option;
  switch (position) {
    case 'left':
      option = {
        orient: 'vertical',
        left: 'left',
        top: 'center',
        padding: 20,
      };
      break;
    case 'right':
      option = {
        orient: 'vertical',
        right: 'right',
        top: 'center',
        padding: 20,
      };
      break;
    case 'top':
      option = {
        orient: 'horizontal',
        left: 'center',
        top: 'top',
        padding: 20,
      };
      break;
    case 'bottom':
      option = {
        orient: 'horizontal',
        left: 'center',
        bottom: 'bottom',
        padding: 20,
      };
      break;
    default:
      option = false;
      break;
  }
  return option;
};

/**
 *
 * @param position
 */

export const getGridSize = position => {
  let option;
  switch (position) {
    case 'left':
      option = { top: '3%', right: '3%', bottom: '3%', left: 120, containLabel: true };
      break;
    case 'right':
      option = { top: '3%', right: 120, bottom: '3%', left: '3%', containLabel: true };
      break;
    case 'top':
      option = { top: 70, right: '3%', bottom: '3%', left: '3%', containLabel: true };
      break;
    case 'bottom':
      option = { top: '3%', right: '3%', bottom: 70, left: '3%', containLabel: true };
      break;
    default:
      option = { top: '3%', right: '3%', bottom: '3%', left: '3%', containLabel: true };
      break;
  }
  return option;
};

/**
 *
 * @param position
 */
export const getCenter = position => {
  let option;
  switch (position) {
    case 'left':
      option = ['55%', '50%'];
      break;
    case 'right':
      option = ['45%', '50%'];
      break;
    case 'top':
      option = ['50%', '55%'];
      break;
    case 'bottom':
      option = ['50%', '45%'];
      break;
    default:
      option = ['50%', '50%'];
      break;
  }
  return option;
};

/**
 *
 * @param type
 * @param data
 * @param field
 */
export const getAggregationData = (type, data, field) => {
  let result = 0;
  if (data.length > 0 && (type === WIDGET_AGGREGATION.MIN || type === WIDGET_AGGREGATION.MAX)) {
    result = Number(data[0][field]);
  }
  switch (type) {
    case WIDGET_AGGREGATION.SUM:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result += Number(item[field]);
        }
      });
      break;
    case WIDGET_AGGREGATION.AVG:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field] != undefined && item[field] != null) {
          result += Number(item[field]);
        }
      });
      result = Math.floor((result / data.length) * 100000000) / 100000000;
      // result = result / data.length;
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

/**
 *
 * @param array
 * @param keys
 * @param variable
 * @param aggr
 */
export const getAggregationDataForChart = (array, keys, variable, aggr = WIDGET_AGGREGATION.SUM) => {
  let key, temp;
  const countInfo = {};
  array.forEach(item => {
    const group = item[keys];
    if (!countInfo[group]) {
      countInfo[group] = 1;
    } else {
      countInfo[group] = countInfo[group] + 1;
    }
  });
  const data = array.reduce((result, currentValue) => {
    key = currentValue[keys];
    if (!result[key]) {
      result[key] = 0;
    }
    if (aggr === WIDGET_AGGREGATION.AVG) {
      result[key] += parseFloat(currentValue[variable]);
    } else if (aggr === WIDGET_AGGREGATION.MAX) {
      result[key] = !result[key] ? currentValue[variable] : Math.max(result[key], currentValue[variable]);
    } else if (aggr === WIDGET_AGGREGATION.MIN) {
      result[key] = !result[key] ? currentValue[variable] : Math.min(result[key], currentValue[variable]);
    } else {
      result[key] += parseFloat(currentValue[variable]);
    }
    return result;
  }, {});
  const grouped = [];
  Object.keys(data).forEach(function (key) {
    temp = {};
    temp[keys] = key;
    if (aggr === WIDGET_AGGREGATION.AVG) {
      temp[variable] = Math.round(data[key] / countInfo[key]);
    } else {
      temp[variable] = data[key];
    }
    grouped.push(temp);
  });
  return grouped;
};

/**
 *
 * @param array
 * @param keysList
 * @param variable
 * @param aggr
 */
export const getAggregationDataForChartWithMultipleKeys = (array, keysList, variable, aggr = WIDGET_AGGREGATION.SUM) => {
  let key, temp;
  const countInfo = {};
  array.forEach(arrayItem => {
    const itemGroup = [];
    keysList.forEach(keysItem => itemGroup.push(arrayItem[keysItem]));
    const group = JSON.stringify(itemGroup); // ["a", "b"]
    if (!countInfo[group]) {
      countInfo[group] = 1;
    } else {
      countInfo[group] = countInfo[group] + 1;
    }
  });
  const data = array.reduce((result, currentValue) => {
    const keyList = [];
    keysList.forEach(keysItem => keyList.push(currentValue[keysItem]));
    key = JSON.stringify(keyList);
    if (!result[key]) {
      result[key] = 0;
    }
    if (aggr === WIDGET_AGGREGATION.AVG) {
      result[key] += parseFloat(currentValue[variable]);
    } else if (aggr === WIDGET_AGGREGATION.MAX) {
      result[key] = !result[key] ? currentValue[variable] : Math.max(result[key], currentValue[variable]);
    } else if (aggr === WIDGET_AGGREGATION.MIN) {
      result[key] = !result[key] ? currentValue[variable] : Math.min(result[key], currentValue[variable]);
    } else {
      result[key] += parseFloat(currentValue[variable]);
    }
    return result;
  }, {});
  const grouped = [];
  Object.keys(data).forEach(function (key) {
    temp = {};
    keysList.forEach((keysItem, keysIndex) => {
      temp[keysItem] = JSON.parse(key)[keysIndex];
    });
    if (aggr === WIDGET_AGGREGATION.AVG) {
      temp[variable] = data[key] / countInfo[key];
    } else {
      temp[variable] = data[key];
    }
    grouped.push(temp);
    // console.log(grouped, 'grouped');
  });
  return grouped;
};
/**
 * field 갯수에 따라 color array 생성
 * @param field
 * @param length
 */
export const getColorArr = length => {
  const defaultColor = [
    '#6aa7eb',
    '#85c7fc',
    '#94c983',
    '#c1d96a',
    '#f4f363',
    '#eecd5b',
    '#eaab56',
    '#e88b4f',
    '#f05d55',
    '#dc80ba',
    '#c59cfc',
    '#828ee1',
  ];
  const colorArr = [];

  for (let i = 0; i < length; i++) {
    colorArr.push(defaultColor[i % 12]);
  }
  return colorArr;
};
