import React from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import TextFieldForm from '@/components/form/TextFieldForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleChange, handleSeriesChange, handleAddClick, handleRemoveClick } from '@/widget/utils/handler';
import { COLUMN_TYPE, LEGEND_LIST } from '@/constant';

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

const LineChartSetting = props => {
  const { option, setOption, spec } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    title: '',
    xField: '',
    yField: '',
    color: '',
    symbolSize: '',
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
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
              <TextFieldForm
                id={`title${index + 1}`}
                name={`title${index + 1}`}
                label={`시리즈 ${index + 1} 이름`}
                value={item.title}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
              />
              <SelectForm
                required={true}
                id={`xField${index + 1}`}
                name={`xField${index + 1}`}
                label="X 필드"
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={item.xField}
                onChange={event => handleSeriesChange(event, setOption)}
              />
              <SelectForm
                required={true}
                id={`yField${index + 1}`}
                name={`yField${index + 1}`}
                label="Y 필드"
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={item.yField}
                onChange={event => handleSeriesChange(event, setOption)}
              />
              <SelectForm
                required={true}
                id={`symbolSize${index + 1}`}
                name={`symbolSize${index + 1}`}
                label="사이즈"
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={item.symbolSize}
                onChange={event => handleSeriesChange(event, setOption)}
                endButton={
                  0 < index ? (
                    <RemoveButton onClick={event => handleRemoveClick(event, index, option, setOption)} id={index} />
                  ) : (
                    false
                  )
                }
              />
              <Divider />
            </React.Fragment>
          ))}
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

export default LineChartSetting;
