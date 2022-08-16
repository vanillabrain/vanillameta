import React from 'react';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';

function RadioForm(props) {
  return (
    <FormControl
      fullWidth
      sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <FormLabel htmlFor="userInputRadio" sx={{ width: '40%', mt: 1 }}>
        {props.label}
      </FormLabel>
      <RadioGroup
        row
        aria-labelledby="demo-row-radio-buttons-group-label"
        name="row-radio-buttons-group"
        sx={{ justifyContent: 'space-between', width: '60%' }}
      >
        {props.option.map(item => (
          <FormControlLabel id="userInputRadio" key={item} value={item} control={<Radio />} label={item} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

export default RadioForm;
