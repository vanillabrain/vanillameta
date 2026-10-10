import React from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, ListItem, ListItemText } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { ALIGN_LIST, TABLE_ALIGN } from '@/constant';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';
import TextFieldForm from '@/components/form/TextFieldForm';
import RadioForm from '@/components/form/RadioForm';

const TableBoardSetting = props => {
  const { t } = useTranslation();
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
        <ListItemText primary={t('settings.tableColumn')} />
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
              optionList={spec.map(item => item.columnName)}
              value={item.name}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
            />
            <TextFieldForm
              label={t('settings.columnTitle')}
              name={`header${index + 1}`}
              value={item.header}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
            />
            <RadioForm
              label={t('settings.columnMerge')}
              name={`rowSpan${index + 1}`}
              option={[
                { label: t('settings.merge'), value: true },
                { label: t('settings.split'), value: false },
              ]}
              value={item.rowSpan}
              onChange={event => handleSeriesChange(event, setOption, 'columns')}
            />
            <SelectForm
              id={`align${index + 1}`}
              name={`align${index + 1}`}
              label={t('settings.sort')}
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
