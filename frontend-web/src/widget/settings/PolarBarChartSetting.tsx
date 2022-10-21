import React from 'react';
import { Divider, InputAdornment, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LABEL_LIST, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';

const PolarBarChartSetting = props => {
  const { option, setOption, spec } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
    color: '',
    aggregation: WIDGET_AGGREGATION.SUM,
  };

  const innerRadius = option.radius[0];
  const outerRadius = option.radius[1];

  const handleRadiusChange = event => {
    setOption(prevState => {
      const obj = { ...prevState };
      const radius = [...prevState.radius];
      const index = Number(event.target.name.slice(-1)) - 1;
      radius[index] = event.target.value + '%';
      obj.radius = radius;
      return obj;
    });
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary="카테고리 설정" sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
          id="axisField"
          name="axisField"
          label="축"
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.axisField}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          name="label"
          label="레이블"
          optionList={LABEL_LIST}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary="시리즈 설정" />
        <AddButton
          onClick={event => handleAddClick(event, option, setOption, defaultSeries)}
          sx={{
            position: 'absolute',
            top: 30,
            right: 0,
          }}
        />
        {option.series.map((item, index) => (
          <React.Fragment key={index}>
            <SelectForm
              required={true}
              id={`field${index + 1}`}
              name={`field${index + 1}`}
              label={`필드 ${index + 1}`}
              labelField="columnName"
              valueField="columnType"
              optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
              value={item.field}
              onChange={event => handleSeriesChange(event, setOption)}
              endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
            />
            <SelectForm
              id={`aggregation${index + 1}`}
              name={`aggregation${index + 1}`}
              label="집계 방식"
              optionList={AGGREGATION_LIST}
              value={item.aggregation}
              onChange={event => handleSeriesChange(event, setOption)}
              disabledDefaultValue
              endButton={
                0 < index ? (
                  <RemoveButton onClick={event => handleRemoveClick(event, index, option, setOption)} id={index} />
                ) : (
                  ' '
                )
              }
            />
            <Divider />
          </React.Fragment>
        ))}
      </ListItem>
      <ListItem divider>
        <ListItemText primary="차트 모양 설정" />
        <TextFieldForm
          id="radius1"
          name="radius1"
          label="내부 원 크기"
          type="number"
          value={innerRadius.slice(0, -1)}
          onChange={handleRadiusChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
        <TextFieldForm
          id="radius2"
          name="radius2"
          label="외부 원 크기"
          type="number"
          value={outerRadius.slice(0, -1)}
          onChange={handleRadiusChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
      </ListItem>
      <ListItem>
        <ListItemText>범례 설정</ListItemText>
        <SelectForm
          id="legendPosition"
          name="legendPosition"
          label="위치"
          optionList={LEGEND_LIST}
          value={option.legendPosition}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
    </React.Fragment>
  );
};

export default PolarBarChartSetting;
