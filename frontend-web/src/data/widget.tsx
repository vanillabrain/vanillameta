import { areaChartOption, donutChartOption, lineChartOption, pieChartOption } from '../data/options';

export const widgetList = [
  {
    label: '라인 차트',
    type: 'lineChart',
    option: lineChartOption,
    value: 0,
  },
  {
    label: '영역 차트',
    type: 'areaChart',
    option: areaChartOption,
    value: 1,
  },
  {
    label: '파이 차트',
    type: 'pieChart',
    option: pieChartOption,
    value: 2,
  },
  {
    label: '도넛 차트',
    type: 'donutChart',
    option: donutChartOption,
    value: 3,
  },
];
