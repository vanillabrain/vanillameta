import React, { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const PieChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 8, right: 8, bottom: 24, left: 36 },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
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

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */
  const createComponentOption = () => {
    let newOption = { ...defaultComponentOption };

    const getData = () =>
      dataSet.map(item => ({
        value: item[option.series.field],
        name: item[option.series.label],
      }));
    if (dataSet) {
      const op = {
        type: 'pie',
        smooth: true,
        color: [...option.series.color],
        series: [
          {
            type: 'pie',
            label: { show: !!option.series.label && true },
            smooth: true,
            data: getData(),
            ...seriesOp,
          },
        ],
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    return newOption;
  };

  return (
    <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} lazyUpdate={true} notMerge={true} />
  );
};

export default PieChart;
