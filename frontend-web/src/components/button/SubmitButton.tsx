import React from 'react';
// MUI Button 호환성 레이어 사용 - 점진적 마이그레이션
import { Button } from '../ui/mui-button-compat';

const SubmitButton = props => {
  const { onClick, sx = null } = props;
  return (
    <Button type={props.type || 'button'} variant="contained" size="large" fullWidth onClick={onClick} sx={sx}>
      {props.label}
    </Button>
  );
};

export default SubmitButton;
