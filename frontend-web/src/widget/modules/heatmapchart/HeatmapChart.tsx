import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChartWithMultipleKeys } from '@/widget/modules/utils/chartUtil';

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
    let newSeries = [];
    const xAxisData = [];
    const yAxisData = [];

    if (option.xField && option.yField && option.series) {
      aggrData = getAggregationDataForChartWithMultipleKeys(
        dataSet,
        [option.xField, option.yField],
        option.series,
        option.aggregation,
      );
      console.log('aggrData', aggrData);

      let xIndex = 0;
      let yIndex = 0;
      const xItems = {};
      const yItems = {};
      newSeries = aggrData.map(item => {
        const result = [];
        // console.log('item:', item);
        // console.log('result :', item[option.xField], item[option.yField], item[option.series]);

        // 1번째 요소
        if (!xItems.hasOwnProperty(item[option.xField])) {
          xItems[item[option.xField]] = xIndex;
          xIndex += 1;
          xAxisData.push(item[option.xField]);
        }
        result.push(xItems[item[option.xField]]);

        // 2번째 요소
        if (!yItems.hasOwnProperty(item[option.yField])) {
          yItems[item[option.yField]] = yIndex;
          yIndex += 1;
          yAxisData.push(item[option.yField]);
        }
        result.push(yItems[item[option.yField]]);

        // 3번째 요소
        result.push(item[option.series] || '-');
        return result;
      });
    }
    console.log('newSeries', newSeries);

    let minValue, maxValue;
    if (aggrData.length) {
      const arr = aggrData.map(item => Number(item[option.series]));
      minValue = Math.min(...arr);
      maxValue = Math.max(...arr);
      console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        xAxis: {
          type: 'category',
          splitArea: { show: true },
          data: xAxisData,
        },
        yAxis: {
          type: 'category',
          splitArea: { show: true },
          data: yAxisData,
        },
        series: [
          {
            data: newSeries,
            type: 'heatmap',
            label: { show: option.label },
          },
        ],
        visualMap: {
          type: 'continuous',
          min: !Number.isNaN(minValue) && minValue,
          max: !Number.isNaN(maxValue) && maxValue,
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
