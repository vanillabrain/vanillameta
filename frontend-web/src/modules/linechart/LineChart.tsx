import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';

const LineChart = props => {
  const { option, dataSet } = props;

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
    //   console.log('LineChart ', option, dataSet);
    setComponentOption(createComponentOption());
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */

  const createComponentOption = () => {
    let newOption = defaultComponentOption;
    const _seriesLength = option.series.length;
    // console.log(_seriesLength);
    const defaultColor = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

    if (dataSet) {
      const op = {
        xAxis: {
          type: 'category',
          data: dataSet.map(item => item[option.xField]),
        },
        yAxis: {
          type: 'value',
          data: dataSet.map(item => item[option.yField]),
        },
        series: [
          // TODO: seriesLength 만큼 series 길이 늘어나게 하고 값 받아오기
          {
            name: option.field1,
            data: dataSet.map(item => item[option.series[0].field]),
            type: 'line',
            smooth: true,
          },
          {
            name: option.field2 ?? '',
            data: !!option.series[1] ? dataSet.map(item => item[option.series[1].field]) : '',
            type: 'line',
            smooth: true,
          },
          {
            name: option.field3 ?? '',
            data: !!option.series[2] ? dataSet.map(item => item[option.series[2].field]) : '',
            type: 'line',
            smooth: true,
          },
          {
            name: option.field4 ?? '',
            data: !!option.series[3] ? dataSet.map(item => item[option.series[3].field]) : '',
            type: 'line',
            smooth: true,
          },
          {
            name: option.field5 ?? '',
            data: !!option.series[4] ? dataSet.map(item => item[option.series[4].field]) : '',
            type: 'line',
            smooth: true,
          },
          {
            name: option.field6 ?? '',
            data: !!option.series[5] ? dataSet.map(item => item[option.series[5].field]) : '',
            type: 'line',
            smooth: true,
          },
          {
            name: option.field7 ?? '',
            data: !!option.series[6] ? dataSet.map(item => item[option.series[6].field]) : '',
            type: 'line',
            smooth: true,
          },
        ],
        color: option.series.map(item => item.color), // TODO: defaultColor 추가
        legend: {}, // TODO: legend 위치 조정기능 추가
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    return newOption;
  };

  return <ReactECharts option={componentOption} style={{ height: '100%', width: '100%' }} />;
};

export default LineChart;
