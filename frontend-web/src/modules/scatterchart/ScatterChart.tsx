import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';

function ScatterChart(props) {
  const { option, dataSet, seriesOp, defaultOp, createOp, ...rest } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 8, right: 8, bottom: 24, left: 36 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
    },
    yAxis: {
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
    }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    let newOption = defaultComponentOption;

    // series option에서 가져오기
    const newSeries = [];
    const newColors = [];
    option.series.forEach(item => {
      if (item.field) {
        const series = {
          name: item.field,
          data: dataSet.map(dataItem => dataItem[item.field]),
          type: 'scatter',
          ...seriesOp,
        };
        newSeries.push(series);
        newColors.push(item.color);
      }
    });
    if (dataSet) {
      const op = {
        xAxis: {
          type: 'category',
          data: !!option.xField ? dataSet.map(item => item[option.xField]) : '',
        },
        series: newSeries,
        color: newColors,
        legend: {}, // TODO: legend 위치 조정기능 추가
        ...createOp,
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
}

export default ScatterChart;