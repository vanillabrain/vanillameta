import React from 'react';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST, WIDGET_AGGREGATION } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';

const MixedLineStackedBarChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, axis = 'x', spec } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
    color: '',
    aggregation: WIDGET_AGGREGATION.SUM,
    type: 'line',
  };
  const chartTypeList = [
    { value: 'line', label: t('settings.lineType') },
    { value: 'bar', label: t('settings.barType') },
  ];

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
        <AddButton
          onClick={event => handleAddClick(event, option, setOption, defaultSeries)}
          className="absolute right-0 top-[30px]"
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
            <SelectForm
              required={true}
              id={`type${index + 1}`}
              name={`type${index + 1}`}
              label={`종류`}
              optionList={chartTypeList}
              value={item.type}
              onChange={event => handleSeriesChange(event, setOption)}
              disabledDefaultValue
            />
            <Separator />
          </React.Fragment>
        ))}
        <SelectForm
          name="label"
          label={t('settings.numberLabel')}
          optionList={DISPLAY_LIST(t)}
          value={option.label}
          onChange={event => handleChange(event, setOption)}
        />
        <SelectForm
          name="mark"
          label={t('settings.markPoint')}
          optionList={DISPLAY_LIST(t)}
          value={option.mark}
          onChange={event => handleChange(event, setOption)}
        />
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
        <SelectForm
          id="legendAggregation"
          name="legendAggregation"
          label={t('settings.aggregationDisplay')}
          optionList={DISPLAY_LIST(t)}
          value={option.legendAggregation}
          onChange={event => handleChange(event, setOption)}
        />
      </li>
    </React.Fragment>
  );
};

export default MixedLineStackedBarChartSetting;
