import React, { useEffect, useState } from 'react';
import { getAggregationDataForChart, getLegendOption } from '@/modules/utils/chartUtil';
import { Box } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';
import axios from 'axios';

function Line3DChart(props) {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState({});
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get('/data/sample/chart3d.json').then(response => {
      setData(response.data);
    });
  }, []);

  const defaultComponentOption = {
    grid3D: {},
    tooltip: {
      // trigger: 'axis'
    },
    [axis + 'Axis3D']: {
      type: 'category',
    },
    [reverseAxis + 'Axis3D']: {
      type: 'category',
    },
    zAxis3D: {},
    visualMap: {
      max: 1e8,
      dimension: 'Population',
    },
    dataset: {},
    series: [],
    // emphasis: {
    //   focus: 'series',
    //   blurScope: 'coordinateSystem',
    // // },

    ...defaultOp,
  };

  useEffect(() => {
    // if (option && dataSet) {
    const newOption = createComponentOption();
    setComponentOption(newOption);
    // }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */
  const createComponentOption = () => {
    let newOption = {};

    // series option에서 가져오기
    // const newSeries = [];
    // let aggrData = [];
    // option.series.forEach(item => {
    //   aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
    //   if (item.field) {
    //     const series = {
    //       name: item.field,
    //       data: aggrData.map(dataItem => dataItem[item.field]),
    //       type: item.type ? item.type : 'line',
    //       color: item.color,
    //       smooth: true,
    //       ...seriesOp,
    //     };
    //     newSeries.push(series);
    //   }
    // });

    console.log(componentOption);
    if (data) {
      const op = {
        dataset: {
          dimension: ['Income', 'Life Expectancy', 'Population', 'Country', { name: 'Year', type: 'ordinal' }],
          source: data,
        },
        series: [
          {
            type: 'bar3D',
            shading: 'lambert',
            // data: [
            //   [-1, -1, -1],
            //   [0, 0, 0],
            //   [1, 1, 1],
            // ],
            encode: {
              x: 'Year',
              y: 'Country',
              z: 'Life Expectancy',
              tooltip: [0, 1, 2, 3, 4],
            },
          },
        ],
        // series: newSeries,
        // grid: getGridSize(option.legendPosition),
        // legend: getLegendOption(option.legendPosition),
        ...createOp,
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
