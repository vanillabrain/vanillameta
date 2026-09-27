import React from 'react';
import { WIDGET_TYPE } from '@/constant';
import LineChart from '@/widget/modules/linechart/LineChart';
import PieChart from '@/widget/modules/piechart/PieChart';
import NumericBoard from '@/widget/modules/board/NumericBoard';
import TableBoard from '@/widget/modules/board/TableBoard';
import DonutChart from '@/widget/modules/piechart/DonutChart';
import ScatterChart from '@/widget/modules/scatterchart/ScatterChart';
import BubbleChart from '@/widget/modules/scatterchart/BubbleChart';
import RadarChart from '@/widget/modules/radarchart/RadarChart';
import TreemapChart from '@/widget/modules/treemapchart/TreemapChart';
import HeatmapChart from '@/widget/modules/heatmapchart/HeatmapChart';
import GaugeChart from '@/widget/modules/gaugechart/GaugeChart';
import CandlestickChart from '@/widget/modules/candlestickchart/CandlestickChart';
import Bar3DChart from '@/widget/modules/3dchart/Bar3dChart';
import Line3DChart from '@/widget/modules/3dchart/Line3dChart';
import Scatter3DChart from '@/widget/modules/3dchart/Scatter3dChart';
import Bubble3dChart from '@/widget/modules/3dchart/Bubble3dChart';
import WaterfallBarChart from '@/widget/modules/barchart/WaterfallBarChart';
import PolarBarChart from '@/widget/modules/barchart/PolarBarChart';
import MixedLinePieChart from '@/widget/modules/mixedchart/MixedLinePieChart';
import MixedDonutPieChart from '@/widget/modules/mixedchart/MixedDonutPieChart';
import MixedLineStackedBarChart from '@/widget/modules/mixedchart/MixedLineStackedBarChart';
import FunnelChart from '@/widget/modules/funnelchart/FunnelChart';

export const NO_COMPONENT_MESSAGE = '컴포넌트가 선택되지 않았다!';

export interface WidgetRenderProps {
  option: any;
  dataSet: any;
  [key: string]: any;
}

export type WidgetViewerRenderer = (props: WidgetRenderProps) => React.ReactNode;

const barDefaultOp = (axis: 'x' | 'y') => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  [axis === 'y' ? 'xAxis' : 'yAxis']: { boundaryGap: [0, 0.01] },
  emphasis: { focus: 'none' },
});

const numericBoardOverlaySx = {
  position: 'absolute',
  zIndex: 1000,
  top: '50%',
  left: 0,
  right: 0,
  maxWidth: 'fit-content',
  height: '100%',
  margin: 'auto',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
};

const nightingaleSeriesOp = { roseType: 'area', itemStyle: { borderRadius: 8 } };

/**
 * 위젯 타입 → 뷰어 컴포넌트 매핑. (기존 WidgetViewer 의 switch 를 대체)
 */
