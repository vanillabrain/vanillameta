import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const LineChart = props => {
  const { option, dataSet } = props;

  const sampleOption = {
    xField: 'name',
    series: [{ field: 'high' }, { field: 'low' }],
    legendPosition: 'left',
  };

  const [chartOption, setChartOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 8, right: 8, bottom: 24, left: 36 },
    yAxis: {
      type: 'value',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
    },
    series: [
      {
        type: 'line',
        smooth: true,
      },
      {
        type: 'line',
        smooth: true,
      },
    ],
  };

  useEffect(() => {
    console.log('LineChart ', option, dataSet);
    setChartOption(createComponentOption());
  }, [option, dataSet]);

  const createComponentOption = () => {
    let newOption = defaultComponentOption;
    if (dataSet) {
      const op = {
        xAxis: {
          type: 'category',
          data: dataSet.map(item => item[option.xField]),
        },
        series: [
          {
            data: dataSet.map(item => item[option.yField]),
            type: 'line',
            smooth: true,
          },
          {
            data: dataSet.map(item => item[option.yField1]),
            type: 'line',
            smooth: true,
          },
        ],
      };
      newOption = { ...defaultComponentOption, ...op };
    }

    return newOption;
  };

  return <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />;
};

export default LineChart;
