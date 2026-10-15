import React from 'react';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import SelectForm from '@/components/form/SelectForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST } from '@/constant';
import ColorFieldForm from '@/components/form/ColorFieldForm';

const WaterfallChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, axis = 'x', spec } = props;

  return (
    <React.Fragment>
      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold uppercase">{t('settings.category')}</span>
        <SelectForm
          required={true}
          id={axis + 'Field'}
          name={axis + 'Field'}
          label={axis + t('settings.axis')}
          optionList={spec.map(item => item.columnName)}
          labelField="columnName"
          valueField="columnType"
          value={option[`${axis}Field`]}
          onChange={event => handleChange(event, setOption)}
        />
      </li>
      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.series')}</span>
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series[0].field}
          onChange={event => handleSeriesChange(event, setOption)}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.series[0].aggregation}
          onChange={event => handleSeriesChange(event, setOption)}
          disabledDefaultValue
        />
        <Separator />
        <SelectForm
          name="mark"
          label={t('settings.markPoint')}
          optionList={DISPLAY_LIST(t)}
          value={option.mark}
          onChange={event => handleChange(event, setOption)}
        />
      </li>
      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.colorSetting')}</span>
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
      </li>
      <li className="relative flex w-full flex-col gap-2 py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.legend')}</span>
        <SelectForm
          id="legendPosition"
          name="legendPosition"
          label={t('settings.position')}
          optionList={LEGEND_LIST(t)}
          value={option.legendPosition}
          onChange={event => handleChange(event, setOption)}
        />
      </li>
    </React.Fragment>
  );
};

export default WaterfallChartSetting;
