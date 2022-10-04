import React from 'react';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import TextFieldForm from '@/components/form/TextFieldForm';
import { InputAdornment } from '@mui/material';

function DonutChartSetting(props) {
  const { option, setOption, spec, dataLength } = props;

  const innerRadius = option.series.radius[0];
  const outerRadius = option.series.radius[1];

  const handleChange = event => {
    setOption(prevState => {
      const obj = { ...prevState };
      const radius = [...prevState.series.radius];
      const index = Number(event.target.name.slice(-1)) - 1;
      radius[index] = event.target.value + '%';
      obj.series.radius = radius;
      return obj;
    });
  };

  return (
    <PieChartSetting
      option={option}
      setOption={setOption}
      spec={spec}
      dataLength={dataLength}
      listItem={{
        title: '차트 모양 설정',
        children: (
          <React.Fragment>
            <TextFieldForm
              id="radius1"
              name="radius1"
              label="내부 원 크기"
              type="number"
              value={innerRadius.slice(0, -1)}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">%</InputAdornment>}
            />
            <TextFieldForm
              id="radius2"
              name="radius2"
              label="외부 원 크기"
              type="number"
              value={outerRadius.slice(0, -1)}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">%</InputAdornment>}
            />
          </React.Fragment>
        ),
      }}
    />
  );
}

export default DonutChartSetting;
