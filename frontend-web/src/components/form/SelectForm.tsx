import React from 'react';
import { FormControl, FormLabel, IconButton, MenuItem, Select, Stack } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';

function SelectForm(props) {
  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {props.label && (
        <FormLabel htmlFor="userInputSelect" sx={{ width: '40%' }}>
          {props.label}
        </FormLabel>
      )}
      <Stack flexDirection="row" justifyContent="space-between" sx={{ width: props.label ? '60%' : '100%' }}>
        <Select
          id="userInputSelect"
          value={props.value || ''}
          onChange={props.onChange || undefined}
          size="small"
          sx={props.color ? { width: 'calc(100% - 38px)' } : { width: '100%' }}
        >
          {props.option.map(item => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </Select>
        {props.color && (
          <IconButton aria-label="색상 선택">
            <PaletteIcon sx={{ color: props.color }} />
          </IconButton>
        )}
      </Stack>
    </FormControl>
  );
}

export default SelectForm;
