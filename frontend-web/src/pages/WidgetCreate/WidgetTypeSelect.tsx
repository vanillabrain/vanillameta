import React from 'react';
import ImgCardList from '../../components/ImgCardList';
import TitleBox from '../../components/TitleBox';
import { BarChart } from '@mui/icons-material';

const data = [
  { key: 1, value: '영역형 차트', caption: 'Area Chart', src: 'icon/area-chart.png' },
  { key: 2, value: '막대형 차트', caption: 'Bar Chart', src: 'icon/bar-chart.png' },
  { key: 3, value: '거품형 차트', caption: 'Bubble Chart', src: 'icon/bubble-chart.png' },
  { key: 4, value: '원형 차트', caption: 'Doughnut & Pie Chart', src: 'icon/doughnut-chart.png' },
  { key: 5, value: '선형 차트', caption: 'Line Chart', src: 'icon/line-chart.png' },
  { key: 6, value: '복합 차트', caption: 'Mixed Chart', src: 'icon/mixed-chart.png' },
  { key: 7, value: '극좌표형 차트', caption: 'Polar Area Chart', src: 'icon/polar-chart.png' },
  { key: 8, value: '방사형 차트', caption: 'Radar Chart', src: 'icon/radar-chart.png' },
  { key: 9, value: '분산형 차트', caption: 'Scatter Chart', src: 'icon/scatter-chart.png' },
];

function WidgetTypeSelect(props) {
  return (
    <TitleBox title="위젯 타입">
      <ImgCardList data={data} size="large" />
    </TitleBox>
  );
}

export default WidgetTypeSelect;
