import React from 'react';
import { Button } from '@/components/ui/button';
import { ReactComponent as IconEdit } from '@/assets/images/icon/pen-to-square.svg';

const ModifyButton = ({ fill = '#4A4A4A', width = '24', height = '24', size = 'icon' as 'icon' | 'default' | 'sm' | 'lg', ...props }) => {
  return (
    <Button variant="ghost" size={size} className="p-0" {...props}>
      <IconEdit style={{ width: width, height: height }} fill={fill} />
    </Button>
  );
};

export default ModifyButton;
