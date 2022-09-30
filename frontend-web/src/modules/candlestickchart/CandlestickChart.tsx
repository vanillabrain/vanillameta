import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/modules/utils/chartUtil';

const CandlestickChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    [axis + 'Axis']: {
      type: 'category',
    },
    [reverseAxis + 'Axis']: {},
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
    const newSeries = [];
    const aggrData = [];

    // option.series.forEach(item => {
    //   const field1 = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.fieldUp, item.aggregationUp);
    //   const field2 = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.fieldDown, item.aggregationDown);
    //   const field3 = getAggregationDataForChart(
    //     dataSet,
    //     option[axis + 'Field'],
    //     item.fieldUpBorder,
    //     item.aggregationUpBorder,
    //   );
    //   const field4 = getAggregationDataForChart(
    //     dataSet,
    //     option[axis + 'Field'],
    //     item.fieldDownBorder,
    //     item.aggregationDownBorder,
    //   );
    //   aggrData = [field1, field2, field3, field4];
    //   if (item.field) {
    //     const series = {
    //       name: item.field,
    //       type: 'candlestick',
    //       data: aggrData,
    //       itemStyle: {
    //         color: item.color,
    //         color0: '#fab',
    //         borderColor: '#eee',
    //         borderColor0: '#121212',
    //       },
    //       smooth: true,
    //       ...seriesOp,
    //     };
    //     newSeries.push(series);
    //   }
    // });

    if (aggrData) {
      const op = {
        [axis + 'Axis']: {
          type: 'category',
          // data: !!option[axis + 'Field'] ? aggrData.map(item => item[option[axis + 'Field']]) : '',
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        [reverseAxis + 'Axis']: {
          scale: true,
          splitArea: {
            show: true,
          },
        },
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    console.log(newOption);
    return newOption;
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
    </Box>
  );
};

export default CandlestickChart;
