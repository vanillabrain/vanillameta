import React, { useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
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

const WidgetViewer = props => {
  const { title, widgetType, widgetOption, dataSet } = props;

  const [module, setModule] = useState(null);
  // const [componentOption, setComponentOption] = useState({});
  // let testModule = null;
  // const chartProps = { option: widgetOption, dataSet: dataSet, seriesOp: undefined, createOp: undefined };

  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidget();
  }, [widgetType, widgetOption, dataSet]);

  const renderWidget = () => {
    console.log('===== renderWidget');
    let module = null;
    const chartProps = { option: widgetOption, dataSet: dataSet };

    switch (widgetType) {
      case WIDGET_TYPE.BOARD_NUMERIC.type:
        module = <NumericBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE.type:
        module = <TableBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE.type:
        module = <LineChart {...chartProps} />;
        // testModule = testLineChart;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE.type:
        module = <LineChart {...chartProps} seriesOp={{ stack: 'total' }} />;
        break;
      case WIDGET_TYPE.CHART_AREA.type:
        module = <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA.type:
        module = (
          <LineChart
            {...chartProps}
            seriesOp={{
              areaStyle: {},
              stack: 'total',
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_BAR.type:
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
      case WIDGET_TYPE.CHART_STACKED_BAR.type:
        module = <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN.type:
        module = (
          <LineChart
            {...chartProps}
            axis="y"
            seriesOp={{ type: 'bar' }}
            defaultOp={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_STACKED_COLUMN.type:
        module = <LineChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BAR.type:
        module = (
          <LineChart
            {...chartProps}
            defaultOp={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              yAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_PIE.type:
        module = <PieChart {...chartProps} />;
        break;

      case WIDGET_TYPE.CHART_DONUT.type:
        module = <DonutChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_NIGHTINGALE.type:
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
      case WIDGET_TYPE.CHART_SCATTER.type:
        module = <ScatterChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_BUBBLE.type:
        module = <BubbleChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_RADAR.type:
        module = <RadarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_TREEMAP.type:
        module = <TreemapChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_HEATMAP.type:
        module = <HeatmapChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_SUNBURST.type:
        module = (
          <TreemapChart
            {...chartProps}
            seriesOp={{
              type: 'sunburst',
              // label: { rotate: 'radial' }
            }}
          />
        );
        break;
      case WIDGET_TYPE.CHART_GAUGE.type:
        module = <GaugeChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK.type:
        module = <CandlestickChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL.type:
        module = <FunnelChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BAR.type:
        module = <Bar3DChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_LINE.type:
        module = <Line3DChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_SCATTER.type:
        module = <Scatter3DChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_3D_BUBBLE.type:
        module = <Bubble3dChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_BAR.type:
        module = <WaterfallBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_COLUMN.type:
        module = <WaterfallBarChart {...chartProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_POLAR_BAR.type:
        module = <PolarBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_POLAR_STACKED_BAR.type:
        module = <PolarBarChart {...chartProps} seriesOp={{ stack: 'stack' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_PIE.type:
        module = <MixedLinePieChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_PIE.type:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_PIE.type:
        module = (
          <MixedLinePieChart
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
      case WIDGET_TYPE.MIXED_CHART_COLUMN_PIE.type:
        module = (
          <MixedLinePieChart
            {...chartProps}
            axis="y"
            seriesOp={{ type: 'bar' }}
            defaultOp={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { boundaryGap: [0, 0.01] },
              emphasis: { focus: 'none' },
            }}
          />
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE.type:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE.type:
        module = <MixedLinePieChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE.type:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE.type:
        module = (
          <MixedLinePieChart
            {...chartProps}
            seriesOp={{
              areaStyle: {},
              stack: 'total',
            }}
          />
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_PIE.type:
        module = <MixedDonutPieChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE.type:
        module = (
          <MixedDonutPieChart
            {...chartProps}
            seriesOp={{
              roseType: 'area',
              itemStyle: { borderRadius: 8 },
            }}
          />
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR.type:
        module = <MixedLineStackedBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard
              {...chartProps}
              // option={widgetOption.numericOption}
            />
            <LineChart
              {...chartProps}
              // option={widgetOption.chartOption}
            />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart
              {...chartProps}
              seriesOp={{ type: 'bar' }}
              defaultOp={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                yAxis: { boundaryGap: [0, 0.01] },
                emphasis: { focus: 'none' },
              }}
            />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart
              {...chartProps}
              axis="y"
              seriesOp={{ type: 'bar' }}
              defaultOp={{
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                xAxis: { boundaryGap: [0, 0.01] },
                emphasis: { focus: 'none' },
              }}
            />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ stack: 'total' }} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart
              {...chartProps}
              seriesOp={{
                areaStyle: {},
                stack: 'total',
              }}
            />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard
              {...chartProps}
              sx={{
                position: 'absolute',
                zIndex: 1000,
                top: '50%',
                left: 0,
                right: 0,
                margin: 'auto',
                transform: 'translateY(-50%)',
              }}
            />
            <DonutChart {...chartProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC.type:
        module = (
          <React.Fragment>
            <NumericBoard
              {...chartProps}
              sx={{
                position: 'absolute',
                zIndex: 1000,
                top: '50%',
                left: 0,
                right: 0,
                margin: 'auto',
                transform: 'translateY(-50%)',
              }}
            />
            <DonutChart
              {...chartProps}
              seriesOp={{
                roseType: 'area',
                itemStyle: { borderRadius: 8 },
              }}
            />
          </React.Fragment>
        );
        break;

      default:
        module = '컴포넌트가 선택되지 않았다!';
        break;
    }

    console.log('module', module);
    setModule(module);
  };

  // const defaultComponentOption = {
  //   grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
  //   tooltip: { trigger: 'axis' },
  //   xAxis: {
  //     type: 'category',
  //   },
  //   yAxis: {
  //     type: 'value',
  //   },
  //   series: [],
  //   emphasis: {
  //     focus: 'series',
  //     blurScope: 'coordinateSystem',
  //   },
  // };
  //
  // useEffect(() => {
  //   if (testModule) {
  //     const newOption = testModule({ ...chartProps });
  //     setComponentOption({ ...defaultComponentOption, ...newOption });
  //   }
  // }, [widgetOption, dataSet]);

  return (
    <Stack
      sx={{
        width: '100%',
        height: '500px',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          width: '100%',
          height: '50px',
          paddingLeft: '20px',
          paddingTop: '18px',
          paddingBottom: '12px',
        }}
      >
        <Typography
          variant="subtitle1"
          component="span"
          sx={{
            fontSize: '16px',
            fontWeight: '600',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: '1.25',
            letterSpacing: '-0.16px',
            textAlign: 'left',
            color: '#333',
          }}
        >
          {title}
        </Typography>
      </Stack>

      <Stack
        sx={{
          width: '100%',
          height: '100%',
          maxHeight: '500px',
          position: 'relative',
          padding: '32px 40px 48px 40px',
        }}
      >
        {module}
        {/*<ReactECharts*/}
        {/*  option={componentOption}*/}
        {/*  style={{ height: '100%', maxHeight: '600px', width: '100%' }}*/}
        {/*  lazyUpdate={true}*/}
        {/*  notMerge={true}*/}
        {/*/>*/}
      </Stack>
    </Stack>
  );
};

export default WidgetViewer;
