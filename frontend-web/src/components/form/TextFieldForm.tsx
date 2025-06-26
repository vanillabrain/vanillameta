import React, { useState } from 'react';
import { TextField } from '@/components/ui/mui-textfield-compat';
import { FormControl, FormLabel } from '@/components/ui/form';

function TextFieldForm(props) {
  const { id, label, type, name, value, endButton, required, onChange, ...rest } = props;

  const [text, setText] = useState(value);
  const handleChange = event => {
    setText(event.target.value);
    onChange(event);
  };

  return (
    <FormControl
      fullWidth
      required={required}
      className="flex flex-row justify-between items-center"
    >
      <FormLabel htmlFor={id} className="w-[35%]">
        {label}
      </FormLabel>
      <div className="flex flex-row justify-between items-center w-[65%]">
        <TextField
          id={id}
          type={type}
          name={name}
          value={text}
          onChange={handleChange}
          fullWidth
          variant="outlined"
          size="small"
          className={endButton ? 'w-[calc(100%-38px)] flex-shrink' : 'w-full'}
          {...rest}
        />
        {!!endButton ? <div className="w-[38px] ml-1">{endButton}</div> : ''}
      </div>
    </FormControl>
  );
}

TextFieldForm.defaultProps = {
  type: 'text',
};

export default TextFieldForm;
