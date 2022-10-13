import React, { useEffect, useState } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { WIDGET_TYPE } from '@/constant';
import LineChart from '@/widget/modules/linechart/LineChart';
import { get } from '@/helpers/apiHelper';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChart from '@/widget/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import NumericBoard from '@/widget/modules/board/NumericBoard';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoard from '@/widget/modules/board/TableBoard';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import DonutChart from '@/widget/modules/piechart/DonutChart';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import ScatterChart from '@/widget/modules/scatterchart/ScatterChart';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';
import BubbleChart from '@/widget/modules/scatterchart/BubbleChart';
import BubbleChartSetting from '@/widget/settings/BubbleChartSetting';
import RadarChart from '@/widget/modules/radarchart/RadarChart';
import RadarChartSetting from '@/widget/settings/RadarChartSetting';
import TreemapChart from '@/widget/modules/treemapchart/TreemapChart';
import TreemapChartSetting from '@/widget/settings/TreemapChartSetting';
import HeatmapChart from '@/widget/modules/heatmapchart/HeatmapChart';
import HeatmapChartSetting from '@/widget/settings/HeatmapChartSetting';
import GaugeChart from '@/widget/modules/gaugechart/GaugeChart';
import GaugeChartSetting from '@/widget/settings/GaugeChartSetting';
import CandlestickChart from '@/widget/modules/candlestickchart/CandlestickChart';
import CandlestickChartSetting from '@/widget/settings/CandlestickChartSetting';
import Bar3DChart from '@/widget/modules/3dchart/Bar3dChart';
import Bar3DChartSetting from '@/widget/settings/Bar3DChartSetting';
import Line3DChart from '@/widget/modules/3dchart/Line3dChart';
import Line3DChartSetting from '@/widget/settings/Line3DChartSetting';
import Scatter3DChart from '@/widget/modules/3dchart/Scatter3dChart';
import Scatter3DChartSetting from '@/widget/settings/Scatter3DChartSetting';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId } = props;

  const [dataset, setDataset] = useState(null);
  useEffect(() => {
    console.log('WidgetWrapper', dataSetId);

    if (dataSetId) {
      getData();
    }
  }, [dataSetId]);

  const getData = () => {
    get('http://localhost:3000/data/sample/chartFull.json').then(response => {
      console.log('res', response.data);
      setDataset(response.data.data);
    });
  };

  return (
    <WidgetViewer
      title={widgetOption.title}
      widgetType={widgetOption.componentType}
      widgetOption={widgetOption.option}
      dataSet={dataset}
    />
  );
};

export default WidgetWrapper;
