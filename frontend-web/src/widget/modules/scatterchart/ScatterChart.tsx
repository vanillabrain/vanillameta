import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

function ScatterChart(props) {
  const { option, dataSet, seriesOp, defaultOp, createOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      scale: true,
    },
    yAxis: {
      scale: true,
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

  console.log(option);
  const createComponentOption = () => {
    let newOption = {};

    // series option에서 가져오기
    const newSeries = [];
    option.series.forEach(item => {
      if (item.xField || item.yField) {
        const series = {
          type: 'scatter',
          name: item.title,
          data: dataSet.map(dataItem => [dataItem[item.xField], dataItem[item.yField]]),
          symbolSize: item.symbolSize,
          color: item.color,
          ...seriesOp,
        };
        newSeries.push(series);
      }
    });
    if (dataSet) {
      const op = {
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };

      newOption = { ...defaultComponentOption, ...op };
    }

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
}

export default ScatterChart;
