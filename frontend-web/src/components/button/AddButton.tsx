import React from 'react';
import { Button, IconButton } from '@mui/material';
import { ReactComponent as IconAdd } from '@/assets/images/icon/ic-add.svg';

const AddButton = ({ sx = null, ...props }) => {
  return (
    <Button variant="contained" sx={{ width: '24px', height: '24px', p: 0, m: 0, minWidth: 0, ...sx }} {...props}>
      <IconAdd />
    </Button>
  );
};

export default AddButton;
