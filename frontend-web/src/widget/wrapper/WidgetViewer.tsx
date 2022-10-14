import React, { useEffect, useState } from 'react';
import { Divider, Stack, Typography } from '@mui/material';
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
      case WIDGET_TYPE.CHART_3D_BUBBLE:
        module = <Bubble3dChart {...chartProps} />;
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
