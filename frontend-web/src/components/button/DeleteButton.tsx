import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconDelete } from '@/assets/images/icon/trash-can.svg';

const DeleteButton = props => {
  return (
    <IconButton {...props}>
      <IconDelete />
    </IconButton>
  );
};

export default DeleteButton;
