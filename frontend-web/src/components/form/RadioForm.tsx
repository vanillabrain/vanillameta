import React from 'react';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';

function RadioForm({ label, ...props }) {
  return (
    <FormControl
      fullWidth
      sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <FormLabel htmlFor={props.id} sx={{ width: '40%', mt: 1 }}>
        {label}
      </FormLabel>
      <RadioGroup
        row
        aria-labelledby="demo-row-radio-buttons-group-label"
        name="row-radio-buttons-group"
        sx={{ justifyContent: 'space-between', width: '60%' }}
      >
        {props.option.map(item => (
          <FormControlLabel {...props} key={item.id} value={item.value} control={<Radio />} label={item.label} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

export default RadioForm;
