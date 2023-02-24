import React from 'react';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';

const LineChartSetting = props => {
  const { option, setOption, seriesItem, axis = 'x', spec } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
    color: '',
    aggregation: WIDGET_AGGREGATION.SUM,
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
            <TextFieldForm
              id={`fieldLabel${index + 1}`}
              name={`fieldLabel${index + 1}`}
              label={`레이블`}
              value={item.fieldLabel ? item.fieldLabel : ''}
              onChange={event => handleSeriesChange(event, setOption)}
              endButton={' '}
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
            {!!seriesItem && (
              <SelectForm
                required={seriesItem.required}
                id={`${seriesItem.id}${index + 1}`}
                name={`${seriesItem.name}${index + 1}`}
                label={seriesItem.label}
                optionList={seriesItem.optionList}
                value={item[seriesItem.value]}
                onChange={event => handleSeriesChange(event, setOption)}
                disabledDefaultValue={seriesItem.disabledDefaultValue}
              />
            )}
            <Divider />
          </React.Fragment>
        ))}
        <SelectForm
          name="label"
          label="넘버 레이블"
          optionList={DISPLAY_LIST}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          name="mark"
          label="마크 포인트"
          optionList={DISPLAY_LIST}
          value={option.mark}
          onChange={event => handleChange(event, setOption)}
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
        <SelectForm
          id="legendAggregation"
          name="legendAggregation"
          label="집계 방식 표시"
          optionList={DISPLAY_LIST}
          value={option.legendAggregation}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
    </React.Fragment>
  );
};

export default LineChartSetting;
