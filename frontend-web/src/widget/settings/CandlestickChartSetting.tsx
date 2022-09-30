import React from 'react';
import { Divider, Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import ColorPickerForm from '@/components/form/ColorPickerForm';

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

const CandlestickChartSetting = props => {
  const { option, setOption, axis = 'x', spec } = props;

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary={`${axis}축 설정`} sx={{ textTransform: 'uppercase' }} />
          <SelectForm
            id={axis + 'Field'}
            name={axis + 'Field'}
            label={axis + '축'}
            optionList={spec.map(item => item.columnName)}
            labelField="columnName"
            valueField="columnType"
            value={option[`${axis}Field`]}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />

          <SelectForm
            required={true}
            id="fieldUp"
            name="fieldUp"
            label="필드 Up"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            // value={option.series.fieldUp}
            // onChange={event => handleSeriesChange(event, setOption)}
            // endButton={<ColorPickerForm color={option.series.color} setOption={setOption} />}
          />
          <SelectForm
            required={true}
            id="fieldDown"
            name="fieldDown"
            label="필드 Down"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            // value={option.series.fieldDown}
            // onChange={event => handleSeriesChange(event, setOption)}
            // endButton={<ColorPickerForm color={option.series.color} setOption={setOption} />}
          />
          <SelectForm
            required={true}
            id="fieldUpBorder"
            name="fieldUpBorder"
            label="필드 UpBorder"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            // value={option.series.fieldUpBorder}
            // onChange={event => handleSeriesChange(event, setOption)}
            // endButton={<ColorPickerForm color={option.series.color} setOption={setOption} />}
          />
          <SelectForm
            required={true}
            id="fieldDownBorder"
            name="fieldDownBorder"
            label="필드 DownBorder"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            // value={option.series.fieldDownBorder}
            // onChange={event => handleSeriesChange(event, setOption)}
            // endButton={<ColorPickerForm color={option.series.color} setOption={setOption} />}
          />
          <SelectForm
            id="aggregation1"
            name="aggregation1"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            // value={option.series.aggregation}
            // onChange={event => handleSeriesChange(event, setOption)}
            disabledDefaultValue
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

export default CandlestickChartSetting;
