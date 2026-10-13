import React, { useId } from 'react';
import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup } from '@mui/material';

function RadioForm(props) {
  const { id, label, option, ...rest } = props;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = `${groupId}-label`;

  return (
    <FormControl
      fullWidth
      sx={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <FormLabel id={labelId} sx={{ width: '40%', mt: 1 }}>
        {label}
      </FormLabel>
      <RadioGroup
        id={groupId}
        aria-labelledby={labelId}
        row
        sx={{ justifyContent: 'space-between', width: '60%' }}
        {...rest}
      >
        {option.map(item => (
          <FormControlLabel key={item.value} value={item.value} control={<Radio />} label={item.label} />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

RadioForm.defaultProps = {
  label: 'label',
  option: [],
};

export default RadioForm;
