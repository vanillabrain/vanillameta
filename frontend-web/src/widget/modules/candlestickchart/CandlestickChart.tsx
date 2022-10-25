import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const CandlestickChart = props => {
  const { option, dataSet } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    xAxis: {
      type: 'category',
    },
    yAxis: {},
    series: [],
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

    if (option.xField && newSeries) {
      option.series.forEach(item => {
        const aggrItem = getAggregationDataForChart(dataSet, option.xField, item.field, item.aggregation);
        aggrData = aggrItem;

        // console.log(aggrItem, 'aggritem');
        aggrItem.forEach((element, idx) => {
          if (!newSeries[idx]) {
            newSeries[idx] = [];
          }
          if (item.field) {
            newSeries[idx].push(element[item.field]);
          }
        });
        // console.log(newSeries, 'aggrData');
      });
    }

    if (aggrData) {
      const op = {
        xAxis: {
          type: 'category',
          data: option.xField ? aggrData.map(item => item[option.xField]) : '',
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        yAxis: {
          scale: true,
          splitArea: {
            show: true,
          },
        },
        series: [
          {
            name: 'name',
            type: 'candlestick',
            data: newSeries,
            itemStyle: {
              color: option.series[0].color,
              color0: option.series[1].color,
              borderColor: option.series[2].color,
              borderColor0: option.series[3].color,
            },
            markPoint: option.mark && {
              data: [
                {
                  name: 'highest value',
                  type: 'max',
                  valueDim: 'highest',
                },
                {
                  name: 'lowest value',
                  type: 'min',
                  valueDim: 'lowest',
                },
              ],
            },
          },
        ],
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
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

export default CandlestickChart;
