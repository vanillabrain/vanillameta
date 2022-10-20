import React from 'react';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST } from '@/constant';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';

const WaterfallChartSetting = props => {
  const { option, setOption, axis = 'x', spec } = props;

  const handleSeriesChange = (event, prop) => {
    console.log(event.target.name, event.target.value);
    const name = event.target.name.slice(0, -1);

    setOption(prevState => {
      const obj = { ...prevState };
      obj.series[prop][name] = event.target.value;
      return obj;
    });
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary="카테고리 설정" sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
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
          id="field1"
          name="field1"
          label="수입"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series.income.field}
          onChange={event => handleSeriesChange(event, 'income')}
          endButton={
            <ColorPickerForm
              name={`color1`}
              color={option.series.income.color}
              onChange={event => handleSeriesChange(event, 'income')}
            />
          }
        />
        <SelectForm
          id="aggregation1"
          name="aggregation1"
          label="집계 방식"
          optionList={AGGREGATION_LIST}
          value={option.series.income.aggregation}
          onChange={event => handleSeriesChange(event, 'income')}
          disabledDefaultValue
        />
        <Divider />
        <SelectForm
          required={true}
          id="field2"
          name="field2"
          label="지출"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series.expenses.field}
          onChange={event => handleSeriesChange(event, 'expenses')}
          endButton={
            <ColorPickerForm
              name={`color2`}
              color={option.series.expenses.color}
              onChange={event => handleSeriesChange(event, 'expenses')}
            />
          }
        />
        <SelectForm
          id="aggregation2"
          name="aggregation2"
          label="집계 방식"
          optionList={AGGREGATION_LIST}
          value={option.series.expenses.aggregation}
          onChange={event => handleSeriesChange(event, 'expenses')}
          disabledDefaultValue
        />
      </ListItem>
      {/*<ListItem divider>*/}
      {/*  <ListItemText primary="색상 설정" />*/}
      {/*  {option.color.map((item, index) => (*/}
      {/*    <React.Fragment key={index}>*/}
      {/*      <ColorFieldForm*/}
      {/*        id={`color${index + 1}`}*/}
      {/*        name={`color${index + 1}`}*/}
      {/*        value={option.color[index]}*/}
      {/*        colorList={option.color}*/}
      {/*        setOption={setOption}*/}
      {/*        index={index}*/}
      {/*      />*/}
      {/*    </React.Fragment>*/}
      {/*  ))}*/}
      {/*</ListItem>*/}
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

export default WaterfallChartSetting;
