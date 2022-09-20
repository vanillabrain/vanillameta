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
            chart: <LineChart {...ChartProps} componentType="line" />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_BAR:
          setSwitchChart({
            ...switchChart,
            chart: <LineChart {...ChartProps} componentType="bar" />,
            chartSetting: <LineChartSetting {...ChartSettingProps} />,
          });
          break;
        case WIDGET_TYPE.CHART_PIE:
          setSwitchChart({
            ...switchChart,
            chart: <PieChart {...ChartProps} />,
            chartSetting: <PieChartSetting {...ChartSettingProps} />,
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
