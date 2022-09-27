import React from 'react';
import { Box, FormControl, FormLabel, MenuItem, Select, Stack } from '@mui/material';

function SelectForm(props) {
  const { label, optionList, endButton, value, labelField = 'label', valueField = 'value', required, ...rest } = props;

  const getDropList = (list: any[] | { value: any[]; label: any[] }) => {
    let dropDownList;
    if (list === undefined) {
      return;
    }
    if (Array.isArray(list)) {
      if (list.length > 0 && list[0] instanceof Object) {
        dropDownList = [...list];
      } else {
        // value와 label이 같을 경우 배열
        const arr = list.map(item => ({ [valueField]: item, [labelField]: item }));
        dropDownList = arr;
      }
    } else {
      // value와 label이 다를 경우 객체
      const value = list[valueField]; // ['sum', 'avg']
      const label = list[labelField]; // ['합계', '평균']
      const arr = value.map((item, index) => ({ value: item, label: label[index] }));
      dropDownList = arr;
    }

    dropDownList.unshift({ [valueField]: '', [labelField]: '선택 안함' });
    return dropDownList;
  };

  return (
    <FormControl
      required={required}
      fullWidth
      sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      {label && (
        <FormLabel
          htmlFor="userInputSelect"
          sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </FormLabel>
      )}
      <Stack flexDirection="row" justifyContent="space-between" alignItems="center" sx={{ width: label ? '65%' : '100%' }}>
        <Select
          fullWidth
          size="small"
          sx={endButton ? { width: 'calc(100% - 38px)', flexShrink: 1 } : { width: '100%' }}
          value={value ?? ''}
          {...rest}
        >
          {getDropList(optionList).map(item => (
            <MenuItem key={item[valueField]} value={item[valueField] ?? ''}>
              {item[labelField]}
            </MenuItem>
          ))}
        </Select>
        {!!endButton ? <Box sx={{ width: '38px', ml: 1 }}>{endButton}</Box> : ''}
      </Stack>
    </FormControl>
  );
}

SelectForm.defaultProps = {
  optionList: [],
  required: false,
};

export default SelectForm;
