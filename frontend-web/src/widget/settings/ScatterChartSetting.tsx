import React from 'react';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import TextFieldForm from '@/components/form/TextFieldForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST } from '@/constant';

const ScatterChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;

  // 컴포넌트 별 default series
  const defaultSeries = {
    title: `이름 ${option.series.length + 1}`,
    xField: '',
    yField: '',
    color: '',
    symbolSize: 20,
  };

  return (
    <React.Fragment>
      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.series')}</span>
        <AddButton
          onClick={event => handleAddClick(event, option, setOption, defaultSeries)}
          className="absolute right-0 top-[30px]"
        />
        {option.series.map((item, index) => (
          <React.Fragment key={index}>
            <TextFieldForm
              id={`title${index + 1}`}
              name={`title${index + 1}`}
              label={`시리즈 ${index + 1} 레이블`}
              value={item.title}
              onChange={event => handleSeriesChange(event, setOption)}
              endButton={<ColorButtonForm index={index} option={option} setOption={setOption} />}
            />
            <SelectForm
              required={true}
              id={`xField${index + 1}`}
              name={`xField${index + 1}`}
              label={t('settings.xField')}
              labelField="columnName"
              valueField="columnType"
              optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
              value={item.xField}
              onChange={event => handleSeriesChange(event, setOption)}
            />
            <SelectForm
              required={true}
              id={`yField${index + 1}`}
              name={`yField${index + 1}`}
              label={t('settings.yField')}
              labelField="columnName"
              valueField="columnType"
              optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
              value={item.yField}
              onChange={event => handleSeriesChange(event, setOption)}
            />
            <TextFieldForm
              id={`symbolSize${index + 1}`}
              name={`symbolSize${index + 1}`}
              label={t('settings.size')}
              type="number"
              value={item.symbolSize}
              onChange={event => handleSeriesChange(event, setOption)}
              endButton={
                0 < index ? (
                  <RemoveButton onClick={event => handleRemoveClick(event, index, option, setOption)} id={index} />
                ) : (
                  false
                )
              }
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

export default ScatterChartSetting;
