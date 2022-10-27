import React from 'react';
import { ListItem, ListItemText, Divider } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';
import { AGGREGATION_LIST, COLUMN_TYPE, LABEL_LIST } from '@/constant';
import TextFieldForm from '@/components/form/TextFieldForm';

const fontSizeList = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];

const NumericBoardSetting = props => {
  const { option, setOption, spec } = props;

  const handleHeaderChange = event => {
    console.log('event', event);
    const newHeaderOption = { ...option };
    option.header[event.target.name] = event.target.value;
    setOption({ ...option, newHeaderOption });
  };

  const handleContentChange = event => {
    console.log('event', event);
    const newHeaderOption = { ...option };
    option.content[event.target.name] = event.target.value;
    setOption({ ...option, newHeaderOption });
  };

  return (
    <React.Fragment>
      <ListItem divider>
        <ListItemText primary="메시지 설정" />
        <TextFieldForm
          label="메시지 입력"
          name="title"
          required={true}
          value={option.header.title}
          onChange={handleHeaderChange}
        />
        <SelectForm
          name="fontSize"
          label="사이즈 및 색상"
          optionList={fontSizeList}
          value={option.header.fontSize}
          onChange={handleHeaderChange}
          endButton={<ColorPickerForm color={option.header.color} name="color" onChange={handleHeaderChange} />}
        />
      </ListItem>
      <ListItem>
        <ListItemText primary="숫자값 설정" />
        <SelectForm
          required={true}
          id="field"
          name="field"
          label="필드"
          labelField="columnName"
          valueField="columnType"
          optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
          value={option.content.field}
          onChange={handleContentChange}
        />
        <SelectForm
          id="aggregation"
          name="aggregation"
          label="집계 방식"
          optionList={AGGREGATION_LIST}
          value={option.content.aggregation}
          onChange={handleContentChange}
          disabledDefaultValue
        />
        <Divider />
        <SelectForm
          name="fontSize"
          label="사이즈 및 색상"
          optionList={fontSizeList}
          value={option.content.fontSize}
          onChange={handleContentChange}
          endButton={<ColorPickerForm color={option.content.color} name="color" onChange={handleContentChange} />}
        />
        <SelectForm
          name="numForm"
          label="숫자 서식"
          optionList={LABEL_LIST}
          value={option.content.numForm}
          onChange={handleContentChange}
        />
        <TextFieldForm label="Prefix" name="prefix" value={option.content.prefix} onChange={handleContentChange} />
        <TextFieldForm label="Suffix" name="suffix" value={option.content.suffix} onChange={handleContentChange} />
      </ListItem>
    </React.Fragment>
  );
};

export default NumericBoardSetting;
