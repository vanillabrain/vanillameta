import React from 'react';
// MUI IconButton 호환성 레이어 사용 - 점진적 마이그레이션
import { IconButton } from '../ui/mui-button-compat';
import { ReactComponent as ResizeIcon } from '@/assets/images/icon/ic-resize.svg';

const ModifyButton = props => {
  return (
    <IconButton {...props}>
      <ResizeIcon />
    </IconButton>
  );
};

export default ModifyButton;
