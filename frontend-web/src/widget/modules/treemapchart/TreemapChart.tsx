import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart } from '@/widget/modules/utils/chartUtil';

const TreemapChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: {
      trigger: 'item',
    },
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

    const newSeries = [];
    let aggrData = [];

    if (option.series.name) {
      aggrData = getAggregationDataForChart(dataSet, option.series.name, option.series.field, option.series.aggregation);
      // console.log(aggrData);

      const series = {
        name: option.series.name,
        data: aggrData.map((item, index) => ({
          value: item[option.series.field],
          name: item[option.series.name],
          // itemStyle: {
          //   color: option.series.color[index],
          // },
        })),
        type: 'treemap',
        ...seriesOp,
      };

      newSeries.push(series);
    }

    if (dataSet) {
      let minValue = 0;
      let maxValue = 1;
      if (aggrData.length) {
        const arr = aggrData.map(item => item[option.series.field]);
        minValue = Math.min(...arr);
        maxValue = Math.max(...arr);
      }
      // console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        series: newSeries,
        visualMap: {
          type: 'continuous',
          min: minValue,
          max: maxValue,
          inRange: {
            color: option.series.color.map(item => item),
          },
        },
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    return newOption;
  };

  return (
    <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
  );
};

export default TreemapChart;
