import React, { FC, lazy, Suspense, useMemo } from 'react';
import { WIDGET_TYPE } from '@/constant';
import { CircularProgress, Box } from '@mui/material';
import ChartErrorBoundary from '@/components/ErrorBoundary/ChartErrorBoundary';

// Lazy load all chart components with webpack magic comments
const LineChart = lazy(() => import(/* webpackChunkName: "chart-line" */ '@/widget/modules/linechart/LineChart'));
const PieChart = lazy(() => import(/* webpackChunkName: "chart-pie" */ '@/widget/modules/piechart/PieChart'));
const ScatterChart = lazy(
  () => import(/* webpackChunkName: "chart-scatter" */ '@/widget/modules/scatterchart/ScatterChart'),
);
const NumericBoard = lazy(() => import(/* webpackChunkName: "board-numeric" */ '@/widget/modules/board/NumericBoard'));
const TableBoard = lazy(() => import(/* webpackChunkName: "board-table" */ '@/widget/modules/board/TableBoard'));
const BubbleChart = lazy(() => import(/* webpackChunkName: "chart-bubble" */ '@/widget/modules/scatterchart/BubbleChart'));
const RadarChart = lazy(() => import(/* webpackChunkName: "chart-radar" */ '@/widget/modules/radarchart/RadarChart'));
const HeatmapChart = lazy(
  () => import(/* webpackChunkName: "chart-heatmap" */ '@/widget/modules/heatmapchart/HeatmapChart'),
);
const TreemapChart = lazy(
  () => import(/* webpackChunkName: "chart-treemap" */ '@/widget/modules/treemapchart/TreemapChart'),
);
const GaugeChart = lazy(() => import(/* webpackChunkName: "chart-gauge" */ '@/widget/modules/gaugechart/GaugeChart'));
const CandlestickChart = lazy(
  () => import(/* webpackChunkName: "chart-candlestick" */ '@/widget/modules/candlestickchart/CandlestickChart'),
);

// 3D Charts
const Bar3dChart = lazy(() => import(/* webpackChunkName: "chart-3d-bar" */ '@/widget/modules/3dchart/Bar3dChart'));
const Line3dChart = lazy(() => import(/* webpackChunkName: "chart-3d-line" */ '@/widget/modules/3dchart/Line3dChart'));
const Scatter3dChart = lazy(
  () => import(/* webpackChunkName: "chart-3d-scatter" */ '@/widget/modules/3dchart/Scatter3dChart'),
);
const Bubble3dChart = lazy(() => import(/* webpackChunkName: "chart-3d-bubble" */ '@/widget/modules/3dchart/Bubble3dChart'));

// Special bar charts
const WaterfallBarChart = lazy(
  () => import(/* webpackChunkName: "chart-waterfall" */ '@/widget/modules/barchart/WaterfallBarChart'),
);
const PolarBarChart = lazy(() => import(/* webpackChunkName: "chart-polar" */ '@/widget/modules/barchart/PolarBarChart'));

// Mixed charts
const MixedLinePieChart = lazy(
  () => import(/* webpackChunkName: "chart-mixed-line-pie" */ '@/widget/modules/mixedchart/MixedLinePieChart'),
);
const MixedLineStackedBarChart = lazy(
  () => import(/* webpackChunkName: "chart-mixed-line-bar" */ '@/widget/modules/mixedchart/MixedLineStackedBarChart'),
);
const MixedDonutPieChart = lazy(
  () => import(/* webpackChunkName: "chart-mixed-donut-pie" */ '@/widget/modules/mixedchart/MixedDonutPieChart'),
);

// 리팩터링 중...
// option을 동적으로 받아올 수 없는 문제 해결 필요
interface ChartProps {
  widgetType?: string;
  option?: any;
  dataSet?: any[];
}

// Loading component for charts
const ChartLoading = () => (
  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
    <CircularProgress size={40} />
  </Box>
);

