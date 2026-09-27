import React from 'react';
import { Divider } from '@mui/material';
import { WIDGET_TYPE } from '@/constant';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';
import BubbleChartSetting from '@/widget/settings/BubbleChartSetting';
import RadarChartSetting from '@/widget/settings/RadarChartSetting';
import TreemapChartSetting from '@/widget/settings/TreemapChartSetting';
import HeatmapChartSetting from '@/widget/settings/HeatmapChartSetting';
import GaugeChartSetting from '@/widget/settings/GaugeChartSetting';
import CandlestickChartSetting from '@/widget/settings/CandlestickChartSetting';
import Bar3DChartSetting from '@/widget/settings/Bar3DChartSetting';
import Line3DChartSetting from '@/widget/settings/Line3DChartSetting';
import Scatter3DChartSetting from '@/widget/settings/Scatter3DChartSetting';
import Bubble3DChartSetting from '@/widget/settings/Bubble3DChartSetting';
import WaterfallChartSetting from '@/widget/settings/WaterfallChartSetting';
import PolarBarChartSetting from '@/widget/settings/PolarBarChartSetting';
import MixedLinePieChartSetting from '@/widget/settings/MixedLinePieChartSetting';
import MixedDonutPieChartSetting from '@/widget/settings/MixedDonutPieChartSetting';
import MixedLineStackedBarChartSetting from '@/widget/settings/MixedLineStackedBarChartSetting';
import FunnelChartSetting from '@/widget/settings/FunnelChartSetting';
import { NO_COMPONENT_MESSAGE } from './viewerRegistry';

export interface WidgetSettingProps {
  option: any;
  setOption: (option: any) => void;
  spec: any;
  dataSet: any;
  [key: string]: any;
}

export type WidgetSettingRenderer = (props: WidgetSettingProps) => React.ReactNode;

/**
 * 위젯 타입 → 설정 컴포넌트 매핑. (기존 WidgetSetting 의 switch 를 대체)
 */
export const WIDGET_SETTINGS: Record<string, WidgetSettingRenderer> = {
  [WIDGET_TYPE.BOARD_NUMERIC]: props => <NumericBoardSetting {...props} />,
  [WIDGET_TYPE.BOARD_TABLE]: props => <TableBoardSetting {...props} />,

  [WIDGET_TYPE.CHART_LINE]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_STACKED_LINE]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_AREA]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_STACKED_AREA]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_BAR]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_STACKED_BAR]: props => <LineChartSetting {...props} />,
  [WIDGET_TYPE.CHART_COLUMN]: props => <LineChartSetting {...props} axis="y" />,
  [WIDGET_TYPE.CHART_STACKED_COLUMN]: props => <LineChartSetting {...props} axis="y" />,
  [WIDGET_TYPE.MIXED_CHART_LINE_BAR]: props => <MixedLineBarChartSetting {...props} />,

  [WIDGET_TYPE.CHART_PIE]: props => <PieChartSetting {...props} />,
  [WIDGET_TYPE.CHART_DONUT]: props => <DonutChartSetting {...props} />,
  [WIDGET_TYPE.CHART_NIGHTINGALE]: props => <DonutChartSetting {...props} />,

  [WIDGET_TYPE.CHART_SCATTER]: props => <ScatterChartSetting {...props} />,
  [WIDGET_TYPE.CHART_BUBBLE]: props => <BubbleChartSetting {...props} />,
  [WIDGET_TYPE.CHART_RADAR]: props => <RadarChartSetting {...props} />,
  [WIDGET_TYPE.CHART_TREEMAP]: props => <TreemapChartSetting {...props} />,
  [WIDGET_TYPE.CHART_HEATMAP]: props => <HeatmapChartSetting {...props} />,
  [WIDGET_TYPE.CHART_SUNBURST]: props => <TreemapChartSetting {...props} />,
  [WIDGET_TYPE.CHART_GAUGE]: props => <GaugeChartSetting {...props} />,
  [WIDGET_TYPE.CHART_CANDLESTICK]: props => <CandlestickChartSetting {...props} />,
  [WIDGET_TYPE.CHART_FUNNEL]: props => <FunnelChartSetting {...props} />,

  [WIDGET_TYPE.CHART_3D_BAR]: props => <Bar3DChartSetting {...props} />,
  [WIDGET_TYPE.CHART_3D_LINE]: props => <Line3DChartSetting {...props} />,
  [WIDGET_TYPE.CHART_3D_SCATTER]: props => <Scatter3DChartSetting {...props} />,
  [WIDGET_TYPE.CHART_3D_BUBBLE]: props => <Bubble3DChartSetting {...props} />,

  [WIDGET_TYPE.CHART_WATERFALL_BAR]: props => <WaterfallChartSetting {...props} />,
  [WIDGET_TYPE.CHART_WATERFALL_COLUMN]: props => <WaterfallChartSetting {...props} axis="y" />,

  [WIDGET_TYPE.CHART_POLAR_BAR]: props => <PolarBarChartSetting {...props} />,
  [WIDGET_TYPE.CHART_POLAR_STACKED_BAR]: props => <PolarBarChartSetting {...props} />,

  [WIDGET_TYPE.MIXED_CHART_LINE_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_AREA_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_BAR_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_COLUMN_PIE]: props => <MixedLinePieChartSetting {...props} axis="y" />,
  [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE]: props => (
    <MixedLinePieChartSetting {...props} axis="y" />
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE]: props => <MixedLinePieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_DONUT_PIE]: props => <MixedDonutPieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE]: props => <MixedDonutPieChartSetting {...props} />,
  [WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR]: props => (
    <MixedLineStackedBarChartSetting {...props} />
  ),

  [WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} axis="y" />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <LineChartSetting {...props} axis="y" />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <DonutChartSetting {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoardSetting {...props} />
      <Divider />
      <DonutChartSetting {...props} />
    </React.Fragment>
  ),
};

/**
 * 위젯 타입에 맞는 설정 노드를 반환한다. 매핑이 없으면 안내 문자열.
 */
export function renderWidgetSetting(widgetType: string, props: WidgetSettingProps): React.ReactNode {
  const renderer = WIDGET_SETTINGS[widgetType];
  return renderer ? renderer(props) : NO_COMPONENT_MESSAGE;
}
