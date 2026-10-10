import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, InputAdornment, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { handleChange, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, LEGEND_LIST, PIE_LABEL_LIST } from '@/constant';
import { getAggregationDataForChart, getColorArr } from '@/widget/modules/utils/chartUtil';
import TextFieldForm from '@/components/form/TextFieldForm';
import ColorFieldReForm from '@/components/form/ColorFieldReForm';
import { AddButton } from '@/components/button/AddIconButton';

const MixedDonutPieChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec, dataSet } = props;

  const [colorNum, setColorNum] = useState(12);

  console.log(option);

  const getColor = () => {
    let aggrData = [];
    if (option.series.field && option.pie.field) {
      const seriesAggrData = getAggregationDataForChart(
        dataSet,
        option.series.name,
        option.series.field,
        option.series.aggregation,
      );
      const pieAggrData = getAggregationDataForChart(dataSet, option.pie.name, option.pie.field, option.pie.aggregation);
      aggrData = [...seriesAggrData, ...pieAggrData];
    }
    if (aggrData.length !== option.color.length) {
      const colorArr = getColorArr(aggrData.length);
      setOption(prevState => {
        prevState.color = colorArr;
        return { ...prevState };
      });
    }
  };

  useEffect(() => {
    getColor();
  }, [option.pie.field, option.pie.name, option.series.field, option.series.name]);

  const handleRadiusChange = (event, prop) => {
    setOption(prevState => {
      const obj = { ...prevState };
      // radius가 배열일 때
      if (Array.isArray(obj[prop].radius)) {
        const index = Number(event.target.name.slice(-1)) - 1;
        obj[prop].radius[index] = event.target.value + '%';
        return obj;
      }
      // radius가 문자일 때
      if (typeof obj[prop].radius === 'string') {
        obj[prop].radius = event.target.value + '%';
        return obj;
      }
      return;
    });
  };

  const handleColorChange = (event, index) => {
    // console.log('event', event, index);
    const newOption = { ...option };
    newOption.color.splice(index, 1, event.target.value);
    setOption({ ...option, ...newOption });
  };

  const handleAddColorClick = () => {
    if (option.series.field && option.series.name && option.pie.field && option.pie.name) {
      setColorNum(prevState => prevState + 12);
    }
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.donutSeries')} />
        <SelectForm
          required={true}
          id="name"
          name="name"
          label={t('settings.name')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.map(item => item.columnName)}
          value={option.series.name}
          onChange={event => handleSeriesChange(event, setOption, 'series', 'name')}
        />
        <SelectForm
          name="label"
          label={t('settings.labelType')}
          optionList={PIE_LABEL_LIST(t)}
          value={option.series.label}
          onChange={event => handleSeriesChange(event, setOption, 'series', 'label')}
          // onChange={handleSeriesChange}
        />
        <Divider />
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.series.field}
          onChange={event => handleSeriesChange(event, setOption, 'series', 'field')}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.series.aggregation}
          onChange={event => handleSeriesChange(event, setOption, 'series', 'aggregation')}
          disabledDefaultValue
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary={t('settings.pieSeries')} />
        <SelectForm
          required={true}
          id="name"
          name="name"
          label={t('settings.name')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.map(item => item.columnName)}
          value={option.pie.name}
          onChange={event => handleSeriesChange(event, setOption, 'pie', 'name')}
        />
        <SelectForm
          name="label"
          label={t('settings.labelType')}
          optionList={PIE_LABEL_LIST(t)}
          value={option.series.label}
          onChange={event => handleSeriesChange(event, setOption, 'pie', 'label')}
          // onChange={handleSeriesChange}
        />
        <Divider />
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.pie.field}
          onChange={event => handleSeriesChange(event, setOption, 'pie', 'field')}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.pie.aggregation}
          onChange={event => handleSeriesChange(event, setOption, 'pie', 'aggregation')}
          disabledDefaultValue
        />
      </ListItem>

      <ListItem divider>
        <ListItemText primary={t('settings.donutShape')} />
        <TextFieldForm
          id="radius1"
          name="radius1"
          label={t('settings.innerRadius')}
          type="number"
          value={option.series.radius[0].slice(0, -1)}
          onChange={event => handleRadiusChange(event, 'series')}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
        <TextFieldForm
          id="radius2"
          name="radius2"
          label={t('settings.outerRadius')}
          type="number"
          value={option.series.radius[1].slice(0, -1)}
          onChange={event => handleRadiusChange(event, 'series')}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary={t('settings.pieShape')} />
        <TextFieldForm
          id="radius"
          name="radius"
          label={t('settings.size')}
          type="number"
          value={option.pie.radius.slice(0, -1)}
          onChange={event => handleRadiusChange(event, 'pie')}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
      </ListItem>

      <ListItem divider>
        <ListItemText>{t('settings.legend')}</ListItemText>
        <SelectForm
          id="legendPosition"
          name="legendPosition"
          label={t('settings.position')}
          optionList={LEGEND_LIST(t)}
          value={option.legendPosition}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>

      <ListItem>
        <ListItemText primary={t('settings.colorSetting')} />
        <AddButton
          onClick={handleAddColorClick}
          sx={{
            position: 'absolute',
            top: 30,
            right: 0,
          }}
        />
        {option.series.field &&
          option.pie.field &&
          option.color
            .filter((item, index) => index < colorNum)
            .map((item, index) => (
              <ColorFieldReForm
                key={index}
                color={item}
                onChange={event => handleColorChange(event, index)}
                setOption={setOption}
              />
            ))}
      </ListItem>
    </React.Fragment>
  );
};

export default MixedDonutPieChartSetting;
