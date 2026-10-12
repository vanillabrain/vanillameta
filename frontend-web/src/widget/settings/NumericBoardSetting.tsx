import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListItem, ListItemText, Divider } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';
import { AGGREGATION_LIST, COLUMN_TYPE, DISPLAY_LIST, HIDDEN_LIST } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';

const fontSizeList = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];

const NumericBoardSetting = props => {
  const { t } = useTranslation();
  const { option, setOption, spec } = props;

  const handleHeaderChange = event => {
    console.log('event', event);
    const newOption = { ...option };
    option.header[event.target.name] = event.target.value;
    setOption({ ...option, ...newOption });
  };

  const handleContentChange = event => {
    const { name, value } = event.target;
    const content = { ...option.content };
    if (name === 'decimalPlaces') {
      if (value === '') delete content.decimalPlaces;
      else {
        const decimalPlaces = Number(value);
        if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) return;
        content.decimalPlaces = decimalPlaces;
      }
    } else content[name] = value;
    setOption({ ...option, content });
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary={t('settings.messageSetting')} />
        <TextFieldForm
          label={t('settings.messageInput')}
          name="title"
          required={true}
          value={option.header.title}
          onChange={handleHeaderChange}
        />
        <SelectForm
          name="fontSize"
          label={t('settings.sizeColor')}
          optionList={fontSizeList}
          value={option.header.fontSize}
          onChange={handleHeaderChange}
          endButton={<ColorPickerForm color={option.header.color} name="color" onChange={handleHeaderChange} />}
        />
        <SelectForm
          name="titleHidden"
          label={t('settings.hideTitle')}
          optionList={HIDDEN_LIST(t)}
          value={option.header.titleHidden}
          onChange={handleHeaderChange}
        />
      </ListItem>
      <ListItem>
        <ListItemText primary={t('settings.numberValue')} />
        <SelectForm
          required={true}
          id="field"
          name="field"
          label={t('settings.field')}
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.content.field}
          onChange={handleContentChange}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label={t('settings.aggregation')}
          optionList={AGGREGATION_LIST(t)}
          value={option.content.aggregation}
          onChange={handleContentChange}
          disabledDefaultValue
        />
        <Divider />
        <SelectForm
          name="fontSize"
          label={t('settings.sizeColor')}
          optionList={fontSizeList}
          value={option.content.fontSize}
          onChange={handleContentChange}
          endButton={<ColorPickerForm color={option.content.color} name="color" onChange={handleContentChange} />}
        />
        <SelectForm
          name="numForm"
          label={t('settings.numberFormat')}
          optionList={DISPLAY_LIST(t)}
          value={option.content.numForm}
          onChange={handleContentChange}
        />
        <SelectForm
          name="decimalPlaces"
          label={t('settings.decimalPlaces', { defaultValue: 'Decimal places' })}
          optionList={[0, 1, 2, 3, 4, 5, 6]}
          value={option.content.decimalPlaces ?? ''}
          onChange={handleContentChange}
        />
        <TextFieldForm label="Prefix" name="prefix" value={option.content.prefix} onChange={handleContentChange} />
        <TextFieldForm label="Suffix" name="suffix" value={option.content.suffix} onChange={handleContentChange} />
      </ListItem>
    </React.Fragment>
  );
};

export default NumericBoardSetting;
