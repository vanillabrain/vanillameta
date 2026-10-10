import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST } from '@/constant';
import ColorPickerForm from '@/components/form/ColorPickerForm';

const CandlestickChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;
  const candlestickLabel = ['open', 'close', 'lowest', 'highest'];

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.category')} sx={{ textTransform: 'uppercase' }} />
        <SelectForm
          required={true}
          id="xField"
          name="xField"
          label={t('settings.xAxis')}
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option.xField}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
      <ListItem>
        <ListItemText primary={t('settings.series')} />
        {option.series.map((item, index) => (
          <React.Fragment key={index}>
            <SelectForm
              required={true}
              id={`field${index + 1}`}
              name={`field${index + 1}`}
              label={candlestickLabel[index]}
              labelField="columnName"
              valueField="columnType"
              optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
              value={option.series[index].field}
              onChange={event => handleSeriesChange(event, setOption)}
              endButton={
                <ColorPickerForm
                  name={`color${index + 1}`}
                  color={option.series[index].color}
                  index={index}
                  option={option}
                  setOption={setOption}
                  onChange={event => handleSeriesChange(event, setOption)}
                />
              }
            />
            <SelectForm
              id={`aggregation${index + 1}`}
              name={`aggregation${index + 1}`}
              label={t('settings.aggregation')}
              optionList={AGGREGATION_LIST(t)}
              value={item.aggregation}
              onChange={event => handleSeriesChange(event, setOption)}
              disabledDefaultValue
            />
            <Divider />
          </React.Fragment>
        ))}
        <SelectForm
          name="mark"
          label={t('settings.markPoint')}
          optionList={DISPLAY_LIST(t)}
          value={option.mark}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>
    </React.Fragment>
  );
};

export default CandlestickChartSetting;
