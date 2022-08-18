import React from 'react';
import { FormControl, FormLabel, OutlinedInput, Stack } from '@mui/material';

function TextFieldForm(props) {
  const { id, label, type, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '40%' }}>
        {label}
      </FormLabel>
      <Stack flexDirection="row" sx={{ width: '60%' }}>
        <OutlinedInput id={id} type={type} margin="dense" fullWidth {...rest} />
      </Stack>
    </FormControl>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
