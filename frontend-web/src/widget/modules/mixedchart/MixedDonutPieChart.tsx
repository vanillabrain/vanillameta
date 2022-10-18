import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getCenter, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const MixedDonutPieChart = props => {
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
    let pieAggrData = [];
    let legendData = [];

    if (option.series.field) {
      aggrData = getAggregationDataForChart(dataSet, option.series.name, option.series.field, option.series.aggregation);

      const series = {
        name: option.series.name,
        data: aggrData.map(item => ({
          value: item[option.series.field],
          name: item[option.series.name],
        })),
        type: 'pie',
        selectedMode: 'single',
        radius: [...option.series.radius],
        label: {
          show: !!option.series.name && true,
          formatter: '{b}: {d}%',
        },
        center: getCenter(option.legendPosition),
        ...seriesOp,
      };
      newSeries.push(series);
    }

    if (option.pie.field) {
      pieAggrData = getAggregationDataForChart(dataSet, option.pie.name, option.pie.field, option.pie.aggregation);

      const series = {
        name: option.pie.name,
        data: pieAggrData.map(item => ({
          value: item[option.pie.field],
          name: item[option.pie.name],
        })),
        type: 'pie',
        selectedMode: 'single',
        radius: option.pie.radius,
        label: {
          show: !!option.pie.name && true,
          position: 'inside',
          // formatter: '{b}: {d}%',
        },
        center: getCenter(option.legendPosition),
        z: 100,
      };
      newSeries.unshift(series);
    }

    if (aggrData.length && pieAggrData.length) {
      legendData = [...aggrData.map(item => item[option.series.name]), ...pieAggrData.map(item => item[option.pie.name])];
    }

    if (dataSet) {
      const op = {
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: {
          option: getLegendOption(option.legendPosition),
          data: legendData,
        },
        color: option.color.length ? [...option.color] : '#eee',
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    console.log(newOption);
    return newOption;
  };

  return (
    <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
  );
};

export default MixedDonutPieChart;
