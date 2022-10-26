import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconClose } from '@/assets/images/icon/ic-xmark.svg';

const CloseButton = props => {
  return (
    <IconButton {...props}>
      <IconClose />
    </IconButton>
  );
};

export default CloseButton;
