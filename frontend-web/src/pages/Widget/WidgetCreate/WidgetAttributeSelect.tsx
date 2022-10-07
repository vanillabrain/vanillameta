import React, { useEffect, useState } from 'react';
import { Grid, useMediaQuery, useTheme } from '@mui/material';
import axios from 'axios';
import { useAlert } from 'react-alert';
import { WIDGET_TYPE } from '@/constant';
import TitleBox from '@/components/TitleBox';
import WidgetBox from '@/components/widget/WidgetBox';
import LineChart from '@/modules/linechart/LineChart';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChart from '@/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import DonutChart from '@/modules/piechart/DonutChart';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import NumericBoard from '@/modules/board/NumericBoard';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoard from '@/modules/board/TableBoard';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
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
import useScrollTrigger from '@mui/material/useScrollTrigger';
import { ChartComponent } from '@/modules/utils/switchChart';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption } = props;

  const alert = useAlert();
  const theme = useTheme();
  const matchesMd = useMediaQuery(theme.breakpoints.up('md'));
  const matchesLg = useMediaQuery(theme.breakpoints.up('lg'));
  const trigger = useScrollTrigger({ threshold: 300, disableHysteresis: true });

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);
  const [switchChart, setSwitchChart] = useState({ chart: undefined, chartSetting: undefined });
  const [spec, setSpec] = useState(null);
  const [dataLength, setDataLength] = useState(null);

  const widgetTypeText = componentType.title;

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    setOption(JSON.parse(JSON.stringify(componentType.option)));
  }, [componentType]);

  const getData = () => {
    // dataSetId 로 데이터 조회
    axios.get('/data/sample/chartFull.json').then(response => {
      setData(response.data.data);
      setSpec(response.data.spec);
    });
  };

  const chartProps = {
    option,
    dataSet: data,
    setDataLength,
  };

  const chartSettingProps = {
    option,
    setOption,
    spec,
    dataLength,
  };

  useEffect(() => {
    if (option && data) {
      switch (componentType.type) {
        case WIDGET_TYPE.BOARD_NUMERIC:
          setSwitchChart({
            chart: <NumericBoard {...chartProps} />,
            chartSetting: <NumericBoardSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.BOARD_TABLE:
          setSwitchChart({
            chart: <TableBoard {...chartProps} />,
            chartSetting: <TableBoardSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_LINE:
          setSwitchChart({
            chart: <LineChart {...chartProps} />,
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_STACKED_LINE:
          setSwitchChart({
            chart: <LineChart {...chartProps} seriesOp={{ stack: 'total', label: { show: true, position: 'top' } }} />,
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_AREA:
          setSwitchChart({
            chart: <LineChart {...chartProps} seriesOp={{ areaStyle: {} }} />,
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_STACKED_AREA:
          setSwitchChart({
            chart: (
              <LineChart
                {...chartProps}
                seriesOp={{
                  areaStyle: {},
                  stack: 'total',
                  label: { show: true, position: 'top' },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_BAR:
          setSwitchChart({
            chart: (
              <LineChart
                {...chartProps}
                seriesOp={{ type: 'bar' }}
                defaultOp={{
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  yAxis: { boundaryGap: [0, 0.01] },
                  emphasis: { focus: 'none' },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_STACKED_BAR:
          setSwitchChart({
            chart: <LineChart {...chartProps} seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }} />,
            chartSetting: <LineChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_COLUMN:
          setSwitchChart({
            chart: (
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
            ),
            chartSetting: <LineChartSetting {...chartSettingProps} axis="y" />,
          });
          break;

        case WIDGET_TYPE.CHART_STACKED_COLUMN:
          setSwitchChart({
            chart: (
              <LineChart
                {...chartProps}
                axis="y"
                seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }}
                defaultOp={{
                  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...chartSettingProps} axis="y" />,
          });
          break;

        case WIDGET_TYPE.CHART_MIXED_LINE_BAR:
          setSwitchChart({
            chart: (
              <LineChart
                {...chartProps}
                defaultOp={{
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  yAxis: { boundaryGap: [0, 0.01] },
                  emphasis: { focus: 'none' },
                }}
                seriesOp={{ smooth: false }}
              />
            ),
            chartSetting: <MixedLineBarChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_PIE:
          setSwitchChart({
            chart: <PieChart {...chartProps} />,
            chartSetting: <PieChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_DONUT:
          setSwitchChart({
            chart: <DonutChart {...chartProps} />,
            chartSetting: <DonutChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_NIGHTINGALE:
          setSwitchChart({
            chart: (
              <DonutChart
                {...chartProps}
                seriesOp={{
                  roseType: 'area',
                  itemStyle: { borderRadius: 8 },
                }}
              />
            ),
            chartSetting: <DonutChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_SCATTER:
          setSwitchChart({
            chart: <ScatterChart {...chartProps} />,
            chartSetting: <ScatterChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_BUBBLE:
          setSwitchChart({
            chart: <BubbleChart {...chartProps} />,
            chartSetting: <BubbleChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_RADAR:
          setSwitchChart({
            chart: <RadarChart {...chartProps} />,
            chartSetting: <RadarChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_TREEMAP:
          setSwitchChart({
            chart: <TreemapChart {...chartProps} />,
            chartSetting: <TreemapChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_HEATMAP:
          setSwitchChart({
            chart: <HeatmapChart {...chartProps} />,
            chartSetting: <HeatmapChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_SUNBURST:
          setSwitchChart({
            chart: <TreemapChart {...chartProps} seriesOp={{ type: 'sunburst', label: { rotate: 'radial' } }} />,
            chartSetting: <TreemapChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_GAUGE:
          setSwitchChart({
            chart: <GaugeChart {...chartProps} />,
            chartSetting: <GaugeChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_CANDLESTICK:
          setSwitchChart({
            chart: <CandlestickChart {...chartProps} />,
            chartSetting: <CandlestickChartSetting {...chartSettingProps} />,
          });
          break;

        case WIDGET_TYPE.CHART_FUNNEL:
          setSwitchChart({
            chart: (
              <PieChart
                {...chartProps}
                seriesOp={{
                  type: 'funnel',
                  width: '70%',
                  gap: 4,
                  label: {
                    show: option.series.name && true,
                    position: 'inside',
                  },
                }}
              />
            ),
            chartSetting: <PieChartSetting {...chartSettingProps} />,
          });
          break;

        default:
          break;
      }
    }
  }, [option, componentType, data]);

  // 이미 저장된 위젯값이 있는 경우 불러오기
  useEffect(() => {
    if (!!prevOption) {
      setOption({ ...option, ...prevOption });
    }
  }, [prevOption]);

  const handleSubmit = event => {
    event.preventDefault();

    // alert sample
    // alert.info('위젯 속성을 저장하시겠습니까?', {
    //   onClose: () => {
    //     console.log('test alert');
    //   },
    // });

    // confirm sample
    alert.success('위젯 속성을 저장하시겠습니까?');

    console.log('widgetTitle:', option.title);
    console.log('datesetId:', dataSetId);
    console.log('widgetType:', componentType);
    console.log('widgetOption:', option);
  };

  return (
    <TitleBox title={widgetTypeText}>
      <Grid
        onSubmit={handleSubmit}
        component="form"
        id="widgetAttribute"
        container
        sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}
      >
        <Grid item xs={12} md={7.5} lg={8.5}>
          <WidgetBox sx={matchesMd && trigger ? { position: 'fixed', top: 80, maxWidth: matchesLg ? '65%' : '57%' } : {}}>
            {switchChart.chart}
            {/*<ChartComponent widgetType={componentType.type} {...chartProps} />*/}
          </WidgetBox>
        </Grid>
        {switchChart.chartSetting}
      </Grid>
    </TitleBox>
  );
}

export default WidgetAttributeSelect;
