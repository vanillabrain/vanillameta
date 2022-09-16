import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const LineChart = props => {
  const { option, dataSet, ...rest } = props;

  const [componentOption, setComponentOption] = useState({});

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
        type: rest.componentType,
        smooth: true,
      },
      {
        type: rest.componentType,
        smooth: true,
      },
    ],
    emphasis: {
      focus: 'series',
      blurScope: 'coordinateSystem',
    },
  };

  useEffect(() => {
    setComponentOption(createComponentOption());
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    let newOption = defaultComponentOption;

    // series option에서 가져오기
    const getOption = () =>
      option.series.map(item => ({
        name: item.field,
        data: dataSet.map(dataItem => dataItem[item.field]),
        type: rest.componentType,
        smooth: true,
      }));

    if (dataSet) {
      const op = {
        xAxis: {
          type: 'category',
          data: !!option.xField ? dataSet.map(item => item[option.xField]) : '',
        },
        series: getOption(),
        color: option.series.map(item => item.color), // TODO: color 매칭이 꼬이는 문제 해결
        legend: {}, // TODO: legend 위치 조정기능 추가
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    return newOption;
  };

  return <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} />;
};

export default LineChart;
