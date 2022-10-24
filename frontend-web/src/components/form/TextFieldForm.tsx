import React, { useState } from 'react';
import { Box, FormControl, FormLabel, OutlinedInput, Stack } from '@mui/material';

function TextFieldForm(props) {
  const { id, label, type, name, value, endButton, required, onChange } = props;

  const [text, setText] = useState(value);
  const handleChange = event => {
    setText(event.target.value);
    onChange(event);
  };

  return (
    <FormControl
      fullWidth
      required={required}
      sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <FormLabel htmlFor={id} sx={{ width: '35%' }}>
        {label}
      </FormLabel>
      <Stack flexDirection="row" justifyContent="space-between" alignItems="center" sx={{ width: '65%' }}>
        <OutlinedInput
          id={id}
          type={type}
          name={name}
          value={text}
          margin="dense"
          onChange={handleChange}
          fullWidth
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
