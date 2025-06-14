import React, { useEffect, useState, useMemo } from 'react';
import OptimizedChart from '@/components/OptimizedChart';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';
import { AGGREGATION_LIST } from '@/constant';

const LineChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const defaultComponentOption = useMemo(() => ({
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    tooltip: { trigger: 'axis' },
    [axis + 'Axis']: {
      type: 'category',
    },
    [reverseAxis + 'Axis']: {
      type: 'value',
    },
    series: [],
    emphasis: {
      focus: 'series',
      blurScope: 'coordinateSystem',
    },
    ...defaultOp,
  }), [axis, reverseAxis, defaultOp]);

  /**
   * 위젯옵션과 데이터로 컴포넌트에 맞는 형태로 생성
   * useMemo를 사용하여 불필요한 재계산 방지
   */
  const componentOption = useMemo(() => {
    if (!option || !dataSet) return {};

    // series option에서 가져오기
    const newSeries = [];
    let aggrData = [];
    
    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
      
      if (item.field) {
        const series = {
          name:
            (item?.fieldLabel ? item.fieldLabel : item.field) +
            (option?.legendAggregation
              ? ` (${AGGREGATION_LIST.find(element => element.value === item.aggregation)?.label || ''})`
              : ''),
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: item.type ? item.type : 'line',
          color: item.color,
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
          data: option[axis + 'Field']
            ? axis === 'x'
              ? aggrData.map(item => item[option[axis + 'Field']])
              : aggrData.map(item => item[option[axis + 'Field']]).reverse()
            : '',
        },
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };
      return { ...defaultComponentOption, ...op };
    }
    
    return defaultComponentOption;
  }, [option, dataSet, axis, seriesOp, createOp, defaultComponentOption]);

  return (
    <OptimizedChart
      option={componentOption}
      style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}
      lazyUpdate={true}
      notMerge={true}
      enableDataSampling={true}
      maxDataPoints={10000}
      renderer="canvas"
    />
  );
};

export default LineChart;
