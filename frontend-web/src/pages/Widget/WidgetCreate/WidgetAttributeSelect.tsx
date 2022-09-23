import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import componentList from '@/data/componentList.json';
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
import ScatterChart from '@/modules/scatterchart/ScatterChart';
import ScatterChartSetting from '@/widget/settings/ScatterChartSetting';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption } = props;

  const [option, setOption] = useState(null);
  const [data, setData] = useState(null);

  const [switchChart, setSwitchChart] = useState({ chart: undefined, chartSetting: undefined });

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    const defaultComponentData = [...componentList].find(item => item.id === componentType && { ...item });
    setOption(JSON.parse(JSON.stringify(defaultComponentData.option)));
  }, [componentType]);

  const getData = () => {
    // dataSetId 로 데이터 조회
    get('/data/sample/chart.json').then(response => {
      setData(response.data);
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
      };

      switch (componentType) {
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
                axisReverse={true}
                seriesOp={{ type: 'bar' }}
                defaultOp={{
                  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  xAxis: { boundaryGap: [0, 0.01] },
                  emphasis: { focus: 'none' },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...ChartSettingProps} axisReverse={true} />,
          });
          break;
        case WIDGET_TYPE.CHART_STACKED_COLUMN:
          setSwitchChart({
            ...switchChart,
            chart: (
              <LineChart
                {...ChartProps}
                axisReverse={true}
                seriesOp={{ type: 'bar', stack: 'total', label: { show: true } }}
                defaultOp={{
                  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                }}
              />
            ),
            chartSetting: <LineChartSetting {...ChartSettingProps} axisReverse={true} />,
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

        default:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
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

    if (option.title === '') {
      return;
    }

    console.log('widgetTitle:', option.title);
    console.log('datesetId:', dataSetId);
    console.log('widgetType:', componentType);
    console.log('widgetOption:', option);
  };

  return (
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
  );
}

export default WidgetAttributeSelect;
