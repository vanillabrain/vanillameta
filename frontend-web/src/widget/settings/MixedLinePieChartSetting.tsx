import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, InputAdornment, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorButtonForm from '@/components/form/ColorButtonForm';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleChange, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, LEGEND_LIST, PIE_LABEL_LIST, WIDGET_AGGREGATION } from '@/constant';
import ColorFieldReForm from '@/components/form/ColorFieldReForm';
import { getAggregationDataForChart, getColorArr } from '@/widget/modules/utils/chartUtil';
import TextFieldForm from '@/components/form/TextFieldForm';

const MixedLinePieChartSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, seriesItem, axis = 'x', spec, dataSet } = props;

  const [colorNum, setColorNum] = useState(12);

  // 컴포넌트 별 default series
  const defaultSeries = {
    field: '',
    color: '',
    aggregation: WIDGET_AGGREGATION.SUM,
  };

  useEffect(() => {
    let pieAggrData = [];
    if (option.pie.field) {
      pieAggrData = getAggregationDataForChart(dataSet, option.pie.name, option.pie.field, option.pie.aggregation);
    }
    if (pieAggrData.length !== option.pie.color.length) {
      const colorArr = getColorArr(pieAggrData.length);
      setOption(prevState => {
        prevState.pie.color = colorArr;
        return { ...prevState };
      });
    }
  }, [option.pie.field, option.pie.name]);

  const handleCenterChange = event => {
    setOption(prevState => {
      const obj = { ...prevState };
      const center = [...prevState.pie.center];
      const index = Number(event.target.name.slice(-1)) - 1;
      center[index] = event.target.value + '%';
      obj.pie.center = center;
      return obj;
    });
  };

  const handleRadiusChange = event => {
    setOption(prevState => {
      const obj = { ...prevState };
      obj.pie.radius = event.target.value + '%';
      return obj;
    });
  };

  const handlePieChange = event => {
    setOption(prevState => ({
      ...prevState,
      pie: {
        ...prevState.pie,
        [event.target.name]: event.target.value,
      },
    }));
  };

  const handleColorChange = (event, index) => {
    console.log('event', event, index);
    const newOption = { ...option };
    newOption.pie.color.splice(index, 1, event.target.value);
    setOption({ ...option, ...newOption });
  };

  const handleAddColorClick = () => {
    if (option.pie.field && option.pie.name) {
      setColorNum(prevState => prevState + 12);
    }
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.lineSeries')} />
        <AddButton
          onClick={event => handleAddClick(event, option, setOption, defaultSeries)}
          sx={{
            position: 'absolute',
            top: 30,
            right: 0,
          }}
        />
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
        <Divider />

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
            {!!seriesItem && (
              <SelectForm
                id={`${seriesItem.id}${index + 1}`}
                name={`${seriesItem.name}${index + 1}`}
                label={seriesItem.label}
                optionList={seriesItem.optionList}
                value={item[seriesItem.value]}
                onChange={event => handleSeriesChange(event, setOption)}
                disabledDefaultValue={seriesItem.disabledDefaultValue}
              />
            )}
            <Divider />
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
          onChange={handlePieChange}
        />
        <SelectForm
          name="label"
          label={t('settings.labelType')}
          optionList={PIE_LABEL_LIST(t)}
          value={option.pie.label}
          onChange={handlePieChange}
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
          onChange={handlePieChange}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.pie.aggregation}
          onChange={handlePieChange}
          disabledDefaultValue
        />
      </ListItem>
      <ListItem divider>
        <ListItemText primary={t('settings.piePosition')} />
        <TextFieldForm
          id="radius"
          name="radius"
          label={t('settings.size')}
          type="number"
          value={option.pie.radius.slice(0, -1)}
          onChange={handleRadiusChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
        <TextFieldForm
          id="center1"
          name="center1"
          label={t('settings.hPos')}
          type="number"
          value={option.pie.center[0].slice(0, -1)}
          onChange={handleCenterChange}
          endAdornment={<InputAdornment position="end">%</InputAdornment>}
        />
        <TextFieldForm
          id="center2"
          name="center2"
          label={t('settings.vPos')}
          type="number"
          value={option.pie.center[1].slice(0, -1)}
          onChange={handleCenterChange}
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
        <SelectForm
          id="legendAggregation"
          name="legendAggregation"
          label={t('settings.aggregationDisplay')}
          optionList={DISPLAY_LIST(t)}
          value={option.legendAggregation}
          onChange={event => handleChange(event, setOption)}
        />
      </ListItem>

      <ListItem>
        <ListItemText primary={t('settings.pieColor')} />
        <AddButton
          onClick={handleAddColorClick}
          sx={{
            position: 'absolute',
            top: 30,
            right: 0,
          }}
        />
        {option.pie.field &&
          option.pie.color
            .filter((item, index) => index < colorNum)
            .map((item, index) => (
              <React.Fragment key={index}>
                <ColorFieldReForm color={item} onChange={event => handleColorChange(event, index)} setOption={setOption} />
              </React.Fragment>
            ))}
      </ListItem>
    </React.Fragment>
  );
};

export default MixedLinePieChartSetting;
