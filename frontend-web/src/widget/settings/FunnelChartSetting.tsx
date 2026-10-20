import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SelectForm from '@/components/form/SelectForm';
import ColorFieldForm from '@/components/form/ColorFieldForm';
import { handleChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST, PIE_LABEL_LIST } from '@/constant';
import { getAggregationDataForChart, getColorArr } from '@/widget/modules/utils/chartUtil';
import { AddButton } from '@/components/button/AddIconButton';
import { Button } from '@/components/ui/button';
import SingleColorIcon from '@/assets/images/icon/ic-color.svg?react';
import GradientColorIcon from '@/assets/images/icon/ic-gradient.svg?react';

const FunnelChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec, dataSet } = props;
  const [colorNum, setColorNum] = useState(12);

  const setMultiColor = () => {
    let pieAggrData = [];
    if (option.series.field) {
      pieAggrData = getAggregationDataForChart(dataSet, option.series.name, option.series.field, option.series.aggregation);
    }
    if (pieAggrData.length !== option.series.color.length) {
      const colorArr = getColorArr(pieAggrData.length);
      setOption(prevState => {
        prevState.series.color = colorArr;
        return { ...prevState };
      });
    }
  };
  useEffect(() => {
    if (!option.singleColor) {
      setMultiColor();
    }
  }, [option.series.field, option.series.name]);

  const handleSeriesChange = event => {
    setOption(prevState => ({
      ...prevState,
      series: {
        ...prevState.series,
        [event.target.name]: event.target.value,
      },
    }));
  };

  const handleAddColorClick = () => {
    if (option.series.field && option.series.name && !option.singleColor) {
      setColorNum(prevState => prevState + 12);
    }
  };

  const handleColorChangeClick = () => {
    if (!option.singleColor) {
      setColorNum(1);
      setOption(prevState => {
        prevState.series.color = [prevState.series.color[0]];
        prevState.singleColor = true;
        return { ...prevState };
      });
    } else {
      setColorNum(12);
      setMultiColor();
      setOption(prevState => {
        prevState.singleColor = false;
        return { ...prevState };
      });
    }
  };

  return (
    <React.Fragment>
      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold uppercase">{t('settings.category')}</span>
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
          label={t('settings.labelType')}
          optionList={PIE_LABEL_LIST(t)}
          value={option.series.label}
          onChange={handleSeriesChange}
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
      </li>

      <li className="relative flex w-full flex-col gap-2 border-b border-border py-[30px] text-sm">
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
      <li className="relative flex w-full flex-col gap-2 py-[30px] text-sm">
        <span className="w-full text-left text-sm font-bold">{t('settings.colorSetting')}</span>
        <AddButton onClick={handleAddColorClick} className="absolute right-0 top-[30px]" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-[30px] right-[34px]"
          onClick={handleColorChangeClick}
        >
          {option.singleColor ? (
            <SingleColorIcon aria-hidden="true" className="size-4" />
          ) : (
            <GradientColorIcon aria-hidden="true" className="size-4" />
          )}
        </Button>
        {option.series.field &&
          option.series.color
            .filter((item, index) => index < colorNum)
            .map((item, index) => (
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
      </li>
    </React.Fragment>
  );
};

export default FunnelChartSetting;
