import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getCenter, getLegendOption } from '@/widget/modules/utils/chartUtil';

const RadarChart = props => {
  const { option, dataSet, seriesOp, defaultOp, createOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    tooltip: { trigger: 'item' },
    series: [],
    emphasis: {
      lineStyle: {
        width: 4,
      },
    },
    ...defaultOp,
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

    // series option에서 가져오기
    const newSeriesData = [];
    let aggrData = [];

    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option.field, item.field, item.aggregation);

      if (item.field) {
        const seriesData = {
          value: aggrData.map(dataItem => dataItem[item.field]),
          name: item.field,
          itemStyle: {
            color: item.color,
          },
          ...seriesOp,
        };
        newSeriesData.push(seriesData);
      }
    });

    if (aggrData) {
      const op = {
        radar: {
          indicator: !!option.field ? aggrData.map(item => ({ name: item[option.field] })) : '',
          center: getCenter(option.legendPosition),
        },
        series: [
          {
            type: 'radar',
            data: newSeriesData,
          },
        ],
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    return newOption;
  };

  return (
    <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
  );
};

export default RadarChart;
