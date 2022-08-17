import React from 'react';
import { FormControl, FormLabel, OutlinedInput } from '@mui/material';

function TextFieldForm(props) {
  const { id, label, type, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '40%' }}>
        {label}
      </FormLabel>
      <OutlinedInput id={id} type={type} margin="dense" fullWidth sx={{ width: '60%' }} {...rest} />
    </FormControl>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