export const WIDGET_VIEWERS: Record<string, WidgetViewerRenderer> = {
  [WIDGET_TYPE.BOARD_NUMERIC]: props => <NumericBoard {...props} />,
  [WIDGET_TYPE.BOARD_TABLE]: props => <TableBoard {...props} />,

  [WIDGET_TYPE.CHART_LINE]: props => <LineChart {...props} />,
  [WIDGET_TYPE.CHART_STACKED_LINE]: props => <LineChart {...props} seriesOp={{ stack: 'total' }} />,
  [WIDGET_TYPE.CHART_AREA]: props => <LineChart {...props} seriesOp={{ areaStyle: {} }} />,
  [WIDGET_TYPE.CHART_STACKED_AREA]: props => (
    <LineChart {...props} seriesOp={{ areaStyle: {}, stack: 'total' }} />
  ),
  [WIDGET_TYPE.CHART_BAR]: props => (
    <LineChart {...props} seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('x')} />
  ),
  [WIDGET_TYPE.CHART_STACKED_BAR]: props => (
    <LineChart {...props} seriesOp={{ type: 'bar', stack: 'total' }} />
  ),
  [WIDGET_TYPE.CHART_COLUMN]: props => (
    <LineChart {...props} axis="y" seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('y')} />
  ),
  [WIDGET_TYPE.CHART_STACKED_COLUMN]: props => (
    <LineChart {...props} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_LINE_BAR]: props => <LineChart {...props} defaultOp={barDefaultOp('x')} />,

  [WIDGET_TYPE.CHART_PIE]: props => <PieChart {...props} />,
  [WIDGET_TYPE.CHART_DONUT]: props => <DonutChart {...props} />,
  [WIDGET_TYPE.CHART_NIGHTINGALE]: props => (
    <DonutChart {...props} seriesOp={nightingaleSeriesOp} />
  ),

  [WIDGET_TYPE.CHART_SCATTER]: props => <ScatterChart {...props} />,
  [WIDGET_TYPE.CHART_BUBBLE]: props => <BubbleChart {...props} />,
  [WIDGET_TYPE.CHART_RADAR]: props => <RadarChart {...props} />,
  [WIDGET_TYPE.CHART_TREEMAP]: props => <TreemapChart {...props} />,
  [WIDGET_TYPE.CHART_HEATMAP]: props => <HeatmapChart {...props} />,
  [WIDGET_TYPE.CHART_SUNBURST]: props => (
    <TreemapChart {...props} seriesOp={{ type: 'sunburst' }} />
  ),
  [WIDGET_TYPE.CHART_GAUGE]: props => <GaugeChart {...props} />,
  [WIDGET_TYPE.CHART_CANDLESTICK]: props => <CandlestickChart {...props} />,
  [WIDGET_TYPE.CHART_FUNNEL]: props => <FunnelChart {...props} />,

  [WIDGET_TYPE.CHART_3D_BAR]: props => <Bar3DChart {...props} />,
  [WIDGET_TYPE.CHART_3D_LINE]: props => <Line3DChart {...props} />,
  [WIDGET_TYPE.CHART_3D_SCATTER]: props => <Scatter3DChart {...props} />,
  [WIDGET_TYPE.CHART_3D_BUBBLE]: props => <Bubble3dChart {...props} />,

  [WIDGET_TYPE.CHART_WATERFALL_BAR]: props => <WaterfallBarChart {...props} />,
  [WIDGET_TYPE.CHART_WATERFALL_COLUMN]: props => <WaterfallBarChart {...props} axis="y" />,

  [WIDGET_TYPE.CHART_POLAR_BAR]: props => <PolarBarChart {...props} />,
  [WIDGET_TYPE.CHART_POLAR_STACKED_BAR]: props => (
    <PolarBarChart {...props} seriesOp={{ stack: 'stack' }} />
  ),

  [WIDGET_TYPE.MIXED_CHART_LINE_PIE]: props => <MixedLinePieChart {...props} />,
  [WIDGET_TYPE.MIXED_CHART_AREA_PIE]: props => (
    <MixedLinePieChart {...props} seriesOp={{ areaStyle: {} }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_BAR_PIE]: props => (
    <MixedLinePieChart {...props} seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('x')} />
  ),
  [WIDGET_TYPE.MIXED_CHART_COLUMN_PIE]: props => (
    <MixedLinePieChart {...props} axis="y" seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('y')} />
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE]: props => (
    <MixedLinePieChart {...props} seriesOp={{ type: 'bar', stack: 'total' }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE]: props => (
    <MixedLinePieChart {...props} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE]: props => (
    <MixedLinePieChart {...props} seriesOp={{ stack: 'total' }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE]: props => (
    <MixedLinePieChart {...props} seriesOp={{ areaStyle: {}, stack: 'total' }} />
  ),
  [WIDGET_TYPE.MIXED_CHART_DONUT_PIE]: props => <MixedDonutPieChart {...props} />,
  [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE]: props => (
    <MixedDonutPieChart {...props} seriesOp={nightingaleSeriesOp} />
  ),
  [WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR]: props => <MixedLineStackedBarChart {...props} />,

  [WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} seriesOp={{ areaStyle: {} }} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('x')} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} axis="y" seriesOp={{ type: 'bar' }} defaultOp={barDefaultOp('y')} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} seriesOp={{ stack: 'total' }} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} seriesOp={{ areaStyle: {}, stack: 'total' }} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} seriesOp={{ type: 'bar', stack: 'total' }} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} />
      <LineChart {...props} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} sx={numericBoardOverlaySx} />
      <DonutChart {...props} />
    </React.Fragment>
  ),
  [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC]: props => (
    <React.Fragment>
      <NumericBoard {...props} sx={numericBoardOverlaySx} />
      <DonutChart {...props} seriesOp={nightingaleSeriesOp} />
    </React.Fragment>
  ),
};

/**
 * 위젯 타입에 맞는 뷰어 노드를 반환한다. 매핑이 없으면 안내 문자열.
 */
export function renderWidgetViewer(widgetType: string, props: WidgetRenderProps): React.ReactNode {
  const renderer = WIDGET_VIEWERS[widgetType];
  return renderer ? renderer(props) : NO_COMPONENT_MESSAGE;
}
