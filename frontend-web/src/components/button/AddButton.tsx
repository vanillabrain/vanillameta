import React from 'react';
import { Button } from '@/components/ui/button';
import { ReactComponent as IconAdd } from '@/assets/images/icon/ic-add.svg';

const AddButton = ({ className = '', ...props }) => {
  return (
    <Button
      variant="default"
      size="icon"
      className={`w-6 h-6 p-0 m-0 rounded ${className}`}
      {...props}
    >
      <IconAdd />
    </Button>
  );
};

export default AddButton;
