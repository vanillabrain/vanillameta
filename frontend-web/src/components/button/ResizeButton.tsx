import React from 'react';
import { IconButton } from '@mui/material';
import ResizeIcon from '@/assets/images/icon/ic-resize.svg?react';

const ModifyButton = props => {
  return (
    <IconButton {...props}>
      <ResizeIcon />
    </IconButton>
  );
};

export default ModifyButton;
