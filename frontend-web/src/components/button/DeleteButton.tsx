import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconDelete } from '@/assets/images/icon/trash-can.svg';

const DeleteButton = ({ fill = '#4A4A4A', width = '24', height = '24', ...props }) => {
  return (
    <IconButton {...props}>
      <IconDelete style={{ width: width, height: height }} fill={fill} />
    </IconButton>
  );
};

export default DeleteButton;
