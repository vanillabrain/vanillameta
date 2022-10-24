import React from 'react';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { ALIGN_LIST, COLUMN_TYPE, TABLE_ALIGN } from '@/constant';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import TextFieldForm from '@/components/form/TextFieldForm';

const TableBoardSetting = props => {
  const { option, setOption, spec } = props;

  const defaultSeries = {
    name: '',
    header: '',
    align: TABLE_ALIGN.LEFT,
    sortable: true,
  };

  return (
    <React.Fragment>
      <ListItem>
        <ListItemText primary="테이블 컬럼" />
        <AddButton
          onClick={event => handleAddClick(event, option, setOption, defaultSeries, 'columns')}
          sx={{
            position: 'absolute',
            top: 30,
            right: 0,
          }}
        />
        {option.columns.map((item, index) => (
          <React.Fragment key={index}>
            <SelectForm
              required={true}
              id={`name${index + 1}`}
              name={`name${index + 1}`}
              label={`필드 ${index + 1}`}
              labelField="columnName"
              valueField="columnType"
              optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
              value={item.name}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
            />
            <TextFieldForm
              label="컬럼 제목"
              name={`header${index + 1}`}
              value={item.header}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
            />
            <SelectForm
              id={`align${index + 1}`}
              name={`align${index + 1}`}
              label="정렬"
              optionList={ALIGN_LIST}
              value={item.align}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
              endButton={
                0 < index ? (
                  <RemoveButton
                    onClick={event => handleRemoveClick(event, index, option, setOption, 'columns')}
                    id={index}
                  />
                ) : (
                  ' '
                )
              }
            />
            <Divider />
          </React.Fragment>
        ))}
      </ListItem>
    </React.Fragment>
  );
};

export default TableBoardSetting;
