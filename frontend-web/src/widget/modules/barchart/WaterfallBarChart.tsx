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

    let incomeData = [];
    let expensesData = [];
    let baseData = [];
    if (option.series.income.field) {
      aggrData = getAggregationDataForChart(
        dataSet,
        option[axis + 'Field'],
        option.series.income.field,
        option.series.income.aggregation,
      );

      incomeData = aggrData.map(item => item[option.series.income.field]);
      console.log('incomeData :', incomeData);
    }

    if (option.series.expenses.field) {
      aggrData = getAggregationDataForChart(
        dataSet,
        option[axis + 'Field'],
        option.series.expenses.field,
        option.series.expenses.aggregation,
      );
      expensesData = aggrData.map(item => -item[option.series.expenses.field]);
      console.log('expensesData :', expensesData);
    }

    baseData = incomeData.map((item, index) => expensesData[index] - item);
    // option.series.forEach(item => {
    //   aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
    //   const seriesData = aggrData.map((dataItem, dataIndex) => dataItem[item.field]);
    //   let prevData = 0;
    //   seriesData.forEach((dataItem, dataIndex) => {
    //     const gap = Math.round(Math.abs(dataItem) - Math.abs(prevData));
    //     // console.log(gap, 'gap');
    //     if (Math.sign(gap) === 1) {
    //       // 증가했을 경우
    //       decreaseSeries.push('-');
    //       increaseSeries.push(dataItem - prevData);
    //       transparentSeries.push(prevData);
    //     } else if (Math.sign(dataItem - prevData) === 0) {
    //       // 0
    //       decreaseSeries.push('-');
    //       increaseSeries.push('-');
    //       transparentSeries.push(prevData);
    //     } else {
    //       // 감소했을 경우
    //       increaseSeries.push('-');
    //       if (dataIndex === 0) {
    //         transparentSeries.push(prevData);
    //         decreaseSeries.push(dataItem - prevData);
    //       } else {
    //         decreaseSeries.push(Math.abs(dataItem - prevData));
    //         // transparentSeries.push(prevData - Math.abs(dataItem - prevData));
    //         transparentSeries.push(prevData + transparentSeries[dataIndex - 1] - dataItem);
    //       }
    //     }
    //     prevData = dataItem;
    //   });
    //   // seriesData.forEach(dataItem => {
    //   //   const gap = Math.round(dataItem - prevData);
    //   //   // console.log(gap, 'gap');
    //   //   if (Math.sign(gap) === 1) {
    //   //     // 증가했을 경우
    //   //     decreaseSeries.push('-');
    //   //     increaseSeries.push(gap);
    //   //     transparentSeries.push(prevData);
    //   //   } else if (Math.sign(gap) === 0) {
    //   //     // 0
    //   //     decreaseSeries.push('-');
    //   //     increaseSeries.push('-');
    //   //     transparentSeries.push(prevData);
    //   //   } else {
    //   //     // 감소했을 경우
    //   //     increaseSeries.push('-');
    //   //     decreaseSeries.push(Math.abs(gap));
    //   //     transparentSeries.push(prevData - Math.abs(gap));
    //   //   }
    //   //   prevData = dataItem;
    //   // });
    //   // console.log(transparentSeries, increaseSeries, decreaseSeries);
    //   // console.log('aggrData : ', aggrData);
    if (baseData.length) {
      const series = [
        {
          name: 'placeholder',
          // data: transparentSeries,
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
          name: option.series.income.field,
          color: option.series.income.color,
          type: 'bar',
          stack: 'total',
          label: {
            show: true,
            position: axis === 'x' ? 'top' : 'right',
          },
          data: incomeData,
        },
        {
          name: option.series.expenses.field,
          color: option.series.expenses.color,
          type: 'bar',
          stack: 'total',
          label: {
            show: true,
            position: axis === 'x' ? 'bottom' : 'left',
            formatter: '-{c}',
          },
          data: expensesData,
        },
      ];
      newSeries.push(...series);
    }
    // });

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
