import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const LineChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    [axis + 'Axis']: {
      type: 'category',
    },
    [reverseAxis + 'Axis']: {
      type: 'value',
      boundaryGap: [0, 0.01],
    },
    series: [],
    emphasis: {
      focus: 'none',
    },
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
    // console.log('createComponentOption', option);
    let newOption = {};

    const newSeries = [];
    let aggrData = [];
    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
      // console.log('aggrData : ', aggrData);
      if (item.field && item.type) {
        const series = {
          name: item.field,
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: item.type,
          color: item.color,
          stack: item.type === 'bar' && 'stack',
          label: { show: option.label },
          markPoint: option.mark && {
            data: [
              { type: 'max', name: 'Max' },
              { type: 'min', name: 'Min' },
            ],
          },
          ...seriesOp,
        };
        newSeries.push(series);
      }
    });

    if (aggrData && option[axis + 'Field']) {
      const op = {
        [axis + 'Axis']: {
          type: 'category',
          data: option[axis + 'Field'] ? aggrData.map(item => item[option[axis + 'Field']]) : '',
        },
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
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
};

export default LineChart;
