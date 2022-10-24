import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconReload } from '@/assets/images/icon/ic-xmark.svg';

const CloseButton = props => {
  return (
    <IconButton {...props}>
      <IconReload />
    </IconButton>
  );
};

export default CloseButton;
