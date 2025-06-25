import React from 'react';
// MUI IconButton 호환성 레이어 사용 - 점진적 마이그레이션
import { IconButton } from '../ui/mui-button-compat';
import { ReactComponent as IconReload } from '@/assets/images/icon/arrow-rotate-right.svg';

const ReloadButton = props => {
  return (
    <IconButton {...props}>
      <IconReload />
    </IconButton>
  );
};

export default ReloadButton;
