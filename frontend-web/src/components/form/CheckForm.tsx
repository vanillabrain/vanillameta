import React from 'react';
import { Stack } from '@mui/material';
import { Checkbox, FormControlLabel } from '@/components/ui/mui-checkbox-compat';
import { FormControl, FormLabel } from '@/components/ui/form';

function CheckForm(props) {
  const { id, label, ...rest } = props;

  return (
    <FormControl fullWidth className="flex flex-row justify-between items-center">
      <FormLabel htmlFor={id} className="w-[40%]">
        {label}
      </FormLabel>
      <Stack flexDirection="row" justifyContent="space-between" className="w-[60%]">
        <FormControlLabel id="userInputCheck" control={<Checkbox />} label={label} {...rest} />
      </Stack>
    </FormControl>
  );
}

export default CheckForm;

CheckForm.defaultProps = {};
