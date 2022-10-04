import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart } from '@/modules/utils/chartUtil';

const TreemapChart = props => {
  const { option, dataSet, seriesOp, setDataLength } = props;

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

    if (option.series.label) {
      aggrData = getAggregationDataForChart(dataSet, option.series.label, option.series.field, option.series.aggregation);
      setDataLength(aggrData.length);

      const series = {
        name: option.series.label,
        data: aggrData.map(item => ({
          value: item[option.series.field],
          name: item[option.series.label],
        })),
        type: 'treemap',
        color: [...option.series.color],
        ...seriesOp,
      };
      console.log(series);
      newSeries.push(series);
    }

    if (dataSet) {
      const op = {
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
