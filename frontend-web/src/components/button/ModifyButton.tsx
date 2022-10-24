import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconEdit } from '@/assets/images/icon/pen-to-square.svg';

const ModifyButton = props => {
  return (
    <IconButton {...props}>
      <IconEdit />
    </IconButton>
  );
};

export default ModifyButton;
