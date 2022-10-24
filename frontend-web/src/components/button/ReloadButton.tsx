import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconReload } from '@/assets/images/icon/arrow-rotate-right.svg';

const ReloadButton = props => {
  return (
    <IconButton {...props}>
      <IconReload />
    </IconButton>
  );
};

export default ReloadButton;
