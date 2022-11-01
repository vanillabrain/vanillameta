import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

const testLineChart = ({ option, dataSet, seriesOp, createOp }) => {
  console.log('createComponentOption', option);

  if (option && dataSet) {
    const newSeries = [];
    let aggrData = [];

    option.series.forEach(item => {
      aggrData = getAggregationDataForChart(dataSet, option.xField, item.field, item.aggregation);
      console.log('aggrData : ', aggrData);

      if (item.field) {
        const series = {
          name: item.field,
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: item.type ? item.type : 'line',
          color: item.color,
          smooth: true,
          ...seriesOp,
        };
        newSeries.push(series);
      }
    });

    if (aggrData && option.xField) {
      const createOption = {
        xAxis: {
          type: 'category',
          data: option.xField ? aggrData.map(item => item[option.xField]) : '',
        },
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };
      console.log(createOption);
      return createOption;
    }
  }
};

export default testLineChart;
