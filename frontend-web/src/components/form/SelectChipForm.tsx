import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Theme,
  useTheme,
} from '@mui/material';

interface SelectChipForm {
  label: string;
  color: string;
  props: object;
}

function SelectChipForm(props) {
  const { label, color, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {label && (
        <FormLabel htmlFor="userInputSelect" sx={{ width: '40%' }}>
          {label}
        </FormLabel>
      )}
      <Select
        size="small"
        sx={{ width: '60%', height: '37.7px' }}
        renderValue={(selected: any) => (
          <Chip
            label={props.option.map(item => item.value === selected && item.label)}
            size="small"
            sx={{ bgcolor: color }}
          />
        )}
        {...rest}
      >
        {props.option.map(item => (
          <MenuItem key={item.value} value={item.value}>
            {item.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

SelectChipForm.defaultProps = {
  label: 'label',
  color: '#eee',
};

export default SelectChipForm;
