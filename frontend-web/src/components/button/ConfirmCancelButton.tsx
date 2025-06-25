import React from 'react';
// MUI 호환성 레이어 사용 - 점진적 마이그레이션
import { Button } from '../ui/mui-button-compat';
import Box from '../ui/Box';
import Stack from '../ui/Stack';

export const ConfirmButton = props => {
  const { confirmLabel, confirmProps, sx } = props;
  return (
    <Button variant="contained" sx={{ minWidth: '55px', minHeight: '32px', ...sx }} {...confirmProps}>
      {confirmLabel}
    </Button>
  );
};

export const CancelButton = props => {
  const { cancelLabel, cancelProps } = props;
  return (
    <Button variant="outlined" sx={{ minWidth: '55px', minHeight: '32px' }} {...cancelProps}>
      {cancelLabel}
    </Button>
  );
};

const ConfirmCancelButton = props => {
  const { secondButton, firstButton, confirmLabel, cancelLabel, confirmProps, cancelProps } = props;

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {secondButton ?? <ConfirmButton confirmLabel={confirmLabel} confirmProps={confirmProps} />}
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {firstButton ?? <CancelButton cancelLabel={cancelLabel} cancelProps={cancelProps} />}
      </Box>
    </Stack>
  );
};

ConfirmCancelButton.defaultProps = {
  confirmLabel: '저장',
  cancelLabel: '취소',
};

export default ConfirmCancelButton;
