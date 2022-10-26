import React from 'react';
import { Alert, Box, Button, IconButton, Stack } from '@mui/material';
import { Close } from '@mui/icons-material';

const SubmitButton = props => {
  const { onClick, sx = null } = props;
  return (
    <Button type={props.type || 'button'} variant="contained" size="large" fullWidth onClick={onClick} sx={sx}>
      {props.label}
    </Button>
  );
};

export default SubmitButton;
