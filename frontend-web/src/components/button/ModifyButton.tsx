import React from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as IconEdit } from '@/assets/images/icon/pen-to-square.svg';

const ModifyButton = ({ fill = '#4A4A4A', width = '24', height = '24', ...props }) => {
  return (
    <IconButton {...props}>
      <IconEdit style={{ width: width, height: height }} fill={fill} />
    </IconButton>
  );
};

export default ModifyButton;
