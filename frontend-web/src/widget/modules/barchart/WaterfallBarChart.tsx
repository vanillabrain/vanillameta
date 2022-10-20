import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const WaterfallBarChart = props => {
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState({});

  const defaultComponentOption = {
    grid: { top: 50, right: 50, bottom: 50, left: 50 },
    tooltip: { trigger: 'axis' },
    axisPointer: {
      type: 'shadow',
    },
    [axis + 'Axis']: {
      type: 'category',
    },
    splitLine: { show: false },
    [reverseAxis + 'Axis']: {
      type: 'value',
    },
    series: [],
    ...defaultOp,
  };

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setComponentOption(newOption);
      // console.log('createComponentOption', newOption);
    }
  }, [option, dataSet]);

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */
  const createComponentOption = () => {
    console.log('createComponentOption', option);
    let newOption = {};

    const newSeries = [];
    let aggrData = [];
    const baseData = [];
    const incomeData = [];
    const expensesData = [];
    const incomeNegativeData = [];
    const expensesNegativeData = [];
    let prevIncrease = true;
    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
      const seriesData = aggrData.map(dataItem => dataItem[item.field]);
      let prevItem = 0;
      seriesData.forEach((dataItem, idx) => {
        if (Math.abs(prevItem) < Math.abs(dataItem)) {
          // 증가했을 경우
          expensesData.push('-');

          if (prevIncrease) {
            // 이전 step에도 증가했을 경우
            baseData.push(prevItem);
            incomeData.push(dataItem - prevItem);
          } else {
            baseData.push(baseData[idx - 1]);
            incomeData.push(dataItem - baseData[idx - 1]);
          }

          // 양수에서 음수, 음수에서 양수로 값이 바뀌었을 시 예외 처리
          if (prevItem * dataItem < 0) {
            incomeNegativeData.length = idx;
            incomeNegativeData[idx] = baseData[idx];
            incomeData[idx] = incomeData[idx] + baseData[idx];
            baseData[idx] = 0;
          }
          prevIncrease = true;
        } else {
          // 감소했을 경우
          incomeData.push('-');
          baseData.push(dataItem);
          if (!prevIncrease) {
            // 이전 step에도 감소했을 경우
            expensesData.push(baseData[idx - 1] - dataItem);
          } else {
            expensesData.push(prevItem - dataItem);
          }

          // 양수에서 음수, 음수에서 양수로 값이 바뀌었을 시 예외 처리
          if (prevItem * dataItem < 0) {
            expensesNegativeData.length = idx;
            expensesNegativeData[idx] = baseData[idx];
            expensesData[idx] = expensesData[idx] + baseData[idx];
            baseData[idx] = 0;
          }
          prevIncrease = false;
        }

        console.log(dataItem, prevItem, dataItem - prevItem);
        prevItem = dataItem;
      });
      // console.log('aggrData : ', aggrData);
      if (item.field) {
        const series = [
          {
            name: item.field,
            data: baseData,
            type: 'bar',
            stack: 'total',
            itemStyle: {
              borderColor: 'transparent',
              color: '#eee',
            },
            emphasis: {
              itemStyle: {
                borderColor: 'transparent',
                color: 'transparent',
              },
            },
            // tooltip: {
            //   show: false,
            // },
          },
          {
            name: '수입',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: axis === 'x' ? 'top' : 'right',
            },
            data: incomeData,
          },
          {
            name: '지출',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: axis === 'x' ? 'bottom' : 'left',
              formatter: '-{c}',
            },
            data: expensesData,
          },
          {
            name: '수입',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: axis === 'x' ? 'top' : 'right',
            },
            data: incomeNegativeData,
          },
          {
            name: '지출',
            type: 'bar',
            stack: 'total',
            label: {
              show: true,
              position: axis === 'x' ? 'bottom' : 'left',
              formatter: '-{c}',
            },
            data: expensesNegativeData,
          },
        ];
        newSeries.push(...series);
      }
    });

    if (aggrData && option[axis + 'Field']) {
      const op = {
        [axis + 'Axis']: {
          type: 'category',
          data: option[axis + 'Field'] ? aggrData.map(item => item[option[axis + 'Field']]) : '',
        },
        series: newSeries,
        color: [...option.color],
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };

      newOption = { ...defaultComponentOption, ...op };
    }

    console.log(newOption);
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

export default WaterfallBarChart;
