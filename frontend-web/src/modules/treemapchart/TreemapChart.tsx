import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box } from '@mui/material';
import { getAggregationDataForChart, getCenter, getGridSize, getLegendOption } from '@/modules/utils/chartUtil';

const TreemapChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
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
    let newOption = {};

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
        // series: [
        //   {
        //     type: 'pie',
        //     label: { show: !!option.series.label && true },
        //     smooth: true,
        //     data: getData(),
        //     center: getCenter(option.legendPosition),
        //     ...seriesOp,
        //   },
        // ],
        series: [
          {
            type: 'treemap',
            data: [
              {
                name: 'nodeA',
                value: 10,
                children: [
                  {
                    name: 'nodeAa',
                    value: 4,
                  },
                  {
                    name: 'nodeAb',
                    value: 6,
                  },
                ],
              },
              {
                name: 'nodeB',
                value: 20,
                children: [
                  {
                    name: 'nodeBa',
                    value: 20,
                    children: [
                      {
                        name: 'nodeBa1',
                        value: 20,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        legend: getLegendOption(option.legendPosition),
      };
      newOption = { ...defaultComponentOption, ...op };
    }
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
};

export default TreemapChart;
