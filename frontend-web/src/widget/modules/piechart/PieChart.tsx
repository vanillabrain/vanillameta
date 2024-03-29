import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getCenter, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const PieChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    // toolbox: {
    //   feature: {
    //     dataView: { readOnly: false },
    //     restore: {},
    //     saveAsImage: {},
    //   },
    // },
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
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

      const series = {
        name: option.series.name,
        data: aggrData.map(item => ({
          value: item[option.series.field],
          name: item[option.series.name],
        })),
        type: 'pie',
        color: [...option.series.color],
        label: {
          show: !!option.series.label,
          formatter: option.series.label,
          bleedMargin: 70,
        },
        center: getCenter(option.legendPosition),
        ...seriesOp,
      };
      newSeries.push(series);
    }

    if (dataSet) {
      const op = {
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: option.legendPosition && {
          ...getLegendOption(option.legendPosition),
          type: 'scroll',
        },
      };
      newOption = { ...defaultComponentOption, ...op };
    }
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

export default PieChart;
