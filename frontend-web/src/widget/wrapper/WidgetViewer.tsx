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

const WidgetViewer = props => {
  const { title, widgetType, widgetOption, dataSet } = props;

  const [module, setModule] = useState(null);
  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidget();
  }, [widgetType, widgetOption, dataSet]);

  const renderWidget = () => {
    console.log('===== renderWidget');
    let module = null;
    const chartProps = { option: widgetOption, dataSet: dataSet };

    switch (widgetType) {
      case WIDGET_TYPE.BOARD_NUMERIC:
        module = <NumericBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE:
        module = <TableBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE:
        module = <LineChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE:
        module = <LineChart {...chartProps} seriesOp={{ stack: 'total', label: { show: true, position: 'top' } }} />;
        break;
      case WIDGET_TYPE.CHART_AREA:
        module = <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA:
        module = (
          <LineChart
            {...chartProps}
            seriesOp={{
              areaStyle: {},
              stack: 'total',
              label: { show: true, position: 'top' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_BAR:
        module = (
          <LineChart
            {...chartProps}
            seriesOp={{ type: 'bar' }}
            defaultOp={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              yAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_STACKED_BAR:
        module = <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN:
        module = (
          <LineChart
            {...chartProps}
            axis="y"
            seriesOp={{ type: 'bar' }}
            defaultOp={{
              grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_STACKED_COLUMN:
        module = (
          <LineChart
            {...chartProps}
            axis="y"
            seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }}
            defaultOp={{
              grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_MIXED_LINE_BAR:
        module = (
          <LineChart
            {...chartProps}
            defaultOp={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              yAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
            seriesOp={{ smooth: false }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_PIE:
        module = <PieChart {...chartProps} />;
        break;

      case WIDGET_TYPE.CHART_DONUT:
        module = <DonutChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_NIGHTINGALE:
        module = (
          <DonutChart
            {...chartProps}
            seriesOp={{
              roseType: 'area',
              itemStyle: { borderRadius: 8 },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_SCATTER:
        module = <ScatterChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_BUBBLE:
        module = <BubbleChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_RADAR:
        module = <RadarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_TREEMAP:
        module = <TreemapChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_HEATMAP:
        module = <HeatmapChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_SUNBURST:
        module = <TreemapChart {...chartProps} seriesOp={{ type: 'sunburst', label: { rotate: 'radial' } }} />;
        break;
      case WIDGET_TYPE.CHART_GAUGE:
        module = <GaugeChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK:
        module = <CandlestickChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL:
        module = (
          <PieChart
            {...chartProps}
            seriesOp={{
              type: 'funnel',
              width: '70%',
              gap: 4,
              label: {
                show: true,
                position: 'inside',
              },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_3D_BAR:
        module = <Bar3DChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_LINE:
        module = <Line3DChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_SCATTER:
        module = <Scatter3DChart {...chartProps} />;
        break;
      default:
    }

    console.log('module', module);
    setModule(module);
  };

  return (
    <Stack
      sx={{
        width: '100%',
        height: '100%',
        border: '1px solid #DADDDD',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ marginBottom: 4 }} />
      {module}
    </Stack>
  );
};

export default WidgetViewer;
