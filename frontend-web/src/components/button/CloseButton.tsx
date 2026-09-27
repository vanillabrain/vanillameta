import React from 'react';
import { IconButton } from '@mui/material';
import IconClose from '@/assets/images/icon/ic-xmark.svg?react';

const CloseButton = props => {
  return (
    <IconButton {...props}>
      <IconClose />
    </IconButton>
  );
};

export default CloseButton;
