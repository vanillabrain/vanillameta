import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getAggregationDataForChartWithMultipleKeys } from '@/widget/modules/utils/chartUtil';

type HierarchyNode = { name: string; value: number; children?: HierarchyNode[] };

const createHierarchy = (rows, names: string[], field: string): HierarchyNode[] => {
  const groups = new Map<string, typeof rows>();
  rows.forEach(row => {
    const category = row[names[0]];
    const name = category == null || category === '' ? '(empty)' : String(category);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  });
  return Array.from(groups, ([name, group]) => {
    if (names.length === 1) {
      return { name, value: group.reduce((sum, row) => sum + row[field], 0) };
    }
    const children = createHierarchy(group, names.slice(1), field);
    return { name, value: children.reduce((sum, child) => sum + child.value, 0), children };
  });
};

const TreemapChart = props => {
  const { option, dataSet, seriesOp } = props;

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    tooltip: {
      trigger: 'item',
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
    let aggrData = [];

    if (option.series.name && option.series.field && (!Array.isArray(option.series.name) || option.series.name.length > 0)) {
      const names = option.series.name;
      const hierarchy = Array.isArray(names);
      aggrData = hierarchy
        ? getAggregationDataForChartWithMultipleKeys(dataSet, names, option.series.field, option.series.aggregation)
        : getAggregationDataForChart(dataSet, names, option.series.field, option.series.aggregation);

      const series = {
        name: hierarchy ? names.join(' / ') : names,
        data: hierarchy
          ? createHierarchy(aggrData, names, option.series.field)
          : aggrData.map(item => ({ value: item[option.series.field], name: item[names] })),
        label: {
          show: option.label,
        },
        type: 'treemap',
        ...seriesOp,
      };

      newSeries.push(series);
    }

    if (dataSet) {
      let minValue = 0;
      let maxValue = 1;
      if (aggrData.length) {
        const arr = aggrData.map(item => item[option.series.field]);
        minValue = Math.min(...arr);
        maxValue = Math.max(...arr);
      }
      // console.log('minVal: ', minValue, 'maxVal: ', maxValue);

      const op = {
        series: newSeries,
        visualMap: {
          type: 'continuous',
          min: !Number.isNaN(minValue) && minValue,
          max: !Number.isNaN(maxValue) && maxValue,
          inRange: {
            color: option.series.color.map(item => item),
          },
        },
      };
      newOption = { ...defaultComponentOption, ...op };
    }
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

export default TreemapChart;
