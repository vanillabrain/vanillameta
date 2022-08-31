import { areaChartOption, donutChartOption, lineChartOption, pieChartOption } from '@/data/options';

export const componentList = [
  {
    label: '라인 차트',
    type: 'lineChart',
    option: lineChartOption,
  },
  {
    label: '영역 차트',
    type: 'areaChart',
    option: areaChartOption,
  },
  {
    label: '파이 차트',
    type: 'pieChart',
    option: pieChartOption,
  },
  {
    label: '도넛 차트',
    type: 'donutChart',
    option: donutChartOption,
  },
];

export const getComponent = type => {
  return componentList.find(item => type === item.type);
};
