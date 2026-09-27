import React from 'react';
import { IconButton } from '@mui/material';
import IconEdit from '@/assets/images/icon/pen-to-square.svg?react';

const ModifyButton = ({ fill = '#4A4A4A', width = '24', height = '24', ...props }) => {
  return (
    <IconButton {...props}>
      <IconEdit style={{ width: width, height: height }} fill={fill} />
    </IconButton>
  );
};

export default ModifyButton;
