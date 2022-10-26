import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const PolarBarChart = props => {
  const { option, dataSet, seriesOp, defaultOp, createOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    tooltip: { trigger: 'axis' },
    series: [],
    angleAxis: {},
    emphasis: {
      focus: 'series',
      blurScope: 'coordinateSystem',
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
    console.log('createComponentOption', option);
    let newOption = {};

    const newSeries = [];
    let aggrData = [];
    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option.axisField, item.field, item.aggregation);
      console.log('aggrData : ', aggrData);
      if (item.field) {
        const series = {
          name: item.field,
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: 'bar',
          color: item.color,
          coordinateSystem: 'polar',
          label: {
            show: option.label,
            position: 'middle',
          },
          ...seriesOp,
        };
        newSeries.push(series);
      }
    });

    if (aggrData && option.axisField) {
      const op = {
        radiusAxis: {
          type: 'category',
          data: option.andleField ? aggrData.map(item => item[option.andleField]) : '',
        },
        series: newSeries,
        polar: {
          radius: option.radius,
        },
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
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

export default PolarBarChart;
