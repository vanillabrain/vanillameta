import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as ResizeIcon } from '@/assets/images/icon/ic-resize.svg';

const ModifyButton = props => {
  return (
    <IconButton {...props}>
      <ResizeIcon />
    </IconButton>
  );
};

export default ModifyButton;
