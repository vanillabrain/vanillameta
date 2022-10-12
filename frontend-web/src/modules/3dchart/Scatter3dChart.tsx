import React, { useEffect, useState } from 'react';
import { getAggregationDataForChart } from '@/modules/utils/chartUtil';
import { Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import axios from 'axios';

function Scatter3DChart(props) {
  const { option, dataSet, defaultOp } = props;

  const [componentOption, setComponentOption] = useState({});
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get('/data/sample/chart3d.json').then(response => {
      setData(response.data);
    });
  }, []);

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
      option.series.map((item, index) => {
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
            type: 'scatter3D',
            shading: 'lambert',
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

export default Scatter3DChart;