export const ChartComponent: FC<ChartProps> = ({ widgetType, option, dataSet }) => {
  const rest = { option, dataSet };

  const chartConfigs = useMemo(
    () => ({
      area: {
        seriesOp: { areaStyle: {} },
      },
      bar: {
        seriesOp: { type: 'bar' },
        defaultOp: {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          yAxis: { boundaryGap: [0, 0.01] },
          emphasis: { focus: 'none' },
        },
      },
      column: {
        axis: 'y',
        seriesOp: { type: 'bar' },
        defaultOp: {
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis: { boundaryGap: [0, 0.01] },
          emphasis: { focus: 'none' },
        },
      },
      stackedLine: {
        seriesOp: {
          stack: 'total',
          label: { show: true, position: 'top' },
        },
      },
      stackedArea: {
        seriesOp: {
          areaStyle: {},
          stack: 'total',
          label: { show: true, position: 'top' },
        },
      },
      stackedBar: {
        seriesOp: {
          type: 'bar',
          stack: 'total',
          label: { show: true },
        },
      },
      stackedColumn: {
        axis: 'y',
        seriesOp: { type: 'bar', stack: 'total', label: { show: true } },
        defaultOp: {
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        },
      },
      mixedLineBar: {
        defaultOp: {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          yAxis: { boundaryGap: [0, 0.01] },
          emphasis: { focus: 'none' },
        },
        seriesOp: { smooth: false },
      },
      donut: {
        seriesOp: {
          radius: !option ? '' : option.series?.radius,
        },
      },
      nightingale: {
        seriesOp: {
          radius: !option ? '' : option.series?.radius,
          roseType: 'area',
          itemStyle: { borderRadius: 8 },
        },
      },
      funnel: {
        seriesOp: {
          type: 'funnel',
          width: '70%',
          gap: 4,
          label: {
            show: !option ? '' : option.series?.name && true,
            position: 'inside',
          },
        },
      },
      sunburst: {
        seriesOp: { type: 'sunburst', label: { rotate: 'radial' } },
      },
    }),
    [option],
  );

  // Chart component factory with lazy loading
  const getChartComponent = useMemo(() => {
    const {
      area,
      bar,
      column,
      stackedArea,
      stackedBar,
      stackedLine,
      stackedColumn,
      mixedLineBar,
      donut,
      nightingale,
      funnel,
      sunburst,
    } = chartConfigs;

    const ChartLookUpTable = {
      // Board types
      [WIDGET_TYPE.BOARD_NUMERIC]: () => <NumericBoard {...rest} />,
      [WIDGET_TYPE.BOARD_TABLE]: () => <TableBoard {...rest} />,

      // Line based charts
      [WIDGET_TYPE.CHART_LINE]: () => <LineChart {...rest} />,
      [WIDGET_TYPE.CHART_AREA]: () => <LineChart area={area} {...rest} />,
      [WIDGET_TYPE.CHART_BAR]: () => <LineChart bar={bar} {...rest} />,
      [WIDGET_TYPE.CHART_COLUMN]: () => <LineChart column={column} {...rest} />,
      [WIDGET_TYPE.CHART_STACKED_LINE]: () => <LineChart stackedLine={stackedLine} {...rest} />,
      [WIDGET_TYPE.CHART_STACKED_AREA]: () => <LineChart stackedArea={stackedArea} {...rest} />,
      [WIDGET_TYPE.CHART_STACKED_BAR]: () => <LineChart stackedBar={stackedBar} {...rest} />,
      [WIDGET_TYPE.CHART_STACKED_COLUMN]: () => <LineChart stackedColumn={stackedColumn} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_LINE_BAR]: () => <LineChart mixedLineBar={mixedLineBar} {...rest} />,

      // Pie based charts
      [WIDGET_TYPE.CHART_PIE]: () => <PieChart {...rest} />,
      [WIDGET_TYPE.CHART_DONUT]: () => <PieChart seriesOp={donut.seriesOp} {...rest} />,
      [WIDGET_TYPE.CHART_NIGHTINGALE]: () => <PieChart seriesOp={nightingale.seriesOp} {...rest} />,
      [WIDGET_TYPE.CHART_FUNNEL]: () => <PieChart seriesOp={funnel.seriesOp} {...rest} />,

      // Other chart types
      [WIDGET_TYPE.CHART_SCATTER]: () => <ScatterChart {...rest} />,
      [WIDGET_TYPE.CHART_BUBBLE]: () => <BubbleChart {...rest} />,
      [WIDGET_TYPE.CHART_RADAR]: () => <RadarChart {...rest} />,
      [WIDGET_TYPE.CHART_TREEMAP]: () => <TreemapChart {...rest} />,
      [WIDGET_TYPE.CHART_SUNBURST]: () => <TreemapChart sunburst={sunburst} {...rest} />,
      [WIDGET_TYPE.CHART_HEATMAP]: () => <HeatmapChart {...rest} />,
      [WIDGET_TYPE.CHART_GAUGE]: () => <GaugeChart {...rest} />,
      [WIDGET_TYPE.CHART_CANDLESTICK]: () => <CandlestickChart {...rest} />,

      // 3D charts
      [WIDGET_TYPE.CHART_3D_BAR]: () => <Bar3dChart {...rest} />,
      [WIDGET_TYPE.CHART_3D_LINE]: () => <Line3dChart {...rest} />,
      [WIDGET_TYPE.CHART_3D_SCATTER]: () => <Scatter3dChart {...rest} />,
      [WIDGET_TYPE.CHART_3D_BUBBLE]: () => <Bubble3dChart {...rest} />,

      // Special bar charts
      [WIDGET_TYPE.CHART_WATERFALL_BAR]: () => <WaterfallBarChart {...rest} />,
      [WIDGET_TYPE.CHART_WATERFALL_COLUMN]: () => <WaterfallBarChart column={column} {...rest} />,
      [WIDGET_TYPE.CHART_POLAR_BAR]: () => <PolarBarChart {...rest} />,
      [WIDGET_TYPE.CHART_POLAR_STACKED_BAR]: () => <PolarBarChart stackedBar={stackedBar} {...rest} />,

      // Mixed charts
      [WIDGET_TYPE.MIXED_CHART_LINE_PIE]: () => <MixedLinePieChart {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_AREA_PIE]: () => <MixedLinePieChart area={area} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_BAR_PIE]: () => <MixedLinePieChart bar={bar} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_COLUMN_PIE]: () => <MixedLinePieChart column={column} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE]: () => <MixedLinePieChart stackedBar={stackedBar} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE]: () => <MixedLinePieChart stackedColumn={stackedColumn} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE]: () => <MixedLinePieChart stackedLine={stackedLine} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE]: () => <MixedLinePieChart stackedArea={stackedArea} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_DONUT_PIE]: () => <MixedDonutPieChart donut={donut} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE]: () => <MixedDonutPieChart nightingale={nightingale} {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR]: () => <MixedLineStackedBarChart {...rest} />,

      // Mixed chart with numeric board
      [WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC]: () => <MixedLinePieChart boardNumeric {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC]: () => <MixedLinePieChart area={area} boardNumeric {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC]: () => <MixedLinePieChart bar={bar} boardNumeric {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC]: () => <MixedLinePieChart column={column} boardNumeric {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC]: () => (
        <MixedLinePieChart stackedLine={stackedLine} boardNumeric {...rest} />
      ),
      [WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC]: () => (
        <MixedLinePieChart stackedArea={stackedArea} boardNumeric {...rest} />
      ),
      [WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC]: () => (
        <MixedLinePieChart stackedBar={stackedBar} boardNumeric {...rest} />
      ),
      [WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC]: () => (
        <MixedLinePieChart stackedColumn={stackedColumn} boardNumeric {...rest} />
      ),
      [WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC]: () => <MixedDonutPieChart donut={donut} boardNumeric {...rest} />,
      [WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC]: () => (
        <MixedDonutPieChart nightingale={nightingale} boardNumeric {...rest} />
      ),
    };

    return ChartLookUpTable[widgetType];
  }, [widgetType, chartConfigs, rest]);

  console.log(option);

  if (!widgetType || !getChartComponent) {
    return null;
  }

  const ChartElement = getChartComponent();

  return (
    <ChartErrorBoundary>
      <Suspense fallback={<ChartLoading />}>{ChartElement}</Suspense>
    </ChartErrorBoundary>
  );
};
