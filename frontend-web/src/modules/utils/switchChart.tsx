import React, { FC } from 'react';
import { WIDGET_TYPE } from '@/constant';
import LineChart from '@/modules/linechart/LineChart';
import PieChart from '@/modules/piechart/PieChart';
import ScatterChart from '@/modules/scatterchart/ScatterChart';
import NumericBoard from '@/modules/board/NumericBoard';
import TableBoard from '@/modules/board/TableBoard';
import BubbleChart from '@/modules/scatterchart/BubbleChart';
import RadarChart from '@/modules/radarchart/RadarChart';
import HeatmapChart from '@/modules/heatmapchart/HeatmapChart';
import TreemapChart from '@/modules/treemapchart/TreemapChart';
import GaugeChart from '@/modules/gaugechart/GaugeChart';
import CandlestickChart from '@/modules/candlestickchart/CandlestickChart';

// 리팩터링 중...
// option을 동적으로 받아올 수 없는 문제 해결 필요
interface ChartProps {
  widgetType?: string;
  option?: any;
  dataSet?: any[];
  setDataLength?: any;
}

export const ChartComponent: FC<ChartProps> = ({ widgetType, option, dataSet, setDataLength }) => {
  const rest = { option, dataSet, setDataLength };

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
  } = {
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
        radius: !option ? '' : option.series.radius,
      },
    },
    nightingale: {
      seriesOp: {
        radius: !option ? '' : option.series.radius,
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
          show: !option ? '' : option.series.name && true,
          position: 'inside',
        },
      },
    },
    sunburst: {
      seriesOp: { type: 'sunburst', label: { rotate: 'radial' } },
    },
  };

  const ChartLookUpTable = {
    [WIDGET_TYPE.BOARD_NUMERIC]: NumericBoard,
    [WIDGET_TYPE.BOARD_TABLE]: TableBoard,
    [WIDGET_TYPE.CHART_LINE]: LineChart,
    [WIDGET_TYPE.CHART_AREA]: () => LineChart({ area, ...rest }),
    [WIDGET_TYPE.CHART_BAR]: () => LineChart({ bar, ...rest }),
    [WIDGET_TYPE.CHART_COLUMN]: () => LineChart({ column, ...rest }),
    [WIDGET_TYPE.CHART_STACKED_LINE]: () => LineChart({ stackedLine, ...rest }),
    [WIDGET_TYPE.CHART_STACKED_AREA]: () => LineChart({ stackedArea, ...rest }),
    [WIDGET_TYPE.CHART_STACKED_BAR]: () => LineChart({ stackedBar, ...rest }),
    [WIDGET_TYPE.CHART_STACKED_COLUMN]: () => LineChart({ stackedColumn, ...rest }),
    [WIDGET_TYPE.CHART_MIXED_LINE_BAR]: () => LineChart({ mixedLineBar, ...rest }),
    [WIDGET_TYPE.CHART_PIE]: PieChart,
    [WIDGET_TYPE.CHART_DONUT]: () => PieChart({ donut, ...rest }),
    [WIDGET_TYPE.CHART_NIGHTINGALE]: () => PieChart({ nightingale, ...rest }),
    [WIDGET_TYPE.CHART_FUNNEL]: () => PieChart({ funnel, ...rest }),
    [WIDGET_TYPE.CHART_SCATTER]: ScatterChart,
    [WIDGET_TYPE.CHART_BUBBLE]: BubbleChart,
    [WIDGET_TYPE.CHART_RADAR]: RadarChart,
    [WIDGET_TYPE.CHART_TREEMAP]: TreemapChart,
    [WIDGET_TYPE.CHART_SUNBURST]: () => TreemapChart({ sunburst, ...rest }),
    [WIDGET_TYPE.CHART_HEATMAP]: HeatmapChart,
    [WIDGET_TYPE.CHART_GAUGE]: GaugeChart,
    [WIDGET_TYPE.CHART_CANDLESTICK]: CandlestickChart,
  };

  console.log(option);
  // console.log(widgetType, ChartLookUpTable[WIDGET_TYPE[widgetType]]);
  // console.log(option, dataSet, setDataLength);
  return React.createElement(ChartLookUpTable[widgetType], { ...rest });
};
