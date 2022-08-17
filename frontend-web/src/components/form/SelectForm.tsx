import React from 'react';
import { FormControl, FormLabel, IconButton, MenuItem, Select, Stack } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';

function SelectForm({ label, ...props }) {
  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {label && (
        <FormLabel htmlFor="userInputSelect" sx={{ width: '40%' }}>
          {label}
        </FormLabel>
      )}
      <Stack flexDirection="row" justifyContent="space-between" sx={{ width: label ? '60%' : '100%' }}>
        <Select
          fullWidth
          size="small"
          // defaultValue=""
          // sx={props.color ? { width: 'calc(100% - 38px)' } : { width: '100%' }}
          {...props}
        >
          {props.option.map(item => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
        {/*{props.color && (*/}
        {/*  <IconButton aria-label="색상 선택">*/}
        {/*    <PaletteIcon sx={{ color: props.color }} />*/}
        {/*  </IconButton>*/}
        {/*)}*/}
      </Stack>
    </FormControl>
  );
}

export default SelectForm;
