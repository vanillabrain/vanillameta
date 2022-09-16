import React, { useEffect, useState } from 'react';
import { Grid, Typography } from '@mui/material';
import chartData from '@/data/sample/chart.json';
import componentList from '@/data/componentList.json';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import LineChart from '@/modules/linechart/LineChart';
import PieChart from '@/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import WidgetBox from '@/components/widget/WidgetBox';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption, setWidgetOption } = props;

  const defaultComponentData = componentList.find(item => item.id === componentType && item);
  const [option, setOption] = useState(defaultComponentData.options);

  const defaultChart = {
    chart: null,
    chartSetting: null,
    chartOptions: option,
  };

  const [switchChart, setSwitchChart] = useState(defaultChart);

  useEffect(() => {
    const ChartProps = {
      option: option,
      dataSet: chartData,
    };

    const ChartSettingProps = {
      option: option,
      setOption: setOption,
    };

    switch (componentType) {
      case 'lineChart':
        setSwitchChart({
          ...switchChart,
          chart: <LineChart {...ChartProps} componentType="line" />,
          chartSetting: <LineChartSetting {...ChartSettingProps} />,
        });
        break;
      case 'barChart':
        setSwitchChart({
          ...switchChart,
          chart: <LineChart {...ChartProps} componentType="bar" />,
          chartSetting: <LineChartSetting {...ChartSettingProps} />,
        });
        break;
      case 'pieChart':
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
  }, [option, componentType]);

  // 이미 저장된 위젯값이 있는 경우 불러오기
  useEffect(() => {
    if (!!prevOption) {
      setOption({ ...option, ...prevOption });
    }
  }, [prevOption]);

  useEffect(() => {
    setWidgetOption(option);
  }, [option]);

  return (
    <Grid container component="form" id="widgetAttribute" sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}>
      <Grid item xs={12} md={7.5} lg={8.5}>
        <WidgetBox>{switchChart.chart}</WidgetBox>
      </Grid>
      {switchChart.chartSetting}
    </Grid>
  );
}

export default WidgetAttributeSelect;
