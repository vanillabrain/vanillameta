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
import TextFieldForm from '@/components/form/TextFieldForm';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption } = props;

  const defaultComponentData = componentList.find(item => item.id === componentType && item);
  const [option, setOption] = useState(defaultComponentData.option);
  const [data, setData] = useState(null);

  const defaultChart = {
    chart: null,
    chartSetting: null,
    chartOption: option,
  };

  const [switchChart, setSwitchChart] = useState(defaultChart);

  useEffect(() => {
    getData();
  }, []);

  const getData = () => {
    // dataSetId 로 데이터 조회
    get('/data/sample/chart.json').then(response => {
      setData(response.data);
    });
  };

  useEffect(() => {
    // console.log('option changed', option);

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
        case WIDGET_TYPE.CHART_AREA:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} seriesOp={{ areaStyle: {} }} />,
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
            chart: <PieChart {...ChartProps} seriesOp={{ radius: ['30%', '75%'] }} />,
            chartSetting: (
              <PieChartSetting
                {...ChartSettingProps}
                listItem={{
                  title: '도넛 차트 설정',
                  children: <TextFieldForm label="빈 공간 크기" value="만드는 중..." />,
                }}
              />
            ),
          });
          break;

        default:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} componentType="line" />,
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
