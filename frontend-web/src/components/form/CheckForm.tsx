import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, FormLabel, FormControl, Stack } from '@mui/material';

function CheckForm(props) {
  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor="userInputCheck" sx={{ width: '40%' }}>
        {props.label}
      </FormLabel>
      <Stack flexDirection="row" justifyContent="space-between" sx={{ width: '60%' }}>
        <FormControlLabel id="userInputCheck" control={<Checkbox />} label={props.label} />
      </Stack>
    </FormControl>
  );
}

export default CheckForm;
