import React from 'react';
import { FormControl, FormHelperText, FormLabel, OutlinedInput, Stack } from '@mui/material';

function TextFieldForm(props) {
  const { id, label, type, helperText, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '35%' }}>
        {label}
      </FormLabel>
      <Stack sx={{ width: '65%' }}>
        <OutlinedInput id={id} type={type} margin="dense" fullWidth {...rest} />
        <FormHelperText>{helperText}</FormHelperText>
      </Stack>
    </FormControl>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
