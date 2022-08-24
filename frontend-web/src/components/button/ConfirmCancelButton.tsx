import React, { useState, useEffect } from 'react';
import { Box, Button, Stack } from '@mui/material';

export const ConfirmButton = props => {
  const { confirmLabel, confirmProps } = props;
  return (
    <Button variant="contained" sx={{ minWidth: { xs: 60, sm: 100 } }} {...confirmProps}>
      {confirmLabel}
    </Button>
  );
};

export const CancelButton = props => {
  const { cancelLabel, cancelProps } = props;
  return (
    <Button variant="outlined" sx={{ minWidth: { xs: 60, sm: 100 } }} {...cancelProps}>
      {cancelLabel}
    </Button>
  );
};

const ConfirmCancelButton = props => {
  const { confirmButton, cancelButton, confirmLabel, cancelLabel, confirmProps, cancelProps, ...rest } = props;

  const initialConfirm = <ConfirmButton confirmLabel={confirmLabel} confirmProps={confirmProps} />;
  const initialCancel = <CancelButton cancelLabel={cancelLabel} cancelProps={cancelProps} />;

  return (
    <Stack direction="row-reverse" flexWrap="wrap" component="ul" spacing={{ xs: 1, md: 2 }} p={0}>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {confirmButton !== undefined ? confirmButton : initialConfirm}
      </Box>
      <Box component="li" sx={{ listStyle: 'none' }}>
        {cancelButton !== undefined ? cancelButton : initialCancel}
      </Box>
    </Stack>
  );
};

ConfirmCancelButton.defaultProps = {
  confirmLabel: '저장',
  cancelLabel: '취소',
};

export default ConfirmCancelButton;
