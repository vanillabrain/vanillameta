import React, { Suspense, lazy, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
const Bar3DChart = lazy(() => import('@/widget/modules/3dchart/Bar3dChart'));
const Line3DChart = lazy(() => import('@/widget/modules/3dchart/Line3dChart'));
const Scatter3DChart = lazy(() => import('@/widget/modules/3dchart/Scatter3dChart'));
const Bubble3dChart = lazy(() => import('@/widget/modules/3dchart/Bubble3dChart'));
import WaterfallBarChart from '@/widget/modules/barchart/WaterfallBarChart';
import PolarBarChart from '@/widget/modules/barchart/PolarBarChart';
import MixedLinePieChart from '@/widget/modules/mixedchart/MixedLinePieChart';
import MixedDonutPieChart from '@/widget/modules/mixedchart/MixedDonutPieChart';
import MixedLineStackedBarChart from '@/widget/modules/mixedchart/MixedLineStackedBarChart';
import FunnelChart from '@/widget/modules/funnelchart/FunnelChart';
import { LoadingContext } from '@/contexts/LoadingContext';

export const WidgetEmpty = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full w-full items-center rounded-md">
      <p className="mx-auto my-[200px] text-center text-sm leading-[1.6] font-semibold text-foreground">
        {t('share.widgetFetchFailed')} <br />
      </p>
    </div>
  );
};

const WidgetViewer = props => {
  const { t } = useTranslation();
  const {
    title,
    widgetType,
    widgetOption,
    dataSet,
    isInvalidData,
    description,
    onCategorySelect,
    selectedCategoryValues,
    categorySelectionDisabled,
    onTimeSelect,
    timeSelection,
    timeSelectionDisabled,
    selectedTimeRange,
    onContributionSelect,
    contributionDisabled,
  } = props;
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const [module, setModule] = useState(null);

  // const [componentOption, setComponentOption] = useState({});
  // let testModule = null;
  // const chartProps = { option: widgetOption, dataSet: dataSet, seriesOp: undefined, createOp: undefined };

  useEffect(() => {
    if (widgetType && widgetOption && dataSet) renderWidget();
  }, [
    widgetType,
    widgetOption,
    dataSet,
    onCategorySelect,
    selectedCategoryValues,
    categorySelectionDisabled,
    onTimeSelect,
    timeSelection,
    timeSelectionDisabled,
    selectedTimeRange,
    onContributionSelect,
    contributionDisabled,
  ]);

  const renderWidget = () => {
    console.log('===== renderWidget');
    let module;
    const chartProps = {
      option: widgetOption,
      dataSet: dataSet,
      onCategorySelect,
      selectedCategoryValues,
      categorySelectionDisabled,
      onTimeSelect,
      timeSelection,
      timeSelectionDisabled,
      selectedTimeRange,
      onContributionSelect,
      contributionDisabled,
    };
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
            <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total' }} />
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
              className="pointer-events-none absolute inset-x-0 top-1/2 z-10 m-auto h-full max-w-fit -translate-y-1/2"
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
              className="pointer-events-none absolute inset-x-0 top-1/2 z-10 m-auto h-full max-w-fit -translate-y-1/2"
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
        module = t('common.componentNotSelected');
        break;
    }

    // console.log('module', module);
    setModule(module);
    hideLoading();
  };

  const renderTitle = () => {
    if (widgetOption?.header?.titleHidden) {
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
    <div className="relative flex h-full w-full flex-col">
      <div className="flex min-h-12 w-full shrink-0 flex-row items-center px-4 pt-4 pb-2 sm:px-5">
        <span
          title={typeof title === 'string' ? title : undefined}
          className="line-clamp-2 min-w-0 w-full text-left text-base leading-6 font-semibold text-foreground [overflow-wrap:anywhere]"
        >
          {renderTitle()}
        </span>
      </div>

      {description && (
        <p className="px-4 text-xs leading-5 text-muted-foreground sm:px-5 [overflow-wrap:anywhere]">{description}</p>
      )}
      <div className="w-full min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-3 sm:px-5 sm:pb-5">
        <div className="relative isolate h-full w-full min-w-0">
          {isInvalidData ? <WidgetEmpty /> : <Suspense fallback={null}>{module}</Suspense>}
          {/*<ReactECharts*/}
          {/*  option={componentOption}*/}
          {/*  style={{ height: '100%', maxHeight: '600px', width: '100%' }}*/}
          {/*  lazyUpdate={true}*/}
          {/*  notMerge={true}*/}
          {/*/>*/}
        </div>
      </div>
    </div>
  );
};

export default WidgetViewer;
