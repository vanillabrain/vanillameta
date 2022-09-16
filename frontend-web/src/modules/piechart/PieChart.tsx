import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const PieChart = props => {
  const { option, dataSet } = props;

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
    series: [
      {
        type: 'pie',
        smooth: true,
      },
      {
        type: 'pie',
        smooth: true,
      },
    ],
  };

  useEffect(() => {
    console.log('PieChart ', option, dataSet);
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
    // const getOption = () =>
    //   option.series.map(item => ({
    //     name: item.field,
    //     data: dataSet.map(dataItem => dataItem[item.field]),
    //     type: 'pie',
    //     smooth: true,
    //   }));

    if (dataSet) {
      const op = {
        series: [
          {
            type: 'pie',
            smooth: true,
            data: [
              { value: 1048, name: 'Search Engine' },
              { value: 735, name: 'Direct' },
              { value: 580, name: 'Email' },
              { value: 484, name: 'Union Ads' },
              { value: 300, name: 'Video Ads' },
            ],
            color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
          },
        ],
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    return newOption;
  };

  return <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} />;
};

export default PieChart;
