import React, { useEffect, useState } from 'react';
import { Grid } from '@mui/material';
import chartData from '@/data/sample/chart.json';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import LineChart from '@/modules/linechart/LineChart';
import WidgetBox from '@/components/widget/WidgetBox';

function WidgetAttributeSelect(props) {
  const { dataSetId, componentType, prevOption, setWidgetOption } = props;

  // 임시 메모 TODO
  // 1. dataSetId와 일치하는 data(chart.json)를 DB에서 가져오기
  // 1-1. dataSetId에 따라서 chart.json을 axios로 불러와야 한다
  // 1-2. dataSet은 Chart.tsx과 ChartSetting.tsx로 받아서 각각 form의 name을 동일하게 해서 연결해 주고,
  //      select form의 option은 dataSet을 순회해서 조건(타입)에 맞는 프로퍼티 키를 가져오게 한다
  // 1-3. series에 해당하는 타입(숫자)이 남아 있으면 추가 버튼으로 input을 추가할 수 있게 한다

  // 2. option의 프로퍼티 값은 DB에 기존 value가 있으면 가져오고 없으면 빈 value를 가져온다
  // 2-1. DB에 저장될 mock data 형식 생각하고 axios로 불러오기
  // 2-2. 수정인지 생성인지(기존값이 있는지 없는지) 구분하는 방법 생각하기

  // 3. componentType과 일치하는 차트 타입 컴포넌트 한 쌍을 가져와서 option 객체 넣어주기

  // 4. react-hook-form 적용하기

  // const {
  //   register,
  //   watch,
  //   formState: { errors },
  //   control,
  // } = useForm();

  // console.log(watch('example'));

  const defaultOption = {
    title: '',
    xField: '',
    yField: '',
    yField1: '',
  };

  const [option, setOption] = useState(defaultOption);

  useEffect(() => {
    // 이미 저장된 위젯값이 있는 경우 초기값을 그것으로 한다
    if (!!prevOption) {
      setOption({ ...option, ...prevOption });
    }
  }, [prevOption]);

  useEffect(() => {
    setWidgetOption(option);
  }, [option]);

  const [switchChart, setSwitchChart] = useState(null);
  const [switchChartSetting, setSwitchChartSetting] = useState(null);

  useEffect(() => {
    switch (componentType) {
      case 'lineChart':
        setSwitchChart(<LineChart option={option} dataSet={chartData} />);
        setSwitchChartSetting(<LineChartSetting option={option} setOption={setOption} dataSet={chartData} />);
        break;
      default:
        // setSwitchChart('LineChart 이외 추가중');
        // setSwitchChartSetting('LineChart 이외 추가중');
        setSwitchChart(<LineChart option={option} dataSet={chartData} />);
        setSwitchChartSetting(<LineChartSetting option={option} setOption={setOption} dataSet={chartData} />);
        break;
    }
  }, [option, componentType]);

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
