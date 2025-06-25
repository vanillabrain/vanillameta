import React from 'react';
// MUI IconButton 호환성 레이어 사용 - 점진적 마이그레이션
import { IconButton } from '../ui/mui-button-compat';
import { ReactComponent as IconClose } from '@/assets/images/icon/ic-xmark.svg';

const CloseButton = props => {
  return (
    <IconButton {...props}>
      <IconClose />
    </IconButton>
  );
};

export default CloseButton;
