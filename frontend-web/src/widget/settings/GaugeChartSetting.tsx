import React from 'react';
import { useTranslation } from 'react-i18next';
import SelectForm from '@/components/form/SelectForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';

const GaugeChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;

  return (
    <React.Fragment>
      <li className="relative flex w-full flex-col gap-2 py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.series')}</span>
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
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
          label={t('settings.label')}
          value={option.fieldLabel ? option.fieldLabel : ''}
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
        <TextFieldForm
          id="suffix"
          name="suffix"
          label={t('settings.unit')}
          value={option.suffix}
          onChange={event => handleChange(event, setOption)}
        />
      </li>
    </React.Fragment>
  );
};

export default GaugeChartSetting;
