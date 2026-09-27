import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, InputAdornment, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';

const PolarBarChartSetting = props => {
  const { t } = useTranslation();
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
        <ListItemText primary={t('settings.category')} sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
          id="axisField"
          name="axisField"
          label={t('settings.axis')}
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.axisField}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          name="label"
          label={t('settings.numberLabel')}
          optionList={DISPLAY_LIST(t)}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary={t('settings.series')} />
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
              label={t('settings.aggregation')}
              optionList={AGGREGATION_LIST(t)}
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
        <ListItemText primary={t('settings.chartShape')} />
        <TextFieldForm
          id="radius1"
          name="radius1"
          label={t('settings.innerRadius')}
          type="number"
          value={innerRadius.slice(0, -1)}
          onChange={handleRadiusChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
        <TextFieldForm
          id="radius2"
          name="radius2"
          label={t('settings.outerRadius')}
          type="number"
          value={outerRadius.slice(0, -1)}
          onChange={handleRadiusChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
      </ListItem>
      <ListItem>
        <ListItemText>{t('settings.legend')}</ListItemText>
        <SelectForm
          id="legendPosition"
          name="legendPosition"
          label={t('settings.position')}
          optionList={LEGEND_LIST(t)}
          value={option.legendPosition}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          id="legendAggregation"
          name="legendAggregation"
          label={t('settings.aggregationDisplay')}
          optionList={DISPLAY_LIST(t)}
          value={option.legendAggregation}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
    </React.Fragment>
  );
};

export default PolarBarChartSetting;
