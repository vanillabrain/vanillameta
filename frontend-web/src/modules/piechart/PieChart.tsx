import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getCenter, getLegendOption } from '@/modules/utils/chartUtil';

const PieChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
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
    setComponentOption(defaultComponentOption);
    setComponentOption(createComponentOption());
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

    aggrData = getAggregationDataForChart(dataSet, option.series.label, option.series.field, option.series.aggregation);

    if (option.series.label) {
      const series = {
        name: option.series.label,
        data: aggrData.map(item => ({
          value: item[option.series.field],
          name: item[option.series.label],
        })),
        type: 'pie',
        color: [...option.series.color],
        label: { show: !!option.series.label && true },
        center: getCenter(option.legendPosition),
        ...seriesOp,
      };
      newSeries.push(series);
    }

    if (dataSet) {
      const op = {
        color: [...option.series.color],
        series: newSeries,
        legend: getLegendOption(option.legendPosition),
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    return newOption;
  };

  return (
    <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
  );
};

export default PieChart;
