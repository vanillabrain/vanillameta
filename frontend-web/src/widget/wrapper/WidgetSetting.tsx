import React, { useEffect, useState } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { WIDGET_TYPE } from '@/constant';
import LineChart from '@/modules/linechart/LineChart';
import { get } from '@/helpers/apiHelper';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChart from '@/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import NumericBoard from '@/modules/board/NumericBoard';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoard from '@/modules/board/TableBoard';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import DonutChart from '@/modules/piechart/DonutChart';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import ScatterChart from '@/modules/scatterchart/ScatterChart';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';
import BubbleChart from '@/modules/scatterchart/BubbleChart';
import BubbleChartSetting from '@/widget/settings/BubbleChartSetting';
import RadarChart from '@/modules/radarchart/RadarChart';
import RadarChartSetting from '@/widget/settings/RadarChartSetting';
import TreemapChart from '@/modules/treemapchart/TreemapChart';
import TreemapChartSetting from '@/widget/settings/TreemapChartSetting';
import HeatmapChart from '@/modules/heatmapchart/HeatmapChart';
import HeatmapChartSetting from '@/widget/settings/HeatmapChartSetting';
import GaugeChart from '@/modules/gaugechart/GaugeChart';
import GaugeChartSetting from '@/widget/settings/GaugeChartSetting';
import CandlestickChart from '@/modules/candlestickchart/CandlestickChart';
import CandlestickChartSetting from '@/widget/settings/CandlestickChartSetting';
import Bar3DChart from '@/modules/3dchart/Bar3dChart';
import Bar3DChartSetting from '@/widget/settings/Bar3DChartSetting';
import Line3DChart from '@/modules/3dchart/Line3dChart';
import Line3DChartSetting from '@/widget/settings/Line3DChartSetting';
import Scatter3DChart from '@/modules/3dchart/Scatter3dChart';
import Scatter3DChartSetting from '@/widget/settings/Scatter3DChartSetting';
import { handleChange } from '@/widget/utils/handler';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';

const WidgetSetting = props => {
  const { title, setTitle, widgetOption, setWidgetOption, widgetType, dataSet, spec } = props;

  const [module, setModule] = useState(null);
  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidgetSetting();
  }, [widgetType, widgetOption, spec, dataSet]);

  const renderWidgetSetting = () => {
    console.log('===== renderWidgetSetting');
    let module = null;
    const chartSettingProps = {
      option: widgetOption,
      setOption: setWidgetOption,
      spec,
    };

    switch (widgetType) {
      case WIDGET_TYPE.BOARD_NUMERIC:
        module = <NumericBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE:
        module = <TableBoardSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_AREA:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BAR:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_BAR:
        module = <LineChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_STACKED_COLUMN:
        module = <LineChartSetting {...chartSettingProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_MIXED_LINE_BAR:
        module = <MixedLineBarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_PIE:
        module = <PieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_DONUT:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_NIGHTINGALE:
        module = <DonutChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SCATTER:
        module = <ScatterChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_BUBBLE:
        module = <BubbleChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_RADAR:
        module = <RadarChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_TREEMAP:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_HEATMAP:
        module = <HeatmapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_SUNBURST:
        module = <TreemapChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_GAUGE:
        module = <GaugeChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK:
        module = <CandlestickChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL:
        module = <PieChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BAR:
        module = <Bar3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_LINE:
        module = <Line3DChartSetting {...chartSettingProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_SCATTER:
        module = <Scatter3DChartSetting {...chartSettingProps} />;
        break;
      default:
        break;
    }

    console.log('module', module);
    setModule(module);
  };

  return (
    <Stack
      sx={{
        width: '440px',
        height: '100%',
        border: '1px solid #DADDDD',
        px: '24px',
        py: '30px',
      }}
    >
      <WidgetTitleForm value={title} onChange={event => setTitle(event.target.value)} />
      {module}
    </Stack>
  );
};

export default WidgetSetting;
