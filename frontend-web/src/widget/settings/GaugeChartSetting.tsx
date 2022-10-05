import React from 'react';
import { Grid, List, ListItem, ListItemText, styled } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';
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

const GaugeChartSetting = props => {
  const { option, setOption, spec } = props;

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={event => handleChange(event, setOption)} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="시리즈 설정" />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.field}
            onChange={event => handleChange(event, setOption)}
            endButton={
              <ColorPickerForm
                id="color"
                name="color"
                color={option.color}
                setOption={setOption}
                onChange={event => handleChange(event, setOption)}
              />
            }
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.aggregation}
            onChange={event => handleChange(event, setOption)}
            disabledDefaultValue
          />
          <TextFieldForm
            id="suffix"
            name="suffix"
            label="단위"
            value={option.suffix}
            onChange={event => handleChange(event, setOption)}
          />
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default GaugeChartSetting;
