import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box, Stack } from '@mui/material';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const WaterfallBarChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: { trigger: 'axis' },
    [axis + 'Axis']: {
      type: 'category',
    },
    [reverseAxis + 'Axis']: {
      type: 'value',
    },
    series: [],
    emphasis: {
      focus: 'series',
      blurScope: 'coordinateSystem',
    },
    ...defaultOp,
  };

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setComponentOption(newOption);
      console.log('createComponentOption', newOption);
    }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */
  const createComponentOption = () => {
    // console.log('createComponentOption', option);
    let newOption = {};

    // series option에서 가져오기
    const newSeries = [];
    let aggrData = [];
    let prevSeriesData, increaseData, decreaseData;
    option.series.forEach((item, index) => {
      aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
      console.log('aggrData : ', aggrData);
      if (item.field) {
        const series = {
          name: item.field,
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: 'bar',
          stack: 'total',
          color: item.color,
          ...seriesOp,
        };
        if (index % 2) {
          const calculatedData = prevSeriesData.map((prevItem, prevIndex) => {
            return prevItem - series.data[prevIndex];
          });
          console.log(calculatedData);
          increaseData = calculatedData.map(item => (Math.sign(item) === -1 || !item ? '-' : item));
          decreaseData = calculatedData.map(item => (Math.sign(item) === 1 || !item ? '-' : item));
          console.log(increaseData, decreaseData);
        } else {
          prevSeriesData = series.data;
          series.itemStyle = {
            borderColor: 'transparent',
            color: 'transparent',
          };
          series.emphasis = {
            itemStyle: {
              borderColor: 'transparent',
              color: 'transparent',
            },
          };
          newSeries.push(series);
        }
      }
    });

    if (aggrData && option[axis + 'Field']) {
      const op = {
        [axis + 'Axis']: {
          type: 'category',
          data: option[axis + 'Field'] ? aggrData.map(item => item[option[axis + 'Field']]) : '',
        },
        series: [
          ...newSeries,
          {
            name: '상승',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: 'top',
            },
            data: increaseData ?? [],
          },
          {
            name: '하강',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: 'bottom',
            },
            data: decreaseData ?? [],
          },
        ],
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
    <Stack
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
    </Stack>
  );
};

export default WaterfallBarChart;
