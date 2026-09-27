import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';

const HeatmapChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;

  console.log(option, 'option');

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.category')} sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          id="xField"
          name="xField"
          label={t('settings.xAxis')}
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.xField}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          id="yField"
          name="yField"
          label={t('settings.yAxis')}
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.yField}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary={t('settings.series')} />
        <SelectForm
          required={true}
          id="series"
          name="series"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.aggregation}
          onChange={event => handleChange(event, setOption)}
          disabledDefaultValue
        />
        <SelectForm
          name="label"
          label={t('settings.numberLabel')}
          optionList={DISPLAY_LIST(t)}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem>
        <ListItemText primary={t('settings.colorRange')} />
        {option.color.map((item, index) => (
          <React.Fragment key={index}>
            <ColorFieldForm
              id={`color${index + 1}`}
              name={`color${index + 1}`}
              value={option.color[index]}
              colorList={option.color}
              setOption={setOption}
              index={index}
            />
          </React.Fragment>
        ))}
      </ListItem>
    </React.Fragment>
  );
};

export default HeatmapChartSetting;
