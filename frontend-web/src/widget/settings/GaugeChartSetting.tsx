import React from 'react';
import { ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';

const GaugeChartSetting = props => {
  const { option, setOption, spec } = props;

  return (
    <React.Fragment>
      <ListItem>
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
        <TextFieldForm
          id="fieldLabel"
          name="fieldLabel"
          label="레이블"
          value={option.fieldLabel ? option.fieldLabel : ''}
          onChange={event => handleChange(event, setOption)}
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
    </React.Fragment>
  );
};

export default GaugeChartSetting;
