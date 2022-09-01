import React, { useEffect, useState } from 'react';
import { Grid, List, ListItem, ListItemText, styled, TextField } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import SelectChipForm from '@/components/form/SelectChipForm';
import RadioForm from '@/components/form/RadioForm';
import CheckForm from '@/components/form/CheckForm';
import TextFieldForm from '@/components/form/TextFieldForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import ReactECharts from 'echarts-for-react';
import WidgetBox from '@/components/widget/WidgetBox';
import { componentList, getComponent } from '@/data/component';
import chartData from '@/data/sample/chart.json';

const StyledList = styled(List)({
  display: 'flex',
  flexWrap: 'wrap',
  '& .MuiListItemText-root': {
    width: '100%',
  },
  '& .MuiListItemText-primary': {
    mb: 1,
    textAlign: 'left',
    fontWeight: 500,
    fontSize: 14,
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: ' column',
    rowGap: 8,
    width: '100%',
    padding: '30px 0 30px',
  },
});

const LineChartSetting = props => {
  const { option, setOptions } = props;

  const makeWidgetOption = () => {
    const newOption = {
      grid: { top: 8, right: 8, bottom: 24, left: 36 },
      xAxis: {
        type: 'category',
        data: chartData.map(item => item[option.xField]),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          data: chartData.map(item => item[option.yField]),
          type: 'line',
          smooth: true,
        },
        {
          data: chartData.map(item => item[option.yField1]),
          type: 'line',
          smooth: true,
        },
      ],
      tooltip: {
        trigger: 'axis',
      },
    };
    return newOption;
  };

  const handleChange = event => {
    setOptions({ ...option, [event.target.name]: event.target.value });
  };

  return (
    <Grid item xs={10} md={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <TextField
        id="widgetName"
        name="widgetName"
        label="위젯 이름"
        placeholder="위젯의 이름을 입력해 주세요"
        required
        // autoFocus
        fullWidth
        sx={{ mt: { xs: 5, md: 0 } }}
        // ref={register}
        //{...register('example')}
        value={option.title}
        onChange={handleChange}
      />
      {/*{errors.exampleRequired && <span>This field is required</span>}*/}
      {/*<input type="submit" />*/}
      <StyledList>
        <ListItem divider>
          <ListItemText primary="오른쪽 선택 상자" />
          <SelectForm
            id="xField"
            name="xField"
            label="X축"
            option={[
              { value: 'id', label: 'id' },
              { value: 'name', label: 'name' },
            ]}
            value={option.xField}
            onChange={handleChange}
          />
          <SelectForm
            id="yField"
            name="yField"
            label="Y축"
            option={[
              { value: 'high', label: 'high' },
              { value: 'low', label: 'low' },
            ]}
            value={option.yField}
            onChange={handleChange}
          />
          <SelectForm
            id="yField1"
            name="yField1"
            label="Y축"
            option={[
              { value: 'high', label: 'high' },
              { value: 'low', label: 'low' },
            ]}
            value={option.yField1}
            onChange={handleChange}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default LineChartSetting;
