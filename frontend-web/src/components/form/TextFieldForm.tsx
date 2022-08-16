import React from 'react';
import { FormControl, FormLabel, OutlinedInput } from '@mui/material';

function TextFieldForm(props) {
  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor="userInputText" sx={{ width: '40%' }}>
        {props.label}
      </FormLabel>
      <OutlinedInput id="userInputText" margin="dense" fullWidth sx={{ width: '60%' }} />
    </FormControl>
  );
}

export default TextFieldForm;
