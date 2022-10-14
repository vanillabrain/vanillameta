import React from 'react';
import { Divider, Grid, InputAdornment, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';

const StyledList = styled(List)({
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  '& .MuiListItemText-root': {
    width: '100%',
    marginBottom: 10,
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
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
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
        </ListItem>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
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
              />
              <Divider />
            </React.Fragment>
          ))}
        </ListItem>
        <ListItem divider>
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
      </StyledList>
    </Grid>
  );
};

export default PolarBarChartSetting;
