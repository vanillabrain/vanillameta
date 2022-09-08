import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import chartData from '@/data/sample/chart.json';
import componentList from '@/data/componentList.json';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import LineChart from '@/modules/linechart/LineChart';
import WidgetBox from '@/components/widget/WidgetBox';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption, setWidgetOption } = props;

  // 임시 메모 TODO
  // 1. series에 해당하는 타입(숫자)이 남아 있으면 추가 버튼으로 input을 추가하기
  // 2. 위젯 속성창 퍼블리싱
  // 3. react-hook-form 적용하기

  // const {
  //   register,
  //   watch,
  //   formState: { errors },
  //   control,
  // } = useForm();

  // console.log(watch('example'));

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
      dataSet: chartData,
    };

    switch (componentType) {
      case 'lineChart':
        setSwitchChart({
          ...switchChart,
          chart: <LineChart {...ChartProps} />,
          chartSetting: <LineChartSetting {...ChartSettingProps} />,
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

  // const { control, handleSubmit } = useForm({
  //   defaultValues: {
  //     firstName: '',
  //     select: {},
  //   },
  // });
  // const onSubmit = data => {
  //   console.log('data: ', data);
  // };

  return (
    <Grid
      container
      component="form"
      // onSubmit={handleSubmit(onSubmit)}
      id="widgetAttribute"
      sx={{ justifyContent: { xs: 'center', md: 'space-between' } }}
    >
      <Grid item xs={12} md={8.5}>
        <WidgetBox>{switchChart.chart}</WidgetBox>
      </Grid>
      {switchChart.chartSetting}
    </Grid>
  );
}

export default WidgetAttributeSelect;
