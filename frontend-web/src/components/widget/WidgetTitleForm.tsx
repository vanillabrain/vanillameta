import React from 'react';
import { TextField } from '@mui/material';

function WidgetTitleForm(props) {
  const { value, onChange, ...rest } = props;

  const validateTitle = title => {
    if (title === undefined) {
      console.log(title);
      return;
    }
    return title.trim() === '' || title.length > 20;
  };

  return (
    <TextField
      id="title"
      name="title"
      label="위젯 이름"
      placeholder="위젯의 이름을 입력해 주세요"
      required={validateTitle(value)}
      fullWidth
      value={value}
      onChange={onChange}
      sx={{ mt: { xs: 5, md: 0 } }}
      {...rest}
    />
  );
}

export default WidgetTitleForm;
