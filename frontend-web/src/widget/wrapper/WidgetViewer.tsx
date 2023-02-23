import React, { useContext, useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
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
import { LoadingContext } from '@/contexts/LoadingContext';

export const WidgetEmpty = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        borderRadius: '6px',
      }}
    >
      <Typography
        sx={{
          margin: '200px auto',
          fontSize: '14px',
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: '1.6',
          color: '#333',
        }}
      >
        위젯 조회에 실패했습니다.
        <br />
        다시 시도해 주세요.
      </Typography>
    </Box>
  );
};

const WidgetViewer = props => {
  const { title, widgetType, widgetOption, dataSet, isInvalidData } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [module, setModule] = useState(null);

  // const [componentOption, setComponentOption] = useState({});
  // let testModule = null;
  // const chartProps = { option: widgetOption, dataSet: dataSet, seriesOp: undefined, createOp: undefined };

  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidget();
  }, [widgetType, widgetOption, dataSet]);

  const renderWidget = () => {
    console.log('===== renderWidget');
    let module;
    const chartProps = { option: widgetOption, dataSet: dataSet };
    showLoading();
    switch (widgetType) {
      case WIDGET_TYPE.BOARD_NUMERIC:
        module = <NumericBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.BOARD_TABLE:
        module = <TableBoard {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_LINE:
        module = <LineChart {...chartProps} />;
        // testModule = testLineChart;
        break;
      case WIDGET_TYPE.CHART_STACKED_LINE:
        module = <LineChart {...chartProps} seriesOp={{ stack: 'total' }} />;
        break;
      case WIDGET_TYPE.CHART_AREA:
        ``;
        module = <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
        break;
      case WIDGET_TYPE.CHART_STACKED_AREA:
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
        module = <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.CHART_COLUMN:
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
      case WIDGET_TYPE.CHART_STACKED_COLUMN:
        module = <LineChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BAR:
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
      case WIDGET_TYPE.CHART_GAUGE:
        module = <GaugeChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_CANDLESTICK:
        module = <CandlestickChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_FUNNEL:
        module = <FunnelChart {...chartProps} />;
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
      case WIDGET_TYPE.CHART_WATERFALL_BAR:
        module = <WaterfallBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_WATERFALL_COLUMN:
        module = <WaterfallBarChart {...chartProps} axis="y" />;
        break;
      case WIDGET_TYPE.CHART_POLAR_BAR:
        module = <PolarBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.CHART_POLAR_STACKED_BAR:
        module = <PolarBarChart {...chartProps} seriesOp={{ stack: 'stack' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_PIE:
        module = <MixedLinePieChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_AREA_PIE:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ areaStyle: {} }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_PIE:
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
      case WIDGET_TYPE.MIXED_CHART_COLUMN_PIE:
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
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_PIE:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_PIE:
        module = <MixedLinePieChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_PIE:
        module = <MixedLinePieChart {...chartProps} seriesOp={{ stack: 'total' }} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_PIE:
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
      case WIDGET_TYPE.MIXED_CHART_DONUT_PIE:
        module = <MixedDonutPieChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_PIE:
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
      case WIDGET_TYPE.MIXED_CHART_LINE_STACKED_BAR:
        module = <MixedLineStackedBarChart {...chartProps} />;
        break;
      case WIDGET_TYPE.MIXED_CHART_LINE_BOARD_NUMERIC:
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
      case WIDGET_TYPE.MIXED_CHART_AREA_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_BAR_BOARD_NUMERIC:
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
      case WIDGET_TYPE.MIXED_CHART_COLUMN_BOARD_NUMERIC:
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
      case WIDGET_TYPE.MIXED_CHART_STACKED_LINE_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ stack: 'total' }} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_AREA_BOARD_NUMERIC:
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
      case WIDGET_TYPE.MIXED_CHART_STACKED_BAR_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />;
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC:
        module = (
          <React.Fragment>
            <NumericBoard {...chartProps} />
            <LineChart {...chartProps} axis="y" seriesOp={{ type: 'bar', stack: 'total' }} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_DONUT_BOARD_NUMERIC:
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
                maxWidth: 'fit-content',
                height: 0,
                margin: 'auto',
                transform: 'translateY(-50%)',
              }}
            />
            <DonutChart {...chartProps} />
          </React.Fragment>
        );
        break;
      case WIDGET_TYPE.MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC:
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
                maxWidth: 'fit-content',
                height: 0,
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

    // console.log('module', module);
    setModule(module);
    hideLoading();
  };

  const renderTitle = () => {
    if (widgetType === WIDGET_TYPE.BOARD_NUMERIC && widgetOption.header?.titleHidden) {
      return '';
    } else {
      return title;
    }
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
        position: 'relative',
        width: '100%',
        height: '100%',
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
            overflow: 'hidden',
            width: 'calc(100% - 40px)',
            fontSize: '16px',
            fontWeight: '600',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: '1.25',
            letterSpacing: '-0.16px',
            textAlign: 'left',
            color: '#333',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {renderTitle()}
        </Typography>
      </Stack>

      <Stack
        sx={{
          width: '100%',
          height: 'calc(100% - 48px)',
          // position: 'relative',
          padding: '10px 40px 48px 40px',
        }}
      >
        {isInvalidData ? <WidgetEmpty /> : module}
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
