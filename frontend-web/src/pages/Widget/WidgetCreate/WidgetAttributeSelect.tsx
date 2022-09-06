import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import chartData from '@/data/sample/chart.json';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import LineChart from '@/modules/linechart/LineChart';
import WidgetBox from '@/components/widget/WidgetBox';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, setWidgetOption } = props;

  // 1. dataSetId와 일치하는 data(chart.json)를 DB에서 가져오기(axios)
  // 2. componentType과 일치하는 차트 타입 컴포넌트 한 쌍을 가져와서 option 객체 넣어주기
  // 3. DB에 기존 value가 있으면 가져오고 없으면 빈 value 가져오기

  // const {
  //   register,
  //   watch,
  //   formState: { errors },
  //   control,
  // } = useForm();

  // console.log(watch('example'));

  const sampleOption = {
    title: '',
    xField: '',
    yField: '',
    yField1: '',
  };

  const [option, setOption] = useState(sampleOption);
  const [switchChart, setSwitchChart] = useState(null);
  const [switchChartSetting, setSwitchChartSetting] = useState(null);

  useEffect(() => {
    switch (componentType) {
      case 'lineChart':
        setSwitchChart(<LineChart option={option} dataSet={chartData} />);
        setSwitchChartSetting(<LineChartSetting option={option} setOption={setOption} dataSet={chartData} />);
        break;
      default:
        setSwitchChart('LineChart 이외 추가중');
        setSwitchChartSetting('LineChart 이외 추가중');
        break;
    }
  }, [option, componentType]);

  useEffect(() => {
    setWidgetOption(option);
  }, [option]);

  // useEffect(() => {
  //   setOption(sampleOption);
  // }, []);

  // const [widgetOption, setWidgetOption] = useState({
  //   xField: '',
  //   yField: '',
  //   yField1: '',
  // });

  // const makeWidgetOption = () => {
  //   let newOption = {};
  //   switch (componentType) {
  //     case 'lineChart':
  //       newOption = {
  //         grid: { top: 8, right: 8, bottom: 24, left: 36 },
  //         xAxis: {
  //           type: 'category',
  //           data: chartData.map(item => item[widgetOption.xField]),
  //         },
  //         yAxis: {
  //           type: 'value',
  //         },
  //         series: [
  //           {
  //             data: chartData.map(item => item[widgetOption.yField]),
  //             type: 'line',
  //             smooth: true,
  //           },
  //           {
  //             data: chartData.map(item => item[widgetOption.yField1]),
  //             type: 'line',
  //             smooth: true,
  //           },
  //         ],
  //         tooltip: {
  //           trigger: 'axis',
  //         },
  //       };
  //       break;
  //   }
  //   return newOption;
  // };

  // const handleChange = newOption => {
  //   setWidgetOption(newOption);
  //
  //   props.onUpdate(userValue);
  // };
  //
  // const handleUpdate = enteredData => {
  //   setUserValue(prevState => ({ ...prevState, ...enteredData }));
  // };

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
        <WidgetBox>{switchChart}</WidgetBox>
      </Grid>
      {switchChartSetting}
    </Grid>
  );
}

export default WidgetAttributeSelect;
