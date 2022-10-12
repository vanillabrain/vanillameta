import React, { useEffect, useState } from 'react';
import { getAggregationDataForChart } from '@/modules/utils/chartUtil';
import { Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import axios from 'axios';

function Line3DChart(props) {
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

    let xAxisData = [];
    const newSeries = [];
    let aggrData = [];
    option.series.forEach((item, index) => {
      aggrData = getAggregationDataForChart(dataSet, option.xField, item.field, item.aggregation);
      if (!xAxisData.length) {
        xAxisData = aggrData.map(element => element[option.xField]);
        // console.log(xAxisData, 'xAxisData');
      }
      if (item.field) {
        const series = {
          name: item.field,
          data: aggrData.map((element, idx) => [idx, index, element[item.field]]),
          type: 'line3D',
          color: item.color,
          shading: 'lambert',
          lineStyle: {
            width: 4,
          },
        };
        newSeries.push(series);
      }
    });

    if (aggrData.length) {
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
        },
        series: newSeries,
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

export default Line3DChart;
