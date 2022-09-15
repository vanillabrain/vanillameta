import React, { useState } from 'react';
import { FormControl, FormLabel, IconButton, MenuItem, Popover, Select, Stack } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';

function SelectForm(props) {
  const { label, option, colorButton, value, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
          sx={colorButton ? { width: 'calc(100% - 38px)', flexShrink: 0 } : { width: '100%' }}
          value={value ?? ''}
          {...rest}
        >
          {option.map(item => (
            <MenuItem key={item.value} value={item.value ?? ''}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
        {colorButton ?? ''}
      </Stack>
    </FormControl>
  );
}

SelectForm.defaultProps = {
  label: 'label',
  option: [],
  colorButton: undefined,
};

export default SelectForm;
