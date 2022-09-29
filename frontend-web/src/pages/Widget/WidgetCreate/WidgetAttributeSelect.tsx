import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import LineChart from '@/modules/linechart/LineChart';
import PieChart from '@/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import WidgetBox from '@/components/widget/WidgetBox';
import { WIDGET_TYPE } from '@/constant';
import { get } from '@/helpers/apiHelper';
import DonutChartSetting from '@/widget/settings/DonutChartSetting';
import DonutChart from '@/modules/piechart/DonutChart';
import MixedLineBarChartSetting from '@/widget/settings/MixedLineBarChartSetting';
import NumericBoard from '@/modules/ board/NumericBoard';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
import TableBoard from '@/modules/ board/TableBoard';
import TableBoardSetting from '@/widget/settings/TableBoardSetting';
import ScatterChart from '@/modules/scatterchart/ScatterChart';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';
import TitleBox from '@/components/TitleBox';
import BubbleChart from '@/modules/scatterchart/BubbleChart';
import BubbleChartSetting from '@/widget/settings/BubbleChartSetting';
import { useAlert } from 'react-alert';
import axios from 'axios';

function WidgetAttributeSelect(props) {
  const alert = useAlert();

  const { dataSetId, componentType, prevOption } = props;

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);
  const [switchChart, setSwitchChart] = useState({ chart: undefined, chartSetting: undefined });
  const [spec, setSpec] = useState(null);

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

  useEffect(() => {
    if (option && data) {
      const ChartProps = {
        option: option,
        dataSet: data,
      };

      const ChartSettingProps = {
        option: option,
        setOption: setOption,
        spec: spec,
      };

      switch (componentType.type) {
        case WIDGET_TYPE.BOARD_NUMERIC:
          setSwitchChart({
            ...switchChart,
            chart: <NumericBoard {...ChartProps} />,
            chartSetting: <NumericBoardSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.BOARD_TABLE:
          setSwitchChart({
            ...switchChart,
            chart: <TableBoard {...ChartProps} />,
            chartSetting: <TableBoardSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_LINE:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_STACKED_LINE:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} seriesOp={{ stack: 'total', label: { show: true, position: 'top' } }} />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_AREA:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} seriesOp={{ areaStyle: {} }} />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_STACKED_AREA:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
                seriesOp={{
                  areaStyle: {},
                  stack: 'total',
                  label: { show: true, position: 'top' },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_BAR:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
                seriesOp={{ type: 'bar' }}
                defaultOp={{
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  yAxis: { boundaryGap: [0, 0.01] },
                  emphasis: { focus: 'none' },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_STACKED_BAR:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }} />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_COLUMN:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
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
            chartSetting: <LineChartSetting {...ChartSettingProps} axis="y" />,
          });
          break;
        case WIDGET_TYPE.CHART_STACKED_COLUMN:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
                axis="y"
                seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }}
                defaultOp={{
                  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...ChartSettingProps} axis="y" />,
          });
          break;
        case WIDGET_TYPE.CHART_MIXED_LINE_BAR:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
                defaultOp={{
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  yAxis: { boundaryGap: [0, 0.01] },
                  emphasis: { focus: 'none' },
                }}
                seriesOp={{ smooth: false }}
              />
            ),
            chartSetting: <MixedLineBarChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_PIE:
          setSwitchChart({
            ...switchChart,
            chart: <PieChart {...ChartProps} />,
            chartSetting: <PieChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_DONUT:
          setSwitchChart({
            ...switchChart,
            chart: <DonutChart {...ChartProps} />,
            chartSetting: <DonutChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_NIGHTINGALE:
          setSwitchChart({
            ...switchChart,
            chart: (
              <DonutChart
                {...ChartProps}
                seriesOp={{
                  roseType: 'area',
                  itemStyle: { borderRadius: 8 },
                }}
              />
            ),
            chartSetting: <DonutChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_SCATTER:
          setSwitchChart({
            ...switchChart,
            chart: <ScatterChart {...ChartProps} />,
            chartSetting: <ScatterChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_BUBBLE:
          setSwitchChart({
            ...switchChart,
            chart: <BubbleChart {...ChartProps} />,
            chartSetting: <BubbleChartSetting {...ChartSettingProps} />,
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
          <WidgetBox>{switchChart.chart}</WidgetBox>
        </Grid>
        {switchChart.chartSetting}
      </Grid>
    </TitleBox>
  );
}

export default WidgetAttributeSelect;
