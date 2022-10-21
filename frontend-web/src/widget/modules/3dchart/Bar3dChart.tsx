import React, { useEffect, useState } from 'react';
import { getAggregationDataForChart } from '@/widget/modules/utils/chartUtil';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';

function Bar3DChart(props) {
  const { option, dataSet, defaultOp } = props;
  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid3D: {},
    tooltip: {},
    xAxis3D: {
      type: 'category',
    },
    yAxis3D: {
      type: 'category',
    },
    zAxis3D: {},
    series: [],

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

    let xAxisData = [];
    const aggrData = [];
    if (option.xField) {
      option.series.forEach((item, index) => {
        const aggrItem = getAggregationDataForChart(dataSet, option.xField, item.field, item.aggregation);
        // console.log('aggrData :', aggrData);
        if (!xAxisData.length) {
          xAxisData = aggrItem.map(element => element[option.xField]);
          // console.log(xAxisData, 'xAxisData');
        }
        if (item.field) {
          const result = aggrItem.map((element, idx) => [idx, index, element[item.field]]);
          aggrData.push(...result);
          // console.log('aggrData :', aggrData);
        }
      });
    }

    let minValue, maxValue;
    if (aggrData.length) {
      const arr = aggrData.map(item => item[2]);
      minValue = Math.min(...arr);
      maxValue = Math.max(...arr);
      // console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        xAxis3D: {
          type: 'category',
          splitArea: { show: true },
          data: xAxisData,
        },
        yAxis3D: {
          type: 'category',
          splitArea: { show: true },
          data: option.series.map(item => item.field),
        },
        zAxis3D: {
          type: 'value',
          min: minValue,
          max: maxValue,
        },
        series: [
          {
            data: aggrData,
            type: 'bar3D',
            shading: 'lambert',
            label: { show: option.label },
          },
        ],
        visualMap: {
          min: minValue ?? 0,
          max: maxValue ?? 0,
          inRange: {
            color: option.color.map(item => item),
          },
        },
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

export default Bar3DChart;
