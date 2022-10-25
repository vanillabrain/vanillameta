import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

function BubbleChart(props) {
  const { option, dataSet, seriesOp, defaultOp, createOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
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

  const createComponentOption = () => {
    let newOption = {};

    // series option에서 가져오기
    const newSeries = [];
    option.series.forEach(item => {
      if (item.xField || item.yField) {
        const series = {
          type: 'scatter',
          name: item.title,
          data: dataSet.map(dataItem => [dataItem[item.xField], dataItem[item.yField], dataItem[item.symbolSize]]),
          symbolSize: function (data) {
            return Math.sqrt(data[2]);
          },
          color: item.color,
          label: { show: option.label },
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

export default BubbleChart;
