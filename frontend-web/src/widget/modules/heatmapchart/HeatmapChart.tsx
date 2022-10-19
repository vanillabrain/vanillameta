import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  getAggregationDataForChart,
  getAggregationDataForChartWithMultipleKeys,
  testFunc,
} from '@/widget/modules/utils/chartUtil';

const HeatmapChart = props => {
  const { option, dataSet } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 100, left: 50 },
    tooltip: {
      trigger: 'item',
    },
    xAxis: {},
    yAxis: {},
    series: [],
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
      },
    },
  };

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setComponentOption(newOption);
    }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    let newOption = {};

    let aggrData = [];
    if (option.xField && option.yField) {
      aggrData = getAggregationDataForChartWithMultipleKeys(
        dataSet,
        [option.xField, option.yField],
        option.series,
        option.aggregation,
      );
      console.log(aggrData);

      const newSeries = aggrData.map((item, index) => {
        // let num = 0;
        // const temp = [];
        // if(!temp[item[option.xField]]){
        //   temp[item[option.xField]] = num;
        //   num +=1;
        // }
        // return []
        // console.log(Object.values(item[option.xField]));
      });
      // option.series.forEach((item, index) => {
      //   const aggrItem = getAggregationDataForChart(dataSet, option.xField, item.field, option.aggregation);
      //   // console.log('aggrData :', aggrData);
      //   if (!xAxisData.length) {
      //     xAxisData = aggrItem.map(element => element[option.xField]);
      //     // console.log(xAxisData, 'xAxisData');
      //   }
      //   if (item.field) {
      //     const result = aggrItem.map((element, idx) => [idx, index, element[item.field]]);
      //     aggrData.push(...result);
      //     // console.log('aggrData :', aggrData);
      //   }
      // });
    }

    let minValue, maxValue;
    if (aggrData.length) {
      // const arr = aggrData.map(item => item[2]);
      const arr = aggrData.map(item => item[option.series]);
      minValue = Math.min(...arr);
      maxValue = Math.max(...arr);
      // console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        xAxis: {
          type: 'category',
          splitArea: { show: true },
          // data: aggrData.map(item => item[option.xField]),
        },
        yAxis: {
          type: 'category',
          splitArea: { show: true },
          // data: aggrData.map(item => item[option.yField]),
          // data: option.series.map(item => item.field),
        },
        series: [
          {
            // data: aggrData.map(item => [item[0], item[1], item[2] || '-']),
            // data: testFunc(aggrData, option.xField),
            // data: newSeries,
            type: 'heatmap',
            label: { show: true },
          },
        ],
        visualMap: {
          type: 'continuous',
          // min: minValue ?? 0,
          // max: maxValue ?? 0,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          inRange: {
            color: option.color.map(item => item),
          },
        },
      };
      newOption = { ...defaultComponentOption, ...op };
    }

    // console.log(newOption);
    return newOption;
  };

  return (
    <ReactECharts
      option={componentOption}
      style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}
      lazyUpdate={true}
      notMerge={true}
    />
  );
};

export default HeatmapChart;
