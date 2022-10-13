import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart } from '@/widget/modules/utils/chartUtil';

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

    let xAxisData = [];
    const aggrData = [];
    if (option.xField) {
      option.series.forEach((item, index) => {
        const aggrItem = getAggregationDataForChart(dataSet, option.xField, item.field, option.aggregation);
        // console.log('aggrData :', aggrData);
        if (!xAxisData.length) {
          xAxisData = aggrItem.map(element => element[option.xField]);
          // console.log(xAxisData, 'xAxisData');
        }
        if (item.field) {
          const result = aggrItem.map((element, idx) => [idx, index, element[item.field]]);
          aggrData.push(...result);
          // console.log('aggrData :', aggrData);
        }
      });
    }

    let minValue, maxValue;
    if (aggrData.length) {
      const arr = aggrData.map(item => item[2]);
      minValue = Math.min(...arr);
      maxValue = Math.max(...arr);
      // console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        xAxis: {
          type: 'category',
          splitArea: { show: true },
          data: xAxisData,
        },
        yAxis: {
          type: 'category',
          splitArea: { show: true },
          data: option.series.map(item => item.field),
        },
        series: [
          {
            data: aggrData.map(item => [item[0], item[1], item[2] || '-']),
            type: 'heatmap',
            label: { show: true },
          },
        ],
        visualMap: {
          type: 'continuous',
          min: minValue ?? 0,
          max: maxValue ?? 0,
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

export default HeatmapChart;
