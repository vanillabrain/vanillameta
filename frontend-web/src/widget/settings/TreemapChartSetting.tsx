import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import { handleChange } from '@/widget/utils/handler';

const TreemapChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;

  const handleSeriesChange = event => {
    setOption(prevState => ({
      ...prevState,
      series: {
        ...prevState.series,
        [event.target.name]: event.target.value,
      },
    }));
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.category')} sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
          id="name"
          name="name"
          label={t('settings.name')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.map(item => item.columnName)}
          value={option.series.name}
          onChange={handleSeriesChange}
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
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series.field}
          onChange={handleSeriesChange}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.series.aggregation}
          onChange={handleSeriesChange}
          disabledDefaultValue
        />
        <Divider />
      </ListItem>
      <ListItem>
        <ListItemText primary={t('settings.colorRange')} />
        {option.series.color.map((item, index) => (
          <React.Fragment key={index}>
            <ColorFieldForm
              id={`color${index + 1}`}
              name={`color${index + 1}`}
              value={option.series.color[index]}
              colorList={option.series.color}
              setOption={setOption}
              index={index}
            />
          </React.Fragment>
        ))}
      </ListItem>
    </React.Fragment>
  );
};

export default TreemapChartSetting;
