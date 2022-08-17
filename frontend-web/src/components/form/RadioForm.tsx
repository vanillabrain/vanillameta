import React from 'react';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';

function RadioForm(props) {
  const { id, label, option, ...rest } = props;

  return (
    <FormControl
      fullWidth
      sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <FormLabel htmlFor={id} sx={{ width: '40%', mt: 1 }}>
        {label}
      </FormLabel>
      <RadioGroup row sx={{ justifyContent: 'space-between', width: '60%' }} {...rest}>
        {option.map(item => (
          <FormControlLabel id={id} key={item.value} value={item.value} control={<Radio />} label={item.label} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

RadioForm.defaultProps = {
  id: 'id',
  label: 'label',
  option: [],
};

export default RadioForm;
