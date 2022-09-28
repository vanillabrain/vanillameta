import React from 'react';
import { Box, FormControl, FormHelperText, FormLabel, OutlinedInput, Select, Stack } from '@mui/material';

function TextFieldForm(props) {
  const { id, label, type, endButton, ...rest } = props;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabel htmlFor={id} sx={{ width: '35%' }}>
        {label}
      </FormLabel>
      <Stack flexDirection="row" justifyContent="space-between" alignItems="center" sx={{ width: '65%' }}>
        <OutlinedInput
          id={id}
          type={type}
          margin="dense"
          fullWidth
          {...rest}
          sx={endButton ? { width: 'calc(100% - 38px)', flexShrink: 1 } : { width: '100%' }}
        />
        {/*<FormHelperText>{helperText}</FormHelperText>*/}
        {!!endButton ? <Box sx={{ width: '38px', ml: 1 }}>{endButton}</Box> : ''}
      </Stack>
    </FormControl>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
