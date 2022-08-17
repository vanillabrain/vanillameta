import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, FormLabel, FormControl, Stack } from '@mui/material';

function CheckForm(props) {
  const { id, label, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '40%' }}>
        {label}
      </FormLabel>
      <Stack flexDirection="row" justifyContent="space-between" sx={{ width: '60%' }}>
        <FormControlLabel id="userInputCheck" control={<Checkbox />} label={label} {...rest} />
      </Stack>
    </FormControl>
  );
}

export default CheckForm;
