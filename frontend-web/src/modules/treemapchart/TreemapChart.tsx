import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart, getCenter } from '@/modules/utils/chartUtil';

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
    setComponentOption(defaultComponentOption);
    setComponentOption(createComponentOption());
  }, [option, dataSet]);

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
        type: 'treemap',
        color: [...option.series.color],
        label: { show: true },
        center: getCenter(option.legendPosition),
        ...seriesOp,
      };
      newSeries.push(series);
    }

    if (dataSet) {
      const op = {
        color: [...option.series.color],
        series: newSeries,
      };
      newOption = { ...defaultComponentOption, ...op };
    }
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

export default TreemapChart;
