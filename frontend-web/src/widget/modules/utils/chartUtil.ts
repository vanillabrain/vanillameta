import { WIDGET_AGGREGATION } from '@/constant';

/**
 *
 * @param position
 */
export const getLegendOption = position => {
  let option = {};
  switch (position) {
    case 'left':
      option = {
        orient: 'vertical',
        left: 10,
        top: 'center',
      };
      break;
    case 'right':
      option = {
        orient: 'vertical',
        right: 10,
        top: 'center',
      };
      break;
    case 'top':
      option = {
        orient: 'horizontal',
        top: 'top',
      };
      break;
    case 'bottom':
      option = {
        orient: 'horizontal',
        top: 'bottom',
      };
      break;
    case '':
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
  let option = {};
  switch (position) {
    case 'left':
      option = { top: 50, right: 10, bottom: 50, left: 100 };
      break;
    case 'right':
      option = { top: 50, right: 100, bottom: 50, left: 10 };
      break;
    case 'top':
      option = { top: 80, right: 30, bottom: 20, left: 50 };
      break;
    case 'bottom':
      option = { top: 20, right: 30, bottom: 80, left: 50 };
      break;
    case '':
      option = false;
      break;
  }
  return option;
};

/**
 *
 * @param position
 */
export const getCenter = position => {
  let option = [];
  switch (position) {
    case 'left':
      option = ['60%', '50%'];
      break;
    case 'right':
      option = ['40%', '50%'];
      break;
    case 'top':
      option = ['50%', '60%'];
      break;
    case 'bottom':
      option = ['50%', '40%'];
      break;
    case '':
      option = ['50%', '50%'];
      break;
    default:
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
  switch (type) {
    case WIDGET_AGGREGATION.SUM:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field]) {
          result += item[field];
        }
      });
      break;
    case WIDGET_AGGREGATION.AVG:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field]) {
          result += item[field];
        }
      });
      result = Math.floor(result / data.length);
      break;
    case WIDGET_AGGREGATION.MAX:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field]) {
          result = Math.max(result, item[field]);
        }
      });
      break;
    case WIDGET_AGGREGATION.MIN:
      data.forEach(item => {
        // console.log('item ', item[field]);
        if (item[field]) {
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

export const testFunc = (array, keys) => {
  // 필드값을 프로퍼티로 하는 객체 값이 중복되지 않으면 숫자를 부여하고
  // 중복된 값이 나오면 같은 값을 부여, 중복되지 않은 값이 나오면 +1 값을 부여
  if (array.length) {
    let num = 0;
    const temp = [];

    array.map(item => {
      if (!temp[item[keys]]) {
        temp[item[keys]] = num;
        num += 1;
      }
    });
    // .sort((a, b) => (a - b))

    console.log(temp, 'temp');
    return temp;
  }
};

/**
 * field 갯수에 따라 color array 생성
 * @param field
 * @param length
 */
export const getColorArr = (field, length) => {
  const defaultColor = [
    '#2870c5',
    '#47a8ea',
    '#4ecef6',
    '#9e9e9f',
    '#506175',
    '#994ff6',
    '#bf6fff',
    '#fa5b5b',
    '#fca136',
    '#fccc25',
    '#95ce5b',
    '#2dab66',
  ];
  const colorArr = [];

  for (let i = 0; i < length; i++) {
    colorArr.push(defaultColor[i % 12]);
  }
  return colorArr;
};
