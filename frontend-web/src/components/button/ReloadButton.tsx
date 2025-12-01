import React from 'react';
import { IconButton } from '@mui/material';
import IconReload from '@/assets/images/icon/arrow-rotate-right.svg?react';

const ReloadButton = props => {
  return (
    <IconButton {...props}>
      <IconReload />
    </IconButton>
  );
};

export default ReloadButton;
