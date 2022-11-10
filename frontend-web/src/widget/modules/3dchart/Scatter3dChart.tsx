import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import { getLegendOption } from '@/widget/modules/utils/chartUtil';

function Scatter3DChart(props) {
  const { option, dataSet, defaultOp } = props;
  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid3D: {},
    tooltip: {},
    xAxis3D: {
      scale: true,
    },
    yAxis3D: {
      scale: true,
    },
    zAxis3D: {},
    series: [],
    legend: {},

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
    option.series.forEach(item => {
      if (item.xField && item.yField && item.zField) {
        const series = {
          name: item.title,
          data: dataSet.map(dataItem => [dataItem[item.xField], dataItem[item.yField], dataItem[item.zField]]),
          type: 'scatter3D',
          symbolSize: item.symbolSize,
          color: item.color,
          itemStyle: {
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.8)',
          },
          label: { show: option.label },
        };
        newSeries.push(series);
      }
    });

    if (dataSet) {
      const op = {
        xAxis3D: {
          type: 'value',
          splitArea: { show: true },
        },
        yAxis3D: {
          type: 'value',
          splitArea: { show: true },
        },
        zAxis3D: {
          type: 'value',
        },
        series: newSeries,
        // grid3D: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
      };

      newOption = { ...defaultComponentOption, ...op };
    }
    // console.log(newOption);
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

export default Scatter3DChart;
