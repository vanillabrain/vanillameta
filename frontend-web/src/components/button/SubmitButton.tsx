import React from 'react';
import { Button } from '@mui/material';

const SubmitButton = props => {
  const { onClick, sx = null } = props;
  return (
    <Button type={props.type || 'button'} variant="contained" size="large" fullWidth onClick={onClick} sx={sx}>
      {props.label}
    </Button>
  );
};

export default SubmitButton;
