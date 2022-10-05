import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart, getCenter, getLegendOption } from '@/modules/utils/chartUtil';

const FunnelChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, setDataLength } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: { trigger: 'item' },
    toolbox: {
      feature: {
        dataView: { readOnly: false },
        restore: {},
        saveAsImage: {},
      },
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
      setDataLength(aggrData.length); // data 길이를 setting으로 전달해서 컬러 설정

      const series = {
        name: option.series.name,
        data: aggrData.map(item => ({
          value: item[option.series.field],
          name: item[option.series.name],
        })),
        type: 'funnel',
        color: [...option.series.color],
        label: { show: !!option.series.name && true },
        center: getCenter(option.legendPosition),
        ...seriesOp,
      };
      newSeries.push(series);
    }

    if (dataSet) {
      const op = {
        series: newSeries,
        legend: getLegendOption(option.legendPosition),
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

export default FunnelChart;
